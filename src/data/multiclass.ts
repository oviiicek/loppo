// Multiclass: from level 100 a hero may take up a second class - one of its spells in a normal slot, a
// limited share of its talent tree and half of its passive - and earns a title for the pair
// (warrior + mage = Battlemage, assassin + mage = Shadow mage, ranger + assassin = Strider ...).
import type { ClassId } from './types';

export const MULTI_LEVEL = 100;
export const MULTI_COST = 25000;
/** talent points that may go into the second class's tree */
export const MULTI_TALENT_CAP = 12;

const TITLES: Record<string, string> = {
  'assassin+warrior': 'Gladiátor',
  'ranger+warrior': 'Strážce hranic',
  'mage+warrior': 'Bitevní mág',
  'paladin+warrior': 'Křižák',
  'necro+warrior': 'Rytíř smrti',
  'berserker+warrior': 'Válečný pán',
  'druid+warrior': 'Strážce hvozdu',
  'monk+warrior': 'Mistr zbraní',
  'shaman+warrior': 'Náčelník',
  'assassin+ranger': 'Hraničář',
  'assassin+mage': 'Stínový mág',
  'assassin+paladin': 'Inkvizitor',
  'assassin+necro': 'Kat duší',
  'assassin+berserker': 'Řezník',
  'assassin+druid': 'Stínový lovec',
  'assassin+monk': 'Tichý mistr',
  'assassin+shaman': 'Proklínač',
  'mage+ranger': 'Arkánní střelec',
  'paladin+ranger': 'Lovec démonů',
  'necro+ranger': 'Temný lovec',
  'berserker+ranger': 'Divoch',
  'druid+ranger': 'Strážce divočiny',
  'monk+ranger': 'Poutník',
  'ranger+shaman': 'Lovec bouří',
  'mage+paladin': 'Světlonoš',
  'mage+necro': 'Černokněžník',
  'berserker+mage': 'Zuřivý mág',
  'druid+mage': 'Elementalista',
  'mage+monk': 'Mystik',
  'mage+shaman': 'Vyvolávač bouří',
  'necro+paladin': 'Padlý rytíř',
  'berserker+paladin': 'Fanatik',
  'druid+paladin': 'Strážce života',
  'monk+paladin': 'Templář',
  'paladin+shaman': 'Prorok',
  'berserker+necro': 'Krvavý kat',
  'druid+necro': 'Druid rozkladu',
  'monk+necro': 'Mnich smrti',
  'necro+shaman': 'Mluvčí mrtvých',
  'berserker+druid': 'Vlkodlak',
  'berserker+monk': 'Rváč',
  'berserker+shaman': 'Válečný šaman',
  'druid+monk': 'Poustevník',
  'druid+shaman': 'Kmenový mudrc',
  'monk+shaman': 'Duchovní mistr',
};

/** the title of a pair of classes (order does not matter) */
export function multiTitle(a: ClassId, b: ClassId) {
  return TITLES[[a, b].sort().join('+')] ?? 'Mistr dvou cest';
}
