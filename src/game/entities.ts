import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { D, EL_COLOR } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { TS } from './map';
import { EnemyDef, BossDef, BossPattern, StoryBossDef, enemyHpScale, enemyDmgScale, enemyXpScale, enemyArmor, bossArmor, bossBaseStats, storyBossBase, PRIORITY_ROLES, corruptName } from '../data/enemies';
import type { PowerState } from './powers';
import { sfx } from '../systems/audio';
import { ArenaKind, BOSS_PHASE_HP } from '../data/bossphases';
import type { Nemesis } from '../data/nemesis';
import { Element } from '../data/types';

/** champion traits: what they do is in Enemy.affixTick (and a few in combat); each glows its own colour */
export const ELITE_AFFIXES: Record<string, { glow: number; desc: string; min: number }> = {
  rychlý: { glow: 0xffe45c, desc: 'rychle se pohybuje a útočí', min: 1 },
  obrněný: { glow: 0x9aa8b8, desc: 'má silné brnění', min: 1 },
  upíří: { glow: 0xff3b5a, desc: 'léčí se z úderů', min: 1 },
  výbušný: { glow: 0xff7a2a, desc: 'po smrti vybuchne', min: 1 },
  mrazivý: { glow: 0x7fd8ff, desc: 'zpomaluje údery', min: 1 },
  ohnivý: { glow: 0xff4a10, desc: 'nechává za sebou hořící zem', min: 4 },
  elektrický: { glow: 0xfff27a, desc: 'metá blesky', min: 4 },
  léčitel: { glow: 0x52ff8f, desc: 'léčí nestvůry kolem sebe', min: 4 },
  teleportér: { glow: 0xb07dff, desc: 'přeskakuje k hrdinovi', min: 4 },
  vyvolávač: { glow: 0x7bd88f, desc: 'povolává pomocníky', min: 4 },
  // deeper down
  zuřivý: { glow: 0xff3a1a, desc: 'při polovině zdraví se rozzuří', min: 8 },
  jedovatý: { glow: 0x7be05a, desc: 'nechává za sebou jedovatý mrak', min: 10 },
  štítonoš: { glow: 0x7fb2ff, desc: 'chrání se štítem ze světla', min: 15 },
  magnetický: { glow: 0xc77dff, desc: 'přitahuje hrdinu k sobě', min: 20 },
  zrcadlový: { glow: 0xe8e8ff, desc: 'vrací část poškození útočníkovi', min: 25 },
  nesmrtelný: { glow: 0xfff2a8, desc: 'jednou vstane z mrtvých', min: 30 },
};
const AFFIX_IDS = Object.keys(ELITE_AFFIXES);

/** how many traits a champion has: one near the surface, two and then three deeper down */
export function affixCount(floor: number, rnd = Math.random) {
  if (floor < 25) return 1;
  if (floor < 60) return rnd() < 0.4 ? 2 : 1;
  if (floor < 120) return rnd() < 0.3 ? 3 : 2;
  return 3;
}

let nextId = 1;

// seconds a spotted treasure goblin stays before escaping
export const THIEF_ESCAPE = 18;

export interface Status {
  slowT: number;
  slowMult: number;
  stunT: number;
  burnT: number;
  burnDps: number;
  poisonT: number;
  poisonDps: number;
  vulnT: number;
  vuln: number;
  bleedT: number;
  bleedDps: number;
}

function newStatus(): Status {
  return { slowT: 0, slowMult: 1, stunT: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, vulnT: 0, vuln: 0, bleedT: 0, bleedDps: 0 };
}

export abstract class Actor {
  id = nextId++;
  scene: GameScene;
  x: number;
  y: number;
  r = 4;
  hp = 1;
  maxHp = 1;
  dead = false;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  st: Status = newStatus();
  facing = 1;
  vx = 0;
  vy = 0;
  knockX = 0;
  knockY = 0;
  flying = false;
  spriteKey: string;
  animated: 'humanoid' | 'loop' | 'static';
  baseScale = 1;
  dotTick = 0;
  /** height above the ground (a leap) */
  hop = 0;

  constructor(scene: GameScene, x: number, y: number, key: string) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.spriteKey = key;
    this.shadow = scene.add.image(x, y + 3, 'shadow').setDepth(D.floorDeco + 2);
    this.sprite = scene.add.sprite(x, y + 3, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE);
    const tex = scene.textures.get(key);
    const frames = tex.frameTotal - 1;
    this.animated = frames >= 6 ? 'humanoid' : frames >= 2 ? 'loop' : 'static';
    if (this.animated === 'loop') this.sprite.play(key + '_loop');
    if (this.animated === 'humanoid') this.sprite.play(key + '_idle');
  }

  setScale(s: number) {
    this.baseScale = s;
    // actor textures have double resolution (see ACTOR_SCALE)
    this.sprite.setScale(s * ACTOR_SCALE);
    this.shadow.setScale(s * ((this.sprite.width * ACTOR_SCALE) / 14));
  }

  get stunned() {
    return this.st.stunT > 0;
  }

  /** a monster's blow lands on this actor (allies and the mercenary take it; the hero goes through Combat) */
  takeDamage(_amount: number) {}

  get speedMult() {
    return this.st.slowT > 0 ? this.st.slowMult : 1;
  }

  updateStatus(dt: number) {
    const s = this.st;
    if (s.slowT > 0) s.slowT -= dt;
    if (s.stunT > 0) s.stunT -= dt;
    if (s.vulnT > 0) s.vulnT -= dt;
    this.dotTick += dt;
    if (this.dotTick >= 0.5) {
      this.dotTick -= 0.5;
      let dot = 0;
      if (s.burnT > 0) {
        s.burnT -= 0.5;
        dot += s.burnDps * 0.5;
      }
      if (s.poisonT > 0) {
        s.poisonT -= 0.5;
        dot += s.poisonDps * 0.5;
      }
      if (s.bleedT > 0) {
        s.bleedT -= 0.5;
        dot += s.bleedDps * 0.5;
      }
      if (dot > 0) this.onDot(dot);
    }
  }

  onDot(_amount: number) {}

  syncSprite(moving: boolean) {
    const kx = this.knockX,
      ky = this.knockY;
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + 3) - (this.flying ? 4 : 0) - Math.round(this.hop));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y + 3));
    this.sprite.setDepth(D.entityBase + this.y + (this.flying ? 20 : 0));
    this.sprite.setFlipX(this.facing < 0);
    if (this.animated === 'humanoid') this.chooseAnim(moving);
    void kx;
    void ky;
  }

  protected chooseAnim(moving: boolean) {
    const want = moving ? this.spriteKey + '_walk' : this.spriteKey + '_idle';
    if (this.sprite.anims.currentAnim?.key !== want) this.sprite.play(want, true);
  }

  destroyVisuals() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

