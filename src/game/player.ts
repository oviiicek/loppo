import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Actor, Enemy } from './entities';
import { D, EL_COLOR } from './fx';
import { SaveData, derive, Derived, LEECH_CAP } from '../systems/state';
import { BuffMods } from '../data/spells';
import { BASE_BY_ID, itemTier, isBow } from '../data/items';
import { bus } from '../systems/events';
import { sfx } from '../systems/audio';
import { ACTOR_SCALE, WEAPON_SCALE } from '../gfx/textures';
import { HERO_FRAMES, heroHand, heroHandB } from '../gfx/heroes';

export interface Buff {
  id: string;
  name: string;
  mods: BuffMods;
  t: number;
  total: number;
  color: number;
  /** a monster's curse (shown red, cannot be stolen) */
  debuff?: boolean;
  /** the icon's glyph when it is not a spell */
  glyph?: string;
}

/** the colour of the little burst where a shot of each kind hits */
const SHOT_FX: Record<string, number> = { pr_magic: 0xc77dff, pr_holy: 0xffe45c, pr_bolt: 0xfff27a, pr_thorn: 0x7adf6b, pr_knife: 0xffffff, pr_axe: 0xffffff, pr_arrow: 0xffffff };

/** where a put-away weapon sits (offset from the feet anchor and rotation when facing right; mirrored for the left) */
interface Sheath {
  dx: number;
  dy: number;
  rot: number;
  ox?: number;
  oy?: number;
  /** depth relative to the hero sprite (behind it) */
  depth?: number;
  /** hidden when put away (knuckles, orbs) */
  alpha?: number;
}
const PI = Math.PI;
const SHEATH: Record<string, Sheath> = {
  // blades hang hilt-up on the back, hafted weapons and staves head-up
  sword: { dx: -5, dy: -14, rot: PI + 0.3 },
  greatsword: { dx: -5, dy: -16, rot: PI + 0.42 },
  axe: { dx: -3, dy: -2, rot: -0.35 },
  greataxe: { dx: -2, dy: 0, rot: -0.4 },
  hammer: { dx: -2, dy: -1, rot: -0.35 },
  mace: { dx: -3, dy: -2, rot: -0.35 },
  spear: { dx: -2, dy: 1, rot: -0.3 },
  halberd: { dx: -2, dy: 1, rot: -0.3 },
  scythe: { dx: -2, dy: 0, rot: -0.35 },
  quarterstaff: { dx: -3, dy: 0, rot: -0.45 },
  staff: { dx: -3, dy: 0, rot: -0.25 },
  stormstaff: { dx: -3, dy: 0, rot: -0.25 },
  crook: { dx: -3, dy: 0, rot: -0.25 },
  bow: { dx: -5, dy: -8, rot: -0.5, ox: 0.5, oy: 0.5 },
  shortbow: { dx: -5, dy: -8, rot: -0.5, ox: 0.5, oy: 0.5 },
  longbow: { dx: -5, dy: -9, rot: -0.45, ox: 0.5, oy: 0.5 },
  compoundbow: { dx: -5, dy: -8, rot: -0.5, ox: 0.5, oy: 0.5 },
  crossbow: { dx: -4, dy: -8, rot: -0.8, ox: 0.5, oy: 0.5 },
  repeater: { dx: -4, dy: -8, rot: -0.8, ox: 0.5, oy: 0.5 },
  rapier: { dx: -5, dy: -14, rot: PI + 0.3 },
  scimitar: { dx: -5, dy: -13, rot: PI + 0.35 },
  flail: { dx: -3, dy: -2, rot: -0.35 },
  throwaxes: { dx: -3, dy: -2, rot: -0.35 },
  // short weapons at the belt (the shield hangs on the back under the weapon)
  dagger: { dx: -2, dy: -5, rot: PI + 0.7 },
  throwknives: { dx: -2, dy: -5, rot: PI + 0.7 },
  handcrossbow: { dx: -3, dy: -3, rot: -0.6, ox: 0.5, oy: 0.5 },
  wand: { dx: -3, dy: -1, rot: -0.5 },
  scepter: { dx: -3, dy: -1, rot: -0.5 },
  knuckle: { dx: 5, dy: -2, rot: 0.5, alpha: 0 },
  claws: { dx: 5, dy: -2, rot: 0.5, alpha: 0 },
  shield: { dx: -6, dy: -8, rot: 0.1, ox: 0.5, oy: 0.5, depth: -0.7 },
  orb: { dx: -5, dy: -8, rot: 0, ox: 0.5, oy: 0.5, alpha: 0 },
};
// the second weapon of a pair crosses the first one
const SHEATH_OFF: Record<string, Sheath> = {
  dagger: { dx: -1, dy: -5, rot: PI + 0.4, depth: -0.5 },
  throwknives: { dx: -1, dy: -5, rot: PI + 0.4, depth: -0.5 },
  axe: { dx: -5, dy: -2, rot: 0.45, depth: -0.5 },
  throwaxes: { dx: -5, dy: -2, rot: 0.45, depth: -0.5 },
  flail: { dx: -5, dy: -2, rot: 0.45, depth: -0.5 },
  rapier: { dx: -3, dy: -14, rot: PI - 0.3, depth: -0.5 },
  scimitar: { dx: -3, dy: -13, rot: PI - 0.35, depth: -0.5 },
  handcrossbow: { dx: 3, dy: -3, rot: 0.6, ox: 0.5, oy: 0.5, depth: -0.5 },
  knuckle: { dx: -5, dy: -2, rot: -0.5, alpha: 0 },
  claws: { dx: -5, dy: -2, rot: -0.5, alpha: 0 },
};
const FIDGETS = ['_scratch', '_look', '_stretch'];

