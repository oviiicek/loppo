import type { Quest } from './quests';
import { RoyalState, royalStats } from './royal';

// The village of Loppo above the dungeon: the hero's home. When the earth shook, monsters dragged
// villagers down into the dungeon; each one the hero frees comes home and opens their workshop.
// The buildings then grow with the gold the hero invests in them.

export type BuildingId = 'stash' | 'smithy' | 'shop' | 'board' | 'lab' | 'tower' | 'trainer' | 'temple';

export interface Villager {
  name: string;
  /** what they do ("kovář") */
  trade: string;
  /** their sprite */
  key: string;
  fem?: boolean;
  /** what they say when the hero frees them in the dungeon */
  thanks: string;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** who runs it (the stash needs nobody) */
  who: Villager | null;
  /** from this floor on the villager can be found captive in the dungeon (0 = home from the start) */
  rescue: number;
  desc: string;
  /** level 1 comes with the rescue; each further level costs gold and brings more */
  levels: { cost: number; text: string }[];
  color: string;
  /** item icon (or sprite) for the panels */
  icon: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'stash',
    name: 'Tvůj dům',
    who: null,
    rescue: 0,
    desc: 'Domov s truhlou na předměty, postelí k odpočinku a místem pro trofeje. Truhla je společná pro celou výpravu.',
    levels: [
      { cost: 0, text: 'Chalupa: truhla na 42 předmětů, postel' },
      { cost: 2500, text: 'Dům: truhla na 84 předmětů, odpočinek platí 5 pater' },
      { cost: 12000, text: 'Statek: truhla na 126 předmětů, odpočinek dává i +5 % poškození' },
    ],
    color: '#c8a070',
    icon: 'chest_iron',
  },
  {
    id: 'smithy',
    name: 'Kovárna',
    who: { name: 'Bořek', trade: 'kovář', key: 'npc_smith', thanks: 'Díky! Ti skřeti mě chtěli nechat kovat jim řetězy. Vrátím se do Loppa a rozdmýchám výheň – stav se, až budeš potřebovat ostří.' },
    rescue: 3,
    desc: 'Vylepšování, očarování, přehazování vlastností a vrtání soketů.',
    levels: [
      { cost: 0, text: 'Kovadlina: vylepšování, očarování, sokety' },
      { cost: 4000, text: 'Výheň: vylepšení v Loppu má o 10 % větší šanci na úspěch' },
      { cost: 20000, text: 'Mistrovská kovárna: vylepšení a sokety v Loppu o 25 % levnější' },
    ],
    color: '#ff9a3a',
    icon: 'anvil',
  },
  {
    id: 'shop',
    name: 'Obchod',
    who: { name: 'Šárka', trade: 'kupkyně', key: 'npc_trader', fem: true, thanks: 'Ach, konečně! Celý krám mi vykradli a mě zavřeli k zásobám. Otevřu si obchod znovu v Loppu – pro tebe za lepší ceny.' },
    rescue: 5,
    desc: 'Nákup a prodej. Zboží se obmění pokaždé, když se vrátíš z hlubin.',
    levels: [
      { cost: 0, text: '9 předmětů v nabídce' },
      { cost: 5000, text: '12 předmětů, častěji vzácné zboží' },
      { cost: 25000, text: '15 předmětů, občas i legendární' },
    ],
    color: '#ffd23a',
    icon: 'npc_trader',
  },
  {
    id: 'board',
    name: 'Nástěnka úkolů',
    who: { name: 'Jitka', trade: 'lovkyně', key: 'npc_hunter', fem: true, thanks: 'Šla jsem po stopě ztracených vesničanů a sama skončila v síti. Hanba! V Loppu vyvěsím nástěnku – kdo pomůže, dostane zaplaceno.' },
    rescue: 7,
    desc: 'Úkoly od vesničanů. Za splnění zlato, předměty a materiál.',
    levels: [
      { cost: 0, text: 'Až 5 úkolů zároveň' },
      { cost: 6000, text: 'Až 7 úkolů zároveň, o 25 % vyšší odměny' },
      { cost: 30000, text: 'Až 10 úkolů zároveň, o 50 % vyšší odměny' },
    ],
    color: '#9dff7a',
    icon: 'page',
  },
  {
    id: 'lab',
    name: 'Laboratoř',
    who: { name: 'Vanda', trade: 'alchymistka', key: 'npc_alchemist', fem: true, thanks: 'Moje baňky! Moje byliny! Ty bestie mi rozbily celou laboratoř. Postavím novou v Loppu – lektvary i transmutace pro tebe.' },
    rescue: 9,
    desc: 'Transmutace pěti předmětů v lepší a výroba lektvarů.',
    levels: [
      { cost: 0, text: 'Transmutace a lektvary za 70 % ceny' },
      { cost: 8000, text: 'Silnější lektvary: všechny léčí o 25 % víc' },
      { cost: 35000, text: 'Transmutace v Loppu se už nikdy nezdaří' },
    ],
    color: '#7dffcf',
    icon: 'cauldron',
  },
  {
    id: 'tower',
    name: 'Věž mága',
    who: { name: 'Ignác', trade: 'mág', key: 'npc_mage', thanks: 'Hm, děkuji. Ne že bych se z těch řetězů nedostal sám… za týden nebo dva. Ve věži v Loppu ti prodám runy a naučím tě zapomínat talenty.' },
    rescue: 12,
    desc: 'Runy do zbraní, runy kouzel a zapomenutí talentů.',
    levels: [
      { cost: 0, text: 'Prodej run 1. a 2. stupně' },
      { cost: 10000, text: 'Runy do 3. stupně a runy kouzel' },
      { cost: 40000, text: 'Runy do 4. stupně, zapomenutí talentů všude za polovic' },
    ],
    color: '#c77dff',
    icon: 'npc_mage',
  },
  {
    id: 'trainer',
    name: 'Cvičiště',
    who: { name: 'Radovan', trade: 'mistr zbraní', key: 'npc_trainer', thanks: 'Dvacet let učím mladé bojovat a nechám se chytit jako zelenáč. Na cvičišti v Loppu tě naučím něco nového – a tvůj žoldák se tam něco přiučí taky.' },
    rescue: 15,
    desc: 'Změna classy, přerozdělení atributů a výcvik žoldáka.',
    levels: [
      { cost: 0, text: 'Změna classy a přerozdělení atributů' },
      { cost: 12000, text: 'Výcvik: +5 % zkušeností navždy' },
      { cost: 45000, text: 'Mistrovský výcvik: dalších +5 % zkušeností a žoldák +20 % síly' },
    ],
    color: '#ff6a5a',
    icon: 'npc_trainer',
  },
  {
    id: 'temple',
    name: 'Chrám',
    who: { name: 'Bohdana', trade: 'kněžka', key: 'npc_priest', fem: true, thanks: 'Světlo tě provází. Modlila jsem se za záchranu a přišla. V Loppu znovu zapálím chrámové svíce – požehnám ti a sejmu kletby.' },
    rescue: 20,
    desc: 'Požehnání na další patra a krocení kleteb: prokletý předmět si nechá část síly a ztratí svou daň.',
    levels: [
      { cost: 0, text: 'Požehnání na 3 patra a krocení kleteb' },
      { cost: 15000, text: 'Silnější požehnání' },
      { cost: 50000, text: 'Požehnání na 5 pater, krocení kleteb za polovic' },
    ],
    color: '#fff2a8',
    icon: 'npc_priest',
  },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;

