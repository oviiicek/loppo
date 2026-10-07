// Gems and sockets. Six kinds of gems in five grades; a gem set into a socket gives a different bonus in
// a weapon, in armour and in jewellery. Three gems of a grade make one of the next. Gems are kept in a
// pouch (counted, not in the bag) and come back to it when an item is sold or salvaged.
import type { Item, ItemCategory, StatKey, Stats } from './types';

export type GemType = 'ruby' | 'sapphire' | 'emerald' | 'topaz' | 'amethyst' | 'diamond';
export type GemPlace = 'weapon' | 'armor' | 'jewel';

export interface GemDef {
  id: GemType;
  /** nominative (all the gem names are masculine, so the grade adjectives fit them all) */
  name: string;
  color: string;
  /** light and dark shades for the icon */
  light: string;
  dark: string;
  effects: Record<GemPlace, { key: StatKey; vals: number[] }>;
}

export const GEM_TIERS = ['Drobný', 'Malý', 'Broušený', 'Dokonalý', 'Královský'];
export const GEM_MAX_TIER = GEM_TIERS.length;

export const GEMS: GemDef[] = [
  {
    id: 'ruby',
    name: 'rubín',
    color: '#ff4a5a',
    light: '#ffb0b8',
    dark: '#8a1020',
    effects: {
      weapon: { key: 'dmgPct', vals: [4, 7, 11, 16, 24] },
      armor: { key: 'hpPct', vals: [2, 3, 5, 7, 10] },
      jewel: { key: 'str', vals: [4, 8, 14, 22, 34] },
    },
  },
  {
    id: 'sapphire',
    name: 'safír',
    color: '#3a8aff',
    light: '#b0d4ff',
    dark: '#10308a',
    effects: {
      weapon: { key: 'spellDmg', vals: [5, 9, 14, 20, 30] },
      armor: { key: 'mp', vals: [15, 30, 50, 80, 120] },
      jewel: { key: 'int', vals: [4, 8, 14, 22, 34] },
    },
  },
  {
    id: 'emerald',
    name: 'smaragd',
    color: '#2ed06a',
    light: '#b0ffc8',
    dark: '#0e6a2a',
    effects: {
      weapon: { key: 'critDmg', vals: [8, 14, 22, 32, 48] },
      armor: { key: 'dodge', vals: [1, 1.5, 2.5, 3.5, 5] },
      jewel: { key: 'dex', vals: [4, 8, 14, 22, 34] },
    },
  },
  {
    id: 'topaz',
    name: 'topaz',
    color: '#ffc02a',
    light: '#fff0a8',
    dark: '#9a6a08',
    effects: {
      weapon: { key: 'atkSpdPct', vals: [2, 4, 6, 9, 13] },
      armor: { key: 'gold', vals: [5, 9, 14, 20, 30] },
      jewel: { key: 'magicFind', vals: [4, 7, 11, 16, 24] },
    },
  },
  {
    id: 'amethyst',
    name: 'ametyst',
    color: '#b45aff',
    light: '#e8c4ff',
    dark: '#4a1a8a',
    effects: {
      weapon: { key: 'lifesteal', vals: [0.5, 1, 1.5, 2.2, 3] },
      armor: { key: 'vit', vals: [4, 8, 14, 22, 34] },
      jewel: { key: 'hpRegen', vals: [1, 2, 4, 7, 11] },
    },
  },
  {
    id: 'diamond',
    name: 'diamant',
    color: '#d8f4ff',
    light: '#ffffff',
    dark: '#5a8aa8',
    effects: {
      weapon: { key: 'crit', vals: [1, 2, 3, 4.5, 6] },
      armor: { key: 'cdr', vals: [1, 1.5, 2, 3, 4] },
      jewel: { key: 'xp', vals: [3, 5, 8, 12, 18] },
    },
  },
];

export const GEM_BY_ID = Object.fromEntries(GEMS.map((g) => [g.id, g])) as Record<GemType, GemDef>;

