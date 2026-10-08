import type { Nemesis } from '../data/nemesis';
import type { MercState } from '../data/mercs';
import { ATTR_KEYS, AttrKey, ClassId, Item, Slot, StatKey, Stats } from '../data/types';
import { DEFAULT_DIFFICULTY } from '../data/difficulty';
import { CLASS_BY_ID } from '../data/classes';
import { BASE_BY_ID, generateItem, itemStats, weaponDamage, isTwoHanded } from '../data/items';
import { SPELL_BY_ID, spellsForClass, MAX_SPELL_RANK, BuffMods } from '../data/spells';
import { bus } from './events';
import { StoryState, newStory } from '../data/story';
import { PetState, newPetState, PET_BY_ID, petLevel } from '../data/pets';
import { addSetBonuses } from '../data/sets';

export const INVENTORY_SIZE = 30;
export const STASH_SIZE = 42;
export const ATTR_POINTS_PER_LEVEL = 3;
export const SPELL_POINTS_PER_LEVEL = 1;

export interface Materials {
  hpPotion: number;
  mpPotion: number;
  lockpick: number;
  stone: number;
  dust: number;
}

export interface SaveData {
  version: number;
  cls: ClassId;
  level: number;
  xp: number;
  attrs: Record<AttrKey, number>;
  attrPoints: number;
  spellPoints: number;
  spellRanks: Record<string, number>; // invested points per spell id
  loadout: (string | null)[]; // [n1, n2, n3, ult, universal]
  equip: Partial<Record<Slot, Item | null>>;
  inventory: (Item | null)[];
  gold: number;
  mats: Materials;
  floor: number;
  maxFloor: number;
  kills: number;
  merchantPity: number;
  classChanges: number;
  playTime: number;
  stash?: (Item | null)[];
  slot?: number;
  stats?: { bosses?: number; chests?: number; secrets?: number; locks?: number; maxUpgrade?: number; bestRarity?: number; deaths?: number; thieves?: number; cursed?: number; bounties?: number; elites?: number; goldEarned?: number; potions?: number; maxHit?: number; items?: number; gemsSet?: number; bestGem?: number; streak?: number; nemeses?: number; rivals?: number; transmutes?: number };
  achievements?: string[];
  story?: StoryState;
  /** combat difficulty (index into DIFFICULTIES, normal when missing) */
  difficulty?: number;
  /** a hardcore hero is erased when they die */
  hardcore?: boolean;
  /** set on a hardcore hero's death: the save must never be written again */
  fallen?: boolean;
  /** freed pets, the one that comes along and how far each has travelled */
  pets?: PetState;
  /** the gem pouch: how many of each gem ("ruby3": 2) */
  gems?: Record<string, number>;
  /** the rune pouch ("fire2": 1) */
  runes?: Record<string, number>;
  /** the hero's own name (optional; nemeses are named after it) */
  heroName?: string;
  /** champions that killed the hero and wait for them deeper down */
  nemeses?: Nemesis[];
  /** the hired companion (its role, name, gear and order) */
  merc?: MercState;
}

export function gemPouch(s: SaveData): Record<string, number> {
  return s.gems ?? (s.gems = {});
}

export function runePouch(s: SaveData): Record<string, number> {
  return s.runes ?? (s.runes = {});
}

export function addRune(s: SaveData, key: string, n = 1) {
  const p = runePouch(s);
  p[key] = (p[key] ?? 0) + n;
  if (p[key] <= 0) delete p[key];
}

export function addGem(s: SaveData, key: string, n = 1) {
  const p = gemPouch(s);
  p[key] = (p[key] ?? 0) + n;
  if (p[key] <= 0) delete p[key];
}

/** an item leaves the hero (sold, salvaged): its gems go back to the pouch; true if there were any */
export function returnGems(s: SaveData, it: Item): boolean {
  let any = false;
  if (it.runes)
    it.runes = it.runes.map((r) => {
      if (r) {
        addRune(s, r);
        any = true;
      }
      return null;
    });
  if (!it.sockets) return any;
  it.sockets = it.sockets.map((g) => {
    if (g) {
      addGem(s, g);
      any = true;
    }
    return null;
  });
  return any;
}

/** the pets of a character (older saves get the record on first use) */
export function petsOf(s: SaveData): PetState {
  return s.pets ?? (s.pets = newPetState());
}

