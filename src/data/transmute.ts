// Transmutation at the alchemist: five items of one rarity melt into one item of a higher rarity.
// Usually one step up, sometimes two, very rarely a primal relic; now and then the brew fails and gives
// back one item of the same rarity.
import type { Item } from './types';
import { generateItem, PRIMAL, BASE_BY_ID } from './items';

export const TRANSMUTE_N = 5;

export interface TransmuteOdds {
  /** [rarity, chance] for every possible result, best first */
  outcomes: [number, number][];
}

/** what five items of a rarity can turn into (the grand laboratory of Loppo never fails) */
export function transmuteOdds(r: number, noFail = false): TransmuteOdds {
  const primal: number[] = [0, 0.0005, 0.001, 0.003, 0.01, 0.15];
  const out: [number, number][] = [];
  const pr = primal[r] ?? 0;
  if (r + 1 >= PRIMAL) {
    // mythic: the only way up is the primal tier
    out.push([PRIMAL, pr]);
    out.push([r, 1 - pr]);
    return { outcomes: out };
  }
  if (pr > 0) out.push([PRIMAL, pr]);
  const up2 = r + 2 < PRIMAL ? (r >= 3 ? 0.1 : 0.12) : 0;
  const fail = Math.max(0, 1 - pr - up2 - (r >= 4 ? 0.7 : 0.8));
  const up1 = (r >= 4 ? 0.7 : 0.8) + (noFail ? fail : 0);
  if (up2 > 0) out.push([r + 2, up2]);
  out.push([r + 1, up1]);
  if (!noFail) out.push([r, fail]);
  return { outcomes: out };
}

export function transmuteCost(r: number, floor: number) {
  return Math.round(60 * (r + 1) * (r + 1) * (1 + floor / 15));
}

/** brews the result: the kind of one of the items, a little above their level */
export function transmute(items: Item[], floor: number, rnd = Math.random, noFail = false): Item {
  const r = items[0].rarity;
  let x = rnd();
  let rarity = r;
  for (const [rr, p] of transmuteOdds(r, noFail).outcomes) {
    if (x < p) {
      rarity = rr;
      break;
    }
    x -= p;
  }
  const pick = items[Math.floor(rnd() * items.length)];
  const base = BASE_BY_ID[pick.base] ? pick.base : items[0].base;
  const ilvl = Math.max(floor, Math.round(items.reduce((a, it) => a + it.ilvl, 0) / items.length)) + 1;
  return generateItem(ilvl, { base, rarity });
}
