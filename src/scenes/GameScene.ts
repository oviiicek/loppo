import Phaser from 'phaser';
import { generateDungeon, Dungeon, DObject, T_FLOOR } from '../systems/dungeon';
import { WorldMap, TS } from '../game/map';
import { FX, D } from '../game/fx';
import { Player } from '../game/player';
import { Enemy, Ally, Projectile, ProjOpts, Actor, THIEF_ESCAPE } from '../game/entities';
import { Combat } from '../game/combat';
import { Spells } from '../game/spells';
import { Loot } from '../game/loot';
import { BossAI } from '../game/boss';
import { ENEMY_BY_ID, bossForFloor, isBossFloor, enemyDmgScale, storyBossForFloor, STORY_END } from '../data/enemies';
import { CHAPTERS, noteForFloor } from '../data/story';
import { SaveData, saveGame, xpForLevel, ATTR_POINTS_PER_LEVEL, SPELL_POINTS_PER_LEVEL, autoLoadout, bumpStat, storyOf } from '../systems/state';
import { ACHIEVEMENTS, achievementReward } from '../data/achievements';
import { spellsForClass, BuffMods } from '../data/spells';
import { generateItem } from '../data/items';
import { Item } from '../data/types';
import { Element } from '../data/types';
import { UI } from '../ui/ui';
import { createAllAnims } from '../gfx/anims';
import { THEMES, themeForFloor, ACTOR_SCALE, isPropTex } from '../gfx/textures';
import { hash } from '../gfx/pixel';
import { areaForFloor } from '../data/biomes';
import { bus } from '../systems/events';
import { sfx, settings } from '../systems/audio';

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
  // items the player sold here, newest first – can be bought back for the same price
  buyback?: { it: Item; price: number }[];
}

export interface FloorMod {
  id: string;
  name: string;
  desc: string;
  enemyHp?: number;
  enemyDmg?: number;
  xp?: number;
  gold?: number;
  mf?: number;
  extraEnemies?: number;
  eliteMult?: number;
  darkness?: number;
  chestBonus?: boolean;
}