interface Placement {
  x: number;
  y: number;
  rot: number;
  ox: number;
  oy: number;
  depth: number;
}

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
  // unique powers: stacks and timers
  lustN = 0;
  lustT = 0;
  /** the frenzy bonus: stacks of attack speed from hits in a row */
  frenzyN = 0;
  frenzyT = 0;
  cheatT = 0;
  windT = 0;
  roarT = 0;
  private atkCount = 0;
  private stormT = 1;
  private wolvesT = 3;
  private starT = 4;
  private frostT = 0.5;
  private trailT = 0.3;
  private thornT = 1;
  private bladeA = 0;
  private bladeTick = 0;
  bladeFx: Phaser.GameObjects.Image[] = [];
  orbitTick = 0;
  vampTick = 0;
  hurtT = 0;
  moving = false;
  // weapon in hand in combat, put away 5–10 s after it; idle blinks and fidgets
  armed = false;
  /** 0 = put away .. 1 = in hand */
  armT = 0;
  calmT = 99;
  sheatheAfter = 7;
  idleT = 0;
  fidgetAt = 5;
  blinkAt = 2;
  lastFidget = '';
  threatT = 0;
  private animDt = 0;

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
      this.weapon = this.scene.add.image(this.x, this.y, key).setOrigin(0.5, 0.85).setScale(WEAPON_SCALE);
    }
    const off = this.save.equip.off;
    if (off) {
      const key = `wp_${off.base}_t${itemTier(off)}`;
      this.offhand = this.scene.add.image(this.x, this.y, key).setOrigin(0.5, off.base === 'shield' || off.base === 'orb' ? 0.5 : 0.85).setScale(WEAPON_SCALE);
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

  /** a monster's curse: works like a buff with bad numbers */
  addCurse(id: string, name: string, mods: BuffMods, dur: number, color: number, glyph: string) {
    this.addBuff(id, name, mods, dur, color);
    const b = this.buffs.find((x) => x.id === id);
    if (b) {
      b.debuff = true;
      b.glyph = glyph;
    }
    bus.emit('buffs');
  }

  /** life and mana stolen by blows: at most LEECH_CAP % of the maximum per second (no immortal vampires) */
  leechHp = 0;
  leechMp = 0;

  leech(hp: number, mp: number) {
    if (this.dead) return;
    if (hp > 0) {
      const got = Math.min(hp, this.leechHp);
      this.leechHp -= got;
      this.heal(got, false);
    }
    if (mp > 0) {
      const got = Math.min(mp, this.leechMp);
      this.leechMp -= got;
      this.mp = Math.min(this.d.maxMp, this.mp + got);
    }
  }

  heal(amount: number, show = true) {
    if (this.dead || amount <= 0) return;
    // a curse of decay halves healing
    const cut = this.buffs.reduce((a, b) => a + (b.mods.healCut ?? 0), 0);
    if (cut > 0) amount *= Math.max(0.1, 1 - cut / 100);
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
    // spell buffs and shrine blessings
    const regenPct = [...this.buffs, ...this.scene.shrineBuffs].reduce((a, b) => a + (b.mods.regenPct ?? 0), 0);
    // a curse of madness stops the natural regeneration (blessings still heal)
    const natural = this.d.specials.has('noRegen') ? 0 : this.d.hpRegen * (this.calmT > 4 && this.d.specials.has('calmRegen') ? 3 : 1);
    // a floor without healing: no regeneration of health at all
    if (!this.scene.mod?.noHeal) this.hp = Math.min(this.d.maxHp, this.hp + (natural + (this.d.maxHp * regenPct) / 100) * dt);
    this.mp = Math.min(this.d.maxMp, this.mp + this.d.mpRegen * dt);
    // the leech allowance refills every second
    this.leechHp = Math.min((this.d.maxHp * LEECH_CAP.hp) / 100, this.leechHp + ((this.d.maxHp * LEECH_CAP.hp) / 100) * dt);
    this.leechMp = Math.min((this.d.maxMp * LEECH_CAP.mp) / 100, this.leechMp + ((this.d.maxMp * LEECH_CAP.mp) / 100) * dt);

    // timers of the unique powers
    if (this.lustT > 0) this.lustT -= dt;
    if (this.frenzyT > 0) {
      this.frenzyT -= dt;
      if (this.frenzyT <= 0) this.frenzyN = 0;
    }
    if (this.cheatT > 0) this.cheatT -= dt;
    if (this.windT > 0) this.windT -= dt;
    if (this.roarT > 0) this.roarT -= dt;
    // cooldowns (timeWarp: they run faster)
    const cdRate = 1 + this.buffs.reduce((a, b) => a + (b.mods.cdrRate ?? 0), 0) + (this.d.specials.has('timeWarp') ? 0.25 : 0);
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
    this.combatTick(dt);
    this.animDt = dt;
    this.syncSprite(this.moving);
    this.updateWeaponSprites(dt);
    if (this.shieldFx) {
      this.shieldFx.setPosition(this.x, this.y - 6);
      this.shieldFx.setAlpha(this.shield > 0 ? 0.35 + Math.sin(sc.time.now / 150) * 0.08 : this.invulnT > 0 ? 0.5 : 0);
      this.shieldFx.setTint(this.invulnT > 0 ? 0xfff2a8 : 0x7fb2ff);
    }
  }

  /** something happened in a fight: draw the weapon (it is put away again after 5–10 calm seconds) */
  combatPing() {
    this.calmT = 0;
    this.idleT = 0;
    if (this.armed) return;
    this.armed = true;
    this.sheatheAfter = 5 + Math.random() * 5;
    if (this.weapon || this.offhand) sfx('unsheathe');
  }

  private threatNear(r: number) {
    for (const e of this.scene.enemies) {
      if (e.dead || !e.aggro) continue;
      const dx = e.x - this.x,
        dy = e.y - this.y;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  private combatTick(dt: number) {
    this.threatT -= dt;
    if (this.threatT <= 0) {
      this.threatT = 0.2;
      // a target in reach or a monster closing in: the weapon comes out before it arrives
      if (this.target || this.threatNear(110)) this.combatPing();
    }
    this.calmT += dt;
    if (this.armed && this.calmT > this.sheatheAfter && this.swinging <= 0) {
      this.armed = false;
      if (this.weapon || this.offhand) sfx('sheathe');
    }
    this.stepArm(dt);
  }

  /** the weapon travels to the hand (quick) or back (a bit slower) */
  private stepArm(dt: number) {
    if (!this.weapon && !this.offhand) this.armT = this.armed ? 1 : 0;
    else this.armT = Phaser.Math.Clamp(this.armT + (this.armed ? dt / 0.24 : -dt / 0.42), 0, 1);
  }

  /** the hero is moved by a scene script (walking the stairs): only animate and keep the weapons in place */
  scriptedTick(dt: number, moving: boolean) {
    this.animDt = dt;
    this.stepArm(dt);
    this.syncSprite(moving);
    this.updateWeaponSprites(dt);
  }

  /** current frame of the hero strip */
  private frameIndex(): number {
    const n = this.sprite.frame?.name as unknown;
    return typeof n === 'number' ? n : parseInt(String(n), 10) || 0;
  }

  protected chooseAnim(moving: boolean) {
    const k = this.spriteKey;
    const s = this.sprite;
    const cur = s.anims.currentAnim?.key ?? '';
    const dt = this.animDt;
    const armedPose = this.armT >= 0.5;
    this.blinkAt -= dt;
    let want: string;
    if (moving) {
      this.idleT = 0;
      this.blinkAt = Math.max(this.blinkAt, 0.8);
      want = armedPose ? '_walkA' : '_walk';
    } else if (this.armT > 0 && this.armT < 1) {
      // reaching over the shoulder for the weapon (or putting it back)
      s.anims.stop();
      s.setFrame(HERO_FRAMES.reach + (this.armT > 0.22 && this.armT < 0.82 ? 1 : 0));
      return;
    } else {
      // standing: breathe, blink now and then; without a weapon in hand also scratch the head, look around, stretch
      const running = s.anims.isPlaying && s.anims.currentAnim?.repeat === 0;
      if (running && (armedPose ? cur === k + '_blinkA' : cur !== k + '_blinkA' && cur.startsWith(k + '_'))) return;
      want = armedPose ? '_idleA' : '_idle';
      if (armedPose) this.idleT = 0;
      else this.idleT += dt;
      if (!armedPose && this.idleT > this.fidgetAt) {
        this.idleT = 0;
        this.fidgetAt = 6 + Math.random() * 7;
        let f = FIDGETS[Math.floor(Math.random() * FIDGETS.length)];
        if (f === this.lastFidget) f = FIDGETS[(FIDGETS.indexOf(f) + 1) % FIDGETS.length];
        this.lastFidget = f;
        want = f;
        this.blinkAt = Math.max(this.blinkAt, 1.5);
      } else if (this.blinkAt <= 0) {
        this.blinkAt = 2.2 + Math.random() * 3.5;
        want = armedPose ? '_blinkA' : '_blink';
      }
    }
    want = k + want;
    if (cur !== want || !s.anims.isPlaying) s.play(want, true);
  }

  specialsTick(dt: number) {
    const sc = this.scene;
    this.powersTick(dt);
    // nova pulse buff (Avatar války)
    // (and the storm shrine: a lightning pulse)
    const pulse = this.buffs.find((b) => b.mods.novaPulse) ?? sc.shrineBuffs.find((b) => b.mods.novaPulse);
    if (pulse) {
      this.novaPulseT -= dt;
      if (this.novaPulseT <= 0) {
        this.novaPulseT = 1;
        const storm = !this.buffs.some((b) => b.mods.novaPulse);
        sc.spells.nova(this.x, this.y, 60, this.weaponHit() * (pulse.mods.novaPulse ?? 1), storm ? 'lightning' : 'phys', {});
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

  /** the stronger of the hero's blows and spells (for powers that do not care which) */
  powerHit() {
    return Math.max(this.weaponHit(), this.spellBase());
  }

  /** the periodic unique powers: lightning, wolves, falling stars, frost, a burning trail, orbiting blades */
  private powersTick(dt: number) {
    const sc = this.scene;
    const s = this.d.specials;
    if (s.has('stormAura')) {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = 1;
        const e = sc.nearestEnemy(this.x, this.y, 100, true);
        if (e) sc.spells.chain(this.x, this.y - 8, 1, this.powerHit() * 0.5, 'lightning', new Set(), e);
      }
    }
    if (s.has('spiritWolves')) {
      this.wolvesT -= dt;
      if (this.wolvesT <= 0 && sc.nearestEnemy(this.x, this.y, 150, true)) {
        this.wolvesT = 15;
        for (let i = 0; i < 2; i++) {
          const spot = sc.map.randomFloorNear(this.x, this.y, 20) ?? [this.x, this.y];
          sc.addAlly('spiritWolf', spot[0], spot[1], this.d.maxHp * 0.3, this.weaponHit() * 0.5, 10);
        }
        sfx('summon');
      }
    }
    if (s.has('starfall')) {
      this.starT -= dt;
      if (this.starT <= 0) {
        const near = sc.enemiesNear(this.x, this.y, 130).filter((e) => !e.dead).slice(0, 4);
        if (near.length) {
          this.starT = 8;
          near.forEach((e, i) => {
            const x = e.x,
              y = e.y;
            sc.time.delayedCall(150 * i, () => {
              sc.fx.beam(x + 20, y - 120, x, y - 4, 0xfff2a8, 3, 200);
              sc.spells.explosion(x, y, 22, this.powerHit() * 1.2, 'holy', {});
            });
          });
        } else this.starT = 1;
      }
    }
    if (s.has('frostAura')) {
      this.frostT -= dt;
      if (this.frostT <= 0) {
        this.frostT = 0.5;
        for (const e of sc.enemiesNear(this.x, this.y, 40)) {
          e.st.slowT = Math.max(e.st.slowT, 1);
          e.st.slowMult = e.boss ? 0.75 : 0.5;
          sc.combat.damageEnemy(e, this.powerHit() * 0.12, { el: 'ice', silent: true, noCrit: true });
        }
      }
    }
    // a thorn aura: whoever stands right next to the hero gets the thorns every second
    if (s.has('thornAura') && (this.d.thorns > 0 || this.d.thornsPct > 0)) {
      this.thornT -= dt;
      if (this.thornT <= 0) {
        this.thornT = 1;
        const dmg = (this.d.thorns + this.d.maxHp * 0.02 * (this.d.thornsPct / 25)) * (s.has('thornArmor') ? 1 + this.d.armor / 400 : 1);
        for (const e of sc.enemiesNear(this.x, this.y, 26)) sc.combat.damageEnemy(e, dmg, { el: 'phys', noCrit: true, thorns: true });
      }
    }
    if (s.has('fireTrail') && this.moving) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.35;
        sc.spells.addField(this.x, this.y + 2, 14, this.powerHit() * 0.6, 'fire', 2.2, false, { t: 'field' } as any);
      }
    }
    // three ghostly blades circle the hero and cut what they touch
    const want = s.has('orbitBlades') ? 3 : 0;
    while (this.bladeFx.length > want) this.bladeFx.pop()!.destroy();
    while (this.bladeFx.length < want) this.bladeFx.push(sc.add.image(this.x, this.y, 'wp_dagger_t3').setScale(ACTOR_SCALE).setDepth(D.bright).setAlpha(0.85).setTint(0xc8d8ff));
    if (want) {
      this.bladeA += dt * 3.2;
      this.bladeTick -= dt;
      this.bladeFx.forEach((b, i) => {
        const a = this.bladeA + (i * Math.PI * 2) / want;
        b.setPosition(this.x + Math.cos(a) * 22, this.y - 6 + Math.sin(a) * 15).setRotation(a + Math.PI);
        if (this.bladeTick <= 0) for (const e of sc.enemiesNear(b.x, b.y + 6, 10)) sc.combat.damageEnemy(e, this.weaponHit() * 0.35, { el: 'phys', silent: true });
      });
      if (this.bladeTick <= 0) this.bladeTick = 0.3;
    }
  }

  /** a hit with the frenzy bonus: one more stack of attack speed (up to ten) */
  frenzyHit() {
    this.frenzyT = 3;
    if (this.frenzyN >= 10) {
      const b = this.buffs.find((x) => x.id === 'frenzy');
      if (b) b.t = 3;
      return;
    }
    this.frenzyN++;
    this.buffs = this.buffs.filter((b) => b.id !== 'frenzy');
    this.addBuff('frenzy', `Šílenství ×${this.frenzyN}`, { atkSpdPct: 2 * this.frenzyN }, 3, 0xffa04a);
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
    // the frenzy curse: every attack burns a little mana
    if (this.d.specials.has('manaBurn')) this.mp = Math.max(0, this.mp - this.d.maxMp * 0.02);
    // attacking always happens with the weapon in hand
    this.combatPing();
    this.armT = 1;
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
    // unique powers on attacks: a whirl every fourth swing, a ghostly echo of the blow
    this.atkCount++;
    if (this.d.specials.has('whirl') && this.atkCount % 4 === 0) sc.time.delayedCall(90, () => !this.dead && sc.spells.nova(this.x, this.y, 42, this.weaponHit() * 1.3, 'phys', { knock: 30 }, 0xe8e0d0));
    if (this.d.specials.has('echoStrike')) {
      sc.time.delayedCall(380, () => {
        if (this.dead || t.dead || Math.hypot(t.x - this.x, t.y - this.y) > this.d.range * 1.6 + 20) return;
        sc.fx.slash(t.x, t.y - 6, Math.atan2(t.y - this.y, t.x - this.x), 12, 0xb8a8ff, 100);
        sc.combat.damageEnemy(t, this.weaponHit() * 0.5, { el: 'shadow' });
      });
    }
    if (kind === 'melee') {
      sfx('swing');
      const arc = (this.d.arc * Math.PI) / 180;
      const range = this.d.range;
      const knock = 60 * (base?.knock ?? 1);
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
          sc.combat.attackHit(e, Math.cos(this.aim) * knock, Math.sin(this.aim) * knock);
          hits++;
        }
        if (hits) sfx('hit');
      });
    } else {
      // shots: a fan of several at once (compound bow, throwing knives, the crook), a burst one after
      // another (repeater), shots that fly through foes, bolts that jump on, holy shots that seek
      const magic = kind === 'magic';
      const n = (base?.shots ?? 1) + (this.d.specials.has('extraProjectile') ? 1 : 0);
      const mult = base && (base.shots || base.burst) ? (base.shotDmg ?? 1) : 1;
      const spread = magic ? 0.15 : base?.shots ? 0.1 : 0.12;
      const spr = base?.proj ?? (magic ? 'pr_magic' : 'pr_arrow');
      const sp = this.d.specials;
      const opts = { mult, chain: base?.chain ?? 0, homing: !!base?.homing || sp.has('homingShots'), fx: SHOT_FX[spr] ?? 0xffffff };
      const pierce = (base?.pierce ?? 0) + (sp.has('pierceShots') ? 1 : 0);
      const volley = () => {
        const tt = !t.dead ? t : this.target && !this.target.dead ? this.target : null;
        if (!tt) return;
        sfx(magic ? 'magic' : 'bow');
        for (let i = 0; i < n; i++) {
          const a = this.aim + (i - (n - 1) / 2) * spread;
          const [sx, sy] = this.shotOrigin(tt, a, magic ? 8 : 6);
          sc.spawnPlayerAttackProjectile(sx, sy, a, spr, pierce, opts);
        }
        if (magic) sc.fx.burst(this.x + Math.cos(this.aim) * 8, this.y - 10, opts.fx === 0xffffff ? 0xc77dff : opts.fx, 4);
      };
      volley();
      for (let k = 1; k < (base?.burst ?? 1); k++) sc.time.delayedCall(k * 110, () => !this.dead && volley());
    }
  }

  updateWeaponSprites(dt: number) {
    const f = this.facing;
    const depth = this.sprite.depth;
    const kind = this.d.attack;
    if (this.swinging > 0) this.swinging -= dt;
    const swingP = this.swinging > 0 ? 1 - this.swinging / 0.18 : 1;
    const baseKey = this.save.equip.main?.base ?? '';
    const arc = (this.d.arc * Math.PI) / 180;
    // the hands follow the animation frame (the combat stance while the weapon travels to or from the back)
    const fr = this.armT >= 1 ? this.frameIndex() : HERO_FRAMES.idleA;
    const [fhx, fhy] = heroHand(fr);
    const [bhx, bhy] = heroHandB(fr);
    const rest = heroHand(HERO_FRAMES.idleA)[1];
    const ax = this.sprite.x,
      ay = this.sprite.y;
    const hx = ax + fhx * ACTOR_SCALE * f,
      hy = ay + fhy * ACTOR_SCALE;
    const bob = (fhy - rest) * ACTOR_SCALE;
    // 0 = on the back / at the belt .. 1 = in hand
    const w = Phaser.Math.Clamp((this.armT - 0.2) / 0.62, 0, 1);
    const e = w * w * (3 - 2 * w);
    if (this.weapon) {
      const p: Placement = { x: hx, y: hy + 2, rot: 0, ox: 0.5, oy: 0.85, depth: depth + (f > 0 ? 0.5 : -0.5) + (this.swinging > 0 ? 1 : 0) };
      if (kind === 'ranged') {
        const a = this.target ? this.aim : f > 0 ? 0 : Math.PI;
        // a bow is held across the line of the shot, a crossbow or a throwing weapon points along it
        p.rot = isBow(baseKey) ? a : a + Math.PI / 2;
        p.ox = 0.3;
        p.oy = 0.5;
        p.x = this.x + Math.cos(a) * 4;
        p.y = this.y - 6 + Math.sin(a) * 3 + bob;
        this.weapon.setScale((this.swinging > 0 ? 0.85 + 0.15 * swingP : 1) * WEAPON_SCALE, WEAPON_SCALE);
        this.weapon.setFlipX(false);
      } else if (kind === 'magic') {
        const a = this.target ? this.aim : -Math.PI / 2 + 0.3 * f;
        p.rot = this.swinging > 0 ? a + Math.PI / 2 : 0.25 * f;
      } else {
        // melee
        if (this.swinging > 0 && this.swingHand === 0) {
          const start = this.aim - arc / 2,
            end = this.aim + arc / 2;
          const a = f > 0 ? start + (end - start) * swingP : end - (end - start) * swingP;
          p.rot = a + Math.PI / 2;
          p.x = this.x + Math.cos(this.aim) * 2;
          p.y = this.y - 5 + Math.sin(this.aim) * 2;
        } else p.rot = 0.5 * f;
        if (BASE_BY_ID[baseKey]?.thrust && this.swinging > 0 && this.swingHand === 0) {
          p.rot = this.aim + Math.PI / 2;
          const thrust = Math.sin(swingP * Math.PI) * 10;
          p.x = this.x + Math.cos(this.aim) * (2 + thrust);
          p.y = this.y - 5 + Math.sin(this.aim) * (2 + thrust);
        }
      }
      this.place(this.weapon, p, SHEATH[baseKey], e, -0.6);
    }
    if (this.offhand) {
      const offBase = this.save.equip.off!.base;
      const ox = ax + bhx * ACTOR_SCALE * f,
        oy = ay + bhy * ACTOR_SCALE;
      const p: Placement = { x: ox, y: oy, rot: 0, ox: 0.5, oy: 0.5, depth: depth + 0.6 };
      if (offBase === 'shield') {
        this.offhand.setScale(0.9 * WEAPON_SCALE);
      } else if (offBase === 'orb') {
        p.y = oy - 4 + Math.sin(this.scene.time.now / 300) * 1.5;
      } else {
        // second weapon
        p.oy = 0.85;
        p.rot = -0.5 * f;
        p.y = oy + 2;
        if (this.swinging > 0 && this.swingHand === 1) {
          const start = this.aim + arc / 2,
            end = this.aim - arc / 2;
          p.rot = start + (end - start) * swingP + Math.PI / 2;
          p.x = this.x + Math.cos(this.aim) * 2;
          p.y = this.y - 5 + Math.sin(this.aim) * 2;
        }
        p.depth = depth + (f > 0 ? -0.6 : 0.6) + (this.swinging > 0 && this.swingHand === 1 ? 2 : 0);
      }
      const pair = offBase === baseKey ? SHEATH_OFF[offBase] : undefined;
      this.place(this.offhand, p, pair ?? SHEATH[offBase], e, -0.5);
    }
  }

  /** puts a weapon sprite between its place on the back (e = 0) and its place in the hand (e = 1) */
  private place(img: Phaser.GameObjects.Image, held: Placement, sh: Sheath | undefined, e: number, behind: number) {
    let { x, y, rot, ox, oy, depth } = held;
    let alpha = 1;
    if (sh && e < 1) {
      const f = this.facing;
      const sx = this.sprite.x + sh.dx * f,
        sy = this.sprite.y - 3 + sh.dy;
      const srot = sh.rot * f;
      x = sx + (x - sx) * e;
      y = sy + (y - sy) * e;
      rot = srot + Phaser.Math.Angle.Wrap(rot - srot) * e;
      ox = (sh.ox ?? 0.5) + (ox - (sh.ox ?? 0.5)) * e;
      oy = (sh.oy ?? 0.85) + (oy - (sh.oy ?? 0.85)) * e;
      if (e < 0.5) depth = this.sprite.depth + (sh.depth ?? behind);
      alpha = (sh.alpha ?? 1) + (1 - (sh.alpha ?? 1)) * e;
    }
    img.setOrigin(ox, oy);
    img.setPosition(x, y);
    img.setRotation(rot);
    img.setDepth(depth);
    img.setAlpha(alpha * this.sprite.alpha);
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
