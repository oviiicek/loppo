// Nemeses. A champion that kills the hero may take a name and a title ("Grak, Zabiják Oviho"), grows
// stronger and comes back a few floors later. Every further victory over the hero makes it stronger
// still; beating it pays a rich reward.
import type { ClassId } from './types';
import { CLASS_BY_ID } from './classes';

export interface Nemesis {
  id: number;
  /** its own name ("Grak") */
  name: string;
  /** the title it earned ("Zabiják Oviho") */
  title: string;
  /** the monster it is (enemy id) and its champion trait */
  base: string;
  affix: string | null;
  /** the level shown with its name */
  level: number;
  /** how many times it has killed the hero */
  kills: number;
  /** floor of its first victory */
  born: number;
  /** the earliest floor it can show up on again */
  next: number;
  /** floors it showed up on without being beaten */
  met?: number;
}

/** at most this many nemeses wait for the hero at once (a new one pushes out the oldest) */
export const NEMESIS_MAX = 4;

const START = ['Gr', 'Sk', 'Mor', 'Vr', 'Zul', 'Kr', 'Dr', 'Ug', 'Th', 'Bal', 'Naz', 'Gor', 'Rak', 'Xar', 'Vol', 'Mag', 'Ush', 'Kar', 'Zor', 'Br'];
const VOWEL = ['a', 'o', 'u', 'a', 'u', 'e'];
const END1 = ['k', 'g', 'th', 'z', 'rk', 'rg', 'sh', 'x', 'n', 'r', 'm', 'kk'];
const END2 = ['nar', 'gul', 'rok', 'mak', 'dur', 'ash', 'rax', 'vos', 'gor', 'zak', 'lug', 'nek'];

/** a short, rough monster name ("Grak", "Skurg", "Zularax") */
export function nemesisName(rnd = Math.random): string {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const n = pick(START) + pick(VOWEL) + (rnd() < 0.55 ? pick(END1) : pick(END2));
  return n.slice(0, 9);
}

const SOFT = 'žščřcjďťňŽŠČŘCJĎŤŇ';

/** a Czech genitive of a hero's name, good enough for titles ("Ovi" → "Oviho", "Petr" → "Petra") */
export function genitive(name: string): string {
  const n = name.trim();
  if (!n) return n;
  const last = n[n.length - 1];
  const lower = n.toLowerCase();
  if (/[iíyý]$/.test(lower)) return n + 'ho';
  if (last === 'a' || last === 'A') {
    const c = n[n.length - 2] ?? '';
    // "Táňa" → "Táni" (ň, ť, ď lose the caron before i)
    const plain: Record<string, string> = { ň: 'n', ť: 't', ď: 'd' };
    if (plain[c]) return n.slice(0, -2) + plain[c] + 'i';
    return n.slice(0, -1) + (SOFT.includes(c) ? 'i' : 'y');
  }
  if (/o$/i.test(n)) return n.slice(0, -1) + 'a';
  if (/e$|ě$|u$|ů$/i.test(n)) return n;
  if (/ek$/i.test(n) && n.length > 3) return n.slice(0, -2) + 'ka';
  if (/[^ia]el$/i.test(n) && n.length > 3) return n.slice(0, -2) + 'la';
  if (SOFT.includes(last)) return n + 'e';
  if (/[a-zá-ž]$/i.test(n)) return n + 'a';
  return n;
}

/** whose killer it is: the hero's name, or the class ("paladinů") */
export function victimOf(heroName: string | undefined, cls: ClassId) {
  if (heroName?.trim()) return genitive(heroName);
  return CLASS_BY_ID[cls].name.toLowerCase() + 'ů';
}

const TITLES = ['Zabiják', 'Postrach', 'Kat', 'Lovec', 'Přemožitel', 'Trýznitel'];

export function nemesisTitle(victim: string, kills: number, rnd = Math.random) {
  if (kills >= 3) return `Noční můra ${victim}`;
  return `${TITLES[Math.floor(rnd() * TITLES.length)]} ${victim}`;
}

/** how much tougher it is than a plain champion of the floor */
export function nemesisPower(n: Nemesis) {
  const k = Math.max(0, n.kills - 1);
  return { hp: Math.min(3.6, 1.6 + 0.4 * k), dmg: Math.min(1.8, 1.2 + 0.12 * k), speed: 1.08 };
}

/** a hero's name as typed: no markup characters, single spaces, at most 14 letters */
export function cleanName(s: string) {
  return s
    .replace(/[<>&"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14);
}

/** the full name shown above it and in the announcement */
export function nemesisLabel(n: Nemesis) {
  return `${n.name}, ${n.title}`;
}
