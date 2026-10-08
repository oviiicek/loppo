import { CURSES, CURSE_BY_ID, CURSE_CHANCE, curseStats } from './curses';
import { POWERS, UNIQUES, UniqueDef, uniquesFor } from './uniques';
import { AttackKind, Affix, Item, ItemCategory, Slot, StatKey, Stats } from './types';
import { RNG, rng as globalRng } from '../systems/rng';
import { rollSockets, socketStats } from './gems';
import { SETS, SET_BY_ID, SET_COLOR } from './sets';

// ---------------------------------------------------------------------------
// Rarities
// ---------------------------------------------------------------------------
export interface Rarity {
  name: string;
  color: string;
  affixes: [number, number];
  specials: number;
  mult: number;
  value: number;
}

export const RARITIES: Rarity[] = [
  { name: 'Běžný', color: '#c9c9c9', affixes: [0, 1], specials: 0, mult: 1.0, value: 8 },
  { name: 'Neobvyklý', color: '#56d364', affixes: [1, 2], specials: 0, mult: 1.1, value: 20 },
  { name: 'Vzácný', color: '#58a6ff', affixes: [2, 3], specials: 0, mult: 1.22, value: 45 },
  { name: 'Epický', color: '#bc6ff1', affixes: [3, 4], specials: 0, mult: 1.36, value: 110 },
  { name: 'Legendární', color: '#ff9f1c', affixes: [4, 5], specials: 1, mult: 1.52, value: 260 },
  { name: 'Mýtický', color: '#ff4fb4', affixes: [5, 6], specials: 2, mult: 1.75, value: 600 },
  // the rarest of all: a blood-red relic of the world before the dungeon
  { name: 'Pradávný', color: '#ff2a2a', affixes: [6, 7], specials: 3, mult: 2.0, value: 1500 },
];

/** the top rarity (only from great luck or transmutation) */
export const PRIMAL = RARITIES.length - 1;

// ---------------------------------------------------------------------------
// Base item types
// ---------------------------------------------------------------------------
export type Gender = 'm' | 'f' | 'n' | 'p';

export interface BaseType {
  id: string;
  noun: string;
  gender: Gender;
  cat: ItemCategory;
  icon: string; // texture key for icon
  attack?: AttackKind;
  dmg?: [number, number];
  aps?: number; // attacks per second
  range?: number; // in pixels
  arc?: number; // melee arc in degrees
  armor?: number;
  block?: number;
  implicit?: Stats; // always-on bonus
  minLevel?: number;
}

