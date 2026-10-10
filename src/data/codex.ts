// The codex: everything the hero has ever found - every unique, every set piece, every kind of item in
// every rarity, every gem and rune grade. Collectors see how much is left (231/311).
import type { Item } from './types';
import type { SaveData } from '../systems/state';
import { BASES, RARITIES } from './items';
import { UNIQUES, UNIQUE_BY_ID } from './uniques';
import { SETS } from './sets';
import { GEMS, GEM_MAX_TIER, gemKey } from './gems';
import { RUNES, RUNE_MAX_TIER, runeKey } from './runes';
import { SPELL_RUNES } from './spellrunes';
import { BOSS_ARMS, parseBossKey } from './bossweapons';
import { CLASSES } from './classes';

export interface Codex {
  /** uniques (ids) */
  u: string[];
  /** set pieces ("five:2") */
  s: string[];
  /** kinds of items by rarity ("sword:3") */
  b: string[];
  /** gems and runes ("ruby3", "fire2") */
  g: string[];
  /** weapons of the guardians ("isolda:ranger") */
  bw?: string[];
}

export function codexOf(s: SaveData): Codex {
  const c = (s.codex ??= { u: [], s: [], b: [], g: [] });
  c.u ??= [];
  c.s ??= [];
  c.b ??= [];
  c.g ??= [];
  c.bw ??= [];
  return c;
}

export const CODEX_TOTALS = {
  u: UNIQUES.length,
  s: SETS.reduce((a, d) => a + d.pieces.length, 0),
  b: BASES.length * RARITIES.length,
  g: GEMS.length * GEM_MAX_TIER + RUNES.length * RUNE_MAX_TIER + SPELL_RUNES.length,
  bw: BOSS_ARMS.length * CLASSES.length,
};
export const CODEX_TOTAL = CODEX_TOTALS.u + CODEX_TOTALS.s + CODEX_TOTALS.b + CODEX_TOTALS.g + CODEX_TOTALS.bw;

export function codexCount(s: SaveData) {
  const c = codexOf(s);
  return c.u.length + c.s.length + c.b.length + c.g.length + c.bw!.length;
}

/** records an item; returns the name of a new unique or set piece (worth a word on screen), or null */
export function discoverItem(s: SaveData, it: Item): string | null {
  const c = codexOf(s);
  let news: string | null = null;
  const bk = `${it.base}:${it.rarity}`;
  if (!c.b.includes(bk)) c.b.push(bk);
  if (it.unique && UNIQUE_BY_ID[it.unique] && !c.u.includes(it.unique)) {
    c.u.push(it.unique);
    news = it.name;
  }
  if (it.set && !c.s.includes(it.set)) {
    c.s.push(it.set);
    news = it.name;
  }
  if (it.boss && parseBossKey(it.boss) && !c.bw!.includes(it.boss)) {
    c.bw!.push(it.boss);
    news = it.name;
  }
  return news;
}

/** records a gem or rune key */
export function discoverStone(s: SaveData, key: string) {
  const c = codexOf(s);
  if (!c.g.includes(key)) c.g.push(key);
}

/** everything the hero already owns counts as found (saves from before the codex) */
export function syncCodex(s: SaveData) {
  const items = [...Object.values(s.equip), ...s.inventory, ...(s.stash ?? []), ...Object.values(s.merc?.equip ?? {})];
  for (const it of items) if (it) discoverItem(s, it);
  for (const k of Object.keys(s.gems ?? {})) discoverStone(s, k);
  for (const k of Object.keys(s.runes ?? {})) discoverStone(s, k);
  for (const k of [...Object.keys(s.spellRuneBag ?? {}), ...Object.values(s.spellRunes ?? {})]) discoverStone(s, 'spell:' + k);
}

export const ALL_STONES = [
  ...GEMS.flatMap((g) => Array.from({ length: GEM_MAX_TIER }, (_, t) => gemKey(g.id, t + 1))),
  ...RUNES.flatMap((r) => Array.from({ length: RUNE_MAX_TIER }, (_, t) => runeKey(r.id, t + 1))),
  ...SPELL_RUNES.map((r) => 'spell:' + r.id),
];
