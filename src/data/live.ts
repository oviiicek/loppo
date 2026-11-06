// What brings a player back every day, and what the pearls are for beyond the shop:
// - the flame of the wick: days of play in a row (a candle keeps it burning over a missed day),
// - the newcomer's path: a gift on each of the first seven days of play,
// - three tasks a day (the same for everyone that day), paid in sparks for the season's path,
// - the season's path: four weeks, thirty steps, a free track and a pearl track with the season's own looks,
// - the daily depth: one rift a day, laid out the same for everyone, with a result to share,
// - looks to wear: auras under the hero and titles next to the name (seen by the other players too).
import type { SaveData } from '../systems/state';
import { PearlState, pearlState, dayKey } from './pearls';
import { FLOOR_MODS, FloorMod } from './floormods';
import { isBossFloor } from './enemies';
import { isCampFloor } from './bands';
import { RNG } from '../systems/rng';

/** the first day of the daily depths and of the first season (local dates) */
const EPOCH = Date.UTC(2026, 10, 5);

/** days since the epoch by the player's own calendar (the clock's hour and summer time do not matter) */
export function dayNumber(now = new Date()) {
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH) / 86400000);
}

/** days between two day keys ("2026-11-05") */
function daysBetween(a: string, b: string) {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

/** a number for a text (the same text gives the same number on every device) */
export function hashText(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ------------------------------------------------------------------ rewards
export type Reward =
  | { k: 'pearls'; n: number }
  /** gold: n heaps worth the hero's deepest floor */
  | { k: 'gold'; n: number }
  | { k: 'pots'; n: number }
  /** a gem or a rune a grade better than the floor's (n = how much better) */
  | { k: 'gem'; n: number }
  | { k: 'rune'; n: number }
  /** an item of this rarity (3 epic, 4 legendary) for the hero's deepest floor */
  | { k: 'item'; n: number }
  | { k: 'mats'; n: number }
  | { k: 'wisdom' }
  | { k: 'luck' }
  | { k: 'phoenix' }
  | { k: 'candle' }
  | { k: 'trail'; id: string }
  | { k: 'aura'; id: string }
  | { k: 'title'; id: string };

// ------------------------------------------------------------------ looks: auras and titles
export interface AuraDef {
  id: string;
  name: string;
  desc: string;
  /** pearls in the shop (0: only earned) */
  price: number;
  /** the glow and the sparks that rise from it */
  color: number;
  spark: number;
  css: string;
  glyph: string;
  /** how one that is not sold is earned */
  how?: string;
  /** the season it belongs to (its pearl track gives it) */
  season?: number;
}

export const AURAS: AuraDef[] = [
  { id: 'ember', name: 'Žhnoucí aura', desc: 'Pod nohama ti doutná kruh žhavých uhlíků.', price: 35, color: 0xff6a1a, spark: 0xffc04a, css: '#ff9a3a', glyph: 'fire' },
  { id: 'frost', name: 'Mrazivá aura', desc: 'Kolem tebe se třpytí mrazivý opar.', price: 35, color: 0x5ab8ff, spark: 0xe0f6ff, css: '#9fe0ff', glyph: 'ice' },
  { id: 'venom', name: 'Jedová aura', desc: 'Zelený opar, který se táhne s tebou.', price: 40, color: 0x3adf4a, spark: 0xc8ff8a, css: '#7aff6a', glyph: 'poison' },
  { id: 'arcane', name: 'Tajemná aura', desc: 'Fialové světlo staré magie.', price: 45, color: 0x9a4aff, spark: 0xe0c8ff, css: '#b48aff', glyph: 'orb' },
  { id: 'holy', name: 'Svatozář', desc: 'Zlatavé světlo jako z chrámového okna.', price: 60, color: 0xffd86a, spark: 0xffffff, css: '#ffe8a0', glyph: 'sun' },
  { id: 'blood', name: 'Krvavá aura', desc: 'Rudý kruh, který každému prozradí, že jdeš do boje.', price: 60, color: 0xe0202a, spark: 0xff8a7a, css: '#ff5a5a', glyph: 'drop' },
  { id: 'wick', name: 'Plamen knotu', desc: 'Teplé světlo svíčky, která tě dovedla do hlubin.', price: 0, color: 0xffa83a, spark: 0xfff0b0, css: '#ffc46a', glyph: 'fire', how: 'Cesta nováčka – 7. den' },
  { id: 'eternal', name: 'Věčný plamen', desc: 'Modrobílý plamen, který nikdy nezhasl.', price: 0, color: 0x7ac8ff, spark: 0xffffff, css: '#bfe6ff', glyph: 'fire', how: 'Plamen knotu 100 dní v řadě' },
  { id: 's1', name: 'Plamenný kruh', desc: 'Kruh ohně z první sezóny hlubin.', price: 0, color: 0xff8a2a, spark: 0xfff0a0, css: '#ffb347', glyph: 'sun', season: 1 },
  { id: 's2', name: 'Polární záře', desc: 'Zelenomodré světlo z mrazivé sezóny.', price: 0, color: 0x3ae0c8, spark: 0xc8fff0, css: '#6af0d8', glyph: 'wave', season: 2 },
  { id: 's3', name: 'Jedový opar', desc: 'Hustý zelený dým z jedové sezóny.', price: 0, color: 0x6adf2a, spark: 0xe0ff8a, css: '#a8f06a', glyph: 'poison', season: 3 },
  { id: 's4', name: 'Hvězdný prstenec', desc: 'Prstenec hvězd z hvězdné sezóny.', price: 0, color: 0x8a6aff, spark: 0xffffff, css: '#c8b8ff', glyph: 'star', season: 4 },
];
export const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a])) as Record<string, AuraDef>;

