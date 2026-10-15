// The languages of Loppo. The game is written in Czech; another language is put on at the very last moment:
// when a text reaches the screen (an HTML panel, a label, a word floating over the map) it is looked up in the
// catalog of the language – as a whole, as a template with its numbers and names filled in, as the name of an
// item (adjective, noun and suffix put together by the grammar of the language), by its parts between dashes
// and colons, or at worst word by word. The logic of the game never sees a translation, so nothing in it can
// break, an old save works in any language, and Czech players pay nothing for it (no hooks at all).
import Phaser from 'phaser';

export interface Lang {
  id: string;
  /** the name in the language itself */
  name: string;
  /** for numbers */
  locale: string;
  /** the flag (a decoration only) */
  flag: string;
}

const catalogs = import.meta.glob<{ default: Catalog }>('./lang/*.json');

/** the languages the game can be played in (a language shows up in the menu once its catalog is there) */
export const LANGS: Lang[] = (<Lang[]>[
  { id: 'cs', name: 'Čeština', locale: 'cs-CZ', flag: '🇨🇿' },
  { id: 'en', name: 'English', locale: 'en-US', flag: '🇬🇧' },
  { id: 'de', name: 'Deutsch', locale: 'de-DE', flag: '🇩🇪' },
  { id: 'es', name: 'Español', locale: 'es-ES', flag: '🇪🇸' },
  { id: 'fr', name: 'Français', locale: 'fr-FR', flag: '🇫🇷' },
  { id: 'it', name: 'Italiano', locale: 'it-IT', flag: '🇮🇹' },
  { id: 'pl', name: 'Polski', locale: 'pl-PL', flag: '🇵🇱' },
  { id: 'pt', name: 'Português (Brasil)', locale: 'pt-BR', flag: '🇧🇷' },
  { id: 'ru', name: 'Русский', locale: 'ru-RU', flag: '🇷🇺' },
  { id: 'ja', name: '日本語', locale: 'ja-JP', flag: '🇯🇵' },
  { id: 'zh', name: '简体中文', locale: 'zh-CN', flag: '🇨🇳' },
  { id: 'ko', name: '한국어', locale: 'ko-KR', flag: '🇰🇷' },
]).filter((l) => l.id === 'cs' || !!catalogs[`./lang/${l.id}.json`]);

/** how an item's name is put together in a language: the forms of the adjectives (one, or one for each gender
 *  of the noun: m, f, n, p for a plural), the nouns (with their gender) and the suffixes, and the order of the
 *  parts – {c} cursed, {a} adjective, {n} noun, {s} suffix ("{c} {a} {n} {s}", "{n} {a} {c} {s}", "{s}{c}{a}{n}") */
export interface ItemGrammar {
  fmt: string;
  adj: Record<string, string | Record<string, string>>;
  noun: Record<string, string | { t: string; g: string }>;
  suf: Record<string, string>;
  curse: string | Record<string, string>;
}

export interface Catalog {
  t: Record<string, string>;
  items?: ItemGrammar;
}

const KEY = 'loppo-lang';
let lang = 'cs';
let locale = 'cs-CZ';

export const currentLang = () => lang;
export const langInfo = (id = lang) => LANGS.find((l) => l.id === id) ?? LANGS[0];

/** the language chosen before, or the one of the device (Slovak players read Czech; the rest get English) */
const DEV = import.meta.env.DEV || import.meta.env.MODE === 'devtools';

export function pickLang(): string {
  try {
    const s = localStorage.getItem(KEY);
    if (s && (LANGS.some((l) => l.id === s) || (DEV && s === 'xx'))) return s;
  } catch {
    /* no storage */
  }
  try {
    const nav = (navigator.languages?.[0] ?? navigator.language ?? 'cs').toLowerCase();
    const code = nav.slice(0, 2);
    if (code === 'cs' || code === 'sk') return 'cs';
    return LANGS.some((l) => l.id === code) ? code : 'en';
  } catch {
    return 'cs';
  }
}

/** remembers the language (it is put on the next time the game starts) */
export function saveLang(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* no storage */
  }
}

