import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { SPELL_BY_ID, SpellDef, Fx } from '../data/spells';
import { spellRank } from '../systems/state';
import { Ally, Enemy, ALLY_DEFS } from './entities';
import { D, EL_COLOR } from './fx';
import { Element } from '../data/types';
import { sfx } from '../systems/audio';
import { HitOpts } from './combat';

interface Field {
  x: number;
  y: number;
  r: number;
  dps: number;
  el: Element;
  t: number;
  follow: boolean;
  slow?: number;
  pull?: boolean;
  vuln?: number;
  lifesteal?: number;
  tick: number;
  gfx: Phaser.GameObjects.Image;
  spin?: Phaser.GameObjects.Image;
}

interface Trap {
  x: number;
  y: number;
  r: number;
  dmg: number;
  el: Element;
  freeze?: number;
  armT: number;
  life: number;
  sprite: Phaser.GameObjects.Image;
}

interface Whirl {
  t: number;
  r: number;
  dmg: number;
  tick: number;
  sprite: Phaser.GameObjects.Image;
}

interface Orbit {
  t: number;
  r: number;
  dmg: number;
  angle: number;
  sprites: Phaser.GameObjects.Image[];
  hitT: Map<number, number>;
}

interface Dance {
  left: number;
  dmg: number;
  timer: number;
  hit: Set<number>;
}

