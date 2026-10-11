// Playing together, up to four heroes (the links themselves are in net/net.ts). The host's game runs the world:
// the monsters, their shots, the guardians and the floor. Fifteen times a second it tells every guest's game what
// is near its hero and where the other heroes are; a guest's game draws the monsters as puppets, runs its own hero
// (with its own loot, chests and merchants) and sends back where its hero stands and every blow it lands. What one
// guest's hero does (its effects and shots) the host's game passes on to the other guests. Kills come back from the
// host and each game then rolls its own loot. Items one of the heroes throws away can be picked up by the others.
import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Net, NetMsg, SLOT_COLORS, SLOT_CSS } from '../net/net';
import { Enemy, Projectile, ELITE_AFFIXES } from './entities';
import type { HitOpts } from './combat';
import { OtherHero, HeroSnap, heroSnap } from './otherhero';
import { ENEMY_BY_ID, BOSSES, STORY_BOSSES } from '../data/enemies';
import type { Element, Item } from '../data/types';
import type { CalmKind } from '../systems/dungeon';
import { T_FLOOR } from '../systems/dungeon';
import type { FloorKind } from '../systems/state';
import { saveGame, addToInventory } from '../systems/state';
import type { RiftKind } from './encounters';
import { UI } from '../ui/ui';
import { TS } from './map';
import { D } from './fx';
import { sfx } from '../systems/audio';
import { itemColor, itemIcon } from '../data/items';
import { iconURL } from '../gfx/textures';

/** how often the world is sent (per second) */
const SNAP_HZ = 15;
/** monsters further than this from a guest's hero are not sent to it (they would be off its screen) */
const NEAR = 340;
/** at most this many monsters are introduced with one snapshot (the rest with the next ones) */
const INTRO_CAP = 10;
/** effects further than this from a hero are not sent to its game */
const FX_NEAR = 420;
/** at most this many effects go to one game with one snapshot */
const FX_CAP = 48;

/** the strength of the monsters for n heroes. Two heroes face half again as many monsters with twice the health
 *  and half again as strong blows; more heroes keep that balance – each hero has as much monster health to beat
 *  and takes as many blows as in a game for two (3 heroes: twice as many monsters, 2.25× health, 1.69× damage;
 *  4 heroes: 2.5× as many, 2.4× health, 1.8× damage). A guardian, who stays alone, gets the heroes' count in
 *  health, so its fight lasts as long as for one hero. */
export function mpMults(n: number) {
  if (n <= 1) return { count: 1, hp: 1, dmg: 1, boss: 1 };
  const count = 1 + 0.5 * (n - 1);
  return { count, hp: (1.5 * n) / count, dmg: (1.125 * n) / count, boss: n };
}

/** what the guest's game needs to build the host's floor (the floor is generated from the same seed) */
export interface FloorInfo {
  floor: number;
  seed: number;
  forceMerchant: boolean;
  rift: RiftKind | null;
  calm: CalmKind | null;
  kind: FloorKind | 'camp';
  fate: string | null;
  village: boolean;
  diff: number;
  x: number;
  y: number;
  /** the host fights a guardian again (the floor is its arena) */
  rematch?: boolean;
}

/** a monster the guest's game has not seen yet */
interface Intro {
  id: number;
  d: string;
  s: string;
  x: number;
  y: number;
  el: number;
  af: string[];
  nm: string;
  sc: number;
  hp: number;
  mhp: number;
  xp: number;
  ar: number;
  c: number;
  b: string;
  sb: string;
  ph: number;
  tn: number;
  min: number;
}

/** what changed about a monster besides where it is and its health: tint (-1 none), alpha·100, scale·100, max
 *  health, a story guardian's stage and a guardian's phase */
interface Extra {
  t?: number;
  a?: number;
  s?: number;
  m?: number;
  p?: number;
  b?: number;
}
/** id, x, y, hp, flags (and what else changed) */
type Upd = [number, number, number, number, number] | [number, number, number, number, number, Extra];

const F_LEFT = 1,
  F_STUN = 2,
  F_INVULN = 4,
  F_LAST = 8;

const MIRRORED_FX = ['burst', 'number', 'ring', 'disc', 'telegraph', 'slash', 'pillar', 'lightning', 'beam'] as const;
type FxName = (typeof MIRRORED_FX)[number];

const r1 = (v: number) => Math.round(v * 10) / 10;

/** what the host's game has told one guest's game so far */
class View {
  known = new Set<number>();
  knownSprite = new Map<number, string>();
  seenAt = new Map<number, number>();
  /** what the guest's game was last told about each monster (only changes go out) */
  sentExtra = new Map<number, Required<Extra>>();
  forget(id: number) {
    this.known.delete(id);
    this.seenAt.delete(id);
    this.knownSprite.delete(id);
    this.sentExtra.delete(id);
  }
  clear() {
    this.known.clear();
    this.knownSprite.clear();
    this.seenAt.clear();
    this.sentExtra.clear();
  }
}

export class Coop {
  sc: GameScene;
  role: 'host' | 'guest';
  /** the other players' heroes by their place (0 is the host) */
  heroes = new Map<number, OtherHero>();
  private snapT = 0;
  private unsub: (() => void)[] = [];
  /** the other games' shots (drawn only), by the place of the game they come from and their id there */
  private shots = new Map<string, Projectile>();
  /** effects sent to each game within this snapshot's time */
  private fxSent = new Map<number, number>();
  /** >0 while this game draws what another one sent (nothing goes back) */
  private muted = 0;
  /** the ring under this game's own hero, in its player's colour */
  private ring: Phaser.GameObjects.Image | null = null;
  /** whom the camera follows while this game's hero is out of the fight */
  private watching = -1;
  // host
  private views = new Map<number, View>();
  private gate: { cells: number[]; imgs: Phaser.GameObjects.Image[]; label: Phaser.GameObjects.Text } | null = null;
  /** shared items on the ground (thrown away by one of the heroes) */
  private shared = new Map<number, Item>();
  private nextGid = 1;
  /** the guest whose blow the host's game is landing right now */
  private hitFrom = -1;
  // guest
  puppets = new Map<number, Enemy>();
  private bossOn = 0;
  private status = new Map<number, Record<string, number>>();
  private knock = new Map<number, [number, number]>();
  /** this game's hero fell: it waits for the next floor and watches the others */
  downed = false;
  private hudT = 0;