/** before the game starts: the language's catalog and the hooks that translate what reaches the screen */
export async function initI18n() {
  lang = pickLang();
  locale = langInfo().locale;
  document.documentElement.lang = lang;
  if (lang === 'cs') return;
  // the developer's test language: every translated text in ⟦brackets⟧, so what is left Czech stands out
  const load = DEV && lang === 'xx' ? () => fetch('./xx.json').then(async (r) => ({ default: (await r.json()) as Catalog })) : catalogs[`./lang/${lang}.json`];
  if (!load) {
    lang = 'cs';
    return;
  }
  try {
    // Cyrillic letters in pixels (the game's own font has only Latin ones)
    if (lang === 'ru') await import('@fontsource/pixelify-sans/cyrillic-400.css').catch(() => {});
    install((await load()).default);
    const { itemNameParts } = await import('../data/items');
    const p = itemNameParts();
    registerItemParts(p.adj, p.nouns);
  } catch {
    lang = 'cs';
    return;
  }
  hookDom();
  hookPhaser();
  hookNumbers();
  // the page that is already there (the loading screen, the "turn the phone" note, the title)
  translateTree(document.body);
  document.title = tr(document.title);
}

// ---------------------------------------------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------------------------------------------
interface Tpl {
  re: RegExp;
  out: string;
  lit: number;
}

const exact = new Map<string, string>();
/** the keys in small letters (a noun written with a capital at the start of a line) */
const lowerKeys = new Map<string, string>();
/** the same keys without the punctuation, numbers and symbols at their edges */
const core = new Map<string, string>();
/** single words, any case */
const words = new Map<string, string>();
const byStart = new Map<string, Tpl[]>();
const byEnd = new Map<string, Tpl[]>();
let loose: Tpl[] = [];
let grammar: ItemGrammar | null = null;
const cache = new Map<string, string>();

const LETTER = /\p{L}/u;
const EDGE = /^([\s\d\p{P}\p{S}]*)([\s\S]*?)([\s\d\p{P}\p{S}]*)$/u;
const PH = /\{(\d+)\}/g;

const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function install(cat: Catalog) {
  const tpls: Tpl[] = [];
  for (const [k0, v0] of Object.entries(cat.t)) {
    if (typeof v0 !== 'string' || !v0) continue;
    const k = norm(decode(k0));
    const v = decode(v0).trim();
    if (!k) continue;
    if (!/\{\d+\}/.test(k)) {
      exact.set(k, v);
      const lk = k.toLocaleLowerCase('cs');
      if (!lowerKeys.has(lk) || k === lk) lowerKeys.set(lk, v);
      const m = EDGE.exec(k);
      const vm = EDGE.exec(v);
      if (m && m[2] && vm && vm[2] && (m[1] || m[3])) core.set(m[2], vm[2]);
      if (!/\s/.test(k)) words.set(k.toLowerCase(), v);
      if (m && m[2] && vm && vm[2] && !/\s/.test(m[2])) words.set(m[2].toLowerCase(), vm[2]);
      continue;
    }
    const lits = k.split(/\{\d+\}/);
    const litText = lits.join('');
    if (!LETTER.test(litText)) continue;
    const order: number[] = [];
    k.replace(PH, (_, i) => (order.push(+i), ''));
    let src = '^';
    lits.forEach((l, i) => {
      src += l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (i < lits.length - 1) src += i === lits.length - 2 && !lits[lits.length - 1] ? '([\\s\\S]*)' : '([\\s\\S]*?)';
    });
    src += '$';
    // the translation refers to the placeholders by their numbers; the regex captures them in their order
    const out = v.replace(PH, (_, i) => (order.includes(+i) ? `\u0001${order.indexOf(+i)}\u0002` : ''));
    const t: Tpl = { re: new RegExp(src), out, lit: litText.length };
    tpls.push(t);
    const first = lits[0];
    const last = lits[lits.length - 1];
    if (first.length >= 2) push(byStart, first.slice(0, 2), t);
    else if (last.length >= 2) push(byEnd, last.slice(-2), t);
    else loose.push(t);
  }
  const bySpec = (a: Tpl, b: Tpl) => b.lit - a.lit;
  for (const l of byStart.values()) l.sort(bySpec);
  for (const l of byEnd.values()) l.sort(bySpec);
  loose = loose.sort(bySpec);
  grammar = cat.items ?? null;
}

function push(m: Map<string, Tpl[]>, k: string, t: Tpl) {
  const l = m.get(k);
  if (l) l.push(t);
  else m.set(k, [t]);
}

