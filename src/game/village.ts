import Phaser from 'phaser';
import type { GameScene, Interactable, MerchantStock } from '../scenes/GameScene';
import { TS } from './map';
import { D } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { VILLAGE_WINDOWS, VILLAGE_CHIMNEYS } from '../gfx/village';
import { hash } from '../gfx/pixel';
import { sfx } from '../systems/audio';
import { BUILDINGS, BuildingDef, BuildingId, BUILDING_BY_ID, buildingLevel, villageOf, villagerDue, shopSize, activeBlessing, BLESSING_BY_ID, prosperityLevel } from '../data/village';
import { prosperityRank } from '../data/fountain';
import { PLOTS, RUINS, PALACE, KING, GUARDS, ILDA, POND, pondValue, VillageMap } from '../systems/villagemap';
import { DObject } from '../systems/dungeon';
import { generateItem } from '../data/items';
import { listFallen, FallenHero } from '../systems/state';
import { CLASS_BY_ID } from '../data/classes';
import { GUARD_LINES } from '../data/royal';

// The village of Loppo under the open sky: the hero's home between the descents. The houses of the
// villagers the hero brought back stand around the square (the others are still ruins), the king
// lives in his palace, the dead sleep in the graveyard by the chapel and the way down into the dungeon
// leads through the gate of the old castle ruins. Day and night follow the clock of the player.

export const ROMAN = ['', 'I', 'II', 'III'];

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

/** the time of day in Loppo follows the player's clock */
export function dayPhase(d = new Date()): DayPhase {
  const forced = (window as unknown as { __forcePhase?: DayPhase }).__forcePhase;
  if (forced) return forced;
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 19) return 'day';
  if (h >= 19 && h < 21.5) return 'dusk';
  if (h >= 5 && h < 7) return 'dawn';
  return 'night';
}

const PHASE: Record<DayPhase, { dark: number; color: number; lamps: number; windows: number; hero: number; name: string }> = {
  day: { dark: 0, color: 0x0a1030, lamps: 0, windows: 0, hero: 1, name: 'den' },
  dawn: { dark: 0.24, color: 0x1c2648, lamps: 0.55, windows: 0.45, hero: 0.8, name: 'svítání' },
  dusk: { dark: 0.34, color: 0x2a1838, lamps: 0.8, windows: 0.75, hero: 0.7, name: 'večer' },
  night: { dark: 0.6, color: 0x070b20, lamps: 1, windows: 1, hero: 0.5, name: 'noc' },
};

/** "večer" – for the title card */
export function phaseName(p: DayPhase) {
  return PHASE[p].name;
}

/** what the villagers say when the hero walks by */
const CHATTER: Record<BuildingId, string[]> = {
  stash: [],
  smithy: ['Ocel se kuje, dokud je žhavá!', 'Přines kámen, udělám z toho zázrak.', 'Ten meč by chtěl nabrousit…'],
  shop: ['Čerstvé zboží, čerstvě vykopané!', 'Pro tebe zvláštní cena. Skoro.', 'Kdo nekoupí, ten neví, o co přišel!'],
  board: ['Na nástěnce je nová práce!', 'Lidé v Loppu potřebují pomoc.', 'Stopy vedou dolů. Vždycky dolů.'],
  lab: ['Nedotýkej se té zelené baňky!', 'Pět za jedno – to je alchymie.', 'Cítíš to? To je pokrok. Nebo síra.'],
  tower: ['Runy šeptají, když se jim naslouchá.', 'Hmm? Ach, to jsi ty.', 'Hvězdy dnes stojí příznivě. Asi.'],
  trainer: ['Kryt nahoru! Nohy pevně!', 'Každá kapka potu je ušetřená kapka krve.', 'Tvůj žoldák by potřeboval trénink.'],
  temple: ['Světlo tě provází.', 'I ve tmě se dá najít naděje.', 'Kletba je jen zkouška víry.'],
};

/** what the people of Loppo say in passing */
const FOLK_LINES = ['Dobrý den!', 'Zase do kobek? Dej na sebe pozor.', 'Prý tam dole straší.', 'Rybník je dnes klidný.', 'Král prý hledá pomocníky.', 'Moje slepice zase utekly…', 'V noci jsem slyšel z hradu zvony.'];

/** what Ilda says (besides news of the village) */
const ILDA_LINES = [
  'Pečeť drží, dokud ji někdo drží. Teď jsi to ty.',
  'Elara byla vždycky odvážnější než moudrá. Doufám, že ty máš obojí.',
  'Dole se čas chová divně. Nezapomeň, kde je domov.',
  'Lucerna, kterou nosíš, svítila mému otci i dědovi. Ať svítí i tobě.',
  'Když Nyx\'thar šeptá, neposlouchej. Mluví hezky, ale lže.',
  'Pětice spoutala zlo, ale nezabila ho. Tohle je jejich dluh – a teď i náš.',
];

/** the old graves of the graveyard */
const EPITAPHS = [
  'Jan Vrána, mlynář. Mlel pro Loppo čtyřicet let. Ať mu nebe mele lehce.',
  'Marie Kubátová. Nejlepší koláče pod Šedými horami. Recept si vzala s sebou.',
  'Neznámý poutník. Přišel v bouři a zůstal navždy.',
  'Bratři Holubové. Spolu odešli do hor, spolu se vrátili domů.',
  'Pepa. Byl tu.',
  'Hostinský Ferda. Poslední runda je na mně.',
  'Babička Ludmila, porodní bába. Na svět přivedla půl Loppa.',
  'Strážný Kryštof. Hlídal bránu, dokud si pro něj nepřišla jeho vlastní.',
  'Dorota a Matěj. Láska, která přežila mor, válku i tchyni.',
  'Mistr Ota, zvoník. Teď zvoní jinde.',
];

const SIGNS: Record<string, string> = {
  cross: 'Rozcestí. Na sever zřícenina starého hradu a vstup do kobek, na severovýchod zámek krále, na západ hřbitov s kaplí, na jih rybník a kupecká cesta.',
  road: 'Kupecká cesta do Šedých hor. Kvůli zemětřesení uzavřena až do odvolání. – Rychtář',
  gate: 'Brána je zavřená na závoru. Strážní pustí ven až tehdy, až bude pod horou zase klid.',
};

