// Item sets: named groups of four pieces. Wearing two, three or all four pieces of a set adds its bonuses;
// the full set adds special effects of legendary items. Set pieces drop instead of some legendary items
// from floor 10 on (and now and then from guardians).
import type { Item, Slot, Stats } from './types';

export interface SetDef {
  id: string;
  name: string;
  /** the pieces: base item type and its fixed name */
  pieces: { base: string; name: string }[];
  /** bonuses by the number of pieces worn */
  bonuses: { n: number; stats?: Stats; specials?: string[] }[];
}

export const SET_COLOR = '#2fe0b0';
export const SET_MIN_FLOOR = 10;

export const SETS: SetDef[] = [
  {
    id: 'gate',
    name: 'Výzbroj strážce bran',
    pieces: [
      { base: 'helmet', name: 'Helma strážce bran' },
      { base: 'chest', name: 'Krunýř strážce bran' },
      { base: 'pants', name: 'Kalhoty strážce bran' },
      { base: 'boots', name: 'Boty strážce bran' },
    ],
    bonuses: [
      { n: 2, stats: { hpPct: 12 } },
      { n: 3, stats: { block: 8, hpRegen: 6 } },
      { n: 4, stats: { hpPct: 10 }, specials: ['thornNova'] },
    ],
  },
  {
    id: 'five',
    name: 'Plamen Pětice',
    pieces: [
      { base: 'helmet', name: 'Koruna Pětice' },
      { base: 'amulet', name: 'Náhrdelník Pětice' },
      { base: 'ring', name: 'Prsten Pětice' },
      { base: 'bracer', name: 'Náramek Pětice' },
    ],
    bonuses: [
      { n: 2, stats: { dmgPct: 12 } },
      { n: 3, stats: { spellDmg: 15 } },
      { n: 4, specials: ['burnOnHit', 'explodeOnKill'] },
    ],
  },
  {
    id: 'frost',
    name: 'Dar Ledové královny',
    pieces: [
      { base: 'chest', name: 'Šat Ledové královny' },
      { base: 'belt', name: 'Opasek Ledové královny' },
      { base: 'boots', name: 'Střevíce Ledové královny' },
      { base: 'ring', name: 'Prsten Ledové královny' },
    ],
    bonuses: [
      { n: 2, stats: { move: 8 } },
      { n: 3, stats: { crit: 5 } },
      { n: 4, stats: { critDmg: 40 }, specials: ['frostOnHit'] },
    ],
  },
  {
    id: 'shadow',
    name: 'Šepot stínů',
    pieces: [
      { base: 'helmet', name: 'Kápě šepotu' },
      { base: 'pants', name: 'Kalhoty šepotu' },
      { base: 'bracer', name: 'Náramek šepotu' },
      { base: 'ring', name: 'Prsten šepotu' },
    ],
    bonuses: [
      { n: 2, stats: { dodge: 5 } },
      { n: 3, stats: { atkSpdPct: 10 } },
      { n: 4, stats: { lifesteal: 2 }, specials: ['doubleStrike'] },
    ],
  },
  {
    id: 'storm',
    name: 'Hněv bouře',
    pieces: [
      { base: 'chest', name: 'Plášť bouře' },
      { base: 'amulet', name: 'Amulet bouře' },
      { base: 'boots', name: 'Boty bouře' },
      { base: 'bracer', name: 'Náramek bouře' },
    ],
    bonuses: [
      { n: 2, stats: { mpRegen: 4 } },
      { n: 3, stats: { cdr: 8 } },
      { n: 4, specials: ['chainOnHit', 'spellEcho'] },
    ],
  },
  {
    id: 'thorns',
    name: 'Hradba trnů',
    pieces: [
      { base: 'helmet', name: 'Trnitá přilba' },
      { base: 'chest', name: 'Trnitý krunýř' },
      { base: 'shield', name: 'Trnitý štít' },
      { base: 'bracer', name: 'Trnitý náramek' },
    ],
    bonuses: [
      { n: 2, stats: { thornsPct: 15, armorPct: 15 } },
      { n: 3, stats: { thorns: 60 }, specials: ['thornAura'] },
      { n: 4, stats: { thornsPct: 20 }, specials: ['thornArmor', 'thornNova'] },
    ],
  },
  {
    id: 'goblin',
    name: 'Poklad skřetího krále',
    pieces: [
      { base: 'belt', name: 'Opasek skřetího krále' },
      { base: 'ring', name: 'Prsten skřetího krále' },
      { base: 'amulet', name: 'Náhrdelník skřetího krále' },
      { base: 'boots', name: 'Boty skřetího krále' },
    ],
    bonuses: [
      { n: 2, stats: { gold: 30 } },
      { n: 3, stats: { magicFind: 25 } },
      { n: 4, stats: { xp: 10 }, specials: ['goldRush'] },
    ],
  },
];

export const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s])) as Record<string, SetDef>;

/** how many different pieces of each set are worn */
export function equippedSetCounts(equip: Partial<Record<Slot, Item | null>>): Record<string, number> {
  const seen = new Map<string, Set<number>>();
  for (const it of Object.values(equip)) {
    if (!it?.set) continue;
    const [id, piece] = it.set.split(':');
    if (!seen.has(id)) seen.set(id, new Set());
    seen.get(id)!.add(+piece);
  }
  const out: Record<string, number> = {};
  for (const [id, s] of seen) out[id] = s.size;
  return out;
}

/** the bonuses of the sets worn, added to stats and specials */
export function addSetBonuses(equip: Partial<Record<Slot, Item | null>>, add: (k: keyof Stats, v: number) => void, specials: Set<string>) {
  for (const [id, n] of Object.entries(equippedSetCounts(equip))) {
    const def = SET_BY_ID[id];
    if (!def) continue;
    for (const b of def.bonuses) {
      if (n < b.n) continue;
      for (const [k, v] of Object.entries(b.stats ?? {})) add(k as keyof Stats, v as number);
      for (const sp of b.specials ?? []) specials.add(sp);
    }
  }
}

/** the set and piece of a set item ("five:2" → the set, piece 2) */
export function setOf(it: Item | null | undefined): { def: SetDef; piece: number } | null {
  if (!it?.set) return null;
  const [id, piece] = it.set.split(':');
  const def = SET_BY_ID[id];
  return def ? { def, piece: +piece } : null;
}