export const BASES: BaseType[] = [
  // one-handed weapons
  { id: 'sword', noun: 'meč', gender: 'm', cat: 'weapon1h', icon: 'ic_sword', attack: 'melee', dmg: [5, 9], aps: 1.4, range: 30, arc: 110 },
  { id: 'axe', noun: 'sekera', gender: 'f', cat: 'weapon1h', icon: 'ic_axe', attack: 'melee', dmg: [6, 11], aps: 1.2, range: 28, arc: 120 },
  { id: 'mace', noun: 'palcát', gender: 'm', cat: 'weapon1h', icon: 'ic_mace', attack: 'melee', dmg: [7, 11], aps: 1.1, range: 28, arc: 100, implicit: { armor: 4 } },
  { id: 'dagger', noun: 'dýka', gender: 'f', cat: 'weapon1h', icon: 'ic_dagger', attack: 'melee', dmg: [4, 7], aps: 1.9, range: 24, arc: 80, implicit: { crit: 4 } },
  { id: 'knuckle', noun: 'kastet', gender: 'm', cat: 'weapon1h', icon: 'ic_knuckle', attack: 'melee', dmg: [3, 5], aps: 2.2, range: 22, arc: 80, implicit: { dodge: 2 } },
  { id: 'wand', noun: 'hůlka', gender: 'f', cat: 'weapon1h', icon: 'ic_wand', attack: 'magic', dmg: [4, 7], aps: 1.3, range: 110, implicit: { int: 2 } },
  // two-handed weapons
  { id: 'greatsword', noun: 'obouruční meč', gender: 'm', cat: 'weapon2h', icon: 'ic_greatsword', attack: 'melee', dmg: [13, 20], aps: 1.0, range: 36, arc: 150 },
  { id: 'greataxe', noun: 'válečná sekera', gender: 'f', cat: 'weapon2h', icon: 'ic_greataxe', attack: 'melee', dmg: [15, 23], aps: 0.9, range: 34, arc: 150 },
  { id: 'hammer', noun: 'válečné kladivo', gender: 'n', cat: 'weapon2h', icon: 'ic_hammer', attack: 'melee', dmg: [17, 26], aps: 0.8, range: 32, arc: 130, implicit: { armor: 8 } },
  { id: 'spear', noun: 'kopí', gender: 'n', cat: 'weapon2h', icon: 'ic_spear', attack: 'melee', dmg: [10, 16], aps: 1.1, range: 46, arc: 40 },
  { id: 'bow', noun: 'luk', gender: 'm', cat: 'weapon2h', icon: 'ic_bow', attack: 'ranged', dmg: [7, 12], aps: 1.25, range: 140 },
  { id: 'crossbow', noun: 'kuše', gender: 'f', cat: 'weapon2h', icon: 'ic_crossbow', attack: 'ranged', dmg: [12, 19], aps: 0.8, range: 150, implicit: { crit: 5 } },
  { id: 'staff', noun: 'hůl', gender: 'f', cat: 'weapon2h', icon: 'ic_staff', attack: 'magic', dmg: [9, 15], aps: 1.0, range: 120, implicit: { int: 4, mp: 15 } },
  // off-hand
  { id: 'shield', noun: 'štít', gender: 'm', cat: 'shield', icon: 'ic_shield', armor: 10, block: 12 },
  { id: 'orb', noun: 'magická koule', gender: 'f', cat: 'offhand', icon: 'ic_orb', implicit: { int: 3, mp: 20, spellDmg: 5 } },
  // armour
  { id: 'helmet', noun: 'helma', gender: 'f', cat: 'helmet', icon: 'ic_helmet', armor: 6 },
  { id: 'chest', noun: 'brnění', gender: 'n', cat: 'chest', icon: 'ic_chest', armor: 12 },
  { id: 'pants', noun: 'kalhoty', gender: 'p', cat: 'pants', icon: 'ic_pants', armor: 8 },
  { id: 'belt', noun: 'opasek', gender: 'm', cat: 'belt', icon: 'ic_belt', armor: 3 },
  { id: 'boots', noun: 'boty', gender: 'p', cat: 'boots', icon: 'ic_boots', armor: 4, implicit: { move: 3 } },
  // jewelry
  { id: 'ring', noun: 'prsten', gender: 'm', cat: 'ring', icon: 'ic_ring' },
  { id: 'amulet', noun: 'náhrdelník', gender: 'm', cat: 'amulet', icon: 'ic_amulet' },
  { id: 'bracer', noun: 'náramek', gender: 'm', cat: 'bracer', icon: 'ic_bracer', armor: 2 },
];

export const BASE_BY_ID: Record<string, BaseType> = Object.fromEntries(BASES.map((b) => [b.id, b]));

export const CATEGORY_NAMES: Record<ItemCategory, string> = {
  weapon1h: 'Jednoruční zbraň',
  weapon2h: 'Obouruční zbraň',
  shield: 'Štít',
  offhand: 'Druhá ruka',
  helmet: 'Helma',
  chest: 'Brnění',
  pants: 'Kalhoty',
  belt: 'Opasek',
  boots: 'Boty',
  ring: 'Prsten',
  amulet: 'Náhrdelník',
  bracer: 'Náramek',
};

export function slotsFor(cat: ItemCategory): Slot[] {
  switch (cat) {
    case 'weapon1h':
      return ['main', 'off'];
    case 'weapon2h':
      return ['main'];
    case 'shield':
    case 'offhand':
      return ['off'];
    case 'ring':
      return ['ring1', 'ring2'];
    default:
      return [cat as Slot];
  }
}

// ---------------------------------------------------------------------------
// Material / tier adjectives (gender aware) [m, f, n, p]
// ---------------------------------------------------------------------------
type Adj = [string, string, string, string];

const adj = (stem: string): Adj => [stem + 'ý', stem + 'á', stem + 'é', stem + 'é'];
const soft = (w: string): Adj => [w, w, w, w];

const WEAPON_TIERS: Adj[] = [adj('Rezav'), adj('Železn'), adj('Ocelov'), adj('Runov'), adj('Mithrilov'), soft('Dračí'), adj('Démonick'), adj('Hvězdn')];
const ARMOR_TIERS: Adj[] = [adj('Otrhan'), adj('Kožen'), adj('Kroužkov'), adj('Plátov'), adj('Runov'), soft('Dračí'), adj('Démonick'), adj('Nebesk')];
const JEWEL_TIERS: Adj[] = [adj('Měděn'), adj('Stříbrn'), adj('Zlat'), adj('Smaragdov'), adj('Rubínov'), adj('Diamantov'), adj('Prastar'), adj('Hvězdn')];
const MAGIC_TIERS: Adj[] = [adj('Dubov'), adj('Tisov'), adj('Kostěn'), adj('Křišťálov'), adj('Runov'), soft('Dračí'), adj('Démonick'), adj('Hvězdn')];

