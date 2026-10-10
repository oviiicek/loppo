// Online play for two: the host plays their own world and a second hero joins with a short code. The two
// devices talk directly (WebRTC through PeerJS; the PeerJS cloud only introduces them to each other). A local
// loopback over BroadcastChannel lets two tabs of one browser play together for testing (?mp=local).
import type { ClassId } from '../data/types';

export type NetRole = 'host' | 'guest';

/** who plays on the other side */
export interface PeerInfo {
  name: string;
  cls: ClassId;
  lvl: number;
}

export interface NetMsg {
  t: string;
  [k: string]: unknown;
}

type Handler = (m: NetMsg) => void;

interface Link {
  send(m: string): void;
  close(): void;
}

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
  /** off → waiting for a guest (host) / connecting (guest) → on */
  status: 'off' | 'waiting' | 'connecting' | 'on' = 'off';
  partner: PeerInfo | null = null;
  me: PeerInfo | null = null;
  private link: Link | null = null;
  private peer: { destroy(): void } | null = null;
  private handlers = new Map<string, Handler[]>();
  private queue: unknown[] = [];
  /** parts of long messages still coming (by their number) */
  private parts = new Map<number, string[]>();
  private nextLong = 1;
  private lastHeard = 0;
  private beat: number | null = null;
  /** told about every change of the status (the lobby and the HUD listen) */
  private listeners: ((why?: string) => void)[] = [];

  get active() {
    return this.status === 'on';
  }
  get isHost() {
    return this.status === 'on' && this.role === 'host';
  }
  get isGuest() {
    return this.status === 'on' && this.role === 'guest';
  }
  /** a session is open (also while waiting for the other player) */
  get open() {
    return this.status !== 'off';
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
  onChange(fn: (why?: string) => void) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((h) => h !== fn));
  }
  private changed(why?: string) {
    for (const fn of [...this.listeners]) fn(why);
  }

  send(m: NetMsg) {
    if (!this.link) return;
    try {
      const str = JSON.stringify(m);
      if (str.length <= PART) this.link.send(str);
      else {
        const id = this.nextLong++;
        const n = Math.ceil(str.length / PART);
        for (let i = 0; i < n; i++) this.link.send(JSON.stringify({ t: '_p', id, i, n, d: str.slice(i * PART, (i + 1) * PART) }));
      }
    } catch {
      /* a closing channel */
    }
  }

  /** a message as it came over the wire (a string; long ones in parts) */
  private receive(raw: unknown): void {
    let m: NetMsg;
    try {
      m = (typeof raw === 'string' ? JSON.parse(raw) : raw) as NetMsg;
    } catch {
      return;
    }
    if (m.t === '_p') {
      const id = m.id as number;
      const list = this.parts.get(id) ?? new Array(m.n as number);
      list[m.i as number] = m.d as string;
      this.parts.set(id, list);
      if (list.filter((x) => x !== undefined).length < list.length) return;
      this.parts.delete(id);
      return this.receive(list.join(''));
    }
    this.dispatch(m);
  }
  /** an event for the other side, sent with the others of this frame (see flush) */
  event(e: unknown) {
    if (this.status === 'on') this.queue.push(e);
  }
  flush() {
    if (!this.queue.length) return;
    this.send({ t: 'ev', e: this.queue });
    this.queue = [];
  }

  private dispatch(m: NetMsg) {
    this.lastHeard = Date.now();
    if (m.t === 'hi') {
      this.partner = m.who as PeerInfo;
      const was = this.status;
      this.status = 'on';
      // the host answers the guest's greeting
      if (this.role === 'host' && was !== 'on') this.send({ t: 'hi', who: this.me });
      this.changed('joined');
    } else if (m.t === 'bye') {
      this.drop('left');
      return;
    }
    for (const h of this.handlers.get(m.t) ?? []) {
      try {
        h(m);
      } catch (err) {
        console.error('net handler', m.t, err);
      }
    }
  }

  private startBeat() {
    this.stopBeat();
    this.lastHeard = Date.now();
    this.beat = window.setInterval(() => {
      if (this.status !== 'on') return;
      this.send({ t: 'ping' });
      if (Date.now() - this.lastHeard > TIMEOUT * 1000) this.drop('lost');
    }, 2000);
  }
  private stopBeat() {
    if (this.beat !== null) window.clearInterval(this.beat);
    this.beat = null;
  }

  /** the link is gone: back to playing alone */
  private drop(why: string) {
    const had = this.status !== 'off';
    this.stopBeat();
    try {
      this.link?.close();
    } catch {
      /* already closed */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* already gone */
    }
    this.link = null;
    this.peer = null;
    this.status = 'off';
    this.partner = null;
    this.queue = [];
    if (had) this.changed(why);
    this.role = null;
  }

  /** opens a game for a second player; resolves with the code to give them */
  async host(me: PeerInfo): Promise<string> {
    this.leave();
    this.role = 'host';
    this.me = me;
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
    this.send({ t: 'hi', who: me });
  }

  /** ends the game for two (the other side is told) */
  leave() {
    if (this.status === 'off') return;
    this.send({ t: 'bye' });
    this.drop('closed');
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
        // one guest at a time
        if (this.link) {
          conn.on('open', () => conn.close());
          return;
        }
        conn.on('open', () => {
          this.link = { send: (m) => conn.send(m), close: () => conn.close() };
          this.startBeat();
        });
        conn.on('data', (d) => this.receive(d));
        conn.on('close', () => {
          if (this.link) this.drop('lost');
        });
      });
    });
  }

  private async joinPeer(code: string) {
    const { Peer } = await import('peerjs');
    await new Promise<void>((resolve, reject) => {
      const peer = new Peer(peerOptions());
      let done = false;
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
          this.link = { send: (m) => conn.send(m), close: () => conn.close() };
          this.startBeat();
          resolve();
        });
        conn.on('data', (d) => this.receive(d));
        conn.on('close', () => {
          if (this.link) this.drop('lost');
        });
      });
    });
  }

  // ------------------------------------------------------------ the local loopback (two tabs)
  private async hostLocal(code: string) {
    const ch = new BroadcastChannel(PREFIX + code);
    this.peer = { destroy: () => ch.close() };
    ch.onmessage = (ev) => {
      if (!this.link) {
        this.link = { send: (x) => ch.postMessage(x), close: () => ch.close() };
        this.startBeat();
      }
      this.receive(ev.data);
    };
  }

  private async joinLocal(code: string) {
    const ch = new BroadcastChannel(PREFIX + code);
    this.peer = { destroy: () => ch.close() };
    this.link = { send: (x) => ch.postMessage(x), close: () => ch.close() };
    ch.onmessage = (ev) => this.receive(ev.data);
    this.startBeat();
  }
}

export const Net = new NetSession();
(window as unknown as { __net: NetSession }).__net = Net;