/** multi-tile things: from which to which tile of their row they reach (for their middle) */
const SPAN: Record<string, [number, number]> = {
  v_bench: [0, 1],
  v_well: [-1, 0],
  v_stall: [-1, 1],
  v_fountain: [-1, 1],
  v_hay: [0, 1],
  v_cart: [0, 1],
  v_woodpile: [0, 1],
  v_crypt: [0, 1],
  v_gate: [-1, 1],
};

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  pts: [number, number][];
  i: number;
  wait: number;
  speed: number;
}

export class Village {
  sc: GameScene;
  /** the shop's goods for this visit */
  shop: MerchantStock | null = null;
  /** the houses, their labels and their keepers (to refresh after an upgrade) */
  houses = new Map<BuildingId, { label: Phaser.GameObjects.Text; npc?: Phaser.GameObjects.Sprite; it: Interactable; img: Phaser.GameObjects.Image }>();
  phase: DayPhase = 'day';
  private chatT = 5;
  private smokeT = 0;
  private fadeT = 0;
  private trees: { img: Phaser.GameObjects.Image; x: number; y: number; top: number; half: number }[] = [];
  private chimneys: { x: number; y: number; col: number; every: number; t: number }[] = [];
  private walkers: Walker[] = [];
  private critters: { s: Phaser.GameObjects.Sprite; area: (x: number, y: number) => boolean; cx: number; cy: number; r: number; t: number; water: boolean }[] = [];
  private ghost: Phaser.GameObjects.Sprite | null = null;
  private lightObjs: { img: Phaser.GameObjects.GameObject & { setAlpha(a: number): unknown }; base: number }[] = [];
  /** the fountain of wishes in the king's courtyard */
  fountain: Phaser.GameObjects.Sprite | null = null;
  /** what the prosperity of Loppo added to the village (made again when it grows) */
  private deco: Phaser.GameObjects.GameObject[] = [];
  private decoIts: Interactable[] = [];
  private fireT = 3;
  private sparkT = 1;

  constructor(sc: GameScene) {
    this.sc = sc;
  }

  /** the ambient particles of the village: pollen by day, fireflies by night */
  get weather() {
    return this.phase === 'night' || this.phase === 'dusk' ? 'night' : 'meadow';
  }

  place() {
    const sc = this.sc;
    const d = sc.dungeon as VillageMap;
    this.phase = dayPhase();
    const ph = PHASE[this.phase];
    sc.darkness = ph.dark;
    sc.darkColor = ph.color;
    sc.heroLight = ph.hero;
    this.trees = [];
    this.chimneys = [];
    this.walkers = [];
    this.critters = [];
    this.lightObjs = [];
    this.placeRuins();
    this.placePalace();
    for (const b of BUILDINGS) this.placeBuilding(b);
    const fallen = listFallen();
    for (const o of d.objects) this.placeObj(o, fallen);
    this.placePeople();
    this.placeLife();
    this.placeProsperity();
    this.shop = this.makeShop();
    // the notice board offers new work on every visit
    villageOf(sc.save).offers = [];
  }

  // ---------------------------------------------------------------- helpers
  private img(key: string, x: number, y: number, depthY = y, oy = 1) {
    return this.sc.add.image(x, y, key).setOrigin(0.5, oy).setScale(ACTOR_SCALE).setDepth(D.entityBase + depthY);
  }

  /** a soft shadow on the ground under something (light comes from the top left) */
  private shadow(x: number, y: number, w: number, alpha = 0.32) {
    this.sc.add
      .image(x + w * 0.08, y - 1, 'shadow')
      .setScale(w / 13, Math.max(1.2, w / 30))
      .setAlpha(alpha)
      .setDepth(D.floorDeco + 1);
  }

  /** a light that shows when it gets dark: a lamp for the darkness and a glow above it */
  private light(x: number, y: number, r: number, tint: number, scale = 0.7, flicker = 0) {
    const sc = this.sc;
    const ph = PHASE[this.phase];
    const glow = sc.add.image(x, y, 'glow').setTint(tint).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setAlpha(0.32 * ph.lamps);
    this.lightObjs.push({ img: glow, base: 0.32 });
    if (ph.lamps > 0) sc.lamps.push({ x, y, r: r * (0.7 + ph.lamps * 0.3), flicker, glow: ph.lamps >= 1 ? glow : undefined });
  }

