// Chests: six plain ones by the rarity they hold (a wooden chest holds a common thing, a mythic chest a mythic one)
// and a themed chest for every area that holds weapons of the area's theme (the ice dungeon's chest holds weapons
// of frost). A chest gives one thing of its rarity for sure and a second one now and then. The plain chests up
// from the iron one and every themed chest are locked: the lock has three to six pins to set (lockpick panel).
import { StatKey } from './types';
import { areaIndex } from './biomes';

export interface PlainChest {
  id: string;
  name: string;
  rarity: number;
}

export const PLAIN_CHESTS: PlainChest[] = [
  { id: 'wood', name: 'Dřevěná truhla', rarity: 0 },
  { id: 'bound', name: 'Okovaná truhla', rarity: 1 },
  { id: 'iron', name: 'Železná truhla', rarity: 2 },
  { id: 'silver', name: 'Stříbrná truhla', rarity: 3 },
  { id: 'gold', name: 'Zlatá truhla', rarity: 4 },
  { id: 'mythic', name: 'Mýtická truhla', rarity: 5 },
];
export const PLAIN_BY_ID = Object.fromEntries(PLAIN_CHESTS.map((c) => [c.id, c])) as Record<string, PlainChest>;

/** how the themed chest of an area looks (colours of its wood, dark parts and metal, an accent colour and the
 *  decoration drawn on it) and the property every weapon from it carries */
export interface ThemedChest {
  name: string;
  affix: StatKey;
  body: string;
  dark: string;
  trim: string;
  accent: string;
  deco: string;
}

const T = (name: string, affix: StatKey, body: string, dark: string, trim: string, accent: string, deco: string): ThemedChest => ({ name, affix, body, dark, trim, accent, deco });

/** one for each area, in the order of AREAS (data/biomes.ts) */
export const THEMED_CHESTS: ThemedChest[] = [
  T('Kryptová truhla', 'lifesteal', '#7a7570', '#4a4642', '#b8b0a0', '#ffd27a', 'candles'),
  T('Skřetí truhla', 'atkSpdPct', '#7a5a30', '#4a3418', '#8a8a7a', '#c83a2a', 'teeth'),
  T('Kostěná truhla', 'critDmg', '#d8ccb0', '#8a7e64', '#f0e8d0', '#3a2a20', 'bones'),
  T('Utopená truhla', 'ice', '#3a6a6a', '#1e3e40', '#9ab8a8', '#5ab07a', 'barnacles'),
  T('Ledová truhla', 'ice', '#8ad0ee', '#4a8ab0', '#e8f8ff', '#ffffff', 'frost'),
  T('Démonská truhla', 'fire', '#3a1a1a', '#1e0c0c', '#8a8a92', '#ff4a1a', 'horns'),
  T('Houbová truhla', 'poison', '#8a6a4a', '#5a422a', '#c8b89a', '#e04a8a', 'mushroom'),
  T('Opředená truhla', 'poison', '#5a4a3a', '#2e241a', '#a8a090', '#f0f0f0', 'web'),
  T('Faraonská truhla', 'dmg', '#e0b040', '#9a7020', '#3a6ad0', '#3a6ad0', 'stripes'),
  T('Kořenová truhla', 'manasteal', '#6a4a2a', '#3a2814', '#8a6a3a', '#5ac85a', 'roots'),
  T('Krystalová truhla', 'lightning', '#4a3a6a', '#2a1e44', '#9ae8ff', '#c87dff', 'crystals'),
  T('Trpasličí truhla', 'dmgPct', '#7a4a2a', '#4a2a14', '#c89a4a', '#ff8a2a', 'runes'),
  T('Lebková truhla', 'critDmg', '#5a4a40', '#2e241e', '#e8e0c8', '#ff3a3a', 'skulls'),
  T('Chrámová truhla', 'manaOnHit', '#e8e4d8', '#9a9480', '#e9b949', '#5aa8ff', 'bell'),
  T('Spoutaná truhla', 'dmg', '#4a3a3a', '#241a1a', '#7a7a84', '#ff6a2a', 'chains'),
  T('Popelavá truhla', 'fire', '#4a4440', '#262220', '#8a8078', '#ff8a2a', 'embers'),
  T('Kovářská truhla', 'dmgPct', '#5a3a2a', '#2e1c12', '#ff9a3a', '#ffd23a', 'glow'),
  T('Bahenní truhla', 'poison', '#4a5a2a', '#263014', '#7a8a5a', '#9aff4a', 'slime'),
  T('Obsidiánová truhla', 'fire', '#1e1a26', '#0c0a12', '#5a4a6a', '#ff5a1a', 'lava'),
  T('Stínová truhla', 'lifesteal', '#3a2a4a', '#1e1428', '#8a7aa0', '#ff3a6a', 'gems'),
  T('Truhla prázdnoty', 'spellDmg', '#1a1424', '#0a0810', '#6a5a8a', '#c8a8ff', 'stars'),
  T('Nebeská truhla', 'lightning', '#d8e8f8', '#8aa8c8', '#ffe27a', '#ffffff', 'clouds'),
  T('Zrcadlová truhla', 'crit', '#b8c0d0', '#6a7084', '#ffffff', '#9ae8ff', 'mirror'),
  T('Snová truhla', 'spellDmg', '#a87ac8', '#5a3a7a', '#ffc8f0', '#9ae8ff', 'nebula'),
  T('Truhla ze dna světa', 'critDmg', '#2a1414', '#120808', '#8a3a3a', '#ff2a2a', 'eye'),
];