/** a gem is stored as its kind and grade: "ruby3" */
export const gemKey = (type: GemType, tier: number) => `${type}${tier}`;

export function parseGem(key: string): { def: GemDef; tier: number } | null {
  const m = /^([a-z]+)(\d)$/.exec(key);
  if (!m) return null;
  const def = GEM_BY_ID[m[1] as GemType];
  const tier = +m[2];
  return def && tier >= 1 && tier <= GEM_MAX_TIER ? { def, tier } : null;
}

/** "Broušený rubín" */
export function gemName(key: string) {
  const g = parseGem(key);
  return g ? `${GEM_TIERS[g.tier - 1]} ${g.def.name}` : key;
}

export function gemIcon(key: string) {
  const g = parseGem(key);
  return g ? `gem_${g.def.id}_${g.tier}` : 'gem_ruby_1';
}

/** weapons and the orb take a weapon bonus; shields and clothes an armour one; rings, amulets, bracers a jewel one */
export function gemPlace(cat: ItemCategory): GemPlace {
  if (cat === 'weapon1h' || cat === 'weapon2h' || cat === 'offhand') return 'weapon';
  if (cat === 'ring' || cat === 'amulet' || cat === 'bracer') return 'jewel';
  return 'armor';
}

export const GEM_PLACE_NAME: Record<GemPlace, string> = { weapon: 've zbrani', armor: 've zbroji', jewel: 've šperku' };

export function gemEffect(key: string, place: GemPlace): { key: StatKey; value: number } | null {
  const g = parseGem(key);
  if (!g) return null;
  const e = g.def.effects[place];
  return { key: e.key, value: e.vals[g.tier - 1] };
}

/** most sockets an item of a kind can have */
export function maxSockets(cat: ItemCategory) {
  switch (cat) {
    case 'weapon2h':
    case 'chest':
      return 3;
    case 'weapon1h':
    case 'helmet':
    case 'pants':
    case 'shield':
    case 'offhand':
      return 2;
    default:
      return 1;
  }
}

/** sockets a newly found item comes with (better items have them more often, and more of them) */
export function rollSockets(cat: ItemCategory, rarity: number, rnd: () => number): (string | null)[] | undefined {
  const chance = [0.08, 0.16, 0.26, 0.38, 0.55, 0.7][rarity] ?? 0;
  if (rnd() >= chance) return undefined;
  let n = 1;
  if (rarity >= 2 && rnd() < 0.4) n++;
  if (rarity >= 4 && rnd() < 0.3) n++;
  return new Array(Math.min(n, maxSockets(cat))).fill(null);
}

/** the bonuses of the gems set into an item */
export function socketStats(it: Item, cat: ItemCategory, into: Stats) {
  if (!it.sockets) return;
  const place = gemPlace(cat);
  for (const g of it.sockets) {
    if (!g) continue;
    const e = gemEffect(g, place);
    if (e) into[e.key] = Math.round(((into[e.key] ?? 0) + e.value) * 10) / 10;
  }
}

/** price of drilling one more socket at the anvil */
export function drillCost(it: Item) {
  const n = it.sockets?.length ?? 0;
  return { gold: Math.round(150 * (1 + it.ilvl * 0.12) * (n + 1) * (1 + it.rarity * 0.2)), stones: 2 + n * 2 };
}

/** price of joining three gems into one of the next grade */
export function combineCost(tier: number, floor: number) {
  return Math.round(40 * tier * tier * (1 + floor / 25));
}

/** the grade of a gem found on a floor (deeper floors give better ones; bosses one grade more) */
export function dropTier(floor: number, bonus = 0, rnd = Math.random) {
  let t = 1 + Math.floor(floor / 45);
  if (rnd() < 0.15) t++;
  t += bonus;
  return Math.max(1, Math.min(floor >= 150 ? 5 : 4, t));
}

export function randomGem(floor: number, bonus = 0, rnd = Math.random) {
  const g = GEMS[Math.floor(rnd() * GEMS.length)];
  return gemKey(g.id, dropTier(floor, bonus, rnd));
}