export const FLOOR_MODS: FloorMod[] = [
  { id: 'dark', name: 'Temnota', desc: 'Je tu větší tma, ale kořist je lepší', darkness: 0.85, mf: 40 },
  { id: 'gold', name: 'Zlatá horečka', desc: 'Nepřátelé a truhly dávají dvojnásobek zlata', gold: 1 },
  { id: 'curse', name: 'Prokletí', desc: 'Silnější nepřátelé, víc zkušeností a lepší kořist', enemyHp: 1.2, enemyDmg: 1.25, xp: 0.4, mf: 40 },
  { id: 'horde', name: 'Hordy', desc: 'Mnohem víc nepřátel a víc zkušeností', extraEnemies: 0.4, xp: 0.2 },
  { id: 'champions', name: 'Šampioni', desc: 'Elitních nepřátel je třikrát víc', eliteMult: 3, mf: 20 },
  { id: 'treasure', name: 'Poklady', desc: 'Truhly obsahují lepší předměty', chestBonus: true },
];

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
  targetMarker!: Phaser.GameObjects.Image;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  flowT = 0;
  revealT = 0;
  saveT = 0;
  boss: Enemy | null = null;
  bossDefeated = false;
  stairsObj: Interactable | null = null;
  /** the stairs the hero came down (the start of the floor) */
  upStairs: { x: number; y: number } | null = null;
  /** the hero is walking the stairs: the world holds still and input is ignored */
  cinematic = false;
  cinematicMove = false;
  descending = false;
  paused = false;
  zoom = 3;
  darkness = 0.48;
  revealedRooms = new Set<number>();
  mod: FloorMod | null = null;
  merchantStocks = new Map<Interactable, MerchantStock>();
  currentAction: Interactable | null = null;
  playTimeT = 0;
  floorKills = 0;
  /** lingering danger zones (spore clouds, void pools) left by story guardians */
  hazards: { x: number; y: number; r: number; dps: number; el: Element; t: number; tick: number; img: Phaser.GameObjects.Image }[] = [];

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
    this.glows = [];
    this.traps = [];
    this.shrineBuffs = [];
    this.boss = null;
    this.bossDefeated = false;
    this.stairsObj = null;
    this.upStairs = null;
    this.cinematic = true;
    this.cinematicMove = false;
    this.descending = false;
    this.paused = false;
    this.merchantStocks = new Map();
    this.currentAction = null;
    this.floorKills = 0;
    this.deathAt = 0;
    this.darkness = 0.48;
    this.revealedRooms = new Set<number>();
    this.mod = null;
    this.hazards = [];
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

    // the hero arrives down the stairs from the floor above and steps off them (see arrive)
    const s = this.dungeon.start;
    const ux = s.x * TS + 8,
      uy = s.y * TS + 8;
    this.add.image(ux, uy, 'stairs_up').setScale(ACTOR_SCALE).setDepth(D.floorDeco);
    this.upStairs = { x: ux, y: uy };
    this.player = new Player(this, ux, uy, save);
    // ~25 % of regular floors get a random modifier
    const forced = (window as any).__forceMod as string | undefined; // dev testing hook
    this.mod = forced
      ? FLOOR_MODS.find((m) => m.id === forced) ?? null
      : !isBossFloor(this.floor) && this.floor > 1 && Math.random() < 0.25
        ? FLOOR_MODS[Math.floor(Math.random() * FLOOR_MODS.length)]
        : null;
    this.darkness = this.theme.darkness;
    if (this.mod?.darkness) this.darkness = this.mod.darkness;
    this.placeObjects();
    this.lamps.push({ x: ux, y: uy, r: 56, flicker: 0 });
    this.placeStoryPage();
    this.spawnEnemies();

    // camera
    const cam = this.cameras.main;
    // stay inside the map (everything beyond is rock anyway, no black border)
    cam.setBounds(0, 0, this.map.w * TS, this.map.h * TS);
    cam.setZoom(this.zoom);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    this.scale.on('resize', this.onResize, this);

    // darkness
    this.dark = this.add.renderTexture(0, 0, 64, 64).setOrigin(0).setDepth(D.dark);
    this.lightImg = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
    this.hpBars = this.add.graphics().setDepth(D.bright + 5);
    this.targetMarker = this.add.image(0, 0, 'ring').setTint(0xff4040).setAlpha(0).setDepth(D.floorDeco + 2).setBlendMode(Phaser.BlendModes.ADD);

    // input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,Q,E,H,J,I,C,K,M,ESC,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
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
    kb.on('keydown-M', () => UI.bigMap());

    this.map.revealAround(this.player.x, this.player.y, 8);
    this.updateGlowVisibility();
    UI.attachGame(this);
    save.floor = this.floor;
    save.maxFloor = Math.max(save.maxFloor, this.floor);
    saveGame(save);
    this.events.once('shutdown', () => this.cleanup());
    (window as any).__scene = this;
    void this.beginFloor();
  }

  // story scenes that belong to this point of the descent, then the floor banner
  async beginFloor() {
    const save = this.save;
    const st = storyOf(save);
    const queue: string[] = [];
    if (!st.seen.includes('prolog')) queue.push('prolog');
    if (this.floor <= STORY_END) {
      const ci = Math.min(CHAPTERS.length - 1, Math.floor((this.floor - 1) / 50));
      if (ci > 0 && !st.seen.includes('ch' + (ci + 1))) queue.push('ch' + (ci + 1));
    }
    const story = storyBossForFloor(this.floor);
    const sub =
      story && !st.seen.includes(story.outro)
        ? `Zde čeká ${story.name} – ${story.title}`
        : isBossFloor(this.floor)
          ? 'Patro strážce – připrav se!'
          : this.mod
            ? `${this.mod.name}: ${this.mod.desc}`
            : this.dungeon.hasMerchant
              ? 'Někde zde čeká obchodník…'
              : '';
    // came down the stairs: the title card is already up; story scenes play over it
    const cardUp = UI.floorCardUp(this.floor);
    // a new area or a guardian deserves a longer look at the card (a tap shortens it)
    const hold = this.floor % 10 === 1 || isBossFloor(this.floor) || sub ? 2600 : 1900;
    if (cardUp) {
      UI.floorCardSub(sub);
      await UI.holdFloorCard(queue.length ? 1900 : hold);
    }
    for (const id of queue) {
      await UI.cutscene(id);
      if (!this.sys.isActive() && !this.sys.isPaused()) return;
    }
    if (!cardUp) {
      UI.floorCard(this.floorCardInfo(), sub);
      await UI.holdFloorCard(hold);
    }
    if (!this.sys.isActive() && !this.sys.isPaused()) return;
    UI.hideFloorCard();
    this.arrive();
    if (this.floor === 1 && save.kills === 0 && save.level === 1) this.tutorial();
  }

  /** title card of a floor: its number, the name of its ten-floor area and the biome */
  floorCardInfo(floor = this.floor) {
    const th = THEMES[themeForFloor(floor)];
    const a = areaForFloor(floor);
    const range = a.to === Infinity ? `hloubka ${floor - STORY_END}` : `patra ${a.from}–${a.to}`;
    return { floor, name: a.name, region: `${th.title} · ${range}`, color: th.glow[0] };
  }

  /** the hero walks off the stairs onto the floor, then the floor is theirs */
  arrive() {
    const p = this.player;
    const u = this.upStairs;
    const done = () => {
      this.cinematic = false;
      this.cinematicMove = false;
    };
    if (!u || p.dead) return done();
    // first free spot next to the stairs, below them if possible
    let tx = u.x,
      ty = u.y + 15;
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const x = u.x + dx * 15,
        y = u.y + 2 + dy * 15;
      if (!this.map.collides(x, y, p.r + 1) && !this.map.collides((u.x + x) / 2, (u.y + y) / 2, p.r)) {
        tx = x;
        ty = y;
        break;
      }
    }
    if (this.map.collides(tx, ty, p.r)) return done();
    if (Math.abs(tx - p.x) > 1) p.facing = tx > p.x ? 1 : -1;
    this.cinematicMove = true;
    this.tweens.add({ targets: p, x: tx, y: ty, duration: 620, ease: 'Sine.easeOut', onComplete: done });
  }

  tutorial() {
    const tips = [
      'Pohybuj se joystickem vlevo dole (na PC klávesy WASD).',
      'Útok je automatický – stačí se přiblížit k nepříteli na dosah zbraně.',
      'Kouzla sesíláš tlačítky vpravo. Velké tlačítko je ultimátní kouzlo.',
      'Lektvary obnoví zdraví a manu. Truhly se otevřou, když na ně stoupneš.',
      'Najdi schody dolů a sestup hlouběji. Každé 5. patro hlídá strážce!',
    ];
    tips.forEach((t, i) => this.time.delayedCall(2800 + i * 6000, () => UI.hint(t, 5500)));
  }

  get theme() {
    return THEMES[themeForFloor(this.floor)];
  }

  /** biome name for the HUD (the endless depths below the story say so) */
  get placeName() {
    return (this.floor > STORY_END ? 'Hlubina · ' : '') + this.theme.name;
  }

  computeZoom() {
    const h = this.scale.height,
      w = this.scale.width;
    const z = Math.max(2, Math.min(Math.floor(h / 215), Math.floor(w / 380)));
    // tiles are drawn at double resolution, so only even zoom levels map them to whole pixels
    this.zoom = z - (z % 2);
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
    createAllAnims(this);
  }

  // ---------------------------------------------------------------- world objects
  // visuals of objects inside not yet discovered secret rooms
  hiddenObjs = new Map<number, Phaser.GameObjects.GameObject[]>();

  // a page of Elara's diary (or another message) waits near the start of every tenth floor
  placeStoryPage() {
    const id = noteForFloor(this.floor);
    if (!id || storyOf(this.save).seen.includes(id)) return;
    const st = this.dungeon.start;
    let pos: [number, number] | null = null;
    for (let k = 0; k < 30 && !pos; k++) {
      const p = this.map.randomFloorNear(st.x * TS + 8, st.y * TS + 8, 44);
      // clear of the stairs and the spot where the hero steps off them
      if (p && Math.hypot(p[0] - (st.x * TS + 8), p[1] - (st.y * TS + 8)) > 30) pos = p;
    }
    pos ??= [st.x * TS + 8 + TS * 2, st.y * TS + 8];
    const [x, y] = pos;
    const img = this.add.image(x, y, 'page').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 3);
    this.tweens.add({ targets: img, y: y - 3, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    const beam = this.add.image(x, y + 3, 'beam').setOrigin(0.5, 1).setTint(0xffe8a0).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setScale(0.8, 0.9);
    this.interactables.push({ kind: 'page', x, y, tx: Math.floor(x / TS), ty: Math.floor(y / TS), sprite: img, data: { id, beam } });
    this.lamps.push({ x, y, r: 46, flicker: 0 });
  }

  async readPage(it: Interactable) {
    it.used = true;
    it.sprite?.destroy();
    it.data.beam?.destroy();
    sfx('pickup');
    await UI.cutscene(it.data.id);
    UI.toast('Stránka je uložená v Kronice (pauza)', '#e8d8b0');
  }

  placeObjects() {
    const d = this.dungeon;
    this.hiddenObjs = new Map();
    for (const o of d.objects) {
      const before = this.children.list.length;
      this.placeObject(o);
      this.halveProps(before);
      if (this.map.isHidden(o.x, o.y)) {
        const room = d.roomId[this.map.idx(o.x, o.y)];
        const added = this.children.list.slice(before);
        for (const g of added) (g as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(false);
        this.hiddenObjs.set(room, [...(this.hiddenObjs.get(room) ?? []), ...added]);
      }
    }
    // secret walls are interactables
    for (const s of d.secretWalls) {
      this.interactables.push({ kind: 'secret', x: s.x * TS + 8, y: s.y * TS + 14, tx: s.x, ty: s.y, data: {} });
      // walls seen from above get a faint crack as the only hint (front faces use a cracked tile)
      if (this.map.tileAt(s.x, s.y + 1) !== T_FLOOR || this.map.isHidden(s.x, s.y + 1)) {
        const crack = this.add.image(s.x * TS + 8, s.y * TS + 8, 'wallcrack').setDepth(D.wallDeco - 1).setAlpha(0.75);
        this.interactables[this.interactables.length - 1].data.crack = crack;
      }
    }
    for (const dr of d.lockedDoors) {
      this.map.solid[this.map.idx(dr.x, dr.y)] = 1;
    }
  }

  // furniture textures have double resolution: show them at half scale
  halveProps(from: number) {
    for (const g of this.children.list.slice(from)) {
      const im = g as Phaser.GameObjects.Image;
      if (im.texture && isPropTex(im.texture.key)) im.setScale(im.scaleX * ACTOR_SCALE, im.scaleY * ACTOR_SCALE);
    }
  }

  placeObject(o: DObject) {
    const px = o.x * TS + 8,
      py = o.y * TS + 8;
    const add = (key: string, depthOffset = 0, oy = 1) => this.add.image(px, o.y * TS + 16 * oy, key).setOrigin(0.5, oy).setDepth(D.entityBase + o.y * TS + 8 + depthOffset);
    // the deeper biomes swap the dungeon furniture for their own decorations
    const style = this.theme.style;
    const natural = style !== 'bricks';
    const roll = hash(o.x, o.y, this.floor + 17);
    if (natural && (o.kind === 'crate' || o.kind === 'barrel' || o.kind === 'bones' || o.kind === 'skull') && roll < 0.45) {
      add(`deco_${style}_${roll < 0.25 ? 'a' : 'b'}`);
      return;
    }
    if (natural && o.kind === 'moss' && style !== 'cave') {
      if (style === 'ice') this.add.image(px, py, 'deco_ice_b').setDepth(D.floorDeco);
      return;
    }
    if (natural && o.kind === 'puddle' && (style === 'ice' || style === 'lava')) return;
    switch (o.kind) {
      case 'torch': {
        const key = natural ? 'torch_' + style : 'torch';
        const s = this.add.sprite(px, o.y * TS + 9, key).play(key + '_loop').setDepth(D.wallDeco);
        s.anims.setProgress(Math.random());
        const glow = this.add.image(px, o.y * TS + 6, 'glow').setTint(this.theme.torch).setAlpha(0.22).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        this.trackGlow(glow, o.x, o.y + 1);
        // warm pool of light on the floor below the torch
        const pool = this.add.image(px, o.y * TS + 26, 'glow').setTint(this.theme.torch).setAlpha(0.16).setScale(3.2, 2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.floorDeco + 1);
        this.trackGlow(pool, o.x, o.y + 1);
        this.lamps.push({ x: px, y: o.y * TS + 12, r: 92, flicker: Math.random() * 10, glow });
        break;
      }
      case 'banner':
        this.add.image(px, o.y * TS + 1, natural ? 'deco_wall_' + style : 'banner_' + (o.data?.color ?? 'blue')).setOrigin(0.5, 0).setDepth(D.wallDeco);
        break;
      case 'bookshelf':
        if (natural) this.add.image(px, o.y * TS + 1, 'deco_wall_' + style).setOrigin(0.5, 0).setDepth(D.wallDeco);
        else this.add.image(px, o.y * TS - 2, 'bookshelf').setOrigin(0.5, 0).setDepth(D.wallDeco);
        break;
      case 'wallcrack':
        this.add.image(px, o.y * TS + 8, 'wallcrack').setDepth(D.wallDeco - 1);
        break;
      case 'crate':
      case 'barrel':
      case 'pot': {
        const s = add(o.kind);
        if (this.theme.propTint) s.setTint(this.theme.propTint);
        this.interactables.push({ kind: 'breakable', x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: { what: o.kind } });
        break;
      }
      case 'table':
      case 'skull':
        add(o.kind);
        if (o.kind === 'table') this.lamps.push({ x: px, y: py, r: 50, flicker: Math.random() * 10 });
        break;
      case 'spikes': {
        const s = this.add.sprite(px, py, 'spikes', 0).setDepth(D.floorDeco + 1);
        this.traps.push({ x: px, y: py, sprite: s, t: Math.random() * 3, hit: false });
        break;
      }
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
        this.interactables.push({ kind: 'door', x: px, y: py + 2, tx: o.x, ty: o.y, sprite: s, data: {} });
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
        const s = this.add.sprite(px, py + 6, 'npc_merchant').setOrigin(0.5, 1).setScale(ACTOR_SCALE).play('npc_merchant_idle').setDepth(D.entityBase + py);
        this.add.image(px, py + 6, 'shadow').setDepth(D.floorDeco + 2);
        const it: Interactable = { kind: 'merchant', x: px, y: py + 6, tx: o.x, ty: o.y, sprite: s, data: {} };
        this.interactables.push(it);
        this.merchantStocks.set(it, this.makeStock());
        this.lamps.push({ x: px, y: py, r: 80, flicker: 0 });
        const t = this.fx.label(px, py - 16, 'Obchodník', '#ffd23a', 6);
        t.setDepth(99980);
        break;
      }
      case 'anvil': {
        const s = add('anvil');
        this.interactables.push({ kind: 'anvil', x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: {} });
        this.lamps.push({ x: px, y: py, r: 60, flicker: 3 });
        const glow = this.add.image(px - 6, py - 2, 'glow').setTint(0xff7a1a).setAlpha(0.25).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        this.trackGlow(glow, o.x, o.y);
        void glow;
        break;
      }
      case 'shrine': {
        const type = o.data?.type ?? 'power';
        const s = add('shrine_' + type);
        this.interactables.push({ kind: 'shrine', x: px, y: py + 4, tx: o.x, ty: o.y, sprite: s, data: { type } });
        const col = SHRINES[type]?.color ?? 0xffffff;
        const glow = this.add.image(px, py - 6, 'glow').setTint(col).setAlpha(0.3).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
        this.trackGlow(glow, o.x, o.y);
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

  glows: { img: Phaser.GameObjects.Image; i: number }[] = [];
  traps: { x: number; y: number; sprite: Phaser.GameObjects.Sprite; t: number; hit: boolean }[] = [];

  // spike traps cycle: retracted 1.8 s, warning 0.35 s, extended 0.8 s
  updateTraps(dt: number) {
    const p = this.player;
    for (const tr of this.traps) {
      tr.t = (tr.t + dt) % 2.95;
      const up = tr.t >= 2.15;
      const warn = tr.t >= 1.8 && !up;
      tr.sprite.setFrame(up ? 1 : 0);
      tr.sprite.setTint(warn ? 0xff9a9a : 0xffffff);
      if (!up) {
        tr.hit = false;
        continue;
      }
      if (!tr.hit && !p.dead && Math.abs(p.x - tr.x) < 8 && Math.abs(p.y - tr.y) < 8) {
        tr.hit = true;
        this.combat.damagePlayer(7 * enemyDmgScale(this.floor), null);
        this.fx.burst(tr.x, tr.y, 0xcfd6dc, 6, 'pix');
      }
    }
  }

  // additive glows sit above the fog, so hide them until their tile has been explored
  trackGlow(img: Phaser.GameObjects.Image, tx: number, ty: number) {
    const i = this.map.idx(tx, ty);
    img.setVisible(!!this.map.explored[i]);
    this.glows.push({ img, i });
  }

  updateGlowVisibility() {
    for (const g of this.glows) if (!g.img.visible && this.map.explored[g.i]) g.img.setVisible(true);
  }

  addSparkle(s: Phaser.GameObjects.Image) {
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (!s.active || !s.visible || s.texture.key.endsWith('_open')) return;
        this.fx.burst(s.x + (Math.random() - 0.5) * 12, s.y - 8 - Math.random() * 6, 0xffe45c, 1, 'pix');
      },
    });
  }

  makeStock(): MerchantStock {
    const f = this.floor;
    const items: Item[] = [];
    for (let i = 0; i < 9; i++) items.push(generateItem(f + Math.floor(Math.random() * 3), { magicFind: 30, rarityBonus: Math.random() < 0.25 ? 1 : 0, filter: i < 3 ? this.loot.bias() : undefined }));
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
    const m = this.mod;
    const spawns = [...this.dungeon.spawns];
    if (m?.extraEnemies) {
      const extra = Math.round(spawns.length * m.extraEnemies);
      for (let i = 0; i < extra; i++) {
        const b = spawns[Math.floor(Math.random() * spawns.length)];
        if (b) spawns.push({ ...b, elite: false });
      }
    }
    for (const sp of spawns) {
      const def = ENEMY_BY_ID[sp.id];
      if (!def) continue;
      const elite = sp.elite || (!!m?.eliteMult && Math.random() < 0.08 * (m.eliteMult - 1));
      const ox = sp.x * TS + 8 + (Math.random() - 0.5) * 6,
        oy = sp.y * TS + 10 + (Math.random() - 0.5) * 6;
      const e = this.spawnEnemy(sp.id, ox, oy, elite, sp.room);
      if (m?.enemyHp) e.maxHp = e.hp = Math.round(e.maxHp * m.enemyHp);
      if (m?.enemyDmg) e.dmg *= m.enemyDmg;
    }
    this.spawnThief();
    const br = this.dungeon.bossRoom;
    if (br) {
      const story = storyBossForFloor(this.floor);
      if (story && !storyOf(this.save).seen.includes(story.outro)) {
        const e = this.spawnEnemy('skeleton', br.cx * TS + 8, br.cy * TS + 8, false, br.id, story.phases[0].sprite);
        e.makeStoryBoss(story, this.floor);
        this.boss = e;
      } else {
        const { def, tier } = bossForFloor(this.floor);
        const e = this.spawnEnemy('skeleton', br.cx * TS + 8, br.cy * TS + 8, false, br.id, def.sprite);
        e.makeBoss(def, tier, this.floor);
        this.boss = e;
      }
    }
  }

  thief: Enemy | null = null;

  // a treasure goblin hides on some floors (much more often during a gold rush)
  spawnThief() {
    this.thief = null;
    if (this.floor < 2 || isBossFloor(this.floor)) return;
    const forced = (window as any).__forceThief; // dev testing hook
    if (!forced && Math.random() > (this.mod?.id === 'gold' ? 0.6 : 0.14)) return;
    const st = this.dungeon.start;
    const rooms = this.dungeon.rooms.filter((r) => r.type === 'normal' && Math.hypot(r.cx - st.x, r.cy - st.y) > (forced ? 4 : 18));
    const r = rooms[Math.floor(Math.random() * rooms.length)];
    if (!r) return;
    this.thief = this.spawnEnemy('thief', r.cx * TS + 8, r.cy * TS + 10, false, r.id);
  }

  onThiefSpotted(_e: Enemy) {
    sfx('coin');
    UI.toast('Zlatý skřet! Chyť ho, než uteče!', '#ffd23a');
  }

  thiefEscapes(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.fx.burst(e.x, e.y - 6, 0xb07dff, 24, 'puff');
    this.fx.burst(e.x, e.y - 6, 0xffd23a, 12);
    this.tweens.add({ targets: e.sprite, alpha: 0, scaleX: 0, duration: 300, onComplete: () => e.destroyVisuals() });
    this.tweens.add({ targets: e.shadow, alpha: 0, duration: 300 });
    sfx('stairs');
    UI.toast('Zlatý skřet utekl portálem…', '#c8a8ff');
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
      if (needLos && !this.map.canSee(x, y, e.x, e.y)) continue;
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
    if (this.paused || this.player.dead || this.cinematic) return;
    this.spells.tryCast(i);
  }

  // ---------------------------------------------------------------- interactions
  findInteractable(): Interactable | null {
    const p = this.player;
    let best: Interactable | null = null,
      bd = 24;
    for (const it of this.interactables) {
      if (it.used) continue;
      if (it.kind === 'chest' && !it.data.locked && !it.data.bossChoice) continue; // auto-open
      if (it.kind === 'goldpile' || it.kind === 'mimic' || it.kind === 'breakable' || it.kind === 'page') continue;
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
    if (this.paused || this.player.dead || this.cinematic) return;
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
            bumpStat(this.save, 'locks');
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
    it.data.crack?.destroy();
    bumpStat(this.save, 'secrets');
    this.map.openTile(it.tx, it.ty);
    // the room behind the crack appears
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = it.tx + dx,
        y = it.ty + dy;
      if (!this.map.isHidden(x, y)) continue;
      const id = this.dungeon.roomId[this.map.idx(x, y)];
      const room = this.dungeon.rooms.find((r) => r.id === id);
      if (!room) continue;
      this.map.unhideRoom(id, room.cells);
      for (const g of this.hiddenObjs.get(id) ?? []) (g as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(true);
      this.hiddenObjs.delete(id);
      this.revealedRooms.add(id);
      this.map.revealRoom(room.cells);
      this.updateGlowVisibility();
    }
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
    bumpStat(this.save, 'chests');
    const tier = it.data.tier ?? 'wood';
    (it.sprite as Phaser.GameObjects.Image).setTexture('chest_' + tier + '_open');
    sfx('chest');
    this.fx.burst(it.x, it.y - 8, tier === 'gold' || tier === 'boss' ? 0xffd23a : 0xffffff, 14);
    this.loot.chestDrops(tier, it.x, it.y);
  }

  breakObject(it: Interactable) {
    it.used = true;
    const s = it.sprite!;
    const col = it.data.what === 'pot' ? 0x9a5a32 : 0x8a5a2b;
    this.fx.burst(s.x, s.y - 6, col, 10, 'pix');
    this.fx.burst(s.x, s.y - 6, 0x888888, 3, 'puff');
    sfx('hit');
    s.destroy();
    const r = Math.random();
    if (r < 0.25) this.loot.dropGold(this.loot.goldAmount(0.6), it.x, it.y - 4);
    else if (r < 0.29) this.loot.dropMat('hpPotion', 1, it.x, it.y - 4);
    else if (r < 0.32) this.loot.dropMat('mpPotion', 1, it.x, it.y - 4);
    else if (r < 0.33) this.loot.dropMat('lockpick', 1, it.x, it.y - 4);
  }

  openBossChest(it: Interactable) {
    this.openChest(it);
    for (const other of this.interactables) {
      if (other !== it && other.data?.bossChoice && !other.used) {
        other.used = true;
        const s = other.sprite!;
        this.fx.burst(s.x, s.y - 8, 0xb07dff, 20, 'puff');
        this.tweens.add({ targets: s, alpha: 0, scale: 0.2 * ACTOR_SCALE, duration: 500, onComplete: () => s.destroy() });
      }
    }
    UI.toast('Ostatní truhly se rozplynuly…', '#c77dff');
  }

  checkAutoInteract() {
    const p = this.player;
    for (const it of this.interactables) {
      if (it.used) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (it.kind === 'page' && d < 14) this.readPage(it);
      else if (it.kind === 'breakable' && d < 11) this.breakObject(it);
      else if (it.kind === 'chest' && !it.data.locked && !it.data.bossChoice && d < 13) this.openChest(it);
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
    if (b.story) {
      void this.storyBossIntro(b);
      return;
    }
    sfx('boss');
    UI.showBoss(b);
    UI.banner(b.name, b.bossTier > 0 ? 'Prastarý strážce hlubin' : 'Strážce patra');
    this.fx.shake(0.006, 300);
    // first boss ever: teach the one thing that matters
    if (!this.save.stats?.bosses) this.time.delayedCall(1800, () => UI.hint('Červené kruhy ukazují, kam strážce udeří – včas z nich uhni!', 6000));
  }

  // ---------------------------------------------------------------- story guardians
  async storyBossIntro(b: Enemy) {
    const def = b.story!;
    sfx('boss');
    this.fx.shake(0.006, 300);
    b.invuln = true;
    if (!storyOf(this.save).seen.includes(def.intro)) await UI.cutscene(def.intro, { overlay: true });
    b.invuln = false;
    UI.showBoss(b);
    UI.banner(b.name, def.title);
    if (!this.save.stats?.bosses) this.time.delayedCall(1800, () => UI.hint('Červené kruhy ukazují, kam strážce udeří – včas z nich uhni!', 6000));
  }

  /** a story guardian's stage is spent: clear the field, play its words and bring the next stage */
  async storyNextPhase(e: Enemy) {
    if (e.invuln || e.dead) return;
    e.invuln = true;
    e.windup = 99;
    e.charging = 0;
    this.clearBossField();
    this.fx.shake(0.012, 700);
    this.fx.ring(e.x, e.y - 10, 90, 0xffffff, 700);
    this.fx.burst(e.x, e.y - 10, 0xffffff, 30, 'puff');
    sfx('boss');
    await new Promise<void>((r) => this.time.delayedCall(900, () => r()));
    if (e.dead || !this.sys.isActive()) return;
    const next = e.story!.phases[e.phase + 1];
    if (next.intro) await UI.cutscene(next.intro, { overlay: true });
    e.applyPhase(e.phase + 1, this.floor);
    this.fx.burst(e.x, e.y - 10, 0xb07dff, 40, 'puff');
    this.fx.ring(e.x, e.y - 10, 70, 0xb07dff, 600);
    e.invuln = false;
    e.windup = 0.8;
    UI.showBoss(e);
    UI.banner(`${e.name}`, `Fáze ${e.phase + 1} z ${e.phaseCount}`);
  }

  clearBossField() {
    for (const pr of this.projectiles) if (!pr.dead && pr.o.owner === 'enemy') pr.kill();
    for (const m of this.enemies) if (!m.dead && m.isMinion) this.combat.killEnemy(m);
    this.clearHazards();
  }

  async storyBossDefeated(b: Enemy) {
    const def = b.story!;
    const st = storyOf(this.save);
    this.bossDefeated = true;
    bumpStat(this.save, 'bosses');
    UI.hideBoss();
    this.clearBossField();
    this.fx.shake(0.016, 900);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 250, () => this.fx.ring(b.x, b.y - 10, 60 + i * 30, 0xfff2c0, 600));
    if (def.floor < STORY_END) {
      st.shards = Math.max(st.shards, def.floor / 50);
      if (def.floor === 200) st.blessing = true;
      this.player.recalc();
    } else st.ended = true;
    saveGame(this.save);
    await new Promise<void>((r) => this.time.delayedCall(1400, () => r()));
    if (!this.sys.isActive()) return;
    await UI.cutscene(def.outro);
    this.spawnBossRewards();
    if (def.floor === STORY_END) UI.storyEnd();
    else UI.banner('Zámek pečeti obnoven!', `Pečetní střepy: ${st.shards}/4 · +${st.shards * 4 + (st.blessing ? 10 : 0)} % zdraví a poškození`);
    saveGame(this.save);
  }

  addHazard(x: number, y: number, r: number, dps: number, el: Element, dur: number, color: number) {
    const img = this.add.image(x, y, 'disc').setTint(color).setAlpha(0.32).setScale((r * 2) / 256).setDepth(D.floorDeco + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: img, alpha: 0.18, yoyo: true, repeat: -1, duration: 500 });
    this.hazards.push({ x, y, r, dps, el, t: dur, tick: 0.25, img });
  }

  updateHazards(dt: number) {
    if (!this.hazards.length) return;
    const p = this.player;
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.t < 0.6) h.img.setAlpha(Math.max(0, h.t / 0.6) * 0.3);
      if (h.t <= 0 || p.dead) continue;
      if (Math.hypot(p.x - h.x, p.y - h.y) < h.r) {
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 0.5;
          this.combat.damagePlayer(h.dps * 0.5, null, h.el, true);
        }
      }
    }
    const left = this.hazards.filter((h) => h.t > 0);
    for (const h of this.hazards) if (h.t <= 0) h.img.destroy();
    this.hazards = left;
  }

  clearHazards() {
    for (const h of this.hazards) h.img.destroy();
    this.hazards = [];
  }

  onBossKilled(b: Enemy) {
    if (b.story) {
      void this.storyBossDefeated(b);
      return;
    }
    this.bossDefeated = true;
    bumpStat(this.save, 'bosses');
    UI.hideBoss();
    UI.banner('Strážce poražen!', `${b.name} padl`);
    this.fx.shake(0.012, 500);
    this.spawnBossRewards();
  }

  // the guardian's reward: three chests to choose one from, and the stairs down
  spawnBossRewards() {
    const br = this.dungeon.bossRoom!;
    const cx = br.cx,
      cy = br.cy + 2 <= br.y + br.h - 2 ? br.cy + 2 : br.cy;
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * 2,
        y = cy;
      if (this.map.tileAt(x, y) !== T_FLOOR) continue;
      const px = x * TS + 8,
        py = y * TS + 8;
      const s = this.add.image(px, y * TS + 16, 'chest_boss').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + py).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, duration: 600, delay: 800 + (i + 1) * 200 });
      this.fx.burst(px, py, 0xb07dff, 16, 'puff');
      this.interactables.push({ kind: 'chest', x: px, y: py + 4, tx: x, ty: y, sprite: s, data: { tier: 'boss', bossChoice: true, locked: false } });
      this.addSparkle(s);
    }
    const ex = this.dungeon.exit;
    const st = this.add.image(ex.x * TS + 8, ex.y * TS + 8, 'stairs').setScale(ACTOR_SCALE).setDepth(D.floorDeco).setAlpha(0);
    this.tweens.add({ targets: st, alpha: 1, duration: 800, delay: 1200 });
    const it: Interactable = { kind: 'stairs', x: ex.x * TS + 8, y: ex.y * TS + 8, tx: ex.x, ty: ex.y, sprite: st, data: {} };
    this.interactables.push(it);
    this.stairsObj = it;
    this.lamps.push({ x: it.x, y: it.y, r: 70, flicker: 0 });
    // clear minions
    for (const e of this.enemies) if (!e.dead && e.isMinion) this.combat.killEnemy(e);
  }

  // ---------------------------------------------------------------- achievements
  achT = 0;
  checkAchievements() {
    const s = this.save;
    const got = s.achievements ?? (s.achievements = []);
    for (const a of ACHIEVEMENTS) {
      if (got.includes(a.id) || !a.check(s)) continue;
      got.push(a.id);
      const r = a.reward;
      if (r.gold) s.gold += r.gold;
      if (r.stone) s.mats.stone += r.stone;
      if (r.dust) s.mats.dust += r.dust;
      if (r.lockpick) s.mats.lockpick += r.lockpick;
      if (r.attr) s.attrPoints += r.attr;
      sfx('levelup');
      UI.toast(`🏆 Úspěch: ${a.name} – ${achievementReward(a.reward)}`, '#ffd23a');
    }
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
    this.deathAt = this.time.now;
  }

  deathAt = 0;

  respawn() {
    const lost = Math.round(this.save.gold * 0.15);
    this.save.gold -= lost;
    // lose part of current level progress
    this.save.xp = Math.round(this.save.xp * 0.7);
    saveGame(this.save);
    this.scene.restart({ save: this.save });
  }

  /** walk onto the stairs and down into the dark; the title card of the next floor covers the loading */
  nextFloor() {
    if (this.descending) return;
    this.descending = true;
    this.cinematic = true;
    this.save.floor = this.floor + 1;
    this.save.maxFloor = Math.max(this.save.maxFloor, this.save.floor);
    saveGame(this.save);
    this.currentAction = null;
    UI.setAction(null);
    UI.joy = [0, 0];
    const p = this.player;
    p.target = null;
    p.armed = false;
    p.invulnT = 99;
    this.targetMarker.setAlpha(0);
    const st = this.stairsObj;
    const sx = st ? st.x : p.x,
      sy = st ? st.y : p.y;
    const top = sy - 6;
    const walk = Phaser.Math.Clamp(Math.hypot(sx - p.x, top - p.y) / 40, 0.15, 0.7) * 1000;
    if (Math.abs(sx - p.x) > 1) p.facing = sx > p.x ? 1 : -1;
    this.cinematicMove = true;
    this.tweens.add({
      targets: p,
      x: sx,
      y: top,
      duration: walk,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // step by step down the stairs, fading into the dark below
        sfx('stairs');
        [0, 230, 460].forEach((d) => this.time.delayedCall(d, () => sfx('step')));
        const fall = { k: 0 };
        this.tweens.add({ targets: p, y: sy + 7, duration: 820, ease: 'Sine.easeIn' });
        this.tweens.add({
          targets: fall,
          k: 1,
          duration: 820,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            const c = Math.round(255 - fall.k * 215);
            const tint = (c << 16) | (c << 8) | c;
            const a = 1 - Math.max(0, fall.k - 0.5) / 0.5;
            p.sprite.setTint(tint).setAlpha(a);
            p.weapon?.setTint(tint);
            p.offhand?.setTint(tint);
            p.shadow.setAlpha(1 - fall.k);
          },
        });
        const cam = this.cameras.main;
        cam.zoomTo(this.zoom * 1.2, 1000, 'Sine.easeInOut');
        this.time.delayedCall(380, () => cam.fadeOut(520, 0, 0, 0));
        this.time.delayedCall(940, () => {
          UI.floorCard(this.floorCardInfo(this.floor + 1), '', true);
          this.scene.restart({ save: this.save });
        });
      },
    });
  }

  // ---------------------------------------------------------------- main loop
  update(_t: number, dms: number) {
    if (this.paused) return;
    const dt = Math.min(0.05, dms / 1000);
    const p = this.player;
    if (this.cinematic) {
      // walking the stairs: the world holds still, the hero is moved by tweens, the light follows
      p.scriptedTick(dt, this.cinematicMove);
      this.dark.setVisible(!settings.lowFx);
      if (!settings.lowFx) this.updateLighting(dt);
      UI.tick(dt);
      return;
    }
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
      let changed = this.map.revealAround(p.x, p.y, 10);
      // stepping into a room lights up all of it (walls included)
      const rid = this.dungeon.roomId[this.map.idx(Math.floor(p.x / TS), Math.floor(p.y / TS))];
      if (rid >= 0 && !this.revealedRooms.has(rid)) {
        this.revealedRooms.add(rid);
        const room = this.dungeon.rooms.find((r) => r.id === rid);
        if (room) changed = this.map.revealRoom(room.cells) || changed;
      }
      if (changed) this.updateGlowVisibility();
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
    this.updateTraps(dt);
    this.updateHazards(dt);

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

    // safety net: a dead player must always see the death screen
    if (p.dead && !UI.panel && this.deathAt && this.time.now - this.deathAt > 2500) {
      this.deathAt = this.time.now;
      UI.death(this.floor, Math.round(this.save.gold * 0.15));
    }
    this.drawHpBars();
    // marker under the auto-attack target
    const tgt = p.target;
    if (tgt && !tgt.dead && !p.dead) {
      const sz = (tgt.r * tgt.baseScale * 2 + 10) / 256;
      this.targetMarker.setPosition(tgt.x, tgt.y + 2).setScale(sz, sz * 0.55).setAlpha(0.55 + Math.sin(this.time.now / 140) * 0.2);
    } else this.targetMarker.setAlpha(0);
    // power-saving graphics skip the dynamic lighting (the most expensive render pass)
    this.dark.setVisible(!settings.lowFx);
    if (!settings.lowFx) this.updateLighting(dt);

    this.achT += dt;
    if (this.achT > 1) {
      this.achT = 0;
      this.checkAchievements();
    }
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
      const thief = e.def.behavior === 'thief' && e.spotted;
      if (e.hp >= e.maxHp && !e.elite && !thief) continue;
      if (e.x < v.x - 20 || e.x > v.right + 20 || e.y < v.y - 20 || e.y > v.bottom + 20) continue;
      if (!thief && !this.map.explored[this.map.idx(Math.floor(e.x / TS), Math.floor(e.y / TS))]) continue;
      if (thief) {
        // time left before the goblin escapes through its portal
        const tw = 18;
        const tx = Math.round(e.x - tw / 2),
          ty = Math.round(e.y - 20 * e.baseScale - 6);
        g.fillStyle(0x000000, 0.75);
        g.fillRect(tx - 1, ty - 1, tw + 2, 3);
        g.fillStyle(e.escapeT < 5 ? 0xff5050 : 0xffd23a, 1);
        g.fillRect(tx, ty, Math.max(0, Math.round((tw * e.escapeT) / THIEF_ESCAPE)), 1);
      }
      const w = e.elite || thief ? 18 : 12;
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
    rt.fill(this.theme.dark, this.darkness);
    const L = this.lightImg;
    const t = this.time.now / 1000;
    const p = this.player;
    const inView = (x: number, y: number, r: number) => x > -r && y > -r && x < w + r && y < h + r;
    // all lights are drawn into one capture which is then erased from the darkness in a single pass
    rt.beginDraw();
    L.setAlpha(0.65);
    L.setScale((210 * 2) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    L.setAlpha(1);
    L.setScale((135 * 2) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    for (const l of this.lamps) {
      const x = l.x - ox,
        y = l.y - oy;
      if (!inView(x, y, l.r)) continue;
      if (this.map.isHidden(Math.floor(l.x / TS), Math.floor(l.y / TS))) continue;
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
