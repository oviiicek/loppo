// The mercenary: one hired companion with a role (tank, healer, archer, mage), three equipment slots of
// its own (a weapon, a piece of armour, a piece of jewellery) and a simple order (attack, defend, follow).
// Its strength grows with the hero's level and with the gear it is given.
import type { ClassId, Item, Stats, StatKey, Element } from './types';
import { BASE_BY_ID, itemStats, weaponDamage } from './items';

export type MercRole = 'tank' | 'healer' | 'archer' | 'mage';
export type MercSlot = 'weapon' | 'armor' | 'jewel';
export type MercOrder = 'attack' | 'defend' | 'follow';

export interface MercState {
  role: MercRole;
  name: string;
  equip: Partial<Record<MercSlot, Item | null>>;
  order: MercOrder;
  /** times it was knocked out (statistics) */
  downs?: number;
  /** the hero look it wears (a wandering adventurer has their own class) */
  look?: ClassId;
  /** a companion only for this floor (an adventurer met in the dungeon): leaves instead of getting up */
  temp?: boolean;
  fem?: boolean;
}

export interface MercDef {
  role: MercRole;
  /** the role's name */
  title: string;
  desc: string;
  /** what it does on its own every few seconds */
  skill: string;
  /** hero looks it can wear (the first one different from the hero's class) */
  looks: ClassId[];
  /** weapon it carries without one of its own, and the weapons it can use */
  weapon: string;
  uses: string[];
  shield?: boolean;
  /** health (share of the hero's), damage (share of a plain weapon of the hero's level), seconds per attack */
  hp: number;
  dmg: number;
  atkCd: number;
  range: number;
  el: Element;
  proj?: string;
  speed: number;
  names: string[];
  color: string;
}

export const MERCS: MercDef[] = [
  {
    role: 'tank',
    title: 'Strážce',
    desc: 'Štít a meč. Vydrží nejvíc ze všech a strhává na sebe pozornost nestvůr.',
    skill: 'Výzva: každých pár vteřin donutí nestvůry kolem sebe útočit na něj. Část úderů vykryje štítem.',
    looks: ['paladin', 'warrior'],
    weapon: 'sword',
    uses: ['sword', 'axe', 'mace', 'dagger', 'knuckle', 'rapier', 'scimitar', 'flail', 'claws', 'greatsword', 'greataxe', 'hammer', 'spear', 'halberd', 'scythe', 'quarterstaff'],
    shield: true,
    hp: 1.35,
    dmg: 0.9,
    atkCd: 1.0,
    range: 16,
    el: 'phys',
    speed: 68,
    names: ['Borek', 'Bořivoj', 'Hostivít', 'Radim', 'Dobroslav', 'Kazimír'],
    color: '#8fb8ff',
  },
  {
    role: 'healer',
    title: 'Léčitel',
    desc: 'Drží se za tebou, léčí tě, když jsi zraněný, a zahání nepřátele svatým světlem.',
    skill: 'Léčení: zraněného hrdinu (a sebe) léčí; v nouzi sešle léčivý kruh.',
    looks: ['druid', 'shaman'],
    weapon: 'staff',
    uses: ['staff', 'wand', 'scepter', 'crook', 'stormstaff'],
    hp: 0.8,
    dmg: 0.5,
    atkCd: 1.4,
    range: 110,
    el: 'holy',
    proj: 'pr_holy',
    speed: 66,
    names: ['Ludmila', 'Vesna', 'Milada', 'Zora', 'Drahomíra', 'Bohumil'],
    color: '#9dff9d',
  },
  {
    role: 'archer',
    title: 'Lučištník',
    desc: 'Střílí z dálky a drží si od nestvůr odstup.',
    skill: 'Salva: každých pár vteřin vystřelí vějíř pěti šípů.',
    looks: ['ranger', 'assassin'],
    weapon: 'bow',
    uses: ['bow', 'shortbow', 'longbow', 'compoundbow', 'crossbow', 'repeater', 'handcrossbow', 'throwknives', 'throwaxes'],
    hp: 0.85,
    dmg: 1.2,
    atkCd: 0.95,
    range: 120,
    el: 'phys',
    proj: 'pr_arrow',
    speed: 70,
    names: ['Jarka', 'Vilém', 'Sobek', 'Dobromila', 'Ctirad', 'Radka'],
    color: '#ffd76a',
  },
  {
    role: 'mage',
    title: 'Bojový mág',
    desc: 'Metá ohnivé koule, které zraňují i nestvůry kolem zasaženého.',
    skill: 'Mrazivá vlna: každých pár vteřin zmrazí a zpomalí nestvůry v kruhu.',
    looks: ['mage', 'necro'],
    weapon: 'staff',
    uses: ['staff', 'wand', 'stormstaff', 'scepter', 'crook'],
    hp: 0.8,
    dmg: 1.05,
    atkCd: 1.3,
    range: 115,
    el: 'fire',
    proj: 'pr_fire',
    speed: 64,
    names: ['Ctibor', 'Libuše', 'Bohdana', 'Přemysl', 'Věšťka', 'Zbyhněv'],
    color: '#ff9a5a',
  },
];