  /** windows of a building picture light up in the evening */
  private windows(key: string, img: Phaser.GameObjects.Image, tint = 0xffd27a) {
    const ph = PHASE[this.phase];
    if (!ph.windows) return;
    const left = img.x - img.displayWidth / 2,
      top = img.y - img.displayHeight;
    for (const [wx, wy, ww, wh] of VILLAGE_WINDOWS[key] ?? []) {
      const x = left + wx + ww / 2,
        y = top + wy + wh / 2;
      this.sc.add
        .rectangle(x, y, ww, wh, tint, 0.75 * ph.windows)
        .setDepth(img.depth + 0.5);
      const g = this.sc.add.image(x, y, 'glow').setTint(tint).setScale((ww + 14) / 64, (wh + 12) / 64).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35 * ph.windows).setDepth(D.glow);
      void g;
      this.sc.lamps.push({ x, y: y + 6, r: 22 + ww, flicker: 0 });
    }
  }

  private chimneySmoke(key: string, img: Phaser.GameObjects.Image, col = 0x9a9aa8, every = 0.7) {
    const left = img.x - img.displayWidth / 2,
      top = img.y - img.displayHeight;
    for (const [cx, cy] of VILLAGE_CHIMNEYS[key] ?? []) this.chimneys.push({ x: left + cx + 1, y: top + cy + 1, col, every, t: Math.random() * every });
  }

  private tag(x: number, y: number, text: string, color: string) {
    const t = this.sc.fx.label(x, y, text, color, 6);
    t.setDepth(99980);
    return t;
  }

  // ---------------------------------------------------------------- the castle ruins and the palace
  private placeRuins() {
    const sc = this.sc;
    const x = (RUINS.x + 0.5) * TS,
      y = RUINS.y * TS;
    this.img('vh_castle_ruins', x, y);
    // the gate down into the dungeon
    const gate: Interactable = { kind: 'stairs', x, y: y + 6, tx: RUINS.x, ty: RUINS.y, data: { village: true } };
    sc.interactables.push(gate);
    sc.stairsObj = gate;
    // a purple glow breathes out of the dark arch
    const glow = sc.add.image(x, y - 22, 'glow').setTint(0x9a5aff).setScale(1.3, 1.6).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    sc.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    sc.lamps.push({ x, y: y - 10, r: 54, flicker: 0 });
    // torches on both sides of the arch
    for (const dx of [-25, 25]) {
      const t = sc.add.sprite(x + dx, y - 44, 'torch').setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 1).play('torch_loop');
      t.anims.setProgress(Math.random());
      const tg = sc.add.image(x + dx, y - 47, 'glow').setTint(0xff9a3a).setAlpha(0.28).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.lamps.push({ x: x + dx, y: y - 40, r: 70, flicker: dx, glow: tg });
    }
  }

  private placePalace() {
    const sc = this.sc;
    const x = (PALACE.x + 0.5) * TS,
      y = PALACE.y * TS;
    const img = this.img('vh_palace', x, y);
    this.windows('vh_palace', img, 0xffe2a0);
    const left = x - img.displayWidth / 2,
      top = y - img.displayHeight;
    // flags on the towers
    for (const fx of [17, 193]) {
      const f = sc.add.image(left + fx, top + 18, 'vh_flag').setOrigin(0, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 1);
      sc.tweens.add({ targets: f, scaleX: ACTOR_SCALE * 0.82, yoyo: true, repeat: -1, duration: 700 + fx * 3, ease: 'Sine.easeInOut' });
    }
    // lanterns by the great door
    for (const dx of [-16, 16]) this.light(x + dx, y - 22, 46, 0xffc870, 0.5, dx);
  }

  // ---------------------------------------------------------------- the houses
  private placeBuilding(b: BuildingDef) {
    const sc = this.sc;
    const p = PLOTS[b.id];
    const lv = buildingLevel(sc.save, b.id);
    const x = p.cx * TS,
      y = (p.by + 1) * TS;
    const key = lv <= 0 ? 'vh_ruins' : b.id === 'stash' ? 'vh_home_' + Math.min(3, lv) : 'vh_house_' + b.id;
    const img = this.img(key, x, y);
    this.shadow(x, y + 1, img.displayWidth * 1.05, 0.28);
    const top = y - img.displayHeight;
    const label = this.tag(x, top - 4, lv <= 0 ? `${b.name} · v troskách` : `${b.name} ${ROMAN[lv]}`, lv <= 0 ? '#9a94a8' : b.color);
    const nx = (p.cx + p.npc[0]) * TS,
      ny = (p.by + 1 + p.npc[1]) * TS;
    if (lv <= 0) {
      const it: Interactable = { kind: 'vb', x, y: y + 6, tx: Math.floor(p.cx), ty: p.by + 1, data: { id: b.id, ruined: true } };
      sc.interactables.push(it);
      this.houses.set(b.id, { label, it, img });
      return;
    }
    this.windows(key, img, b.id === 'lab' ? 0x9dffc0 : b.id === 'tower' ? 0xd8a8ff : b.id === 'smithy' ? 0xffa050 : 0xffd27a);
    this.chimneySmoke(key, img, b.id === 'lab' ? 0x7dff9a : b.id === 'smithy' ? 0x6a6a74 : 0x9a9aa8, b.id === 'smithy' ? 0.35 : 0.8);
    let npc: Phaser.GameObjects.Sprite | undefined;
    if (b.who) {
      npc = sc.add.sprite(nx, ny, b.who.key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + ny).play(b.who.key + '_idle');
      npc.setFlipX(p.npc[0] > 0);
      sc.add.image(nx, ny, 'shadow').setDepth(D.floorDeco + 2);
      this.tag(nx, ny - 26, b.who.name, '#f0e6d0');
    }
    // what stands by each house
    if (b.id === 'smithy') {
      this.img('anvil', nx - 14, ny + 1);
      const left = x - img.displayWidth / 2;
      const glow = sc.add.image(left + 33, top + 54, 'glow').setTint(0xff7a1a).setAlpha(0.4).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 420 });
      sc.lamps.push({ x: left + 33, y: top + 54, r: 48, flicker: 2 });
    } else if (b.id === 'lab') {
      this.img('cauldron', nx + 15, ny + 1).setScale(1);
      sc.add.image(nx + 15, ny - 6, 'glow').setTint(0x5dff9a).setAlpha(0.3).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    } else if (b.id === 'board') {
      this.img('vh_board', x + 22, y + 12);
    } else if (b.id === 'tower') {
      const glow = sc.add.image(x, top + 40, 'glow').setTint(0xc77dff).setAlpha(0.3).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.tweens.add({ targets: glow, alpha: 0.12, yoyo: true, repeat: -1, duration: 1300 });
    } else if (b.id === 'temple') {
      sc.add.image(x, top + 60, 'glow').setTint(0xfff2a8).setAlpha(0.24).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    }
    const at = b.who ? { x: nx, y: ny } : { x, y: y + 6 };
    const it: Interactable = { kind: 'vb', x: at.x, y: at.y, tx: Math.floor(at.x / TS), ty: Math.floor(at.y / TS), sprite: npc, data: { id: b.id } };
    sc.interactables.push(it);
    this.houses.set(b.id, { label, npc, it, img });
  }

  /** a building grew: its sign shows the new level (the hero's house is rebuilt bigger) */
  refresh(id: BuildingId) {
    const h = this.houses.get(id);
    const b = BUILDING_BY_ID[id];
    if (!h) return;
    const lv = buildingLevel(this.sc.save, id);
    h.label.setText(`${b.name} ${ROMAN[lv]}`);
    if (id === 'stash') {
      h.img.setTexture('vh_home_' + Math.min(3, lv));
      h.label.setY(h.img.y - h.img.displayHeight - 4);
    }
    const sc = this.sc;
    sc.fx.ring(h.img.x, h.img.y - 24, 50, 0xffd23a, 700);
    sc.fx.burst(h.img.x, h.img.y - 24, 0xffd23a, 30);
    sfx('levelup');
  }

  // ---------------------------------------------------------------- everything else of the plan
  private placeObj(o: DObject, fallen: FallenHero[]) {
    const sc = this.sc;
    const k = o.kind;
    if (!k.startsWith('v_')) return;
    const tx = Math.floor(o.x),
      ty = Math.floor(o.y);
    const span = SPAN[k];
    const cx = span ? (tx + (span[0] + span[1]) / 2 + 0.5) * TS : (tx + 0.5) * TS;
    const by = (ty + 1) * TS;
    const r = hash(tx, ty, 77);
    switch (k) {
      case 'v_tree': {
        const t = o.data?.t ?? 'oak';
        const x = o.x * TS,
          y = o.y * TS + 5;
        const im = this.img('vh_tree_' + t, x, y).setFlipX(r < 0.5);
        if (o.data?.forest) {
          im.setScale(ACTOR_SCALE * (0.92 + r * 0.25)).setTint(r < 0.5 ? 0xb0c0b0 : 0xc0ccbc);
        }
        this.shadow(x, y, im.displayWidth * 0.8, o.data?.forest ? 0.25 : 0.34);
        this.trees.push({ img: im, x, y, top: y - im.displayHeight, half: im.displayWidth * 0.42 });
        break;
      }
      case 'v_lamp': {
        this.img('vh_lamp', cx, by + 2);
        this.shadow(cx, by + 2, 10, 0.3);
        this.light(cx, by - 26, 72, 0xffc060, 0.7, tx);
        break;
      }
      case 'v_well': {
        this.img('vh_well', cx, by + 4);
        this.shadow(cx, by + 4, 28, 0.3);
        sc.interactables.push({ kind: 'vwell', x: cx, y: by + 10, tx, ty: ty + 1, data: {} });
        break;
      }
      case 'v_fountain': {
        // King Dobromil III's gift: "whoever throws a coin will return" – the fountain of wishes (see data/fountain.ts)
        this.fountain = sc.add.sprite(cx, by + 4, 'vh_fountain', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + by + 4).play('vh_fountain_loop');
        sc.interactables.push({ kind: 'vfount', x: cx, y: by + 10, tx, ty: ty + 1, sprite: this.fountain, data: {} });
        this.tag(cx, by - 30, 'Fontána přání', '#ffd76a');
        break;
      }
      case 'v_grave': {
        const i = o.data?.i ?? 0;
        const hero = fallen[i];
        const key = hero ? 'vh_grave_0' : 'vh_grave_' + [1, 2, 3, 4, 0, 2, 1, 4, 3, 2][i % 10];
        this.img(key, cx, by + 1);
        if (hero) {
          // a candle burns at the grave of a fallen hero
          const cg = sc.add.image(cx + 6, by - 2, 'glow').setTint(0xffb050).setScale(0.25).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
          sc.tweens.add({ targets: cg, alpha: 0.35, yoyo: true, repeat: -1, duration: 500 + i * 40 });
          sc.add.rectangle(cx + 6, by - 2, 2, 3, 0xf4eedc).setDepth(D.entityBase + by + 2);
          sc.lamps.push({ x: cx + 6, y: by - 3, r: 22, flicker: i });
        }
        sc.interactables.push({ kind: 'vgrave', x: cx, y: by + 6, tx, ty: ty + 1, data: { i, hero } });
        break;
      }
      case 'v_crypt': {
        this.img('vh_crypt', cx, by + 2);
        this.shadow(cx, by + 2, 40, 0.3);
        sc.interactables.push({ kind: 'vsign', x: cx, y: by + 8, tx, ty: ty + 1, data: { title: 'Hrobka zakladatelů', text: 'Na kamenné desce stojí: „Zde spí ti, kdo postavili Loppo na úpatí hory a přísahali, že ji budou hlídat. Pečeť drží, dokud ji někdo drží.“ Mříž je zarezlá a za ní je ticho.', wall: true } });
        break;
      }
      case 'v_ifence':
        if (o.data?.dir === 'v') this.img('vh_ifence_v', (tx + 0.5) * TS, by + 3);
        else this.img('vh_ifence_h', (tx + 0.5) * TS, by + 1);
        break;
      case 'v_igate':
        this.img('vh_igate', o.x * TS, by + 2, by + 18);
        break;
      case 'v_fence':
        if (o.data?.dir === 'v') this.img('vh_fence_v', (tx + 0.5) * TS, by + 3);
        else this.img('vh_fence_h', (tx + 0.5) * TS, by);
        break;
      case 'v_crop':
        this.img('vh_crop_' + (o.data?.t ?? 'cabbage'), o.x * TS, o.y * TS + 4);
        break;
      case 'v_reeds':
        this.img('vh_reeds', o.x * TS, o.y * TS + 3).setFlipX(r < 0.5);
        break;
      case 'v_lily':
        sc.add.image(o.x * TS, o.y * TS, o.data?.f ? 'vh_lily_f' : 'vh_lily').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 2).setFlipX(r < 0.5);
        break;
      case 'v_boat': {
        const b = sc.add.image(o.x * TS, o.y * TS, 'vh_boat').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 3);
        sc.tweens.add({ targets: b, y: b.y + 1, angle: 2, yoyo: true, repeat: -1, duration: 1900, ease: 'Sine.easeInOut' });
        break;
      }
      case 'v_bush':
        this.img('vh_bush_' + (o.data?.t ?? 'green'), cx, by + 1).setFlipX(r < 0.5);
        this.shadow(cx, by + 1, 18, 0.26);
        break;
      case 'v_rock':
        this.img('vh_rock_' + (o.data?.t ?? 'a'), cx, by).setFlipX(r < 0.5);
        break;
      case 'v_stump':
        this.img('vh_stump', o.x * TS, o.y * TS + 4);
        break;
      case 'v_bench':
        this.img('vh_bench', cx, by + 1);
        break;
      case 'v_stall':
        this.img('vh_stall_' + (o.data?.t ?? 'veg'), cx, by + 3);
        this.shadow(cx, by + 3, 40, 0.28);
        break;
      case 'v_woodpile':
      case 'v_hay':
      case 'v_cart':
        this.img('vh_' + k.slice(2), cx, by + 2).setFlipX(k === 'v_cart' && r < 0.5);
        this.shadow(cx, by + 2, 26, 0.26);
        break;
      case 'v_barrel':
      case 'v_crate':
        this.img('vh_' + k.slice(2), cx, by + 1);
        break;
      case 'v_target':
      case 'v_dummy':
        this.img('vh_' + k.slice(2), cx, by + 2);
        break;
      case 'v_sign': {
        const t = o.data?.t ?? 'cross';
        this.img('vh_sign_' + t, cx, by + 2);
        sc.interactables.push({ kind: 'vsign', x: cx, y: by + 8, tx, ty: ty + 1, data: { title: 'Ukazatel', text: SIGNS[t] } });
        break;
      }
      case 'v_gate':
        this.img('vh_gate', cx, by + 4);
        sc.interactables.push({ kind: 'vsign', x: cx, y: by - 8, tx, ty: ty - 1, data: { title: 'Brána', text: SIGNS.gate } });
        break;
    }
  }

  // ---------------------------------------------------------------- people
  private placePeople() {
    const sc = this.sc;
    const person = (key: string, x: number, y: number, name: string, color: string, flip = false) => {
      const s = sc.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y).play(key + '_idle');
      s.setFlipX(flip);
      s.anims.setProgress(Math.random());
      sc.add.image(x, y, 'shadow').setDepth(D.floorDeco + 2);
      if (name) this.tag(x, y - 26, name, color);
      return s;
    };
    // Ilda by the well, with her lantern
    const ix = ILDA.x * TS,
      iy = ILDA.y * TS;
    const ilda = person('npc_ilda', ix, iy, 'Ilda', '#ffd76a', true);
    sc.interactables.push({ kind: 'vilda', x: ix, y: iy, tx: Math.floor(ILDA.x), ty: Math.floor(ILDA.y), sprite: ilda, data: {} });
    this.light(ix + 5, iy - 8, 44, 0xffd76a, 0.35, 3);
    // the king before his palace, the guards at his sides
    const kx = KING.x * TS,
      ky = KING.y * TS;
    const king = person('npc_king', kx, ky, 'Král Dobromil III.', '#ffd76a');
    sc.interactables.push({ kind: 'vking', x: kx, y: ky, tx: Math.floor(KING.x), ty: Math.floor(KING.y), sprite: king, data: {} });
    GUARDS.forEach(([gx, gy], i) => {
      const g = person('npc_guard', gx * TS, gy * TS, '', '#fff', i === 1);
      sc.interactables.push({ kind: 'vguard', x: gx * TS, y: gy * TS, tx: Math.floor(gx), ty: Math.floor(gy), sprite: g, data: {} });
    });
    // two villagers about their business
    const walker = (key: string, pts: [number, number][]) => {
      const [x0, y0] = pts[0];
      const s = sc.add.sprite(x0 * TS, y0 * TS, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y0 * TS).play(key + '_idle');
      this.walkers.push({ sprite: s, key, pts: pts.map(([x, y]) => [x * TS, y * TS]), i: 0, wait: 1 + Math.random() * 3, speed: 22 });
    };
    walker('npc_folk_a', [
      [30, 23.5],
      [24.5, 22.8],
      [20.5, 21.6],
      [24.5, 22.8],
      [29.6, 27.8],
      [32.2, 33],
      [32.6, 38.6],
      [32.2, 33],
      [30.6, 27],
    ]);
    walker('npc_folk_b', [
      [34.6, 23.4],
      [38.8, 22.6],
      [42.6, 20.8],
      [46.6, 18.2],
      [42.6, 20.8],
      [38.8, 22.6],
      [36, 27.2],
      [40.4, 29.9],
      [36, 27.2],
    ]);
  }

  /** ducks on the pond, chickens by the house, butterflies by day, glints on the water, a ghost at night */
  private placeLife() {
    const sc = this.sc;
    const inPond = (x: number, y: number) => pondValue(x / TS, y / TS) < 0.62;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const x = (POND.x + Math.cos(a) * POND.rx * 0.4) * TS,
        y = (POND.y + Math.sin(a) * POND.ry * 0.4) * TS;
      const s = sc.add.sprite(x, y, 'vh_duck', 0).setScale(ACTOR_SCALE).setDepth(D.floorDeco + 4).play('vh_duck_loop');
      this.critters.push({ s, area: inPond, cx: POND.x * TS, cy: POND.y * TS, r: POND.rx * TS, t: Math.random() * 3, water: true });
    }
    const home = PLOTS.stash;
    const yard = (x: number, y: number) => !sc.map.collides(x, y, 3) && Math.hypot(x - (home.cx + 3.2) * TS, y - (home.by + 3) * TS) < 3.2 * TS;
    for (let i = 0; i < 3; i++) {
      const x = (home.cx + 2.4 + i) * TS,
        y = (home.by + 2.6 + (i % 2)) * TS;
      if (sc.map.collides(x, y, 3)) continue;
      const s = sc.add.sprite(x, y, 'vh_chicken', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y);
      this.critters.push({ s, area: yard, cx: (home.cx + 3.2) * TS, cy: (home.by + 3) * TS, r: 3 * TS, t: Math.random() * 2, water: false });
    }
    // glints on the pond
    for (let i = 0; i < 7; i++) {
      const g = sc.add.image(0, 0, 'vh_glint').setScale(ACTOR_SCALE * 0.8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.floorDeco + 5);
      const blink = () => {
        for (let k = 0; k < 10; k++) {
          const x = (POND.x + (Math.random() - 0.5) * POND.rx * 1.7) * TS,
            y = (POND.y + (Math.random() - 0.5) * POND.ry * 1.7) * TS;
          if (inPond(x, y)) {
            g.setPosition(x, y);
            break;
          }
        }
        sc.tweens.add({ targets: g, alpha: { from: 0, to: 0.85 }, yoyo: true, duration: 380, delay: 400 + Math.random() * 2600, onComplete: blink });
      };
      blink();
    }
    if (this.phase === 'day' || this.phase === 'dawn') {
      // butterflies over the flowers
      const spots: [number, number][] = [
        [20.5, 39.5],
        [49.5, 29],
        [44, 16.5],
        [53, 16.5],
        [12, 24],
        [38, 36],
        [56, 30],
      ];
      spots.forEach(([bx, by], i) => {
        const tints = [0xffffff, 0xfff27a, 0x9ad0ff, 0xffb0d8, 0xffc070];
        const s = sc.add.sprite(bx * TS, by * TS, 'vh_butterfly', 0).setScale(ACTOR_SCALE).setTint(tints[i % tints.length]).setDepth(D.entityBase + 2000).play('vh_butterfly_loop');
        s.anims.msPerFrame = 90;
        const flutter = () => {
          const nx = (bx + (Math.random() - 0.5) * 4) * TS,
            ny = (by + (Math.random() - 0.5) * 3) * TS;
          s.setFlipX(nx < s.x);
          sc.tweens.add({ targets: s, x: nx, y: ny - 6, duration: 1400 + Math.random() * 1600, ease: 'Sine.easeInOut', onComplete: flutter });
        };
        flutter();
      });
    } else {
      // a friendly ghost wanders the graveyard at night
      const gs = sc.add.sprite(9.5 * TS, 13 * TS, 'en_ghost', 0).setScale(ACTOR_SCALE).setAlpha(0.45).setDepth(D.entityBase + 13 * TS + 20).setBlendMode(Phaser.BlendModes.ADD);
      if (sc.anims.exists('en_ghost_idle')) gs.play('en_ghost_idle');
      this.ghost = gs;
      const drift = () => {
        const nx = (5 + Math.random() * 10) * TS,
          ny = (6.5 + Math.random() * 9) * TS;
        gs.setFlipX(nx < gs.x);
        sc.tweens.add({ targets: gs, x: nx, y: ny, duration: 4000 + Math.random() * 3000, ease: 'Sine.easeInOut', onComplete: drift });
      };
      drift();
    }
  }

  /** the shop's goods: more and better as it grows */
  makeShop(): MerchantStock {
    const sc = this.sc;
    const st = sc.makeStock();
    const lv = buildingLevel(sc.save, 'shop');
    const f = sc.floor;
    st.items = [];
    for (let i = 0; i < shopSize(sc.save); i++) {
      const legendary = lv >= 3 && Math.random() < 0.1;
      st.items.push(
        generateItem(f + Math.floor(Math.random() * 3), {
          magicFind: 30 + lv * 20,
          rarity: legendary ? 4 : undefined,
          rarityBonus: lv >= 2 && Math.random() < 0.4 ? 1 : Math.random() < 0.25 ? 1 : 0,
          filter: i < 4 ? sc.loot.bias() : undefined,
        }),
      );
    }
    return st;
  }

  label(it: Interactable): string {
    switch (it.kind) {
      case 'vilda':
        return 'Promluvit s Ildou';
      case 'vwell':
        return 'Napít se ze studny';
      case 'vking':
        return 'Promluvit s králem';
      case 'vguard':
        return 'Promluvit se strážným';
      case 'vgrave':
        return it.data.hero ? 'Hrob hrdiny' : 'Přečíst náhrobek';
      case 'vsign':
        return it.data.title ?? 'Přečíst';
      case 'vfount':
        return 'Fontána přání';
    }
    const b = BUILDING_BY_ID[it.data.id as BuildingId];
    if (it.data.ruined) return `${b.name} (v troskách)`;
    return b.who ? `${b.name}: ${b.who.name}` : b.name;
  }

  interact(it: Interactable) {
    const sc = this.sc;
    switch (it.kind) {
      case 'vwell': {
        const p = sc.player;
        p.hp = p.d.maxHp;
        p.mp = p.d.maxMp;
        sfx('heal');
        sc.fx.burst(p.x, p.y - 6, 0x7cc8ff, 18);
        sc.ui.toast('Voda z Loppa chutná jako domov. Zdraví i mana jsou plné.', '#7cc8ff');
        return;
      }
      case 'vilda':
        return this.talkIlda();
      case 'vking':
        return sc.ui.quests.royal();
      case 'vguard':
        return this.say(it, GUARD_LINES[Math.floor(Math.random() * GUARD_LINES.length)]);
      case 'vgrave':
        return this.readGrave(it);
      case 'vsign':
        sfx('ui');
        return sc.ui.panels.note(it.data.title, it.data.text, it.data.wall ? 'wall' : 'note');
      case 'vfount':
        sfx('ui');
        return sc.ui.buildings.fountain();
    }
    sc.ui.buildings.open(it.data.id as BuildingId);
  }

  // ---------------------------------------------------------------- the fountain of wishes and the prosperity of Loppo
  /** a coin flies from the hero into the fountain (a great wish: a handful; something rare: a burst of light) */
  throwCoin(big: boolean, rare: boolean) {
    const sc = this.sc;
    const f = this.fountain;
    const p = sc.player;
    if (!f) return;
    const tx = f.x,
      ty = f.y - 10;
    const n = big ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const c = sc.add.sprite(p.x, p.y - 10, 'coin').play('coin_loop').setDepth(D.ui - 5);
      const dx = (Math.random() - 0.5) * 10;
      sc.tweens.add({ targets: c, x: tx + dx, duration: 520, delay: i * 70, ease: 'Linear' });
      sc.tweens.add({ targets: c, y: Math.min(p.y, ty) - 34, duration: 260, delay: i * 70, ease: 'Quad.easeOut', yoyo: false, onComplete: () => sc.tweens.add({ targets: c, y: ty, duration: 260, ease: 'Quad.easeIn' }) });
      sc.time.delayedCall(540 + i * 70, () => {
        c.destroy();
        sc.fx.burst(tx + dx, ty, 0x9fd8ff, 8, 'pix');
        if (i === 0) sfx('coin');
      });
    }
    sc.time.delayedCall(620 + n * 70, () => {
      sc.fx.burst(tx, ty - 6, rare ? 0xffd76a : 0xc8e8ff, rare ? 40 : 12, 'spark');
      sc.fx.ring(tx, ty - 4, rare ? 46 : 24, rare ? 0xffd76a : 0x9fd8ff, rare ? 800 : 500);
      if (rare) sfx('levelup');
    });
  }

  /** the village grew a level of prosperity: what it adds appears at once */
  refreshProsperity() {
    for (const o of this.deco) {
      this.sc.tweens.killTweensOf(o);
      o.destroy();
    }
    this.deco = [];
    this.sc.interactables = this.sc.interactables.filter((i) => !this.decoIts.includes(i));
    this.decoIts = [];
    this.placeProsperity();
  }

  /** flowers around the well, banners along the ways, garlands of lights over the square, the hero's statue, a
   *  golden fountain – whatever the village's prosperity has reached */
  private placeProsperity() {
    const sc = this.sc;
    const lv = prosperityLevel(sc.save);
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.deco.push(o);
      return o;
    };
    if (lv >= 5)
      for (const [x, y] of [
        [30, 22.9],
        [34, 22.9],
        [30, 27.5],
        [33.6, 27.7],
      ])
        keep(sc.add.image(x * TS, y * TS, 'vh_flowers').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 2));
    if (lv >= 10) {
      const cols = ['red', 'blue', 'gold'];
      [
        [27.8, 20.7],
        [36.7, 20.7],
        [27.8, 29.3],
        [36.7, 29.3],
        [26.8, 12.4],
        [43.4, 13.4],
        [53.6, 13.4],
        [34.6, 33.4],
        [31.2, 42.4],
      ].forEach(([x, y], i) => {
        const px = x * TS,
          py = (Math.floor(y) + 1) * TS + 2;
        keep(this.img('vh_flag_' + cols[i % cols.length], px, py).setFlipX(i % 2 === 1));
        keep(sc.add.image(px + 1, py - 1, 'shadow').setScale(0.5, 0.4).setAlpha(0.3).setDepth(D.floorDeco + 1));
      });
    }
    if (lv >= 15) this.garlands(keep);
    if (lv >= 20) {
      // the hero's statue on the square, in gold
      const x = 28.6 * TS,
        y = 26 * TS;
      keep(this.img('vh_pedestal', x, y));
      const st = keep(sc.add.image(x, y - 7, 'pl_' + sc.save.cls, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE * 1.15).setTint(0xffe9a8, 0xf0c860, 0xd8a838, 0xc8901e).setDepth(D.entityBase + y));
      void st;
      keep(sc.add.image(x, y - 16, 'glow').setTint(0xffd76a).setAlpha(0.18).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow));
      this.shadow(x, y, 26, 0.3);
      const who = sc.save.heroName || CLASS_BY_ID[sc.save.cls].name;
      const it: Interactable = { kind: 'vsign', x, y: y + 6, tx: Math.floor(x / TS), ty: Math.floor(y / TS), data: { title: 'Socha hrdiny', text: `Na zlaté destičce stojí: „${who} – naděje Loppa. Postaveno z darů osady, která znovu ožila.“ Kolem podstavce leží čerstvé květiny.` } };
      sc.interactables.push(it);
      this.decoIts.push(it);
    }
    if (this.fountain) {
      // a golden fountain: warm light on the stone and a golden glow over the water (a dark gold tint would make
      // the stone muddy)
      if (lv >= 30) {
        this.fountain.setTint(0xfff6d8, 0xfff6d8, 0xffe6a8, 0xffe6a8);
        const f = this.fountain;
        const g = keep(sc.add.image(f.x, f.y - 12, 'glow').setTint(0xffd76a).setScale(1.1, 0.7).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow));
        sc.tweens.add({ targets: g, alpha: 0.18, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
      } else this.fountain.clearTint();
    }
  }

  /** strings of little lights between the lamps of the square (they glow in the evening) */
  private garlands(keep: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const sc = this.sc;
    const ph = PHASE[this.phase];
    const g = keep(sc.add.graphics().setDepth(D.entityBase + 21 * TS + 40));
    const bulbs = [0xff5a5a, 0xffd23a, 0x5adf6a, 0x4aa8ff, 0xc86aff];
    const lines: [number, number, number, number][] = [
      [26.5 * TS, 21 * TS - 13, 37.5 * TS, 21 * TS - 13],
      [26.5 * TS, 30 * TS - 13, 37.5 * TS, 30 * TS - 13],
    ];
    for (const [x0, y0, x1, y1] of lines) {
      const n = 22;
      let px0 = x0,
        py0 = y0;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t,
          y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 12;
        g.lineStyle(1, 0x2a2420, 0.9).lineBetween(px0, py0, x, y);
        if (i % 2 === 0 && i < n) {
          const c = bulbs[(i / 2) % bulbs.length];
          g.fillStyle(c, 1).fillRect(x - 1, y, 2, 2);
          if (ph.lamps > 0) keep(sc.add.image(x, y + 1, 'glow').setTint(c).setScale(0.14).setAlpha(0.55 * ph.lamps).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow));
        }
        px0 = x;
        py0 = y;
      }
    }
  }

  /** fireworks over Loppo in the evening (from the fifth rank of prosperity) and the sparkle of a golden fountain */
  private festivities(dt: number) {
    const sc = this.sc;
    const lv = prosperityLevel(sc.save);
    if (lv >= 30 && this.fountain) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.35 + Math.random() * 0.4;
        sc.fx.burst(this.fountain.x + (Math.random() - 0.5) * 30, this.fountain.y - 14 - Math.random() * 10, 0xffe08a, 2, 'spark');
      }
    }
    if (lv < 25 || (this.phase !== 'night' && this.phase !== 'dusk')) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 2.2 + Math.random() * 3;
    const p = sc.player;
    const x = p.x + (Math.random() - 0.5) * 220,
      y0 = p.y + 40,
      y1 = p.y - 70 - Math.random() * 50;
    const cols = [0xff5a5a, 0xffd23a, 0x5adf6a, 0x4aa8ff, 0xc86aff, 0xff9ad8, 0xffffff];
    const col = cols[Math.floor(Math.random() * cols.length)];
    const rocket = sc.add.image(x, y0, 'glow').setTint(0xfff2c0).setScale(0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.ui - 10);
    sc.tweens.add({
      targets: rocket,
      y: y1,
      duration: 800,
      ease: 'Quad.easeOut',
      onUpdate: () => sc.fx.trail(rocket.x, rocket.y + 2, 0xffc060, 'spark'),
      onComplete: () => {
        rocket.destroy();
        sc.fx.trail(x, y1, col, 'spark');
        sc.fx.burst(x, y1, col, 36, 'spark');
        sc.fx.burst(x, y1, 0xffffff, 10, 'spark');
        const flash = sc.add.image(x, y1, 'glow').setTint(col).setScale(1.2).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.ui - 11);
        sc.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 600, onComplete: () => flash.destroy() });
      },
    });
  }

  /** the rank of the village for its title card */
  rankName() {
    return prosperityRank(prosperityLevel(this.sc.save)).name;
  }

  /** a line above someone's head */
  private say(it: Interactable, line: string) {
    const s = it.sprite as Phaser.GameObjects.Sprite | undefined;
    const x = s?.x ?? it.x,
      y = (s?.y ?? it.y) - 28;
    const t = this.sc.fx.label(x, y, line, '#f0e6d0', 6, true);
    t.setDepth(99985);
    this.sc.tweens.add({ targets: t, y: t.y - 6, alpha: { from: 1, to: 0 }, delay: 2600, duration: 500, onComplete: () => t.destroy() });
    sfx('ui');
  }

  private readGrave(it: Interactable) {
    const sc = this.sc;
    const h = it.data.hero as FallenHero | undefined;
    sfx('ui');
    if (h) {
      const cls = CLASS_BY_ID[h.cls]?.name ?? h.cls;
      const date = new Date(h.date).toLocaleDateString('cs-CZ');
      sc.ui.panels.note(
        'Hrob hrdiny',
        `Zde odpočívá statečná duše: ${cls}, ${h.level}. úroveň. Výprava skončila v ${h.floor}. patře, nejhlouběji ${h.maxFloor}. patro. Poražených nestvůr: ${h.kills.toLocaleString('cs-CZ')}. Pohřbeno ${date}. Ilda sem každý večer nosí svíčku.`,
        'wall',
      );
      return;
    }
    sc.ui.panels.note('Náhrobek', EPITAPHS[(it.data.i ?? 0) % EPITAPHS.length], 'wall');
  }

  /** Ilda tells how the village is doing and who is still missing */
  talkIlda() {
    const sc = this.sc;
    const s = sc.save;
    const v = villageOf(s);
    const home = BUILDINGS.filter((b) => b.who && (v.lv[b.id] ?? 0) > 0).length;
    const all = BUILDINGS.filter((b) => b.who).length;
    const due = villagerDue(s, s.maxFloor);
    const next = BUILDINGS.find((b) => b.who && !v.lv[b.id]);
    let news: string;
    if (home >= all) news = 'Všichni jsou doma. Loppo zase žije – a to díky tobě.';
    else if (due) news = `${due.who!.name} (${due.who!.trade}) je pořád dole. Prý ${due.who!.fem ? 'ji' : 'ho'} drží nestvůry někde od ${due.rescue}. patra.`;
    else if (next) news = `Někde hlouběji, od ${next.rescue}. patra, prý drží ${next.who!.fem ? 'naši' : 'našeho'} ${next.who!.trade === 'kupkyně' ? 'kupkyni' : next.who!.trade} ${next.who!.name}.`;
    else news = '';
    const bl = activeBlessing(s);
    const line = `Zachránění: ${home} z ${all}. ${news} ${bl ? `Požehnání chrámu (${BLESSING_BY_ID[bl.id].name}) tě chrání do ${bl.until}. patra.` : ''}`.trim();
    sc.ui.panels.talk(
      { title: 'Ilda', sub: 'strážkyně pečeti', portrait: 'npc_ilda', line: `${line} ${ILDA_LINES[Math.floor(Math.random() * ILDA_LINES.length)]}`, choices: [{ id: 'ok', label: 'Díky, Ildo', cls: 'green' }] },
      () => {},
    );
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    this.festivities(dt);
    // smoke from the chimneys
    for (const c of this.chimneys) {
      c.t -= dt;
      if (c.t > 0) continue;
      c.t = c.every * (0.8 + Math.random() * 0.4);
      sc.fx.burst(c.x, c.y, c.col, 1, 'puff');
    }
    // trees the hero walks behind become see-through
    this.fadeT -= dt;
    if (this.fadeT <= 0) {
      this.fadeT = 0.12;
      for (const t of this.trees) {
        if (Math.abs(t.x - p.x) > 40 || Math.abs(t.y - p.y) > 70) {
          if (t.img.alpha < 1) t.img.setAlpha(1);
          continue;
        }
        const behind = p.y < t.y - 2 && p.y > t.top + 6 && Math.abs(p.x - t.x) < t.half;
        t.img.setAlpha(behind ? 0.55 : 1);
      }
    }
    // the villagers walk their rounds
    for (const w of this.walkers) this.walk(w, dt);
    // ducks paddle about, chickens peck around the house
    for (const c of this.critters) {
      c.t -= dt;
      if (c.t > 0) continue;
      c.t = c.water ? 4 + Math.random() * 5 : 1.2 + Math.random() * 2.5;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2,
          d = Math.random() * c.r;
        const nx = c.cx + Math.cos(a) * d,
          ny = c.cy + Math.sin(a) * d * (c.water ? 0.55 : 1);
        if (!c.area(nx, ny)) continue;
        c.s.setFlipX(nx < c.s.x);
        const dist = Math.hypot(nx - c.s.x, ny - c.s.y);
        if (!c.water) c.s.play('vh_chicken_loop', true);
        sc.tweens.add({
          targets: c.s,
          x: nx,
          y: ny,
          duration: (dist / (c.water ? 6 : 14)) * 1000,
          ease: 'Sine.easeInOut',
          onUpdate: () => !c.water && c.s.setDepth(D.entityBase + c.s.y),
          onComplete: () => {
            if (!c.water) c.s.stop().setFrame(0);
          },
        });
        break;
      }
    }
    // the night ghost fades when the hero comes close
    if (this.ghost) {
      const d = Math.hypot(this.ghost.x - p.x, this.ghost.y - p.y);
      this.ghost.setAlpha(Math.min(0.45, Math.max(0.05, (d - 20) / 120)));
    }
    // the keepers talk to the hero walking by
    this.chatT -= dt;
    if (this.chatT > 0 || sc.ui.panel) return;
    this.chatT = 4 + Math.random() * 3;
    for (const [id, h] of this.houses) {
      const lines = CHATTER[id];
      if (!h.npc || !lines.length || Math.hypot(p.x - h.npc.x, p.y - h.npc.y) > 80) continue;
      this.say(h.it, lines[Math.floor(Math.random() * lines.length)]);
      return;
    }
    for (const w of this.walkers)
      if (Math.hypot(p.x - w.sprite.x, p.y - w.sprite.y) < 60) {
        this.say({ kind: 'vfolk', x: w.sprite.x, y: w.sprite.y, tx: 0, ty: 0, sprite: w.sprite, data: {} }, FOLK_LINES[Math.floor(Math.random() * FOLK_LINES.length)]);
        return;
      }
  }

  private walk(w: Walker, dt: number) {
    const s = w.sprite;
    if (w.wait > 0) {
      w.wait -= dt;
      if (w.wait <= 0) w.i = (w.i + 1) % w.pts.length;
      return;
    }
    const [tx, ty] = w.pts[w.i];
    const dx = tx - s.x,
      dy = ty - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) {
      // a pause at some points of the round
      w.wait = w.i % 3 === 1 ? 2 + Math.random() * 3 : 0.01;
      if (w.wait > 0.5) s.play(w.key + '_idle', true);
      return;
    }
    const step = Math.min(d, w.speed * dt);
    s.x += (dx / d) * step;
    s.y += (dy / d) * step;
    s.setFlipX(dx < 0);
    s.setDepth(D.entityBase + s.y);
    s.play(w.key + '_walk', true);
  }
}