export interface TitleDef {
  id: string;
  name: string;
  price: number;
  how?: string;
  season?: number;
  css: string;
}

// (titles are said of anyone: no word in them changes with the hero's gender)
export const TITLES: TitleDef[] = [
  { id: 'goldhand', name: 'Zlatá ruka', price: 20, css: '#ffd23a' },
  { id: 'terror', name: 'Postrach hlubin', price: 30, css: '#ff8a5a' },
  { id: 'shadow', name: 'Stín v temnotě', price: 40, css: '#b48aff' },
  { id: 'storm', name: 'Bouře z hlubin', price: 50, css: '#9fe6ff' },
  { id: 'crown', name: 'Koruna hlubin', price: 70, css: '#ffd76a' },
  { id: 'legend', name: 'Živoucí legenda', price: 100, css: '#ff9f1c' },
  { id: 'flame', name: 'Mladý plamen', price: 0, how: 'Cesta nováčka – 7. den', css: '#ffc46a' },
  { id: 'unquenched', name: 'Neuhasínající', price: 0, how: 'Plamen knotu 30 dní v řadě', css: '#ffb347' },
  { id: 'soul', name: 'Duše hlubin', price: 0, how: '10 dokončených denních hlubin', css: '#c77dff' },
  { id: 'heart', name: 'Zlaté srdce', price: 0, how: 'Poděkování za podporu hry nákupem', css: '#ffd23a' },
  { id: 's1', name: 'Srdce plamene', price: 0, season: 1, css: '#ffb347' },
  { id: 's2', name: 'Mrazivý dech', price: 0, season: 2, css: '#6af0d8' },
  { id: 's3', name: 'Jedový trn', price: 0, season: 3, css: '#a8f06a' },
  { id: 's4', name: 'Hvězdná duše', price: 0, season: 4, css: '#c8b8ff' },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<string, TitleDef>;

/** the hero gets a look (false when it was there already) */
export function grantLook(st: PearlState, kind: 'trail' | 'aura' | 'title', id: string) {
  const key = kind === 'trail' ? 'trails' : kind === 'aura' ? 'auras' : 'titles';
  const have = (st[key] ??= []);
  if (have.includes(id)) return false;
  have.push(id);
  return true;
}

/** the trail or aura the hero shows now: the one being tried on (for half a minute), else the one worn */
export function wornLook(st: PearlState | undefined, kind: 'trail' | 'aura'): string | null | undefined {
  const t = st?.trying;
  if (t && t.kind === kind && performance.now() < t.until) return t.id;
  return kind === 'trail' ? st?.trail : st?.aura;
}

// ------------------------------------------------------------------ the flame of the wick (days in a row)
/** candles held at most */
export const CANDLE_MAX = 2;
export const CANDLE_PRICE = 10;

export interface DailyGift {
  pearls: number;
  streak: number;
  /** candles burnt for the days that were missed */
  burnt: number;
  /** what the day of the streak brings besides the pearls */
  candle?: boolean;
  title?: string;
  aura?: string;
}

/** the gift of the day: one pearl a day, three on every seventh day in a row; missed days burn candles, and
 *  some days of the streak bring more (a candle on the third, a title on the thirtieth, an aura on the hundredth) */
export function dailyGift(s: { pearl?: PearlState }, now = new Date()): DailyGift | null {
  const st = pearlState(s);
  const day = dayKey(now);
  st.born ??= day;
  if (st.day === day) return null;
  let streak = 1,
    burnt = 0;
  if (st.day) {
    const gap = daysBetween(st.day, day);
    if (gap === 1) streak = (st.streak ?? 0) + 1;
    else if (gap > 1 && gap - 1 <= (st.candles ?? 0)) {
      burnt = gap - 1;
      st.candles = (st.candles ?? 0) - burnt;
      streak = (st.streak ?? 0) + 1;
    }
  }
  st.day = day;
  st.streak = streak;
  const g: DailyGift = { pearls: streak % 7 === 0 ? 3 : 1, streak, burnt };
  if (streak === 3 && (st.candles ?? 0) < CANDLE_MAX) {
    st.candles = (st.candles ?? 0) + 1;
    g.candle = true;
  }
  if (streak === 30 && grantLook(st, 'title', 'unquenched')) {
    g.title = 'unquenched';
    g.pearls += 10;
  }
  if (streak === 100 && grantLook(st, 'aura', 'eternal')) {
    g.aura = 'eternal';
    g.pearls += 25;
  }
  return g;
}

/** the flame is still burning today (or will, once the hero plays today) */
export function flameAlive(st: PearlState, now = new Date()) {
  if (!st.day) return false;
  const gap = daysBetween(st.day, dayKey(now));
  return gap <= 1 + (st.candles ?? 0);
}

// ------------------------------------------------------------------ the newcomer's path
export const WELCOME: Reward[][] = [
  [{ k: 'pearls', n: 10 }, { k: 'pots', n: 5 }],
  [{ k: 'luck' }, { k: 'gold', n: 1 }],
  [{ k: 'candle' }, { k: 'pearls', n: 5 }],
  [{ k: 'item', n: 4 }],
  [{ k: 'wisdom' }, { k: 'pearls', n: 5 }],
  [{ k: 'phoenix' }, { k: 'gem', n: 1 }],
  [{ k: 'aura', id: 'wick' }, { k: 'title', id: 'flame' }, { k: 'pearls', n: 20 }],
];

/** the next gift of the newcomer's path can be taken today (one a day, seven in all) */
export function welcomeReady(st: PearlState, now = new Date()) {
  return (st.welcome ?? 0) < WELCOME.length && st.wday !== dayKey(now);
}

// ------------------------------------------------------------------ tasks of the day
export interface TaskDef {
  id: string;
  icon: string;
  text: (n: number) => string;
  /** the counter the task follows (its progress is how much it grew today) */
  stat: (s: SaveData) => number;
  goal: (s: SaveData) => number;
  /** the task can be given to this hero */
  ok?: (s: SaveData) => boolean;
}

const stat = (key: keyof NonNullable<SaveData['stats']>) => (s: SaveData) => s.stats?.[key] ?? 0;
const round100 = (v: number) => Math.round(v / 100) * 100;

export const TASKS: TaskDef[] = [
  { id: 'kills', icon: '⚔', text: (n) => `Poraz ${n} nestvůr`, stat: (s) => s.kills, goal: () => 150 },
  { id: 'elites', icon: '☠', text: (n) => `Poraz ${n} šampionů`, stat: stat('elites'), goal: () => 5 },
  { id: 'chests', icon: '🧰', text: (n) => `Otevři ${n} truhel`, stat: stat('chests'), goal: () => 5 },
  { id: 'items', icon: '🗡', text: (n) => `Seber ${n} předmětů`, stat: stat('items'), goal: () => 15 },
  { id: 'gold', icon: '🪙', text: (n) => `Vydělej ${n.toLocaleString('cs-CZ')} zlata`, stat: stat('goldEarned'), goal: (s) => round100(600 + s.maxFloor * 150) },
  { id: 'boss', icon: '👑', text: () => 'Poraz strážce', stat: stat('bosses'), goal: () => 1, ok: (s) => s.maxFloor > 10 },
  { id: 'secret', icon: '🗝', text: () => 'Najdi tajnou místnost', stat: stat('secrets'), goal: () => 1 },
  { id: 'events', icon: '✦', text: (n) => `Zažij ${n} události v hlubinách`, stat: stat('events'), goal: () => 2 },
  { id: 'locks', icon: '🔓', text: (n) => `Odemkni ${n} zámky`, stat: stat('locks'), goal: () => 3 },
  { id: 'bounty', icon: '📜', text: () => 'Splň odměnu vypsanou na patře', stat: stat('bounties'), goal: () => 1 },
  { id: 'potions', icon: '🧪', text: (n) => `Vypij ${n} lektvarů`, stat: stat('potions'), goal: () => 5 },
  { id: 'time', icon: '⏳', text: (n) => `Hraj ${n} minut`, stat: (s) => Math.floor(s.playTime / 60), goal: () => 20 },
  { id: 'delve', icon: '🌀', text: () => 'Dokonči denní hlubinu', stat: (s) => pearlState(s).delves ?? 0, goal: () => 1, ok: (s) => delveOpen(s) },
];
export const TASK_BY_ID = Object.fromEntries(TASKS.map((t) => [t.id, t])) as Record<string, TaskDef>;

/** sparks for a task, for all three, the first daily depth of the day, and how many sparks one step takes */
export const TASK_SPARKS = 100;
export const BONUS_SPARKS = 100;
export const BONUS_PEARLS = 2;
export const DELVE_SPARKS = 150;
export const SWAP_PRICE = 3;
/** sparks from fighting: one for every few monsters and some for a guardian, up to a limit a day */
const KILLS_PER_SPARK = 4;
const KILL_SPARKS_DAY = 120;
const BOSS_SPARKS = 30;
const BOSS_SPARKS_DAY = 90;

export interface TaskState {
  id: string;
  /** the goal and the counter's value when the task was given */
  n: number;
  base: number;
  /** told as done (a toast), sparks taken */
  told?: boolean;
  paid?: boolean;
}

export interface DayTasks {
  day: string;
  list: TaskState[];
  /** the free swap of the day was used */
  swapped?: boolean;
  /** the bonus for all three was taken */
  bonus?: boolean;
  /** monsters and guardians counted for sparks (the counters' values), sparks they gave today */
  kills: number;
  bosses: number;
  ks: number;
  bs: number;
}

export function taskProgress(s: SaveData, t: TaskState) {
  const d = TASK_BY_ID[t.id];
  return d ? Math.max(0, Math.min(t.n, d.stat(s) - t.base)) : 0;
}

export function taskDone(s: SaveData, t: TaskState) {
  return taskProgress(s, t) >= t.n;
}

function newTask(s: SaveData, d: TaskDef): TaskState {
  return { id: d.id, n: d.goal(s), base: d.stat(s) };
}

/** today's tasks (a new day brings three new ones, the same for everyone who can get them) */
export function dayTasks(s: SaveData, now = new Date()): DayTasks {
  const st = pearlState(s);
  const day = dayKey(now);
  if (st.tasks?.day === day) return st.tasks;
  const r = new RNG(hashText('tasks:' + day));
  const pool = TASKS.filter((d) => !d.ok || d.ok(s));
  const list: TaskState[] = [];
  while (list.length < 3 && pool.length) list.push(newTask(s, pool.splice(Math.floor(r.next() * pool.length), 1)[0]));
  st.tasks = { day, list, kills: s.kills, bosses: s.stats?.bosses ?? 0, ks: 0, bs: 0 };
  return st.tasks;
}

/** a task the hero does not want is swapped for another one (false when there is nothing left to give) */
export function swapTask(s: SaveData, i: number) {
  const t = dayTasks(s);
  const have = new Set(t.list.map((x) => x.id));
  const pool = TASKS.filter((d) => !have.has(d.id) && (!d.ok || d.ok(s)));
  if (!pool.length || t.list[i]?.paid) return false;
  t.list[i] = newTask(s, pool[Math.floor(Math.random() * pool.length)]);
  return true;
}

/** sparks from the monsters and guardians beaten since the last count (within the day's limits) */
export function fightSparks(s: SaveData): number {
  const t = dayTasks(s);
  const kn = Math.floor((s.kills - t.kills) / KILLS_PER_SPARK);
  t.kills += kn * KILLS_PER_SPARK;
  const k = Math.max(0, Math.min(kn, KILL_SPARKS_DAY - t.ks));
  t.ks += k;
  const bn = (s.stats?.bosses ?? 0) - t.bosses;
  t.bosses += Math.max(0, bn);
  const b = Math.max(0, Math.min(bn * BOSS_SPARKS, BOSS_SPARKS_DAY - t.bs));
  t.bs += b;
  return k + b;
}

// ------------------------------------------------------------------ the season's path
export const SEASON_DAYS = 28;
export const SEASON_STEPS = 30;
export const STEP_SPARKS = 200;
export const PREMIUM_PRICE = 120;
export const STEP_PRICE = 15;

export interface SeasonTheme {
  name: string;
  css: string;
  trail: string;
  aura: string;
  title: string;
}

/** the seasons take turns (their looks come back with them) */
export const SEASON_THEMES: SeasonTheme[] = [
  { name: 'Probuzení knotu', css: '#ffb347', trail: 's1', aura: 's1', title: 's1' },
  { name: 'Mrazivá hlubina', css: '#6af0d8', trail: 's2', aura: 's2', title: 's2' },
  { name: 'Jedový kořen', css: '#a8f06a', trail: 's3', aura: 's3', title: 's3' },
  { name: 'Hvězdná propast', css: '#c8b8ff', trail: 's4', aura: 's4', title: 's4' },
];

export interface SeasonState {
  n: number;
  sparks: number;
  premium?: boolean;
  /** steps whose free and pearl rewards were taken */
  free: number[];
  prem: number[];
}

/** the season running today: its number, its theme and the days left */
export function seasonNow(now = new Date()) {
  const d = Math.max(0, dayNumber(now));
  const n = Math.floor(d / SEASON_DAYS) + 1;
  return { n, theme: SEASON_THEMES[(n - 1) % SEASON_THEMES.length], left: SEASON_DAYS - (d % SEASON_DAYS) };
}

/** the hero's record of the season running today (a new season starts the path again) */
export function seasonOf(s: { pearl?: PearlState }, now = new Date()): SeasonState {
  const st = pearlState(s);
  const n = seasonNow(now).n;
  if (st.season?.n !== n) st.season = { n, sparks: 0, free: [], prem: [] };
  return st.season;
}

export function seasonStep(se: SeasonState) {
  return Math.min(SEASON_STEPS, Math.floor(se.sparks / STEP_SPARKS));
}

/** sparks for the season's path; the steps reached by them */
export function addSparks(s: { pearl?: PearlState }, n: number) {
  const se = seasonOf(s);
  const before = seasonStep(se);
  se.sparks = Math.min(SEASON_STEPS * STEP_SPARKS, se.sparks + n);
  return seasonStep(se) - before;
}

/** what a step gives on the free track */
export function freeReward(step: number): Reward {
  if (step === SEASON_STEPS) return { k: 'pearls', n: 5 };
  if (step === 15) return { k: 'item', n: 3 };
  switch (step % 5) {
    case 0:
      return { k: 'pearls', n: 2 };
    case 1:
      return { k: 'gold', n: 1 };
    case 2:
      return { k: 'pots', n: 4 };
    case 3:
      return { k: 'gem', n: 0 };
    default:
      return step % 2 ? { k: 'mats', n: 1 } : { k: 'rune', n: 0 };
  }
}

/** what a step gives on the pearl track (it gives back more pearls than it costs, the season's looks too) */
export function premiumReward(step: number, season: number): Reward[] {
  const th = SEASON_THEMES[(season - 1) % SEASON_THEMES.length];
  const pearls: Record<number, number> = { 1: 10, 4: 10, 7: 10, 10: 15, 13: 10, 16: 15, 19: 10, 22: 15, 25: 15, 28: 15, 30: 25 };
  const out: Reward[] = [];
  if (pearls[step]) out.push({ k: 'pearls', n: pearls[step] });
  if (step === 10) out.push({ k: 'trail', id: th.trail });
  else if (step === 20) out.push({ k: 'aura', id: th.aura });
  else if (step === 30) out.push({ k: 'title', id: th.title });
  else if (step === 5 || step === 15 || step === 25) out.push({ k: 'item', n: 4 });
  else if (step === 2 || step === 12) out.push({ k: 'wisdom' });
  else if (step === 8 || step === 18) out.push({ k: 'luck' });
  else if (step === 11 || step === 23) out.push({ k: 'phoenix' });
  else if (step === 6 || step === 17) out.push({ k: 'candle' });
  else if (step === 3 || step === 14 || step === 26) out.push({ k: 'gem', n: 1 });
  else if (step === 9 || step === 21 || step === 27) out.push({ k: 'gold', n: 3 });
  else if (!out.length) out.push(step % 2 ? { k: 'rune', n: 1 } : { k: 'item', n: 3 });
  return out;
}

// ------------------------------------------------------------------ the daily depth
export const DELVE_TRIES = 3;
/** the daily depth opens once the hero has been a little way down */
export const DELVE_FLOOR = 3;
export const DELVE_PEARLS = 3;
/** an S brings more */
export const DELVE_S_PEARLS = 2;

export interface DelveResult {
  /** seconds from the start to the guardian's fall (or to the hero's) */
  t: number;
  grade: string;
  /** the squares of the result (the five parts of the rift and the guardian) */
  grid: string;
  /** which try it was */
  tr: number;
  dead?: boolean;
  kills: number;
}

export interface DelveDay {
  day: string;
  tries: number;
  best?: DelveResult;
  last?: DelveResult;
  /** the day's reward was given */
  paid?: boolean;
}

export function delveOpen(s: { maxFloor: number }) {
  return s.maxFloor >= DELVE_FLOOR;
}

/** today's daily depth: its number, the seed of its layout, its fate and the guardian waiting in it */
export function delveToday(now = new Date()): { n: number; day: string; seed: number; fate: FloorMod; guard: number } {
  const day = dayKey(now);
  const seed = hashText('deepwick:' + day);
  const r = new RNG(seed ^ 0x5bd1e995);
  const fate = FLOOR_MODS[Math.floor(r.next() * FLOOR_MODS.length)];
  return { n: dayNumber(now) + 1, day, seed, fate, guard: r.next() };
}

/** the hero's record of today's daily depth */
export function delveDay(s: { pearl?: PearlState }, now = new Date()): DelveDay {
  const st = pearlState(s);
  const day = dayKey(now);
  if (st.delve?.day !== day) st.delve = { day, tries: 0 };
  return st.delve;
}

/** the floor the daily depth is made for: a little above the hero's deepest (never a guardian's floor or a camp) */
export function delveFloor(s: { maxFloor: number }) {
  let f = Math.max(2, s.maxFloor - 1);
  for (let k = 0; k < 3 && (isBossFloor(f) || isCampFloor(f)); k++) f--;
  return Math.max(2, f);
}

/** the time the rift should take: some for the walk, a little for every monster that must fall, the guardian */
export function delvePar(need: number) {
  return 30 + need * 2.4 + 40;
}

export function delveGrade(t: number, par: number) {
  const r = t / par;
  return r <= 0.8 ? 'S' : r <= 1.05 ? 'A' : r <= 1.35 ? 'B' : r <= 1.8 ? 'C' : 'D';
}

/** a square of the result: green fast, yellow on time, orange slow */
export function delveSquare(t: number, par: number) {
  return t <= par ? '🟩' : t <= par * 1.6 ? '🟨' : '🟧';
}

export function mmss(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** a result is better than another (a clear beats a fall, then the faster one) */
export function delveBetter(a: DelveResult, b: DelveResult | undefined) {
  if (!b) return true;
  if (!!a.dead !== !!b.dead) return !a.dead;
  return a.dead ? a.grid.length > b.grid.length : a.t < b.t;
}

// ------------------------------------------------------------------ the newcomer's pack (for real money)
/** the last day the newcomer's pack is offered (a week from the hero's first day), or null when it is over */
export function starterUntil(st: PearlState, days: number, now = new Date()): Date | null {
  if (!st.born) return null;
  const [y, m, d] = st.born.split('-').map(Number);
  const end = new Date(y, m - 1, d + days);
  return end > now ? end : null;
}

// ------------------------------------------------------------------ the deal of the day
export interface Deal {
  id: string;
  name: string;
  desc: string;
  /** the price today and the usual one */
  price: number;
  was: number;
  give: Reward[];
  glyph: string;
  css: string;
}

/** today's deal (the same for everyone that day, a look the hero does not have yet when it is a look): one
 *  purchase a day, about forty per cent off */
export function dealToday(st: PearlState, now = new Date()): Deal {
  const r = new RNG(hashText('deal:' + dayKey(now)));
  const roll = r.next();
  if (roll < 0.4) {
    // a look: an aura, a trail or a title from the shop that the hero does not have
    const looks: { kind: 'aura' | 'trail' | 'title'; id: string; name: string; desc: string; price: number; glyph: string; css: string }[] = [
      ...AURAS.filter((a) => a.price && !(st.auras ?? []).includes(a.id)).map((a) => ({ kind: 'aura' as const, id: a.id, name: a.name, desc: a.desc, price: a.price, glyph: a.glyph, css: a.css })),
      ...TITLES.filter((t) => t.price && !(st.titles ?? []).includes(t.id)).map((t) => ({ kind: 'title' as const, id: t.id, name: t.name, desc: 'Titul nad tvým jménem – ve společné hře ho uvidí ostatní.', price: t.price, glyph: 'crown', css: t.css })),
    ];
    if (looks.length) {
      const l = looks[Math.floor(r.next() * looks.length)];
      return { id: `${l.kind}:${l.id}`, name: l.name, desc: l.desc, price: Math.max(5, Math.round((l.price * 0.6) / 5) * 5), was: l.price, give: [{ k: l.kind, id: l.id }], glyph: l.glyph, css: l.css };
    }
  }
  const DEALS: Deal[] = [
    { id: 'chest', name: 'Perlová truhla', desc: 'Jistý legendární předmět pro tvoje patro, k tomu dva drahokamy a runa.', price: 12, was: 20, give: [{ k: 'item', n: 4 }, { k: 'gem', n: 1 }, { k: 'gem', n: 1 }, { k: 'rune', n: 1 }], glyph: 'crown', css: '#ffd76a' },
    { id: 'phoenix', name: 'Dvě pírka fénixe', desc: 'Dvakrát tě vrátí do boje, když padneš. V Hardcore nefungují.', price: 30, was: 50, give: [{ k: 'phoenix' }, { k: 'phoenix' }], glyph: 'fire', css: '#ff8a4a' },
    { id: 'books', name: 'Kniha a měšec', desc: '+50 % zkušeností a +50 % magického nálezu na 10 pater.', price: 18, was: 30, give: [{ k: 'wisdom' }, { k: 'luck' }], glyph: 'eye', css: '#9fe6ff' },
    { id: 'candles', name: 'Dvě strážné svíce', desc: 'Plamen knotu přečká dva vynechané dny.', price: 12, was: 20, give: [{ k: 'candle' }, { k: 'candle' }], glyph: 'fire', css: '#ffc46a' },
    { id: 'gems', name: 'Váček drahokamů', desc: 'Tři drahokamy vyššího stupně a runa.', price: 10, was: 18, give: [{ k: 'gem', n: 1 }, { k: 'gem', n: 1 }, { k: 'gem', n: 1 }, { k: 'rune', n: 1 }], glyph: 'orb', css: '#9fe6ff' },
  ];
  return DEALS[Math.floor(r.next() * DEALS.length)];
}

/** the deal of the day can still be bought today */
export function dealOpen(st: PearlState, now = new Date()) {
  return st.deal !== dayKey(now);
}

// ------------------------------------------------------------------ codes
/** codes given out to players (stored as numbers so they do not show in the game's files): pearls and the last day */
const CODES: Record<number, { pearls: number; until: string }> = {
  [hashText('DEEPWICK')]: { pearls: 10, until: '2027-03-31' },
};

/** a code typed in: the pearls it gives, or why it gives none */
export function redeemCode(st: PearlState, raw: string, now = new Date()): number | string {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return 'Napiš kód';
  const h = hashText(code);
  const c = CODES[h];
  if (!c) return 'Tento kód neznáme';
  if (dayKey(now) > c.until) return 'Platnost kódu už vypršela';
  const used = (st.codes ??= []);
  if (used.includes(h)) return 'Tento kód už tvoje postava použila';
  used.push(h);
  return c.pearls;
}