/** story progress of a character (older saves get it on first use) */
export function storyOf(s: SaveData): StoryState {
  return s.story ?? (s.story = newStory());
}

/** permanent bonus of the seal shards and Elara's blessing, in percent */
export function storyBonusPct(s: SaveData) {
  const st = s.story;
  return st ? st.shards * 4 + (st.blessing ? 10 : 0) : 0;
}

export function bumpStat(s: SaveData, key: keyof NonNullable<SaveData['stats']>, by = 1) {
  const st = s.stats ?? (s.stats = {});
  st[key] = (st[key] ?? 0) + by;
}

export function maxStat(s: SaveData, key: keyof NonNullable<SaveData['stats']>, v: number) {
  const st = s.stats ?? (s.stats = {});
  st[key] = Math.max(st[key] ?? 0, v);
}

export function xpForLevel(level: number) {
  return Math.round(25 * Math.pow(level, 1.75) + 35);
}

export function newCharacterAttrs(cls: ClassId): Record<AttrKey, number> {
  const def = CLASS_BY_ID[cls];
  const attrs = { str: 5, dex: 5, vit: 5, ene: 5, int: 5, spd: 0 } as Record<AttrKey, number>;
  for (const [k, v] of Object.entries(def.attrs)) attrs[k as AttrKey] += v as number;
  return attrs;
}

export function newCharacter(cls: ClassId, opts: { difficulty?: number; hardcore?: boolean } = {}): SaveData {
  const def = CLASS_BY_ID[cls];
  const attrs = newCharacterAttrs(cls);
  const s: SaveData = {
    version: 1,
    cls,
    level: 1,
    xp: 0,
    attrs,
    attrPoints: 0,
    spellPoints: 0,
    spellRanks: {},
    loadout: [null, null, null, null, null],
    equip: {},
    inventory: new Array(INVENTORY_SIZE).fill(null),
    gold: 50,
    mats: { hpPotion: 3, mpPotion: 2, lockpick: 1, stone: 0, dust: 0 },
    floor: 1,
    maxFloor: 1,
    kills: 0,
    merchantPity: 0,
    classChanges: 0,
    playTime: 0,
    story: newStory(),
    difficulty: opts.difficulty ?? DEFAULT_DIFFICULTY,
    hardcore: !!opts.hardcore,
  };
  s.equip.main = generateItem(1, { base: def.weapon, rarity: 0 });
  if (def.offhand) s.equip.off = generateItem(1, { base: def.offhand, rarity: 0 });
  s.equip.chest = generateItem(1, { base: 'chest', rarity: 0 });
  autoLoadout(s);
  return s;
}

// Fill empty loadout slots with unlocked spells.
export function autoLoadout(s: SaveData) {
  const cls = spellsForClass(s.cls).filter((sp) => sp.lvl <= s.level);
  const normals = cls.filter((sp) => !sp.ult);
  const ults = cls.filter((sp) => sp.ult);
  for (let i = 0; i < 3; i++) {
    if (!s.loadout[i]) {
      const next = normals.find((sp) => !s.loadout.includes(sp.id));
      if (next) s.loadout[i] = next.id;
    }
  }
  if (!s.loadout[3] && ults.length) s.loadout[3] = ults[ults.length - 1].id;
  if (!s.loadout[4]) {
    const uni = spellsForClass('universal').filter((sp) => sp.lvl <= s.level);
    if (uni.length) s.loadout[4] = uni[0].id;
  }
}

export function spellRank(s: SaveData, id: string) {
  const sp = SPELL_BY_ID[id];
  if (!sp || sp.lvl > s.level) return 0;
  return 1 + (s.spellRanks[id] ?? 0);
}

export function canInvest(s: SaveData, id: string) {
  const sp = SPELL_BY_ID[id];
  if (!sp || sp.lvl > s.level || s.spellPoints <= 0) return false;
  return (s.spellRanks[id] ?? 0) < MAX_SPELL_RANK - 1;
}

