// Weapon runes. Every weapon has a rune socket (two-handed ones two, mythic and primal one more). A rune
// gives each hit a chance (10-50 % by its grade) to burn, poison, freeze, call lightning, make the foe
// bleed, weaken it or drain its life. Runes are kept in a pouch, three of a grade make one of the next.
import type { Item } from './types';
import { BASE_BY_ID } from './items';

export type RuneType = 'fire' | 'poison' | 'frost' | 'storm' | 'blood' | 'weak' | 'leech';

export interface RuneDef {
  id: RuneType;
  /** genitive: "runa ohně" */
  name: string;
  color: string;
  /** what a hit may do (after "x % šance ...") */
  does: string;
}

export const RUNE_TIERS = ['Puklá', 'Slabá', 'Ryzí', 'Mocná', 'Prastará'];
export const RUNE_MAX_TIER = RUNE_TIERS.length;
export const RUNE_CHANCE = [10, 20, 30, 40, 50];

export const RUNES: RuneDef[] = [
  { id: 'fire', name: 'ohně', color: '#ff7a2a', does: 'zapálit nepřítele' },
  { id: 'poison', name: 'jedu', color: '#7bd88f', does: 'otrávit nepřítele' },
  { id: 'frost', name: 'mrazu', color: '#9fe6ff', does: 'zpomalit nepřítele (od Ryzí runy i zmrazit)' },
  { id: 'storm', name: 'bouře', color: '#fff27a', does: 'vyvolat řetězový blesk' },
  { id: 'blood', name: 'krve', color: '#ff3a4a', does: 'způsobit krvácení' },
  { id: 'weak', name: 'zkázy', color: '#c77dff', does: 'oslabit nepřítele (bere o 20 % víc poškození)' },
  { id: 'leech', name: 'upíra', color: '#ff6a9a', does: 'vysát život (léčí tě)' },
];

export const RUNE_BY_ID = Object.fromEntries(RUNES.map((r) => [r.id, r])) as Record<RuneType, RuneDef>;

export const runeKey = (t: RuneType, tier: number) => `${t}${tier}`;

export function parseRune(key: string): { def: RuneDef; tier: number } | null {
  const m = /^([a-z]+)(\d)$/.exec(key);
  if (!m) return null;
  const def = RUNE_BY_ID[m[1] as RuneType];
  const tier = +m[2];
  return def && tier >= 1 && tier <= RUNE_MAX_TIER ? { def, tier } : null;
}

/** "Mocná runa ohně" */
export function runeName(key: string) {
  const r = parseRune(key);
  return r ? `${RUNE_TIERS[r.tier - 1]} runa ${r.def.name}` : key;
}

export function runeIcon(key: string) {
  const r = parseRune(key);
  return r ? `rune_${r.def.id}_${r.tier}` : 'rune_fire_1';
}

export function runeChance(key: string) {
  const r = parseRune(key);
  return r ? RUNE_CHANCE[r.tier - 1] : 0;
}

/** "30 % šance zapálit nepřítele" */
export function runeDesc(key: string) {
  const r = parseRune(key);
  return r ? `${runeChance(key)} % šance ${r.def.does}` : '';
}

/** how many rune sockets an item has (weapons only) */
export function runeSlotCount(it: Item) {
  const b = BASE_BY_ID[it.base];
  if (!b || (b.cat !== 'weapon1h' && b.cat !== 'weapon2h')) return 0;
  return (b.cat === 'weapon2h' ? 2 : 1) + (it.rarity >= 5 ? 1 : 0);
}

/** the item's rune sockets (made on first use for items from older saves) */
export function runeSlots(it: Item): (string | null)[] {
  const n = runeSlotCount(it);
  if (!n) return [];
  if (!it.runes || it.runes.length < n) it.runes = [...(it.runes ?? []), ...new Array(n - (it.runes?.length ?? 0)).fill(null)];
  return it.runes;
}

/** price of joining three runes into one of the next grade */
export function runeCombineCost(tier: number, floor: number) {
  return Math.round(50 * tier * tier * (1 + floor / 25));
}

/** the grade of a rune found on a floor (bosses one higher) */
export function runeDropTier(floor: number, bonus = 0, rnd = Math.random) {
  let t = 1 + Math.floor(floor / 50);
  if (rnd() < 0.15) t++;
  t += bonus;
  return Math.max(1, Math.min(floor >= 150 ? 5 : 4, t));
}

export function randomRune(floor: number, bonus = 0, rnd = Math.random) {
  const r = RUNES[Math.floor(rnd() * RUNES.length)];
  return runeKey(r.id, runeDropTier(floor, bonus, rnd));
}