// ---------------------------------------------------------------------------------------------------------------
// Translating a text
// ---------------------------------------------------------------------------------------------------------------
/** a text for the screen in the chosen language (Czech stays as it is) */
export function tr(s: string): string {
  if (lang === 'cs' || !s || !LETTER.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const r = piece(s, 0);
  if (cache.size > 30000) cache.clear();
  cache.set(s, r);
  return r;
}

/** a piece with the white space around it kept */
function piece(s: string, depth: number): string {
  const lead = /^\s*/.exec(s)![0];
  const tail = /\s*$/.exec(s)![0];
  const body = s.slice(lead.length, s.length - tail.length);
  if (!body || !LETTER.test(body)) return s;
  const t = one(norm(body), depth);
  if (t === null) {
    miss(body);
    return s;
  }
  return lead + t + tail;
}

function one(s: string, depth: number): string | null {
  const t = exact.get(s) ?? core.get(s) ?? caseless(s);
  if (t !== undefined) return t;
  const m = EDGE.exec(s);
  if (m && (m[1] || m[3]) && m[2]) {
    const e = exact.get(m[2]) ?? core.get(m[2]) ?? caseless(m[2]);
    if (e !== undefined) return m[1] + e + m[3];
  }
  if (depth > 5) return null;
  // a building or a round of the depths with its Roman number ("Kovárna III", "Stará krypta II")
  const rn = /^(.*\S)(\s+[IVXL]{1,5})$/.exec(s);
  if (rn) {
    const b = one(rn[1], depth + 1);
    if (b !== null) return b + rn[2];
  }
  let f = template(s, depth) ?? itemName(s);
  // a template inside quotes, brackets or after a sign ("„Poraz 361 nestvůr.“", "✦ …")
  if (f === null && m && (m[1] || m[3]) && m[2]) {
    const lead = m[1];
    // what closes the text after its own full stop (quotes, brackets) is cut off, the full stop stays
    const close = /[\s“”"»’')\]]*$/.exec(m[3])![0];
    const tries: [number, number][] = [
      [lead.length, s.length],
      [0, s.length - close.length],
      [lead.length, s.length - close.length],
      [lead.length, s.length - m[3].length],
    ];
    for (const [a, b] of tries) {
      if (a === 0 && b === s.length) continue;
      const inner = s.slice(a, b);
      if (!inner) continue;
      const t = template(inner, depth) ?? (a > 0 && b < s.length ? itemName(inner) : null);
      if (t !== null) {
        f = s.slice(0, a) + t + s.slice(b);
        break;
      }
    }
  }
  if (f !== null) return f;
  // the last resorts: by parts, by words (the developer gets to know about them)
  if (depth === 0) weak(s);
  return parts(s, depth) ?? byWords(s);
}

/** the same key written with a capital (or without one): the translation follows the first letter */
function caseless(s: string): string | undefined {
  const t = lowerKeys.get(s.toLocaleLowerCase('cs'));
  if (t === undefined || !t) return t;
  const up = /^\p{Lu}/u.test(s);
  return up ? t[0].toLocaleUpperCase(locale) + t.slice(1) : t;
}

function template(s: string, depth: number): string | null {
  const lists = [byStart.get(s.slice(0, 2)), byEnd.get(s.slice(-2)), loose];
  for (const list of lists) {
    if (!list) continue;
    for (const t of list) {
      const m = t.re.exec(s);
      if (!m) continue;
      return t.out.replace(/\u0001(\d+)\u0002/g, (_, i) => {
        const v = m[+i + 1] ?? '';
        return LETTER.test(v) ? piece(v, depth + 1) : v;
      });
    }
  }
  return null;
}

/** a text made of parts (a name – a title, a label: a value, a list), each part translated */
const SEP = /(\s+[–—·|•]\s+|\s*:\s+|\s*;\s+|,\s+|\s+\/\s+|\s*\(\s*|\s*\)\s*|\s*\[\s*|\s*\]\s*|\s*\n\s*|[!?.…]\s+|\s+[+×]\s*)/;
function parts(s: string, depth: number): string | null {
  const ps = s.split(SEP);
  if (ps.length < 3) return null;
  let any = false;
  const out = ps.map((p, i) => {
    if (i % 2 === 1 || !p || !LETTER.test(p)) return p;
    const t = one(p, depth + 1);
    if (t !== null) any = true;
    return t ?? p;
  });
  return any ? out.join('') : null;
}

/** at worst word by word (a few words only: a sentence translated this way would not make sense) */
function byWords(s: string): string | null {
  const ws = s.split(/(\s+)/);
  if (ws.length > 9) return null;
  let any = false;
  const out = ws.map((w, i) => {
    if (i % 2 === 1 || !LETTER.test(w)) return w;
    const m = EDGE.exec(w)!;
    const k = m[2];
    let t = exact.get(k) ?? words.get(k.toLowerCase());
    if (t === undefined) return w;
    any = true;
    if (/^\p{Lu}/u.test(k) && !/^\p{Lu}/u.test(t)) t = t[0].toLocaleUpperCase(locale) + t.slice(1);
    return m[1] + t + m[3];
  });
  return any ? out.join('') : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The names of items: "Rezavý meč krve", "Prokletá kožená helma", "Prokletý Drakobijec"
// ---------------------------------------------------------------------------------------------------------------
let parts0: { adj: Map<string, string>; nouns: string[] } | null = null;

/** the Czech pieces the names are made of (registered by data/items.ts) */
export function registerItemParts(adjForms: Map<string, string>, nouns: string[]) {
  parts0 = { adj: adjForms, nouns: [...nouns].sort((a, b) => b.length - a.length) };
}

const CURSED = /^Proklet[ýáé] /;

function itemName(s: string): string | null {
  const g = grammar;
  if (!g || !parts0) return null;
  let rest = s;
  const cursed = CURSED.test(rest);
  if (cursed) rest = rest.replace(CURSED, '');
  // a named unique ("Prokletý Drakobijec")
  if (cursed) {
    const u = exact.get(rest);
    if (u !== undefined) return compose(g, '', { t: u, g: 'm' }, '', true);
  }
  const sp = rest.indexOf(' ');
  if (sp < 0) return null;
  const a = rest.slice(0, sp);
  const stem = parts0.adj.get(a) ?? parts0.adj.get(a[0].toUpperCase() + a.slice(1));
  if (!stem) return null;
  rest = rest.slice(sp + 1);
  const noun = parts0.nouns.find((n) => rest.toLowerCase().startsWith(n));
  if (!noun) return null;
  const suf = rest.slice(noun.length).trim();
  const nn = g.noun[noun];
  const n = typeof nn === 'string' ? { t: nn, g: 'm' } : nn ?? { t: noun, g: 'm' };
  const av = g.adj[stem];
  const adj = typeof av === 'string' ? av : av ? av[n.g] ?? av.m ?? Object.values(av)[0] : a;
  return compose(g, adj, n, suf ? g.suf[suf] ?? suf : '', cursed);
}

function compose(g: ItemGrammar, adj: string, n: { t: string; g: string }, suf: string, cursed: boolean) {
  const c = !cursed ? '' : typeof g.curse === 'string' ? g.curse : g.curse[n.g] ?? g.curse.m ?? '';
  const out = g.fmt
    .replace('{c}', c)
    .replace('{a}', adj)
    .replace('{n}', n.t)
    .replace('{s}', suf)
    .replace(/\s+/g, ' ')
    .trim();
  return out ? out[0].toLocaleUpperCase(locale) + out.slice(1) : out;
}

// ---------------------------------------------------------------------------------------------------------------
// The screen: HTML, texts of elements, titles, Phaser's texts and numbers
// ---------------------------------------------------------------------------------------------------------------
const ATTR = /\b(title|placeholder|alt|aria-label)="([^"]*)"/g;
const escHTML = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** an HTML string with its texts (and titles) translated; tags, classes and styles stay */
export function trHTML(h: string): string {
  if (lang === 'cs' || !h || !LETTER.test(h)) return h;
  let raw = 0;
  return h.replace(/(<[^>]*>)|([^<]+)/g, (m, tag: string | undefined, text: string | undefined) => {
    if (tag) {
      const low = tag.slice(0, 7).toLowerCase();
      if (low.startsWith('<style') || low.startsWith('<script') || low.startsWith('<textar')) raw++;
      else if (low.startsWith('</style') || low.startsWith('</scrip') || low.startsWith('</texta')) raw = Math.max(0, raw - 1);
      return tag.includes('="') ? tag.replace(ATTR, (a, name: string, val: string) => (LETTER.test(val) ? `${name}="${tr(decode(val)).replace(/"/g, '&quot;')}"` : a)) : tag;
    }
    if (raw || !text || !LETTER.test(text)) return m;
    const plain = decode(text);
    const t = tr(plain);
    return t === plain ? m : escHTML(t);
  });
}

function hookDom() {
  const wrap = (proto: object, prop: string, fn: (v: string, el: any) => string) => {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d?.set) return;
    const set = d.set;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set(this: any, v: any) {
        set.call(this, typeof v === 'string' ? fn(v, this) : v);
      },
    });
  };
  wrap(Element.prototype, 'innerHTML', (v) => trHTML(v));
  wrap(Element.prototype, 'outerHTML', (v) => trHTML(v));
  // the HUD compares an element's text with the Czech one it wants and sets it when they differ: an element
  // that already shows the translation is not written again
  const tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
  Object.defineProperty(Node.prototype, 'textContent', {
    configurable: true,
    enumerable: tc.enumerable,
    get: tc.get,
    set(this: Node, v: any) {
      if (typeof v !== 'string' || this.nodeName === 'STYLE' || this.nodeName === 'SCRIPT' || this.nodeName === 'TEXTAREA') return tc.set!.call(this, v);
      const t = tr(v);
      if (t !== v && tc.get!.call(this) === t) return;
      tc.set!.call(this, t);
    },
  });
  wrap(HTMLElement.prototype, 'title', (v) => tr(v));
  wrap(HTMLInputElement.prototype, 'placeholder', (v) => tr(v));
  wrap(HTMLTextAreaElement.prototype, 'placeholder', (v) => tr(v));
  const ins = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (pos: InsertPosition, html: string) {
    return ins.call(this, pos, trHTML(html));
  };
}