export function changeClass(s: SaveData, cls: ClassId) {
  // refund points invested in old class spells (universal spells stay)
  let refund = 0;
  for (const [id, pts] of Object.entries(s.spellRanks)) {
    const sp = SPELL_BY_ID[id];
    if (sp && sp.cls !== 'universal') {
      refund += pts;
      delete s.spellRanks[id];
    }
  }
  s.spellPoints += refund;
  // swap class attribute bonus
  const oldDef = CLASS_BY_ID[s.cls];
  const newDef = CLASS_BY_ID[cls];
  for (const [k, v] of Object.entries(oldDef.attrs)) s.attrs[k as AttrKey] -= v as number;
  for (const [k, v] of Object.entries(newDef.attrs)) s.attrs[k as AttrKey] += v as number;
  s.cls = cls;
  const uni = s.loadout[4];
  s.loadout = [null, null, null, null, uni];
  // universal spells may also stay in normal slots: keep only universal slot
  autoLoadout(s);
  s.classChanges++;
  return refund;
}

export function classChangeCost(s: SaveData) {
  return Math.round(300 + s.level * s.level * 18 + s.classChanges * 500);
}

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------
export interface Derived {
  maxHp: number;
  maxMp: number;
  hpRegen: number;
  mpRegen: number;
  armor: number;
  dmgMin: number;
  dmgMax: number;
  aps: number;
  range: number;
  arc: number;
  attack: 'melee' | 'ranged' | 'magic';
  crit: number;
  critDmg: number;
  dodge: number;
  block: number;
  lifesteal: number;
  manaOnHit: number;
  move: number;
  cdr: number;
  spellMult: number;
  gold: number;
  magicFind: number;
  thorns: number;
  xp: number;
  elem: { fire: number; ice: number; lightning: number; poison: number };
  dual: boolean;
  specials: Set<string>;
  attrs: Record<AttrKey, number>;
  weaponBase: string;
  offBase: string | null;
}

export function gearStats(s: SaveData): { stats: Stats; specials: Set<string> } {
  const stats: Stats = {};
  const specials = new Set<string>();
  const add = (k: StatKey, v: number) => (stats[k] = (stats[k] ?? 0) + v);
  for (const it of Object.values(s.equip)) {
    if (!it) continue;
    const st = itemStats(it);
    for (const [k, v] of Object.entries(st)) add(k as StatKey, v as number);
    it.specials.forEach((x) => specials.add(x));
  }
  const cdef = CLASS_BY_ID[s.cls];
  for (const [k, v] of Object.entries(cdef.passiveStats)) add(k as StatKey, v as number);
  // pieces of item sets worn together
  addSetBonuses(s.equip, add, specials);
  // the pet that travels with the hero
  const pet = s.pets?.active ? PET_BY_ID[s.pets.active] : null;
  if (pet) for (const [k, v] of Object.entries(pet.stats(petLevel(s.pets!, pet.id)))) add(k as StatKey, v as number);
  return { stats, specials };
}

