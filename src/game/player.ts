import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Actor, Enemy } from './entities';
import { D, EL_COLOR } from './fx';
import { SaveData, derive, Derived } from '../systems/state';
import { BuffMods } from '../data/spells';
import { BASE_BY_ID, itemTier } from '../data/items';
import { bus } from '../systems/events';
import { sfx } from '../systems/audio';

export interface Buff {
  id: string;
  name: string;
  mods: BuffMods;
  t: number;
  total: number;
  color: number;
}

const MAGIC_COLORS: Record<string, string> = { staff: 'pr_magic', wand: 'pr_magic' };

export class Player extends Actor {
  save: SaveData;
  d!: Derived;
  mp = 0;
  buffs: Buff[] = [];
  shield = 0;
  shieldT = 0;
  stealthT = 0;
  chillT = 0;
  invulnT = 0;
  atkT = 0;
  cds: number[] = [0, 0, 0, 0, 0];
  weapon: Phaser.GameObjects.Image | null = null;
  offhand: Phaser.GameObjects.Image | null = null;
  swinging = 0;
  swingHand = 0;
  aim = 0;
  target: Enemy | null = null;
  shieldFx: Phaser.GameObjects.Image | null = null;
  auraFx: Phaser.GameObjects.Image | null = null;
  ghostStepT = 0;
  novaPulseT = 0;
  orbitAngle = 0;
  orbitFx: Phaser.GameObjects.Image[] = [];
  orbitTick = 0;
  vampTick = 0;
  hurtT = 0;
  moving = false;

  constructor(scene: GameScene, x: number, y: number, save: SaveData) {
    super(scene, x, y, 'pl_' + save.cls);
    this.save = save;
    this.r = 4;
    this.recalc(true);
    this.hp = this.d.maxHp;
    this.mp = this.d.maxMp;
    this.buildWeaponSprites();
    this.shieldFx = scene.add.image(x, y, 'disc').setTint(0x7fb2ff).setAlpha(0).setScale(0.115).setDepth(D.bright).setBlendMode(Phaser.BlendModes.ADD);
  }

  get stealthed() {
    return this.stealthT > 0;
  }

  buffMods(): BuffMods[] {
    const mods = this.buffs.map((b) => b.mods);
    if (this.ghostStepT > 0) mods.push({ move: 40 });
    if (this.chillT > 0) mods.push({ move: -35, atkSpdPct: -20 });
    if (this.d && this.d.specials.has('berserk') && this.hp < this.d.maxHp * 0.4) mods.push({ dmgPct: 35 });
    if (this.save.cls === 'berserker' && this.d) {
      const missing = 1 - this.hp / this.d.maxHp;
      mods.push({ dmgPct: Math.round(missing * 50) });
    }
    for (const sb of this.scene.shrineBuffs) mods.push(sb.mods);
    return mods;
  }

  recalc(initial = false) {
    const prevMax = this.d?.maxHp ?? 0;
    this.d = derive(this.save, initial ? [] : this.buffMods());
    if (!initial && prevMax > 0 && this.d.maxHp !== prevMax) this.hp = Math.min(this.d.maxHp, this.hp * (this.d.maxHp / prevMax));
    this.mp = Math.min(this.mp, this.d.maxMp);
    if (!initial) this.buildWeaponSprites();
    this.syncOrbit();
  }

  private weaponKey = '';

  buildWeaponSprites() {
    // only rebuild when the equipped weapons actually changed
    const key = (this.save.equip.main?.uid ?? '-') + '|' + (this.save.equip.off?.uid ?? '-');
    if (key === this.weaponKey && (this.weapon || this.offhand || key === '-|-')) return;
    this.weaponKey = key;
    this.weapon?.destroy();
    this.offhand?.destroy();
    this.weapon = null;
    this.offhand = null;
    const main = this.save.equip.main;
    if (main) {
      const key = `wp_${main.base}_t${itemTier(main)}`;
      this.weapon = this.scene.add.image(this.x, this.y, key).setOrigin(0.5, 0.85);
    }
    const off = this.save.equip.off;
    if (off) {
      const key = `wp_${off.base}_t${itemTier(off)}`;
      this.offhand = this.scene.add.image(this.x, this.y, key).setOrigin(0.5, off.base === 'shield' || off.base === 'orb' ? 0.5 : 0.85);
    }
  }