  constructor(sc: GameScene, role: 'host' | 'guest') {
    this.sc = sc;
    this.role = role;
    this.wrapFx();
    this.unsub.push(
      Net.on('ev', (m, from) => this.onEvents(m.e as Record<string, unknown>[], from)),
      Net.on(role === 'host' ? 'me' : 's', (m, from) => (role === 'host' ? this.onGuestHero(m, from) : this.onSnapshot(m))),
    );
    UI.mpStatus(true);
    // a new floor in the guest's game: the host introduces every monster again
    if (role === 'guest') Net.event({ k: 'sync' });
  }

  get isHost() {
    return this.role === 'host';
  }
  get isGuest() {
    return this.role === 'guest';
  }

  destroy() {
    for (const u of this.unsub) u();
    this.unsub = [];
    for (const h of this.heroes.values()) h.destroyAll();
    this.heroes.clear();
    this.gate?.label.destroy();
    this.ring?.destroy();
    this.ring = null;
    UI.mpWatch(null);
    UI.mpStatus(false);
  }

  /** the host's game: the guests' heroes the monsters may go for (standing and still in touch) */
  targets(): OtherHero[] {
    if (!this.isHost) return [];
    const out: OtherHero[] = [];
    for (const h of this.heroes.values()) if (!h.dead && h.quietT < 5) out.push(h);
    return out;
  }

  /** the hero of the guest whose blow is landing now (a mirrored champion sends part of it back there) */
  remoteHero() {
    return this.heroes.get(this.hitFrom) ?? null;
  }

  /** how many heroes (this game's too) stand within r of a point, and how many are needed: every hero still
   *  standing (one out of the fight is not waited for) */
  gather(x: number, y: number, r: number, near?: (x: number, y: number) => boolean): [number, number] {
    const at = near ?? ((hx: number, hy: number) => Math.hypot(hx - x, hy - y) < r);
    const p = this.sc.player;
    let n = 0,
      need = 0;
    if (p && !p.dead) {
      need++;
      if (at(p.x, p.y)) n++;
    }
    for (const h of this.heroes.values()) {
      if (h.dead || h.quietT > 5) continue;
      need++;
      if (at(h.x, h.y)) n++;
    }
    return [n, need];
  }

  /** whom the camera follows while this game's hero is out of the fight: a standing hero (the same one while it
   *  stands) */
  watched(): OtherHero | null {
    const p = this.sc.player;
    if (!p?.dead) return null;
    const cur = this.heroes.get(this.watching);
    if (cur && !cur.dead && cur.quietT < 5) return cur;
    for (const [slot, h] of [...this.heroes].sort((a, b) => a[0] - b[0]))
      if (!h.dead && h.quietT < 5) {
        this.watching = slot;
        return h;
      }
    return null;
  }

