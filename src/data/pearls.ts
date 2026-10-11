// Pearls of the depths: the second currency of Loppo, far rarer than gold. For now the hero finds them in the
// game – a gift for every day of play (more on a streak), one for every achievement, a few for the first fall of
// every guardian, now and then on a champion or in the fountain. Later they can also be bought (the offers are
// ready in the shop, the payment is not yet). They buy what gold cannot: looks (a trail behind the hero, seen by
// the other players too), comfort (a bigger bag and stash) and help for a while (books of wisdom, purses of
// luck, a phoenix feather that brings a fallen hero back once, a pearl chest).
import type { Stats } from './types';

export interface PearlState {
  /** trails bought, and the one the hero wears */
  trails?: string[];
  trail?: string | null;
  /** rows added to the bag (6 places each) and chests added to the stash (42 places each) */
  bag?: number;
  stash?: number;
  /** phoenix feathers in store */
  phoenix?: number;
  /** the book of wisdom and the purse of luck work up to this floor */
  wisdom?: number;
  luck?: number;
  /** the daily gift: the last day it was given (yyyy-mm-dd) and the days in a row */
  day?: string;
  streak?: number;
  /** achievements already paid in pearls */
  paidAch?: number;
  /** pearls found in all (for the statistics) */
  earned?: number;
}

export interface TrailDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  /** particle colours (picked in turn) */
  colors: number[];
  kind: 'spark' | 'puff' | 'pix';
  /** the shop's icon */
  glyph: string;
  css: string;
}

/** the trails behind a walking hero */
export const TRAILS: TrailDef[] = [
  { id: 'embers', name: 'Žhavé uhlíky', desc: 'Za každým krokem odletují jiskry.', price: 20, colors: [0xff8a2a, 0xffc04a, 0xff5a2a], kind: 'spark', glyph: 'fire', css: '#ff9a3a' },
  { id: 'leaves', name: 'Padající listí', desc: 'Kudy jdeš, tudy padá listí.', price: 20, colors: [0x7ad04a, 0xc8d84a, 0x4aa84a], kind: 'pix', glyph: 'leaf', css: '#8ad85a' },
  { id: 'frost', name: 'Mrazivé vločky', desc: 'Stopy pokryté jinovatkou.', price: 30, colors: [0xbfeaff, 0x7cc8ff, 0xffffff], kind: 'pix', glyph: 'ice', css: '#9fe0ff' },
  { id: 'stars', name: 'Hvězdný prach', desc: 'Třpytivý prach jako z noční oblohy.', price: 30, colors: [0xfff2a8, 0xffffff, 0xc8b8ff], kind: 'spark', glyph: 'star', css: '#fff2a8' },
  { id: 'shadow', name: 'Stínový závoj', desc: 'Za hrdinou se vleče fialový dým.', price: 40, colors: [0x7a3fc0, 0x4a2a7a, 0xa96bf0], kind: 'puff', glyph: 'ghost', css: '#b48aff' },
  { id: 'holy', name: 'Svatá zář', desc: 'Kroky svítí jako chrámové svíce.', price: 50, colors: [0xfff6c8, 0xffe08a, 0xffffff], kind: 'puff', glyph: 'cross', css: '#ffe8a0' },
  { id: 'rainbow', name: 'Duhová stopa', desc: 'Všechny barvy duhy, jedna po druhé.', price: 60, colors: [0xff4a4a, 0xff9a3a, 0xffe04a, 0x5adf6a, 0x4aa8ff, 0xb46aff], kind: 'spark', glyph: 'orb', css: '#ff9ad8' },
  { id: 'gold', name: 'Zlatá stopa', desc: 'Kdo má, ten ukazuje: zlaté jiskry na každém kroku.', price: 80, colors: [0xffd23a, 0xfff2b0, 0xe0a020], kind: 'spark', glyph: 'crown', css: '#ffd23a' },
];
export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map((t) => [t.id, t])) as Record<string, TrailDef>;

export type OfferKind = 'wisdom' | 'luck' | 'phoenix' | 'chest' | 'bag' | 'stash' | 'gold';

export interface PearlOffer {
  id: OfferKind;
  name: string;
  desc: string;
  price: number;
  glyph: string;
  css: string;
  /** how many can be bought (or held, for the feathers) */
  max?: number;
}

/** what pearls buy besides the trails */
export const PEARL_OFFERS: PearlOffer[] = [
  { id: 'wisdom', name: 'Kniha moudrosti', desc: '+50 % zkušeností na 10 pater.', price: 15, glyph: 'eye', css: '#9fe6ff' },
  { id: 'luck', name: 'Měšec štěstí', desc: '+50 % magického nálezu na 10 pater.', price: 15, glyph: 'star', css: '#52ff8f' },
  { id: 'phoenix', name: 'Pírko fénixe', desc: 'Když padneš, jednou tě vrátí do boje s polovinou zdraví. Ve hře Hardcore nefunguje.', price: 25, glyph: 'fire', css: '#ff8a4a', max: 3 },
  { id: 'chest', name: 'Perlová truhla', desc: 'Jistý legendární předmět, drahokamy a runy pro tvoje patro.', price: 20, glyph: 'crown', css: '#ffd76a' },
  { id: 'bag', name: 'Větší batoh', desc: '+6 míst v batohu navždy.', price: 40, glyph: 'plus', css: '#e8c890', max: 3 },
  { id: 'stash', name: 'Větší truhla doma', desc: '+42 míst v truhle v tvém domě navždy.', price: 40, glyph: 'shield', css: '#c8a070', max: 3 },
  { id: 'gold', name: 'Směna za zlato', desc: '5 perel za hromadu zlata podle nejhlubšího patra.', price: 5, glyph: 'sun', css: '#ffd23a' },
];

/** the packs that will be sold for real money (shown, not for sale yet) */
export const PEARL_PACKS: { pearls: number; bonus: number; price: string }[] = [
  { pearls: 50, bonus: 0, price: '49 Kč' },
  { pearls: 120, bonus: 10, price: '99 Kč' },
  { pearls: 300, bonus: 45, price: '229 Kč' },
  { pearls: 700, bonus: 150, price: '499 Kč' },
];

export function pearlState(s: { pearl?: PearlState }): PearlState {
  return (s.pearl ??= {});
}

/** gold for five pearls (more the deeper the hero has been) */
export function pearlGold(maxFloor: number) {
  return Math.round((2000 + maxFloor * 400) / 100) * 100;
}

/** the daily gift: one pearl a day, three on every seventh day in a row */
export function dailyGift(s: { pearl?: PearlState }, now = new Date()): { pearls: number; streak: number } | null {
  const st = pearlState(s);
  const day = dayKey(now);
  if (st.day === day) return null;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const streak = st.day === dayKey(y) ? (st.streak ?? 0) + 1 : 1;
  st.day = day;
  st.streak = streak;
  return { pearls: streak % 7 === 0 ? 3 : 1, streak };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** what the books and purses give while they last (they count like gear) */
export function pearlStats(s: { pearl?: PearlState; floor: number }): Stats {
  const st = s.pearl;
  const out: Stats = {};
  if (!st) return out;
  if ((st.wisdom ?? 0) >= s.floor) out.xp = 50;
  if ((st.luck ?? 0) >= s.floor) out.magicFind = 50;
  return out;
}

/** "1 perla", "3 perly", "5 perel" */
export function pearlWord(n: number) {
  const a = Math.abs(n);
  return a === 1 ? 'perla' : a >= 2 && a <= 4 ? 'perly' : 'perel';
}