export function derive(s: SaveData, buffs: BuffMods[] = []): Derived {
  const { stats, specials } = gearStats(s);
  const g = (k: StatKey) => stats[k] ?? 0;
  const attrs = {} as Record<AttrKey, number>;
  for (const k of ATTR_KEYS) attrs[k] = s.attrs[k] + g(k);
  const b = (k: keyof BuffMods) => buffs.reduce((a, m) => a + ((m[k] as number) ?? 0), 0);

  const main = s.equip.main ?? null;
  const off = s.equip.off ?? null;
  const mainBase = main ? BASE_BY_ID[main.base] : null;
  const offBase = off ? BASE_BY_ID[off.base] : null;
  const dual = !!(mainBase && offBase && offBase.cat === 'weapon1h');

  let dmgMin = 2,
    dmgMax = 4,
    aps = 1.6,
    range = 22,
    arc = 90;
  let attack: Derived['attack'] = 'melee';
  if (main && mainBase) {
    [dmgMin, dmgMax] = weaponDamage(main);
    aps = mainBase.aps ?? 1;
    range = mainBase.range ?? 24;
    arc = mainBase.arc ?? 100;
    attack = mainBase.attack ?? 'melee';
  }
  if (dual && off && offBase) {
    const [a, bb] = weaponDamage(off);
    // dual wield: average both weapons, +15 % attack speed
    dmgMin = Math.round((dmgMin + a) / 2);
    dmgMax = Math.round((dmgMax + bb) / 2);
    aps = ((aps + (offBase.aps ?? 1)) / 2) * 1.15;
  }
  const flat = g('dmg');
  dmgMin += flat;
  dmgMax += flat;
  let attrMult = 1;
  if (attack === 'melee') attrMult += attrs.str * 0.025;
  else if (attack === 'ranged') attrMult += attrs.dex * 0.025;
  else attrMult += attrs.int * 0.03;
  const storyPct = storyBonusPct(s);
  let dmgPct = g('dmgPct') + b('dmgPct') + storyPct;
  if (s.cls === 'ranger' && attack === 'ranged') dmgPct += 10;
  const mult = attrMult * (1 + dmgPct / 100);
  dmgMin = Math.max(1, Math.round(dmgMin * mult));
  dmgMax = Math.max(dmgMin, Math.round(dmgMax * mult));

  aps *= 1 + attrs.spd * 0.015 + (g('atkSpdPct') + b('atkSpdPct')) / 100;
  aps = Math.min(aps, 6);
  if (attack !== 'melee') range *= 1 + (g('range') + b('range')) / 100;

  let armor = g('armor');
  armor *= 1 + b('armorPct') / 100 + (s.cls === 'warrior' ? 0.15 : 0);

  const maxHp = Math.round((80 + attrs.vit * 12 + attrs.str * 2 + s.level * 6 + g('hp')) * (1 + (g('hpPct') + storyPct) / 100));
  const maxMp = Math.round(40 + attrs.ene * 8 + s.level * 3 + g('mp'));

  return {
    maxHp,
    maxMp,
    hpRegen: 0.3 + attrs.vit * 0.05 + g('hpRegen'),
    mpRegen: 1 + attrs.ene * 0.08 + g('mpRegen'),
    armor: Math.round(armor),
    dmgMin,
    dmgMax,
    aps,
    range,
    arc,
    attack,
    crit: Math.min(75, 5 + attrs.dex * 0.15 + g('crit') + b('crit')),
    critDmg: 150 + g('critDmg') + b('critDmg'),
    dodge: Math.min(50, attrs.dex * 0.1 + g('dodge') + b('dodge')),
    block: Math.min(50, g('block')),
    lifesteal: g('lifesteal') + b('lifesteal'),
    manaOnHit: g('manaOnHit'),
    move: 72 * (1 + Math.min(80, g('move') + b('move')) / 100),
    cdr: Math.min(40, g('cdr')),
    spellMult: (1 + attrs.int * 0.03) * (1 + (g('spellDmg') + b('spellDmg') + storyPct) / 100),
    gold: g('gold'),
    magicFind: g('magicFind'),
    thorns: g('thorns'),
    xp: g('xp'),
    elem: { fire: g('fire'), ice: g('ice'), lightning: g('lightning'), poison: g('poison') },
    dual,
    specials,
    attrs,
    weaponBase: main?.base ?? 'fist',
    offBase: off?.base ?? null,
  };
}

// ---------------------------------------------------------------------------
// Inventory helpers
// ---------------------------------------------------------------------------
export function addToInventory(s: SaveData, it: Item): boolean {
  const idx = s.inventory.findIndex((x) => !x);
  if (idx < 0) return false;
  s.inventory[idx] = it;
  bus.emit('inventory');
  return true;
}

export function freeSlots(s: SaveData) {
  return s.inventory.filter((x) => !x).length;
}

export function equipItem(s: SaveData, invIdx: number, targetSlot?: Slot): string | null {
  const it = s.inventory[invIdx];
  if (!it) return 'Žádný předmět';
  const base = BASE_BY_ID[it.base];
  let slot: Slot;
  switch (base.cat) {
    case 'weapon1h':
      slot = targetSlot === 'off' ? 'off' : 'main';
      break;
    case 'weapon2h':
      slot = 'main';
      break;
    case 'shield':
    case 'offhand':
      slot = 'off';
      break;
    case 'ring':
      slot = targetSlot === 'ring2' || targetSlot === 'ring1' ? targetSlot : !s.equip.ring1 ? 'ring1' : !s.equip.ring2 ? 'ring2' : 'ring1';
      break;
    default:
      slot = base.cat as Slot;
  }
  // two-hand rules
  const toInv: Item[] = [];
  if (base.cat === 'weapon2h' && s.equip.off) {
    toInv.push(s.equip.off);
    s.equip.off = null;
  }
  if (slot === 'off' && isTwoHanded(s.equip.main)) {
    toInv.push(s.equip.main!);
    s.equip.main = null;
  }
  const prev = s.equip[slot] ?? null;
  s.equip[slot] = it;
  s.inventory[invIdx] = prev;
  for (const x of toInv) {
    if (!addToInventory(s, x)) {
      // revert if no space
      s.inventory[invIdx] = it;
      s.equip[slot] = prev;
      if (base.cat === 'weapon2h') s.equip.off = x;
      else s.equip.main = x;
      return 'Inventář je plný';
    }
  }
  bus.emit('inventory');
  bus.emit('equip');
  return null;
}

