import Phaser from 'phaser';
import { generateDungeon, Dungeon, DObject, T_FLOOR } from '../systems/dungeon';
import { WorldMap, TS } from '../game/map';
import { FX, D } from '../game/fx';
import { Player } from '../game/player';
import { Enemy, Ally, Projectile, ProjOpts, Actor } from '../game/entities';
import { Combat } from '../game/combat';
import { Spells } from '../game/spells';
import { Loot } from '../game/loot';
import { BossAI } from '../game/boss';
import { ENEMY_BY_ID, bossForFloor, isBossFloor } from '../data/enemies';
import { SaveData, saveGame, xpForLevel, ATTR_POINTS_PER_LEVEL, SPELL_POINTS_PER_LEVEL, autoLoadout } from '../systems/state';
import { spellsForClass, BuffMods } from '../data/spells';
import { generateItem } from '../data/items';
import { Item } from '../data/types';
import { Element } from '../data/types';
import { UI } from '../ui/ui';
import { bus } from '../systems/events';
import { sfx } from '../systems/audio';

export interface Interactable {
  kind: string;
  x: number;
  y: number;
  sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  data: any;
  used?: boolean;
  tx: number;
  ty: number;
}

export interface ShrineBuff {
  id: string;
  name: string;
  mods: BuffMods;
  xp?: number;
  mf?: number;
  t: number;
  total: number;
  color: number;
}

export interface MerchantStock {
  items: Item[];
  mats: { key: 'hpPotion' | 'mpPotion' | 'lockpick' | 'stone' | 'dust'; price: number; qty: number }[];
}

const SHRINES: Record<string, { name: string; mods: BuffMods; xp?: number; mf?: number; color: number }> = {
  power: { name: 'Svatyně síly', mods: { dmgPct: 30 }, color: 0xff4d4d },
  speed: { name: 'Svatyně rychlosti', mods: { atkSpdPct: 25, move: 20 }, color: 0xffe45c },
  armor: { name: 'Svatyně ochrany', mods: { armorPct: 60 }, color: 0x7fb2ff },
  fortune: { name: 'Svatyně štěstí', mods: {}, mf: 60, color: 0x52ff8f },
  wisdom: { name: 'Svatyně moudrosti', mods: { spellDmg: 30 }, xp: 0.5, color: 0xc77dff },
};

export class GameScene extends Phaser.Scene {
  save!: SaveData;
  floor = 1;
  dungeon!: Dungeon;
  map!: WorldMap;
  fx!: FX;
  combat!: Combat;
  spells!: Spells;
  loot!: Loot;
  bossAI!: BossAI;
  player!: Player;
  enemies: Enemy[] = [];
  allies: Ally[] = [];
  projectiles: Projectile[] = [];
  interactables: Interactable[] = [];
  lamps: { x: number; y: number; r: number; flicker: number; glow?: Phaser.GameObjects.Image }[] = [];
  shrineBuffs: ShrineBuff[] = [];
  moveVec: [number, number] = [0, 0];
  godMode = false;
  ui = UI;
  dark!: Phaser.GameObjects.RenderTexture;
  lightImg!: Phaser.GameObjects.Image;
  hpBars!: Phaser.GameObjects.Graphics;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  flowT = 0;
  revealT = 0;
  saveT = 0;
  boss: Enemy | null = null;
  bossDefeated = false;
  stairsObj: Interactable | null = null;
  paused = false;
  zoom = 3;
  darkness = 0.8;
  merchantStocks = new Map<Interactable, MerchantStock>();
  currentAction: Interactable | null = null;
  playTimeT = 0;
  floorKills = 0;

  constructor() {
    super('Game');
  }

  init(data: { save: SaveData }) {
    this.save = data.save;
    this.floor = this.save.floor;
    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.interactables = [];
    this.lamps = [];
    this.shrineBuffs = [];
    this.boss = null;
    this.bossDefeated = false;
    this.stairsObj = null;
    this.paused = false;
    this.merchantStocks = new Map();
    this.currentAction = null;
    this.floorKills = 0;
  }

