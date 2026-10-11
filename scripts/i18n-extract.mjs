// Collects the Czech texts of the game for translation: every string and template literal in src/ that looks
// like words for the player, split where HTML tags split them on the screen. A template's ${…} parts become
// {0}, {1} … (the translation puts them where its language wants them), and the plain pieces between them are
// kept too, so a text whose parts arrive separately still finds its words. Writes src/i18n/catalog.json:
// [{ k: text, f: files, h: what the placeholders hold }].
//   node scripts/i18n-extract.mjs
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const SKIP = new Set(['dev.ts', 'GalleryScene.ts']);

function files(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (f.endsWith('.ts') && !SKIP.has(f) && !p.includes('/i18n/')) out.push(p);
  }
  return out;
}

const CZ = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
// short Czech words without diacritics that the screen shows on their own
const WORDS = new Set(['den', 'dny', 'ano', 'ne', 'nebo', 'a', 'od', 'do', 'za', 'pro', 'patro', 'patra', 'pater', 'zlato', 'zlata', 'koupeno', 'nosit', 'vse', 'auto', 'max', 'nic', 'sila', 'boss', 'ok', 'kus', 'kusy', 'kusu', 'bod', 'body', 'bodu', 'sekundy', 'sekund', 'minuty', 'minut', 'hodin', 'hodiny', 'level', 'nove', 'nova', 'novy', 'mrtev', 'mrtva', 'padl', 'padla', 'zije', 'hotovo', 'zamceno', 'zamek', 'perla', 'perly', 'perel', 'runa', 'runy', 'run', 'dar', 'cil', 'start', 'konec', 'zpet', 'dal', 'jit', 'jdi', 'vstup', 'host', 'hra', 'hry', 'her']);

// units and short words the game writes next to numbers
const UNITS = ['s', 'min', 'zl.', 'b.', 'pole', 'polí', 'volno', 'z', 'HP/s', 'many/s', 'many', 'max', 'úr.', 'ks', 'x', 'patro', 'pater', 'patra', 'ty', 'klec', 'v', 'prosperitu', 'sestoupil', 'sestoupila', 'nepřátelsky naladěný', 'nepřátelsky naladěná', 'kvality', 'body', 'hostitel', 'padl', 'padla', 'den', 'dny', 'dní'];