  syncOrbit() {
    const want = this.d?.specials.has('arcaneOrbit') ? 2 : 0;
    while (this.orbitFx.length > want) this.orbitFx.pop()!.destroy();
    while (this.orbitFx.length < want) this.orbitFx.push(this.scene.add.sprite(this.x, this.y, 'fx_orbit').setDepth(D.bright).setBlendMode(Phaser.BlendModes.ADD));
  }

  addBuff(id: string, name: string, mods: BuffMods, dur: number, color = 0xffffff) {
    const ex = this.buffs.find((b) => b.id === id);
    if (ex) {
      ex.t = dur;
      ex.total = dur;
    } else this.buffs.push({ id, name, mods, t: dur, total: dur, color });
    if (mods.invuln) this.invulnT = Math.max(this.invulnT, dur);
    this.recalc();
    bus.emit('buffs');
  }

  heal(amount: number, show = true) {
    if (this.dead || amount <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.d.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (show && got >= 1) this.scene.fx.number(this.x, this.y - 18, '+' + got, '#5dff8a');
  }

  addShield(amount: number, dur: number) {
    this.shield = Math.max(this.shield, amount);
    this.shieldT = dur;
  }

  applyPoison(dps: number, t: number) {
    this.st.poisonDps = Math.max(this.st.poisonDps, dps);
    this.st.poisonT = Math.max(this.st.poisonT, t);
  }

  chill(t: number) {
    const wasChilled = this.chillT > 0;
    this.chillT = Math.max(this.chillT, t);
    if (!wasChilled) this.recalc();
  }

  onDot(amount: number) {
    this.scene.combat.damagePlayer(amount, null, 'poison', true);
  }

  update(dt: number, mx: number, my: number) {
    if (this.dead) return;
    const sc = this.scene;
    this.updateStatus(dt);
    // timers
    let needRecalc = false;
    for (const b of this.buffs) b.t -= dt;
    const before = this.buffs.length;
    this.buffs = this.buffs.filter((b) => b.t > 0);
    if (this.buffs.length !== before) {
      needRecalc = true;
      bus.emit('buffs');
    }
    if (this.chillT > 0) {
      this.chillT -= dt;
      if (this.chillT <= 0) needRecalc = true;
    }
    if (this.ghostStepT > 0) {
      this.ghostStepT -= dt;
      if (this.ghostStepT <= 0) needRecalc = true;
    }
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.stealthT > 0) {
      this.stealthT -= dt;
      this.sprite.setAlpha(0.45);
      if (this.stealthT <= 0) this.sprite.setAlpha(1);
    }
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) this.shield = 0;
    }
    this.hurtT -= dt;
    if (needRecalc) this.recalc();
    // berserker / berserk special depend on hp – refresh periodically
    if ((this.save.cls === 'berserker' || this.d.specials.has('berserk')) && Math.random() < dt * 2) this.recalc();

    // regen
    const regenPct = this.buffs.reduce((a, b) => a + (b.mods.regenPct ?? 0), 0);
    this.hp = Math.min(this.d.maxHp, this.hp + (this.d.hpRegen + (this.d.maxHp * regenPct) / 100) * dt);
    this.mp = Math.min(this.d.maxMp, this.mp + this.d.mpRegen * dt);

    // cooldowns
    const cdRate = 1 + this.buffs.reduce((a, b) => a + (b.mods.cdrRate ?? 0), 0);
    for (let i = 0; i < this.cds.length; i++) if (this.cds[i] > 0) this.cds[i] = Math.max(0, this.cds[i] - dt * cdRate);

    // movement
    const len = Math.hypot(mx, my);
    this.moving = len > 0.1;
    if (this.moving) {
      const spd = this.d.move * Math.min(1, len) * this.speedMult;
      const [nx, ny] = sc.map.move(this.x, this.y, (mx / len) * spd * dt, (my / len) * spd * dt, this.r);
      this.x = nx;
      this.y = ny;
      if (Math.abs(mx) > 0.15 && !this.target) this.facing = mx > 0 ? 1 : -1;
    }
    if (Math.abs(this.knockX) + Math.abs(this.knockY) > 0.5) {
      const [nx, ny] = sc.map.move(this.x, this.y, this.knockX * dt, this.knockY * dt, this.r);
      this.x = nx;
      this.y = ny;
      this.knockX *= 0.8;
      this.knockY *= 0.8;
    }

    if (sc.map.collides(this.x, this.y, this.r)) this.unstick();
    this.autoAttack(dt);
    this.specialsTick(dt);
    this.syncSprite(this.moving);
    this.updateWeaponSprites(dt);
    if (this.shieldFx) {
      this.shieldFx.setPosition(this.x, this.y - 6);
      this.shieldFx.setAlpha(this.shield > 0 ? 0.35 + Math.sin(sc.time.now / 150) * 0.08 : this.invulnT > 0 ? 0.5 : 0);
      this.shieldFx.setTint(this.invulnT > 0 ? 0xfff2a8 : 0x7fb2ff);
    }
  }

  specialsTick(dt: number) {
    const sc = this.scene;
    // nova pulse buff (Avatar války)
    const pulse = this.buffs.find((b) => b.mods.novaPulse);
    if (pulse) {
      this.novaPulseT -= dt;
      if (this.novaPulseT <= 0) {
        this.novaPulseT = 1;
        sc.spells.nova(this.x, this.y, 60, this.weaponHit() * (pulse.mods.novaPulse ?? 1), 'phys', {});
      }
    }
    if (this.orbitFx.length) {
      this.orbitAngle += dt * 4;
      this.orbitTick -= dt;
      this.orbitFx.forEach((o, i) => {
        const a = this.orbitAngle + (i * Math.PI * 2) / this.orbitFx.length;
        o.setPosition(this.x + Math.cos(a) * 24, this.y - 6 + Math.sin(a) * 16);
        if (this.orbitTick <= 0) {
          for (const e of sc.enemiesNear(o.x, o.y + 6, 10)) sc.combat.damageEnemy(e, this.spellBase() * 0.5, { el: 'shadow', spell: true });
        }
      });
      if (this.orbitTick <= 0) this.orbitTick = 0.35;
    }
    if (this.d.specials.has('vampAura')) {
      this.vampTick -= dt;
      if (this.vampTick <= 0) {
        this.vampTick = 1;
        for (const e of sc.enemiesNear(this.x, this.y, 60)) {
          const amt = Math.min(e.maxHp * 0.02, this.d.maxHp * 0.05);
          sc.combat.damageEnemy(e, amt, { el: 'shadow', dot: true });
          this.heal(amt * 0.5, false);
        }
      }
    }
  }

  // average weapon hit (used for weapon-scaled spells)
  weaponHit() {
    return (this.d.dmgMin + this.d.dmgMax) / 2;
  }

  spellBase() {
    const L = this.save.level;
    return (8 + 3 * L + 0.05 * L * L) * this.d.spellMult;
  }

  autoAttack(dt: number) {
    const sc = this.scene;
    this.atkT -= dt;
    const range = this.d.range;
    // find target (keep current if still valid)
    if (!this.target || this.target.dead || Math.hypot(this.target.x - this.x, this.target.y - this.y) > range + this.target.r * this.target.baseScale + 6 || !sc.map.canSee(this.x, this.y, this.target.x, this.target.y)) {
      this.target = sc.nearestEnemy(this.x, this.y, range + 6, true);
    }
    // a fleeing treasure goblin always takes priority
    const th = sc.thief;
    if (th && !th.dead && th.spotted && this.target !== th && Math.hypot(th.x - this.x, th.y - this.y) <= range + 6 && sc.map.canSee(this.x, this.y, th.x, th.y)) this.target = th;
    const t = this.target;
    if (!t) return;
    const dx = t.x - this.x,
      dy = t.y - 4 * t.baseScale - (this.y - 4);
    this.aim = Math.atan2(dy, dx);
    this.facing = dx >= 0 ? 1 : -1;
    if (this.atkT > 0) return;
    this.atkT = 1 / this.d.aps;
    const double = this.d.specials.has('doubleStrike') && Math.random() < 0.15;
    this.performAttack(t);
    if (double) sc.time.delayedCall(120, () => !this.dead && this.target && !this.target.dead && this.performAttack(this.target));
    if (this.stealthT > 0) {
      this.stealthT = 0;
      this.sprite.setAlpha(1);
    }
  }

  // Where a basic shot starts. Point-blank targets (possibly around a wall corner) get the shot
  // released right at them, so a monster hugging the player can always be hit.
  shotOrigin(t: Enemy, a: number, off: number): [number, number] {
    if (Math.hypot(t.x - this.x, t.y - this.y) < 20) return [t.x - Math.cos(a) * 3, t.y - 6 * t.baseScale - Math.sin(a) * 3];
    return [this.x + Math.cos(a) * off, this.y - off + Math.sin(a) * off];
  }

  performAttack(t: Enemy) {
    const sc = this.scene;
    const kind = this.d.attack;
    const base = this.save.equip.main ? BASE_BY_ID[this.save.equip.main.base] : null;
    this.swinging = 0.18;
    this.swingHand = this.d.dual ? 1 - this.swingHand : 0;
    if (kind === 'melee') {
      sfx('swing');
      const arc = (this.d.arc * Math.PI) / 180;
      const range = this.d.range;
      sc.time.delayedCall(70, () => {
        if (this.dead) return;
        sc.fx.slash(this.x + Math.cos(this.aim) * 6, this.y - 5 + Math.sin(this.aim) * 6, this.aim, range * 0.6, 0xffffff, this.d.arc);
        let hits = 0;
        for (const e of sc.enemies) {
          if (e.dead) continue;
          const ex = e.x - this.x,
            ey = e.y - 4 * e.baseScale - (this.y - 4);
          const dist = Math.hypot(ex, ey);
          if (dist > range + e.r * e.baseScale + 4) continue;
          const ang = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ey, ex) - this.aim));
          if (ang > arc / 2 + 0.2 && dist > 10) continue;
          sc.combat.attackHit(e, Math.cos(this.aim) * 60, Math.sin(this.aim) * 60);
          hits++;
        }
        if (hits) sfx('hit');
      });
    } else if (kind === 'ranged') {
      sfx('bow');
      const n = 1 + (this.d.specials.has('extraProjectile') ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i - (n - 1) / 2) * 0.12;
        const [sx, sy] = this.shotOrigin(t, a, 6);
        sc.spawnPlayerAttackProjectile(sx, sy, a, base?.id === 'crossbow' ? 'pr_arrow' : 'pr_arrow', base?.id === 'crossbow' ? 1 : 0);
      }
    } else {
      sfx('magic');
      const n = 1 + (this.d.specials.has('extraProjectile') ? 1 : 0);
      const spr = MAGIC_COLORS[base?.id ?? 'staff'] ?? 'pr_magic';
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i - (n - 1) / 2) * 0.15;
        const [sx, sy] = this.shotOrigin(t, a, 8);
        sc.spawnPlayerAttackProjectile(sx, sy, a, spr, 0);
      }
      sc.fx.burst(this.x + Math.cos(this.aim) * 8, this.y - 10, 0xc77dff, 4);
    }
  }

  updateWeaponSprites(dt: number) {
    const f = this.facing;
    const bob = this.moving ? Math.sin(this.scene.time.now / 70) * 0.8 : 0;
    const depth = this.sprite.depth;
    const kind = this.d.attack;
    if (this.swinging > 0) this.swinging -= dt;
    const swingP = this.swinging > 0 ? 1 - this.swinging / 0.18 : 1;
    const baseKey = this.save.equip.main?.base ?? '';
    const arc = (this.d.arc * Math.PI) / 180;
    const hx = this.x + 5 * f,
      hy = this.y - 4 + bob;
    if (this.weapon) {
      let rot: number;
      if (kind === 'ranged') {
        const a = this.target ? this.aim : f > 0 ? 0 : Math.PI;
        rot = a;
        this.weapon.setOrigin(0.3, 0.5);
        this.weapon.setPosition(this.x + Math.cos(a) * 4, this.y - 6 + Math.sin(a) * 3 + bob);
        this.weapon.setScale(this.swinging > 0 ? 0.85 + 0.15 * swingP : 1, 1);
        this.weapon.setFlipX(false);
        if (baseKey === 'crossbow') rot = a + Math.PI / 2;
      } else if (kind === 'magic') {
        const a = this.target ? this.aim : -Math.PI / 2 + 0.3 * f;
        rot = this.swinging > 0 ? a + Math.PI / 2 : 0.25 * f;
        this.weapon.setOrigin(0.5, 0.85);
        this.weapon.setPosition(hx, hy + 2);
      } else {
        // melee
        this.weapon.setOrigin(0.5, 0.85);
        if (this.swinging > 0 && this.swingHand === 0) {
          const start = this.aim - arc / 2,
            end = this.aim + arc / 2;
          const a = f > 0 ? start + (end - start) * swingP : end - (end - start) * swingP;
          rot = a + Math.PI / 2;
          this.weapon.setPosition(this.x + Math.cos(this.aim) * 2, this.y - 5 + Math.sin(this.aim) * 2);
        } else {
          rot = 0.5 * f;
          this.weapon.setPosition(hx, hy + 2);
        }
        if (baseKey === 'spear' && this.swinging > 0 && this.swingHand === 0) {
          rot = this.aim + Math.PI / 2;
          const thrust = Math.sin(swingP * Math.PI) * 10;
          this.weapon.setPosition(this.x + Math.cos(this.aim) * (2 + thrust), this.y - 5 + Math.sin(this.aim) * (2 + thrust));
        }
      }
      this.weapon.setRotation(rot);
      this.weapon.setDepth(depth + (f > 0 ? 0.5 : -0.5) + (this.swinging > 0 ? 1 : 0));
    }
    if (this.offhand) {
      const offBase = this.save.equip.off!.base;
      const ox = this.x - 5 * f,
        oy = this.y - 4 + bob;
      if (offBase === 'shield') {
        this.offhand.setPosition(ox, oy);
        this.offhand.setRotation(0);
        this.offhand.setDepth(depth + (f > 0 ? 0.6 : 0.6));
        this.offhand.setScale(0.8);
      } else if (offBase === 'orb') {
        this.offhand.setPosition(ox, oy - 4 + Math.sin(this.scene.time.now / 300) * 1.5);
        this.offhand.setDepth(depth + 0.6);
      } else {
        // second weapon
        let rot = -0.5 * f;
        let px2 = ox,
          py2 = oy + 2;
        if (this.swinging > 0 && this.swingHand === 1) {
          const start = this.aim + arc / 2,
            end = this.aim - arc / 2;
          const a = start + (end - start) * swingP;
          rot = a + Math.PI / 2;
          px2 = this.x + Math.cos(this.aim) * 2;
          py2 = this.y - 5 + Math.sin(this.aim) * 2;
        }
        this.offhand.setPosition(px2, py2);
        this.offhand.setRotation(rot);
        this.offhand.setDepth(depth + (f > 0 ? -0.6 : 0.6) + (this.swinging > 0 && this.swingHand === 1 ? 2 : 0));
      }
    }
    this.weapon?.setAlpha(this.sprite.alpha);
    this.offhand?.setAlpha(this.sprite.alpha);
  }

  // safety: if something pushed the player into a wall, move to the nearest free spot
  unstick() {
    const m = this.scene.map;
    for (let r = 2; r < 64; r += 2)
      for (let a = 0; a < 16; a++) {
        const x = this.x + Math.cos((a / 16) * Math.PI * 2) * r,
          y = this.y + Math.sin((a / 16) * Math.PI * 2) * r;
        if (!m.collides(x, y, this.r)) {
          this.x = x;
          this.y = y;
          return;
        }
      }
  }

  hurtFlash() {
    if (this.hurtT > 0) return;
    this.hurtT = 0.1;
    this.scene.fx.flash(this.sprite, 0xff5050, 90);
  }

  destroyAll() {
    this.destroyVisuals();
    this.weapon?.destroy();
    this.offhand?.destroy();
    this.shieldFx?.destroy();
    this.orbitFx.forEach((o) => o.destroy());
  }
}

export { EL_COLOR };