// ---------------------------------------------------------------------------
// ENEMY
// ---------------------------------------------------------------------------
export class Enemy extends Actor {
  def: EnemyDef;
  dmg: number;
  speed: number;
  xp: number;
  armor: number;
  elite: boolean;
  eliteAffix: string | null = null;
  boss: BossDef | null = null;
  bossTier = 0;
  aggro = false;
  atkT = 0;
  windup = 0;
  wanderT = 0;
  wanderDir: [number, number] = [0, 0];
  roomId: number;
  hpBarT = 0;
  summonT = 4;
  erraticT = 0;
  chargeT = 0;
  charging = 0;
  chargeDir: [number, number] = [0, 0];
  isMinion = false;
  // story guardian: its definition, the current stage and whether it is between stages (untouchable)
  story: StoryBossDef | null = null;
  phase = 0;
  invuln = false;
  // damage budget of a story guardian (see Combat.damageEnemy)
  capBudget = 0;
  capT = 0;
  // boss state
  patternIdx = 0;
  patternT = 3;
  enraged = false;
  /** the attacks in the guardian's rotation (it learns more in its second phase) */
  patterns: BossPattern[] = [];
  /** how many of the 70/40/10 % phase marks the guardian has passed */
  bphase = 0;
  /** what the arena does from the third phase on */
  arena: ArenaKind | null = null;
  arenaT = 0;
  /** the last 10 %: faster, angrier */
  lastStand = false;
  name: string;
  hitFlash = 0;
  nameLabel: Phaser.GameObjects.Text | null = null;
  homeX: number;
  homeY: number;
  baseTint: number | null = null;
  // treasure goblin: seconds left before it escapes, side-step timer when cornered
  escapeT = 0;
  restT = 2.5;
  spotted = false;
  dodgeT = 0;
  sparkT = 0;
  /** the champion's traits (one, or a combination deeper down) and each trait's timer */
  affixes: string[] = [];
  affTimers: Record<string, number> = {};
  /** a champion's shield of light, the one rise from the dead, the frenzy at half health */
  shieldHp = 0;
  shieldT = 0;
  revived = false;
  frenzied = false;
  /** the champion that summoned this one (summoners keep at most a few) */
  summoner: Enemy | null = null;
  /** a named champion that once killed the hero */
  nemesis: Nemesis | null = null;
  /** seconds it must keep attacking the mercenary who taunted it */
  tauntT = 0;
  /** a wandering adventurer who chose to fight the hero */
  rivalFoe = false;
  /** side in a brawl between two packs (0 = none) and whether the hero joined in against it */
  faction = 0;
  heroHit = false;
  /** what an event made of this monster (a captive's guard, a ghost's murderer, an arena fighter …) */
  tag: string | null = null;
  /** what its special power is doing (see Powers) */
  pw: PowerState = {};
  /** a dark priest's blessing and a time mage's haste (seconds left) */
  blessT = 0;
  hasteT = 0;
  /** an illusionist's copy (any touch breaks it, it gives nothing) and the illusionist */
  illusion = false;
  master: Enemy | null = null;
  /** raised by a necromancer (it falls to dust for good) */
  risen = false;
  /** a corrupted monster: rare, black and purple, far stronger, rich loot */
  corrupt = false;
  /** a shield of mana over the health (a second bar) */
  mshield = 0;
  mshieldMax = 0;
  /** what made a mutated ghoul different */
  mutation: string | null = null;
  /** corpses a hungry ghoul has eaten */
  fed = 0;
  /** a sniper's aim: seconds left and the direction */
  aimT = 0;
  aimA = 0;
  /** a leap through the air (ghouls) */
  leap: { t: number; dur: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  leapCd = 1;
  leapPending = false;
  /** a lurker hidden inside a wall, out of reach */
  inWall = false;
  /** which way a monster backing away slides */
  strafe = 1;
  strafeT = 0;
  /** the sign above a pack member the hero should kill first */
  roleIcon: Phaser.GameObjects.Image | null = null;
  /** the dark pool under a corrupted monster and the timer of its wisps */
  aura: Phaser.GameObjects.Image | null = null;
  wispT = 0;

  /** speed and attack rate: blessed, hastened or fed on a stolen buff */
  get haste() {
    return (this.hasteT > 0 ? 1.4 : 1) * (this.blessT > 0 ? 1.25 : 1) * (this.pw.stolen ? 1.25 : 1);
  }

  /** damage of its blows: blessed or fed on a stolen buff */
  get might() {
    return (this.blessT > 0 ? 1.35 : 1) * (this.pw.stolen ? 1.4 : 1);
  }

  constructor(scene: GameScene, def: EnemyDef, x: number, y: number, floor: number, elite: boolean, roomId: number, affix?: string | null) {
    super(scene, x, y, def.sprite);
    this.def = def;
    this.roomId = roomId;
    this.elite = elite;
    this.homeX = x;
    this.homeY = y;
    const hs = enemyHpScale(floor),
      ds = enemyDmgScale(floor);
    // difficulty: tougher and quicker monsters (their damage is scaled where it hits the hero);
    // the treasure goblin stays catchable on every difficulty
    const dif = scene.diff;
    const dhp = def.behavior === 'thief' ? 1 : dif?.enemyHp ?? 1;
    this.maxHp = Math.round(def.hp * hs * (elite ? 3.2 : 1) * dhp);
    this.hp = this.maxHp;
    this.dmg = def.dmg * ds * (elite ? 1.5 : 1);
    this.speed = def.speed * (0.9 + Math.random() * 0.2) * (def.behavior === 'thief' ? 1 : dif?.enemySpeed ?? 1);
    this.xp = Math.round(def.xp * enemyXpScale(floor) * (elite ? 4 : 1));
    this.armor = enemyArmor(def.armor ?? 0, floor);
    this.r = def.radius ?? 5;
    this.name = def.name;
    this.flying = def.behavior === 'erratic' || def.behavior === 'ghost' || def.behavior === 'lurker';
    this.atkT = Math.random() * def.atkCd;
    let sc = def.scale ?? 1;
    if (elite) {
      sc *= 1.25;
      // traits come with depth: the first floors stay simple, deeper champions combine two or three
      const pool = AFFIX_IDS.filter((a) => ELITE_AFFIXES[a].min <= floor);
      const list = affix && ELITE_AFFIXES[affix] ? [affix] : [];
      const want = Math.max(list.length, affixCount(floor));
      while (list.length < want) {
        const free = pool.filter((a) => !list.includes(a));
        if (!free.length) break;
        list.push(free[Math.floor(Math.random() * free.length)]);
      }
      this.affixes = list;
      this.eliteAffix = list[0] ?? null;
      if (list.includes('rychlý')) this.speed *= 1.45;
      if (list.includes('obrněný')) this.armor = this.armor * 2 + 20;
      // every extra trait makes it tougher and worth more
      const extra = list.length - 1;
      this.maxHp = this.hp = Math.round(this.maxHp * (1 + extra * 0.25));
      this.xp = Math.round(this.xp * (1 + extra * 0.5));
      this.name = `${def.name} (${list.join(', ')})`;
      if (this.eliteAffix) this.sprite.preFX?.addGlow(ELITE_AFFIXES[this.eliteAffix].glow, extra ? 3 : 2, 0, false, 0.1, 12);
    }
    this.setScale(sc);
    if (def.behavior === 'mimic') this.aggro = true;
    if (def.behavior === 'thief') this.sprite.preFX?.addGlow(0xffd23a, 3, 0, false, 0.1, 16);
    if (def.role && PRIORITY_ROLES.includes(def.role) && scene.textures.exists('en_role_' + def.role)) this.roleIcon = scene.add.image(x, y, 'en_role_' + def.role).setScale(ACTOR_SCALE);
    scene.powers?.init(this);
  }

  /** a corrupted monster: five times the health, three random traits, black and purple, rich loot */
  makeCorrupt() {
    const sc = this.scene;
    const def = this.def;
    const floor = sc.floor;
    const dif = sc.diff;
    this.corrupt = true;
    this.elite = true;
    // three traits of any depth (a champion's undying rise and summoning stay out: five times the health is enough)
    const pool = AFFIX_IDS.filter((a) => a !== 'nesmrtelný' && a !== 'vyvolávač');
    const list: string[] = [];
    while (list.length < 3) {
      const a = pool[Math.floor(Math.random() * pool.length)];
      if (!list.includes(a)) list.push(a);
    }
    this.affixes = list;
    this.affTimers = {};
    this.eliteAffix = list[0];
    this.maxHp = this.hp = Math.round(def.hp * enemyHpScale(floor) * 5 * (dif?.enemyHp ?? 1));
    this.dmg = def.dmg * enemyDmgScale(floor) * 1.6;
    this.speed = def.speed * 1.1 * (dif?.enemySpeed ?? 1) * (list.includes('rychlý') ? 1.45 : 1);
    this.armor = enemyArmor(def.armor ?? 0, floor) * 1.5 + (list.includes('obrněný') ? 20 : 0);
    this.xp = Math.round(def.xp * enemyXpScale(floor) * 12);
    if (this.mshieldMax > 0) this.mshieldMax = this.mshield = this.maxHp * 0.8;
    this.name = `${corruptName(def)} (${list.join(', ')})`;
    this.setScale((def.scale ?? 1) * 1.4);
    this.baseTint = 0x9a6ac0;
    this.sprite.setTint(this.baseTint);
    this.sprite.preFX?.clear();
    this.sprite.preFX?.addGlow(0x9a2aff, 4, 0, false, 0.1, 14);
    this.aura = sc.add.image(this.x, this.y + 2, 'disc').setTint(0x4a0a8a).setAlpha(0.6).setScale((this.r * this.baseScale * 6) / 256, (this.r * this.baseScale * 3) / 256).setDepth(D.floorDeco + 3);
  }

  /** the corruption smokes around it */
  private corruptTick(dt: number) {
    const sc = this.scene;
    this.aura?.setPosition(this.x, this.y + 2);
    this.wispT -= dt;
    if (this.wispT <= 0) {
      this.wispT = 0.12;
      sc.fx.burst(this.x + (Math.random() - 0.5) * 12 * this.baseScale, this.y - 4 - Math.random() * 12 * this.baseScale, Math.random() < 0.55 ? 0x8a2aff : 0x1a0a2a, 1, 'puff');
    }
    if (!this.spotted && this.aggro) {
      this.spotted = true;
      sc.onCorruptSpotted(this);
    }
  }

  makeBoss(boss: BossDef, tier: number, floor: number) {
    this.boss = boss;
    this.bossTier = tier;
    // "ancient" guardians (second round of the boss cycle and later) are a bit tougher; the depth itself
    // already scales them, so the tier bonus stays small
    const tierMult = Math.pow(1.12, tier);
    // the first guardians are gentler – they are where new players learn to dodge
    const early = floor <= 10 ? 0.8 : floor <= 20 ? 0.9 : 1;
    const base = bossBaseStats(boss);
    const dif = this.scene.diff;
    this.maxHp = Math.round(base.hp * 0.5 * enemyHpScale(floor) * tierMult * early * (dif?.enemyHp ?? 1));
    this.hp = this.maxHp;
    this.dmg = base.dmg * enemyDmgScale(floor) * Math.pow(1.06, tier) * early;
    this.speed = boss.speed * (dif?.enemySpeed ?? 1);
    this.xp = Math.round(300 * enemyXpScale(floor) * (1 + tier));
    this.armor = bossArmor(floor);
    this.r = 10;
    this.patterns = [...boss.patterns];
    this.name = (tier > 0 ? 'Prastarý ' : '') + boss.name;
    this.setScale(boss.scale);
    if (boss.tint) this.sprite.setTint(boss.tint);
    this.baseTint = boss.tint ?? null;
    this.sprite.preFX?.addGlow(0xff3030, 3, 0, false, 0.1, 16);
    this.aggro = false;
  }

  makeStoryBoss(def: StoryBossDef, floor: number) {
    this.story = def;
    this.name = def.name;
    this.xp = Math.round(300 * enemyXpScale(floor) * 4);
    this.armor = bossArmor(floor);
    this.r = 11;
    this.aggro = false;
    this.applyPhase(0, floor);
  }

  /** switches a story guardian to one of its stages (new look, attacks and a full health bar) */
  applyPhase(i: number, floor: number) {
    const def = this.story!;
    const ph = def.phases[i];
    const base = storyBossBase(floor);
    this.phase = i;
    this.bossTier = 1 + i;
    const dif = this.scene.diff;
    this.maxHp = this.hp = Math.round(base.hp * ph.hp * (dif?.enemyHp ?? 1));
    this.dmg = base.dmg * ph.dmg;
    this.speed = ph.speed * (dif?.enemySpeed ?? 1);
    this.enraged = false;
    this.patternIdx = 0;
    this.patternT = 1.6;
    this.patterns = [...ph.patterns];
    this.bphase = 0;
    this.arena = null;
    this.lastStand = false;
    this.capBudget = this.maxHp * 0.1;
    this.capT = this.scene.time.now / 1000;
    this.boss = { id: def.id, name: def.name, sprite: ph.sprite, scale: ph.scale, hp: ph.hp, dmg: ph.dmg, speed: ph.speed, patterns: ph.patterns, proj: ph.proj, el: ph.el, summon: ph.summon, tint: ph.tint };
    if (this.spriteKey !== ph.sprite) {
      this.spriteKey = ph.sprite;
      this.sprite.setTexture(ph.sprite, 0);
      this.sprite.play(ph.sprite + '_loop');
    }
    this.setScale(ph.scale);
    this.baseTint = ph.tint ?? null;
    if (ph.tint) this.sprite.setTint(ph.tint);
    else this.sprite.clearTint();
    this.sprite.preFX?.clear();
    this.sprite.preFX?.addGlow(i === def.phases.length - 1 && def.phases.length > 1 ? 0xff40c0 : 0xff3030, 3, 0, false, 0.1, 16);
  }

  destroyVisuals() {
    super.destroyVisuals();
    this.nameLabel?.destroy();
    this.nameLabel = null;
    this.roleIcon?.destroy();
    this.roleIcon = null;
    this.aura?.destroy();
    this.aura = null;
    if (this.pw.bat) {
      for (const im of this.pw.bat.imgs) im.destroy();
      this.pw.bat = undefined;
    }
  }

  syncSprite(moving: boolean) {
    super.syncSprite(moving);
    if (this.roleIcon) this.roleIcon.setPosition(Math.round(this.x), Math.round(this.y - 20 * this.baseScale - 8 - this.hop)).setDepth(D.entityBase + this.y + 40);
    if (this.corrupt && this.nameLabel) this.nameLabel.setPosition(Math.round(this.x), Math.round(this.y - 20 * this.baseScale - (this.roleIcon ? 13 : 5) - this.hop));
  }

  get phaseCount() {
    return this.story ? this.story.phases.length : 1;
  }

  /** guardians go through the 70/40/10 % phases (story guardians in their last stage) */
  get phased() {
    return !!this.boss && (!this.story || this.phase === this.phaseCount - 1);
  }

  /** health where the next phase begins, or null when all of them are behind */
  get nextPhaseHp(): number | null {
    if (!this.phased || this.bphase >= BOSS_PHASE_HP.length) return null;
    return this.maxHp * BOSS_PHASE_HP[this.bphase];
  }

  onDot(amount: number) {
    this.scene.combat.damageEnemy(this, amount, { dot: true, el: this.st.burnT > 0 ? 'fire' : 'poison' });
  }

  /** a blow of another monster (only in a brawl between two packs) */
  takeDamage(amount: number) {
    if (this.faction) this.scene.combat.damageEnemy(this, amount, { fromAlly: true, noCrit: true });
  }

  update(dt: number) {
    if (this.dead) return;
    this.updateStatus(dt);
    if (this.dead) return;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) {
        if (this.baseTint !== null) this.sprite.setTint(this.baseTint);
        else this.sprite.clearTint();
      }
    }
    if (this.hpBarT > 0) this.hpBarT -= dt;
    if (this.tauntT > 0) this.tauntT -= dt;
    // knockback
    if (Math.abs(this.knockX) + Math.abs(this.knockY) > 0.5) {
      const [nx, ny] = this.flying ? [this.x + this.knockX * dt, this.y + this.knockY * dt] : this.scene.map.move(this.x, this.y, this.knockX * dt, this.knockY * dt, this.r);
      this.x = nx;
      this.y = ny;
      this.knockX *= 0.82;
      this.knockY *= 0.82;
    }
    if (this.stunned) {
      this.syncSprite(false);
      return;
    }
    if (this.boss) {
      this.scene.bossAI.update(this, dt);
      return;
    }
    if (this.corrupt) this.corruptTick(dt);
    if (this.affixes.length && this.aggro) this.affixTick(dt);
    if (this.dead) return;
    this.ai(dt);
  }

  /** what a champion's traits do while it fights (each trait keeps its own timer) */
  private affixTick(dt: number) {
    const sc = this.scene;
    const p = sc.player;
    if (p.dead) return;
    // a shield fades after a while
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      if (this.shieldT <= 0 || this.shieldHp <= 0) this.dropShield();
    }
    // frenzy at half health
    if (!this.frenzied && this.affixes.includes('zuřivý') && this.hp < this.maxHp * 0.5) {
      this.frenzied = true;
      this.speed *= 1.35;
      this.dmg *= 1.3;
      this.baseTint = 0xff9a8a;
      this.sprite.setTint(0xff9a8a);
      sc.fx.ring(this.x, this.y - 6, 30, 0xff3a1a, 400);
      sc.fx.number(this.x, this.y - 20, 'zuří!', '#ff6a4a');
    }
    for (const a of this.affixes) {
      const t = (this.affTimers[a] ?? 1.5 + Math.random() * 2) - dt;
      this.affTimers[a] = t > 0 ? t : this.affixAct(a);
    }
  }

  /** one trait acts; returns the seconds until it acts again */
  private affixAct(a: string): number {
    const sc = this.scene;
    const p = sc.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    switch (a) {
      case 'ohnivý':
        // burning ground along its path
        sc.addHazard(this.x, this.y + 1, 9, this.dmg * 0.45, 'fire', 3.2, 0xff5a1a, this.name, false, this);
        return 0.75;
      case 'jedovatý':
        // a cloud of poison where it stood
        sc.addHazard(this.x, this.y + 1, 15, this.dmg * 0.35, 'poison', 3.5, 0x7be05a, this.name, false, this);
        return 2.2;
      case 'elektrický':
        if (d < 150 && sc.map.canSee(this.x, this.y, p.x, p.y)) {
          const ang = Math.atan2(p.y - 4 - (this.y - 6), p.x - this.x);
          for (const da of [-0.32, 0, 0.32]) sc.spawnEnemyProjectile(this.x, this.y - 6, ang + da, 'pr_bolt', this.dmg * 0.55, 'lightning', 80, this.name, this);
          sc.fx.burst(this.x, this.y - 8, 0xfff27a, 6);
        }
        return 2.4;
      case 'léčitel': {
        let healed = false;
        for (const o of sc.enemiesNear(this.x, this.y, 80)) {
          if (o.dead || o.hp >= o.maxHp || o.boss) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
          sc.fx.burst(o.x, o.y - 8, 0x52ff8f, 4);
          healed = true;
        }
        if (healed) sc.fx.ring(this.x, this.y - 4, 80, 0x52ff8f, 500);
        return 3;
      }
      case 'teleportér':
        if (d > 50 && d < 220) {
          const spot = sc.map.randomFloorNear(p.x, p.y, 34);
          if (spot && Math.hypot(spot[0] - p.x, spot[1] - p.y) > 16) {
            sc.fx.burst(this.x, this.y - 6, 0xb07dff, 12, 'puff');
            this.x = spot[0];
            this.y = spot[1];
            sc.fx.burst(this.x, this.y - 6, 0xb07dff, 12, 'puff');
            sc.fx.ring(this.x, this.y - 4, 22, 0xb07dff, 350);
          }
        }
        return 4 + Math.random() * 2;
      case 'vyvolávač': {
        const mine = sc.enemies.filter((e) => !e.dead && e.summoner === this).length;
        for (let i = 0; i < Math.min(2, 6 - mine); i++) {
          const s = sc.map.randomFloorNear(this.x, this.y, 26);
          if (!s) continue;
          const m = sc.spawnEnemy(this.def.id, s[0], s[1], false, this.roomId);
          m.isMinion = true;
          m.summoner = this;
          m.setScale((this.def.scale ?? 1) * 0.75);
          m.maxHp = m.hp = Math.round(m.maxHp * 0.4);
          m.xp = Math.round(m.xp * 0.3);
          m.aggro = true;
          sc.fx.burst(s[0], s[1] - 6, 0x7bd88f, 10, 'puff');
          sc.fx.ring(s[0], s[1], 16, 0x7bd88f, 400);
        }
        return 6;
      }
      case 'štítonoš':
        // a shield of light that soaks a fifth of its health
        this.shieldHp = this.maxHp * 0.2;
        this.shieldT = 5;
        this.baseTint = 0xa8ccff;
        this.sprite.setTint(0xa8ccff);
        sc.fx.ring(this.x, this.y - 6, 24, 0x7fb2ff, 450);
        return 8;
      case 'magnetický':
        // drags the hero closer
        if (d > 36 && d < 150 && sc.map.canSee(this.x, this.y, p.x, p.y)) {
          p.knockX += ((this.x - p.x) / d) * 170;
          p.knockY += ((this.y - p.y) / d) * 170;
          sc.fx.ring(p.x, p.y - 6, 20, 0xc77dff, 350);
          sc.fx.ring(this.x, this.y - 6, 28, 0xc77dff, 350);
        }
        return 5;
    }
    return 99;
  }

  /** the shield broke or faded */
  dropShield() {
    this.shieldHp = 0;
    this.shieldT = 0;
    this.baseTint = this.frenzied ? 0xff9a8a : null;
    if (this.baseTint !== null) this.sprite.setTint(this.baseTint);
    else this.sprite.clearTint();
  }

  // Treasure goblin: waits until it notices the player, then runs away and escapes after a while.
  thiefAI(dt: number) {
    const sc = this.scene;
    const p = sc.player;
    const dx = this.x - p.x,
      dy = this.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (!this.spotted) {
      // noticed the player, got hit, or was alerted by its room mates
      if (this.aggro || (dist < 120 && sc.map.los(this.x, this.y, p.x, p.y))) {
        this.spotted = true;
        this.aggro = true;
        this.escapeT = THIEF_ESCAPE;
        sc.onThiefSpotted(this);
      } else {
        this.wander(dt);
        return;
      }
    }
    this.escapeT -= dt;
    if (this.escapeT <= 0) {
      sc.thiefEscapes(this);
      return;
    }
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = 0.12;
      sc.fx.burst(this.x, this.y - 6, 0xffd23a, 1);
    }
    const spd = this.speed * this.speedMult;
    let dir: [number, number] = [dx / dist, dy / dist];
    if (dist > 190) {
      // far enough away: catch its breath
      this.wander(dt);
      return;
    }
    // every few seconds it stops for a moment to count its gold – the chance to catch it
    this.restT -= dt;
    if (this.restT <= 0) {
      if (this.restT < -0.9) this.restT = 2 + Math.random();
      else {
        if (Math.random() < 0.15) sc.fx.burst(this.x, this.y - 8, 0xffd23a, 3);
        this.syncSprite(false);
        return;
      }
    }
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      dir = this.wanderDir;
    }
    const moved = this.stepToward(dir[0], dir[1], spd, dt);
    this.homeX = this.x;
    this.homeY = this.y;
    if (!moved) {
      // cornered: dart sideways for a moment
      const side = Math.random() < 0.5 ? 1 : -1;
      this.wanderDir = [-dir[1] * side, dir[0] * side];
      this.dodgeT = 0.45;
    }
    this.facing = dir[0] >= 0 ? 1 : -1;
    this.syncSprite(true);
  }

  ai(dt: number) {
    const sc = this.scene;
    const def = this.def;
    if (def.behavior === 'thief') return this.thiefAI(dt);
    if (def.behavior === 'static') {
      // portals and eggs: only their power works
      sc.powers.act(this, dt, 999, false);
      if (!this.dead) this.syncSprite(false);
      return;
    }
    const target = sc.pickEnemyTarget(this);
    const tx = target.x,
      ty = target.y;
    const dx = tx - this.x,
      dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const seesPlayer = dist < 150 && (this.flying || sc.map.los(this.x, this.y, tx, ty));
    if (!this.aggro) {
      if (seesPlayer && !sc.player.stealthed && dist < 120) {
        this.aggro = true;
        // alert nearby room mates
        for (const e of sc.enemies) if (!e.aggro && e.roomId === this.roomId && this.roomId >= 0 && Math.hypot(e.x - this.x, e.y - this.y) < 100) e.aggro = true;
      } else {
        this.wander(dt);
        return;
      }
    }
    if (sc.player.stealthed && target === sc.player) {
      this.wander(dt);
      return;
    }
    if (dist > 360) {
      this.aggro = false;
      return;
    }
    this.atkT -= dt;
    if (this.leapCd > 0) this.leapCd -= dt;
    let moving = false;
    const spd = this.speed * this.speedMult * this.haste;
    this.facing = dx >= 0 ? 1 : -1;
    if (this.leap) return this.leapStep(dt);
    // the special power gets the first word (casting, roaring, eating, a cloud of bats …)
    if (sc.powers.act(this, dt, dist, seesPlayer)) {
      if (!this.dead && !this.pw.eating) this.syncSprite(false);
      return;
    }
    if (this.dead) return;
    // a sniper takes its time
    if (this.aimT > 0) return this.aimStep(dt, target, seesPlayer);
    const b = def.behavior;
    // a spider about to burst
    if (this.pw.fuse !== undefined) {
      this.pw.fuse -= dt;
      this.sprite.setScale(this.baseScale * ACTOR_SCALE * (1 + (0.6 - Math.max(0, this.pw.fuse)) * 0.6));
      this.sprite.setTint(Math.floor(sc.time.now / 80) % 2 ? 0xffffff : 0xff5a2a);
      if (this.pw.fuse <= 0) sc.powers.detonate(this);
      return;
    }

    // windup → attack
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this.performAttack(target);
      this.syncSprite(false);
      return;
    }
    if (this.charging > 0) {
      this.charging -= dt;
      const [nx, ny, hit] = sc.map.move(this.x, this.y, this.chargeDir[0] * spd * 3.2 * dt, this.chargeDir[1] * spd * 3.2 * dt, this.r);
      this.x = nx;
      this.y = ny;
      if (Math.hypot(sc.player.x - this.x, sc.player.y - this.y) < this.r + 6) {
        sc.combat.damagePlayer(this.dmg * this.might * 1.2, this);
        if (def.ability === 'berserk') this.shove(sc.player, 240);
        this.charging = 0;
      }
      if (hit) this.charging = 0;
      this.syncSprite(true);
      return;
    }
    if (b === 'lurker') return this.lurkerStep(dt, target, dist, spd);
    if (b === 'bomber' && seesPlayer && dist < 22) {
      this.pw.fuse = 0.6;
      sc.fx.number(this.x, this.y - 14, '!', '#ff7a2a', true);
      this.syncSprite(false);
      return;
    }

    const kiting = b === 'kiter' || b === 'support' || b === 'sniper';
    const ranged = b === 'ranged' || b === 'caster' || b === 'summoner' || kiting;
    const inRange = dist <= def.range + this.r + 4 && (this.flying || seesPlayer || dist < 20);
    if (b === 'summoner') {
      this.summonT -= dt;
      if (this.summonT <= 0 && sc.enemies.length < 90) {
        this.summonT = 7;
        for (let i = 0; i < 2; i++) {
          const p = sc.map.randomFloorNear(this.x, this.y, 24);
          if (p) {
            const m = sc.spawnEnemy(def.summon ?? 'skeleton', p[0], p[1], false, this.roomId);
            m.aggro = true;
            m.isMinion = true;
            m.xp = Math.round(m.xp * 0.3);
            sc.fx.burst(p[0], p[1], 0xb07dff, 10, 'puff');
          }
        }
      }
    }
    // ghouls leap at their prey
    if ((b === 'leaper' || this.mutation === 'skákavý') && seesPlayer && dist > 40 && dist < 120 && this.leapCd <= 0) {
      this.leapCd = 3.5 + Math.random() * 1.5;
      this.leapPending = true;
      this.windup = 0.35;
      this.sprite.setTint(0xffd0a0);
      this.hitFlash = 0.35;
      this.syncSprite(false);
      return;
    }
    if (b === 'charger' && dist < 90 && dist > 30 && seesPlayer && this.chargeT <= 0) {
      this.chargeT = 4 + Math.random() * 2;
      this.chargeDir = [dx / dist, dy / dist];
      this.sprite.setTint(0xff8080);
      this.hitFlash = 0.45;
      this.windup = 0.45;
      this.chargePending = true;
      this.syncSprite(false);
      return;
    }
    this.chargeT -= dt;
    const atkCd = (def.atkCd * (this.affixes.includes('rychlý') ? 0.75 : 1)) / this.haste;

    // archers, snipers and those who work on their pack keep their distance
    if (kiting) {
      const keep = b === 'sniper' ? 120 : b === 'support' ? 100 : Math.min(80, def.range * 0.65);
      if (seesPlayer && dist < keep) moving = this.backOff(dx, dy, dist, spd, dt);
      else if (!seesPlayer || dist > def.range) moving = this.approach(dx, dy, dist, spd, dt, seesPlayer);
      if (seesPlayer && dist <= def.range + 4 && this.atkT <= 0) {
        this.atkT = atkCd;
        if (b === 'sniper') {
          this.aimT = 1.7;
          this.aimA = Math.atan2(ty - 6 - (this.y - 7), tx - this.x);
          this.syncSprite(false);
          return;
        }
        this.windup = 0.3;
        this.lunge(dx / dist, dy / dist);
      }
      this.syncSprite(moving);
      return;
    }

    if (inRange && (!ranged || seesPlayer)) {
      if (ranged && dist < 40 && b !== 'summoner') {
        // back off a bit
        moving = this.stepToward(-dx / dist, -dy / dist, spd * 0.7, dt);
      }
      if (this.atkT <= 0) {
        this.atkT = atkCd;
        this.windup = ranged ? 0.35 : 0.3;
        this.lunge(dx / dist, dy / dist);
      }
    } else {
      // move toward target
      let dir: [number, number] | null = null;
      if (this.flying || seesPlayer) dir = [dx / (dist || 1), dy / (dist || 1)];
      else dir = sc.map.flowDir(this.x, this.y);
      if (b === 'erratic') {
        this.erraticT -= dt;
        if (this.erraticT <= 0) {
          this.erraticT = 0.3 + Math.random() * 0.4;
          this.wanderDir = [Math.random() - 0.5, Math.random() - 0.5];
        }
        if (dir) dir = [dir[0] + this.wanderDir[0] * 1.4, dir[1] + this.wanderDir[1] * 1.4];
      }
      if (dir) {
        const l = Math.hypot(dir[0], dir[1]) || 1;
        moving = this.stepToward(dir[0] / l, dir[1] / l, spd, dt);
      }
    }
    this.syncSprite(moving);
  }

  /** steps away from the target, sliding sideways when something is in the way */
  private backOff(dx: number, dy: number, dist: number, spd: number, dt: number) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 1.2 + Math.random();
      if (Math.random() < 0.4) this.strafe = -this.strafe;
    }
    const mx = -dx / dist + (-dy / dist) * this.strafe * 0.6,
      my = -dy / dist + (dx / dist) * this.strafe * 0.6;
    const l = Math.hypot(mx, my) || 1;
    const moved = this.stepToward(mx / l, my / l, spd * 0.9, dt);
    if (!moved) {
      this.strafe = -this.strafe;
      this.strafeT = 0.8;
    }
    return moved;
  }

  private approach(dx: number, dy: number, dist: number, spd: number, dt: number, sees: boolean) {
    const dir = this.flying || sees ? [dx / (dist || 1), dy / (dist || 1)] : this.scene.map.flowDir(this.x, this.y);
    if (!dir) return false;
    const l = Math.hypot(dir[0], dir[1]) || 1;
    return this.stepToward(dir[0] / l, dir[1] / l, spd, dt);
  }

  /** a sniper aims (the red line follows the target until the last moment), then one heavy bolt */
  private aimStep(dt: number, target: Actor, sees: boolean) {
    this.aimT -= dt;
    if (!sees) {
      this.aimT = 0;
      this.atkT = 1;
    } else {
      if (this.aimT > 0.35) this.aimA = Math.atan2(target.y - 6 - (this.y - 7), target.x - this.x);
      if (this.aimT <= 0) {
        const pr = this.scene.spawnEnemyProjectile(this.x, this.y - 7, this.aimA, 'arrow', this.dmg * this.might * 3.2, 'phys', 430, this.name, this);
        pr.sprite.setScale(1.6);
        pr.maxRange = 320;
        sfx('bow');
        this.lunge(-Math.cos(this.aimA), -Math.sin(this.aimA));
      }
    }
    this.syncSprite(false);
  }

  /** flying through the air at the end of a leap */
  private leapStep(dt: number) {
    const sc = this.scene;
    const L = this.leap!;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    const nx = L.x0 + (L.x1 - L.x0) * k,
      ny = L.y0 + (L.y1 - L.y0) * k;
    if (!sc.map.collides(nx, ny, this.r)) {
      this.x = nx;
      this.y = ny;
    }
    this.hop = Math.sin(k * Math.PI) * 14;
    if (k >= 1) {
      this.leap = null;
      this.hop = 0;
      sc.fx.burst(this.x, this.y, 0xb8a888, 6, 'puff');
      const p = sc.player;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < 18 && !p.dead) {
        sc.combat.damagePlayer(this.dmg * this.might * 1.3, this);
        this.shove(p, 90);
      }
      this.atkT = Math.max(this.atkT, 0.4);
    }
    this.syncSprite(true);
  }

  /** a lurker drifts through walls, strikes out of them and hides again */
  private lurkerStep(dt: number, target: Actor, dist: number, spd: number) {
    const sc = this.scene;
    this.inWall = sc.map.isSolidPx(this.x, this.y);
    this.sprite.setAlpha(this.inWall ? 0.4 : 1);
    const dx = target.x - this.x,
      dy = target.y - this.y;
    let moving = false;
    if ((this.pw.t2 ?? 0) > 0) {
      // after a strike it backs away into the stone
      if (!this.inWall || dist < 40) moving = this.stepToward(-dx / (dist || 1), -dy / (dist || 1), spd * 0.8, dt);
    } else if (dist <= this.def.range + 4) {
      if (this.atkT <= 0) {
        this.atkT = this.def.atkCd / this.haste;
        this.windup = 0.4;
        this.sprite.setTint(0xff6aff);
        this.hitFlash = 0.4;
        this.lunge(dx / (dist || 1), dy / (dist || 1));
      }
    } else moving = this.stepToward(dx / (dist || 1), dy / (dist || 1), spd, dt);
    this.syncSprite(moving);
  }

  /** a heavy blow throws the target back */
  shove(t: Actor, force: number) {
    const d = Math.hypot(t.x - this.x, t.y - this.y) || 1;
    t.knockX += ((t.x - this.x) / d) * force;
    t.knockY += ((t.y - this.y) / d) * force;
    if (t === this.scene.player) this.scene.fx.shake(0.003, 90);
  }

  chargePending = false;

  stepToward(nx: number, ny: number, spd: number, dt: number) {
    if (this.flying) {
      if (this.def.behavior === 'ghost' || this.def.behavior === 'lurker') {
        // ghosts drift through walls
        this.x += nx * spd * dt;
        this.y += ny * spd * dt;
        return true;
      }
      // bats fly over traps but keep clear of walls like everything else
      const [x2, y2] = this.scene.map.move(this.x, this.y, nx * spd * dt, ny * spd * dt, this.r);
      const moved = Math.abs(x2 - this.x) + Math.abs(y2 - this.y) > 0.01;
      this.x = x2;
      this.y = y2;
      return moved;
    }
    const [x2, y2] = this.scene.map.move(this.x, this.y, nx * spd * dt, ny * spd * dt, this.r);
    const moved = Math.abs(x2 - this.x) + Math.abs(y2 - this.y) > 0.01;
    this.x = x2;
    this.y = y2;
    return moved;
  }

  lunge(nx: number, ny: number) {
    const s = this.sprite;
    this.scene.tweens.add({ targets: s, x: s.x + nx * 3, y: s.y + ny * 3, duration: 120, yoyo: true });
  }

  performAttack(target: Actor) {
    const sc = this.scene;
    if (this.chargePending) {
      this.chargePending = false;
      this.charging = 0.55;
      return;
    }
    const dx = target.x - this.x,
      dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.leapPending) {
      // a leap that lands just short of where the target stands
      this.leapPending = false;
      const reach = Math.max(0, dist - 6);
      this.leap = { t: 0, dur: 0.42, x0: this.x, y0: this.y, x1: this.x + (dx / dist) * reach, y1: this.y + (dy / dist) * reach };
      sfx('swing');
      return;
    }
    const def = this.def;
    const dmg = this.dmg * this.might;
    const b = def.behavior;
    if (b === 'ranged' || b === 'caster' || b === 'summoner' || b === 'kiter' || b === 'support') {
      const a = Math.atan2(dy, dx);
      const pr = sc.spawnEnemyProjectile(this.x, this.y - 6, a, def.proj ?? 'arrow', dmg, def.el ?? 'phys', 130, this.name, this);
      if (def.ability === 'web') pr.o.effect = 'web';
      if (def.ability === 'sacrifice') pr.o.effect = 'drain';
      return;
    }
    if (b === 'lurker') this.pw.t2 = 1.4;
    if (dist <= def.range + this.r + target.r + 6) {
      sc.fx.slash(this.x + (dx / dist) * 8, this.y - 4 + (dy / dist) * 8, Math.atan2(dy, dx), 10, b === 'lurker' ? 0xd08aff : 0xffdddd, 90);
      if (target === sc.player) {
        sc.combat.damagePlayer(dmg, this);
        if (def.poison || this.mutation === 'jedovatý') sc.player.applyPoison(dmg * 0.3, 3);
        if (def.el === 'ice') sc.player.chill(1.2);
        if (def.el === 'fire') {
          sc.player.st.burnT = Math.max(sc.player.st.burnT, 2.5);
          sc.player.st.burnDps = Math.max(sc.player.st.burnDps, dmg * 0.15);
        }
        if (this.affixes.includes('upíří')) this.hp = Math.min(this.maxHp, this.hp + dmg * 0.5);
        if (this.affixes.includes('mrazivý')) sc.player.chill(1.5);
        if (def.ability === 'berserk') this.shove(sc.player, 200);
        // vampires drink what they bite
        const drink = def.ability === 'vampire' ? 1 : def.ability === 'bloodpool' ? 1.5 : 0;
        if (drink && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + dmg * drink);
          sc.fx.beam(sc.player.x, sc.player.y - 6, this.x, this.y - 8, 0xc0101a, 1.5, 250);
        }
      } else {
        target.takeDamage(dmg);
      }
    }
  }

  wander(dt: number) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1 + Math.random() * 2.5;
      if (Math.random() < 0.5) this.wanderDir = [0, 0];
      else {
        const a = Math.random() * Math.PI * 2;
        this.wanderDir = [Math.cos(a), Math.sin(a)];
      }
      // stay near home
      const hx = this.homeX - this.x,
        hy = this.homeY - this.y;
      if (Math.hypot(hx, hy) > 40) {
        const l = Math.hypot(hx, hy);
        this.wanderDir = [hx / l, hy / l];
      }
    }
    let moving = false;
    if (this.wanderDir[0] || this.wanderDir[1]) {
      moving = this.stepToward(this.wanderDir[0], this.wanderDir[1], this.speed * 0.35, dt);
      if (this.wanderDir[0]) this.facing = this.wanderDir[0] > 0 ? 1 : -1;
    }
    this.syncSprite(moving);
  }
}