export const MERC_BY_ROLE = Object.fromEntries(MERCS.map((m) => [m.role, m])) as Record<MercRole, MercDef>;

export const MERC_SLOTS: { id: MercSlot; name: string }[] = [
  { id: 'weapon', name: 'Zbraň' },
  { id: 'armor', name: 'Zbroj' },
  { id: 'jewel', name: 'Šperk' },
];

export const MERC_ORDERS: { id: MercOrder; name: string; desc: string }[] = [
  { id: 'attack', name: 'Útočit', desc: 'vyráží na každou nestvůru, kterou uvidí' },
  { id: 'defend', name: 'Bránit', desc: 'drží se u tebe a bojuje jen s tím, co se k tobě přiblíží' },
  { id: 'follow', name: 'Jen následovat', desc: 'nebojuje (léčitel dál léčí)' },
];

const ARMOR_CATS = ['chest', 'helmet', 'pants', 'boots', 'belt', 'shield'];
const JEWEL_CATS = ['ring', 'amulet', 'bracer'];

/** can this mercenary wear the item in that slot? */
export function mercFits(role: MercRole, slot: MercSlot, it: Item): boolean {
  const b = BASE_BY_ID[it.base];
  if (!b) return false;
  if (slot === 'weapon') return MERC_BY_ROLE[role].uses.includes(b.id);
  if (slot === 'armor') return ARMOR_CATS.includes(b.cat);
  return JEWEL_CATS.includes(b.cat);
}

/** the slot an item would go to (or null when the mercenary cannot use it) */
export function mercSlotFor(role: MercRole, it: Item): MercSlot | null {
  for (const s of MERC_SLOTS) if (mercFits(role, s.id, it)) return s.id;
  return null;
}

/** price of hiring (or changing the mercenary) at the hero's level */
export function mercPrice(level: number) {
  return Math.round(300 + 120 * Math.pow(level, 1.15));
}

export function mercLook(def: MercDef, heroCls: ClassId): ClassId {
  return def.looks.find((c) => c !== heroCls) ?? def.looks[0];
}

export function randomMercName(def: MercDef) {
  return def.names[Math.floor(Math.random() * def.names.length)];
}

export interface MercStats {
  maxHp: number;
  dmg: number;
  armor: number;
  crit: number;
  critDmg: number;
  atkCd: number;
  lifesteal: number;
  regen: number;
  heal: number;
  block: number;
  move: number;
}

/** the average hit of a plain (common) weapon of a level: what an unarmed mercenary fights with */
function plainWeapon(base: string, level: number) {
  const b = BASE_BY_ID[base];
  const scale = 1 + 0.15 * level + 0.004 * level * level;
  return ((b.dmg![0] + b.dmg![1]) / 2) * scale;
}

/** the mercenary's numbers: its role, the hero's level and health, and its own gear */
export function mercStats(m: MercState, heroLevel: number, heroMaxHp: number): MercStats {
  const def = MERC_BY_ROLE[m.role];
  const st: Stats = {};
  for (const it of Object.values(m.equip)) {
    if (!it) continue;
    for (const [k, v] of Object.entries(itemStats(it))) st[k as StatKey] = (st[k as StatKey] ?? 0) + (v as number);
  }
  const w = m.equip.weapon;
  const avg = w && w.dmgMin ? (weaponDamage(w)[0] + weaponDamage(w)[1]) / 2 : plainWeapon(def.weapon, heroLevel);
  const caster = def.role === 'mage' || def.role === 'healer';
  const attr = caster ? (st.int ?? 0) : def.role === 'archer' ? (st.dex ?? 0) : (st.str ?? 0);
  const dmgMult = 1 + (st.dmgPct ?? 0) / 100 + attr / 250 + (caster ? (st.spellDmg ?? 0) / 100 : 0) + (st.dmg ?? 0) / Math.max(1, avg);
  const maxHp = Math.round((heroMaxHp * def.hp + (st.hp ?? 0) + (st.vit ?? 0) * 4) * (1 + (st.hpPct ?? 0) / 100));
  return {
    maxHp,
    dmg: avg * def.dmg * dmgMult,
    armor: st.armor ?? 0,
    crit: 5 + (st.crit ?? 0),
    critDmg: 150 + (st.critDmg ?? 0),
    atkCd: def.atkCd / (1 + (st.atkSpdPct ?? 0) / 100),
    lifesteal: st.lifesteal ?? 0,
    regen: st.hpRegen ?? 0,
    heal: def.role === 'healer' ? heroMaxHp * 0.16 * (1 + ((st.spellDmg ?? 0) + (st.int ?? 0) * 0.5) / 100) : 0,
    block: (def.shield ? 20 : 0) + (st.block ?? 0),
    move: def.speed * (1 + (st.move ?? 0) / 100),
  };
}
