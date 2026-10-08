import Phaser from 'phaser';
import { generateDungeon, Dungeon, DObject, T_FLOOR, eliteChanceFor } from '../systems/dungeon';
import { WorldMap, TS } from '../game/map';
import { FX, D } from '../game/fx';
import { Player } from '../game/player';
import { Enemy, Ally, Projectile, ProjOpts, Actor, THIEF_ESCAPE } from '../game/entities';
import { Combat } from '../game/combat';
import { Spells } from '../game/spells';
import { Powers } from '../game/powers';
import { Loot } from '../game/loot';
import { BossAI } from '../game/boss';
import { ENEMY_BY_ID, bossForFloor, isBossFloor, enemyDmgScale, storyBossForFloor, STORY_END, corruptName } from '../data/enemies';
import { CHAPTERS, noteForFloor } from '../data/story';
import { SaveData, saveGame, xpForLevel, ATTR_POINTS_PER_LEVEL, SPELL_POINTS_PER_LEVEL, autoLoadout, bumpStat, maxStat, storyOf, buryHero, petsOf, addToInventory } from '../systems/state';
import { PetFollower } from '../game/pet';
import { Mercenary } from '../game/merc';
import { MercRole, MERC_BY_ROLE, randomMercName, MercOrder, MercState } from '../data/mercs';
import { RivalMood, RIVAL_PEOPLE, RIVAL_GREETING, rivalRole, rivalFoeBase, rivalToll } from '../data/rivals';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { syncCodex } from '../data/codex';
import { Weather } from '../game/weather';
import { PET_BY_ID, PetId, petTitle, cagePetFor, cageChance, petLevel } from '../data/pets';
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
import { Difficulty, difficultyOf } from '../data/difficulty';
import { bus } from '../systems/events';
import { sfx, settings } from '../systems/audio';
import { Nemesis, NEMESIS_MAX, nemesisName, nemesisTitle, victimOf, nemesisPower, nemesisLabel } from '../data/nemesis';
import { Encounters, RiftKind } from '../game/encounters';
import { Village, dayPhase, phaseName } from '../game/village';
import { QuestLog } from '../game/quests';
import { generateVillage } from '../systems/villagemap';
import { BUILDINGS, villageOf } from '../data/village';
import { ClassId } from '../data/types';
import { potionMult } from '../data/village';
import { BEASTS, bestiaryOf, KNOW_AT, EL_NAME } from '../data/bestiary';

/** seconds between kills that keep a kill streak going */
const STREAK_WINDOW = 2.6;

/** news about the pet to show once the hero is on the next floor ("Mína reached level 3") */
let pendingPetNews: string | null = null;