// ---------------------------------------------------------------------------
// ALLY (summons & totems)
// ---------------------------------------------------------------------------
export interface AllyDef {
  sprite: string;
  hp: number; // multiplier of base
  dmg: number; // multiplier
  speed: number;
  range: number;
  atkCd: number;
  ranged?: string; // projectile sprite
  el?: Element;
  flying?: boolean;
  scale?: number;
  totem?: string;
}

export const ALLY_DEFS: Record<string, AllyDef> = {
  skeleton: { sprite: 'al_skeleton', hp: 1, dmg: 0.6, speed: 60, range: 16, atkCd: 1.1 },
  skelMage: { sprite: 'al_skelMage', hp: 0.7, dmg: 0.7, speed: 50, range: 110, atkCd: 1.6, ranged: 'pr_shadow', el: 'shadow' },
  boneGolem: { sprite: 'al_boneGolem', hp: 4, dmg: 1.6, speed: 46, range: 20, atkCd: 1.4, scale: 1.3 },
  deathKnight: { sprite: 'al_deathKnight', hp: 2.5, dmg: 1.5, speed: 62, range: 18, atkCd: 1.0, scale: 1.15 },
  wolf: { sprite: 'al_wolf', hp: 1, dmg: 0.6, speed: 90, range: 14, atkCd: 0.8 },
  spiritWolf: { sprite: 'al_spiritWolf', hp: 1.2, dmg: 0.8, speed: 95, range: 14, atkCd: 0.8, el: 'ice' },
  tiger: { sprite: 'al_tiger', hp: 2, dmg: 1.4, speed: 100, range: 16, atkCd: 0.7, scale: 1.2 },
  bear: { sprite: 'al_bear', hp: 4, dmg: 1.4, speed: 60, range: 18, atkCd: 1.2 },
  hawk: { sprite: 'al_hawk', hp: 0.6, dmg: 0.7, speed: 120, range: 14, atkCd: 0.7, flying: true },
  treant: { sprite: 'al_treant', hp: 5, dmg: 1.8, speed: 42, range: 20, atkCd: 1.5, scale: 1.5 },
  fireElemental: { sprite: 'al_fireElemental', hp: 2.5, dmg: 1.2, speed: 55, range: 110, atkCd: 1.0, ranged: 'pr_fire', el: 'fire', scale: 1.3 },
  ancestor: { sprite: 'al_ancestor', hp: 1.2, dmg: 0.9, speed: 60, range: 110, atkCd: 1.2, ranged: 'pr_holy', el: 'holy', flying: true },
  shadow: { sprite: 'al_shadow', hp: 1.5, dmg: 1.0, speed: 90, range: 16, atkCd: 0.6 },
  spiritSword: { sprite: 'wp_sword', hp: 3, dmg: 1.5, speed: 120, range: 16, atkCd: 0.5, flying: true },
  totem_heal: { sprite: 'totem_heal', hp: 3, dmg: 0, speed: 0, range: 90, atkCd: 1, totem: 'heal' },
  totem_storm: { sprite: 'totem_storm', hp: 3, dmg: 1, speed: 0, range: 140, atkCd: 0.6, totem: 'storm' },
  totem_fire: { sprite: 'totem_fire', hp: 3, dmg: 1, speed: 0, range: 130, atkCd: 0.9, totem: 'fire' },
  totem_ice: { sprite: 'totem_ice', hp: 3, dmg: 1, speed: 0, range: 80, atkCd: 1, totem: 'ice' },
};

