// What the monsters of the families can do beyond biting and shooting: raise the dead, heal and bless
// their pack, curse the hero, open portals, split, eat corpses, steal buffs, copy spells, adapt …
// Every power keeps its timers in Enemy.pw; Enemy.ai asks act() first each frame (true = the power holds
// the monster this frame: it is casting, roaring, eating, flying as bats …).
import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Enemy, Projectile } from './entities';
import { D, EL_COLOR } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { Element } from '../data/types';
import { SpellDef, BuffMods } from '../data/spells';
import { FAMILIES, familyFodder } from '../data/families';
import { ENEMY_BY_ID } from '../data/enemies';
import { EL_NAME } from '../data/bestiary';
import type { HitOpts } from './combat';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';

/** a monster's remains: a necromancer raises them, a hungry ghoul eats them */
export interface Corpse {
  x: number;
  y: number;
  id: string;
  t: number;
  used: boolean;
  img: Phaser.GameObjects.Image;
}

/** what a mirror demon copied from the hero */
interface SpellCopy {
  name: string;
  kind: 'proj' | 'area' | 'self';
  el: Element;
  sprite: string;
}

export interface PowerState {
  t?: number;
  t2?: number;
  cast?: number;
  mode?: number;
  life?: number;
  spawned?: number;
  targets?: Corpse[];
  eating?: { c: Corpse; t: number };
  bat?: { t: number; imgs: Phaser.GameObjects.Image[] };
  copy?: SpellCopy;
  stolen?: { id: string; name: string; mods: BuffMods; t: number; color: number };
  adapt?: Partial<Record<Element, number>>;
  told?: number;
  fuse?: number;
  lx?: number;
  ly?: number;
  enraged?: boolean;
  hit?: number;
}

/** the hero's curses: name, what they do, colour and icon */
export const CURSES: Record<string, { name: string; mods: BuffMods; dur: number; color: number; glyph: string }> = {
  vuln: { name: 'Zranitelnost', mods: { dmgTaken: 20, armorPct: -30 }, dur: 5, color: 0xff5a3a, glyph: 'skull' },
  rot: { name: 'Kletba rozkladu', mods: { healCut: 50 }, dur: 6, color: 0x7be05a, glyph: 'drop' },
  fatigue: { name: 'Kletba únavy', mods: { atkSpdPct: -30 }, dur: 6, color: 0xc77dff, glyph: 'clock' },
  timeSlow: { name: 'Zpomalený čas', mods: { move: -40, atkSpdPct: -25, cdrRate: -0.4 }, dur: 4, color: 0x7fb2ff, glyph: 'clock' },
  confuse: { name: 'Zmatení', mods: { confuse: true }, dur: 3, color: 0xff6ac8, glyph: 'eye' },
};

const MUTATIONS: { id: string; tint: number }[] = [
  { id: 'obří', tint: 0xd8b0a0 },
  { id: 'rychlý', tint: 0xfff0a0 },
  { id: 'pancéřový', tint: 0xa8b8c8 },
  { id: 'kyselý', tint: 0xb8ff8a },
  { id: 'výbušný', tint: 0xffa070 },
  { id: 'regenerující', tint: 0x8affc0 },
  { id: 'jedovatý', tint: 0x9aff6a },
  { id: 'skákavý', tint: 0xc8a8ff },
];

const SPELL_PROJ: Record<string, string> = { fire: 'fire', ice: 'ice_ball', lightning: 'bolt', poison: 'poison', holy: 'holy', shadow: 'shadow', phys: 'magic' };

export class Powers {
  sc: GameScene;
  corpses: Corpse[] = [];
  /** blood pools of the vampire lords: monsters standing in them heal */
  pools: { x: number; y: number; r: number; t: number }[] = [];
  private guards: Enemy[] = [];
  private guardT = 0;

  constructor(sc: GameScene) {
    this.sc = sc;
  }

  reset() {
    for (const c of this.corpses) c.img.destroy();
    this.corpses = [];
    this.pools = [];
    this.guards = [];
  }

  /** a monster enters the world: powers that change it from the start */
  init(e: Enemy) {
    const ab = e.def.ability;
    if (ab === 'manaShield') {
      e.mshieldMax = e.maxHp * 0.8;
      e.mshield = e.mshieldMax;
    }
    if (ab === 'mutate') {
      const m = MUTATIONS[Math.floor(Math.random() * MUTATIONS.length)];
      e.mutation = m.id;
      e.name = `${e.def.name} (${m.id})`;
      e.baseTint = m.tint;
      e.sprite.setTint(m.tint);
      if (m.id === 'obří') {
        e.setScale(e.baseScale * 1.35);
        e.maxHp = e.hp = Math.round(e.maxHp * 2);
        e.dmg *= 1.3;
        e.speed *= 0.8;
      } else if (m.id === 'rychlý') e.speed *= 1.6;
      else if (m.id === 'pancéřový') e.armor = e.armor * 2 + 20;
    }
  }

