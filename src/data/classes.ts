import { AttrKey, ClassId, Stats } from './types';

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  style: string;
  weapon: string; // base id of starting weapon
  offhand?: string;
  attrs: Partial<Record<AttrKey, number>>; // starting attribute bonus
  passive: string;
  passiveStats: Stats;
  // visual
  head: 'helm' | 'hood' | 'wizard' | 'paladin' | 'horned' | 'antlers' | 'bald' | 'feathers';
  body: 'armor' | 'robe';
  pal: Record<string, string>;
}

const OUT = '#16121c';

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Bojovník',
    desc: 'Odolný válečník v těžkém brnění. Meč a štít, silné údery a ochranné schopnosti.',
    style: 'Boj zblízka • tank',
    weapon: 'sword',
    offhand: 'shield',
    attrs: { str: 5, vit: 5 },
    passive: '+15 % brnění, +10 % maximálních HP',
    passiveStats: { hpPct: 10 },
    head: 'helm',
    body: 'armor',
    pal: { h: '#9aa3ad', j: '#5d6670', i: '#dfe5ea', c: '#2f5fa8', v: '#1d3c74', w: '#4f80cf', u: '#2a9d8f', a: '#e9b949', l: '#6b4423', p: '#3b3f4a', q: '#2a2d36', b: '#4a3222', g: '#9aa3ad', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a' },
  },
  {
    id: 'assassin',
    name: 'Assassin',
    desc: 'Smrtící stín s dýkami. Rychlé útoky, kritické zásahy, jedy a neviditelnost.',
    style: 'Boj zblízka • kritické zásahy',
    weapon: 'dagger',
    offhand: 'dagger',
    attrs: { dex: 6, spd: 4 },
    passive: '+8 % šance na kritický zásah, +25 % kritického poškození',
    passiveStats: { crit: 8, critDmg: 25 },
    head: 'hood',
    body: 'armor',
    pal: { h: '#3a2f4a', j: '#241c30', i: '#54476a', c: '#2b2433', v: '#1a1520', w: '#3f3550', u: '#b0263a', a: '#b0263a', l: '#3b2a20', p: '#231d2a', q: '#15111a', b: '#1c1620', g: '#3a2f4a', s: '#e8b48f', d: '#a87a5c', e: '#ff4d6d', m: '#1a1520' },
  },
  {
    id: 'ranger',
    name: 'Lučišník',
    desc: 'Mistr luku, který útočí z velké vzdálenosti. Pasti, šípy a zvířecí společníci.',
    style: 'Na dálku • fyzické poškození',
    weapon: 'bow',
    attrs: { dex: 7, spd: 3 },
    passive: '+20 % dosah střelby, +10 % poškození na dálku',
    passiveStats: { range: 20 },
    head: 'hood',
    body: 'armor',
    pal: { h: '#3f7a3a', j: '#2a5527', i: '#5ea356', c: '#7a5532', v: '#55391f', w: '#9a7046', u: '#3f7a3a', a: '#d8b35a', l: '#4a2f1a', p: '#4b3b2a', q: '#33281c', b: '#3b2716', g: '#7a5532', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a' },
  },
  {
    id: 'mage',
    name: 'Mág',
    desc: 'Vládce živlů. Ohnivé koule, led a blesky ničí nepřátele z dálky.',
    style: 'Kouzla • plošné poškození',
    weapon: 'staff',
    attrs: { int: 7, ene: 3 },
    passive: '+15 % poškození kouzel, +20 maximální many',
    passiveStats: { spellDmg: 15, mp: 20 },
    head: 'wizard',
    body: 'robe',
    pal: { h: '#3b4fc4', j: '#26348a', i: '#5d71e6', c: '#3b4fc4', v: '#26348a', w: '#5d71e6', u: '#3b4fc4', a: '#f2c94c', l: '#f2c94c', p: '#26348a', q: '#1a2466', b: '#2a1f18', g: '#f1c39b', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a', y: '#e8e8f0' },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    desc: 'Svatý rytíř. Kombinuje boj zblízka se světelnou magií a léčením.',
    style: 'Boj zblízka • léčení',
    weapon: 'mace',
    offhand: 'shield',
    attrs: { str: 4, vit: 3, int: 3 },
    passive: '+1 % HP/s regenerace, +10 % poškození kouzel',
    passiveStats: { spellDmg: 10, hpRegen: 1 },
    head: 'paladin',
    body: 'armor',
    pal: { h: '#e3e7ec', j: '#9aa3ad', i: '#ffffff', c: '#f2efe6', v: '#c9c3b3', w: '#ffffff', u: '#e9b949', a: '#e9b949', l: '#8a5a2b', p: '#b8b2a2', q: '#8d8879', b: '#6b4a2b', g: '#e3e7ec', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a', r: '#d1342f' },
  },
  {
    id: 'necro',
    name: 'Nekromant',
    desc: 'Pán mrtvých. Vyvolává kostlivce a golemy, vysává život a šíří mor.',
    style: 'Vyvolávání • temná magie',
    weapon: 'wand',
    offhand: 'orb',
    attrs: { int: 6, ene: 4 },
    passive: 'Vyvolaní spojenci mají +30 % poškození a HP',
    passiveStats: { spellDmg: 5 },
    head: 'hood',
    body: 'robe',
    pal: { h: '#1f2a24', j: '#121a16', i: '#33473b', c: '#1f2a24', v: '#121a16', w: '#33473b', u: '#1f2a24', a: '#7bd88f', l: '#5a5a5a', p: '#121a16', q: '#0b100d', b: '#1b1b1b', g: '#cfc9b8', s: '#b8c2b0', d: '#7f8a79', e: '#7bff9a', m: '#121a16' },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    desc: 'Divoký válečník se dvěma sekerami. Čím víc je zraněný, tím víc ničí.',
    style: 'Boj zblízka • zuřivost',
    weapon: 'axe',
    offhand: 'axe',
    attrs: { str: 6, spd: 4 },
    passive: '+1 % poškození za každá 2 % chybějícího HP',
    passiveStats: { lifesteal: 2 },
    head: 'horned',
    body: 'armor',
    pal: { h: '#6b6f78', j: '#43464d', i: '#9aa0aa', c: '#e0a982', v: '#b97f5a', w: '#f1c39b', u: '#7a5532', a: '#a8321e', l: '#4a2f1a', p: '#5a3b2a', q: '#3e281c', b: '#3b2716', g: '#e0a982', s: '#e8b48f', d: '#b98260', e: '#1b1b2a', y: '#efe6d0', f: '#b8461d' },
  },
  {
    id: 'druid',
    name: 'Druid',
    desc: 'Strážce přírody. Vyvolává vlky a medvědy, léčí se a ovládá bouře.',
    style: 'Vyvolávání • příroda',
    weapon: 'staff',
    attrs: { int: 5, vit: 5 },
    passive: '+1,5 HP/s regenerace, vyvolaní spojenci +20 % HP',
    passiveStats: { hpRegen: 1.5 },
    head: 'antlers',
    body: 'robe',
    pal: { h: '#4f7f3a', j: '#365a27', i: '#6fa356', c: '#5e7a3a', v: '#3f5527', w: '#7a9a50', u: '#5e7a3a', a: '#c9a255', l: '#6b4423', p: '#3f5527', q: '#2b3b1b', b: '#4a3222', g: '#f1c39b', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a', y: '#8b5a2b' },
  },
  {
    id: 'monk',
    name: 'Mnich',
    desc: 'Mistr bojových umění. Bleskové údery pěstí, chi energie a úhyby.',
    style: 'Boj zblízka • rychlost',
    weapon: 'knuckle',
    offhand: 'knuckle',
    attrs: { dex: 5, spd: 3, vit: 2 },
    passive: '+8 % úhyb, +10 % rychlost pohybu',
    passiveStats: { dodge: 8, move: 10 },
    head: 'bald',
    body: 'robe',
    pal: { h: '#e88a1a', j: '#b5650c', i: '#ffae4a', c: '#e88a1a', v: '#b5650c', w: '#ffae4a', u: '#e88a1a', a: '#c0392b', l: '#c0392b', p: '#b5650c', q: '#8a4b08', b: '#3b2716', g: '#f1c39b', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a' },
  },
  {
    id: 'shaman',
    name: 'Šaman',
    desc: 'Mluví s duchy a živly. Totemy, řetězové blesky a duchovní vlci.',
    style: 'Kouzla • totemy',
    weapon: 'mace',
    offhand: 'orb',
    attrs: { int: 5, str: 2, ene: 3 },
    passive: '+20 % poškození blesky, totemy vydrží o 20 % déle',
    passiveStats: { spellDmg: 8 },
    head: 'feathers',
    body: 'robe',
    pal: { h: '#22303c', j: '#151e26', i: '#35495a', c: '#2a7f8f', v: '#1c5862', w: '#3ea3b5', u: '#2a7f8f', a: '#f2c94c', l: '#6b4423', p: '#1c5862', q: '#133e45', b: '#4a3222', g: '#c98f6b', s: '#c98f6b', d: '#9a6a4c', e: '#1b1b2a', f: '#e84a3f', r: '#ffffff' },
  },
];

export const CLASS_BY_ID: Record<ClassId, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;

export const OUTLINE = OUT;