export class Ally extends Actor {
  def: AllyDef;
  kind: string;
  dmg: number;
  lifeT: number;
  atkT = 0;
  target: Enemy | null = null;
  retargetT = 0;

  constructor(scene: GameScene, kind: string, x: number, y: number, baseHp: number, baseDmg: number, life: number) {
    const def = ALLY_DEFS[kind];
    super(scene, x, y, def.sprite);
    this.def = def;
    this.kind = kind;
    this.maxHp = Math.round(baseHp * def.hp);
    this.hp = this.maxHp;
    this.dmg = baseDmg * def.dmg;
    this.lifeT = life;
    this.flying = !!def.flying;
    if (def.scale) this.setScale(def.scale);
    if (kind === 'spiritSword') {
      this.sprite.setOrigin(0.5, 0.5).setTint(0xfff2a8).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (kind === 'shadow') this.sprite.setAlpha(0.85);
    this.sprite.setAlpha(this.sprite.alpha * 0.95);
    scene.fx.burst(x, y, 0xb07dff, 10, 'puff');
  }

  takeDamage(amount: number) {
    if (this.dead) return;
    this.hp -= amount;
    this.scene.fx.flash(this.sprite, 0xff6060, 60);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.scene.fx.burst(this.x, this.y, 0xcccccc, 10, 'puff');
    this.destroyVisuals();
  }

  update(dt: number) {
    if (this.dead) return;
    this.updateStatus(dt);
    this.lifeT -= dt;
    if (this.lifeT <= 0) return this.die();
    const sc = this.scene;
    this.atkT -= dt;
    this.retargetT -= dt;
    if (this.retargetT <= 0 || !this.target || this.target.dead) {
      this.retargetT = 0.4;
      this.target = sc.nearestEnemy(this.x, this.y, this.def.totem ? this.def.range : 150, !this.flying);
    }
    if (this.def.totem) {
      if (this.atkT <= 0) {
        this.atkT = this.def.atkCd;
        sc.spells.totemPulse(this);
      }
      this.sprite.setPosition(this.x, this.y + 3);
      this.sprite.setDepth(D.entityBase + this.y);
      return;
    }
    let moving = false;
    const p = sc.player;
    const t = this.target;
    const spd = this.def.speed * this.speedMult;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) < 220) {
      const dx = t.x - this.x,
        dy = t.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.facing = dx >= 0 ? 1 : -1;
      if (d > this.def.range + t.r) {
        moving = this.step(dx / d, dy / d, spd, dt, t.x, t.y);
      } else if (this.atkT <= 0) {
        this.atkT = this.def.atkCd;
        if (this.def.ranged) {
          sc.spawnAllyProjectile(this.x, this.y - 6, Math.atan2(dy, dx), this.def.ranged, this.dmg, this.def.el ?? 'phys');
        } else {
          sc.fx.slash(this.x + (dx / d) * 6, this.y - 4 + (dy / d) * 6, Math.atan2(dy, dx), 9, EL_COLOR[this.def.el ?? 'phys'], 90);
          sc.combat.damageEnemy(t, this.dmg * (0.85 + Math.random() * 0.3), { el: this.def.el ?? 'phys', fromAlly: true });
          this.scene.tweens.add({ targets: this.sprite, x: this.sprite.x + (dx / d) * 3, duration: 80, yoyo: true });
        }
      }
    } else {
      // follow player
      const dx = p.x - this.x,
        dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 300) {
        this.x = p.x + (Math.random() - 0.5) * 20;
        this.y = p.y + (Math.random() - 0.5) * 20;
      } else if (d > 36) {
        moving = this.step(dx / d, dy / d, spd * 1.1, dt, p.x, p.y);
        this.facing = dx >= 0 ? 1 : -1;
      }
    }
    if (this.kind === 'spiritSword') {
      this.sprite.setPosition(this.x, this.y - 6);
      this.sprite.rotation += dt * 8;
      this.sprite.setDepth(D.entityBase + this.y + 20);
      this.shadow.setPosition(this.x, this.y + 3);
      return;
    }
    this.syncSprite(moving);
  }

  step(nx: number, ny: number, spd: number, dt: number, gx: number, gy: number) {
    if (this.flying) {
      this.x += nx * spd * dt;
      this.y += ny * spd * dt;
      return true;
    }
    const sc = this.scene;
    let dir: [number, number] = [nx, ny];
    if (!sc.map.los(this.x, this.y, gx, gy)) {
      // use player flow field when target near player, else straight
      const f = sc.map.flowDir(this.x, this.y);
      if (f) dir = f;
    }
    const [x2, y2] = sc.map.move(this.x, this.y, dir[0] * spd * dt, dir[1] * spd * dt, this.r);
    const moved = Math.abs(x2 - this.x) + Math.abs(y2 - this.y) > 0.01;
    this.x = x2;
    this.y = y2;
    return moved;
  }
}