  create() {
    const save = this.save;
    // pity: guarantee merchants regularly
    const forceMerchant = save.merchantPity >= 3;
    this.dungeon = generateDungeon(this.floor, (Math.random() * 1e9) | 0, { forceMerchant });
    if (this.dungeon.hasMerchant) save.merchantPity = 0;
    else save.merchantPity++;

    this.map = new WorldMap(this.dungeon);
    this.map.build(this);
    this.computeZoom();
    this.fx = new FX(this, this.zoom);
    this.combat = new Combat(this);
    this.spells = new Spells(this);
    this.loot = new Loot(this);
    this.bossAI = new BossAI(this);
    this.createAnims();

    const s = this.dungeon.start;
    this.player = new Player(this, s.x * TS + 8, s.y * TS + 10, save);
    this.placeObjects();
    this.spawnEnemies();

    // camera
    const cam = this.cameras.main;
    cam.setBounds(-200, -200, this.map.w * TS + 400, this.map.h * TS + 400);
    cam.setZoom(this.zoom);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    this.scale.on('resize', this.onResize, this);

    // darkness
    this.dark = this.add.renderTexture(0, 0, 64, 64).setOrigin(0).setDepth(D.dark);
    this.lightImg = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
    this.hpBars = this.add.graphics().setDepth(D.bright + 5);

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,Q,E,H,J,I,C,K,ESC,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-ONE', () => this.castSlot(0));
    kb.on('keydown-TWO', () => this.castSlot(1));
    kb.on('keydown-THREE', () => this.castSlot(2));
    kb.on('keydown-FOUR', () => this.castSlot(3));
    kb.on('keydown-Q', () => this.castSlot(4));
    kb.on('keydown-H', () => this.usePotion('hpPotion'));
    kb.on('keydown-J', () => this.usePotion('mpPotion'));
    kb.on('keydown-E', () => this.doAction());
    kb.on('keydown-SPACE', () => this.doAction());
    kb.on('keydown-I', () => UI.openPanel('inventory'));
    kb.on('keydown-C', () => UI.openPanel('character'));
    kb.on('keydown-K', () => UI.openPanel('spells'));
    kb.on('keydown-ESC', () => UI.togglePause());

    this.map.revealAround(this.player.x, this.player.y);
    UI.attachGame(this);
    UI.banner(this.floorTitle(), isBossFloor(this.floor) ? 'Patro strážce – připrav se!' : this.dungeon.hasMerchant ? 'Někde zde čeká obchodník…' : '');
    save.floor = this.floor;
    save.maxFloor = Math.max(save.maxFloor, this.floor);
    saveGame(save);
    this.events.once('shutdown', () => this.cleanup());
    (window as any).__scene = this;
  }

  floorTitle() {
    return `Patro ${this.floor}`;
  }

  computeZoom() {
    const h = this.scale.height,
      w = this.scale.width;
    this.zoom = Math.max(2, Math.min(Math.floor(h / 215), Math.floor(w / 380)));
  }

  onResize() {
    this.computeZoom();
    this.cameras.main.setZoom(this.zoom);
  }

  cleanup() {
    this.scale.off('resize', this.onResize, this);
    this.spells?.clear();
    this.loot?.clear();
  }

  createAnims() {
    const a = this.anims;
    for (const key of this.textures.getTextureKeys()) {
      const tex = this.textures.get(key);
      const n = tex.frameTotal - 1;
      if (n < 2) continue;
      if (n >= 6) {
        if (!a.exists(key + '_idle')) a.create({ key: key + '_idle', frames: a.generateFrameNumbers(key, { frames: [0, 1] }), frameRate: 2.5, repeat: -1 });
        if (!a.exists(key + '_walk')) a.create({ key: key + '_walk', frames: a.generateFrameNumbers(key, { frames: [2, 3, 4, 5] }), frameRate: 9, repeat: -1 });
      } else if (!a.exists(key + '_loop')) {
        a.create({ key: key + '_loop', frames: a.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: key === 'torch' ? 9 : key === 'coin' ? 10 : 6, repeat: -1 });
      }
    }
  }

  // ---------------------------------------------------------------- world objects
  placeObjects() {
    const d = this.dungeon;
    for (const o of d.objects) this.placeObject(o);
    // secret walls are interactables
    for (const s of d.secretWalls) this.interactables.push({ kind: 'secret', x: s.x * TS + 8, y: s.y * TS + 14, tx: s.x, ty: s.y, data: {} });
    for (const dr of d.lockedDoors) {
      this.map.solid[this.map.idx(dr.x, dr.y)] = 1;
    }
  }