/** what a chest is, from the data it carries ({ tier, rarity?, theme? }); old chests of a saved floor still work */
export function chestInfo(data: { tier?: string; rarity?: number; theme?: number }): { name: string; rarity: number; texture: string; themed: ThemedChest | null } {
  if (data.tier === 'theme' && data.theme !== undefined) {
    const t = THEMED_CHESTS[data.theme] ?? THEMED_CHESTS[0];
    return { name: t.name, rarity: data.rarity ?? 2, texture: 'chest_t' + data.theme, themed: t };
  }
  if (data.tier === 'boss') return { name: 'Truhla strážce', rarity: 3, texture: 'chest_boss', themed: null };
  const p = PLAIN_BY_ID[data.tier ?? 'wood'] ?? PLAIN_CHESTS[0];
  return { name: p.name, rarity: data.rarity ?? p.rarity, texture: 'chest_' + p.id, themed: null };
}

/** the pins of a chest's lock: none on the common and uncommon chests, then three to six */
export function chestPins(rarity: number) {
  return rarity < 2 ? 0 : Math.min(6, rarity + 1);
}

/** the plain chest a dungeon floor gets (deeper down the better ones are less rare); min: the least rarity it may
 *  have (a vault or a secret room holds no wooden chests) */
export function rollPlainChest(floor: number, rnd: () => number, min = 0): PlainChest {
  const w = [34, 30, 20, 10 + floor * 0.03, 3 + floor * 0.02, 0.4 + floor * 0.006].map((v, k) => (k < min ? 0 : v));
  let k = 0;
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (; k < w.length - 1; k++) {
    x -= w[k];
    if (x <= 0) break;
  }
  return PLAIN_CHESTS[k];
}

/** the rarity of a themed chest (rare at least) */
export function rollThemedRarity(floor: number, rnd: () => number) {
  const w = [50, 32 + floor * 0.04, 14 + floor * 0.03, 3 + floor * 0.01];
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < w.length; k++) {
    x -= w[k];
    if (x <= 0) return 2 + k;
  }
  return 2;
}

/** a floor's chance of a themed chest of its area */
export const THEMED_CHANCE = 0.3;

/** the themed chest of the area a floor belongs to */
export const themedChestFor = (floor: number) => areaIndex(floor);