// ---------------------------------------------------------------------------
// PROJECTILE
// ---------------------------------------------------------------------------
export interface ProjOpts {
  x: number;
  y: number;
  angle: number;
  speed: number;
  sprite: string;
  dmg: number;
  el: Element;
  owner: 'player' | 'enemy';
  pierce?: number;
  explode?: number;
  bounce?: number;
  homing?: boolean;
  size?: number;
  range?: number;
  slow?: number;
  stun?: number;
  freeze?: number;
  dot?: number; // damage over time per hit tick (for slow orbs)
  lifesteal?: number;
  crit?: boolean;
  spell?: boolean;
  fromAlly?: boolean;
  isAttack?: boolean;
  onHitFx?: boolean;
  /** who shot it (a monster's projectile; named on the death screen) */
  srcName?: string;
  srcFoe?: Enemy;
  /** what a monster's shot does besides damage: 'web', 'drain', 'curse:<id>' */
  effect?: string;
}

export class Projectile {
  scene: GameScene;
  o: ProjOpts;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: Phaser.GameObjects.Sprite;
  traveled = 0;
  dead = false;
  hitIds = new Set<number>();
  pierceLeft: number;
  bounceLeft: number;
  tickT = 0;
  maxRange: number;
  rotates: boolean;

  constructor(scene: GameScene, o: ProjOpts) {
    this.scene = scene;
    this.o = o;
    this.x = o.x;
    this.y = o.y;
    this.vx = Math.cos(o.angle) * o.speed;
    this.vy = Math.sin(o.angle) * o.speed;
    this.pierceLeft = o.pierce ?? 0;
    this.bounceLeft = o.bounce ?? 0;
    this.maxRange = o.range ?? 260;
    const key = o.sprite.startsWith('pr_') || o.sprite.startsWith('wp_') ? o.sprite : 'pr_' + o.sprite;
    this.sprite = scene.add.sprite(o.x, o.y, scene.textures.exists(key) ? key : 'pr_magic', 0);
    const tex = scene.textures.get(this.sprite.texture.key);
    if (tex.frameTotal > 2 && scene.anims.exists(this.sprite.texture.key + '_loop')) this.sprite.play(this.sprite.texture.key + '_loop');
    this.rotates = ['pr_arrow', 'pr_knife', 'pr_bone', 'pr_thorn', 'pr_ice', 'pr_wave'].includes(this.sprite.texture.key);
    if (this.rotates) this.sprite.setRotation(o.angle);
    this.sprite.setScale(o.size ?? 1);
    this.sprite.setDepth(D.bright);
    if (['pr_fire', 'pr_bolt', 'pr_holy', 'pr_shadow', 'pr_magic', 'pr_soul', 'pr_poison', 'pr_blood', 'pr_ice_ball', 'pr_curse', 'pr_mind', 'pr_time'].includes(this.sprite.texture.key)) this.sprite.setBlendMode(Phaser.BlendModes.ADD);
  }

