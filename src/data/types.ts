// Shared type definitions.

export type AttrKey = 'str' | 'dex' | 'vit' | 'ene' | 'int' | 'spd';

export const ATTR_KEYS: AttrKey[] = ['str', 'dex', 'vit', 'ene', 'int', 'spd'];

export const ATTR_NAMES: Record<AttrKey, string> = {
  str: 'Síla',
  dex: 'Obratnost',
  vit: 'Zdraví',
  ene: 'Mana',
  int: 'Magická síla',
  spd: 'Rychlost útoku',
};

export const ATTR_DESC: Record<AttrKey, string> = {
  str: '+2,5 % poškození zbraní na blízko, +2 HP',
  dex: '+2,5 % poškození zbraní na dálku, +0,15 % kritický zásah, +0,1 % úhyb',
  vit: '+12 maximálních HP, +0,05 HP/s',
  ene: '+8 maximální many, +0,08 many/s',
  int: '+3 % poškození kouzel a magických zbraní',
  spd: '+1,5 % rychlosti útoku',
};

// Every stat an item / buff can modify.
export type StatKey =
  | AttrKey
  | 'hp'
  | 'mp'
  | 'hpPct'
  | 'dmg'
  | 'dmgPct'
  | 'armor'
  | 'crit'
  | 'critDmg'
  | 'lifesteal'
  | 'manaOnHit'
  | 'hpRegen'
  | 'mpRegen'
  | 'move'
  | 'cdr'
  | 'spellDmg'
  | 'gold'
  | 'magicFind'
  | 'thorns'
  | 'dodge'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'poison'
  | 'block'
  | 'xp'
  | 'atkSpdPct'
  | 'range';

export type Stats = Partial<Record<StatKey, number>>;

export type Element = 'phys' | 'fire' | 'ice' | 'lightning' | 'poison' | 'holy' | 'shadow';

export type Slot =
  | 'main'
  | 'off'
  | 'helmet'
  | 'chest'
  | 'pants'
  | 'belt'
  | 'boots'
  | 'ring1'
  | 'ring2'
  | 'amulet'
  | 'bracer';

export const SLOT_NAMES: Record<Slot, string> = {
  main: 'Pravá ruka',
  off: 'Levá ruka',
  helmet: 'Helma',
  chest: 'Brnění',
  pants: 'Kalhoty',
  belt: 'Opasek',
  boots: 'Boty',
  ring1: 'Prsten 1',
  ring2: 'Prsten 2',
  amulet: 'Náhrdelník',
  bracer: 'Náramek',
};

export type ItemCategory =
  | 'weapon1h'
  | 'weapon2h'
  | 'shield'
  | 'offhand'
  | 'helmet'
  | 'chest'
  | 'pants'
  | 'belt'
  | 'boots'
  | 'ring'
  | 'amulet'
  | 'bracer';

export type AttackKind = 'melee' | 'ranged' | 'magic';

export interface Affix {
  key: StatKey;
  value: number;
}

export interface Item {
  uid: string;
  base: string; // id of base type
  name: string;
  rarity: number; // 0..5
  ilvl: number;
  upgrade: number; // +0..+10
  affixes: Affix[];
  specials: string[]; // ids of special effects
  enchant?: Affix | null;
  /** a piece of an item set: "setId:piece" */
  set?: string;
  /** gem sockets: a gem key ("ruby3") or null for an empty one */
  sockets?: (string | null)[];
  // rolled base values
  dmgMin?: number;
  dmgMax?: number;
  armor?: number;
  block?: number;
}

export type ClassId =
  | 'warrior'
  | 'assassin'
  | 'ranger'
  | 'mage'
  | 'paladin'
  | 'necro'
  | 'berserker'
  | 'druid'
  | 'monk'
  | 'shaman';