  update(dt: number) {
    for (const c of this.corpses) {
      c.t -= dt;
      if (c.t < 3) c.img.setAlpha(Math.max(0, c.t / 3) * 0.75);
    }
    if (this.corpses.some((c) => c.t <= 0 || c.used)) {
      for (const c of this.corpses) if (c.t <= 0 || c.used) c.img.destroy();
      this.corpses = this.corpses.filter((c) => c.t > 0 && !c.used);
    }
    // monsters standing in blood heal
    if (this.pools.length) {
      for (const pl of this.pools) {
        pl.t -= dt;
        for (const e of this.sc.enemiesNear(pl.x, pl.y, pl.r)) if (!e.boss && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
      }
      this.pools = this.pools.filter((p) => p.t > 0);
    }
    this.guardT -= dt;
    if (this.guardT <= 0) {
      this.guardT = 0.5;
      this.guards = this.sc.enemies.filter((e) => !e.dead && e.def.ability === 'guard');
    }
  }

  // ---------------------------------------------------------------- the hero's curses
  curse(id: string) {
    const c = CURSES[id];
    const p = this.sc.player;
    if (!c || p.dead) return;
    p.addCurse(id, c.name, c.mods, c.dur, c.color, c.glyph);
    const col = '#' + c.color.toString(16).padStart(6, '0');
    this.sc.fx.number(p.x, p.y - 24, c.name, col, true);
    this.sc.fx.ring(p.x, p.y - 6, 22, c.color, 400);
  }

  /** a monster's cursed shot (slow, can be dodged) */
  private curseShot(e: Enemy, id: string, sprite = 'curse', speed = 115) {
    const p = this.sc.player;
    const a = Math.atan2(p.y - 6 - (e.y - 7), p.x - e.x);
    const pr = this.sc.spawnEnemyProjectile(e.x, e.y - 7, a, sprite, e.dmg * e.might * 0.4, e.def.el ?? 'shadow', speed, e.name, e);
    pr.o.effect = 'curse:' + id;
    pr.o.size = 1.2;
    e.lunge(Math.cos(a), Math.sin(a));
  }

  /** a monster's shot reached the hero (or a wall) */
  projectileHit(pr: Projectile, onHero: boolean) {
    const fx = pr.o.effect;
    if (!fx) return;
    if (fx.startsWith('curse:') && onHero) this.curse(fx.slice(6));
    else if (fx === 'web') {
      this.sc.addHazard(pr.x, pr.y + 4, 18, 0, 'poison', 4, 0xe8e8e8, pr.o.srcName, true);
      if (onHero) this.sc.player.chill(1.4);
    } else if (fx === 'drain' && onHero) {
      const f = pr.o.srcFoe;
      if (f && !f.dead) {
        f.hp = Math.min(f.maxHp, f.hp + pr.o.dmg * 0.6);
        this.sc.fx.beam(this.sc.player.x, this.sc.player.y - 6, f.x, f.y - 8, 0xc0101a, 2, 300);
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  /** the monster's power acts; true = it holds the monster this frame */
  act(e: Enemy, dt: number, dist: number, sees: boolean): boolean {
    const P = e.pw;
    const ab = e.def.ability;
    if (P.t !== undefined) P.t -= dt;
    if (P.t2 !== undefined) P.t2 -= dt;
    if (e.blessT > 0) e.blessT -= dt;
    if (e.hasteT > 0) e.hasteT -= dt;
    if (P.stolen) this.stolenTick(e, dt);
    if (e.mutation) this.mutationTick(e, dt);
    if (e.mshieldMax > 0) this.shieldTick(e, dt);
    // an illusion does not last
    if (e.illusion) {
      P.life = (P.life ?? 16) - dt;
      if (P.life <= 0) {
        this.vanish(e, 0xff8ae0);
        return true;
      }
      return false;
    }
    if (!ab) return false;
    const sc = this.sc;
    const p = sc.player;
    // a cast in progress (raising the dead, a roar, a slam)
    if (P.cast !== undefined && P.cast > 0) {
      P.cast -= dt;
      if (P.cast <= 0) this.finishCast(e);
      return true;
    }
    switch (ab) {
      case 'revive':
        if ((P.t ??= 3) <= 0) return this.startRevive(e);
        return false;
      case 'heal':
      case 'spores':
        if ((P.t ??= 2) <= 0) this.heal(e, ab === 'spores');
        return false;
      case 'bless':
        if ((P.t ??= 2) <= 0) this.bless(e, dist, sees);
        return false;
      case 'hex':
        if ((P.t ??= 2.5) <= 0 && sees && dist < 170) {
          P.t = 3.8;
          P.mode = (P.mode ?? 0) ^ 1;
          this.curseShot(e, P.mode ? 'rot' : 'fatigue');
          sfx('magic');
        }
        return false;
      case 'sacrifice':
        if ((P.t ??= 3) <= 0 && e.hp < e.maxHp * 0.8) this.sacrifice(e);
        return false;
      case 'portal':
        if ((P.t ??= 3) <= 0 && sees && dist < 220) this.openPortal(e);
        return false;
      case 'time':
        if ((P.t ??= 3) <= 0) this.timeMagic(e, dist, sees);
        return false;
      case 'illusion':
        if ((P.t ??= 0.5) <= 0 && !e.illusion) this.illusions(e);
        return false;
      case 'mind':
        if ((P.t ??= 3) <= 0 && sees && dist < 160) {
          P.t = 6.5;
          this.curseShot(e, 'confuse', 'mind', 105);
          sfx('magic');
        }
        return false;
      case 'eggs':
        if ((P.t ??= 3) <= 0) this.layEggs(e);
        return false;
      case 'plague':
        if ((P.t ??= 0.5) <= 0) {
          P.t = 0.5;
          sc.fx.burst(e.x + (Math.random() - 0.5) * 10, e.y - 6, 0x9dff7a, 2, 'puff');
          if (Math.hypot(p.x - e.x, p.y - e.y) < 30) {
            p.applyPoison(e.dmg * 0.22, 2);
            sc.fx.burst(p.x, p.y - 6, 0x9dff7a, 2, 'puff');
          }
        }
        return false;
      case 'eat':
        return this.hungry(e, dt, dist);
      case 'roar':
        if ((P.t ??= 1) <= 0 && sees && dist < 180) {
          P.t = 12;
          P.cast = 0.6;
          e.sprite.setTint(0xff6a5a);
          e.hitFlash = 0.6;
          return true;
        }
        return false;
      case 'vampire':
        return this.vampire(e, dt, dist);
      case 'bloodpool':
        if ((P.t ??= 3) <= 0 && sees && dist < 160) this.bloodPools(e);
        return false;
      case 'slam':
        if ((P.t ??= 3) <= 0 && dist < 60) {
          P.t = 6;
          P.cast = 0.8;
          sc.fx.telegraph(e.x, e.y, 42, 800);
          return true;
        }
        return false;
      case 'storm':
        return this.storm(e, dist);
      case 'lava':
        if ((P.t ??= 0.7) <= 0) {
          P.t = 0.7;
          if (Math.hypot(e.x - (P.lx ?? 0), e.y - (P.ly ?? 0)) > 3) sc.addHazard(e.x, e.y + 1, 10, e.dmg * 0.4, 'fire', 3.5, 0xff5a1a, e.name, false, e);
          P.lx = e.x;
          P.ly = e.y;
        }
        return false;
      case 'berserk':
        if (!P.enraged && e.hp < e.maxHp * 0.5) {
          P.enraged = true;
          e.speed *= 1.3;
          e.dmg *= 1.3;
          e.baseTint = 0xff9a8a;
          e.sprite.setTint(0xff9a8a);
          sc.fx.ring(e.x, e.y - 6, 30, 0xff3a1a, 400);
          sc.fx.number(e.x, e.y - 22, 'zuří!', '#ff6a4a', true);
          sfx('shout');
        }
        return false;
      case 'eatBuff':
        if ((P.t ??= 2) <= 0 && sees && dist < 140) this.eatBuff(e);
        return false;
      case 'mirror':
        if ((P.t ??= 2) <= 0 && P.copy && sees && dist < 170) return this.mirrorCast(e);
        return false;
      case 'hatch':
        return this.hatch(e, dt);
      case 'portalSpawn':
        return this.portalTick(e, dt);
    }
    return false;
  }

  private finishCast(e: Enemy) {
    const sc = this.sc;
    const p = sc.player;
    switch (e.def.ability) {
      case 'revive':
        this.raise(e);
        break;
      case 'roar': {
        sc.fx.ring(e.x, e.y - 6, 70, 0xff3a1a, 500);
        sc.fx.number(e.x, e.y - 24, 'ŘEV!', '#ff6a4a', true);
        sc.fx.shake(0.004, 200);
        sfx('shout');
        const mine = sc.enemies.filter((o) => !o.dead && o.summoner === e).length;
        for (let i = 0; i < Math.min(2, 6 - mine); i++) this.summonNear(e, e.def.summon ?? 'ghoul', 30, 0.6);
        for (const o of sc.enemiesNear(e.x, e.y, 140)) if (!o.boss && o.def.id.endsWith('houl')) o.hasteT = 5;
        break;
      }
      case 'slam': {
        sc.fx.disc(e.x, e.y, 42, 0xd8d0c0);
        sc.fx.shake(0.006, 200);
        sfx('rumble');
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < 42) {
          sc.combat.damagePlayer(e.dmg * e.might * 1.5, e);
          p.knockX += ((p.x - e.x) / (d || 1)) * 160;
          p.knockY += ((p.y - e.y) / (d || 1)) * 160;
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------- the undead
  private startRevive(e: Enemy): boolean {
    const sc = this.sc;
    const P = e.pw;
    P.t = 6.5;
    const mine = sc.enemies.filter((o) => !o.dead && o.summoner === e).length;
    if (mine >= 6) return false;
    P.targets = this.corpses.filter((c) => !c.used && Math.hypot(c.x - e.x, c.y - e.y) < 130 && ENEMY_BY_ID[c.id]).slice(0, 2);
    for (const c of P.targets) {
      c.used = true;
      c.t = 99;
      sc.fx.beam(e.x, e.y - 10, c.x, c.y - 2, 0x5aff8a, 2, 700);
    }
    P.cast = 0.8;
    e.sprite.setTint(0x9dffb0);
    e.hitFlash = 0.8;
    sc.fx.number(e.x, e.y - 22, P.targets.length ? 'oživuje!' : 'vyvolává!', '#9dffb0');
    sfx('summon');
    return true;
  }

  private raise(e: Enemy) {
    const sc = this.sc;
    const list = e.pw.targets ?? [];
    e.pw.targets = undefined;
    if (!list.length) {
      // no dead around: fresh skeletons from the ground
      for (let i = 0; i < 2; i++) this.summonNear(e, e.def.summon ?? 'skeleton', 26, 0.5);
      return;
    }
    for (const c of list) {
      c.t = 0;
      const m = sc.spawnEnemy(c.id, c.x, c.y, false, e.roomId);
      m.isMinion = true;
      m.risen = true;
      m.summoner = e;
      m.maxHp = m.hp = Math.round(m.maxHp * 0.5);
      m.xp = Math.round(m.xp * 0.3);
      m.aggro = true;
      m.baseTint = 0xa8d8a0;
      m.sprite.setTint(0xa8d8a0);
      m.name = `${m.def.name} (oživlý)`;
      sc.fx.pillar(c.x, c.y + 4, 0x5aff8a);
      sc.fx.burst(c.x, c.y - 6, 0x5aff8a, 12);
    }
  }

  /** a helper appears next to its master */
  summonNear(e: Enemy, id: string, r: number, hpMul: number): Enemy | null {
    const sc = this.sc;
    if (!ENEMY_BY_ID[id] || sc.enemies.length > 120) return null;
    const s = sc.map.randomFloorNear(e.x, e.y, r);
    if (!s) return null;
    const m = sc.spawnEnemy(id, s[0], s[1], false, e.roomId);
    m.isMinion = true;
    m.summoner = e;
    m.maxHp = m.hp = Math.round(m.maxHp * hpMul);
    m.xp = Math.round(m.xp * 0.3);
    m.aggro = true;
    sc.fx.burst(s[0], s[1] - 6, 0xb07dff, 10, 'puff');
    return m;
  }

  // ---------------------------------------------------------------- healers and blessings
  private heal(e: Enemy, spores: boolean) {
    const sc = this.sc;
    const P = e.pw;
    const r = spores ? 75 : 105;
    const hurt = sc.enemiesNear(e.x, e.y, r).filter((o) => o !== e && !o.boss && !o.def.thing && !o.illusion && o.hp < o.maxHp * 0.95);
    if (!hurt.length) {
      P.t = 1;
      return;
    }
    P.t = spores ? 6 : 4.5;
    hurt.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const col = spores ? 0x4ff0d0 : 0x52ff8f;
    for (const o of hurt.slice(0, spores ? 6 : 3)) {
      const add = o.maxHp * (spores ? 0.1 : 0.15);
      o.hp = Math.min(o.maxHp, o.hp + add);
      if (!spores) sc.fx.beam(e.x, e.y - 10, o.x, o.y - 6, col, 2, 320);
      sc.fx.burst(o.x, o.y - 8, col, 5);
      sc.fx.number(o.x, o.y - 16 * o.baseScale, '+' + Math.round(add), '#52ff8f');
    }
    if (spores) {
      sc.fx.ring(e.x, e.y - 4, r, col, 600);
      sc.fx.burst(e.x, e.y - 8, col, 14, 'puff');
    }
    e.lunge(0, -1);
    sfx('heal');
  }

  private bless(e: Enemy, dist: number, sees: boolean) {
    const sc = this.sc;
    const P = e.pw;
    P.t = 4;
    P.mode = (P.mode ?? 0) ^ 1;
    if (P.mode) {
      const mates = sc.enemiesNear(e.x, e.y, 115).filter((o) => o !== e && !o.boss && !o.def.thing && !o.illusion && o.blessT <= 0).slice(0, 5);
      if (!mates.length) {
        P.t = 1.5;
        return;
      }
      for (const o of mates) {
        o.blessT = 6;
        sc.fx.beam(e.x, e.y - 10, o.x, o.y - 6, 0xffb04a, 2, 350);
        sc.fx.ring(o.x, o.y - 6, 14, 0xff7a2a, 400);
      }
      sc.fx.number(e.x, e.y - 22, 'temné požehnání', '#ffb04a');
      sfx('magic');
    } else if (sees && dist < 170) {
      this.curseShot(e, 'vuln');
      sfx('magic');
    } else P.t = 1;
  }

  private sacrifice(e: Enemy) {
    const sc = this.sc;
    const mates = sc.enemiesNear(e.x, e.y, 115).filter((o) => o !== e && !o.boss && !o.def.thing && !o.illusion && o.hp > 2);
    if (!mates.length) {
      e.pw.t = 1.5;
      return;
    }
    e.pw.t = 7;
    let got = 0;
    for (const o of mates.slice(0, 4)) {
      const take = Math.min(o.hp - 1, o.hp * 0.25);
      o.hp -= take;
      got += take;
      o.hpBarT = 3;
      o.sprite.setTintFill(0xff3b3b);
      o.hitFlash = 0.15;
      sc.fx.beam(o.x, o.y - 6, e.x, e.y - 10, 0xc0101a, 2.5, 450);
      sc.fx.burst(o.x, o.y - 8, 0xc0101a, 6, 'pix');
    }
    const heal = Math.min(e.maxHp - e.hp, got * 1.5);
    e.hp += heal;
    sc.fx.ring(e.x, e.y - 8, 26, 0xc0101a, 450);
    sc.fx.number(e.x, e.y - 22, '+' + Math.round(heal) + ' krvavá oběť', '#ff5a6a', true);
    sfx('heal');
  }

  // ---------------------------------------------------------------- mages
  private openPortal(e: Enemy) {
    const sc = this.sc;
    const p = sc.player;
    e.pw.t = 9;
    const mine = sc.enemies.filter((o) => !o.dead && o.def.id === 'portal' && o.summoner === e).length;
    if (mine >= 2) return;
    let spot: [number, number] | null = null;
    for (let i = 0; i < 8 && !spot; i++) {
      const s = sc.map.randomFloorNear(p.x, p.y, 80);
      if (s && Math.hypot(s[0] - p.x, s[1] - p.y) > 40) spot = s;
    }
    if (!spot) return;
    const m = sc.spawnEnemy('portal', spot[0], spot[1], false, e.roomId);
    m.summoner = e;
    m.isMinion = true;
    m.aggro = true;
    m.pw.life = 10;
    m.pw.t = 1.2;
    m.pw.spawned = 0;
    sc.fx.ring(spot[0], spot[1] - 8, 26, 0xb07dff, 500);
    sc.fx.burst(spot[0], spot[1] - 8, 0xb07dff, 16, 'puff');
    sc.fx.beam(e.x, e.y - 10, spot[0], spot[1] - 8, 0xb07dff, 2, 400);
    sc.fx.number(e.x, e.y - 22, 'portál!', '#c8a8ff');
    sfx('summon');
  }

  private portalTick(m: Enemy, dt: number): boolean {
    const sc = this.sc;
    const P = m.pw;
    P.life = (P.life ?? 10) - dt;
    m.sprite.rotation = Math.sin(sc.time.now / 300) * 0.08;
    if (P.life <= 0) {
      this.vanish(m, 0xb07dff);
      return true;
    }
    if ((P.t ?? 0) <= 0 && (P.spawned ?? 0) < 3 && sc.enemies.length < 120) {
      P.t = 2.6;
      P.spawned = (P.spawned ?? 0) + 1;
      const pool = this.floorFodder();
      const id = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'skeleton';
      const c = sc.spawnEnemy(id, m.x + (Math.random() - 0.5) * 6, m.y + 4, false, m.roomId);
      c.isMinion = true;
      c.summoner = m.summoner;
      c.xp = Math.round(c.xp * 0.3);
      c.aggro = true;
      sc.fx.burst(m.x, m.y - 8, 0xb07dff, 10, 'puff');
    }
    return true;
  }

  /** foot soldiers of the floor's families (what comes out of portals) */
  floorFodder(): string[] {
    const fams = this.sc.dungeon.families ?? ['undead', 'vermin'];
    const out: string[] = [];
    for (const f of fams) if (FAMILIES[f]) for (const d of familyFodder(FAMILIES[f], this.sc.floor)) if (!d.group && !d.thing) out.push(d.id);
    return out;
  }

  private timeMagic(e: Enemy, dist: number, sees: boolean) {
    const sc = this.sc;
    const p = sc.player;
    const P = e.pw;
    P.t = 5;
    P.mode = (P.mode ?? 0) ^ 1;
    if (P.mode) {
      const mates = sc.enemiesNear(e.x, e.y, 125).filter((o) => o !== e && !o.boss && !o.def.thing);
      if (!mates.length) {
        P.t = 1.5;
        return;
      }
      for (const o of mates) {
        o.hasteT = 5;
        sc.fx.ring(o.x, o.y - 6, 14, 0x7fe0ff, 400);
      }
      sc.fx.ring(e.x, e.y - 6, 60, 0xffe17a, 500);
      sc.fx.number(e.x, e.y - 22, 'zrychlení!', '#ffe17a');
      sfx('magic');
    } else if (sees && dist < 175) {
      // a circle of slowed time under the hero: step out of it in time
      const x = p.x,
        y = p.y;
      sc.fx.telegraph(x, y, 34, 900, 0x5a8aff);
      sc.fx.beam(e.x, e.y - 10, x, y - 4, 0x7fb2ff, 1.5, 300);
      sfx('magic');
      sc.time.delayedCall(900, () => {
        if (!sc.sys.isActive() || p.dead) return;
        sc.fx.ring(x, y, 34, 0x7fb2ff, 450);
        if (Math.hypot(p.x - x, p.y - y) < 34) this.curse('timeSlow');
      });
    } else P.t = 1;
  }

  private illusions(e: Enemy) {
    const sc = this.sc;
    const P = e.pw;
    P.t = 14;
    if (!e.aggro) {
      P.t = 0.5;
      return;
    }
    if (sc.enemies.some((o) => !o.dead && o.illusion && o.master === e)) {
      P.t = 3;
      return;
    }
    const copies: Enemy[] = [];
    for (let i = 0; i < 3; i++) {
      const s = sc.map.randomFloorNear(e.x, e.y, 48);
      if (!s) continue;
      const m = sc.spawnEnemy(e.def.id, s[0], s[1], false, e.roomId);
      m.illusion = true;
      m.master = e;
      m.maxHp = m.hp = e.hp;
      m.dmg = e.dmg * 0.3;
      m.xp = 0;
      m.aggro = true;
      m.pw.life = 16;
      m.pw.t = 99;
      m.name = e.name;
      if (e.elite) m.sprite.preFX?.addGlow(0xffffff, 2, 0, false, 0.1, 12);
      copies.push(m);
    }
    // the real one hides among its copies
    const k = Math.floor(Math.random() * (copies.length + 1));
    if (k > 0) {
      const c = copies[k - 1];
      [e.x, e.y, c.x, c.y] = [c.x, c.y, e.x, e.y];
    }
    for (const o of [e, ...copies]) sc.fx.burst(o.x, o.y - 8, 0xff8ae0, 10, 'puff');
    sc.fx.number(e.x, e.y - 22, 'iluze!', '#ffb8f0');
    sfx('magic');
  }

  /** an illusion or a portal fades away (no reward) */
  vanish(m: Enemy, col: number) {
    if (m.dead) return;
    m.dead = true;
    const sc = this.sc;
    sc.fx.burst(m.x, m.y - 8, col, 12, 'puff');
    sc.tweens.add({ targets: m.sprite, alpha: 0, scaleX: 0, duration: 250, onComplete: () => m.destroyVisuals() });
    sc.tweens.add({ targets: m.shadow, alpha: 0, duration: 250 });
    m.roleIcon?.setVisible(false);
  }

  // ---------------------------------------------------------------- spiders
  private layEggs(e: Enemy) {
    const sc = this.sc;
    e.pw.t = 7;
    if (!e.aggro) {
      e.pw.t = 1;
      return;
    }
    const mine = sc.enemies.filter((o) => !o.dead && o.summoner === e).length;
    for (let i = 0; i < Math.min(2, 8 - mine); i++) {
      const m = this.summonNear(e, 'spiderEgg', 30, 1);
      if (m) {
        m.pw.t = 4.5;
        m.xp = 2;
      }
    }
    sc.fx.number(e.x, e.y - 24, 'klade vejce', '#e8dcc8');
  }

  private hatch(m: Enemy, dt: number): boolean {
    const sc = this.sc;
    const P = m.pw;
    P.t ??= 4.5;
    m.sprite.setScale(m.baseScale * ACTOR_SCALE * (1 + Math.sin(sc.time.now / 90) * 0.06 * (P.t < 1.5 ? 2 : 1)));
    if (P.t <= 0) {
      const mother = m.summoner;
      for (let i = 0; i < 2; i++) {
        const c = sc.spawnEnemy(mother?.def.summon ?? 'spiderling', m.x + (i ? 5 : -5), m.y, false, m.roomId);
        c.isMinion = true;
        c.summoner = mother;
        c.xp = Math.round(c.xp * 0.3);
        c.aggro = true;
      }
      sc.fx.burst(m.x, m.y - 4, 0xe8dcc8, 10, 'pix');
      this.vanish(m, 0xc8a0a0);
    }
    return true;
  }

  // ---------------------------------------------------------------- ghouls
  private hungry(e: Enemy, dt: number, dist: number): boolean {
    const sc = this.sc;
    const P = e.pw;
    if (P.eating) {
      P.eating.t -= dt;
      if (Math.random() < dt * 8) sc.fx.burst(e.x + e.facing * 4, e.y - 4, 0xc81a2a, 2, 'pix');
      if (P.eating.t <= 0) {
        P.eating.c.t = 0;
        P.eating = undefined;
        e.fed++;
        e.maxHp = Math.round(e.maxHp * 1.15);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.4);
        e.dmg *= 1.18;
        e.setScale(e.baseScale * 1.1);
        sc.fx.ring(e.x, e.y - 6, 22, 0xff3a1a, 400);
        sc.fx.number(e.x, e.y - 22, 'sílí!', '#ff6a4a', true);
        sfx('shout');
      }
      e.syncSprite(false);
      return true;
    }
    if (e.fed >= 4 || dist < 45) return false;
    let best: Corpse | null = null;
    let bd = 150;
    for (const c of this.corpses) {
      if (c.used) continue;
      const d = Math.hypot(c.x - e.x, c.y - e.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return false;
    if (bd < 7) {
      best.used = true;
      best.t = 99;
      P.eating = { c: best, t: 1.4 };
      sc.fx.number(e.x, e.y - 20, 'žere…', '#ff8a7a');
      return true;
    }
    const nx = (best.x - e.x) / bd,
      ny = (best.y - e.y) / bd;
    e.facing = nx >= 0 ? 1 : -1;
    const moved = e.stepToward(nx, ny, e.speed * e.speedMult * e.haste, dt);
    e.syncSprite(moved);
    return moved;
  }

  private mutationTick(e: Enemy, dt: number) {
    const P = e.pw;
    if (e.mutation === 'kyselý') {
      if ((P.t2 ??= 0.8) <= 0) {
        P.t2 = 0.8;
        if (e.aggro) this.sc.addHazard(e.x, e.y + 1, 10, e.dmg * 0.35, 'poison', 3, 0x9dff7a, e.name, false, e);
      }
    } else if (e.mutation === 'regenerující' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
  }

  // ---------------------------------------------------------------- vampires
  private vampire(e: Enemy, dt: number, dist: number): boolean {
    const sc = this.sc;
    const p = sc.player;
    const P = e.pw;
    if (P.bat) {
      P.bat.t -= dt;
      const t = sc.time.now / 120;
      const spd = e.speed * 1.8 * dt;
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      if (d > 20) {
        e.x += ((p.x - e.x) / d) * spd;
        e.y += ((p.y - e.y) / d) * spd;
      }
      P.bat.imgs.forEach((im, i) => im.setPosition(e.x + Math.cos(t + i * 1.26) * 9, e.y - 8 + Math.sin(t * 1.3 + i * 1.26) * 6).setDepth(D.entityBase + e.y + 20));
      e.shadow.setPosition(e.x, e.y + 3);
      if (P.bat.t <= 0) {
        for (const im of P.bat.imgs) im.destroy();
        P.bat = undefined;
        e.invuln = false;
        e.sprite.setVisible(true);
        // land somewhere it can stand
        if (sc.map.collides(e.x, e.y, e.r)) {
          const s = sc.map.randomFloorNear(p.x, p.y, 24);
          if (s) [e.x, e.y] = s;
        }
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.1);
        sc.fx.burst(e.x, e.y - 8, 0x8a0f2a, 14, 'puff');
      }
      return true;
    }
    if (e.hp < e.maxHp * 0.5 && (P.t2 ?? 0) <= 0) {
      // the vampire bursts into a cloud of bats for a moment
      P.t2 = 12;
      P.bat = { t: 2.2, imgs: [] };
      for (let i = 0; i < 5; i++) P.bat.imgs.push(sc.add.sprite(e.x, e.y, 'en_swarmBat', 0).play('en_swarmBat_loop').setScale(ACTOR_SCALE * 0.9));
      e.invuln = true;
      e.sprite.setVisible(false);
      sc.fx.burst(e.x, e.y - 8, 0x8a0f2a, 16, 'puff');
      sc.fx.number(e.x, e.y - 20, 'netopýři!', '#ff6a8a');
      sfx('summon');
      return true;
    }
    if ((P.t ??= 2) <= 0 && dist > 50 && dist < 220) {
      P.t = 6;
      const s = sc.map.randomFloorNear(p.x, p.y, 30);
      if (s && Math.hypot(s[0] - p.x, s[1] - p.y) > 14) {
        sc.fx.burst(e.x, e.y - 6, 0x8a0f2a, 12, 'puff');
        [e.x, e.y] = s;
        sc.fx.burst(e.x, e.y - 6, 0x8a0f2a, 12, 'puff');
        sc.fx.ring(e.x, e.y - 4, 20, 0xc0101a, 350);
      }
    }
    return false;
  }

  private bloodPools(e: Enemy) {
    const sc = this.sc;
    const p = sc.player;
    e.pw.t = 8;
    const spots: [number, number][] = [[p.x, p.y]];
    for (let i = 0; i < 2; i++) {
      const s = sc.map.randomFloorNear(p.x, p.y, 50);
      if (s) spots.push(s);
    }
    for (const [x, y] of spots) {
      sc.addHazard(x, y, 20, e.dmg * 0.45, 'shadow', 5, 0xc0101a, e.name, false, e);
      this.pools.push({ x, y, r: 20, t: 5 });
      sc.fx.burst(x, y - 2, 0xc0101a, 8, 'pix');
    }
    sc.fx.beam(e.x, e.y - 10, p.x, p.y - 4, 0xc0101a, 2, 300);
    sfx('magic');
  }

  // ---------------------------------------------------------------- golems
  private storm(e: Enemy, dist: number): boolean {
    const sc = this.sc;
    const p = sc.player;
    const P = e.pw;
    if ((P.t2 ??= 1.2) <= 0) {
      P.t2 = 1.2;
      if (dist < 36) {
        sc.fx.lightning(e.x, e.y - 10, p.x, p.y - 6);
        sc.combat.cause = e.name;
        sc.combat.causeFoe = e;
        sc.combat.damagePlayer(e.dmg * e.might * 0.35, null, 'lightning');
      } else if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        sc.fx.lightning(e.x, e.y - 10, e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 18, 0xfff27a);
      }
    }
    if ((P.t ??= 2.5) <= 0 && dist < 120) {
      P.t = 5.5;
      const x = e.x,
        y = e.y;
      sc.fx.telegraph(x, y, 56, 800, 0xffe45c);
      sc.time.delayedCall(800, () => {
        if (!sc.sys.isActive() || e.dead) return;
        sfx('thunder');
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
          sc.fx.lightning(e.x, e.y - 10, e.x + Math.cos(a) * 56, e.y + Math.sin(a) * 40, 0xfff27a);
        }
        sc.fx.ring(e.x, e.y, 56, 0xffe45c, 400);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 56) {
          sc.fx.lightning(e.x, e.y - 10, p.x, p.y - 6);
          sc.combat.cause = e.name;
          sc.combat.causeFoe = e;
          sc.combat.damagePlayer(e.dmg * e.might * 1.4, null, 'lightning');
        }
      });
    }
    return false;
  }

  private shieldTick(e: Enemy, dt: number) {
    const P = e.pw;
    P.hit = (P.hit ?? 0) + dt;
    if (P.hit > 4 && e.mshield < e.mshieldMax) {
      const was = e.mshield;
      e.mshield = Math.min(e.mshieldMax, e.mshield + e.mshieldMax * 0.12 * dt);
      if (was <= 0 && e.mshield > 0) this.sc.fx.ring(e.x, e.y - 6, 20, 0x5ab0ff, 400);
    }
  }

  // ---------------------------------------------------------------- aberrations
  private eatBuff(e: Enemy) {
    const sc = this.sc;
    const p = sc.player;
    e.pw.t = 6;
    const list = p.buffs.filter((b) => !b.debuff && b.t > 0.5 && b.t < 3600 && !b.mods.invuln);
    if (!list.length || e.pw.stolen) {
      e.pw.t = 1.5;
      return;
    }
    const b = list.reduce((a, c) => (c.t > a.t ? c : a));
    p.buffs = p.buffs.filter((x) => x !== b);
    p.recalc();
    bus.emit('buffs');
    e.pw.stolen = { id: b.id, name: b.name, mods: b.mods, t: Math.min(b.t, 20), color: b.color };
    sc.fx.beam(p.x, p.y - 8, e.x, e.y - 8, b.color, 2.5, 450);
    sc.fx.number(p.x, p.y - 24, `sežráno: ${b.name}`, '#ff8aff', true);
    sc.fx.ring(e.x, e.y - 6, 24, b.color, 400);
    sfx('magic');
  }

  private stolenTick(e: Enemy, dt: number) {
    const s = e.pw.stolen!;
    s.t -= dt;
    if (Math.random() < dt * 3) this.sc.fx.burst(e.x, e.y - 8, s.color, 2);
    if (s.t <= 0) e.pw.stolen = undefined;
  }

  /** a mirror demon saw the hero cast */
  private copySpell(e: Enemy, sp: SpellDef) {
    const kinds = sp.fx.map((f) => f.t);
    const kind: SpellCopy['kind'] = kinds.some((k) => ['proj', 'chain', 'rain'].includes(k)) ? 'proj' : kinds.some((k) => ['nova', 'aoe', 'melee', 'whirl', 'dash', 'field', 'dance', 'orbit', 'trap', 'totem'].includes(k)) ? 'area' : 'self';
    const el = (sp.fx.find((f) => f.el)?.el ?? (sp.scale === 'magic' ? 'shadow' : 'phys')) as Element;
    const was = e.pw.copy?.name;
    e.pw.copy = { name: sp.name, kind, el, sprite: SPELL_PROJ[el] ?? 'magic' };
    if (was !== sp.name) {
      this.sc.fx.number(e.x, e.y - 22, `zrcadlí: ${sp.name}`, '#bfefff');
      this.sc.fx.ring(e.x, e.y - 8, 18, 0xbfefff, 350);
    }
  }

  private mirrorCast(e: Enemy): boolean {
    const sc = this.sc;
    const p = sc.player;
    const c = e.pw.copy!;
    e.pw.t = 4.5;
    const dmg = e.dmg * e.might;
    const col = EL_COLOR[c.el] ?? 0xbfefff;
    sc.fx.number(e.x, e.y - 22, c.name, '#bfefff');
    if (c.kind === 'proj') {
      const a = Math.atan2(p.y - 6 - (e.y - 7), p.x - e.x);
      for (const da of [-0.25, 0, 0.25]) sc.spawnEnemyProjectile(e.x, e.y - 7, a + da, c.sprite, dmg * 0.8, c.el, 150, `${e.name} – ${c.name}`, e);
      e.lunge(Math.cos(a), Math.sin(a));
    } else if (c.kind === 'area') {
      const x = p.x,
        y = p.y;
      sc.fx.telegraph(x, y, 38, 800, col);
      sc.time.delayedCall(800, () => {
        if (!sc.sys.isActive() || p.dead) return;
        sc.fx.disc(x, y, 38, col);
        sc.fx.burst(x, y - 4, col, 14);
        if (Math.hypot(p.x - x, p.y - y) < 38) {
          sc.combat.cause = `${e.name} – ${c.name}`;
          sc.combat.causeFoe = e;
          sc.combat.damagePlayer(dmg * 1.5, null, c.el);
        }
      });
    } else {
      e.blessT = 5;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.15);
      sc.fx.ring(e.x, e.y - 6, 24, 0xbfefff, 400);
    }
    sfx('spell');
    return false;
  }

  // ---------------------------------------------------------------- events
  /** the hero cast a spell: mage hunters jump in, mirror demons take note */
  onSpell(sp: SpellDef) {
    const sc = this.sc;
    const p = sc.player;
    for (const e of sc.enemies) {
      if (e.dead || e.stunned || e.illusion) continue;
      const ab = e.def.ability;
      if (ab !== 'hunter' && ab !== 'mirror') continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (ab === 'mirror') {
        if (d < 220) this.copySpell(e, sp);
        continue;
      }
      if (d > 260 || (e.pw.t ?? 0) > 0) continue;
      const s = sc.map.randomFloorNear(p.x, p.y, 22);
      if (!s || Math.hypot(s[0] - p.x, s[1] - p.y) < 8) continue;
      e.pw.t = 4;
      sc.fx.burst(e.x, e.y - 6, 0x3a3a46, 12, 'puff');
      [e.x, e.y] = s;
      e.aggro = true;
      e.windup = 0.25;
      e.atkT = e.def.atkCd;
      e.facing = p.x >= e.x ? 1 : -1;
      sc.fx.burst(e.x, e.y - 6, 0x7fd8ff, 12, 'puff');
      sc.fx.ring(e.x, e.y - 4, 20, 0x7fd8ff, 300);
      sc.fx.number(e.x, e.y - 22, 'lovec mágů!', '#7fd8ff');
      sfx('swing');
    }
  }

  /** damage on its way into a monster: guardians, ghosts, shields, adaptation, swarms, crystal */
  incoming(e: Enemy, dmg: number, o: HitOpts, el: Element): number {
    const sc = this.sc;
    const P = e.pw;
    if (e.def.ethereal && !o.dot) {
      if (o.spell) dmg *= 1.35;
      else if (el === 'phys') dmg *= 0.5;
    }
    if (e.def.ability === 'hunter' && (o.spell || el !== 'phys')) dmg *= 0.7;
    // a swarm is hard to hit with a single shot
    if (e.def.ability === 'swarm' && o.single && Math.random() < 0.55) {
      sc.fx.number(e.x, e.y - 12, 'vedle', '#a8a8b8');
      return 0;
    }
    if (e.def.ability === 'adapt' && !o.dot) dmg = this.adapt(e, dmg, el);
    // guardians shield the pack around them
    if (this.guards.length && e.def.ability !== 'guard') {
      for (const g of this.guards) {
        if (g.dead || Math.hypot(g.x - e.x, g.y - e.y) > 75) continue;
        dmg *= 0.6;
        if ((e.pw.told ?? 0) < sc.time.now) {
          e.pw.told = sc.time.now + 600;
          sc.fx.beam(g.x, g.y - 10, e.x, e.y - 8, 0x7fb2ff, 1.5, 250);
        }
        break;
      }
    }
    // a crystal golem throws magic back
    if (e.def.ability === 'crystal' && !o.dot && !o.fromAlly && (o.spell || el !== 'phys')) sc.combat.reflectToHero(e, dmg * 0.3, el, 'krystal');
    // the mana shield soaks everything first
    if (e.mshield > 0) {
      P.hit = 0;
      const soak = Math.min(e.mshield, dmg);
      e.mshield -= soak;
      dmg -= soak;
      sc.fx.burst(e.x, e.y - 8, 0x5ab0ff, 3);
      if (e.mshield <= 0) {
        sc.fx.ring(e.x, e.y - 6, 26, 0x5ab0ff, 400);
        sc.fx.number(e.x, e.y - 22, 'štít praskl!', '#7fc8ff', true);
        e.st.stunT = Math.max(e.st.stunT, 1);
      }
      if (dmg <= 0) {
        if (!o.silent && !o.dot) sc.fx.number(e.x, e.y - 14 * e.baseScale, Math.round(soak).toString(), '#7fc8ff');
        return 0;
      }
    } else if (e.mshieldMax > 0) P.hit = 0;
    // a hard blow breaks a sniper's aim
    if (e.aimT > 0 && dmg > e.maxHp * 0.08) {
      e.aimT = 0;
      e.atkT = 1.5;
      sc.fx.number(e.x, e.y - 20, 'přerušeno', '#ffd0c8');
    }
    return dmg;
  }

  private adapt(e: Enemy, dmg: number, el: Element): number {
    const P = e.pw;
    const a = (P.adapt ??= {});
    for (const k of Object.keys(a) as Element[]) if (k !== el) a[k] = Math.max(0, (a[k] ?? 0) - 0.02);
    const before = a[el] ?? 0;
    const now = Math.min(0.75, before + 0.06);
    a[el] = now;
    const out = dmg * (1 - before);
    // its colour turns to what it resists most
    let top: Element = el;
    for (const k of Object.keys(a) as Element[]) if ((a[k] ?? 0) > (a[top] ?? 0)) top = k;
    if ((a[top] ?? 0) > 0.2) {
      e.baseTint = EL_COLOR[top] === 0xffffff ? 0xc8c8d0 : EL_COLOR[top];
      if (e.hitFlash <= 0) e.sprite.setTint(e.baseTint);
    }
    if ((before < 0.3 && now >= 0.3) || (before < 0.6 && now >= 0.6)) {
      this.sc.fx.number(e.x, e.y - 24, `přizpůsobuje se: ${EL_NAME[el]}`, '#e0e0f0', true);
      this.sc.fx.ring(e.x, e.y - 6, 24, EL_COLOR[el] ?? 0xffffff, 400);
    }
    return out;
  }

  /** a monster died: remains, splits, clouds, explosions, returned buffs */
  onDeath(e: Enemy) {
    const sc = this.sc;
    const p = sc.player;
    const ab = e.def.ability;
    if (e.illusion || e.def.thing) return;
    if (e.pw.bat) for (const im of e.pw.bat.imgs) im.destroy();
    // its illusions fade with it
    if (ab === 'illusion') for (const o of sc.enemies) if (!o.dead && o.illusion && o.master === e) this.vanish(o, 0xff8ae0);
    if (ab === 'portal') for (const o of sc.enemies) if (!o.dead && o.def.id === 'portal' && o.summoner === e) this.vanish(o, 0xb07dff);
    if (ab === 'shatter' && !e.isMinion) {
      sc.fx.burst(e.x, e.y - 8, 0x9d9a92, 16, 'pix');
      sfx('rumble');
      for (let i = 0; i < 2; i++) {
        const m = sc.spawnEnemy(e.def.summon ?? 'golemShard', e.x + (i ? 7 : -7), e.y, false, e.roomId);
        m.maxHp = m.hp = Math.round(e.maxHp * 0.35);
        m.dmg = e.dmg * 0.55;
        m.isMinion = true;
        m.aggro = true;
        m.knockX = (i ? 1 : -1) * 90;
      }
    }
    if (ab === 'plague') {
      sc.addHazard(e.x, e.y, 26, e.dmg * 0.4, 'poison', 4, 0x7be05a, e.name, false);
      sc.fx.burst(e.x, e.y - 6, 0x9dff7a, 14, 'puff');
    }
    if (e.def.behavior === 'bomber' || e.mutation === 'výbušný') {
      const x = e.x,
        y = e.y;
      sc.fx.telegraph(x, y, 32, 350, 0xff7a2a);
      sc.time.delayedCall(350, () => this.blast(x, y, 32, e.dmg * 1.3, e.name));
    }
    if (e.pw.stolen && e.pw.stolen.t > 1 && !p.dead) {
      const s = e.pw.stolen;
      p.addBuff(s.id, s.name, s.mods, s.t, s.color);
      sc.fx.beam(e.x, e.y - 8, p.x, p.y - 8, s.color, 2.5, 450);
      sc.fx.number(p.x, p.y - 24, `vráceno: ${s.name}`, '#9dff7a', true);
    }
    // remains (not of the risen: they fall to dust for good)
    if (!e.boss && !e.risen && e.def.behavior !== 'thief' && !e.def.group) {
      const img = sc.add.image(e.x, e.y + 2, 'bones').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 1).setAlpha(0.75).setFlipX(Math.random() < 0.5);
      this.corpses.push({ x: e.x, y: e.y, id: e.def.id, t: 25, used: false, img });
      if (this.corpses.length > 24) {
        const old = this.corpses.shift()!;
        old.img.destroy();
      }
    }
  }

  /** an explosion of a spider (or a mutant) */
  blast(x: number, y: number, r: number, dmg: number, who: string) {
    const sc = this.sc;
    const p = sc.player;
    sc.fx.disc(x, y, r, 0xff7a2a);
    sc.fx.burst(x, y - 4, 0xff9a3a, 16);
    sfx('explosion');
    if (!p.dead && Math.hypot(p.x - x, p.y - y) < r) {
      sc.combat.cause = `${who} – výbuch`;
      sc.combat.damagePlayer(dmg, null, 'fire');
    }
  }

  /** a bomber reached the hero: it swells and bursts (no reward, it took itself out) */
  detonate(e: Enemy) {
    if (e.dead) return;
    const sc = this.sc;
    e.dead = true;
    this.blast(e.x, e.y, 36, e.dmg * e.might * 2.2, e.name);
    sc.tweens.add({ targets: e.sprite, alpha: 0, duration: 120, onComplete: () => e.destroyVisuals() });
    sc.tweens.add({ targets: e.shadow, alpha: 0, duration: 120 });
    e.roleIcon?.setVisible(false);
  }
}