/** the optional task of a floor (shown under the minimap): kill monsters, champions, open chests… */
export interface Bounty {
  kind: 'kill' | 'elite' | 'chest' | 'break' | 'explore';
  text: string;
  goal: number;
  have: number;
  done: boolean;
}

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
  life: { name: 'Svatyně života', mods: { regenPct: 1.5 }, color: 0xff6aa0 },
  storm: { name: 'Svatyně bouře', mods: { novaPulse: 0.5 }, color: 0x7ae0ff },
  gems: { name: 'Svatyně klenotů', mods: {}, mf: 30, color: 0xff9ab0 },
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
  /** combat difficulty of this floor (a change in the pause menu applies from the next floor) */
  diff!: Difficulty;
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
  hazards: { x: number; y: number; r: number; dps: number; el: Element; t: number; tick: number; img: Phaser.GameObjects.Image; src?: string; slow?: boolean; a?: number; foe?: Enemy }[] = [];
  /** the pet travelling with the hero */
  pet: PetFollower | null = null;
  /** the last blow the hero took (who, how hard, what kind of source) for the death screen */
  lastHit: { who: string; amount: number; el: Element; kind: string; foe?: Enemy | null } | null = null;
  /** the optional task of this floor */
  bounty: Bounty | null = null;
  /** dust, spores, snow, embers or wisps of the biome */
  weather: Weather | null = null;
  /** floor tiles outside secret rooms (for the exploring task) */
  private floorTiles = 0;
  /** a cursed chest challenge in progress */
  cursed: { it: Interactable; t: number; total: number; waveT: number; spawned: Enemy[] } | null = null;
  /** random events of the floor (captives, altars, ghosts, portals, brawls, the arena …) */
  enc!: Encounters;
  /** this floor is a rift or a dream behind a portal */
  rift: RiftKind | null = null;
  /** the hero is home in Loppo (no monsters, the villagers' houses) */
  inVillage = false;
  /** the colour of the darkness when it is not the biome's (the night sky over Loppo) */
  darkColor: number | null = null;
  /** how far the hero's own light reaches (a starry night in Loppo needs less of it) */
  heroLight = 1;
  vil!: Village;
  /** quests from the notice board */
  quests!: QuestLog;
  /** the special powers of the monster families */
  powers!: Powers;

  constructor() {
    super('Game');
  }

  init(data: { save: SaveData; rift?: RiftKind; village?: boolean }) {
    this.save = data.save;
    this.rift = data.rift ?? null;
    this.inVillage = !!data.village;
    this.floor = this.save.floor;
    this.diff = difficultyOf(this.save);
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
    this.darkColor = null;
    this.heroLight = 1;
    this.revealedRooms = new Set<number>();
    this.mod = null;
    this.hazards = [];
    this.pet = null;
    this.merc = null;
    this.rival = null;
    this.rivalFoe = null;
    this.rivalAlly = false;
    this.lastHit = null;
    this.cursed = null;
    this.bounty = null;
    this.nemesis = null;
    this.nemesisNote = null;
    this.phoenixUsed = false;
    this.arenaDark = 0;
    this.hitStop = 0;
  }

  create() {
    const save = this.save;
    const rift = this.rift;
    // pity: guarantee merchants regularly
    const forceMerchant = save.merchantPity >= 3;
    this.dungeon = this.inVillage ? generateVillage(this.floor) : generateDungeon(this.floor, (Math.random() * 1e9) | 0, { forceMerchant, rift: rift ?? undefined });
    if (!rift && !this.inVillage) {
      if (this.dungeon.hasMerchant) save.merchantPity = 0;
      else save.merchantPity++;
    }

    this.map = new WorldMap(this.dungeon);
    this.map.build(this);
    this.computeZoom();
    this.fx = new FX(this, this.zoom);
    this.combat = new Combat(this);
    this.powers = new Powers(this);
    this.spells = new Spells(this);
    this.loot = new Loot(this);
    this.bossAI = new BossAI(this);
    this.enc = new Encounters(this);
    this.vil = new Village(this);
    this.quests = new QuestLog(this);
    this.createAnims();

    // the hero arrives down the stairs from the floor above and steps off them (see arrive)
    const s = this.dungeon.start;
    const ux = s.x * TS + 8,
      uy = s.y * TS + 8;
    // (in the village the hero comes up through the gate, drawn by the village itself)
    if (!this.inVillage) this.add.image(ux, uy, 'stairs_up').setScale(ACTOR_SCALE).setDepth(D.floorDeco);
    this.upStairs = { x: ux, y: uy };
    this.player = new Player(this, ux, uy, save);
    // ~25 % of regular floors get a random modifier
    const forced = (window as any).__forceMod as string | undefined; // dev testing hook
    this.mod = rift || this.inVillage
      ? null
      : forced
        ? FLOOR_MODS.find((m) => m.id === forced) ?? null
        : !isBossFloor(this.floor) && this.floor > 1 && Math.random() < 0.25
          ? FLOOR_MODS[Math.floor(Math.random() * FLOOR_MODS.length)]
          : null;
    this.darkness = rift === 'dream' ? 0.16 : this.theme.darkness;
    if (this.mod?.darkness) this.darkness = this.mod.darkness;
    this.placeObjects();
    this.lamps.push({ x: ux, y: uy, r: 56, flicker: 0 });
    const home = this.inVillage;
    if (!rift && !home) this.placeStoryPage();
    this.spawnEnemies();
    if (!rift && !home) {
      this.placePetCage();
      this.placeCursedChest();
      this.placeAlchemist();
      this.rollBounty();
    }
    // the pet and the mercenary come down the stairs right after the hero (shown in arrive)
    this.spawnPet(ux, uy + 4, false);
    this.spawnMerc(ux, uy + 4, false);
    syncCodex(this.save);
    if (!rift && !home) this.spawnRival();
    else this.rival = null;
    // what else happens on this floor (a rift has its own rules, the village is home)
    if (rift) this.enc.setupRift(rift);
    else if (home) this.vil.place();
    else {
      this.enc.place();
      this.quests.placeFloorQuests();
    }
    UI.hideEventBar();

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
    this.weather = new Weather(this, this.inVillage ? this.vil.weather : this.theme.style);
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
    UI.bounty(this.bounty);
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
    if (!st.seen.includes('prolog') && !this.inVillage) queue.push('prolog');
    if (this.floor <= STORY_END && !this.inVillage) {
      const ci = Math.min(CHAPTERS.length - 1, Math.floor((this.floor - 1) / 50));
      if (ci > 0 && !st.seen.includes('ch' + (ci + 1))) queue.push('ch' + (ci + 1));
    }
    const story = storyBossForFloor(this.floor);
    const homeCount = BUILDINGS.filter((b) => b.who && (villageOf(save).lv[b.id] ?? 0) > 0).length;
    const sub = this.inVillage
      ? `Domov · zachráněno ${homeCount} ze ${BUILDINGS.filter((b) => b.who).length} vesničanů`
      : this.rift === 'rift'
      ? 'Trhlina: poraz nestvůry, přivolej strážce a zavři ji'
      : this.rift === 'dream'
        ? 'Snový svět: sbírej poklady, než se probudíš'
        : story && !st.seen.includes(story.outro)
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
      UI.floorCard(this.inVillage ? this.villageCardInfo() : this.floorCardInfo(), sub);
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

  /** the title card of the village */
  villageCardInfo() {
    return { floor: this.floor, name: 'Loppo', region: `Vesnice pod Šedými horami · ${phaseName(dayPhase())}`, color: '#ffd76a', top: 'Domov' };
  }

  /** the hero walks off the stairs onto the floor, then the floor is theirs */
  arrive() {
    const p = this.player;
    const u = this.upStairs;
    const done = () => {
      this.cinematic = false;
      this.cinematicMove = false;
      this.petArrives();
      if (pendingPetNews) {
        sfx('pet');
        UI.toast(pendingPetNews, '#ffb3d0');
        this.pet?.emote('♥');
        pendingPetNews = null;
      }
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
    return THEMES[this.dungeon?.theme ?? themeForFloor(this.floor)];
  }

  /** biome name for the HUD (the endless depths below the story say so) */
  get placeName() {
    if (this.inVillage) return 'Loppo';
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
        // the village's crates are just furniture
        if (o.data?.decor) break;
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
        this.combat.cause = 'Bodcová past';
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
      let elite = sp.elite || (!!m?.eliteMult && Math.random() < 0.08 * (m.eliteMult - 1));
      // fewer champions on the easy difficulty, more on the hard ones
      const ef = this.diff.elite;
      if (elite && ef < 1 && Math.random() > ef) elite = false;
      else if (!elite && ef > 1 && Math.random() < eliteChanceFor(this.floor) * (ef - 1)) elite = true;
      const ox = sp.x * TS + 8 + (Math.random() - 0.5) * 6,
        oy = sp.y * TS + 10 + (Math.random() - 0.5) * 6;
      const e = this.spawnEnemy(sp.id, ox, oy, elite, sp.room);
      if (m?.enemyHp) e.maxHp = e.hp = Math.round(e.maxHp * m.enemyHp);
      if (m?.enemyDmg) e.dmg *= m.enemyDmg;
    }
    if (!this.rift && !this.inVillage) {
      this.spawnThief();
      this.spawnNemesis();
    }
    this.maybeCorrupt();
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

  /** now and then one monster of a floor is corrupted: a rare, dark and much stronger version of itself */
  maybeCorrupt() {
    if (this.inVillage || this.floor < 4) return;
    const forced = (window as any).__forceCorrupt; // dev testing hook
    const chance = Math.min(0.2, 0.08 + this.floor * 0.0015) * (this.rift ? 2 : 1);
    if (!forced && Math.random() > chance) return;
    const st = this.dungeon.start;
    const pool = this.enemies.filter((e) => !e.dead && !e.boss && !e.def.thing && !e.isMinion && !e.nemesis && !e.tag && !e.def.group && !['thief', 'mimic', 'static'].includes(e.def.behavior) && Math.hypot(e.x / TS - st.x, e.y / TS - st.y) > (forced ? 4 : 14));
    pool.sort((a, b) => Math.hypot(a.x / TS - st.x, a.y / TS - st.y) - Math.hypot(b.x / TS - st.x, b.y / TS - st.y));
    const e = forced ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
    e?.makeCorrupt();
  }

  /** the first look at a corrupted monster */
  onCorruptSpotted(e: Enemy) {
    sfx('boss');
    this.fx.shake(0.008, 400);
    this.cameras.main.flash(300, 90, 20, 140);
    this.freeze(0.15);
    this.fx.ring(e.x, e.y - 8, 70, 0x9a2aff, 700);
    this.fx.burst(e.x, e.y - 8, 0x9a2aff, 24, 'puff');
    UI.banner(`☠ ${corruptName(e.def)}!`, `Zkažená nestvůra · pětinásobné zdraví · ${e.affixes.join(', ')} · jistá vzácná kořist`);
    e.nameLabel = this.fx.label(e.x, e.y - 20, `☠ ${corruptName(e.def)}`, '#c88aff', 6);
    e.nameLabel.setDepth(99980);
  }

  onCorruptKilled(_e: Enemy) {
    bumpStat(this.save, 'corrupted');
    sfx('levelup');
    UI.toast('☠ Zkáza zahnána – zkažená nestvůra nechala bohatou kořist!', '#c88aff');
  }

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

  spawnEnemy(id: string, x: number, y: number, elite: boolean, room: number, spriteOverride?: string, affix?: string | null): Enemy {
    const base = ENEMY_BY_ID[id];
    const def = spriteOverride ? { ...base, sprite: spriteOverride } : base;
    const e = new Enemy(this, def, x, y, this.floor, elite, room, affix);
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

  /** the streak ran out: five kills or more pay a bonus share of their experience */
  endStreak() {
    const { n, xp } = this.streak;
    this.streak = { n: 0, t: 0, xp: 0 };
    UI.streak(0, 0);
    if (n < 5 || this.player.dead) return;
    const bonus = Math.max(1, Math.round(xp * Math.min(0.8, n * 0.03)));
    maxStat(this.save, 'streak', n);
    UI.streakEnd(n, bonus);
    this.gainXp(bonus);
    sfx('coin');
  }

  // ---------------------------------------------------------------- floor task
  /** every regular floor below the first gets one optional task fitting what the floor holds */
  rollBounty() {
    this.bounty = null;
    if (this.floor < 2 || isBossFloor(this.floor)) return;
    const d = this.dungeon;
    const elites = d.spawns.filter((sp) => sp.elite).length;
    const chests = this.interactables.filter((it) => it.kind === 'chest' && !it.data.locked && !this.map.isHidden(it.tx, it.ty)).length;
    const breakables = this.interactables.filter((it) => it.kind === 'breakable' && !this.map.isHidden(it.tx, it.ty)).length;
    this.floorTiles = 0;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (this.map.isFloorVisible(x, y)) this.floorTiles++;
    const opts: [Bounty['kind'], number, string][] = [];
    const n = Phaser.Math.Clamp(Math.round(d.spawns.length * 0.55), 12, 60);
    opts.push(['kill', n, `Poraz ${n} nestvůr`]);
    if (elites >= 2) {
      const k = Math.min(3, elites);
      opts.push(['elite', k, `Poraz ${k} ${k < 5 ? 'šampiony' : 'šampionů'}`]);
    }
    if (chests >= 2) {
      const k = Math.min(3, chests);
      opts.push(['chest', k, `Otevři ${k} truhly`]);
    }
    if (breakables >= 6) {
      const k = Math.min(10, Math.round(breakables * 0.6));
      opts.push(['break', k, `Rozbij ${k} ${k < 5 ? 'bedny a nádoby' : 'beden a nádob'}`]);
    }
    if (this.floorTiles > 200) opts.push(['explore', 75, 'Prozkoumej 75 % patra']);
    const forced = (window as any).__forceBounty as string | undefined; // dev testing hook
    const pick = opts.find((o) => o[0] === forced) ?? opts[Math.floor(Math.random() * opts.length)];
    this.bounty = { kind: pick[0], goal: pick[1], text: pick[2], have: 0, done: false };
  }

  /** progress of the floor task (kills, chests, broken things; exploring is measured in update) */
  bountyStep(kind: Bounty['kind'], by = 1) {
    const b = this.bounty;
    if (!b || b.done || b.kind !== kind) return;
    b.have = Math.min(b.goal, kind === 'explore' ? by : b.have + by);
    if (b.have >= b.goal) this.completeBounty();
    else UI.bounty(b);
  }

  /** the task is done: the reward falls at the hero's feet */
  completeBounty() {
    const b = this.bounty!;
    b.done = true;
    const p = this.player;
    const f = this.floor;
    sfx('levelup');
    this.fx.ring(p.x, p.y - 6, 36, 0xffd23a, 600);
    this.loot.dropItem(this.loot.item(f + 1, Math.random() < 0.2 ? 2 : 1), p.x, p.y);
    for (let i = 0; i < 3; i++) this.loot.dropGold(this.loot.goldAmount(2), p.x, p.y);
    this.loot.dropMat(Math.random() < 0.5 ? 'stone' : 'dust', 1 + Math.floor(f / 25), p.x, p.y);
    if (Math.random() < 0.3) this.loot.dropMat('lockpick', 1, p.x, p.y);
    if (Math.random() < 0.3) this.loot.dropRandomGem(p.x, p.y);
    bumpStat(this.save, 'bounties');
    UI.bounty(b);
    UI.toast(`✔ Úkol splněn: ${b.text}! Odměna padla k tvým nohám.`, '#ffd76a');
    bus.emit('stats');
  }

  /** kills in quick succession: their count, the time left to keep it going, the experience they gave */
  streak = { n: 0, t: 0, xp: 0 };

  /** a monster died (the floor task counts kills and champions; quick kills build a streak) */
  onKill(e: Enemy, xp = 0) {
    this.floorKills++;
    const st = this.streak;
    st.n = st.t > 0 ? st.n + 1 : 1;
    st.t = STREAK_WINDOW;
    st.xp += xp;
    this.bountyStep('kill');
    if (e.elite) {
      this.bountyStep('elite');
      bumpStat(this.save, 'elites');
    }
    if (e.nemesis) this.nemesisDefeated(e);
    if (e.rivalFoe) this.rivalDefeated(e);
    this.enc.onKill(e);
    if (!e.boss) this.learnBeast(e.def.id);
  }

  /** the bestiary counts kills of each kind and tells what was learned */
  learnBeast(id: string) {
    const info = BEASTS[id];
    if (!info) return;
    const b = bestiaryOf(this.save);
    const k = (b[id] = (b[id] ?? 0) + 1);
    const name = ENEMY_BY_ID[id]?.name ?? id;
    const els = (l: Element[]) => l.map((x) => EL_NAME[x]).join(', ') || 'žádné';
    if (k === 1) UI.toast(`📖 Nový záznam v bestiáři: ${name}`, '#e8d8b0');
    else if (k === KNOW_AT.weak) UI.toast(`📖 ${name}: slabiny ${els(info.weak)} · odolnosti ${els(info.resist)}`, '#ffd76a');
    else if (k === KNOW_AT.loot) UI.toast(`📖 ${name}: v bestiáři je i jeho kořist`, '#e8d8b0');
    else if (k === KNOW_AT.master1) UI.toast(`📖 Mistrovství: ${name} – +5 % poškození proti nim`, '#9dff7a');
    else if (k === KNOW_AT.master2) UI.toast(`📖 Velmistrovství: ${name} – +10 % poškození proti nim`, '#9dff7a');
  }

  // ---------------------------------------------------------------- nemesis
  /** the nemesis waiting on this floor */
  nemesis: Enemy | null = null;
  /** what the death screen says about a nemesis that was born or grew */
  nemesisNote: string | null = null;

  /** a nemesis whose time has come waits somewhere on the floor */
  spawnNemesis() {
    this.nemesis = null;
    const list = this.save.nemeses ?? [];
    if (!list.length || this.floor < 3 || isBossFloor(this.floor)) return;
    const forced = (window as any).__forceNemesis; // dev testing hook
    const ready = list.filter((n) => n.next <= this.floor).sort((a, b) => a.next - b.next);
    const n = ready[0];
    if (!n) return;
    // it comes for sure once it has waited a few floors
    if (!forced && this.floor < n.next + 4 && Math.random() > 0.45) return;
    const spot = this.freeSpot(forced ? 5 : 14) ?? this.freeSpot(5);
    if (!spot) return;
    const base = ENEMY_BY_ID[n.base] && ENEMY_BY_ID[n.base].behavior !== 'thief' ? n.base : 'skeleton';
    const e = this.spawnEnemy(base, spot.x * TS + 8, spot.y * TS + 10, true, spot.room, undefined, n.affix);
    const pw = nemesisPower(n);
    e.maxHp = e.hp = Math.round(e.maxHp * pw.hp);
    e.dmg *= pw.dmg;
    e.speed *= pw.speed;
    e.xp = Math.round(e.xp * 3);
    e.nemesis = n;
    e.name = nemesisLabel(n);
    e.setScale(e.baseScale * 1.12);
    e.sprite.preFX?.addGlow(0xff2a2a, 3, 0, false, 0.1, 14);
    this.nemesis = e;
  }

  /** the nemesis shows itself when the hero first sees it; its name follows it around */
  updateNemesis() {
    const e = this.nemesis;
    if (!e) return;
    if (e.dead) {
      this.nemesis = null;
      return;
    }
    const p = this.player;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (!e.spotted && d < 150 && this.map.los(e.x, e.y, p.x, p.y)) {
      const n = e.nemesis!;
      e.spotted = true;
      e.aggro = true;
      sfx('boss');
      this.fx.shake(0.006, 300);
      this.fx.ring(e.x, e.y - 8, 50, 0xff2a2a, 600);
      UI.banner(`☠ ${n.name}, ${n.title}`, `Tvůj nemesis · ${e.def.name} · úroveň ${n.level}`);
      e.nameLabel = this.fx.label(e.x, e.y - 20, `☠ ${n.name} · úr. ${n.level}`, '#ff6a5a', 6);
      e.nameLabel.setDepth(99980);
    }
    if (e.nameLabel) {
      e.nameLabel.setPosition(Math.round(e.x), Math.round(e.y - 15 * e.baseScale));
      e.nameLabel.setVisible(d < 230);
    }
  }

  /** a champion that kills the hero may take a name (or a nemesis grows stronger) */
  recordNemesis() {
    this.nemesisNote = null;
    const s = this.save;
    if (s.hardcore) return;
    const foe = this.lastHit?.foe;
    if (!foe || !foe.elite || foe.boss || foe.story || foe.isMinion || foe.summoner || foe.def.behavior === 'thief') return;
    const list = s.nemeses ?? (s.nemeses = []);
    if (foe.nemesis) {
      const n = list.find((x) => x.id === foe.nemesis!.id) ?? foe.nemesis;
      n.kills++;
      n.level = Math.max(n.level + 3, s.level + 2);
      if (n.kills >= 3 && !n.title.startsWith('Noční můra')) n.title = nemesisTitle(victimOf(s.heroName, s.cls), n.kills);
      n.next = this.floor + 2;
      if (!list.includes(n)) list.push(n);
      this.nemesisNote = `☠ ${n.name}, ${n.title}, tě porazil už ${n.kills}× a sílí – teď má úroveň ${n.level}. Ještě se potkáte!`;
    } else {
      // the first champion to kill the hero always takes a name, later ones often
      if (list.length && Math.random() > 0.65) return;
      const n: Nemesis = {
        id: Date.now(),
        name: nemesisName(),
        title: nemesisTitle(victimOf(s.heroName, s.cls), 1),
        base: foe.def.id,
        affix: foe.eliteAffix,
        level: s.level + 2,
        kills: 1,
        born: this.floor,
        next: this.floor + 2,
      };
      list.push(n);
      while (list.length > NEMESIS_MAX) list.shift();
      this.nemesisNote = `☠ Tvůj přemožitel dostal jméno: ${n.name}, ${n.title} (úroveň ${n.level}). Až ho porazíš, čeká tě bohatá kořist.`;
    }
    saveGame(s);
  }

  /** revenge: the nemesis is gone for good and leaves a rich reward */
  nemesisDefeated(e: Enemy) {
    const n = e.nemesis!;
    const s = this.save;
    s.nemeses = (s.nemeses ?? []).filter((x) => x.id !== n.id);
    bumpStat(s, 'nemeses');
    sfx('levelup');
    this.fx.shake(0.008, 320);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 160, () => this.fx.ring(e.x, e.y - 8, 40 + i * 20, 0xff5a4a, 500));
    UI.banner('Pomsta!', `${n.name}, ${n.title}, padl`);
    this.loot.nemesisDrops(e.x, e.y, n.kills);
    this.nemesis = null;
    saveGame(s);
  }

  // ---------------------------------------------------------------- alchemist
  /** now and then an alchemist sets up his cauldron on a floor: five items of a rarity melt into a better one */
  placeAlchemist() {
    const forced = (window as any).__forceAlchemist; // dev testing hook
    if (!forced && (this.floor < 3 || isBossFloor(this.floor) || (this.floor % 7 !== 3 && Math.random() > 0.1))) return;
    const c = this.freeSpot(forced ? 4 : 8);
    if (!c) return;
    const px = c.x * TS + 8,
      py = c.y * TS + 8;
    const s = this.add.sprite(px, py + 6, 'npc_alchemist').setOrigin(0.5, 1).setScale(ACTOR_SCALE).play('npc_alchemist_idle').setDepth(D.entityBase + py);
    this.add.image(px, py + 6, 'shadow').setDepth(D.floorDeco + 2);
    const pot = this.add.image(px + 13, py + 7, 'cauldron').setOrigin(0.5, 1).setDepth(D.entityBase + py + 1);
    this.tweens.add({ targets: pot, scaleY: 1.06, yoyo: true, repeat: -1, duration: 600 });
    const glow = this.add.image(px + 13, py, 'glow').setTint(0x5dff9a).setAlpha(0.3).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    this.trackGlow(glow, c.x, c.y);
    this.interactables.push({ kind: 'alchemist', x: px, y: py + 6, tx: c.x, ty: c.y, sprite: s, data: {} });
    this.lamps.push({ x: px, y: py, r: 72, flicker: 1 });
    const t = this.fx.label(px, py - 16, 'Alchymista', '#7dffcf', 6);
    t.setDepth(99980);
  }

  // ---------------------------------------------------------------- cursed chest
  /** a rare black chest: whoever opens it must hold out against waves of monsters for 30 seconds
   * (a quest's cursed tomb is one for sure) */
  placeCursedChest(questId?: number) {
    if (!questId && (this.floor < 4 || isBossFloor(this.floor))) return;
    const forced = (window as any).__forceCursed; // dev testing hook
    if (!forced && !questId && Math.random() > 0.12) return;
    if (questId && this.interactables.some((i) => i.kind === 'cursed' && i.data.quest === questId)) return;
    const c = this.freeSpot(10);
    if (!c) return;
    const px = c.x * TS + 8,
      py = c.y * TS + 8;
    const s = this.add.image(px, py + 8, 'chest_cursed').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + py + 8);
    const glow = this.add.image(px, py, 'glow').setTint(0x7dff9a).setAlpha(0.3).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    this.trackGlow(glow, c.x, c.y);
    this.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 1100 });
    const label = this.fx.label(px, py - 11, questId ? 'Prokletá hrobka' : 'Prokletá truhla', '#9dff9a', 6);
    label.setDepth(99980);
    this.interactables.push({ kind: 'cursed', x: px, y: py + 4, tx: c.x, ty: c.y, sprite: s, data: { room: c.room, glow, label, quest: questId } });
    this.lamps.push({ x: px, y: py, r: 44, flicker: 2 });
  }

  startCursed(it: Interactable) {
    if (it.used || this.cursed) return;
    it.used = true;
    it.data.label?.destroy();
    const total = 30;
    this.cursed = { it, t: total, total, waveT: 0.6, spawned: [] };
    sfx('boss');
    this.fx.ring(it.x, it.y - 6, 70, 0x7dff9a, 700);
    this.fx.shake(0.005, 300);
    UI.banner('Prokletá truhla', 'Odolej 30 sekund! Čím víc nestvůr porazíš, tím bohatší kořist.');
  }

  /** monsters of this floor come out of green portals around the chest */
  private cursedWave() {
    const c = this.cursed!;
    const it = c.it;
    const p = this.player;
    const pool = this.dungeon.spawns.map((sp) => sp.id).filter((id) => ENEMY_BY_ID[id] && ENEMY_BY_ID[id].behavior !== 'thief');
    if (!pool.length) return;
    const elapsed = c.total - c.t;
    const n = 2 + Math.floor(elapsed / 10) + (this.floor >= 60 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      let spot: [number, number] | null = null;
      for (let k = 0; k < 12 && !spot; k++) {
        const q = this.map.randomFloorNear(it.x, it.y, 105);
        if (q && Math.hypot(q[0] - p.x, q[1] - p.y) > 40 && this.map.los(it.x, it.y - 4, q[0], q[1])) spot = q;
      }
      if (!spot) continue;
      const [x, y] = spot;
      const id = pool[Math.floor(Math.random() * pool.length)];
      const e = this.spawnEnemy(id, x, y, Math.random() < 0.12, it.data.room ?? -1);
      e.aggro = true;
      c.spawned.push(e);
      this.fx.burst(x, y - 6, 0x7dff9a, 10, 'puff');
      this.fx.ring(x, y, 18, 0x9a5aff, 400);
    }
    sfx('summon');
  }

  private updateCursed(dt: number) {
    const c = this.cursed!;
    c.t -= dt;
    c.waveT -= dt;
    if (c.waveT <= 0 && c.t > 3) {
      c.waveT = 3.2;
      this.cursedWave();
    }
    const kills = c.spawned.filter((e) => e.dead && e.hp <= 0).length;
    UI.eventBar(`☠ Prokletá truhla · ${Math.max(0, Math.ceil(c.t))} s · poraženo ${kills}`, Math.max(0, c.t / c.total));
    if (c.t <= 0) this.endCursed(kills);
  }

  /** time is up: the rest of the monsters vanish and the chest opens (the more kills, the more loot) */
  private endCursed(kills: number) {
    const c = this.cursed!;
    this.cursed = null;
    UI.hideEventBar();
    for (const e of c.spawned) {
      if (e.dead) continue;
      e.dead = true;
      this.fx.burst(e.x, e.y - 6, 0x7dff9a, 8, 'puff');
      e.destroyVisuals();
    }
    const it = c.it;
    (it.sprite as Phaser.GameObjects.Image).setTexture('chest_cursed_open');
    it.data.glow?.destroy();
    sfx('chest');
    this.fx.ring(it.x, it.y - 6, 60, 0x7dff9a, 600);
    this.fx.burst(it.x, it.y - 8, 0x7dff9a, 24);
    const f = this.floor;
    this.loot.chestDrops('gold', it.x, it.y);
    for (let i = 0; i < Math.min(6, Math.floor(kills / 5)); i++) this.loot.dropItem(this.loot.item(f + 1, 1), it.x, it.y);
    if (kills >= 20) this.loot.dropItem(generateItem(f + 2, { rarity: Math.random() < 0.25 ? 5 : 4 }), it.x, it.y);
    this.loot.dropMat('dust', 1 + Math.floor(kills / 8), it.x, it.y);
    if (kills >= 10) this.loot.dropMat('stone', 1 + Math.floor(kills / 12), it.x, it.y);
    for (let i = 0; i < 1 + Math.floor(kills / 10); i++) this.loot.dropRandomGem(it.x, it.y);
    this.loot.dropRandomRune(it.x, it.y);
    if (Math.random() < 0.3) this.loot.dropSpellRune(it.x, it.y);
    bumpStat(this.save, 'cursed');
    if (it.data.quest) this.quests.completeById(it.data.quest);
    UI.toast(`Prokletí zlomeno! Poraženo ${kills} ${kills === 1 ? 'nestvůra' : kills > 1 && kills < 5 ? 'nestvůry' : 'nestvůr'}.`, '#9dff9a');
    bus.emit('stats');
  }

  // ---------------------------------------------------------------- pets
  /** the active pet appears at a spot (hidden while the hero is still on the stairs) */
  spawnPet(x: number, y: number, visible = true) {
    this.pet?.destroy();
    this.pet = null;
    const id = petsOf(this.save).active;
    const def = id ? PET_BY_ID[id] : null;
    if (!def) return;
    this.pet = new PetFollower(this, def, x, y);
    this.pet.setVisible(visible);
  }

  /** the phoenix power rises once per floor */
  phoenixUsed = false;

  // ---------------------------------------------------------------- mercenary
  merc: Mercenary | null = null;

  spawnMerc(x: number, y: number, visible = true) {
    this.merc?.destroyVisuals();
    this.merc = null;
    const st = this.save.merc;
    if (!st || !MERC_BY_ROLE[st.role]) return;
    this.merc = new Mercenary(this, st, x, y);
    this.merc.setVisible(visible);
  }

  /** hires a mercenary of a role (the old one leaves; its gear goes back to the bag) */
  hireMerc(role: MercRole, price: number) {
    const s = this.save;
    if (s.gold < price) return false;
    s.gold -= price;
    const old = s.merc;
    if (old) this.returnMercGear();
    const def = MERC_BY_ROLE[role];
    s.merc = { role, name: randomMercName(def), equip: {}, order: old?.order ?? 'attack' };
    const p = this.player;
    const spot = this.map.randomFloorNear(p.x - p.facing * 14, p.y + 3, 14) ?? [p.x, p.y];
    this.spawnMerc(spot[0], spot[1]);
    this.fx.burst(spot[0], spot[1] - 6, 0xffffff, 14, 'puff');
    this.fx.ring(spot[0], spot[1] - 4, 24, 0x6dff7a, 400);
    sfx('summon');
    bus.emit('stats');
    saveGame(s);
    return true;
  }

  /** the mercenary leaves (its gear goes back to the bag, or to the floor when the bag is full) */
  dismissMerc() {
    if (!this.save.merc) return;
    this.returnMercGear();
    if (this.merc) this.fx.burst(this.merc.x, this.merc.y - 6, 0xffffff, 12, 'puff');
    this.merc?.destroyVisuals();
    this.merc = null;
    delete this.save.merc;
    bus.emit('stats');
    saveGame(this.save);
  }

  private returnMercGear() {
    const m = this.save.merc;
    if (!m) return;
    for (const it of Object.values(m.equip)) {
      if (!it) continue;
      const at = this.save.inventory.findIndex((x) => !x);
      if (at >= 0) this.save.inventory[at] = it;
      else this.loot.dropItem(it, this.player.x, this.player.y);
    }
    m.equip = {};
  }

  setMercOrder(o: MercOrder) {
    if (!this.save.merc) return;
    this.save.merc.order = o;
    if (this.merc) this.merc.target = null;
    saveGame(this.save);
  }

  // ---------------------------------------------------------------- wandering adventurer
  /** another hero walking this floor (until they join, trade, leave or turn hostile) */
  rival: Mercenary | null = null;
  rivalMood: RivalMood = 'friendly';
  rivalMet = false;
  rivalAlly = false;
  /** the adventurer who chose to fight */
  rivalFoe: Enemy | null = null;
  rivalLevel = 1;

  spawnRival() {
    this.rival = null;
    this.rivalMet = false;
    this.rivalAlly = false;
    const forced = (window as any).__forceRival as RivalMood | undefined; // dev testing hook
    if (!forced && (this.floor < 4 || isBossFloor(this.floor) || Math.random() > 0.1)) return;
    const spot = this.freeSpot(forced ? 5 : 14) ?? this.freeSpot(5);
    if (!spot) return;
    const who = RIVAL_PEOPLE[Math.floor(Math.random() * RIVAL_PEOPLE.length)];
    const classes = CLASSES.filter((c) => c.id !== this.save.cls);
    const cls = classes[Math.floor(Math.random() * classes.length)].id;
    const st: MercState = { role: rivalRole(cls), name: who.name, equip: {}, order: 'attack', look: cls, temp: true, fem: who.fem };
    const r = new Mercenary(this, st, spot.x * TS + 8, spot.y * TS + 10);
    r.roam = true;
    r.hpMult = 2.5;
    r.dmgTaken = 0.5;
    r.recalc(true);
    this.rival = r;
    this.rivalLevel = Math.max(1, this.save.level + Math.floor(Math.random() * 7) - 3);
    const moods: RivalMood[] = ['friendly', 'friendly', 'trader', 'trader', 'hostile'];
    this.rivalMood = forced ?? moods[Math.floor(Math.random() * moods.length)];
  }

  updateRival(dt: number) {
    const f = this.rivalFoe;
    if (f) {
      if (f.dead) this.rivalFoe = null;
      else if (f.nameLabel) f.nameLabel.setPosition(Math.round(f.x), Math.round(f.y - 15 * f.baseScale));
    }
    const r = this.rival;
    if (!r) return;
    if (r.dead || r.gone) {
      this.rival = null;
      this.rivalAlly = false;
      return;
    }
    r.update(dt);
    const p = this.player;
    if (!this.rivalMet && !p.dead && !this.cinematic && !UI.panel && Math.hypot(p.x - r.x, p.y - r.y) < 85 && this.map.los(p.x, p.y, r.x, r.y)) {
      this.rivalMet = true;
      this.meetRival(r);
    }
  }

  /** face to face: the adventurer says what they want */
  meetRival(r: Mercenary) {
    const mood = this.rivalMood;
    const lines = RIVAL_GREETING[mood];
    const toll = rivalToll(this.floor);
    r.facing = this.player.x > r.x ? 1 : -1;
    sfx('ui');
    UI.panels.rivalTalk(r, mood, lines[Math.floor(Math.random() * lines.length)], this.rivalLevel, toll, (choice) => {
      if (choice === 'join') {
        r.roam = false;
        this.rivalAlly = true;
        UI.toast(`${r.state.name} jde s tebou`, '#9dff9d');
      } else if (choice === 'shop') {
        UI.panels.rivalShop(r, this.rivalWares());
      } else if (choice === 'pay') {
        if (this.save.gold < toll) {
          UI.toast('Tolik zlata nemáš – bude se bojovat!', '#ff8a7a');
          this.rivalTurns(r);
          return;
        }
        this.save.gold -= toll;
        sfx('coin');
        UI.toast(`${r.state.name} si ${r.state.fem ? 'vzala' : 'vzal'} zlato a ${r.state.fem ? 'zmizela' : 'zmizel'}`, '#ffd76a');
        r.leave();
      } else if (choice === 'fight') this.rivalTurns(r);
    });
  }

  /** what a trading adventurer carries (generated when the bag is opened) */
  rivalWares(): Item[] {
    const f = this.floor;
    const out: Item[] = [];
    for (let i = 0; i < 3; i++) out.push(generateItem(f + 1 + Math.floor(Math.random() * 3), { rarity: Math.random() < 0.15 ? 4 : Math.random() < 0.5 ? 3 : 2, filter: this.loot.bias() }));
    return out;
  }

  /** the adventurer turns on the hero: a duel with a strong champion that wears a hero's face */
  rivalTurns(r: Mercenary) {
    const base = rivalFoeBase(r.def.role);
    const affixes = ['rychlý', 'obrněný', 'upíří', 'mrazivý'];
    const e = this.spawnEnemy(base, r.x, r.y, true, this.dungeon.roomId[this.map.idx(Math.floor(r.x / TS), Math.floor(r.y / TS))] ?? -1, r.spriteKey, affixes[Math.floor(Math.random() * affixes.length)]);
    e.setScale(1);
    e.name = r.state.name;
    e.maxHp = e.hp = Math.round(e.maxHp * 3.5);
    e.dmg *= 1.25;
    e.xp = Math.round(e.xp * 3);
    e.aggro = true;
    e.rivalFoe = true;
    e.nameLabel = this.fx.label(e.x, e.y - 20, `⚔ ${r.state.name}`, '#ffb070', 6);
    e.nameLabel.setDepth(99980);
    this.rivalFoe = e;
    this.rivalAlly = false;
    r.dead = true;
    r.destroyVisuals();
    this.rival = null;
    sfx('boss');
    this.fx.shake(0.006, 300);
    UI.banner(`⚔ ${r.state.name}`, 'Souboj dobrodruhů!');
  }

  /** the adventurer who fought the hero lies beaten: their pack is the hero's */
  rivalDefeated(e: Enemy) {
    const f = this.floor;
    bumpStat(this.save, 'rivals');
    UI.banner('Souboj vyhrán!', `${e.name} je poražen${/a$/.test(e.name.split(' ')[0]) ? 'a' : ''}`);
    for (let i = 0; i < 2; i++) this.loot.dropItem(generateItem(f + 2, { rarity: Math.random() < 0.3 ? 4 : 3, filter: this.loot.bias() }), e.x, e.y);
    for (let i = 0; i < 6; i++) this.loot.dropGold(this.loot.goldAmount(3), e.x, e.y);
    this.loot.dropRandomGem(e.x, e.y, 1);
    this.rivalFoe = null;
  }

  /** a companion adventurer may covet a legendary find... */
  onItemPicked(it: Item) {
    const r = this.rival;
    if (!r || !this.rivalAlly || it.rarity < 4 || Math.random() > 0.15) return;
    UI.toast(`${r.state.name}: „Tenhle kousek měl být můj!“`, '#ff8a7a');
    this.time.delayedCall(700, () => {
      if (this.rival === r && !r.dead) this.rivalTurns(r);
    });
  }

  /** the pet hops off the stairs after the hero (and the mercenary follows) */
  petArrives() {
    const m = this.merc;
    const u0 = this.upStairs;
    if (m && u0) {
      m.x = u0.x + 6;
      m.y = u0.y + 4;
      m.setVisible(true);
      m.sprite.setAlpha(0);
      this.tweens.add({ targets: m.sprite, alpha: 1, duration: 300 });
    }
    const pet = this.pet;
    const u = this.upStairs;
    if (!pet || !u) return;
    pet.x = u.x;
    pet.y = u.y + 3;
    pet.setVisible(true);
    pet.sprite.setAlpha(0);
    this.tweens.add({ targets: pet.sprite, alpha: 1, duration: 300 });
  }

  /** switch the travelling pet (from the pets panel); null leaves them all in the village */
  setActivePet(id: PetId | null) {
    const st = petsOf(this.save);
    if (id && !st.owned.includes(id)) return;
    st.active = id;
    const p = this.player;
    const old = this.pet;
    const x = old?.x ?? p.x - p.facing * 12,
      y = old?.y ?? p.y + 3;
    if (old) this.fx.burst(old.x, old.y - 4, 0xffffff, 8, 'puff');
    this.spawnPet(x, y);
    if (this.pet) {
      this.fx.burst(x, y - 4, 0xffb3d0, 10);
      this.pet.emote('♥');
    }
    p.recalc();
    bus.emit('stats');
    saveGame(this.save);
  }

  /** now and then a caged animal waits in a room; the first one is there for sure from floor 3 on */
  placePetCage() {
    const st = petsOf(this.save);
    if (this.floor < 3 || isBossFloor(this.floor)) return;
    const forced = (window as any).__forcePet as PetId | undefined; // dev testing hook
    const id = forced ?? cagePetFor(st, this.floor);
    if (!id) return;
    if (!forced && Math.random() > cageChance(st)) {
      st.pity++;
      return;
    }
    const c = this.freeSpot(st.owned.length ? 12 : 6);
    if (c) {
      st.pity = 0;
      const px = c.x * TS + 8,
        py = c.y * TS + 8;
      const def = PET_BY_ID[id];
      // the animal sits inside, behind the bars
      const inside = this.add.sprite(px, py + 5, 'pet_' + id, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).play('pet_' + id + '_idle').setDepth(D.entityBase + py + 6);
      const cage = this.add.image(px, py + 9, 'cage').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + py + 7);
      this.add.image(px, py + 7, 'shadow').setDepth(D.floorDeco + 2).setScale(1.3, 1);
      const label = this.fx.label(px, py - 13, `${petTitle(def)} v kleci`, def.color, 6);
      label.setDepth(99980);
      this.interactables.push({ kind: 'cage', x: px, y: py + 6, tx: c.x, ty: c.y, sprite: cage, data: { id, inside, label } });
      this.lamps.push({ x: px, y: py, r: 48, flicker: 0 });
      // it calls for help when the hero is near
      this.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => {
          const it = this.interactables.find((i) => i.kind === 'cage' && i.data.id === id);
          if (!it || it.used || !inside.active || !this.map.explored[this.map.idx(c.x, c.y)]) return;
          if (Math.hypot(this.player.x - px, this.player.y - py) < 150) this.fx.number(px, py - 8, Math.random() < 0.5 ? '♥' : '!', def.color);
        },
      });
    }
  }

  /** a free floor tile near the middle of a regular room away from the start, with nothing around it */
  freeSpot(minStartDist: number): { x: number; y: number; room: number } | null {
    const d = this.dungeon;
    const s0 = d.start;
    const busy = new Set(d.objects.map((o) => o.y * d.w + o.x));
    for (const it of this.interactables) busy.add(it.ty * d.w + it.tx);
    const rooms = d.rooms.filter((r) => r.type === 'normal' && Math.hypot(r.cx - s0.x, r.cy - s0.y) > minStartDist);
    Phaser.Utils.Array.Shuffle(rooms);
    for (const r of rooms) {
      const cells = r.cells
        .map((i) => [i % d.w, Math.floor(i / d.w)] as [number, number])
        .filter(([x, y]) => {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (d.grid[(y + dy) * d.w + x + dx] !== T_FLOOR || busy.has((y + dy) * d.w + x + dx)) return false;
          return !this.map.isHidden(x, y);
        })
        .sort((a, b) => Math.hypot(a[0] - r.cx, a[1] - r.cy) - Math.hypot(b[0] - r.cx, b[1] - r.cy));
      if (cells[0]) return { x: cells[0][0], y: cells[0][1], room: r.id };
    }
    return null;
  }

  /** opens the cage: the animal joins the hero's pets (and comes along when there is no other) */
  freePet(it: Interactable) {
    if (it.used) return;
    it.used = true;
    const id = it.data.id as PetId;
    const def = PET_BY_ID[id];
    const st = petsOf(this.save);
    if (!st.owned.includes(id)) st.owned.push(id);
    (it.sprite as Phaser.GameObjects.Image).setTexture('cage_open');
    it.data.label?.destroy();
    const inside = it.data.inside as Phaser.GameObjects.Sprite;
    sfx('chest');
    this.fx.burst(it.x, it.y - 8, 0xffd0e0, 16);
    const freed = `${petTitle(def)} ${def.fem ? 'je volná' : 'je volný'}!`;
    const join = () => {
      inside.destroy();
      this.setActivePet(id);
      sfx('pet');
      UI.toast(`${freed} Půjde s tebou. ${def.desc}`, def.color);
    };
    // staying behind: it runs off to the village (still yours, in the pets panel)
    const stay = () => {
      if (!inside.active) return;
      this.fx.number(inside.x, inside.y - 14, '♥', def.color);
      this.tweens.add({ targets: inside, alpha: 0, x: inside.x + 30, duration: 700, onComplete: () => inside.destroy() });
      UI.toast(`${petTitle(def)} počká ve vesnici. Vyměnit mazlíčka jde v pauze (Mazlíčci).`, def.color);
    };
    // hops out of the cage
    this.tweens.add({ targets: inside, y: inside.y + 6, x: inside.x + 4, duration: 260, ease: 'Quad.easeOut' });
    this.time.delayedCall(320, () => {
      const cur = st.active && st.active !== id ? PET_BY_ID[st.active] : null;
      if (!cur) return join();
      UI.confirm(freed, `${def.desc} Vezmeš ${def.fem ? 'ji' : 'ho'} s sebou? Teď s tebou chodí ${petTitle(cur)}. Mazlíčky jde kdykoliv vyměnit v pauze (Mazlíčci).`, join, 'Vzít s sebou', `Ponechat: ${cur.name}`, stay);
    });
    bus.emit('stats');
    saveGame(this.save);
  }

  // ---------------------------------------------------------------- queries
  nearestEnemy(x: number, y: number, range: number, needLos: boolean, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null,
      bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.inWall || e.invuln || (exclude && exclude.has(e.id))) continue;
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
    // two packs at war go for each other first
    if (e.faction) {
      const foe = this.enc.brawlTarget(e);
      if (foe) return foe;
    }
    const p = this.player;
    let best: Actor = p;
    let bd = Math.hypot(p.x - e.x, p.y - e.y);
    if (p.stealthed) bd = 9999;
    // the mercenary: a taunted monster goes for it, others when it stands closer than the hero
    const m = this.merc;
    if (m && !m.dead && !m.down) {
      const d = Math.hypot(m.x - e.x, m.y - e.y);
      if (e.tauntT > 0 && d < 160) return m;
      if (d < bd - 10 && d < 60) {
        bd = d;
        best = m;
      }
    }
    const r = this.rival;
    if (r && !r.dead && !e.rivalFoe) {
      const d = Math.hypot(r.x - e.x, r.y - e.y);
      if (d < bd - 10 && d < 60) {
        bd = d;
        best = r;
      }
    }
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
  spawnEnemyProjectile(x: number, y: number, angle: number, sprite: string, dmg: number, el: Element, speed: number, srcName?: string, srcFoe?: Enemy) {
    const pr = new Projectile(this, { x, y, angle, speed, sprite, dmg, el, owner: 'enemy', range: 260, srcName, srcFoe });
    this.projectiles.push(pr);
    return pr;
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
    let bounces = p.d.specials.has('ricochet') ? 2 : 0;
    let split = p.d.specials.has('splitShot');
    proj.hitEnemy = (e: Enemy) => {
      this.combat.attackHit(e, proj.vx, proj.vy);
      this.fx.burst(proj.x, proj.y, p.d.attack === 'magic' ? 0xc77dff : 0xffffff, 4);
      // splitShot: the first hit breaks the shot into three
      if (split) {
        split = false;
        const a0 = Math.atan2(proj.vy, proj.vx);
        for (const da of [-0.5, 0.5]) {
          const sp = new Projectile(this, { x: proj.x, y: proj.y, angle: a0 + da, speed: 300, sprite, dmg: p.weaponHit() * 0.5, el: 'phys', owner: 'player', range: 110 });
          sp.hitIds.add(e.id);
          this.projectiles.push(sp);
        }
      }
      // ricochet: on to the next foe
      if (bounces > 0) {
        const next = this.nearestEnemy(proj.x, proj.y, 110, true, proj.hitIds);
        if (next) {
          bounces--;
          const a = Math.atan2(next.y - 6 - proj.y, next.x - proj.x);
          const v = Math.hypot(proj.vx, proj.vy);
          proj.vx = Math.cos(a) * v;
          proj.vy = Math.sin(a) * v;
          proj.traveled = 0;
          return;
        }
      }
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
      this.pet?.emote('♥');
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
    bumpStat(this.save, 'potions');
    const brew = potionMult(this.save);
    this.quests.onPotion();
    if (kind === 'hpPotion') {
      p.heal((p.d.maxHp * 0.45 + 30) * (p.d.specials.has('weakPotions') ? 0.5 : 1) * brew);
      this.fx.burst(p.x, p.y - 6, 0xff5050, 12);
    } else {
      p.mp = Math.min(p.d.maxMp, p.mp + (p.d.maxMp * 0.6 + 20) * brew);
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
        if (it.data.village) return `Do kobek (patro ${this.floor})`;
        return it.data.portal ? `Projít portálem (patro ${this.floor + 1})` : `Sestoupit (patro ${this.floor + 1})`;
      case 'vb':
      case 'vilda':
      case 'vwell':
      case 'vking':
      case 'vguard':
      case 'vgrave':
      case 'vsign':
        return this.vil.label(it);
      case 'ev':
        return this.enc.label(it);
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
      case 'cage':
        return `Osvobodit: ${PET_BY_ID[it.data.id as PetId].name}`;
      case 'cursed':
        return 'Prokletá truhla';
      case 'alchemist':
        return 'Transmutace';
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
      case 'vb':
      case 'vilda':
      case 'vwell':
      case 'vking':
      case 'vguard':
      case 'vgrave':
      case 'vsign':
        this.vil.interact(it);
        break;
      case 'stairs':
        if (it.data.village) UI.confirm(`Sestoupit do kobek?`, `Pokračuješ patrem ${this.floor}, které začneš od schodů.`, () => this.nextFloor(true), 'Sestoupit', 'Ještě ne');
        else if (it.data.portal) UI.confirm(`Projít portálem do patra ${this.floor + 1}?`, 'Hra se uloží. Zpět se vrátit nelze.', () => this.nextFloor(), 'Projít', 'Ještě ne');
        else UI.confirm(`Sestoupit do patra ${this.floor + 1}?`, 'Hra se uloží. Zpět se vrátit nelze.', () => this.nextFloor());
        break;
      case 'ev':
        this.enc.interact(it);
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
      case 'alchemist':
        UI.panels.villageLab = false;
        UI.panels.transmute();
        break;
      case 'shrine': {
        const def = SHRINES[it.data.type];
        it.used = true;
        (it.sprite as Phaser.GameObjects.Image).setTexture('shrine_used');
        it.data.glow?.destroy();
        this.shrineBuffs.push({ id: it.data.type, name: def.name, mods: def.mods, xp: def.xp, mf: def.mf, t: 90, total: 90, color: def.color });
        // the gem shrine also gives two gems right away
        if (it.data.type === 'gems') for (let i = 0; i < 2; i++) this.loot.dropRandomGem(it.x, it.y + 6, Math.random() < 0.3 ? 1 : 0);
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
      case 'cage':
        this.freePet(it);
        break;
      case 'cursed':
        UI.confirm('Prokletá truhla', 'Kdo ji otevře, musí 30 sekund odolávat vlnám nestvůr. Čím víc jich porazíš, tím bohatší bude kořist.', () => this.startCursed(it), 'Přijmout výzvu', 'Raději ne');
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
    UI.toast('Tajná místnost objevena!', '#ffd23a');
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
    this.bountyStep('chest');
    const tier = it.data.tier ?? 'wood';
    (it.sprite as Phaser.GameObjects.Image).setTexture('chest_' + tier + '_open');
    sfx('chest');
    this.fx.burst(it.x, it.y - 8, tier === 'gold' || tier === 'boss' ? 0xffd23a : 0xffffff, 14);
    this.loot.chestDrops(tier, it.x, it.y);
  }

  breakObject(it: Interactable) {
    it.used = true;
    this.bountyStep('break');
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
    if (b.tag === 'secret') return this.enc.secretAggro(b);
    if (!b.tag) this.quests.onBossAggro();
    if (b.tag === 'riftGuard') {
      sfx('boss');
      UI.showBoss(b);
      UI.banner('Strážce trhliny', 'Poraz ho a trhlina se zavře');
      this.fx.shake(0.006, 300);
      return;
    }
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

  addHazard(x: number, y: number, r: number, dps: number, el: Element, dur: number, color: number, src?: string, slow = false, foe?: Enemy) {
    if (slow) {
      // a web: drawn plainly (not glowing) so it reads on any floor
      const img = this.add.image(x, y, 'webzone').setTint(color).setAlpha(0).setScale((r * 2) / 128).setDepth(D.floorDeco + 3).setAngle(Math.random() * 360);
      this.tweens.add({ targets: img, alpha: 0.8, duration: 200 });
      this.hazards.push({ x, y, r, dps, el, t: dur, tick: 0.25, img, src, slow, a: 0.8 });
      return;
    }
    const img = this.add.image(x, y, 'disc').setTint(color).setAlpha(0.32).setScale((r * 2) / 256).setDepth(D.floorDeco + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: img, alpha: 0.18, yoyo: true, repeat: -1, duration: 500 });
    this.hazards.push({ x, y, r, dps, el, t: dur, tick: 0.25, img, src, slow, foe });
  }

  updateHazards(dt: number) {
    if (!this.hazards.length) return;
    const p = this.player;
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.t < 0.6) h.img.setAlpha(Math.max(0, h.t / 0.6) * (h.a ?? 0.3));
      if (h.t <= 0 || p.dead) continue;
      if (Math.hypot(p.x - h.x, p.y - h.y) < h.r) {
        // webs hold the hero back
        if (h.slow) p.chill(0.3);
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 0.5;
          this.combat.cause = h.src ?? null;
          this.combat.causeFoe = h.foe ?? null;
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
    if (b.tag === 'secret') return this.enc.secretKilled(b);
    if (b.tag === 'riftGuard') return this.enc.riftCleared(b);
    this.quests.onBossKilled();
    if (b.story) {
      void this.storyBossDefeated(b);
      return;
    }
    this.bossDefeated = true;
    bumpStat(this.save, 'bosses');
    UI.hideBoss();
    UI.banner('Strážce poražen!', `${b.name} padl${b.boss?.fem ? 'a' : ''}`);
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
    bumpStat(this.save, 'deaths');
    sfx('death');
    this.tweens.add({ targets: p.sprite, angle: 90 * p.facing, alpha: 0.5, duration: 500 });
    p.weapon?.setVisible(false);
    p.offhand?.setVisible(false);
    // a hardcore hero is gone at once (closing the game now must not save them)
    if (this.save.hardcore) buryHero(this.save, this.floor);
    else this.recordNemesis();
    this.time.delayedCall(900, () => UI.death(this.floor, this.deathGold()));
    this.deathAt = this.time.now;
  }

  deathAt = 0;

  /** gold a death costs on this difficulty */
  deathGold() {
    return Math.round(this.save.gold * this.diff.goldLoss);
  }

  /** the price of a death: part of the gold and of the progress to the next level */
  payForDeath() {
    this.save.gold -= this.deathGold();
    this.save.xp = Math.round(this.save.xp * (1 - this.diff.xpLoss));
    saveGame(this.save);
  }

  respawn() {
    if (this.save.hardcore) return;
    this.payForDeath();
    this.scene.restart({ save: this.save });
  }

  /** home to Loppo (from the pause menu): the floor will start again from its stairs */
  goToVillage() {
    if (this.descending || this.player.dead || this.inVillage) return;
    this.descending = true;
    this.cinematic = true;
    this.currentAction = null;
    UI.setAction(null);
    UI.joy = [0, 0];
    const p = this.player;
    p.target = null;
    p.invulnT = 99;
    this.targetMarker.setAlpha(0);
    sfx('stairs');
    this.fx.ring(p.x, p.y - 6, 40, 0xffd76a, 600);
    this.fx.burst(p.x, p.y - 8, 0xffd76a, 24);
    const cam = this.cameras.main;
    cam.zoomTo(this.zoom * 1.2, 900, 'Sine.easeIn');
    this.time.delayedCall(300, () => cam.fadeOut(500, 0, 0, 0));
    saveGame(this.save);
    this.time.delayedCall(850, () => {
      UI.floorCard(this.villageCardInfo(), '', true);
      this.scene.restart({ save: this.save, village: true });
    });
  }

  /** whether the hero may go home now (not in the middle of a fight, not in a rift) */
  canGoHome(): string | null {
    if (this.inVillage) return 'Už jsi doma';
    if (this.rift) return 'Z trhliny cesta domů nevede';
    if (this.boss && !this.boss.dead && this.boss.aggro) return 'Uprostřed souboje se strážcem se domů nedostaneš';
    if (this.cursed || this.enc.arena) return 'Nejdřív dokonči výzvu';
    const p = this.player;
    if (this.enemies.some((e) => !e.dead && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 180)) return 'Nestvůry jsou ti v patách – nejdřív se jich zbav';
    return null;
  }

  /** through a portal into a rift (or a dream): the floor is left behind */
  enterRift(kind: RiftKind) {
    if (this.descending || this.player.dead) return;
    this.descending = true;
    this.cinematic = true;
    this.currentAction = null;
    UI.setAction(null);
    UI.joy = [0, 0];
    const p = this.player;
    p.target = null;
    p.invulnT = 99;
    this.targetMarker.setAlpha(0);
    const gold = kind === 'dream';
    sfx('stairs');
    this.fx.ring(p.x, p.y - 6, 44, gold ? 0xffd23a : 0xb07dff, 700);
    this.fx.burst(p.x, p.y - 8, gold ? 0xffd23a : 0xb07dff, 30, 'puff');
    this.tweens.add({ targets: [p.sprite, p.shadow], alpha: 0, duration: 650 });
    if (this.pet) this.tweens.add({ targets: [this.pet.sprite, this.pet.shadow], alpha: 0, duration: 500 });
    if (this.merc) this.merc.setVisible(false);
    const cam = this.cameras.main;
    cam.zoomTo(this.zoom * 1.3, 900, 'Sine.easeIn');
    this.time.delayedCall(380, () => cam.fadeOut(480, gold ? 255 : 30, gold ? 230 : 0, gold ? 160 : 50));
    saveGame(this.save);
    this.time.delayedCall(900, () => {
      const info = this.floorCardInfo();
      UI.floorCard({ ...info, name: gold ? 'Snový svět' : 'Trhlina', region: gold ? 'Zlatý sen · jen chvíli' : 'Zkřivený svět · mimo čas', color: gold ? '#ffd23a' : '#c77dff' }, '', true);
      this.scene.restart({ save: this.save, rift: kind });
    });
  }

  /** someone met in the dungeon walks with the hero for the rest of the floor (and leaves a gift at the stairs) */
  joinCompanion(name: string, look: ClassId, role: MercRole, line: string, giftRarity: number) {
    const old = this.rival;
    if (old && !old.dead) {
      old.dead = true;
      old.destroyVisuals();
    }
    const p = this.player;
    const spot = this.map.randomFloorNear(p.x - p.facing * 16, p.y + 3, 16) ?? [p.x, p.y];
    const st: MercState = { role, name, equip: {}, order: 'attack', look, temp: true };
    const r = new Mercenary(this, st, spot[0], spot[1]);
    r.hpMult = 2.5;
    r.dmgTaken = 0.5;
    r.recalc(true);
    r.giftRarity = giftRarity;
    this.rival = r;
    this.rivalAlly = true;
    this.rivalMet = true;
    this.rivalMood = 'friendly';
    this.fx.burst(spot[0], spot[1] - 6, 0xffffff, 14, 'puff');
    this.fx.ring(spot[0], spot[1] - 4, 24, 0x9dff9d, 400);
    sfx('summon');
    UI.toast(`${name}: „${line}“`, '#c8d8ff');
  }

  /** walk onto the stairs and down into the dark; the title card of the next floor covers the loading */
  /** (stay: from the village back down to the floor the hero left, no floor further) */
  nextFloor(stay = false) {
    if (this.descending) return;
    this.descending = true;
    this.cinematic = true;
    // an adventurer who came along says goodbye with a gift
    const ally = this.rival;
    if (ally && this.rivalAlly && !ally.dead) {
      const gift = generateItem(this.floor + 2, { rarity: ally.giftRarity ?? (Math.random() < 0.25 ? 4 : 3), filter: this.loot.bias() });
      if (addToInventory(this.save, gift)) UI.toast(`${ally.state.name}: „Díky za společnou cestu! Tohle si vezmi.“ (${gift.name})`, '#9dff9d');
      ally.leave();
    }
    // a nemesis left behind waits a few floors deeper
    const nem = this.nemesis?.nemesis;
    if (nem && !this.nemesis!.dead) {
      nem.met = (nem.met ?? 0) + 1;
      nem.next = this.floor + 3;
    }
    this.save.floor = this.floor + (stay ? 0 : 1);
    this.save.maxFloor = Math.max(this.save.maxFloor, this.save.floor);
    // the pet goes down with the hero and grows with every few floors
    const pets = petsOf(this.save);
    if (pets.active && !stay) {
      const before = petLevel(pets, pets.active);
      pets.floors[pets.active] = (pets.floors[pets.active] ?? 0) + 1;
      const after = petLevel(pets, pets.active);
      if (after > before) {
        const def = PET_BY_ID[pets.active];
        pendingPetNews = `🐾 ${petTitle(def)} ${def.fem ? 'dosáhla' : 'dosáhl'} úrovně ${after}!`;
      }
    }
    if (this.pet) this.tweens.add({ targets: [this.pet.sprite, this.pet.shadow], alpha: 0, duration: 500 });
    if (this.merc) this.merc.setVisible(false);
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
          UI.floorCard(this.floorCardInfo(this.floor + (stay ? 0 : 1)), '', true);
          this.scene.restart({ save: this.save });
        });
      },
    });
  }

  // ---------------------------------------------------------------- main loop
  /** seconds the world stands still for a heavy blow (a champion falls, a huge crit) */
  hitStop = 0;

  /** a short freeze of the action that makes a big hit feel heavy */
  freeze(sec: number) {
    if (settings.lowFx) return;
    this.hitStop = Math.max(this.hitStop, sec);
  }

  update(_t: number, dms: number) {
    if (this.paused) return;
    if (this.hitStop > 0) {
      this.hitStop -= dms / 1000;
      UI.tick(dms / 1000);
      return;
    }
    const dt = Math.min(0.05, dms / 1000);
    const p = this.player;
    this.weather?.update(this.cinematic ? 0 : Math.min(0.05, dms / 1000));
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
    let mx = UI.joy[0] + UI.pad.move[0],
      my = UI.joy[1] + UI.pad.move[1];
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
    // a mind mage's confusion turns the controls around
    if (p.buffs.some((b) => b.mods.confuse)) {
      mx = -mx;
      my = -my;
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
      // an owl sees further in the dark
      let changed = this.map.revealAround(p.x, p.y, this.pet?.def.id === 'owl' ? 14 : 10);
      // stepping into a room lights up all of it (walls included)
      const rid = this.dungeon.roomId[this.map.idx(Math.floor(p.x / TS), Math.floor(p.y / TS))];
      if (rid >= 0 && !this.revealedRooms.has(rid)) {
        this.revealedRooms.add(rid);
        const room = this.dungeon.rooms.find((r) => r.id === rid);
        if (room) changed = this.map.revealRoom(room.cells) || changed;
      }
      if (changed) {
        this.updateGlowVisibility();
        if (this.bounty?.kind === 'explore' && !this.bounty.done && this.floorTiles) {
          let seen = 0;
          const d = this.dungeon;
          for (let i = 0; i < d.w * d.h; i++) if (this.map.explored[i] && d.grid[i] === T_FLOOR) seen++;
          this.bountyStep('explore', Math.floor((seen / this.floorTiles) * 100));
        }
      }
    }

    for (const e of this.enemies) e.update(dt);
    this.powers.update(dt);
    this.separate();
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    for (const a of this.allies) a.update(dt);
    if (this.allies.some((a) => a.dead)) this.allies = this.allies.filter((a) => !a.dead);
    if (this.pet && !p.dead) this.pet.update(dt);
    this.merc?.update(dt);
    this.updateRival(dt);
    if (this.cursed && !p.dead) this.updateCursed(dt);
    if (this.streak.t > 0) {
      this.streak.t -= dt;
      if (this.streak.t <= 0) this.endStreak();
      else UI.streak(this.streak.n, this.streak.t / STREAK_WINDOW);
    }
    for (const pr of this.projectiles) pr.update(dt);
    if (this.projectiles.some((pr) => pr.dead)) this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    this.spells.update(dt);
    this.loot.update(dt);
    this.updateTraps(dt);
    this.updateHazards(dt);
    this.updateNemesis();
    this.enc.update(dt);
    this.quests.update(dt);
    if (this.inVillage) this.vil.update(dt);

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
      UI.death(this.floor, this.deathGold());
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
          if (!a.boss && a.def.behavior !== 'static') [a.x, a.y] = this.map.move(a.x, a.y, -nx * push, -ny * push, a.r);
          if (!b.boss && b.def.behavior !== 'static') [b.x, b.y] = this.map.move(b.x, b.y, nx * push, ny * push, b.r);
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
      // a sniper's red line: it follows the target, then locks and flashes before the shot
      if (e.aimT > 0) this.drawAim(g, e);
      const shielded = e.mshieldMax > 0 && e.aggro;
      if (e.hp >= e.maxHp && !e.elite && !thief && !shielded && !e.corrupt) continue;
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
      g.fillStyle(e.corrupt ? 0xb03aff : e.elite ? 0xffa020 : 0xe0242c, 1);
      g.fillRect(x, y, Math.max(0, Math.round((w * e.hp) / e.maxHp)), 2);
      // a mana shield: a second, blue bar above the health
      if (e.mshieldMax > 0) {
        g.fillStyle(0x000000, 0.75);
        g.fillRect(x - 1, y - 4, w + 2, 3);
        g.fillStyle(0x5ab0ff, 1);
        g.fillRect(x, y - 3, Math.max(0, Math.round((w * e.mshield) / e.mshieldMax)), 1);
      }
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
    // the mercenary's health (when hurt) and the time until a knocked-out one gets up
    const m = this.merc;
    if (m && !m.dead && m.sprite.visible && (m.hp < m.maxHp || m.down)) {
      const w = 14;
      const x = Math.round(m.x - w / 2),
        y = Math.round(m.y - 22);
      g.fillStyle(0x000000, 0.7);
      g.fillRect(x - 1, y - 1, w + 2, 3);
      g.fillStyle(m.down ? 0x8a8a8a : 0x52ff8f, 1);
      g.fillRect(x, y, Math.round(w * (m.down ? 1 - m.downT / 35 : m.hp / m.maxHp)), 1);
    }
  }

  /** the red aiming line of a sniper (up to the first wall) */
  drawAim(g: Phaser.GameObjects.Graphics, e: Enemy) {
    const x0 = e.x,
      y0 = e.y - 7;
    const cx = Math.cos(e.aimA),
      cy = Math.sin(e.aimA);
    let len = 0;
    while (len < 240 && !this.map.isSolidPx(x0 + cx * (len + 4), y0 + cy * (len + 4) + 4)) len += 4;
    const locked = e.aimT <= 0.35;
    const flash = locked && Math.floor(this.time.now / 60) % 2 === 0;
    g.lineStyle(locked ? 1.5 : 1, flash ? 0xffffff : 0xff3030, locked ? 0.9 : 0.35 + (1.7 - e.aimT) * 0.25);
    g.lineBetween(x0, y0, x0 + cx * len, y0 + cy * len);
  }

  /** 0..1: how far a guardian's darkness has closed in around the hero */
  arenaDark = 0;

  updateLighting(dt: number) {
    const want = this.boss && !this.boss.dead && this.boss.arena === 'darkness' ? 1 : 0;
    this.arenaDark += (want - this.arenaDark) * Math.min(1, dt * 1.2);
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
    rt.fill(this.darkColor ?? this.theme.dark, Math.min(0.95, this.darkness + this.arenaDark * 0.4));
    const L = this.lightImg;
    const shrink = 1 - this.arenaDark * 0.55;
    const t = this.time.now / 1000;
    const p = this.player;
    const inView = (x: number, y: number, r: number) => x > -r && y > -r && x < w + r && y < h + r;
    // all lights are drawn into one capture which is then erased from the darkness in a single pass
    rt.beginDraw();
    L.setAlpha(0.65);
    L.setScale((210 * 2 * shrink * this.heroLight) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    L.setAlpha(1);
    L.setScale((135 * 2 * shrink * this.heroLight) / 128);
    rt.batchDraw(L, p.x - ox, p.y - 6 - oy);
    for (const l of this.lamps) {
      const x = l.x - ox,
        y = l.y - oy;
      if (!inView(x, y, l.r)) continue;
      if (this.map.isHidden(Math.floor(l.x / TS), Math.floor(l.y / TS))) continue;
      const fl = l.flicker ? 1 + Math.sin(t * 9 + l.flicker) * 0.04 + Math.sin(t * 23 + l.flicker * 3) * 0.03 : 1;
      L.setScale((l.r * 2 * fl * shrink) / 128);
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