/** what the hero has built in the village */
export interface VillageState {
  /** level of each building (missing = not there yet) */
  lv: Partial<Record<BuildingId, number>>;
  /** floors since a villager due for rescue was last seen (makes the next captive likelier) */
  pity: number;
  /** blessing of the temple: its kind, the floor it lasts to and how strong the temple was */
  blessing?: { id: string; until: number; lv?: number };
  /** quests taken at the notice board (see data/quests.ts) */
  quests?: Quest[];
  /** what the board offers on this visit */
  offers?: Quest[];
  /** the king's favour and task (see data/royal.ts) */
  royal?: RoyalState;
  /** a night in the hero's own bed: rested up to this floor */
  rested?: { until: number; lv: number };
}

export function villageOf(s: { village?: VillageState }): VillageState {
  const v = (s.village ??= { lv: {}, pity: 0 });
  v.lv.stash ??= 1;
  return v;
}

export function buildingLevel(s: { village?: VillageState }, id: BuildingId) {
  return villageOf(s).lv[id] ?? 0;
}

/** the next villager waiting for rescue on this floor (the earliest one not yet home) */
export function villagerDue(s: { village?: VillageState }, floor: number): BuildingDef | null {
  const v = villageOf(s);
  return BUILDINGS.find((b) => b.who && b.rescue <= floor && !v.lv[b.id]) ?? null;
}

// ---------------------------------------------------------------- what the buildings give
/** room in the stash */
export function stashSize(s: { village?: VillageState }) {
  return 42 * Math.max(1, buildingLevel(s, 'stash'));
}