export class Spells {
  scene: GameScene;
  fields: Field[] = [];
  traps: Trap[] = [];
  whirls: Whirl[] = [];
  orbits: Orbit[] = [];
  dances: Dance[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  get p() {
    return this.scene.player;
  }

  // -------------------------------------------------------------- casting
  manaCost(sp: SpellDef) {
    return Math.round(sp.mana * (1 + 0.012 * this.p.save.level));
  }

  cooldown(sp: SpellDef) {
    const rank = spellRank(this.p.save, sp.id);
    return sp.cd * (1 - this.p.d.cdr / 100) * (1 - 0.02 * (rank - 1));
  }

  tryCast(slot: number): boolean {
    const p = this.p;
    if (p.dead) return false;
    const id = p.save.loadout[slot];
    if (!id) return false;
    const sp = SPELL_BY_ID[id];
    if (!sp || sp.lvl > p.save.level) return false;
    if (p.cds[slot] > 0) return false;
    const cost = this.manaCost(sp);
    if (p.mp < cost) {
      this.scene.ui.toast('Nedostatek many', '#6fb6ff');
      return false;
    }
    p.mp -= cost;
    p.cds[slot] = this.cooldown(sp);
    this.execute(sp);
    if (p.d.specials.has('spellEcho') && Math.random() < 0.1) {
      this.scene.time.delayedCall(350, () => {
        if (!p.dead) {
          this.scene.fx.number(p.x, p.y - 22, 'ozvěna!', '#c77dff');
          this.execute(sp);
        }
      });
    }
    if (p.stealthT > 0 && !sp.fx.some((f) => f.t === 'stealth')) {
      p.stealthT = 0;
      p.sprite.setAlpha(1);
    }
    return true;
  }

  dmgFor(sp: SpellDef, f: Fx) {
    const rank = spellRank(this.p.save, sp.id);
    const rankMult = 1 + 0.15 * (rank - 1);
    const base = sp.scale === 'weapon' ? this.p.weaponHit() : this.p.spellBase();
    return base * (f.p ?? 1) * rankMult;
  }

  aimAngle(): number {
    const p = this.p;
    const t = this.scene.nearestEnemy(p.x, p.y, 200, true);
    if (t) return Math.atan2(t.y - 5 * t.baseScale - (p.y - 6), t.x - p.x);
    const mv = this.scene.moveVec;
    if (Math.hypot(mv[0], mv[1]) > 0.2) return Math.atan2(mv[1], mv[0]);
    return p.facing > 0 ? 0 : Math.PI;
  }

  targetPoint(maxDist = 180): [number, number] {
    const p = this.p;
    const t = this.scene.nearestEnemy(p.x, p.y, maxDist, true);
    if (t) return [t.x, t.y];
    const a = this.aimAngle();
    // walk forward until wall
    let x = p.x,
      y = p.y;
    for (let i = 0; i < 12; i++) {
      const nx = x + Math.cos(a) * 6,
        ny = y + Math.sin(a) * 6;
      if (this.scene.map.isSolidPx(nx, ny)) break;
      x = nx;
      y = ny;
    }
    return [x, y];
  }

  execute(sp: SpellDef) {
    const p = this.p;
    const sc = this.scene;
    sfx('spell');
    const col = Phaser.Display.Color.HexStringToColor(sp.color).color;
    sc.fx.burst(p.x, p.y - 8, col, 10);
    const rank = spellRank(p.save, sp.id);
    for (const f of sp.fx) {
      const run = () => this.runFx(sp, f, rank, col);
      if (f.delay && !['aoe', 'rain'].includes(f.t)) sc.time.delayedCall(f.delay * 1000, run);
      else run();
    }
  }

  runFx(sp: SpellDef, f: Fx, rank: number, col: number) {
    const p = this.p;
    const sc = this.scene;
    const el: Element = f.el ?? (sp.scale === 'magic' ? 'shadow' : 'phys');
    const dmg = this.dmgFor(sp, f);
    const spell = true;
    switch (f.t) {
      case 'proj': {
        let n = f.n ?? 1;
        if (p.d.specials.has('extraProjectile')) n += 1;
        const a0 = this.aimAngle();
        for (let i = 0; i < n; i++) {
          let a = a0;
          if (f.ring) a = a0 + (i / n) * Math.PI * 2;
          else if (n > 1) {
            const spread = ((f.spread ?? 20) * Math.PI) / 180;
            a = a0 - spread / 2 + (spread * i) / (n - 1);
          }
          sc.spawnSpellProjectile({
            x: p.x + Math.cos(a) * 6,
            y: p.y - 6 + Math.sin(a) * 6,
            angle: a,
            speed: f.speed ?? 280,
            sprite: f.sprite ?? 'magic',
            dmg,
            el: f.el ?? 'phys',
            owner: 'player',
            pierce: f.pierce,
            explode: f.explode,
            bounce: f.bounce,
            homing: f.homing,
            size: f.size,
            range: f.range ?? (f.dot ? 220 : 260),
            slow: f.slow,
            stun: f.stun,
            freeze: f.freeze,
            dot: f.dot,
            lifesteal: f.lifesteal,
            spell,
          });
        }
        break;
      }
      case 'nova':
        this.nova(p.x, p.y, f.r ?? 60, dmg, el, { stun: f.stun, freeze: f.freeze, knock: f.knock, slow: f.slow }, col);
        break;
      case 'aoe': {
        const [x, y] = this.targetPoint();
        const delay = (f.delay ?? 0.4) * 1000;
        sc.fx.telegraph(x, y, f.r ?? 50, delay, EL_COLOR[el] ?? col);
        if (f.sprite === 'meteor') this.fallingMeteor(x, y, delay);
        sc.time.delayedCall(delay, () => {
          if (f.sprite === 'pillar') sc.fx.pillar(x, y, EL_COLOR[el] ?? col);
          if (el === 'lightning') sc.fx.lightning(x + (Math.random() - 0.5) * 10, y - 120, x, y, 0xffe45c);
          this.explosion(x, y, f.r ?? 50, dmg, el, { spell, stun: f.stun, freeze: f.freeze });
        });
        break;
      }
      case 'rain': {
        const [tx, ty] = f.line ? [p.x, p.y] : this.targetPoint();
        const a = this.aimAngle();
        const n = f.n ?? 8;
        const area = 60;
        for (let i = 0; i < n; i++) {
          let x: number, y: number;
          if (f.line) {
            x = tx + Math.cos(a) * (20 + i * 22);
            y = ty + Math.sin(a) * (20 + i * 22);
          } else {
            const rr = Math.sqrt(Math.random()) * area,
              aa = Math.random() * Math.PI * 2;
            x = tx + Math.cos(aa) * rr;
            y = ty + Math.sin(aa) * rr;
          }
          const delay = (f.delay ?? 0.1) * 1000 * i + 250;
          sc.time.delayedCall(delay - 250, () => sc.fx.telegraph(x, y, f.r ?? 30, 250, EL_COLOR[el] ?? col));
          sc.time.delayedCall(delay, () => this.rainStrike(x, y, f, dmg, el, col));
        }
        break;
      }
      case 'melee': {
        const a = this.aimAngle();
        const hits = f.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          sc.time.delayedCall(h * (hits > 4 ? 70 : 140), () => {
            if (p.dead) return;
            p.swinging = 0.18;
            p.swingHand = p.d.dual ? 1 - p.swingHand : 0;
            p.aim = a;
            sfx('swing');
            const arc = ((f.arc ?? 120) * Math.PI) / 180;
            const range = f.range ?? 40;
            sc.fx.slash(p.x + Math.cos(a) * 8, p.y - 5 + Math.sin(a) * 8, a, range * 0.8, EL_COLOR[el] ?? 0xffffff, Math.min(360, f.arc ?? 120));
            if ((f.arc ?? 0) >= 300) sc.fx.ring(p.x, p.y - 4, range, EL_COLOR[el] ?? 0xffffff, 250);
            for (const e of sc.enemiesNear(p.x, p.y - 4, range + 8)) {
              const ex = e.x - p.x,
                ey = e.y - 4 * e.baseScale - (p.y - 4);
              const ang = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ey, ex) - a));
              if (ang > arc / 2 + 0.25 && Math.hypot(ex, ey) > 10) continue;
              sc.combat.damageEnemy(e, dmg, { el, spell, lifesteal: f.lifesteal, execute: f.execute, kx: Math.cos(a) * (f.knock ?? 30), ky: Math.sin(a) * (f.knock ?? 30) });
              if (f.stun) e.st.stunT = Math.max(e.st.stunT, f.stun);
              if (f.vuln) {
                e.st.vulnT = 6;
                e.st.vuln = f.vuln;
              }
              if (f.dot) {
                e.st.bleedT = 4;
                e.st.bleedDps = Math.max(e.st.bleedDps, dmg * f.dot * 0.25);
              }
            }
          });
        }
        break;
      }
      case 'dash':
        this.dash(f, dmg, el);
        break;
      case 'blink':
        this.blink(f.range ?? 120, sp.cls === 'assassin');
        break;
      case 'buff': {
        const dur = (f.dur ?? 8) * (1 + 0.05 * (rank - 1));
        p.addBuff(sp.id, sp.name, f.mods ?? {}, dur, col);
        sc.fx.ring(p.x, p.y - 6, 26, col, 400);
        sc.fx.burst(p.x, p.y - 6, col, 16);
        break;
      }
      case 'heal': {
        const amt = p.d.maxHp * (f.heal ?? 0.3) * (1 + 0.08 * (rank - 1));
        p.heal(amt);
        sfx('heal');
        sc.fx.burst(p.x, p.y - 6, 0x52ff8f, 18);
        sc.fx.ring(p.x, p.y - 6, 24, 0x52ff8f, 400);
        break;
      }
      case 'mana': {
        p.mp = Math.min(p.d.maxMp, p.mp + p.d.maxMp * (f.heal ?? 0.4));
        sc.fx.burst(p.x, p.y - 6, 0x4aa3ff, 18);
        break;
      }
      case 'shield': {
        p.addShield(p.d.maxHp * (f.heal ?? 0.3) * (1 + 0.08 * (rank - 1)), f.dur ?? 6);
        sc.fx.ring(p.x, p.y - 6, 22, 0x7fb2ff, 400);
        break;
      }
      case 'summon': {
        const L = p.save.level;
        let hpBase = 40 + 15 * L;
        if (p.save.cls === 'necro') hpBase *= 1.3;
        if (p.save.cls === 'druid') hpBase *= 1.2;
        const dmgBase = (sp.scale === 'weapon' ? p.weaponHit() : p.spellBase() * 0.55) * (1 + 0.15 * (rank - 1));
        const kind = f.kind ?? 'skeleton';
        for (let i = 0; i < (f.n ?? 1); i++) {
          const pos = sc.map.randomFloorNear(p.x, p.y, 20) ?? [p.x, p.y];
          sc.addAlly(kind, pos[0], pos[1], hpBase, dmgBase, f.dur ?? 20);
        }
        break;
      }
      case 'totem': {
        const L = p.save.level;
        const life = (f.dur ?? 10) * (p.save.cls === 'shaman' ? 1.2 : 1);
        const kind = 'totem_' + (f.kind ?? 'heal');
        // only one totem per kind
        for (const a of sc.allies) if (a.kind === kind) a.die();
        const t = sc.addAlly(kind, p.x, p.y + 2, 100 + 10 * L, p.spellBase() * (f.p ?? 1) * (1 + 0.15 * (rank - 1)), life);
        void t;
        break;
      }
      case 'field': {
        const dps = dmg;
        const mk = (x: number, y: number, follow: boolean) => this.addField(x, y, f.r ?? 60, dps, el, f.dur ?? 5, follow, f);
        if (f.follow) mk(p.x, p.y, true);
        else if (f.line) {
          const a = this.aimAngle();
          for (let i = 0; i < 5; i++) mk(p.x + Math.cos(a) * (22 + i * 24), p.y + Math.sin(a) * (22 + i * 24), false);
        } else {
          const [x, y] = this.targetPoint();
          mk(x, y, false);
        }
        break;
      }
      case 'chain': {
        const first = sc.nearestEnemy(p.x, p.y, 170, true);
        if (first) this.chain(p.x, p.y - 8, f.n ?? 3, dmg, el, new Set(), first);
        else sc.fx.lightning(p.x, p.y - 8, p.x + p.facing * 50, p.y - 10, EL_COLOR[el]);
        break;
      }
      case 'stealth':
        p.stealthT = f.dur ?? 4;
        for (const e of sc.enemies) if (!e.boss) e.aggro = false;
        sc.fx.burst(p.x, p.y - 6, 0x888888, 20, 'puff');
        break;
      case 'trap': {
        const n = f.n ?? 1;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const x = p.x + (n > 1 ? Math.cos(a) * 18 : 0),
            y = p.y + (n > 1 ? Math.sin(a) * 18 : 0);
          const s = sc.add.image(x, y, 'disc').setTint(EL_COLOR[el] ?? 0xcccccc).setScale(0.06).setAlpha(0.7).setDepth(D.floorDeco + 1);
          this.traps.push({ x, y, r: f.r ?? 36, dmg, el, freeze: f.freeze, armT: 0.4, life: 25, sprite: s });
        }
        break;
      }
      case 'whirl': {
        const s = sc.add.image(p.x, p.y - 5, 'slash').setTint(EL_COLOR[el] ?? 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.bright).setScale((f.r ?? 40) / 18);
        this.whirls.push({ t: f.dur ?? 2, r: f.r ?? 40, dmg, tick: 0, sprite: s });
        break;
      }
      case 'orbit': {
        const n = f.n ?? 3;
        const sprites: Phaser.GameObjects.Image[] = [];
        const key = f.sprite === 'hammer' ? 'pr_hammer' : f.sprite === 'bone' ? 'pr_bone' : 'pr_knife';
        for (let i = 0; i < n; i++) sprites.push(sc.add.image(p.x, p.y, key).setDepth(D.bright).setScale(1.2));
        this.orbits.push({ t: f.dur ?? 6, r: f.r ?? 36, dmg, angle: 0, sprites, hitT: new Map() });
        break;
      }
      case 'dance':
        this.dances.push({ left: f.hits ?? 6, dmg, timer: 0, hit: new Set() });
        p.invulnT = Math.max(p.invulnT, (f.hits ?? 6) * 0.13 + 0.2);
        break;
    }
  }

  // -------------------------------------------------------------- primitives
  nova(x: number, y: number, r: number, dmg: number, el: Element, o: { stun?: number; freeze?: number; knock?: number; slow?: number }, col?: number) {
    const sc = this.scene;
    const c = col ?? EL_COLOR[el] ?? 0xffffff;
    sc.fx.ring(x, y - 4, r, c, 380);
    sc.fx.disc(x, y - 4, r, c, 350);
    sc.fx.burst(x, y - 4, c, Math.min(40, 10 + r / 4));
    if (r >= 80) sc.fx.shake(0.006, 200);
    if (el === 'ice' || o.freeze) sc.fx.burst(x, y - 4, 0xffffff, 20, 'pix');
    for (const e of sc.enemiesNear(x, y, r)) {
      const dx = e.x - x,
        dy = e.y - y;
      const l = Math.hypot(dx, dy) || 1;
      sc.combat.damageEnemy(e, dmg, { el, spell: true, kx: (dx / l) * (o.knock ?? 20), ky: (dy / l) * (o.knock ?? 20) });
      if (o.stun) e.st.stunT = Math.max(e.st.stunT, o.stun);
      if (o.freeze) {
        e.st.stunT = Math.max(e.st.stunT, o.freeze);
        e.sprite.setTint(0x9fe6ff);
        e.hitFlash = o.freeze;
      }
      if (o.slow) {
        e.st.slowT = 3;
        e.st.slowMult = 1 - o.slow;
      }
      if (o.knock && !e.boss) {
        e.knockX += (dx / l) * o.knock * 2;
        e.knockY += (dy / l) * o.knock * 2;
      }
    }
  }

  explosion(x: number, y: number, r: number, dmg: number, el: Element, o: HitOpts & { stun?: number; freeze?: number }) {
    const sc = this.scene;
    const c = EL_COLOR[el] ?? 0xffffff;
    sc.fx.disc(x, y, r, c, 320);
    sc.fx.burst(x, y, c, Math.min(30, 8 + r / 3));
    sc.fx.burst(x, y, 0x777777, 4, 'puff');
    if (r >= 50) {
      sfx('explosion');
      sc.fx.shake(0.004, 150);
    }
    for (const e of sc.enemiesNear(x, y, r)) {
      sc.combat.damageEnemy(e, dmg, { ...o, el, spell: o.spell ?? true, kx: e.x - x, ky: e.y - y });
      if (o.stun) e.st.stunT = Math.max(e.st.stunT, o.stun);
      if (o.freeze) {
        e.st.stunT = Math.max(e.st.stunT, o.freeze);
        e.sprite.setTint(0x9fe6ff);
        e.hitFlash = o.freeze;
      }
      if (el === 'fire') {
        e.st.burnT = 3;
        e.st.burnDps = Math.max(e.st.burnDps, dmg * 0.15);
      }
    }
  }

  fallingMeteor(x: number, y: number, delay: number) {
    const sc = this.scene;
    const m = sc.add.image(x - 60, y - 160, 'meteor').setDepth(D.bright).setScale(1.6);
    sc.tweens.add({ targets: m, x, y, duration: delay, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
  }

  rainStrike(x: number, y: number, f: Fx, dmg: number, el: Element, col: number) {
    const sc = this.scene;
    const c = EL_COLOR[el] ?? col;
    if (el === 'lightning') sc.fx.lightning(x + (Math.random() - 0.5) * 12, y - 110, x, y, 0xffe45c);
    else if (f.sprite === 'pillar') sc.fx.pillar(x, y, c);
    else if (f.sprite === 'meteor') {
      const m = sc.add.image(x - 20, y - 70, 'meteor').setDepth(D.bright);
      sc.tweens.add({ targets: m, x, y, duration: 120, onComplete: () => m.destroy() });
    } else {
      const key = f.sprite === 'bone' ? 'pr_bone' : f.sprite === 'thorn' ? 'pr_thorn' : el === 'shadow' ? 'pr_knife' : el === 'holy' ? 'pr_holy' : el === 'ice' ? 'pr_ice' : 'pr_arrow';
      const a = sc.add.image(x, y - 60, key).setDepth(D.bright).setRotation(Math.PI / 2);
      sc.tweens.add({ targets: a, y, duration: 110, onComplete: () => a.destroy() });
    }
    sc.time.delayedCall(110, () => this.explosion(x, y, f.r ?? 30, dmg, el, { spell: true, silent: false }));
  }

  chain(x: number, y: number, jumps: number, dmg: number, el: Element, hit: Set<number>, first?: Enemy) {
    const sc = this.scene;
    let cx = x,
      cy = y;
    let cur: Enemy | null = first ?? sc.nearestEnemy(x, y, 120, true, hit);
    let left = jumps;
    let step = 0;
    const next = () => {
      if (!cur || left <= 0) return;
      const target: Enemy = cur;
      sc.fx.lightning(cx, cy, target.x, target.y - 6 * target.baseScale, EL_COLOR[el]);
      sc.combat.damageEnemy(target, dmg * Math.pow(0.9, step), { el, spell: true });
      hit.add(target.id);
      cx = target.x;
      cy = target.y - 6;
      left--;
      step++;
      cur = sc.nearestEnemy(cx, cy, 110, false, hit);
      if (cur) sc.time.delayedCall(70, next);
    };
    next();
  }

  dash(f: Fx, dmg: number, el: Element) {
    const sc = this.scene;
    const p = this.p;
    let a = this.aimAngle();
    const t = sc.nearestEnemy(p.x, p.y, (f.dist ?? 90) + 30, true);
    let dist = f.dist ?? 90;
    if (f.back) a += Math.PI;
    else if (t) dist = Math.min(dist, Math.hypot(t.x - p.x, t.y - p.y));
    const steps = 10;
    const hit = new Set<number>();
    p.invulnT = Math.max(p.invulnT, 0.25);
    for (let i = 1; i <= steps; i++) {
      sc.time.delayedCall(i * 18, () => {
        if (p.dead) return;
        const [nx, ny] = sc.map.move(p.x, p.y, (Math.cos(a) * dist) / steps, (Math.sin(a) * dist) / steps, p.r);
        p.x = nx;
        p.y = ny;
        if (i % 2 === 0) {
          const ghost = sc.add.image(p.sprite.x, p.sprite.y, p.sprite.texture.key, 0).setOrigin(0.5, 1).setAlpha(0.4).setTint(EL_COLOR[el] ?? 0xffffff).setDepth(p.sprite.depth - 1).setFlipX(p.facing < 0);
          sc.tweens.add({ targets: ghost, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
        }
        if ((f.p ?? 0) > 0) {
          for (const e of sc.enemiesNear(p.x, p.y, 16)) {
            if (hit.has(e.id)) continue;
            hit.add(e.id);
            sc.combat.damageEnemy(e, dmg, { el, spell: true, kx: Math.cos(a) * 50, ky: Math.sin(a) * 50 });
            if (f.stun) e.st.stunT = Math.max(e.st.stunT, f.stun);
          }
        }
      });
    }
  }

  blink(range: number, toTarget: boolean) {
    const sc = this.scene;
    const p = this.p;
    sc.fx.burst(p.x, p.y - 6, 0xb07dff, 14, 'puff');
    const t = toTarget ? sc.nearestEnemy(p.x, p.y, range, false) : null;
    let tx: number, ty: number;
    if (t) {
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      tx = t.x + Math.cos(a) * 10;
      ty = t.y + Math.sin(a) * 10;
      if (sc.map.collides(tx, ty, p.r)) {
        tx = t.x - Math.cos(a) * 10;
        ty = t.y - Math.sin(a) * 10;
      }
      p.facing = t.x > tx ? 1 : -1;
    } else {
      const mv = sc.moveVec;
      const a = Math.hypot(mv[0], mv[1]) > 0.2 ? Math.atan2(mv[1], mv[0]) : p.facing > 0 ? 0 : Math.PI;
      tx = p.x;
      ty = p.y;
      for (let d = 0; d < range; d += 4) {
        const nx = p.x + Math.cos(a) * d,
          ny = p.y + Math.sin(a) * d;
        if (sc.map.collides(nx, ny, p.r)) {
          // allow passing through thin walls? no – stop
          break;
        }
        tx = nx;
        ty = ny;
      }
    }
    if (!sc.map.collides(tx, ty, p.r)) {
      p.x = tx;
      p.y = ty;
    }
    p.invulnT = Math.max(p.invulnT, 0.3);
    sc.fx.burst(p.x, p.y - 6, 0xb07dff, 14, 'puff');
  }

  addField(x: number, y: number, r: number, dps: number, el: Element, dur: number, follow: boolean, f: Fx) {
    const sc = this.scene;
    const c = EL_COLOR[el] ?? 0xffffff;
    const gfx = sc.add.image(x, y, 'disc').setTint(c).setAlpha(0.35).setScale((r * 2) / 256).setDepth(D.floorDeco + 1).setBlendMode(Phaser.BlendModes.ADD);
    let spin: Phaser.GameObjects.Image | undefined;
    if (f.pull || follow) spin = sc.add.image(x, y, 'ring').setTint(c).setAlpha(0.5).setScale((r * 2) / 256).setDepth(D.floorDeco + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.fields.push({ x, y, r, dps, el, t: dur, follow, slow: f.slow, pull: f.pull, vuln: f.vuln, lifesteal: f.lifesteal, tick: 0, gfx, spin });
  }

  totemPulse(a: Ally) {
    const sc = this.scene;
    const p = this.p;
    const kind = a.def.totem;
    if (kind === 'heal') {
      if (Math.hypot(p.x - a.x, p.y - a.y) < a.def.range) {
        p.heal(p.d.maxHp * 0.035);
        sc.fx.burst(p.x, p.y - 6, 0x52ff8f, 4);
      }
      for (const al of sc.allies) if (!al.def.totem && Math.hypot(al.x - a.x, al.y - a.y) < a.def.range) al.hp = Math.min(al.maxHp, al.hp + al.maxHp * 0.05);
      sc.fx.ring(a.x, a.y - 8, a.def.range, 0x52ff8f, 600, 0.35);
    } else if (kind === 'storm') {
      const t = sc.nearestEnemy(a.x, a.y, a.def.range, false);
      if (t) {
        sc.fx.lightning(a.x, a.y - 20, t.x, t.y - 6, 0xffe45c);
        sc.combat.damageEnemy(t, a.dmg, { el: 'lightning', spell: true });
      }
    } else if (kind === 'fire') {
      const t = sc.nearestEnemy(a.x, a.y, a.def.range, true);
      if (t) sc.spawnSpellProjectile({ x: a.x, y: a.y - 18, angle: Math.atan2(t.y - 6 - (a.y - 18), t.x - a.x), speed: 240, sprite: 'fire', dmg: a.dmg, el: 'fire', owner: 'player', explode: 26, spell: true });
    } else if (kind === 'ice') {
      sc.fx.ring(a.x, a.y - 6, a.def.range, 0x7fd8ff, 500, 0.5);
      for (const e of sc.enemiesNear(a.x, a.y, a.def.range)) {
        sc.combat.damageEnemy(e, a.dmg, { el: 'ice', spell: true, silent: true });
        e.st.slowT = 1.5;
        e.st.slowMult = 0.5;
      }
    }
  }

  // -------------------------------------------------------------- per-frame
  update(dt: number) {
    const sc = this.scene;
    const p = this.p;
    // fields
    for (const f of this.fields) {
      f.t -= dt;
      if (f.follow) {
        f.x = p.x;
        f.y = p.y;
      }
      f.gfx.setPosition(f.x, f.y);
      f.gfx.setAlpha(0.25 + Math.sin(sc.time.now / 120) * 0.06);
      if (f.spin) {
        f.spin.setPosition(f.x, f.y);
        f.spin.rotation += dt * (f.pull ? -4 : 3);
      }
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.4;
        if (Math.random() < 0.8) sc.fx.burst(f.x + (Math.random() - 0.5) * f.r, f.y + (Math.random() - 0.5) * f.r * 0.7, EL_COLOR[f.el] ?? 0xffffff, 2);
        for (const e of sc.enemiesNear(f.x, f.y, f.r)) {
          sc.combat.damageEnemy(e, f.dps * 0.4, { el: f.el, spell: true, silent: false, noCrit: true, lifesteal: f.lifesteal });
          if (f.slow) {
            e.st.slowT = 0.6;
            e.st.slowMult = 1 - f.slow;
          }
          if (f.vuln) {
            e.st.vulnT = 0.6;
            e.st.vuln = f.vuln;
          }
        }
      }
      if (f.pull) {
        for (const e of sc.enemiesNear(f.x, f.y, f.r)) {
          if (e.boss) continue;
          const dx = f.x - e.x,
            dy = f.y - e.y;
          const l = Math.hypot(dx, dy);
          if (l > 6) {
            const [nx, ny] = sc.map.move(e.x, e.y, (dx / l) * 70 * dt, (dy / l) * 70 * dt, e.r);
            e.x = nx;
            e.y = ny;
          }
        }
      }
      if (f.t <= 0) {
        f.gfx.destroy();
        f.spin?.destroy();
      }
    }
    this.fields = this.fields.filter((f) => f.t > 0);

    // traps
    for (const t of this.traps) {
      t.life -= dt;
      t.armT -= dt;
      t.sprite.setAlpha(t.armT > 0 ? 0.3 : 0.55 + Math.sin(sc.time.now / 200) * 0.15);
      if (t.armT <= 0) {
        const near = sc.enemiesNear(t.x, t.y, 12);
        if (near.length) {
          this.explosion(t.x, t.y, t.r, t.dmg, t.el, { spell: true, freeze: t.freeze });
          t.life = 0;
        }
      }
      if (t.life <= 0) t.sprite.destroy();
    }
    this.traps = this.traps.filter((t) => t.life > 0);

    // whirls
    for (const w of this.whirls) {
      w.t -= dt;
      w.sprite.setPosition(p.x, p.y - 5);
      w.sprite.rotation += dt * 18;
      w.sprite.setAlpha(0.7 + Math.sin(sc.time.now / 50) * 0.2);
      w.tick -= dt;
      if (w.tick <= 0) {
        w.tick = 0.25;
        sfx('swing');
        for (const e of sc.enemiesNear(p.x, p.y - 4, w.r)) sc.combat.damageEnemy(e, w.dmg, { el: 'phys', spell: true, kx: e.x - p.x, ky: e.y - p.y });
      }
      if (w.t <= 0) w.sprite.destroy();
    }
    this.whirls = this.whirls.filter((w) => w.t > 0);

    // orbits
    for (const o of this.orbits) {
      o.t -= dt;
      o.angle += dt * 4.5;
      o.sprites.forEach((s, i) => {
        const a = o.angle + (i / o.sprites.length) * Math.PI * 2;
        s.setPosition(p.x + Math.cos(a) * o.r, p.y - 6 + Math.sin(a) * o.r * 0.75);
        s.setRotation(a + Math.PI / 2);
        for (const e of sc.enemiesNear(s.x, s.y + 6, 10)) {
          const last = o.hitT.get(e.id) ?? 0;
          if (sc.time.now - last > 400) {
            o.hitT.set(e.id, sc.time.now);
            sc.combat.damageEnemy(e, o.dmg, { el: 'phys', spell: true });
          }
        }
      });
      if (o.t <= 0) o.sprites.forEach((s) => s.destroy());
    }
    this.orbits = this.orbits.filter((o) => o.t > 0);

    // dances
    for (const d of this.dances) {
      d.timer -= dt;
      if (d.timer <= 0 && d.left > 0) {
        d.timer = 0.12;
        d.left--;
        let t = sc.nearestEnemy(p.x, p.y, 150, false, d.hit);
        if (!t) {
          d.hit.clear();
          t = sc.nearestEnemy(p.x, p.y, 150, false);
        }
        if (!t) {
          d.left = 0;
          continue;
        }
        d.hit.add(t.id);
        const a = Math.random() * Math.PI * 2;
        const tx = t.x + Math.cos(a) * 10,
          ty = t.y + Math.sin(a) * 10;
        sc.fx.burst(p.x, p.y - 6, 0xb07dff, 6, 'puff');
        if (!sc.map.collides(tx, ty, p.r)) {
          p.x = tx;
          p.y = ty;
        }
        p.facing = t.x > p.x ? 1 : -1;
        p.aim = Math.atan2(t.y - p.y, t.x - p.x);
        p.swinging = 0.12;
        sc.fx.slash(t.x, t.y - 6, p.aim, 14, 0xd0a8ff, 140);
        sfx('swing');
        sc.combat.damageEnemy(t, d.dmg, { el: 'phys', spell: true });
      }
    }
    this.dances = this.dances.filter((d) => d.left > 0);
  }

  clear() {
    this.fields.forEach((f) => {
      f.gfx.destroy();
      f.spin?.destroy();
    });
    this.traps.forEach((t) => t.sprite.destroy());
    this.whirls.forEach((w) => w.sprite.destroy());
    this.orbits.forEach((o) => o.sprites.forEach((s) => s.destroy()));
    this.fields = [];
    this.traps = [];
    this.whirls = [];
    this.orbits = [];
    this.dances = [];
  }
}

export { ALLY_DEFS };