/** a text that is already in the language (a line written letter by letter): set without a second look-up */
export function setRaw(el: HTMLElement, text: string) {
  const f = el.firstChild;
  if (f && f.nodeType === 3 && !f.nextSibling) (f as Text).data = text;
  else el.replaceChildren(document.createTextNode(text));
}

/** the texts already on the page */
function translateTree(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (w.nextNode()) nodes.push(w.currentNode as Text);
  for (const n of nodes) if (n.parentElement && !/^(STYLE|SCRIPT|TEXTAREA)$/.test(n.parentElement.nodeName)) n.data = tr(n.data);
}

function hookPhaser() {
  const T = Phaser.GameObjects.Text.prototype as any;
  const set = T.setText;
  T.setText = function (this: any, v: any) {
    if (typeof v === 'string' || Array.isArray(v)) {
      // the game compares a label with the text it wants and sets it again when they differ: the Czech text is
      // remembered, so a translated label is not drawn again every frame
      if (this.__src === v && this._text !== undefined) return this;
      this.__src = v;
      v = Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? tr(x) : x)) : tr(v);
    }
    return set.call(this, v);
  };
}

/** numbers are written the way the language writes them (the game asks for Czech ones) */
function hookNumbers() {
  const nl = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (this: number, loc?: any, opt?: any) {
    return nl.call(this, loc === 'cs-CZ' || loc === 'cs' ? locale : loc, opt);
  };
}

// ---------------------------------------------------------------------------------------------------------------
// For the developer: the texts that found no translation
// ---------------------------------------------------------------------------------------------------------------
const misses = new Map<string, number>();
const weaks = new Map<string, number>();
/** the names of the languages stay as they are */
const OWN = new Set(LANGS.map((l) => l.name));
/** not worth a note: the languages' names, a letter of a key, a Roman number */
const quiet = (s: string) => OWN.has(s) || /^[A-Z]$|^[IVXL]{1,5}$/.test(s);
function miss(s: string) {
  if (misses.size < 5000 && !quiet(s)) misses.set(s, (misses.get(s) ?? 0) + 1);
}
function weak(s: string) {
  if (weaks.size < 5000 && !quiet(s)) weaks.set(s, (weaks.get(s) ?? 0) + 1);
}
/** texts with no translation at all, and texts translated only by their parts or words */
export const i18nMisses = () => ({ none: [...misses.entries()].sort((a, b) => b[1] - a[1]), weak: [...weaks.entries()].sort((a, b) => b[1] - a[1]) });