/** words for the player (not an identifier, a CSS class, a key or a colour) */
function isText(t) {
  const tpl = /\{\d+\}/.test(t);
  // the words without what stands at their edges (numbers, signs, emoji)
  const s = t.replace(/\{\d+\}/g, ' ').trim().replace(/^[^\p{L}]+|[^\p{L}.!?…]+$/gu, '');
  if (!/[A-Za-zÀ-ž]/.test(s)) return false;
  // CSS, colours, function calls, keys made of parts ("gem_{0}_{1}")
  if (/[{}](?!\d+\})|^[#.][\w-]|\w:-?\d|\b\d+(px|em|rem|vh|vw|ms|deg)\b|^[a-z-]+\(|_\{|\}_|^[a-z-]+\s*:\s*[^\s;]+;|^"[^"]+",\s*\w+$/.test(t.replace(/\{\d+\}/g, '')) ) return false;
  if (/^(btn|box|row|col|hint|small|big|on|off|tab|chip|icon|bar|fill|name|cost|val|lbl|sub|note|grid|cell|slot|item|panel|overlay|head)(\s|$)/.test(s)) return false;
  if (CZ.test(s)) return true;
  // a template with any word in it (its parts are often single short words)
  if (tpl && /\p{L}{2,}/u.test(s) && !/^[a-z]+[A-Z]\w*$/.test(s)) return true;
  if (/^[#.][\w-]|^(rgba?|hsla?|url|translate|scale|rotate|var|calc|linear-gradient|radial-gradient)\(|^https?:|^data:|\.(png|svg|js|css|json|mp3|wav)\b|=>|[{};]|^\w+:\/\//.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return WORDS.has(s) || UNITS.includes(s);
  if (/^[a-z0-9_-]+(\s+[a-z0-9_-]+)*$/.test(s) && !/\s/.test(s)) return false;
  if (/_/.test(s) && !/\s/.test(s)) return false;
  // a capitalised word, or words with spaces
  if (/^[A-ZÀ-Ž][a-zà-ž]/.test(s)) return true;
  if (/[a-zà-ž]+\s+[a-zà-ž]+/i.test(s) && /[a-zà-ž]{3,}/i.test(s)) {
    // class lists ("btn small blue") and CSS ("1px solid") are not words for the player
    if (/^(btn|box|row|col|hint|small|big|on|off|tab|chip|icon|bar|fill|name|cost|val|lbl|sub|note|grid|cell|slot|item)(\s|$)/.test(s)) return false;
    if (/\b(px|em|rem|vh|vw|solid|dashed|inset|ease|linear|infinite|bold|italic|none|auto|flex|block|absolute|relative|center|nowrap|pointer|transparent)\b/.test(s)) return false;
    return true;
  }
  return /^[A-ZÀ-Ž]{2,}[!?.…]*$/.test(s) && s.length <= 12;
}

const out = new Map();
function add(k, file, hint) {
  k = k.replace(/\s+/g, ' ').trim();
  if (!k || !isText(k)) return;
  const e = out.get(k) ?? { k, f: new Set(), h: new Set() };
  e.f.add(file);
  if (hint) e.h.add(hint);
  out.set(k, e);
}

const ATTRS = /\b(?:title|placeholder|alt|aria-label|data-tip)="([^"]*)"/g;
/** the pieces of a text the screen shows: between the HTML tags, the titles in the tags, and the plain parts
 *  between the placeholders */
function pieces(text, file, hint) {
  const parts = text.split(/(<[^>]*>)/);
  for (const p of parts) {
    if (p.startsWith('<') && p.endsWith('>')) {
      for (const m of p.matchAll(ATTRS)) pieces(m[1], file, hint);
      continue;
    }
    add(p, file, hint);
    if (/\{\d+\}/.test(p)) for (const q of p.split(/\{\d+\}/)) add(q, file, '');
  }
}

/** a template literal as one text with {0}, {1} … for its ${…} parts */
function template(node, sf) {
  let s = node.head.text;
  const hints = [];
  node.templateSpans.forEach((span, i) => {
    s += `{${i}}` + span.literal.text;
    hints.push(`{${i}}=${span.expression.getText(sf).slice(0, 40)}`);
  });
  return [s, hints.join(' ')];
}

function inType(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isTypeNode(p) && !ts.isExpressionWithTypeArguments(p)) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

function skipCall(node) {
  const p = node.parent;
  if (!p || !ts.isCallExpression(p)) return false;
  const callee = p.expression.getText();
  return /^console\.|^(document\.)?querySelector|\$\$?$|^\$\(|classList\.|addEventListener|removeEventListener|getElementById|setAttribute\('class'|\.on$|\.once$|\.off$|\.emit$|^bus\.|load\.|\.image$|\.sprite$|\.texture|textures\.|\.play$|\.anims\./.test(callee);
}

// what a data property with one of these names holds is always words for the player
const SHOWN = new Set(['name', 'title', 'label', 'desc', 'text', 'noun', 'of', 'suffix', 'hint', 'msg', 'line', 'sub', 'short', 'tip', 'verb', 'what', 'where', 'adj', 'epithet', 'gen', 'plural', 'bonus', 'effect', 'note', 'quote', 'speech', 'greeting', 'bye']);
function shownProp(node) {
  const p = node.parent;
  return p && ts.isPropertyAssignment(p) && p.initializer === node && SHOWN.has(p.name.getText().replace(/['"]/g, ''));
}

for (const file of files(SRC)) {
  const rel = relative(ROOT, file);
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isStringLiteral(node) && shownProp(node) && /\p{L}{2,}/u.test(node.text) && !/_|^[a-z]+[A-Z]|^[#.]/.test(node.text)) {
      const k = node.text.replace(/\s+/g, ' ').trim();
      const e = out.get(k) ?? { k, f: new Set(), h: new Set() };
      e.f.add(rel);
      out.set(k, e);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !inType(node) && !skipCall(node)) pieces(node.text, rel, '');
    else if (ts.isTemplateExpression(node) && !inType(node) && !skipCall(node)) {
      const [s, h] = template(node, sf);
      pieces(s, rel, h);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// the names the game puts together from pieces (written by __dev.i18nNames() into src/i18n/generated.json)
try {
  for (const k of JSON.parse(readFileSync(join(SRC, 'i18n', 'generated.json'), 'utf8'))) add(k, 'generated', '');
} catch {
  /* not made yet */
}
for (const u of UNITS) out.set(u, out.get(u) ?? { k: u, f: new Set(['units']), h: new Set() });
// the page itself
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/>([^<>]+)</g)) add(m[1], 'index.html', '');

const list = [...out.values()].map((e) => ({ k: e.k, f: [...e.f].join(','), h: [...e.h].filter(Boolean).join(' | ').slice(0, 160) || undefined }));
list.sort((a, b) => a.f.localeCompare(b.f) || a.k.localeCompare(b.k));
writeFileSync(join(SRC, 'i18n', 'catalog.json'), JSON.stringify(list, null, 0).replace(/\},\{/g, '},\n{'));
const words = list.reduce((n, e) => n + e.k.split(/\s+/).length, 0);
console.log(`${list.length} texts, ${words} words, ${list.filter((e) => /\{\d+\}/.test(e.k)).length} with placeholders`);