function tierFor(ilvl: number): number {
  return Math.min(7, Math.floor(ilvl / 8));
}

function genderIdx(g: Gender) {
  return g === 'm' ? 0 : g === 'f' ? 1 : g === 'n' ? 2 : 3;
}

// ---------------------------------------------------------------------------
// Affixes
// ---------------------------------------------------------------------------
export interface AffixDef {
  key: StatKey;
  label: string; // display label
  pct?: boolean; // shown as percentage
  base: number; // value at ilvl 1
  perLevel: number; // added per ilvl
  cats: ItemCategory[] | 'all';
  suffix: string; // genitive noun for name generation
  weight: number;
  cap?: number;
}

const WEAPONS: ItemCategory[] = ['weapon1h', 'weapon2h'];
const ARMOR: ItemCategory[] = ['helmet', 'chest', 'pants', 'belt', 'boots', 'shield', 'bracer'];
const JEWEL: ItemCategory[] = ['ring', 'amulet', 'bracer'];

export const AFFIXES: AffixDef[] = [
  { key: 'str', label: 'Síla', base: 2, perLevel: 0.45, cats: 'all', suffix: 'síly', weight: 10 },
  { key: 'dex', label: 'Obratnost', base: 2, perLevel: 0.45, cats: 'all', suffix: 'hbitosti', weight: 10 },
  { key: 'vit', label: 'Zdraví', base: 2, perLevel: 0.45, cats: 'all', suffix: 'vitality', weight: 10 },
  { key: 'ene', label: 'Mana', base: 2, perLevel: 0.45, cats: 'all', suffix: 'moudrosti', weight: 8 },
  { key: 'int', label: 'Magická síla', base: 2, perLevel: 0.45, cats: 'all', suffix: 'mágů', weight: 10 },
  { key: 'spd', label: 'Rychlost útoku', base: 2, perLevel: 0.35, cats: 'all', suffix: 'rychlosti', weight: 7 },
  { key: 'hp', label: 'Maximální HP', base: 10, perLevel: 4, cats: [...ARMOR, ...JEWEL], suffix: 'života', weight: 9 },
  { key: 'mp', label: 'Maximální mana', base: 6, perLevel: 2, cats: [...ARMOR, ...JEWEL, 'offhand'], suffix: 'éteru', weight: 6 },
  { key: 'dmg', label: 'Poškození', base: 2, perLevel: 0.9, cats: [...WEAPONS, 'ring', 'amulet'], suffix: 'zkázy', weight: 9 },
  { key: 'dmgPct', label: 'Poškození', pct: true, base: 5, perLevel: 0.6, cats: [...WEAPONS, 'amulet', 'ring', 'offhand'], suffix: 'zuřivosti', weight: 8 },
  { key: 'armor', label: 'Brnění', base: 4, perLevel: 1.4, cats: ARMOR, suffix: 'ochrany', weight: 9 },
  { key: 'crit', label: 'Šance na kritický zásah', pct: true, base: 2, perLevel: 0.12, cats: [...WEAPONS, ...JEWEL, 'helmet', 'offhand'], suffix: 'přesnosti', weight: 6, cap: 20 },
  { key: 'critDmg', label: 'Kritické poškození', pct: true, base: 10, perLevel: 1.2, cats: [...WEAPONS, 'amulet', 'ring'], suffix: 'zabijáka', weight: 5 },
  { key: 'lifesteal', label: 'Vysávání života', pct: true, base: 1, perLevel: 0.06, cats: [...WEAPONS, 'ring', 'amulet'], suffix: 'upíra', weight: 4, cap: 8 },
  { key: 'manaOnHit', label: 'Mana za zásah', base: 1, perLevel: 0.15, cats: [...WEAPONS, 'ring', 'offhand'], suffix: 'ozvěny', weight: 4 },
  { key: 'hpRegen', label: 'Obnova HP/s', base: 0.5, perLevel: 0.2, cats: [...ARMOR, ...JEWEL], suffix: 'obnovy', weight: 6 },
  { key: 'mpRegen', label: 'Obnova many/s', base: 0.3, perLevel: 0.08, cats: [...JEWEL, 'helmet', 'offhand'], suffix: 'meditace', weight: 5 },
  { key: 'move', label: 'Rychlost pohybu', pct: true, base: 3, perLevel: 0.1, cats: ['boots', 'belt', 'amulet'], suffix: 'větru', weight: 5, cap: 15 },
  { key: 'cdr', label: 'Snížení přebíjení', pct: true, base: 2, perLevel: 0.1, cats: ['helmet', 'amulet', 'ring', 'offhand', 'bracer'], suffix: 'času', weight: 4, cap: 12 },
  { key: 'spellDmg', label: 'Poškození kouzel', pct: true, base: 5, perLevel: 0.6, cats: [...WEAPONS, 'offhand', 'amulet', 'ring', 'helmet'], suffix: 'arkány', weight: 7 },
  { key: 'gold', label: 'Nalezené zlato', pct: true, base: 8, perLevel: 0.6, cats: [...JEWEL, 'belt', 'boots'], suffix: 'bohatství', weight: 4 },
  { key: 'magicFind', label: 'Šance na lepší kořist', pct: true, base: 5, perLevel: 0.4, cats: [...JEWEL, 'helmet'], suffix: 'štěstí', weight: 4 },
  { key: 'thorns', label: 'Trny (odraz poškození)', base: 3, perLevel: 1.2, cats: ['chest', 'shield', 'pants', 'bracer'], suffix: 'trnů', weight: 4 },
  { key: 'dodge', label: 'Úhyb', pct: true, base: 2, perLevel: 0.08, cats: ['boots', 'pants', 'chest', 'ring'], suffix: 'stínu', weight: 4, cap: 10 },
  { key: 'fire', label: 'Ohnivé poškození', base: 2, perLevel: 0.8, cats: [...WEAPONS, 'ring', 'bracer'], suffix: 'plamenů', weight: 4 },
  { key: 'ice', label: 'Mrazivé poškození', base: 2, perLevel: 0.8, cats: [...WEAPONS, 'ring', 'bracer'], suffix: 'mrazu', weight: 4 },
  { key: 'lightning', label: 'Bleskové poškození', base: 1, perLevel: 0.9, cats: [...WEAPONS, 'ring', 'bracer'], suffix: 'bouře', weight: 4 },
  { key: 'poison', label: 'Jedové poškození', base: 2, perLevel: 0.8, cats: [...WEAPONS, 'ring', 'bracer'], suffix: 'jedu', weight: 4 },
  { key: 'block', label: 'Šance na blok', pct: true, base: 2, perLevel: 0.1, cats: ['shield'], suffix: 'hradeb', weight: 5, cap: 15 },
  { key: 'xp', label: 'Získané zkušenosti', pct: true, base: 3, perLevel: 0.2, cats: ['amulet', 'ring', 'helmet'], suffix: 'učence', weight: 3 },
  { key: 'atkSpdPct', label: 'Rychlost útoku', pct: true, base: 3, perLevel: 0.15, cats: [...WEAPONS, 'bracer', 'ring'], suffix: 'smršti', weight: 5, cap: 15 },
  { key: 'hpPct', label: 'Maximální HP', pct: true, base: 3, perLevel: 0.15, cats: ['chest', 'amulet', 'belt'], suffix: 'obra', weight: 4, cap: 15 },
];