  placeObject(o: DObject) {
    const px = o.x * TS + 8,
      py = o.y * TS + 8;
    const add = (key: string, depthOffset = 0, oy = 1) => this.add.image(px, o.y * TS + 16 * oy, key).setOrigin(0.5, oy).setDepth(D.entityBase + o.y * TS + 8 + depthOffset);
    switch (o.kind) {
      case 'torch': {
        const s = this.add.sprite(px, o.y * TS + 9, 'torch').play('torch_loop').setDepth(D.wallDeco);
        s.anims.setProgress(Math.random());
        const glow = this.add.image(px, o.y * TS + 6, 'glow').setTint(0xff9a3a).setAlpha(0.22).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        this.lamps.push({ x: px, y: o.y * TS + 12, r: 66, flicker: Math.random() * 10, glow });
        break;
      }
      case 'banner':
        this.add.image(px, o.y * TS + 1, 'banner_' + (o.data?.color ?? 'blue')).setOrigin(0.5, 0).setDepth(D.wallDeco);
        break;
      case 'bookshelf':
        this.add.image(px, o.y * TS - 2, 'bookshelf').setOrigin(0.5, 0).setDepth(D.wallDeco);
        break;
      case 'wallcrack':
        this.add.image(px, o.y * TS + 8, 'wallcrack').setDepth(D.wallDeco - 1);
        break;
      case 'crate':
      case 'barrel':
      case 'pot':
      case 'table':
      case 'skull':
        add(o.kind);
        if (o.kind === 'table') this.lamps.push({ x: px, y: py, r: 50, flicker: Math.random() * 10 });
        break;
      case 'chair':
        add('chair').setFlipX(!!o.data?.flip);
        break;
      case 'bones':
        this.add.image(px, py, 'bones').setDepth(D.floorDeco).setFlipX(Math.random() < 0.5);
        break;
      case 'moss':
        this.add.image(px, py, 'moss').setDepth(D.floorDeco).setAlpha(0.8);
        break;
      case 'puddle':
        this.add.image(px, py, 'puddle').setDepth(D.floorDeco);
        break;
      case 'web':
        this.add.image(o.y >= 0 ? px : px, py, 'web').setDepth(D.floorDeco + 1).setFlipX(!!o.data?.flip).setAlpha(0.7);
        break;
      case 'carpet': {
        const { w, h, color } = o.data;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
            this.add
              .image((o.x + x) * TS, (o.y + y) * TS, edge ? 'carpettrim_' + color : 'carpet_' + color)
              .setOrigin(0)
              .setDepth(D.floorDeco - 1);
          }
        break;
      }
      case 'stairs': {
        const s = this.add.image(px, py, 'stairs').setDepth(D.floorDeco);
        const it: Interactable = { kind: 'stairs', x: px, y: py, tx: o.x, ty: o.y, sprite: s, data: {} };
        this.interactables.push(it);
        this.stairsObj = it;
        this.lamps.push({ x: px, y: py, r: 60, flicker: 0 });
        break;
      }
      case 'door': {
        const s = this.add.image(px, py, 'door').setDepth(D.entityBase + o.y * TS + 16);
        this.interactables.push({ kind: 'door', x: px, y: py + 8, tx: o.x, ty: o.y, sprite: s, data: {} });
        break;
      }
      case 'chest':
      case 'mimic': {
        const tier = o.data?.tier ?? 'wood';
        const s = add('chest_' + tier, 0, 1);
        this.interactables.push({ kind: o.kind, x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: { ...o.data } });
        if (tier === 'gold') this.addSparkle(s);
        break;
      }
      case 'goldpile': {
        const s = this.add.image(px, py, 'goldpile').setDepth(D.floorDeco + 1);
        this.interactables.push({ kind: 'goldpile', x: px, y: py, tx: o.x, ty: o.y, sprite: s, data: {} });
        break;
      }
      case 'merchant': {
        const s = this.add.sprite(px, py + 6, 'npc_merchant').setOrigin(0.5, 1).play('npc_merchant_idle').setDepth(D.entityBase + py);
        this.add.image(px, py + 6, 'shadow').setDepth(D.floorDeco + 2);
        const it: Interactable = { kind: 'merchant', x: px, y: py + 6, tx: o.x, ty: o.y, sprite: s, data: {} };
        this.interactables.push(it);
        this.merchantStocks.set(it, this.makeStock());
        this.lamps.push({ x: px, y: py, r: 80, flicker: 0 });
        const t = this.fx.label(px, py - 16, 'Obchodník', '#ffd23a', 6);
        t.setDepth(D.ui - 2);
        break;
      }
      case 'anvil': {
        const s = add('anvil');
        this.interactables.push({ kind: 'anvil', x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: {} });
        this.lamps.push({ x: px, y: py, r: 60, flicker: 3 });
        const glow = this.add.image(px - 6, py - 2, 'glow').setTint(0xff7a1a).setAlpha(0.25).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        void glow;
        break;
      }
      case 'shrine': {
        const type = o.data?.type ?? 'power';
        const s = add('shrine_' + type);
        this.interactables.push({ kind: 'shrine', x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: { type } });
        const col = SHRINES[type]?.color ?? 0xffffff;
        const glow = this.add.image(px, py - 6, 'glow').setTint(col).setAlpha(0.3).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        this.tweens.add({ targets: glow, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 });
        this.interactables[this.interactables.length - 1].data.glow = glow;
        this.lamps.push({ x: px, y: py, r: 55, flicker: 0 });
        break;
      }
      case 'fountain': {
        const s = this.add.sprite(px, py + 8, 'fountain').setOrigin(0.5, 1).play('fountain_loop').setDepth(D.entityBase + py + 8);
        this.interactables.push({ kind: 'fountain', x: px, y: py + 6, tx: o.x, ty: o.y, sprite: s, data: {} });
        this.lamps.push({ x: px, y: py, r: 60, flicker: 0 });
        break;
      }
    }
  }

  addSparkle(s: Phaser.GameObjects.Image) {
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (!s.active || s.texture.key.endsWith('_open')) return;
        this.fx.burst(s.x + (Math.random() - 0.5) * 12, s.y - 8 - Math.random() * 6, 0xffe45c, 1, 'pix');
      },
    });
  }

  makeStock(): MerchantStock {
    const f = this.floor;
    const items: Item[] = [];
    for (let i = 0; i < 9; i++) items.push(generateItem(f + Math.floor(Math.random() * 3), { magicFind: 30, rarityBonus: Math.random() < 0.25 ? 1 : 0 }));
    const sc = 1 + f * 0.12;
    return {
      items,
      mats: [
        { key: 'hpPotion', price: Math.round(25 * sc), qty: 10 },
        { key: 'mpPotion', price: Math.round(20 * sc), qty: 10 },
        { key: 'lockpick', price: Math.round(60 * sc), qty: 4 },
        { key: 'stone', price: Math.round(80 * sc), qty: 6 },
        { key: 'dust', price: Math.round(100 * sc), qty: 5 },
      ],
    };
  }

  spawnEnemies() {
    for (const sp of this.dungeon.spawns) {
      const def = ENEMY_BY_ID[sp.id];
      if (!def) continue;
      this.spawnEnemy(sp.id, sp.x * TS + 8, sp.y * TS + 10, sp.elite, sp.room);
    }
    const br = this.dungeon.bossRoom;
    if (br) {
      const { def, tier } = bossForFloor(this.floor);
      const e = this.spawnEnemy('skeleton', br.cx * TS + 8, br.cy * TS + 8, false, br.id, def.sprite);
      e.makeBoss(def, tier, this.floor);
      this.boss = e;
    }
  }

  spawnEnemy(id: string, x: number, y: number, elite: boolean, room: number, spriteOverride?: string): Enemy {
    const base = ENEMY_BY_ID[id];
    const def = spriteOverride ? { ...base, sprite: spriteOverride } : base;
    const e = new Enemy(this, def, x, y, this.floor, elite, room);
    this.enemies.push(e);
    return e;
  }

  addAlly(kind: string, x: number, y: number, hp: number, dmg: number, life: number) {
    // cap number of summons
    const living = this.allies.filter((a) => !a.dead && !a.def.totem);
    if (living.length >= 14) living[0].die();
    const a = new Ally(this, kind, x, y, hp, dmg, life);
    this.allies.push(a);
    return a;
  }

  // ---------------------------------------------------------------- queries
  nearestEnemy(x: number, y: number, range: number, needLos: boolean, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null,
      bd = range;
    for (const e of this.enemies) {
      if (e.dead || (exclude && exclude.has(e.id))) continue;
      if (e.def.behavior === 'mimic' && !e.aggro) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r * e.baseScale;
      if (d >= bd) continue;
      if (needLos && !this.map.los(x, y - 4, e.x, e.y - 4)) continue;
      bd = d;
      best = e;
    }
    return best;
  }

  enemiesNear(x: number, y: number, r: number): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) <= r + e.r * e.baseScale) out.push(e);
    }
    return out;
  }

  pickEnemyTarget(e: Enemy): Actor {
    const p = this.player;
    let best: Actor = p;
    let bd = Math.hypot(p.x - e.x, p.y - e.y);
    if (p.stealthed) bd = 9999;
    for (const a of this.allies) {
      if (a.dead || a.flying) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      if (d < bd - 10 && d < 60) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- projectiles
  spawnEnemyProjectile(x: number, y: number, angle: number, sprite: string, dmg: number, el: Element, speed: number) {
    this.projectiles.push(new Projectile(this, { x, y, angle, speed, sprite, dmg, el, owner: 'enemy', range: 260 }));
  }

  spawnAllyProjectile(x: number, y: number, angle: number, sprite: string, dmg: number, el: Element) {
    this.projectiles.push(new Projectile(this, { x, y, angle, speed: 220, sprite, dmg, el, owner: 'player', fromAlly: true, range: 180 }));
  }

  spawnPlayerAttackProjectile(x: number, y: number, angle: number, sprite: string, pierce: number) {
    const p = this.player;
    const dmg = p.d.dmgMin + Math.random() * (p.d.dmgMax - p.d.dmgMin);
    const proj = new Projectile(this, { x, y, angle, speed: p.d.attack === 'ranged' ? 330 : 250, sprite, dmg, el: p.d.attack === 'magic' ? 'shadow' : 'phys', owner: 'player', pierce, range: p.d.range + 40, isAttack: true });
    // basic attack projectiles use attackHit for on-hit effects
    const orig = proj.hitEnemy.bind(proj);
    proj.hitEnemy = (e: Enemy) => {
      this.combat.attackHit(e, proj.vx, proj.vy);
      this.fx.burst(proj.x, proj.y, p.d.attack === 'magic' ? 0xc77dff : 0xffffff, 4);
      if (proj.pierceLeft > 0) proj.pierceLeft--;
      else proj.kill();
      void orig;
    };
    this.projectiles.push(proj);
  }

  spawnSpellProjectile(o: ProjOpts) {
    this.projectiles.push(new Projectile(this, o));
  }

  // ---------------------------------------------------------------- progression
  gainXp(amount: number) {
    const s = this.save;
    s.xp += amount;
    let leveled = false;
    while (s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level++;
      s.attrPoints += ATTR_POINTS_PER_LEVEL;
      s.spellPoints += SPELL_POINTS_PER_LEVEL;
      leveled = true;
      const unlocked = [...spellsForClass(s.cls), ...spellsForClass('universal')].filter((sp) => sp.lvl === s.level);
      for (const sp of unlocked) UI.toast(`Nové kouzlo: ${sp.name}${sp.ult ? ' (ultimátní)' : ''}`, '#c77dff');
      if (unlocked.length) autoLoadout(s);
    }
    if (leveled) {
      const p = this.player;
      p.recalc();
      p.hp = p.d.maxHp;
      p.mp = p.d.maxMp;
      sfx('levelup');
      this.fx.ring(p.x, p.y - 6, 40, 0xffd23a, 600);
      this.fx.burst(p.x, p.y - 6, 0xffd23a, 30);
      UI.levelUp(s.level);
      saveGame(s);
    }
    bus.emit('stats');
  }

  usePotion(kind: 'hpPotion' | 'mpPotion') {
    const p = this.player;
    if (p.dead || this.paused) return;
    if (this.save.mats[kind] <= 0) {
      UI.toast(kind === 'hpPotion' ? 'Nemáš lektvar zdraví' : 'Nemáš lektvar many', '#ff8080');
      return;
    }
    if (kind === 'hpPotion' && p.hp >= p.d.maxHp) return;
    if (kind === 'mpPotion' && p.mp >= p.d.maxMp) return;
    this.save.mats[kind]--;
    if (kind === 'hpPotion') {
      p.heal(p.d.maxHp * 0.45 + 30);
      this.fx.burst(p.x, p.y - 6, 0xff5050, 12);
    } else {
      p.mp = Math.min(p.d.maxMp, p.mp + p.d.maxMp * 0.6 + 20);
      this.fx.burst(p.x, p.y - 6, 0x4aa3ff, 12);
    }
    sfx('heal');
    bus.emit('stats');
  }

  castSlot(i: number) {
    if (this.paused || this.player.dead) return;
    this.spells.tryCast(i);
  }

  // ---------------------------------------------------------------- interactions
  findInteractable(): Interactable | null {
    const p = this.player;
    let best: Interactable | null = null,
      bd = 22;
    for (const it of this.interactables) {
      if (it.used) continue;
      if (it.kind === 'chest' && !it.data.locked && !it.data.bossChoice) continue; // auto-open
      if (it.kind === 'goldpile' || it.kind === 'mimic') continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  actionLabel(it: Interactable): string {
    switch (it.kind) {
      case 'stairs':
        return `Sestoupit (patro ${this.floor + 1})`;
      case 'door':
        return `Odemknout (paklíče: ${this.save.mats.lockpick})`;
      case 'chest':
        return it.data.bossChoice ? 'Vybrat tuto truhlu' : `Odemknout (paklíče: ${this.save.mats.lockpick})`;
      case 'merchant':
        return 'Obchodovat';
      case 'anvil':
        return 'Kovadlina';
      case 'shrine':
        return SHRINES[it.data.type]?.name ?? 'Svatyně';
      case 'fountain':
        return 'Napít se';
      case 'secret':
        return 'Prozkoumat zeď';
    }
    return 'Použít';
  }

  doAction() {
    if (this.paused || this.player.dead) return;
    const it = this.currentAction;
    if (it) this.interact(it);
  }

  interact(it: Interactable) {
    const p = this.player;
    switch (it.kind) {
      case 'stairs':
        UI.confirm(`Sestoupit do patra ${this.floor + 1}?`, 'Hra se uloží. Zpět se vrátit nelze.', () => this.nextFloor());
        break;
      case 'door':
      case 'chest':
        if (it.data.bossChoice) {
          UI.confirm('Otevřít tuto truhlu?', 'Můžeš si vybrat jen jednu ze tří. Ostatní zmizí.', () => this.openBossChest(it));
          return;
        }
        if (this.save.mats.lockpick <= 0) {
          UI.toast('Potřebuješ paklíč!', '#ff8080');
          return;
        }
        UI.lockpick(this.floor, (ok) => {
          if (ok) {
            if (it.kind === 'door') this.openDoor(it);
            else this.openChest(it);
          }
          bus.emit('stats');
        });
        break;
      case 'merchant':
        UI.openMerchant(this.merchantStocks.get(it)!);
        break;
      case 'anvil':
        UI.openForge();
        break;
      case 'shrine': {
        const def = SHRINES[it.data.type];
        it.used = true;
        (it.sprite as Phaser.GameObjects.Image).setTexture('shrine_used');
        it.data.glow?.destroy();
        this.shrineBuffs.push({ id: it.data.type, name: def.name, mods: def.mods, xp: def.xp, mf: def.mf, t: 90, total: 90, color: def.color });
        p.recalc();
        sfx('levelup');
        this.fx.ring(it.x, it.y - 10, 40, def.color, 600);
        this.fx.burst(p.x, p.y - 6, def.color, 24);
        UI.toast(`${def.name}: požehnání na 90 s`, '#' + def.color.toString(16).padStart(6, '0'));
        bus.emit('buffs');
        break;
      }
      case 'fountain':
        it.used = true;
        p.hp = p.d.maxHp;
        p.mp = p.d.maxMp;
        (it.sprite as Phaser.GameObjects.Sprite).stop().setTexture('fountain_used');
        sfx('heal');
        this.fx.burst(p.x, p.y - 6, 0x7cc8ff, 24);
        UI.toast('Plně obnoveno zdraví i mana', '#7cc8ff');
        break;
      case 'secret':
        this.revealSecret(it);
        break;
    }
  }

  refreshPlayerClass() {
    const p = this.player;
    const key = 'pl_' + this.save.cls;
    p.spriteKey = key;
    p.sprite.setTexture(key, 0);
    p.sprite.play(key + '_idle');
    p.recalc();
    this.fx.ring(p.x, p.y - 6, 30, 0xffd23a, 500);
    this.fx.burst(p.x, p.y - 6, 0xffd23a, 30);
  }

  revealSecret(it: Interactable) {
    it.used = true;
    this.map.openTile(it.tx, it.ty);
    sfx('door');
    this.fx.burst(it.x, it.y - 6, 0x9a99a6, 24, 'puff');
    this.fx.shake(0.004, 200);
    UI.toast('Objevil jsi tajnou místnost!', '#ffd23a');
  }

  openDoor(it: Interactable) {
    it.used = true;
    this.map.solid[this.map.idx(it.tx, it.ty)] = 0;
    (it.sprite as Phaser.GameObjects.Image).setTexture('door_open').setDepth(D.floorDeco);
    sfx('door');
    UI.toast('Dveře odemčeny', '#e9d27a');
  }

  openChest(it: Interactable) {
    if (it.used) return;
    it.used = true;
    const tier = it.data.tier ?? 'wood';
    (it.sprite as Phaser.GameObjects.Image).setTexture('chest_' + tier + '_open');
    sfx('chest');
    this.fx.burst(it.x, it.y - 8, tier === 'gold' || tier === 'boss' ? 0xffd23a : 0xffffff, 14);
    this.loot.chestDrops(tier, it.x, it.y);
  }

  openBossChest(it: Interactable) {
    this.openChest(it);
    for (const other of this.interactables) {
      if (other !== it && other.data?.bossChoice && !other.used) {
        other.used = true;
        const s = other.sprite!;
        this.fx.burst(s.x, s.y - 8, 0xb07dff, 20, 'puff');
        this.tweens.add({ targets: s, alpha: 0, scale: 0.2, duration: 500, onComplete: () => s.destroy() });
      }
    }
    UI.toast('Ostatní truhly se rozplynuly…', '#c77dff');
  }

  checkAutoInteract() {
    const p = this.player;
    for (const it of this.interactables) {
      if (it.used) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (it.kind === 'chest' && !it.data.locked && !it.data.bossChoice && d < 13) this.openChest(it);
      else if (it.kind === 'goldpile' && d < 12) {
        it.used = true;
        it.sprite?.destroy();
        for (let i = 0; i < 4; i++) this.loot.dropGold(this.loot.goldAmount(1.5), it.x, it.y);
      } else if (it.kind === 'mimic' && d < 22) {
        it.used = true;
        it.sprite?.destroy();
        const m = this.spawnEnemy('mimic', it.x, it.y - 2, false, -1);
        m.aggro = true;
        m.maxHp = m.hp = Math.round(m.maxHp * 1.2);
        UI.toast('Mimik! Truhla ožila!', '#ff6060');
        this.fx.shake(0.005, 200);
      }
    }
  }

  // ---------------------------------------------------------------- boss
  onBossAggro(b: Enemy) {
    sfx('boss');
    UI.showBoss(b);
    this.fx.shake(0.006, 300);
  }

  onBossKilled(b: Enemy) {
    this.bossDefeated = true;
    UI.hideBoss();
    UI.banner('Strážce poražen!', `${b.name} padl`);
    this.fx.shake(0.012, 500);
    // reward chests + stairs
    const br = this.dungeon.bossRoom!;
    const cx = br.cx,
      cy = br.cy + 2 <= br.y + br.h - 2 ? br.cy + 2 : br.cy;
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * 2,
        y = cy;
      if (this.map.tileAt(x, y) !== T_FLOOR) continue;
      const px = x * TS + 8,
        py = y * TS + 8;
      const s = this.add.image(px, y * TS + 16, 'chest_boss').setOrigin(0.5, 1).setDepth(D.entityBase + py).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, duration: 600, delay: 800 + (i + 1) * 200 });
      this.fx.burst(px, py, 0xb07dff, 16, 'puff');
      this.interactables.push({ kind: 'chest', x: px, y: py + 4, tx: x, ty: y, sprite: s, data: { tier: 'boss', bossChoice: true, locked: false } });
      this.addSparkle(s);
    }
    const ex = this.dungeon.exit;
    const st = this.add.image(ex.x * TS + 8, ex.y * TS + 8, 'stairs').setDepth(D.floorDeco).setAlpha(0);
    this.tweens.add({ targets: st, alpha: 1, duration: 800, delay: 1200 });
    const it: Interactable = { kind: 'stairs', x: ex.x * TS + 8, y: ex.y * TS + 8, tx: ex.x, ty: ex.y, sprite: st, data: {} };
    this.interactables.push(it);
    this.stairsObj = it;
    this.lamps.push({ x: it.x, y: it.y, r: 70, flicker: 0 });
    // clear minions
    for (const e of this.enemies) if (!e.dead && e.isMinion) this.combat.killEnemy(e);
  }

  // ---------------------------------------------------------------- death / floors
  onPlayerDeath() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    sfx('death');
    this.tweens.add({ targets: p.sprite, angle: 90 * p.facing, alpha: 0.5, duration: 500 });
    p.weapon?.setVisible(false);
    p.offhand?.setVisible(false);
    const lost = Math.round(this.save.gold * 0.15);
    this.time.delayedCall(900, () => UI.death(this.floor, lost));
  }

  respawn() {
    const lost = Math.round(this.save.gold * 0.15);
    this.save.gold -= lost;
    // lose part of current level progress
    this.save.xp = Math.round(this.save.xp * 0.7);
    saveGame(this.save);
    this.scene.restart({ save: this.save });
  }

  nextFloor() {
    sfx('stairs');
    this.save.floor = this.floor + 1;
    this.save.maxFloor = Math.max(this.save.maxFloor, this.save.floor);
    saveGame(this.save);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.restart({ save: this.save }));
  }

  // ---------------------------------------------------------------- main loop
  update(_t: number, dms: number) {
    if (this.paused) return;
    const dt = Math.min(0.05, dms / 1000);
    const p = this.player;
    this.playTimeT += dt;
    if (this.playTimeT >= 1) {
      this.save.playTime += this.playTimeT;
      this.playTimeT = 0;
    }

    // input
    let mx = UI.joy[0],
      my = UI.joy[1];
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.moveVec = [mx, my];

    if (!p.dead) p.update(dt, mx, my);

    // flow field toward player for enemy pathing
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.25;
      this.map.computeFlow(p.x, p.y, 45);
    }
    this.revealT -= dt;
    if (this.revealT <= 0) {
      this.revealT = 0.2;
      this.map.revealAround(p.x, p.y, 8);
    }

    for (const e of this.enemies) e.update(dt);
    this.separate();
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    for (const a of this.allies) a.update(dt);
    if (this.allies.some((a) => a.dead)) this.allies = this.allies.filter((a) => !a.dead);
    for (const pr of this.projectiles) pr.update(dt);
    if (this.projectiles.some((pr) => pr.dead)) this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    this.spells.update(dt);
    this.loot.update(dt);

    // shrine buffs
    if (this.shrineBuffs.length) {
      for (const b of this.shrineBuffs) b.t -= dt;
      const n = this.shrineBuffs.length;
      this.shrineBuffs = this.shrineBuffs.filter((b) => b.t > 0);
      if (n !== this.shrineBuffs.length) {
        p.recalc();
        bus.emit('buffs');
      }
    }

    if (!p.dead) {
      this.checkAutoInteract();
      const act = this.findInteractable();
      if (act !== this.currentAction) {
        this.currentAction = act;
        UI.setAction(act ? this.actionLabel(act) : null);
      }
    }

    this.drawHpBars();
    this.updateLighting(dt);

    this.saveT += dt;
    if (this.saveT > 20) {
      this.saveT = 0;
      saveGame(this.save);
    }
    UI.tick(dt);
  }

  separate() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.flying) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.flying) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const min = (a.r * a.baseScale + b.r * b.baseScale) * 0.9;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d,
            ny = dy / d;
          if (!a.boss) [a.x, a.y] = this.map.move(a.x, a.y, -nx * push, -ny * push, a.r);
          if (!b.boss) [b.x, b.y] = this.map.move(b.x, b.y, nx * push, ny * push, b.r);
        }
      }
    }
  }

  drawHpBars() {
    const g = this.hpBars;
    g.clear();
    const v = this.cameras.main.worldView;
    for (const e of this.enemies) {
      if (e.dead || e.boss) continue;
      if (e.hp >= e.maxHp && !e.elite) continue;
      if (e.x < v.x - 20 || e.x > v.right + 20 || e.y < v.y - 20 || e.y > v.bottom + 20) continue;
      const w = e.elite ? 18 : 12;
      const x = Math.round(e.x - w / 2),
        y = Math.round(e.y - 20 * e.baseScale - 2);
      g.fillStyle(0x000000, 0.75);
      g.fillRect(x - 1, y - 1, w + 2, 4);
      g.fillStyle(0x3a0b0b, 1);
      g.fillRect(x, y, w, 2);
      g.fillStyle(e.elite ? 0xffa020 : 0xe0242c, 1);
      g.fillRect(x, y, Math.max(0, Math.round((w * e.hp) / e.maxHp)), 2);
    }
    for (const a of this.allies) {
      if (a.dead || a.def.totem || a.hp >= a.maxHp) continue;
      const w = 10;
      const x = Math.round(a.x - w / 2),
        y = Math.round(a.y - 18 * a.baseScale);
      g.fillStyle(0x000000, 0.7);
      g.fillRect(x - 1, y - 1, w + 2, 3);
      g.fillStyle(0x52ff8f, 1);
      g.fillRect(x, y, Math.round((w * a.hp) / a.maxHp), 1);
    }
  }

  updateLighting(dt: number) {
    const cam = this.cameras.main;
    const v = cam.worldView;
    // DynamicTexture sizes are forced even – compare against even sizes or it resizes every frame
    let w = Math.ceil(v.width) + 4,
      h = Math.ceil(v.height) + 4;
    w += w % 2;
    h += h % 2;
    const rt = this.dark;
    if (rt.width !== w || rt.height !== h) rt.resize(w, h);
    const ox = Math.floor(v.x) - 2,
      oy = Math.floor(v.y) - 2;
    rt.setPosition(ox, oy);
    rt.clear();
    rt.fill(0x05040a, this.darkness);
    const L = this.lightImg;
    const t = this.time.now / 1000;
    const p = this.player;
    const inView = (x: number, y: number, r: number) => x > -r && y > -r && x < w + r && y < h + r;
    // all lights are drawn into one capture which is then erased from the darkness in a single pass
    rt.beginDraw();
    L.setAlpha(0.6);
    L.setScale((145 * 2) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    L.setAlpha(1);
    L.setScale((92 * 2) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    for (const l of this.lamps) {
      const x = l.x - ox,
        y = l.y - oy;
      if (!inView(x, y, l.r)) continue;
      const fl = l.flicker ? 1 + Math.sin(t * 9 + l.flicker) * 0.04 + Math.sin(t * 23 + l.flicker * 3) * 0.03 : 1;
      L.setScale((l.r * 2 * fl) / 128);
      rt.batchDraw(L, x, y);
      if (l.glow) l.glow.setAlpha(0.18 + (fl - 1) * 1.5);
    }
    // glowing projectiles add light
    let n = 0;
    for (const pj of this.projectiles) {
      if (n > 14) break;
      if (pj.sprite.blendMode === Phaser.BlendModes.ADD && inView(pj.x - ox, pj.y - oy, 30)) {
        L.setScale(60 / 128);
        rt.batchDraw(L, pj.x - ox, pj.y - oy);
        n++;
      }
    }
    // spell fields light up their area
    for (const f of this.spells.fields) {
      L.setScale((f.r * 2.2) / 128);
      rt.batchDraw(L, f.x - ox, f.y - oy);
    }
    // bosses glow a bit so they are always visible
    if (this.boss && !this.boss.dead && this.boss.aggro) {
      L.setScale(120 / 128);
      rt.batchDraw(L, this.boss.x - ox, this.boss.y - 10 - oy);
    }
    rt.endDraw(true);
    void dt;
  }
}
