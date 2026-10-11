// The fountain in the king's courtyard, King Dobromil III's gift to Loppo: "Whoever throws a coin will return."
// Two ways to give it gold. A wish: a coin thrown in brings something random – mostly small things, now and then
// gold back, rarely a legendary item or a pearl; a great wish costs eight coins and brings better things. And a
// gift for Loppo: gold given to the village raises its prosperity – there is always a next level, each one a
// small bonus for the hero (they never stop), and every fifth level the village grows a rank and gets prettier
// (flowers, flags, lights, a statue of the hero, fireworks, a golden fountain).
import type { Stats } from './types';

/** the prosperity of Loppo (levels bought with gold at the fountain) */
export interface ProsperityState {
  lv: number;
  /** gold given in all */
  given: number;
}

/** what every level gives, in turn (five levels make one round) */
export const PROSPERITY_STEPS: { stats: Stats; text: string }[] = [
  { stats: { xp: 2 }, text: '+2 % zkušeností' },
  { stats: { magicFind: 3 }, text: '+3 % magického nálezu' },
  { stats: { hpPct: 1 }, text: '+1 % zdraví' },
  { stats: { dmgPct: 1, spellDmg: 1 }, text: '+1 % poškození a síly kouzel' },
  { stats: { armorPct: 2 }, text: '+2 % zbroje' },
];

/** the ranks of the village (every fifth level) and what each one adds to the village */
export const PROSPERITY_RANKS: { lv: number; name: string; adds: string }[] = [
  { lv: 0, name: 'Osada', adds: '' },
  { lv: 5, name: 'Vesnice', adds: 'květinové záhony kolem studny' },
  { lv: 10, name: 'Městys', adds: 'prapory podél cest' },
  { lv: 15, name: 'Město', adds: 'girlandy světel na náměstí' },
  { lv: 20, name: 'Královské město', adds: 'socha hrdiny na náměstí' },
  { lv: 25, name: 'Klenot Šedých hor', adds: 'večerní ohňostroje nad Loppem' },
  { lv: 30, name: 'Zlaté Loppo', adds: 'zlatá fontána' },
];

/** gold for the next level (from level lv to lv + 1): it grows by a third with every level, so there is always
 *  somewhere for gold to go */
export function prosperityCost(lv: number) {
  return Math.round((2500 * Math.pow(1.32, lv)) / 100) * 100;
}

/** everything the prosperity of Loppo gives at a level (counts like gear) */
export function prosperityStats(lv: number): Stats {
  const out: Stats = {};
  for (let i = 0; i < lv; i++)
    for (const [k, v] of Object.entries(PROSPERITY_STEPS[i % PROSPERITY_STEPS.length].stats)) {
      const key = k as keyof Stats;
      out[key] = (out[key] ?? 0) + (v as number);
    }
  return out;
}

/** the rank of the village at a level */
export function prosperityRank(lv: number) {
  let r = PROSPERITY_RANKS[0];
  for (const x of PROSPERITY_RANKS) if (lv >= x.lv) r = x;
  return r;
}

/** the next rank (null past the last one) */
export function nextRank(lv: number) {
  return PROSPERITY_RANKS.find((x) => x.lv > lv) ?? null;
}

/** a coin's worth for a wish: about the price of an epic item at the deepest floor */
export function wishCost(maxFloor: number, big = false) {
  const one = Math.round((110 * (1 + Math.max(1, maxFloor) * 0.18)) / 10) * 10;
  return big ? one * 8 : one;
}

/** what a wish can bring (weights; the great wish has its own table) */
export type WishKind = 'mats' | 'potions' | 'lockpick' | 'gold' | 'gem' | 'gems' | 'rune' | 'runes' | 'srune' | 'item' | 'legend' | 'mythic' | 'luck' | 'pearl';

export const WISH_TABLE: [WishKind, number][] = [
  ['mats', 22],
  ['potions', 15],
  ['lockpick', 8],
  ['gold', 12],
  ['gem', 12],
  ['rune', 6],
  ['item', 14],
  ['luck', 6],
  ['legend', 3],
  ['pearl', 2],
];

export const BIG_WISH_TABLE: [WishKind, number][] = [
  ['item', 30],
  ['gems', 14],
  ['runes', 10],
  ['luck', 10],
  ['gold', 10],
  ['mats', 8],
  ['srune', 5],
  ['legend', 6],
  ['mythic', 3],
  ['pearl', 4],
];

export function rollWish(big: boolean, rnd = Math.random): WishKind {
  const table = big ? BIG_WISH_TABLE : WISH_TABLE;
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [k, w] of table) {
    r -= w;
    if (r <= 0) return k;
  }
  return table[0][0];
}

/** the fountain's luck: more magic find for a few floors (a great wish lasts longer and gives more) */
export function fountainLuck(big: boolean) {
  return big ? { mf: 60, floors: 5 } : { mf: 30, floors: 3 };
}