/** the village smithy is better than an anvil in the dungeon */
export function forgeMods(s: { village?: VillageState }) {
  const lv = buildingLevel(s, 'smithy');
  return { chance: lv >= 2 ? 0.1 : 0, cost: lv >= 3 ? 0.75 : 1 };
}

/** potions of the laboratory heal more (everywhere) */
export function potionMult(s: { village?: VillageState }) {
  return buildingLevel(s, 'lab') >= 2 ? 1.25 : 1;
}

/** forgetting talents is cheaper once the mage tower is grand */
export function respecMult(s: { village?: VillageState }) {
  return buildingLevel(s, 'tower') >= 3 ? 0.5 : 1;
}

/** how many items the village shop offers */
export function shopSize(s: { village?: VillageState }) {
  return [9, 9, 12, 15][buildingLevel(s, 'shop')] ?? 9;
}

/** the highest rune grade the mage sells */
export function runeMaxTier(s: { village?: VillageState }) {
  return [0, 2, 3, 4][buildingLevel(s, 'tower')] ?? 0;
}

/** how many quests the board holds at once and how much more they pay */
export function questSlots(s: { village?: VillageState }) {
  const base = [0, 5, 7, 10][buildingLevel(s, 'board')] ?? 0;
  // the king's golden seal makes room for one more
  return base && (s.village?.royal?.favor ?? 0) >= 6 ? base + 1 : base;
}
export function questRewardMult(s: { village?: VillageState }) {
  return [1, 1, 1.25, 1.5][buildingLevel(s, 'board')] ?? 1;
}

/** the mercenary trained at the village's training ground */
export function mercTraining(s: { village?: VillageState }) {
  return buildingLevel(s, 'trainer') >= 3 ? 1.2 : 1;
}

export interface BlessingDef {
  id: string;
  name: string;
  desc: (lv: number) => string;
  stats: (lv: number) => Record<string, number>;
  color: string;
}

export const BLESSINGS: BlessingDef[] = [
  { id: 'might', name: 'Požehnání síly', desc: (lv) => `+${lv >= 2 ? 15 : 10} % poškození`, stats: (lv) => ({ dmgPct: lv >= 2 ? 15 : 10, spellDmg: lv >= 2 ? 15 : 10 }), color: '#ff8a5a' },
  { id: 'life', name: 'Požehnání života', desc: (lv) => `+${lv >= 2 ? 15 : 10} % zdraví a obnova`, stats: (lv) => ({ hpPct: lv >= 2 ? 15 : 10, hpRegen: lv >= 2 ? 3 : 2 }), color: '#ff6aa0' },
  { id: 'luck', name: 'Požehnání štěstí', desc: (lv) => `+${lv >= 2 ? 50 : 30} % magického nálezu a zlata`, stats: (lv) => ({ magicFind: lv >= 2 ? 50 : 30, gold: lv >= 2 ? 50 : 30 }), color: '#52ff8f' },
];
export const BLESSING_BY_ID = Object.fromEntries(BLESSINGS.map((b) => [b.id, b])) as Record<string, BlessingDef>;

/** floors a blessing of the temple lasts */
export function blessingFloors(s: { village?: VillageState }) {
  return buildingLevel(s, 'temple') >= 3 ? 5 : 3;
}

/** the blessing still upon the hero (null when it ran out) */
export function activeBlessing(s: { village?: VillageState; floor: number }) {
  const b = s.village?.blessing;
  if (!b || s.floor > b.until || !BLESSING_BY_ID[b.id]) return null;
  return b;
}

/** permanent and temporary bonuses of the village (they count like gear) */
export function villageStats(s: { village?: VillageState; floor: number }): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (k: string, v: number) => (out[k] = (out[k] ?? 0) + v);
  const tr = buildingLevel(s, 'trainer');
  if (tr >= 2) add('xp', 5);
  if (tr >= 3) add('xp', 5);
  const b = activeBlessing(s);
  if (b) for (const [k, v] of Object.entries(BLESSING_BY_ID[b.id].stats(b.lv ?? 1))) add(k, v);
  for (const [k, v] of Object.entries(royalStats(s))) add(k, v);
  const r = restedOf(s);
  if (r) {
    add('xp', 10);
    if (r.lv >= 3) {
      add('dmgPct', 5);
      add('spellDmg', 5);
    }
  }
  return out;
}

/** how many floors a night at home lasts */
export function restFloors(s: { village?: VillageState }) {
  return buildingLevel(s, 'stash') >= 2 ? 5 : 3;
}

/** the rest from the hero's own bed, while it lasts */
export function restedOf(s: { village?: VillageState; floor: number }) {
  const r = s.village?.rested;
  return r && s.floor <= r.until ? r : null;
}