export const AFFIX_BY_KEY: Partial<Record<StatKey, AffixDef>> = {};
for (const a of AFFIXES) if (!AFFIX_BY_KEY[a.key]) AFFIX_BY_KEY[a.key] = a;

// ---------------------------------------------------------------------------
// Special (legendary / mythic) effects
// ---------------------------------------------------------------------------
export interface SpecialDef {
  id: string;
  desc: string;
  cats: ItemCategory[] | 'all';
}

export const SPECIALS: SpecialDef[] = [
  { id: 'chainOnHit', desc: '15 % šance při zásahu vyvolat řetězový blesk', cats: 'all' },
  { id: 'explodeOnKill', desc: 'Zabití nepřítele způsobí explozi', cats: 'all' },
  { id: 'extraProjectile', desc: '+1 projektil u střelby a projektilových kouzel', cats: ['weapon1h', 'weapon2h', 'offhand', 'amulet'] },
  { id: 'frostOnHit', desc: '10 % šance při zásahu zmrazit nepřítele', cats: 'all' },
  { id: 'burnOnHit', desc: 'Útoky zapalují nepřátele', cats: 'all' },
  { id: 'healOnKill', desc: 'Zabití nepřítele obnoví 4 % HP', cats: 'all' },
  { id: 'manaShield', desc: '20 % přijatého poškození jde z many', cats: 'all' },
  { id: 'berserk', desc: '+35 % poškození, když máš méně než 40 % HP', cats: 'all' },
  { id: 'doubleStrike', desc: '15 % šance zaútočit dvakrát', cats: ['weapon1h', 'weapon2h', 'ring', 'bracer'] },
  { id: 'thornNova', desc: 'Při zásahu 10 % šance vyvolat ostnatou novu', cats: ['chest', 'shield', 'pants', 'helmet', 'belt'] },
  { id: 'cdrOnKill', desc: 'Zabití sníží přebíjení kouzel o 0,5 s', cats: 'all' },
  { id: 'spellEcho', desc: '10 % šance seslat kouzlo podruhé zdarma', cats: ['weapon1h', 'weapon2h', 'offhand', 'amulet', 'ring', 'helmet'] },
  { id: 'goldRush', desc: '+60 % nalezeného zlata a 2× více lektvarů', cats: 'all' },
  { id: 'vampAura', desc: 'Nepřátelé v tvé blízkosti ztrácí 2 % HP/s a léčí tě', cats: ['chest', 'amulet', 'helmet'] },
  { id: 'ghostStep', desc: 'Po zásahu nepřítelem získáš na 2 s +40 % rychlosti pohybu', cats: ['boots', 'pants', 'belt'] },
  { id: 'arcaneOrbit', desc: 'Kolem tebe krouží 2 magické koule', cats: ['amulet', 'offhand', 'helmet', 'ring'] },
];