  // ------------------------------------------------------------ every frame
  update(dt: number) {
    const sc = this.sc;
    for (const h of this.heroes.values()) h.tick(dt);
    this.placeRing();
    if (this.isGuest) this.flushStatus();
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 1 / SNAP_HZ;
      this.fxSent.clear();
      if (this.isHost) {
        const me = heroSnap(sc.player);
        for (const slot of Net.guests) Net.sendTo(slot, { t: 's', ...this.snapshot(slot, me) });
      } else if (sc.player) Net.send({ t: 'me', h: heroSnap(sc.player) });
    }
    if (this.isHost) this.gateTick();
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.25;
      UI.mpParty(
        Net.others().map(([slot, info]) => {
          const h = this.heroes.get(slot);
          return { slot, name: info.name, lvl: h?.lvl ?? info.lvl, frac: h ? h.hp / Math.max(1, h.maxHp) : 1, dead: !!h?.dead };
        }),
      );
      const w = this.watched();
      UI.mpWatch(w ? w.info.name : null, w ? SLOT_CSS[w.slot] : undefined);
    }
    Net.flush();
  }

  /** the ring under this game's own hero: everyone sees whose hero is whose by its colour */
  private placeRing() {
    const p = this.sc.player;
    if (!p) return;
    if (!this.ring) this.ring = this.sc.add.image(p.x, p.y + 3, 'ring').setAlpha(0.6).setScale(16 / 256, 8 / 256).setDepth(D.floorDeco + 2);
    const c = SLOT_COLORS[Net.slot] ?? SLOT_COLORS[0];
    if (this.ring.tintTopLeft !== c) this.ring.setTint(c);
    this.ring.setPosition(p.x, p.y + 3).setAlpha(p.dead ? 0.25 : 0.75);
  }

  // ------------------------------------------------------------ effects and shots go both ways
  private wrapFx() {
    const fx = this.sc.fx as unknown as Record<FxName, (...a: unknown[]) => unknown>;
    for (const k of MIRRORED_FX) {
      const orig = fx[k].bind(fx);
      fx[k] = (...a: unknown[]) => {
        const r = orig(...a);
        if (!this.muted && Net.active) this.sendFx(k, a, -1);
        return r;
      };
    }
  }

  /** an effect goes to the games whose heroes are near it (from: the guest it came from, which shows it already) */
  private sendFx(f: string, a: unknown[], from: number) {
    const x = a[0] as number,
      y = a[1] as number;
    const ev = { k: 'fx', f, a: a.map((v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)) };
    if (this.isHost) {
      for (const slot of Net.guests) {
        if (slot === from) continue;
        const h = this.heroes.get(slot);
        if (h && Math.hypot(h.x - x, h.y - y) > FX_NEAR) continue;
        if (this.fxRoom(slot, f)) Net.eventTo(slot, ev);
      }
      return;
    }
    // a guest's effect goes to the host's game, which passes it on to the heroes near it
    let near = !this.heroes.size;
    for (const h of this.heroes.values())
      if (Math.hypot(h.x - x, h.y - y) < FX_NEAR) {
        near = true;
        break;
      }
    if (near && this.fxRoom(0, f)) Net.event(ev);
  }

  /** room for one more effect to a game in this snapshot's time (bursts give way to the rest first) */
  private fxRoom(slot: number, f: string) {
    const n = this.fxSent.get(slot) ?? 0;
    if (n >= FX_CAP || (f === 'burst' && n >= FX_CAP * 0.7)) return false;
    this.fxSent.set(slot, n + 1);
    return true;
  }

  private playFx(f: string, a: unknown[]) {
    const fx = this.sc.fx as unknown as Record<string, (...x: unknown[]) => unknown>;
    if (!MIRRORED_FX.includes(f as FxName) || typeof fx[f] !== 'function') return;
    this.muted++;
    try {
      fx[f](...a);
    } finally {
      this.muted--;
    }
  }

  /** a shot was fired in this game: the others draw it too (the host's monsters', the heroes' own) */
  onShot(pr: Projectile) {
    if (!Net.active || pr.o.cosmetic) return;
    // a guest's game has no monsters of its own: only its hero's shots go over
    if (this.isGuest && pr.o.owner !== 'player') return;
    Net.event({ k: 'pj', id: pr.netId, s: pr.sprite.texture.key, x: r1(pr.x), y: r1(pr.y), a: Math.round(Math.atan2(pr.vy, pr.vx) * 100) / 100, v: Math.round(Math.hypot(pr.vx, pr.vy)), r: Math.round(pr.maxRange), z: pr.o.size ?? 1, el: pr.o.el });
  }
  onShotGone(pr: Projectile) {
    if (!Net.active || pr.o.cosmetic) return;
    if (this.isGuest && pr.o.owner !== 'player') return;
    Net.event({ k: 'pk', id: pr.netId });
  }

  private drawShot(e: Record<string, unknown>, key: string) {
    const sc = this.sc;
    const pr = new Projectile(sc, { x: e.x as number, y: e.y as number, angle: e.a as number, speed: e.v as number, sprite: e.s as string, dmg: 0, el: (e.el as Element) ?? 'phys', owner: 'enemy', range: e.r as number, size: e.z as number, cosmetic: true });
    sc.projectiles.push(pr);
    this.shots.set(key, pr);
  }

  // ------------------------------------------------------------ host: the world goes out
  private view(slot: number) {
    let v = this.views.get(slot);
    if (!v) {
      v = new View();
      this.views.set(slot, v);
    }
    return v;
  }

  /** what one guest's game gets: the monsters near its hero (new ones introduced, the known ones moved) and the
   *  other heroes */
  private snapshot(slot: number, me: HeroSnap) {
    const sc = this.sc;
    const v = this.view(slot);
    const g = this.heroes.get(slot);
    const gx = g ? g.x : sc.player.x,
      gy = g ? g.y : sc.player.y;
    const now = sc.time.now;
    const n: Intro[] = [];
    const e: Upd[] = [];
    const alive = new Set<number>();
    for (const m of sc.enemies) {
      if (m.dead) continue;
      alive.add(m.id);
      if (!m.boss && Math.hypot(m.x - gx, m.y - gy) > NEAR) continue;
      if (!v.known.has(m.id) || v.knownSprite.get(m.id) !== m.spriteKey) {
        // a few new ones at a time keep every message small
        if (n.length >= INTRO_CAP) continue;
        n.push(this.intro(m));
        v.known.add(m.id);
        v.knownSprite.set(m.id, m.spriteKey);
        v.sentExtra.delete(m.id);
      }
      v.seenAt.set(m.id, now);
      const flags = (m.facing < 0 ? F_LEFT : 0) | (m.stunned ? F_STUN : 0) | (m.invuln ? F_INVULN : 0) | (m.lastStand ? F_LAST : 0);
      const cur: Required<Extra> = { t: m.sprite.isTinted && !m.sprite.tintFill ? m.sprite.tintTopLeft : -1, a: Math.round(m.sprite.alpha * 100), s: Math.round(m.baseScale * 100), m: Math.round(m.maxHp), p: m.phase, b: m.bphase };
      const last = v.sentExtra.get(m.id);
      const x: Extra = {};
      let changed = false;
      for (const k of ['t', 'a', 's', 'm', 'p', 'b'] as const)
        if (!last || last[k] !== cur[k]) {
          x[k] = cur[k];
          changed = true;
        }
      v.sentExtra.set(m.id, cur);
      const u: Upd = changed ? [m.id, r1(m.x), r1(m.y - m.hop), Math.round(m.hp), flags, x] : [m.id, r1(m.x), r1(m.y - m.hop), Math.round(m.hp), flags];
      e.push(u);
    }
    // monsters that left without dying (a thief escaped, an illusion broke) leave the guest's game too
    for (const id of v.known)
      if (!alive.has(id)) {
        Net.eventTo(slot, { k: 'rm', id });
        v.forget(id);
      }
    // monsters not sent for a while are forgotten (they get introduced again when they come near)
    for (const [id, t] of v.seenAt) if (now - t > 900) v.forget(id);
    // the heroes: the host's own and the other guests' (as their games last told)
    const hs: [number, HeroSnap][] = [[0, me]];
    for (const [s, h] of this.heroes) if (s !== slot && h.last) hs.push([s, h.last]);
    return { hs, n, e };
  }

  private intro(m: Enemy): Intro {
    return {
      id: m.id,
      d: m.def.id,
      s: m.spriteKey,
      x: r1(m.x),
      y: r1(m.y),
      el: m.elite ? 1 : 0,
      af: m.affixes,
      nm: m.name,
      sc: m.baseScale,
      hp: Math.round(m.hp),
      mhp: Math.round(m.maxHp),
      xp: m.xp,
      ar: Math.round(m.armor),
      c: m.corrupt ? 1 : 0,
      b: m.boss && !m.story ? m.boss.id : '',
      sb: m.story ? m.story.id : '',
      ph: m.phase,
      tn: m.baseTint ?? -1,
      min: m.isMinion ? 1 : 0,
    };
  }

  /** a guest's hero: where it is and how it looks */
  private onGuestHero(m: NetMsg, from: number) {
    const h = m.h as HeroSnap;
    if (!h) return;
    this.heroFor(from, h).apply(h);
  }

  /** the hero of a player (made when its first word comes) */
  private heroFor(slot: number, h: HeroSnap) {
    let o = this.heroes.get(slot);
    if (!o) {
      const info = Net.players.get(slot) ?? { name: Net.nameOf(slot), cls: 'warrior' as const, lvl: h.lvl };
      o = new OtherHero(this.sc, info, slot, h.x, h.y);
      this.heroes.set(slot, o);
    }
    return o;
  }

  /** a player left: its hero goes */
  dropHero(slot: number) {
    this.heroes.get(slot)?.destroyAll();
    this.heroes.delete(slot);
    this.views.delete(slot);
    if (this.watching === slot) this.watching = -1;
  }

  /** the floor goes over to the guests (when it starts), or to one guest (when it joins) */
  sendFloor(to?: number) {
    const sc = this.sc;
    const info: FloorInfo = {
      floor: sc.floor,
      seed: sc.floorSeed,
      forceMerchant: sc.floorOpts.forceMerchant,
      rift: sc.rift,
      calm: sc.calm ?? null,
      kind: sc.kind,
      fate: sc.fate?.id ?? null,
      village: sc.inVillage,
      diff: sc.save.difficulty ?? 1,
      x: Math.round(sc.player.x),
      y: Math.round(sc.player.y),
      rematch: !!sc.rematch,
    };
    for (const slot of to === undefined ? Net.guests : [to]) {
      Net.sendTo(slot, { t: 'floor', f: info });
      // what is already sealed on this floor
      if (sc.arenaGate) Net.eventTo(slot, { k: 'gate', st: 'sealed', cells: sc.arenaGate.cells });
      else if (this.gate) Net.eventTo(slot, { k: 'gate', st: 'closed', cells: this.gate.cells });
      this.view(slot).clear();
    }
  }

  /** the number of heroes changed (someone came or went): every monster gets the strength for the new count */
  scaleExisting() {
    for (const e of this.sc.enemies) this.scaleEnemy(e);
  }
  scaleEnemy(e: Enemy) {
    if (e.dead || e.puppet || this.isGuest) return;
    const m = mpMults(Net.count);
    const hp = e.boss ? m.boss : m.hp;
    if (e.mpHp === hp && e.mpDmg === m.dmg) return;
    const f = hp / e.mpHp;
    e.maxHp = Math.max(1, Math.round(e.maxHp * f));
    e.hp = Math.max(1, Math.round(e.hp * f));
    e.dmg *= m.dmg / e.mpDmg;
    if (e.story) e.capRate *= f;
    e.mpHp = hp;
    e.mpDmg = m.dmg;
  }

  /** a monster died in the host's game: every guest's game hears it (one that forgot it for a moment – a story
   *  scene held the world – must not keep a guardian alive; the others ignore it) */
  onKill(e: Enemy) {
    Net.event({ k: 'kill', id: e.id });
    for (const v of this.views.values()) v.forget(e.id);
  }

  // ------------------------------------------------------------ host: the gate of a guardian's arena (everyone)
  /** on a guardian's floor the way into the arena stays closed until every hero stands at it */
  closeGate() {
    const sc = this.sc;
    const d = sc.dungeon;
    const br = d.bossRoom;
    if (!br || this.gate || sc.arenaGate || sc.bossDefeated) return;
    const cells = sc.arenaCells();
    if (!cells.length) return;
    const imgs: Phaser.GameObjects.Image[] = [];
    for (const n of cells) {
      sc.map.solid[n] = 1;
      imgs.push(this.gateImg(n, 0xffd76a));
    }
    const [lx, ly] = this.gateCenter(cells);
    const label = sc.fx.label(lx, ly - 14, `Brána strážce 0/${Net.count}`, '#ffd76a', 7, true);
    this.gate = { cells, imgs, label };
    Net.event({ k: 'gate', st: 'closed', cells });
  }

  private gateCenter(cells: number[]): [number, number] {
    const w = this.sc.dungeon.w;
    let x = 0,
      y = 0;
    for (const n of cells) {
      x += (n % w) * TS + 8;
      y += Math.floor(n / w) * TS + 8;
    }
    return [x / cells.length, y / cells.length];
  }

  private gateImg(n: number, color: number) {
    const sc = this.sc;
    const w = sc.dungeon.w;
    const px = (n % w) * TS + 8,
      py = Math.floor(n / w) * TS + 8;
    const img = sc.add.image(px, py, 'glow').setTint(color).setAlpha(0).setScale(0.9, 1.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    sc.tweens.add({ targets: img, alpha: 0.75, duration: 300 });
    sc.tweens.add({ targets: img, scaleY: 1.6, yoyo: true, repeat: -1, duration: 700, delay: 300 });
    return img;
  }

  private gateTick() {
    const g = this.gate;
    if (!g) return;
    const sc = this.sc;
    const w = sc.dungeon.w;
    const near = (x: number, y: number) => g.cells.some((n) => Math.hypot((n % w) * TS + 8 - x, Math.floor(n / w) * TS + 8 - y) < 34);
    // every hero still standing has to come (the ones who left or fell are not waited for)
    const [count, need] = this.gather(0, 0, 0, near);
    const txt = `Brána strážce ${count}/${Math.max(1, need)}`;
    if (g.label.text !== txt) g.label.setText(txt);
    if (count < need || !need) return;
    for (const n of g.cells) sc.map.solid[n] = 0;
    for (const img of g.imgs) sc.tweens.add({ targets: img, alpha: 0, duration: 500, onComplete: () => img.destroy() });
    g.label.destroy();
    this.gate = null;
    sfx('door');
    UI.toast('Brána strážce se otevřela – vstupte do arény spolu', '#ffd76a');
    Net.event({ k: 'gate', st: 'open', cells: g.cells });
    Net.event({ k: 'toast', m: 'Brána strážce se otevřela – vstupte do arény spolu', c: '#ffd76a' });
  }

  /** the arena sealed for the fight or opened after it: the guest's map follows */
  arenaChanged(st: 'sealed' | 'open', cells: number[]) {
    Net.event({ k: 'gate', st, cells });
  }

  // ------------------------------------------------------------ guest: the world comes in
  private onSnapshot(m: NetMsg) {
    const sc = this.sc;
    if (!sc.sys.isActive() && !sc.sys.isPaused()) return;
    // the other heroes: the host's and the other guests'
    const seen = new Set<number>();
    for (const [slot, h] of (m.hs as [number, HeroSnap][]) ?? []) {
      if (slot === Net.slot || !h) continue;
      seen.add(slot);
      this.heroFor(slot, h).apply(h);
    }
    // a hero the host stopped sending has left the game
    for (const [slot, o] of this.heroes) if (!seen.has(slot) && o.quietT > 2) this.dropHero(slot);
    for (const n of (m.n as Intro[]) ?? []) this.spawnPuppet(n);
    const now = sc.time.now;
    for (const u of (m.e as Upd[]) ?? []) {
      const e = this.puppets.get(u[0]);
      if (!e || e.dead) continue;
      // its speed between the last two words: it keeps going until the next one (a jump is not a speed)
      const gap = (now - e.seenAt) / 1000;
      if (gap > 0.02 && gap < 0.4) {
        const vx = (u[1] - e.ptx) / gap,
          vy = (u[2] - e.pty) / gap;
        if (Math.hypot(vx, vy) < 320) {
          e.pvx = e.pvx * 0.35 + vx * 0.65;
          e.pvy = e.pvy * 0.35 + vy * 0.65;
        } else e.pvx = e.pvy = 0;
      } else e.pvx = e.pvy = 0;
      e.ptx = u[1];
      e.pty = u[2];
      e.seenAt = now;
      if (Math.abs(e.hp - u[3]) > 0.5) e.hpBarT = 3;
      e.hp = u[3];
      e.facing = u[4] & F_LEFT ? -1 : 1;
      e.pStun = !!(u[4] & F_STUN);
      e.invuln = !!(u[4] & F_INVULN);
      e.lastStand = !!(u[4] & F_LAST);
      const x = u[5];
      if (!x) continue;
      if (x.m !== undefined) e.maxHp = Math.max(1, x.m);
      if (x.t !== undefined) e.pTint = x.t;
      if (x.a !== undefined) e.sprite.setAlpha(x.a / 100);
      if (x.s !== undefined && Math.abs(e.baseScale * 100 - x.s) > 1) e.setScale(x.s / 100);
      if ((x.p !== undefined && x.p !== e.phase) || (x.b !== undefined && x.b !== e.bphase)) {
        if (x.p !== undefined) e.phase = x.p;
        if (x.b !== undefined) e.bphase = x.b;
        if (this.bossOn === u[0]) UI.showBoss(e);
      }
      if (x.t !== undefined && e.hitFlash <= 0) this.tintPuppet(e);
    }
    // monsters the host stopped sending are out of sight
    for (const [id, e] of this.puppets)
      if (!e.dead && now - e.seenAt > 1300) {
        e.dead = true;
        e.destroyVisuals();
        e.nameLabel?.destroy();
        e.roleIcon?.destroy();
        e.aura?.destroy();
        this.puppets.delete(id);
      }
  }

  private spawnPuppet(n: Intro) {
    const sc = this.sc;
    const old = this.puppets.get(n.id);
    if (old) {
      // the same monster with a new look (a story guardian's next stage)
      old.dead = true;
      old.destroyVisuals();
      old.nameLabel?.destroy();
      old.roleIcon?.destroy();
      old.aura?.destroy();
    }
    const base = ENEMY_BY_ID[n.d] ?? ENEMY_BY_ID.skeleton;
    const def = n.s && n.s !== base.sprite && sc.textures.exists(n.s) ? { ...base, sprite: n.s } : base;
    const e = new Enemy(sc, def, n.x, n.y, sc.floor, false, -1, null);
    e.puppet = true;
    e.pid = n.id;
    e.ptx = n.x;
    e.pty = n.y;
    e.seenAt = sc.time.now;
    e.elite = !!n.el;
    e.affixes = n.af ?? [];
    e.eliteAffix = e.affixes[0] ?? null;
    e.name = n.nm;
    e.maxHp = Math.max(1, n.mhp);
    e.hp = n.hp;
    e.xp = n.xp;
    e.armor = n.ar;
    e.corrupt = !!n.c;
    e.isMinion = !!n.min;
    e.aggro = true;
    e.phase = n.ph;
    if (n.b) e.boss = BOSSES.find((b) => b.id === n.b) ?? null;
    if (n.sb) {
      const st = STORY_BOSSES.find((b) => b.id === n.sb) ?? null;
      e.story = st;
      if (st) {
        const ph = st.phases[Math.min(n.ph, st.phases.length - 1)];
        e.boss = { id: st.id, name: st.name, sprite: ph.sprite, scale: ph.scale, hp: e.maxHp, dmg: ph.dmg, speed: ph.speed, patterns: ph.patterns, proj: ph.proj, el: ph.el, summon: ph.summon, tint: ph.tint };
      }
    }
    e.setScale(n.sc);
    if (n.tn >= 0) {
      e.baseTint = n.tn;
      e.sprite.setTint(n.tn);
    }
    if (e.elite && e.eliteAffix && ELITE_AFFIXES[e.eliteAffix]) e.addGlow(ELITE_AFFIXES[e.eliteAffix].glow, e.affixes.length > 1 ? 3 : 2);
    if (e.corrupt) e.addGlow(0x9a2aff, 4);
    // what the guest's hero does to a puppet (statuses, knockback) is sent to the host
    const raw = e.st;
    e.st = new Proxy(raw, {
      set: (o, k: string, v: number) => {
        const before = (o as unknown as Record<string, number>)[k];
        (o as unknown as Record<string, number>)[k] = v;
        if (v > before || (k === 'slowMult' && v < before)) {
          const s = this.status.get(e.pid) ?? {};
          s[k] = v;
          this.status.set(e.pid, s);
        }
        return true;
      },
    });
    for (const axis of ['knockX', 'knockY'] as const)
      Object.defineProperty(e, axis, {
        get: () => 0,
        set: (v: number) => {
          if (!v) return;
          const kb = this.knock.get(e.pid) ?? [0, 0];
          kb[axis === 'knockX' ? 0 : 1] += v;
          this.knock.set(e.pid, kb);
        },
        configurable: true,
      });
    sc.enemies.push(e);
    this.puppets.set(n.id, e);
  }

  /** a puppet's colour: what the host's game shows (a frenzy, a shield of light) or its own */
  private tintPuppet(e: Enemy) {
    if (e.pTint >= 0) e.sprite.setTint(e.pTint);
    else if (e.baseTint !== null) e.sprite.setTint(e.baseTint);
    else e.sprite.clearTint();
  }

  /** a puppet moves to where the host says it is */
  tickPuppet(e: Enemy, dt: number) {
    if (e.dead) return;
    // where it should be now: the last word of the host carried on at its speed for a moment (no stop-and-go
    // between the words), and the sprite glides there
    const age = Math.min(0.12, (this.sc.time.now - e.seenAt) / 1000);
    const tx = e.ptx + (e.pStun ? 0 : e.pvx * age),
      ty = e.pty + (e.pStun ? 0 : e.pvy * age);
    const k = Math.min(1, dt * 16);
    const dx = tx - e.x,
      dy = ty - e.y;
    const far = Math.hypot(dx, dy);
    if (far > 120) {
      e.x = tx;
      e.y = ty;
    } else {
      e.x += dx * k;
      e.y += dy * k;
    }
    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      if (e.hitFlash <= 0) this.tintPuppet(e);
    }
    if (e.hpBarT > 0) e.hpBarT -= dt;
    e.syncSprite(far > 0.6 && !e.pStun);
  }

  /** a blow of the guest's hero (or its summons) on a puppet: the host decides, the guest's game shows it now */
  puppetHit(e: Enemy, dmg: number, o: HitOpts, el: Element, crit: boolean): number {
    dmg = Math.max(1, dmg);
    Net.event({
      k: 'hit',
      id: e.pid,
      d: Math.round(dmg * 10) / 10,
      el,
      cr: crit ? 1 : 0,
      sp: o.spell ? 1 : 0,
      dot: o.dot ? 1 : 0,
      at: o.isAttack ? 1 : 0,
      th: o.thorns ? 1 : 0,
      al: o.fromAlly ? 1 : 0,
      kx: o.kx ? Math.round(o.kx) : 0,
      ky: o.ky ? Math.round(o.ky) : 0,
    });
    // the puppet's bar drops right away (the host's word corrects it); it never dies before the host says so
    e.hp = Math.max(1, e.hp - dmg);
    e.hpBarT = 3;
    return dmg;
  }

  /** statuses and knockback the guest's hero put on puppets in this frame */
  private flushStatus() {
    for (const [id, s] of this.status) Net.event({ k: 'st', id, s });
    this.status.clear();
    for (const [id, [x, y]] of this.knock) Net.event({ k: 'kb', id, x: Math.round(x), y: Math.round(y) });
    this.knock.clear();
  }

  // ------------------------------------------------------------ events from the other games
  private onEvents(list: Record<string, unknown>[], from: number) {
    const sc = this.sc;
    if (!list || (!sc.sys.isActive() && !sc.sys.isPaused())) return;
    for (const e of list) {
      try {
        this.onEvent(e, from);
      } catch (err) {
        console.error('coop event', e.k, err);
      }
    }
  }

  private onEvent(e: Record<string, unknown>, from: number) {
    const sc = this.sc;
    switch (e.k) {
      case 'fx':
        this.playFx(e.f as string, e.a as unknown[]);
        // what one guest's hero does the other guests near it see too
        if (this.isHost) this.sendFx(e.f as string, e.a as unknown[], from);
        break;
      case 'pj': {
        // a shot is known by the game it comes from: the host passes a guest's shots on with its place
        const origin = this.isHost ? from : ((e.o as number) ?? 0);
        this.drawShot(e, `${origin}:${e.id}`);
        if (this.isHost) Net.eventExcept(from, { ...e, o: from });
        break;
      }
      case 'pk': {
        const origin = this.isHost ? from : ((e.o as number) ?? 0);
        const key = `${origin}:${e.id}`;
        const pr = this.shots.get(key);
        if (pr && !pr.dead) pr.kill();
        this.shots.delete(key);
        if (this.isHost) Net.eventExcept(from, { ...e, o: from });
        break;
      }
      case 'toast':
        UI.toast(e.m as string, (e.c as string) ?? '#9fe6ff');
        break;
      // ---- host → guest
      case 'kill': {
        const m = this.puppets.get(e.id as number);
        if (!m || m.dead) break;
        this.puppets.delete(e.id as number);
        m.hp = 0;
        sc.combat.killEnemy(m);
        break;
      }
      case 'rm': {
        const m = this.puppets.get(e.id as number);
        if (!m) break;
        this.puppets.delete(e.id as number);
        m.dead = true;
        sc.tweens.add({ targets: [m.sprite, m.shadow], alpha: 0, duration: 300, onComplete: () => m.destroyVisuals() });
        m.nameLabel?.destroy();
        m.roleIcon?.destroy();
        m.aura?.destroy();
        break;
      }
      case 'hurt':
        this.guestHurt(e);
        break;
      case 'boss': {
        if (!e.on) {
          this.bossOn = 0;
          UI.hideBoss();
          break;
        }
        const m = this.puppets.get(e.id as number);
        if (m) {
          this.bossOn = e.id as number;
          UI.showBoss(m);
        }
        break;
      }
      case 'bnote':
        UI.bossNote(e.m as string);
        break;
      case 'cut':
        if (!UI.cutsceneActive) void UI.cutscene(e.shots as never, (e.o as never) ?? {});
        break;
      case 'gate':
        this.guestGate(e.st as string, e.cells as number[]);
        break;
      case 'down':
        UI.toast(`${Net.nameOf(0)} je mimo boj – dojděte ke schodům, cestu dolů pak vybere hostitel`, '#ff8a7a');
        break;
      case 'wipe':
        UI.toast('Celá družina padla – výprava se vrací jako po smrti', '#ff8a7a');
        break;
      case 'gadd':
        this.sharedAppears(e.gid as number, e.item as Item, e.x as number, e.y as number);
        break;
      case 'grm':
        sc.loot.removeShared(e.gid as number);
        break;
      case 'got': {
        const it = e.item as Item;
        if (!addToInventory(sc.save, it)) {
          UI.toast('Batoh je plný – předmět zůstal ležet', '#ff8080');
          Net.event({ k: 'drop', item: it, x: Math.round(sc.player.x), y: Math.round(sc.player.y) });
        } else {
          sfx('pickup');
          UI.loot(it.name, itemColor(it), iconURL(itemIcon(it), 32));
        }
        break;
      }
      // ---- guest → host
      case 'ready':
        sc.guestAtStairs(from);
        break;
      case 'hit':
        this.hostHit(e, from);
        break;
      case 'st': {
        const m = this.hostEnemy(e.id as number);
        if (!m) break;
        const s = e.s as Record<string, number>;
        const st = m.st as unknown as Record<string, number>;
        for (const [k, v] of Object.entries(s)) {
          if (!(k in st)) continue;
          st[k] = k === 'slowMult' ? (m.st.slowT > 0 ? Math.min(st[k], v) : v) : Math.max(st[k], v);
        }
        break;
      }
      case 'kb': {
        const m = this.hostEnemy(e.id as number);
        if (m && !m.boss && m.def.behavior !== 'static') {
          m.knockX += e.x as number;
          m.knockY += e.y as number;
        }
        break;
      }
      case 'dead': {
        const h = this.heroes.get(from);
        if (h) h.dead = true;
        const msg = `${Net.nameOf(from)} je mimo boj – vrátí se v dalším patře`;
        UI.toast(msg, '#ff8a7a');
        Net.eventExcept(from, { k: 'toast', m: msg, c: '#ff8a7a' });
        // the last one standing fell: the whole party is down
        sc.checkWipe();
        break;
      }
      case 'drop':
        this.hostDrop(e.item as Item, e.x as number, e.y as number);
        break;
      case 'take':
        this.hostTake(e.gid as number, from);
        break;
      case 'sync': {
        // a guest's game began a floor: everything there is gets introduced to it again
        this.view(from).clear();
        if (sc.arenaGate) Net.eventTo(from, { k: 'gate', st: 'sealed', cells: sc.arenaGate.cells });
        else if (this.gate) Net.eventTo(from, { k: 'gate', st: 'closed', cells: this.gate.cells });
        for (const [gid, it] of this.shared) {
          const g = sc.loot.ground.find((x) => x.shared === gid && !x.dead);
          if (g) Net.eventTo(from, { k: 'gadd', gid, item: it, x: Math.round(g.x), y: Math.round(g.y) });
        }
        break;
      }
    }
  }

  private hostEnemy(id: number) {
    for (const m of this.sc.enemies) if (m.id === id && !m.dead) return m;
    return null;
  }

  /** a guest's blow arrives in the host's game */
  private hostHit(e: Record<string, unknown>, from: number) {
    const m = this.hostEnemy(e.id as number);
    if (!m) return;
    const o: HitOpts = { el: e.el as Element, spell: !!e.sp, dot: !!e.dot, isAttack: !!e.at, thorns: !!e.th, fromAlly: !!e.al, kx: e.kx as number, ky: e.ky as number };
    this.muted++;
    this.hitFrom = from;
    try {
      this.sc.combat.landHit(m, e.d as number, o, (e.el as Element) ?? 'phys', !!e.cr, 1, true);
    } finally {
      this.muted--;
      this.hitFrom = -1;
    }
  }

  // ------------------------------------------------------------ guest: blows and falling
  private guestHurt(e: Record<string, unknown>) {
    const sc = this.sc;
    const p = sc.player;
    if (!p || p.dead || this.downed) return;
    const foe = (e.foe as number) ? this.puppets.get(e.foe as number) ?? null : null;
    sc.combat.cause = (e.n as string) || null;
    sc.combat.damagePlayer(e.d as number, foe, (e.el as Element) ?? 'phys');
    if (p.dead) return;
    if (e.poison) p.applyPoison(e.poison as number, 3);
    if (e.chill) p.chill(e.chill as number);
    if (e.burn) {
      p.st.burnT = Math.max(p.st.burnT, 2.5);
      p.st.burnDps = Math.max(p.st.burnDps, e.burn as number);
    }
  }

  /** a guest's hero fell: it stays out of the fight, watching the others, until the party reaches the next floor */
  guestDied() {
    this.downed = true;
    Net.event({ k: 'dead' });
    UI.toast('Jsi mimo boj – vrátíš se v dalším patře, až do něj družina sestoupí', '#ff8a7a');
    this.sc.payForDeath();
  }

  // ------------------------------------------------------------ guest: the arena's gates
  private guestGate(st: string, cells: number[]) {
    const sc = this.sc;
    if (!cells?.length) return;
    sc.coopGateImgs.forEach((i) => i.destroy());
    sc.coopGateImgs = [];
    for (const n of cells) {
      if (sc.dungeon.grid[n] !== T_FLOOR) continue;
      sc.map.solid[n] = st === 'open' ? 0 : 1;
      if (st !== 'open') sc.coopGateImgs.push(this.gateImg(n, st === 'sealed' ? 0xb07dff : 0xffd76a));
    }
    if (st === 'closed') {
      const [lx, ly] = this.gateCenter(cells);
      const t = sc.fx.label(lx, ly - 14, 'Brána strážce – přijďte k ní všichni', '#ffd76a', 7, true);
      sc.coopGateImgs.push(t as unknown as Phaser.GameObjects.Image);
    }
  }

  // ------------------------------------------------------------ items thrown away (every hero may take them)
  /** host: an item thrown away from the host's bag becomes a shared one */
  hostShare(it: Item, x: number, y: number): number {
    const gid = this.nextGid++;
    this.shared.set(gid, it);
    Net.event({ k: 'gadd', gid, item: it, x: Math.round(x), y: Math.round(y) });
    return gid;
  }
  /** host: the host's hero picked up a shared item */
  hostPicked(gid: number) {
    this.shared.delete(gid);
    Net.event({ k: 'grm', gid });
  }
  /** host: a guest threw an item away */
  private hostDrop(it: Item, x: number, y: number) {
    if (!it) return;
    const sc = this.sc;
    const gid = this.nextGid++;
    this.shared.set(gid, it);
    sc.loot.dropShared(it, x, y, gid);
    Net.event({ k: 'gadd', gid, item: it, x: Math.round(x), y: Math.round(y) });
  }
  /** host: a guest wants a shared item (whoever is first gets it) */
  private hostTake(gid: number, from: number) {
    const it = this.shared.get(gid);
    if (!it) return void Net.eventTo(from, { k: 'grm', gid });
    this.shared.delete(gid);
    this.sc.loot.removeShared(gid);
    Net.eventTo(from, { k: 'got', gid, item: it });
    Net.event({ k: 'grm', gid });
  }
  /** guest: a shared item lies on the floor */
  private sharedAppears(gid: number, it: Item, x: number, y: number) {
    if (!it) return;
    this.sc.loot.dropShared(it, x, y, gid);
  }
  /** guest: the guest's hero steps on a shared item */
  guestTake(gid: number) {
    Net.event({ k: 'take', gid });
  }
  /** guest: an item thrown away from the guest's bag goes to the host's floor for everyone */
  guestDrop(it: Item) {
    const p = this.sc.player;
    const a = p.facing > 0 ? 0 : Math.PI;
    Net.event({ k: 'drop', item: it, x: Math.round(p.x + Math.cos(a) * 36), y: Math.round(p.y + Math.sin(a) * 36) });
  }

  // ------------------------------------------------------------ host: players come and go
  /** another guest joined the host's game in the middle of a floor */
  addGuest(slot: number) {
    this.scaleExisting();
    this.sendFloor(slot);
  }

  /** a guest left the host's game: its hero goes, the monsters get weaker, and when it was the last one standing
   *  the party is down */
  removeGuest(slot: number) {
    this.dropHero(slot);
    this.scaleExisting();
    this.sc.checkWipe();
  }
}