export function unequip(s: SaveData, slot: Slot): string | null {
  const it = s.equip[slot];
  if (!it) return null;
  if (!addToInventory(s, it)) return 'Inventář je plný';
  s.equip[slot] = null;
  bus.emit('equip');
  return null;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
// Three character slots; the legacy single save is migrated into slot 0.
const LEGACY_KEY = 'loppo-save-v1';
const SLOT_KEY = 'loppo-slot';
export const SLOTS = 3;
const slotKey = (n: number) => `loppo-save-v1-s${n}`;

export function activeSlot(): number {
  try {
    const v = parseInt(localStorage.getItem(SLOT_KEY) ?? '0', 10);
    return v >= 0 && v < SLOTS ? v : 0;
  } catch {
    return 0;
  }
}

export function setActiveSlot(n: number) {
  try {
    localStorage.setItem(SLOT_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function migrateLegacy() {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old && !localStorage.getItem(slotKey(0))) localStorage.setItem(slotKey(0), old);
    if (old) localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function saveGame(s: SaveData) {
  // a fallen hardcore hero stays gone (autosaves after the death must not bring them back)
  if (s.fallen) return;
  try {
    const slot = s.slot ?? activeSlot();
    s.slot = slot;
    localStorage.setItem(slotKey(slot), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadGame(slot = activeSlot()): SaveData | null {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveData;
    if (!s || s.version !== 1) return null;
    while (s.inventory.length < INVENTORY_SIZE) s.inventory.push(null);
    s.slot = slot;
    return s;
  } catch {
    return null;
  }
}

// Transfer codes let a character move between devices or browsers (plain base64 of the save JSON).
const CODE_PREFIX = 'LOPPO1:';

export function exportSave(s: SaveData): string {
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function importSave(code: string, slot: number): SaveData | string {
  let s: SaveData;
  try {
    const raw = code.trim().replace(CODE_PREFIX, '').replace(/\s+/g, '');
    s = JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return 'Kód se nepodařilo přečíst. Zkontroluj, že jsi zkopíroval celý text.';
  }
  if (!s || s.version !== 1 || !CLASS_BY_ID[s.cls] || typeof s.level !== 'number' || !Array.isArray(s.inventory) || !s.equip || !s.attrs) return 'Tohle není platný kód postavy.';
  while (s.inventory.length < INVENTORY_SIZE) s.inventory.push(null);
  s.slot = slot;
  saveGame(s);
  if (!loadGame(slot)) return 'Tento prohlížeč neumožňuje ukládat hru.';
  return s;
}

export function listSlots(): (SaveData | null)[] {
  const out: (SaveData | null)[] = [];
  for (let i = 0; i < SLOTS; i++) out.push(loadGame(i));
  return out;
}

export function deleteSave(slot = activeSlot()) {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    /* ignore */
  }
}

// Hall of the fallen: hardcore heroes who died (newest first)
export interface FallenHero {
  cls: ClassId;
  level: number;
  floor: number;
  maxFloor: number;
  kills: number;
  playTime: number;
  difficulty: number;
  date: number;
}
const FALLEN_KEY = 'loppo-fallen';

export function listFallen(): FallenHero[] {
  try {
    const v = JSON.parse(localStorage.getItem(FALLEN_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** a hardcore hero died: erase the save at once and remember the run */
export function buryHero(s: SaveData, floor: number) {
  s.fallen = true;
  if (s.slot !== undefined) deleteSave(s.slot);
  const list = listFallen();
  list.unshift({ cls: s.cls, level: s.level, floor, maxFloor: s.maxFloor, kills: s.kills, playTime: Math.round(s.playTime), difficulty: s.difficulty ?? DEFAULT_DIFFICULTY, date: Date.now() });
  try {
    localStorage.setItem(FALLEN_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* ignore */
  }
}

// Global current character (set when a game starts)
export const game = {
  save: null as SaveData | null,
};