export const SPECIAL_BY_ID: Record<string, SpecialDef> = Object.fromEntries([...SPECIALS, ...POWERS.map((p) => ({ ...p, cats: 'all' as const }))].map((s) => [s.id, s]));

// Enchant pool (applied by enchanting, one per item)
export const ENCHANTS: { key: StatKey; base: number; perLevel: number }[] = [
  { key: 'fire', base: 4, perLevel: 1.2 },
  { key: 'ice', base: 4, perLevel: 1.2 },
  { key: 'lightning', base: 3, perLevel: 1.4 },
  { key: 'poison', base: 4, perLevel: 1.2 },
  { key: 'lifesteal', base: 2, perLevel: 0.06 },
  { key: 'crit', base: 3, perLevel: 0.1 },
  { key: 'critDmg', base: 15, perLevel: 1.0 },
  { key: 'dmgPct', base: 8, perLevel: 0.5 },
  { key: 'spellDmg', base: 8, perLevel: 0.5 },
  { key: 'atkSpdPct', base: 5, perLevel: 0.12 },
  { key: 'hp', base: 20, perLevel: 5 },
  { key: 'armor', base: 8, perLevel: 1.6 },
  { key: 'str', base: 4, perLevel: 0.5 },
  { key: 'dex', base: 4, perLevel: 0.5 },
  { key: 'int', base: 4, perLevel: 0.5 },
  { key: 'vit', base: 4, perLevel: 0.5 },
];