/** the floor of the host's world arrives: the guest's game moves there (or home to its own village) */
Net.on('floor', (m) => {
  const sc = UI.scene;
  const f = m.f as FloorInfo;
  if (!sc || !f || Net.role !== 'guest') return;
  saveGame(sc.save);
  if (f.village) {
    if (!sc.inVillage || sc.guestInfo) sc.scene.restart({ save: sc.save, village: true });
    return;
  }
  sc.scene.restart({ save: sc.save, coop: f });
});

/** someone joined or left, or the link broke */
Net.onChange((why, slot, name) => {
  const sc = UI.scene;
  if (!sc) return;
  const who = name ?? (slot !== undefined ? Net.nameOf(slot) : 'Spoluhráč');
  if (why === 'joined') {
    if (Net.role === 'host') {
      sc.startCoop(slot ?? 1);
      UI.keepRunning();
    } else
      UI.toast(
        `Připojeno – hrajete spolu: ${Net.others()
          .map(([, p]) => p.name)
          .join(', ')}`,
        '#9fe6ff',
      );
    return;
  }
  // a guest's game hears about the others
  if (why === 'arrived') {
    if (slot !== Net.slot) UI.toast(`Do hry přichází ${who}`, '#9fe6ff');
    return;
  }
  if (why === 'departed') {
    if (slot !== undefined) sc.coop?.dropHero(slot);
    UI.toast(`${who} opouští hru`, '#ffd76a');
    return;
  }
  // the host lost one guest: the others play on
  if (Net.role === 'host' && slot !== undefined && (why === 'left' || why === 'lost')) {
    sc.coop?.removeGuest(slot);
    UI.toast(why === 'lost' ? `Spojení s hráčem ${who} se ztratilo` : `${who} opouští hru`, '#ffd76a');
    if (!Net.guests.length) {
      sc.endCoop();
      UI.toast('Hra pokračuje pro jednoho – další hráči se mohou připojit stejným kódem', '#9fe6ff');
    }
    return;
  }
  // this game left for the main menu (or its hardcore hero is gone): nothing more to do here
  if (why === 'quit') {
    sc.endCoop();
    return;
  }
  // the whole game ended
  if (why === 'lost' || why === 'left' || why === 'closed' || why === 'full' || why === 'version') {
    const wasGuest = !!sc.guestInfo;
    sc.endCoop();
    const msg = { lost: 'Spojení se ztratilo – hra pokračuje pro jednoho', left: 'Společná hra skončila', full: 'Hra je plná – hrají v ní už čtyři hráči', version: 'Hra druhé strany má jinou verzi – obnovte obě stránky' }[why as 'lost'];
    if (msg) UI.toast(msg, '#ff8a7a');
    // a guest goes back to its own world
    if (wasGuest) {
      saveGame(sc.save);
      sc.scene.restart({ save: sc.save });
    }
  }
});
