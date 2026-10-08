// The bestiary: every kind of monster has elements it fears and elements it shrugs off. The more of a kind
// the hero kills, the more the bestiary tells (its nature, then its weak spots, then what it carries) – and
// at last the hero masters fighting it (more damage against that kind).
import type { Element } from './types';

export interface BeastInfo {
  /** what the monster is like */
  note: string;
  weak: Element[];
  resist: Element[];
  /** what it tends to carry */
  loot: string;
}

/** damage multipliers for a weak spot and for a resistance */
export const WEAK_MULT = 1.5;
export const RESIST_MULT = 0.6;

/** kills needed to learn: its weak spots, its loot, mastery I and II */
export const KNOW_AT = { weak: 10, loot: 25, master1: 50, master2: 100 };

export const BEASTS: Record<string, BeastInfo> = {
  skeleton: { note: 'Vězni kobek, které ani smrt nepustila. Neúnavní, ale křehcí.', weak: ['holy', 'fire'], resist: ['poison', 'ice'], loot: 'Zlato, občas zbraň po padlém vojákovi.' },
  skelArcher: { note: 'Kostlivec s lukem drží odstup a střílí, dokud mu zbývá jediný šíp.', weak: ['holy', 'fire'], resist: ['poison', 'ice'], loot: 'Zlato, luky a šípy, občas prsten.' },
  bat: { note: 'Kličkuje ve tmě, kouše a zase mizí. Vadí mu hlavně blesk.', weak: ['lightning'], resist: ['poison'], loot: 'Málokdy něco – netopýři kapsy nemají.' },
  slime: { note: 'Kyselá hmota, která se po zásahu rozpadne na menší kusy.', weak: ['fire', 'ice'], resist: ['poison'], loot: 'Lektvary, které spolkl. Malé slizy nic nenesou.' },
  goblin: { note: 'Rychlý a zlodějský. V tlupě nebezpečnější, než vypadá.', weak: ['fire'], resist: [], loot: 'Hodně zlata a ukradené cetky.' },
  spider: { note: 'Skočí z dálky a otráví kousnutím. Jed mu neublíží.', weak: ['fire', 'ice'], resist: ['poison'], loot: 'Zlato a občas prsten oběti.' },
  zombie: { note: 'Pomalý a odolný. Kdo neuhne, toho rozdrtí.', weak: ['fire', 'holy'], resist: ['poison', 'ice'], loot: 'Zbroj, kterou kdysi nosil.' },
  cultist: { note: 'Služebník Nyx’thara. Metá stínové střely z bezpečné vzdálenosti.', weak: ['holy'], resist: ['shadow'], loot: 'Hole, prach a svitky.' },
  orc: { note: 'Obrněný válečník, který se rozběhne a srazí, co mu stojí v cestě.', weak: ['ice', 'lightning'], resist: [], loot: 'Těžké zbraně a zbroj, hodně zlata.' },
  imp: { note: 'Malý ohnivý skřet. Oheň ho jen pobaví, mráz ho zabije.', weak: ['ice'], resist: ['fire'], loot: 'Zlato a ohnivé runy.' },
  ghost: { note: 'Prochází zdmi. Obyčejné zbraně jím projdou jako mlhou.', weak: ['holy', 'lightning'], resist: ['phys', 'poison', 'ice'], loot: 'Prach a magické cetky.' },
  darkMage: { note: 'Povolává kostlivce a schovává se za ně. Zabij ho první.', weak: ['holy', 'phys'], resist: ['shadow'], loot: 'Hole, prach, runy kouzel.' },
  golem: { note: 'Kamenný obr s tlustým pancířem. Pomalý, ale každý jeho úder bolí.', weak: ['lightning', 'ice'], resist: ['poison', 'fire'], loot: 'Kameny na vylepšování, těžká zbroj.' },
  wraith: { note: 'Ledový přízrak, který zmrazí krev v žilách.', weak: ['fire', 'holy'], resist: ['ice', 'poison'], loot: 'Prach a mrazivé runy.' },
  mushroom: { note: 'Houbař z jeskyní. Rozprašuje jedovaté spory.', weak: ['fire'], resist: ['poison'], loot: 'Lektvary a byliny.' },
  troll: { note: 'Jeskynní troll – hora svalů. Oheň je jediné, čeho se bojí.', weak: ['fire'], resist: ['ice', 'poison'], loot: 'Hodně zlata a těžké zbraně.' },
  iceGolem: { note: 'Golem z věčného ledu. Roztaví ho jen oheň.', weak: ['fire'], resist: ['ice', 'poison'], loot: 'Kameny a mrazivé runy.' },
  frostWolf: { note: 'Loví ve smečce a jeho kousnutí mrazí.', weak: ['fire'], resist: ['ice'], loot: 'Kůže, zlato, občas mrazivý prsten.' },
  hellhound: { note: 'Pes z výhně. Jeho dech pálí, led ho ochromí.', weak: ['ice'], resist: ['fire'], loot: 'Zlato a ohnivé runy.' },
  magmaGolem: { note: 'Golem z tekoucí lávy. Kdo na něj sáhne, spálí se.', weak: ['ice'], resist: ['fire', 'poison'], loot: 'Kameny, ohnivé runy, těžká zbroj.' },
  voidEye: { note: 'Oko propasti, které vidí všechno. Světlo ho oslepí.', weak: ['holy', 'lightning'], resist: ['shadow'], loot: 'Prach a runy zkázy.' },
  shade: { note: 'Stín z propasti. Zbraně jím projdou, světlo ho rozežene.', weak: ['holy'], resist: ['shadow', 'phys'], loot: 'Prach a temné cetky.' },
  mimic: { note: 'Truhla se zuby. Kdo je chamtivý, ten na ni sáhne.', weak: ['lightning'], resist: [], loot: 'Vždy předmět – je to přece truhla.' },
  thief: { note: 'Zlatý skřet s pytlem lupu. Nikdy neútočí, jen utíká.', weak: [], resist: [], loot: 'Hromady zlata a drahokamy.' },
};

/** how a monster kind takes damage of an element */
export function elemMult(id: string, el: Element): number {
  const b = BEASTS[id];
  if (!b) return 1;
  if (b.weak.includes(el)) return WEAK_MULT;
  if (b.resist.includes(el)) return RESIST_MULT;
  return 1;
}

/** the kills of each kind */
export function bestiaryOf(s: { bestiary?: Record<string, number> }) {
  return (s.bestiary ??= {});
}

/** bonus damage against a kind the hero has mastered */
export function masteryPct(s: { bestiary?: Record<string, number> }, id: string) {
  const k = s.bestiary?.[id] ?? 0;
  return k >= KNOW_AT.master2 ? 10 : k >= KNOW_AT.master1 ? 5 : 0;
}

export const EL_NAME: Record<Element, string> = {
  phys: 'zbraně',
  fire: 'oheň',
  ice: 'mráz',
  lightning: 'blesk',
  poison: 'jed',
  holy: 'svaté světlo',
  shadow: 'stín',
};

export const EL_CSS: Record<Element, string> = {
  phys: '#e8e2cf',
  fire: '#ffa860',
  ice: '#9fe6ff',
  lightning: '#fff27a',
  poison: '#9dff7a',
  holy: '#fff6c0',
  shadow: '#d0a8ff',
};
