// Online play for up to four: the host plays their own world and up to three more heroes join with a short code.
// Every guest's device talks directly to the host's (WebRTC through PeerJS; the PeerJS cloud only introduces them
// to each other) and the host's game passes on what the guests should know about each other. A local loopback
// over BroadcastChannel lets tabs of one browser play together for testing (?mp=local).
import type { ClassId } from '../data/types';

export type NetRole = 'host' | 'guest';

/** who plays in the game */
export interface PeerInfo {
  name: string;
  cls: ClassId;
  lvl: number;
}

export interface NetMsg {
  t: string;
  [k: string]: unknown;
}

/** a message and the place of the player it came from (0 is the host) */
type Handler = (m: NetMsg, from: number) => void;

/** the line to one other game (the host has one to every guest, a guest one to the host) */
interface Link {
  /** the place of the player on the other end */
  slot: number;
  send(m: string): void;
  close(): void;
  lastHeard: number;
  /** events for this game, sent together at the end of the frame (see flush) */
  queue: unknown[];
  /** parts of long messages still coming (by their number) */
  parts: Map<number, string[]>;
  /** the guest said who it is */
  greeted: boolean;
}

/** the version of what the games say to each other (a game of another version is not let in) */
const PROTOCOL = 2;
/** the most heroes in one game */
export const MAX_PLAYERS = 4;
/** every player's colour (the ring under the hero, the name, the dot on the map): the host blue, then orange,
 *  purple and green */
export const SLOT_COLORS = [0x4aa8ff, 0xff9a3a, 0xb46aff, 0x5adf6a];
export const SLOT_CSS = ['#6cbcff', '#ffab5a', '#c48aff', '#72e882'];

/** letters that cannot be mistaken for each other on a phone screen */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'loppo-hra-';
/** after this many seconds without a word from the other side the link counts as lost */
const TIMEOUT = 10;
/** longer messages go in parts (some browsers refuse a data channel message over 16 KB) */
const PART = 12000;

function newCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/** inside another page (like the game embedded in a chat) the browser does not allow direct links between devices */
export const embedded = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};
const NO_SERVER = embedded() ? 'Nepodařilo se spojit – otevři hru přímo na oviiicek.github.io/loppo.' : 'Nepodařilo se spojit se serverem. Je zapnutý internet?';

const local = () => typeof location !== 'undefined' && /[?&]mp=local/.test(location.search);
/** testing against a PeerJS server on this computer (?mp=peer-local): no cloud, no STUN/TURN */
function peerOptions() {
  if (typeof location !== 'undefined' && /[?&]mp=peer-local/.test(location.search)) return { debug: 0, host: '127.0.0.1', port: 9000, path: '/', secure: false, config: { iceServers: [] } };
  return { debug: 0 };
}

class NetSession {
  role: NetRole | null = null;
  code = '';
  /** off → waiting for guests (host) / connecting (guest) → on (at least two play) */
  status: 'off' | 'waiting' | 'connecting' | 'on' = 'off';
  me: PeerInfo | null = null;
  /** this game's place: 0 the host, 1–3 the guests in the order they came */
  slot = 0;
  /** everyone in the game by their place (this game too) */
  players = new Map<number, PeerInfo>();
  private links = new Map<number, Link>();
  private peer: { destroy(): void } | null = null;
  private handlers = new Map<string, Handler[]>();
  private nextLong = 1;
  private beat: number | null = null;
  /** told about every change (the lobby and the HUD listen): why, and the place of the player it is about */
  private listeners: ((why?: string, slot?: number, name?: string) => void)[] = [];

  get active() {
    return this.status === 'on';
  }
  get isHost() {
    return this.status === 'on' && this.role === 'host';
  }
  get isGuest() {
    return this.status === 'on' && this.role === 'guest';
  }
  /** a session is open (also while waiting for the others) */
  get open() {
    return this.status !== 'off';
  }
  /** how many heroes play in this game (1 alone) */
  get count() {
    return this.status === 'on' ? Math.max(1, this.players.size) : 1;
  }
  /** the places of the guests this host's game talks to */
  get guests(): number[] {
    return this.role === 'host' ? [...this.links.values()].filter((l) => l.greeted).map((l) => l.slot) : [];
  }
  /** the other players by place */
  others(): [number, PeerInfo][] {
    return [...this.players].filter(([s]) => s !== this.slot).sort((a, b) => a[0] - b[0]);
  }
  /** a player's name (or a stand-in) */
  nameOf(slot: number) {
    return this.players.get(slot)?.name ?? (slot === 0 ? 'Hostitel' : 'Spoluhráč');
  }