  update(dt: number) {
    if (this.dead) return;
    const sc = this.scene;
    if (this.o.homing && this.o.owner === 'player') {
      const t = sc.nearestEnemy(this.x, this.y, 140, false);
      if (t) {
        const want = Math.atan2(t.y - 6 - this.y, t.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let diff = Phaser.Math.Angle.Wrap(want - cur);
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), 6 * dt);
        const na = cur + turn;
        this.vx = Math.cos(na) * this.o.speed;
        this.vy = Math.sin(na) * this.o.speed;
      }
    }
    // hit whatever stands right here first – otherwise a monster pressed against a wall
    // could never be hit at point-blank range (the next step would already be in the wall)
    if (this.checkHits()) return;
    const nx = this.x + this.vx * dt,
      ny = this.y + this.vy * dt;
    this.traveled += Math.hypot(nx - this.x, ny - this.y);
    if (sc.map.isSolidPx(nx, ny + 4)) {
      if (this.bounceLeft > 0 && !this.o.explode) {
        // reflect
        this.bounceLeft--;
        if (sc.map.isSolidPx(nx, this.y + 4)) this.vx = -this.vx;
        else this.vy = -this.vy;
      } else {
        this.impact(this.x, this.y);
        return;
      }
    } else {
      this.x = nx;
      this.y = ny;
    }
    if (this.traveled > this.maxRange) {
      if (this.o.explode) this.impact(this.x, this.y);
      else this.kill();
      return;
    }
    this.sprite.setPosition(this.x, this.y);
    if (this.rotates) this.sprite.setRotation(Math.atan2(this.vy, this.vx));
    else if (this.sprite.texture.key === 'pr_axe' || this.sprite.texture.key === 'pr_hammer') this.sprite.rotation += dt * 14;

