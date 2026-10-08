// Cursed items: a brutal bonus bought with a drawback. A rare (or better) item now and then carries a
// curse; the curse's bonus and its price both count while the item is worn.
import type { Stats } from './types';

export interface CurseDef {
  id: string;
  name: string;
  /** what it gives (flat values grow with the item level) */
  bonus: (ilvl: number) => Stats;
  /** what it takes (stats) */
  malus?: (ilvl: number) => Stats;
  /** a drawback that is not a number (see Player / Combat / Spells) */
  special?: string;
  /** the drawback in words (for specials) */
  malusText?: string;
}

export const CURSES: CurseDef[] = [
  { id: 'bloodpact', name: 'Krvavá smlouva', bonus: () => ({ dmgPct: 80 }), malus: () => ({ hpPct: -30 }) },
  { id: 'frenzy', name: 'Zběsilost', bonus: () => ({ atkSpdPct: 50 }), special: 'manaBurn', malusText: 'Každý útok spotřebuje 2 % many' },
  { id: 'glass', name: 'Skleněné ostří', bonus: () => ({ crit: 10, critDmg: 60 }), special: 'fragile', malusText: 'Dostáváš o 25 % víc poškození' },
  { id: 'bloodmagic', name: 'Krvavá magie', bonus: () => ({ spellDmg: 60 }), special: 'bloodPrice', malusText: 'Každé kouzlo stojí i 3 % zdraví' },
  { id: 'shackles', name: 'Těžké okovy', bonus: (l) => ({ armor: Math.round(20 + l * 4), block: 15 }), malus: () => ({ move: -25 }) },
  { id: 'madness', name: 'Šílenství', bonus: () => ({ crit: 20 }), special: 'noRegen', malusText: 'Zdraví se samo neobnovuje' },
  { id: 'hunger', name: 'Hladová čepel', bonus: () => ({ lifesteal: 8 }), malus: () => ({ hpPct: -20 }) },
  { id: 'deathhaste', name: 'Spěch smrti', bonus: () => ({ move: 30, cdr: 20 }), special: 'fragile', malusText: 'Dostáváš o 25 % víc poškození' },
  { id: 'greed', name: 'Lakomcova kletba', bonus: () => ({ gold: 80, magicFind: 50 }), malus: () => ({ dmgPct: -25 }) },
  { id: 'eternal', name: 'Věčný hlad', bonus: () => ({ xp: 40 }), special: 'weakPotions', malusText: 'Lektvary léčí jen napůl' },
];

export const CURSE_BY_ID = Object.fromEntries(CURSES.map((c) => [c.id, c])) as Record<string, CurseDef>;

/** chance that a rare (or better) item comes cursed */
export const CURSE_CHANCE = 0.04;

/** the stats of a curse on an item of a level (bonus and malus together) */
export function curseStats(id: string, ilvl: number): { bonus: Stats; malus: Stats } {
  const c = CURSE_BY_ID[id];
  if (!c) return { bonus: {}, malus: {} };
  return { bonus: c.bonus(ilvl), malus: c.malus?.(ilvl) ?? {} };
}