  on(t: string, fn: Handler) {
    const l = this.handlers.get(t) ?? [];
    l.push(fn);
    this.handlers.set(t, l);
    return () => this.off(t, fn);
  }
  off(t: string, fn: Handler) {
    const l = this.handlers.get(t);
    if (l) this.handlers.set(
      t,
      l.filter((h) => h !== fn),
    );
  }
  onChange(fn: (why?: string, slot?: number, name?: string) => void) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((h) => h !== fn));
  }
  private changed(why?: string, slot?: number, name?: string) {
    for (const fn of [...this.listeners]) fn(why, slot, name);
  }

  private sendLink(link: Link, m: NetMsg) {
    try {
      const str = JSON.stringify(m);
      if (str.length <= PART) link.send(str);
      else {
        const id = this.nextLong++;
        const n = Math.ceil(str.length / PART);
        for (let i = 0; i < n; i++) link.send(JSON.stringify({ t: '_p', id, i, n, d: str.slice(i * PART, (i + 1) * PART) }));
      }
    } catch {
      /* a closing channel */
    }
  }
  /** to everyone on the other end (the host: every guest; a guest: the host) */
  send(m: NetMsg) {
    for (const l of this.links.values()) if (l.greeted || this.role === 'guest') this.sendLink(l, m);
  }
  /** to one player only */
  sendTo(slot: number, m: NetMsg) {
    const l = this.links.get(slot);
    if (l) this.sendLink(l, m);
  }

  /** a message as it came over the wire (a string; long ones in parts) */
  private receive(raw: unknown, link: Link): void {
    let m: NetMsg;
    try {
      m = (typeof raw === 'string' ? JSON.parse(raw) : raw) as NetMsg;
    } catch {
      return;
    }
    if (m.t === '_p') {
      const id = m.id as number;
      const list = link.parts.get(id) ?? new Array(m.n as number);
      list[m.i as number] = m.d as string;
      link.parts.set(id, list);
      if (list.filter((x) => x !== undefined).length < list.length) return;
      link.parts.delete(id);
      return this.receive(list.join(''), link);
    }
    this.dispatch(m, link);
  }
  /** an event for the other side(s), sent with the others of this frame (see flush) */
  event(e: unknown) {
    if (this.status !== 'on') return;
    for (const l of this.links.values()) if (l.greeted || this.role === 'guest') l.queue.push(e);
  }
  /** an event for one player only */
  eventTo(slot: number, e: unknown) {
    if (this.status !== 'on') return;
    this.links.get(slot)?.queue.push(e);
  }
  /** an event for everyone but one player (the host passing on what that one did) */
  eventExcept(slot: number, e: unknown) {
    if (this.status !== 'on') return;
    for (const l of this.links.values()) if (l.slot !== slot && l.greeted) l.queue.push(e);
  }
  flush() {
    for (const l of this.links.values()) {
      if (!l.queue.length) continue;
      this.sendLink(l, { t: 'ev', e: l.queue });
      l.queue = [];
    }
  }

  private dispatch(m: NetMsg, link: Link) {
    link.lastHeard = Date.now();
    if (m.t === 'hi') {
      if (this.role === 'host') {
        // a game of another version would not understand this one
        if (m.v !== PROTOCOL) {
          this.sendLink(link, { t: 'ver', v: PROTOCOL });
          window.setTimeout(() => this.dropLink(link, 'version'), 600);
          return;
        }
        // a guest says who it is: it gets its place and everyone learns who plays now
        const first = !link.greeted;
        link.greeted = true;
        this.players.set(link.slot, m.who as PeerInfo);
        this.sendLink(link, { t: 'hi', who: this.me, slot: link.slot, list: [...this.players] });
        this.status = 'on';
        this.sendRoster();
        if (first) this.changed('joined', link.slot);
      } else {
        this.slot = (m.slot as number) ?? 1;
        // everyone who plays already
        if (Array.isArray(m.list)) this.players = new Map(m.list as [number, PeerInfo][]);
        this.players.set(0, m.who as PeerInfo);
        if (this.me) this.players.set(this.slot, this.me);
        const was = this.status;
        this.status = 'on';
        if (was !== 'on') this.changed('joined', 0);
      }
      return;
    }
    if (m.t === 'roster' && this.role === 'guest') {
      const before = this.players;
      this.players = new Map(m.list as [number, PeerInfo][]);
      if (this.me) this.players.set(this.slot, this.me);
      for (const [s, p] of this.players) if (!before.has(s)) this.changed('arrived', s, p.name);
      for (const [s, p] of before) if (!this.players.has(s)) this.changed('departed', s, p.name);
      return;
    }
    if ((m.t === 'full' || m.t === 'ver') && this.role === 'guest') {
      this.drop(m.t === 'full' ? 'full' : 'version');
      return;
    }
    if (m.t === 'bye') {
      if (this.role === 'host') this.dropLink(link, 'left');
      else this.drop('left');
      return;
    }
    for (const h of this.handlers.get(m.t) ?? []) {
      try {
        h(m, link.slot);
      } catch (err) {
        console.error('net handler', m.t, err);
      }
    }
  }

  /** the host tells every guest who plays now */
  private sendRoster() {
    if (this.role !== 'host') return;
    const list = [...this.players];
    for (const l of this.links.values()) if (l.greeted) this.sendLink(l, { t: 'roster', list });
  }

  private startBeat() {
    if (this.beat !== null) return;
    this.beat = window.setInterval(() => {
      const now = Date.now();
      for (const l of [...this.links.values()]) {
        this.sendLink(l, { t: 'ping' });
        if (now - l.lastHeard > TIMEOUT * 1000) {
          if (this.role === 'host') this.dropLink(l, 'lost');
          else this.drop('lost');
        }
      }
    }, 2000);
  }
  private stopBeat() {
    if (this.beat !== null) window.clearInterval(this.beat);
    this.beat = null;
  }

  /** a new line to another game (the host's to a guest gets the first free place) */
  private addLink(send: (m: string) => void, close: () => void): Link | null {
    let slot = 0;
    if (this.role === 'host') {
      for (let s = 1; s < MAX_PLAYERS; s++)
        if (!this.links.has(s)) {
          slot = s;
          break;
        }
      if (!slot) return null;
    }
    const link: Link = { slot, send, close, lastHeard: Date.now(), queue: [], parts: new Map(), greeted: this.role === 'guest' };
    this.links.set(slot, link);
    this.startBeat();
    return link;
  }

  /** the host lost one guest: the others play on */
  private dropLink(link: Link, why: string) {
    if (this.links.get(link.slot) !== link) return;
    this.links.delete(link.slot);
    try {
      link.close();
    } catch {
      /* already closed */
    }
    const was = link.greeted;
    const name = this.players.get(link.slot)?.name;
    this.players.delete(link.slot);
    if (this.status === 'on' && ![...this.links.values()].some((l) => l.greeted)) this.status = 'waiting';
    this.sendRoster();
    if (was) this.changed(why, link.slot, name);
  }

  /** the whole session is gone: back to playing alone */
  private drop(why: string) {
    const had = this.status !== 'off';
    this.stopBeat();
    for (const l of this.links.values())
      try {
        l.close();
      } catch {
        /* already closed */
      }
    try {
      this.peer?.destroy();
    } catch {
      /* already gone */
    }
    this.links.clear();
    this.peer = null;
    this.status = 'off';
    this.players.clear();
    this.slot = 0;
    if (had) this.changed(why);
    this.role = null;
  }

  /** opens a game for more players; resolves with the code to give them */
  async host(me: PeerInfo): Promise<string> {
    this.leave();
    this.role = 'host';
    this.me = me;
    this.slot = 0;
    this.players = new Map([[0, me]]);
    this.status = 'connecting';
    this.changed();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = newCode();
      try {
        if (local()) await this.hostLocal(code);
        else await this.hostPeer(code);
        this.code = code;
        this.status = 'waiting';
        this.changed();
        return code;
      } catch (err) {
        if ((err as Error).message !== 'taken') {
          this.drop('error');
          throw err;
        }
      }
    }
    this.drop('error');
    throw new Error('Nepodařilo se založit hru, zkus to znovu.');
  }

  /** joins the game of the given code */
  async join(code: string, me: PeerInfo): Promise<void> {
    this.leave();
    this.role = 'guest';
    this.me = me;
    this.code = code.trim().toUpperCase();
    this.status = 'connecting';
    this.changed();
    try {
      if (local()) await this.joinLocal(this.code);
      else await this.joinPeer(this.code);
    } catch (err) {
      this.drop('error');
      throw err;
    }
    this.send({ t: 'hi', who: me, v: PROTOCOL });
  }

  /** leaves the game (the others are told; the host's leaving ends it for everyone). why 'quit': the game goes to
   *  the main menu, a guest's game does not go back to its own world first */
  leave(why: 'closed' | 'quit' = 'closed') {
    if (this.status === 'off') return;
    this.send({ t: 'bye' });
    this.drop(why);
  }

  // ------------------------------------------------------------ PeerJS
  private async hostPeer(code: string) {
    const { Peer } = await import('peerjs');
    await new Promise<void>((resolve, reject) => {
      const peer = new Peer(PREFIX + code, peerOptions());
      let opened = false;
      // a server that never answers counts as unreachable
      const timer = window.setTimeout(() => {
        if (opened) return;
        opened = true;
        peer.destroy();
        reject(new Error(NO_SERVER));
      }, 15000);
      peer.on('open', () => {
        if (opened) return;
        opened = true;
        window.clearTimeout(timer);
        this.peer = peer;
        resolve();
      });
      peer.on('error', (err: { type?: string }) => {
        if (!opened) {
          opened = true;
          window.clearTimeout(timer);
          peer.destroy();
          reject(new Error(err.type === 'unavailable-id' ? 'taken' : NO_SERVER));
        } else if (err.type === 'network' || err.type === 'server-error') this.changed('server');
      });
      peer.on('connection', (conn) => {
        let link: Link | null = null;
        conn.on('open', () => {
          link = this.addLink(
            (m) => conn.send(m),
            () => conn.close(),
          );
          // four play already: the newcomer is told and let go
          if (!link) {
            try {
              conn.send(JSON.stringify({ t: 'full' }));
            } catch {
              /* already closing */
            }
            window.setTimeout(() => conn.close(), 600);
          }
        });
        conn.on('data', (d) => {
          if (link) this.receive(d, link);
        });
        conn.on('close', () => {
          if (link) this.dropLink(link, 'lost');
        });
      });
    });
  }

  private async joinPeer(code: string) {
    const { Peer } = await import('peerjs');
    await new Promise<void>((resolve, reject) => {
      const peer = new Peer(peerOptions());
      let done = false;
      let link: Link | null = null;
      const fail = (msg: string) => {
        if (done) return;
        done = true;
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = window.setTimeout(() => fail('Hra s tímto kódem neodpovídá.'), 15000);
      peer.on('error', (err: { type?: string }) => fail(err.type === 'peer-unavailable' ? 'Hra s tímto kódem neexistuje.' : NO_SERVER));
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
        conn.on('open', () => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          this.peer = peer;
          link = this.addLink(
            (m) => conn.send(m),
            () => conn.close(),
          );
          resolve();
        });
        conn.on('data', (d) => {
          if (link) this.receive(d, link);
        });
        conn.on('close', () => {
          if (link && this.links.get(0) === link) this.drop('lost');
        });
      });
    });
  }

  // ------------------------------------------------------------ the local loopback (tabs of one browser)
  // every tab hears every message on the channel, so each one carries who sent it and for whom
  private async hostLocal(code: string) {
    const ch = new BroadcastChannel(PREFIX + code);
    const byTab = new Map<string, Link>();
    this.peer = { destroy: () => ch.close() };
    ch.onmessage = (ev) => {
      const { f, to, d } = (ev.data ?? {}) as { f?: string; to?: string; d?: unknown };
      if (to !== 'H' || !f) return;
      let link = byTab.get(f);
      if (!link || this.links.get(link.slot) !== link) {
        const fresh = this.addLink(
          (x) => ch.postMessage({ f: 'H', to: f, d: x }),
          () => byTab.delete(f),
        );
        if (!fresh) return void ch.postMessage({ f: 'H', to: f, d: JSON.stringify({ t: 'full' }) });
        link = fresh;
        byTab.set(f, link);
      }
      this.receive(d, link);
    };
  }

  private async joinLocal(code: string) {
    const ch = new BroadcastChannel(PREFIX + code);
    const me = Math.random().toString(36).slice(2, 10);
    this.peer = { destroy: () => ch.close() };
    const link = this.addLink(
      (x) => ch.postMessage({ f: me, to: 'H', d: x }),
      () => {},
    );
    ch.onmessage = (ev) => {
      const { to, d } = (ev.data ?? {}) as { to?: string; d?: unknown };
      if (to === me && link) this.receive(d, link);
    };
  }
}

export const Net = new NetSession();
(window as unknown as { __net: NetSession }).__net = Net;