// ---------------------------------------------------------------------------
// Unique names for legendary & mythic items
// ---------------------------------------------------------------------------
const UNIQUE_NAMES: Record<string, string[]> = {
  weapon: ['Zhouba králů', 'Šepot smrti', 'Pláč vdov', 'Stínotrn', 'Hromobijec', 'Žhnoucí spravedlnost', 'Kostilam', 'Duchotřas', 'Hvězdný úlomek', 'Krvavý půlměsíc', 'Poslední slovo', 'Drakobijec'],
  armor: ['Plášť věčné noci', 'Strážce hlubin', 'Kůže titána', 'Šupiny wyrma', 'Obránce bran', 'Závoj mlhy', 'Železná přísaha', 'Dech hor'],
  jewel: ['Oko bouře', 'Srdce draka', 'Slza bohyně', 'Kruh osudu', 'Pečeť lichů', 'Prastará vzpomínka', 'Krev mučedníka', 'Hvězda severu'],
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
let uidCounter = 0;
export function newUid() {
  return Date.now().toString(36) + '-' + (uidCounter++).toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

// keys that keep one decimal place; everything else is rounded to whole numbers
const DECIMAL_KEYS = new Set<StatKey>(['hpRegen', 'mpRegen', 'lifesteal', 'manaOnHit']);

export function affixValue(def: { key?: StatKey; base: number; perLevel: number; cap?: number }, ilvl: number, mult: number, r: RNG) {
  let v = (def.base + def.perLevel * ilvl) * mult * r.float(0.75, 1.15);
  if (def.cap) v = Math.min(def.cap, v);
  if (def.key && DECIMAL_KEYS.has(def.key)) return Math.max(0.1, Math.round(v * 10) / 10);
  return Math.max(1, Math.round(v));
}

export function rollRarity(r: RNG, magicFind = 0, bonus = 0): number {
  // bonus shifts the distribution up (bosses, gold chests ...)
  const mf = 1 + magicFind / 100;
  const weights = [60, 26 * mf, 10 * mf, 3.2 * mf, 0.7 * mf, 0.12 * mf, 0.01 * mf];
  for (let b = 0; b < bonus; b++) {
    weights.shift();
    weights.push(weights[weights.length - 1] * 0.25);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r.next() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return Math.min(PRIMAL, i + bonus);
  }
  return Math.min(PRIMAL, bonus);
}

export function pickBase(r: RNG, filter?: (b: BaseType) => boolean): BaseType {
  let pool = BASES.filter((b) => !filter || filter(b));
  if (!pool.length) pool = BASES;
  return r.weighted(pool, (b) => (b.cat === 'weapon1h' || b.cat === 'weapon2h' ? 1.1 : b.cat === 'ring' ? 1.2 : 1));
}

function buildName(base: BaseType, rarity: number, ilvl: number, affixes: Affix[], r: RNG): string {
  if (rarity >= 4) {
    const group = base.cat.startsWith('weapon') ? 'weapon' : ['ring', 'amulet', 'bracer'].includes(base.cat) ? 'jewel' : 'armor';
    return r.pick(UNIQUE_NAMES[group]);
  }
  const t = tierFor(ilvl);
  let tiers = WEAPON_TIERS;
  if (['ring', 'amulet', 'bracer'].includes(base.cat)) tiers = JEWEL_TIERS;
  else if (base.attack === 'magic' || base.cat === 'offhand') tiers = MAGIC_TIERS;
  else if (!base.cat.startsWith('weapon')) tiers = ARMOR_TIERS;
  const a = tiers[t][genderIdx(base.gender)];
  let name = `${a} ${base.noun}`;
  if (affixes.length && rarity >= 1) {
    const top = affixes[0];
    const def = AFFIX_BY_KEY[top.key];
    if (def) name += ' ' + def.suffix;
  }
  return name;
}

export function generateItem(ilvl: number, opts: { rarity?: number; base?: string; magicFind?: number; rarityBonus?: number; r?: RNG; filter?: (b: BaseType) => boolean; noCurse?: boolean; noUnique?: boolean } = {}): Item {
  const r = opts.r ?? globalRng;
  const rarity = opts.rarity ?? rollRarity(r, opts.magicFind ?? 0, opts.rarityBonus ?? 0);
  // a legendary (or better) find is one of the named uniques with a power of its own
  let unique: UniqueDef | null = null;
  if (rarity >= 4 && !opts.noUnique) {
    const pool = opts.base ? uniquesFor(opts.base) : UNIQUES.filter((u) => !opts.filter || opts.filter(BASE_BY_ID[u.base]));
    unique = pool.length ? r.pick(pool) : opts.base ? null : r.pick(UNIQUES);
  }
  const base = unique ? BASE_BY_ID[unique.base] : opts.base ? BASE_BY_ID[opts.base] : pickBase(r, opts.filter);
  const rar = RARITIES[rarity];
  const scale = 1 + 0.15 * ilvl + 0.004 * ilvl * ilvl;
  const item: Item = {
    uid: newUid(),
    base: base.id,
    name: '',
    rarity,
    ilvl,
    upgrade: 0,
    affixes: [],
    specials: [],
    enchant: null,
  };
  if (base.dmg) {
    const q = r.float(0.9, 1.1) * rar.mult;
    item.dmgMin = Math.max(1, Math.round(base.dmg[0] * scale * q));
    item.dmgMax = Math.max(item.dmgMin + 1, Math.round(base.dmg[1] * scale * q));
  }
  if (base.armor) item.armor = Math.round(base.armor * (1 + 0.12 * ilvl) * rar.mult * r.float(0.9, 1.1));
  if (base.block) item.block = Math.min(30, Math.round(base.block + ilvl * 0.08));

  const nAff = r.int(rar.affixes[0], rar.affixes[1]);
  const pool = AFFIXES.filter((a) => a.cats === 'all' || a.cats.includes(base.cat));
  const used = new Set<StatKey>();
  for (let i = 0; i < nAff && pool.length; i++) {
    const def = r.weighted(
      pool.filter((p) => !used.has(p.key)),
      (p) => p.weight,
    );
    if (!def) break;
    used.add(def.key);
    item.affixes.push({ key: def.key, value: affixValue(def, ilvl, rar.mult, r) });
  }
  const specPool = SPECIALS.filter((s) => s.cats === 'all' || s.cats.includes(base.cat));
  // a unique's own power comes first and takes the place of one random special
  if (unique) item.specials.push(unique.power);
  for (let i = unique ? 1 : 0; i < rar.specials && specPool.length; i++) {
    const s = r.pick(specPool.filter((x) => !item.specials.includes(x.id)));
    if (s) item.specials.push(s.id);
  }
  item.name = unique ? unique.name : buildName(base, rarity, ilvl, item.affixes, r);
  if (unique) item.unique = unique.id;
  const sockets = rollSockets(base.cat, rarity, () => r.next());
  if (sockets) item.sockets = sockets;
  // now and then a rare (or better) find carries a curse: a big bonus with a price
  if (rarity >= 2 && !opts.noCurse && r.next() < CURSE_CHANCE) curseItem(item, r);
  return item;
}

/** lays a curse on an item (its name says so) */
export function curseItem(item: Item, r: RNG = globalRng, id?: string) {
  const c = id ? CURSE_BY_ID[id] : r.pick(CURSES);
  if (!c) return item;
  item.curse = c.id;
  const g = BASE_BY_ID[item.base].gender;
  const adj = g === 'f' ? 'Prokletá' : g === 'n' ? 'Prokleté' : g === 'p' ? 'Prokleté' : 'Prokletý';
  // unique names stay capitalised ("Prokletý Drakobijec"), common ones do not ("Prokletý železný meč")
  if (!item.name.startsWith('Prokle')) item.name = `${adj} ${item.rarity >= 4 ? item.name : item.name[0].toLowerCase() + item.name.slice(1)}`;
  return item;
}

/** a piece of an item set: legendary strength, a fixed name, no random special effects (the set gives them) */
export function generateSetItem(ilvl: number, setId?: string, piece?: number, r: RNG = globalRng): Item {
  const def = setId ? SET_BY_ID[setId] : r.pick(SETS);
  const pi = piece ?? r.int(0, def.pieces.length - 1);
  const p = def.pieces[pi];
  const it = generateItem(ilvl, { base: p.base, rarity: 4, r, noCurse: true, noUnique: true });
  it.specials = [];
  it.name = p.name;
  it.set = `${def.id}:${pi}`;
  return it;
}

/** colour of an item's name and frame (set pieces have their own) */
export function itemColor(it: Item) {
  return it.set ? SET_COLOR : RARITIES[it.rarity].color;
}

// Upgrade multiplier: +10 % base values per upgrade level, +4 % affixes
export function upgradeMult(it: Item) {
  return 1 + 0.1 * it.upgrade;
}
export function upgradeAffixMult(it: Item) {
  return 1 + 0.04 * it.upgrade;
}

export function itemStats(it: Item): Stats {
  const base = BASE_BY_ID[it.base];
  const s: Stats = {};
  const add = (k: StatKey, v: number) => (s[k] = (s[k] ?? 0) + v);
  if (base.implicit) for (const [k, v] of Object.entries(base.implicit)) add(k as StatKey, v as number);
  if (it.armor) add('armor', Math.round(it.armor * upgradeMult(it)));
  if (it.block) add('block', it.block);
  const am = upgradeAffixMult(it);
  for (const a of it.affixes) add(a.key, scaledAffix(a.key, a.value, am));
  if (it.enchant) add(it.enchant.key, scaledAffix(it.enchant.key, it.enchant.value, am));
  socketStats(it, base.cat, s);
  if (it.curse) {
    const c = curseStats(it.curse, it.ilvl);
    for (const [k, v] of Object.entries(c.bonus)) add(k as StatKey, v as number);
    for (const [k, v] of Object.entries(c.malus)) add(k as StatKey, v as number);
  }
  return s;
}

export function weaponDamage(it: Item): [number, number] {
  const m = upgradeMult(it);
  return [Math.round((it.dmgMin ?? 0) * m), Math.round((it.dmgMax ?? 0) * m)];
}

export function scaledAffix(key: StatKey, value: number, mult: number) {
  const v = value * mult;
  return DECIMAL_KEYS.has(key) ? Math.round(v * 10) / 10 : Math.round(v);
}

export function itemValue(it: Item): number {
  return Math.round(RARITIES[it.rarity].value * (1 + it.ilvl * 0.18) * (1 + it.upgrade * 0.25));
}

export function buyPrice(it: Item): number {
  return Math.round(itemValue(it) * 4);
}

export function formatStat(key: StatKey, v: number): string {
  const def = AFFIX_BY_KEY[key];
  const names: Partial<Record<StatKey, string>> = {
    block: 'Šance na blok',
    range: 'Dosah',
    armorPct: 'Brnění',
    fireDmg: 'Poškození ohněm',
    iceDmg: 'Poškození mrazem',
    lightDmg: 'Poškození bleskem',
    poisonDmg: 'Poškození jedem',
    shadowDmg: 'Poškození stínem',
    holyDmg: 'Poškození světlem',
  };
  const label = def?.label ?? names[key] ?? key;
  const pct = def?.pct || ['block', 'range', 'armorPct', 'fireDmg', 'iceDmg', 'lightDmg', 'poisonDmg', 'shadowDmg', 'holyDmg'].includes(key);
  const val = Number.isInteger(v) ? Math.abs(v).toString() : Math.abs(v).toFixed(1).replace('.', ',');
  return `${v < 0 ? '−' : '+'}${val}${pct ? ' %' : ''} ${label}`;
}

export function upgradeCost(it: Item) {
  const lvl = it.upgrade;
  return {
    gold: Math.round(40 * (lvl + 1) * (1 + it.ilvl * 0.12) * (1 + it.rarity * 0.3)),
    stones: 1 + Math.floor(lvl / 2),
    chance: [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][lvl] ?? 0,
  };
}

export function enchantCost(it: Item) {
  return {
    gold: Math.round(60 * (1 + it.ilvl * 0.15) * (1 + it.rarity * 0.35)),
    dust: 2 + Math.floor(it.rarity * 1.5),
  };
}

export function salvageResult(it: Item) {
  return {
    dust: it.rarity >= 2 ? it.rarity - 1 + (it.rarity >= 4 ? 2 : 0) : 0,
    stones: it.rarity >= 1 ? (Math.random() < 0.35 + it.rarity * 0.1 ? 1 : 0) : Math.random() < 0.15 ? 1 : 0,
    gold: Math.round(itemValue(it) * 0.3),
  };
}

export const MAX_UPGRADE = 10;

/** price of re-rolling a property at the anvil (rises with every re-roll of the item) */
export function rerollCost(it: Item) {
  const n = it.rerolls ?? 0;
  return { gold: Math.round(90 * (1 + it.ilvl * 0.15) * (1 + it.rarity * 0.3) * (1 + n * 0.5)), dust: 1 + it.rarity + Math.floor(n / 2) };
}

/** two new properties that could replace property i (never one the item already has) */
export function rerollOptions(it: Item, i: number, r: RNG = globalRng): Affix[] {
  const base = BASE_BY_ID[it.base];
  const taken = new Set(it.affixes.filter((_, k) => k !== i).map((a) => a.key));
  const pool = AFFIXES.filter((a) => (a.cats === 'all' || a.cats.includes(base.cat)) && !taken.has(a.key));
  const out: Affix[] = [];
  const mult = RARITIES[it.rarity].mult;
  for (let k = 0; k < 2 && pool.length; k++) {
    const def = r.weighted(
      pool.filter((p) => !out.some((o) => o.key === p.key)),
      (p) => p.weight,
    );
    if (!def) break;
    out.push({ key: def.key, value: affixValue(def, it.ilvl, mult, r) });
  }
  return out;
}

export function rollEnchant(it: Item, r: RNG = globalRng): Affix {
  const e = r.pick(ENCHANTS);
  const mult = RARITIES[it.rarity].mult;
  return { key: e.key, value: affixValue(e, it.ilvl, mult, r) };
}

export function isTwoHanded(it: Item | null | undefined) {
  return !!it && BASE_BY_ID[it.base].cat === 'weapon2h';
}

export function itemTier(it: Item) {
  return Math.min(7, Math.floor(it.ilvl / 8));
}

// icon key including the material tint of the item tier
export function itemIcon(it: Item) {
  return `${BASE_BY_ID[it.base].icon}_t${itemTier(it)}`;
}
