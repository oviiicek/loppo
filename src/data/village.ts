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
    name: 'Sklad',
    who: null,
    rescue: 0,
    desc: 'Truhly na předměty, které nechceš nosit ani prodat. Je společný pro celou výpravu.',
    levels: [
      { cost: 0, text: '40 míst ve skladu' },
      { cost: 2500, text: '80 míst ve skladu' },
      { cost: 12000, text: '120 míst ve skladu' },
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
      { cost: 4000, text: 'Výheň: vylepšení má o 10 % větší šanci na úspěch' },
      { cost: 20000, text: 'Mistrovská kovárna: vylepšení a sokety o 25 % levnější' },
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
      { cost: 25000, text: '15 předmětů, šance na legendární zboží' },
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
      { cost: 0, text: 'Až 2 úkoly zároveň' },
      { cost: 6000, text: 'Až 3 úkoly zároveň, o 25 % vyšší odměny' },
      { cost: 30000, text: 'Až 4 úkoly zároveň, o 50 % vyšší odměny' },
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
      { cost: 0, text: 'Transmutace a levnější lektvary' },
      { cost: 8000, text: 'Silnější lektvary (léčí o 25 % víc)' },
      { cost: 35000, text: 'Transmutace o 10 % úspěšnější' },
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
      { cost: 10000, text: 'Prodej run do 3. stupně a run kouzel' },
      { cost: 40000, text: 'Runy do 4. stupně, zapomenutí talentů za polovic' },
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
    who: { name: 'Bohdana', trade: 'kněžka', key: 'npc_priest', fem: true, thanks: 'Světlo tě provází, poutníku. Modlila jsem se za záchranu a přišla. V Loppu znovu zapálím chrámové svíce – požehnám ti a sejmu kletby.' },
    rescue: 20,
    desc: 'Požehnání na další patra a snímání kleteb z předmětů.',
    levels: [
      { cost: 0, text: 'Požehnání na 3 patra' },
      { cost: 15000, text: 'Silnější požehnání' },
      { cost: 50000, text: 'Požehnání na 5 pater, snímání kleteb za polovic' },
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
  /** blessing of the temple: its kind and the floor it lasts to */
  blessing?: { id: string; until: number };
  /** quests (see data/quests.ts) */
  quests?: unknown[];
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