    // damage-over-area orbs (ball lightning, tornado)
    if (this.o.dot) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = 0.3;
        for (const e of sc.enemiesNear(this.x, this.y, 28 * (this.o.size ?? 1))) {
          sc.combat.damageEnemy(e, this.o.dmg * this.o.dot * 0.3, { el: this.o.el, spell: true });
          if (this.o.el === 'lightning') sc.fx.lightning(this.x, this.y, e.x, e.y - 6);
        }
      }
    }

    this.checkHits();
  }

  // returns true when the projectile is gone
  checkHits(): boolean {
    const sc = this.scene;
    if (this.o.owner === 'player') {
      const hitR = 7 * (this.o.size ?? 1);
      for (const e of sc.enemies) {
        if (e.dead || this.hitIds.has(e.id)) continue;
        const ey = e.y - 6 * e.baseScale;
        if (Math.abs(e.x - this.x) > hitR + e.r * e.baseScale || Math.abs(ey - this.y) > hitR + 8 * e.baseScale) continue;
        this.hitIds.add(e.id);
        this.hitEnemy(e);
        if (this.dead) return true;
      }
    } else {
      const p = sc.player;
      if (Math.abs(p.x - this.x) < 6 && Math.abs(p.y - 6 - this.y) < 9) {
        // reflect: the shot turns back on its shooter, twice as strong
        if (p.d.specials.has('reflect') && !p.dead && Math.random() < 0.25) {
          this.o.owner = 'player';
          this.o.dmg *= 2;
          this.vx = -this.vx;
          this.vy = -this.vy;
          this.traveled = 0;
          this.hitIds.clear();
          sc.fx.burst(this.x, this.y, 0xffd76a, 6);
          sc.fx.number(p.x, p.y - 18, 'odraženo', '#ffd76a');
          return false;
        }
        sc.combat.cause = this.o.srcName ?? null;
        sc.combat.causeFoe = this.o.srcFoe ?? null;
        sc.combat.damagePlayer(this.o.dmg, null, this.o.el);
        if (this.o.el === 'ice') p.chill(1.2);
        if (this.o.el === 'poison') p.applyPoison(this.o.dmg * 0.3, 3);
        if (this.o.effect) sc.powers.projectileHit(this, true);
        sc.fx.burst(this.x, this.y, EL_COLOR[this.o.el] ?? 0xffffff, 6);
        this.kill();
        return true;
      }
      for (const a of sc.allies) {
        if (a.dead || a.def.totem) continue;
        if (Math.abs(a.x - this.x) < 7 && Math.abs(a.y - 5 - this.y) < 9) {
          a.takeDamage(this.o.dmg);
          this.kill();
          return true;
        }
      }
      for (const m of [sc.merc, sc.rival]) {
        if (m && !m.dead && !m.down && Math.abs(m.x - this.x) < 6 && Math.abs(m.y - 6 - this.y) < 9) {
          m.takeDamage(this.o.dmg);
          this.kill();
          return true;
        }
      }
    }
    return false;
  }

  hitEnemy(e: Enemy) {
    const sc = this.scene;
    const o = this.o;
    if (o.explode) {
      this.impact(this.x, this.y);
      return;
    }
    sc.combat.damageEnemy(e, o.dmg, { el: o.el, spell: o.spell, crit: o.crit, isAttack: o.isAttack, lifesteal: o.lifesteal, fromAlly: o.fromAlly, kx: this.vx, ky: this.vy, single: o.spell && !o.pierce && !o.bounce });
    if (o.slow) {
      e.st.slowT = 2.5;
      e.st.slowMult = 1 - o.slow;
    }
    if (o.stun) e.st.stunT = Math.max(e.st.stunT, o.stun);
    if (o.freeze) e.st.stunT = Math.max(e.st.stunT, o.freeze);
    sc.fx.burst(this.x, this.y, EL_COLOR[o.el] ?? 0xffffff, 5);
    if (this.bounceLeft > 0) {
      this.bounceLeft--;
      const next = sc.nearestEnemy(this.x, this.y, 120, true, this.hitIds);
      if (next) {
        const a = Math.atan2(next.y - 6 - this.y, next.x - this.x);
        this.vx = Math.cos(a) * o.speed;
        this.vy = Math.sin(a) * o.speed;
        this.traveled = 0;
        return;
      }
    }
    if (this.pierceLeft > 0) {
      this.pierceLeft--;
      return;
    }
    this.kill();
  }

  impact(x: number, y: number) {
    const sc = this.scene;
    const o = this.o;
    if (o.explode && o.owner === 'player') {
      sc.spells.explosion(x, y, o.explode, o.dmg, o.el, { spell: o.spell, crit: o.crit, isAttack: o.isAttack });
    } else {
      sc.fx.burst(x, y, EL_COLOR[o.el] ?? 0xffffff, 4);
      if (o.owner === 'enemy' && o.effect === 'web') sc.powers.projectileHit(this, false);
    }
    this.kill();
  }

  kill() {
    this.dead = true;
    this.sprite.destroy();
  }
}

export const TILE_PX = TS;
