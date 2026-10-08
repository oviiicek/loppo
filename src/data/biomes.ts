// The dungeon is made of five biomes, 50 floors each; the story ends with the last one (floor 250)
// and the endless depths below cycle through them again.
export const BIOME_FLOORS = 50;
export const BIOME_COUNT = 5;

export function biomeForFloor(floor: number) {
  return Math.floor((Math.max(1, floor) - 1) / BIOME_FLOORS) % BIOME_COUNT;
}

/** every biome is split into five areas of ten floors */
export const AREA_FLOORS = 10;
const AREA_NAMES = [
  ['Vstupní síně', 'Strážnice', 'Vězení', 'Katakomby', 'Brána hlubin'],
  ['Kapající chodby', 'Houbový les', 'Podzemní řeka', 'Pavoučí doupata', 'Srdce jeskyní'],
  ['Zamrzlé vodopády', 'Krystalové síně', 'Ledová pustina', 'Hrobka zimy', 'Isoldin trůn'],
  ['Popelavé pláně', 'Lávové řeky', 'Kovárny Pětice', 'Řetězové mosty', 'Srdce výhně'],
  ['Okraj prázdnoty', 'Plovoucí ostrovy', 'Šepot tmy', 'Hlubina snů', 'Dno světa'],
];
const STORY_FLOORS = BIOME_FLOORS * BIOME_COUNT;

/** name of the area a floor belongs to and its floor range (the endless depths below the story have one name) */
export function areaForFloor(floor: number): { name: string; from: number; to: number } {
  const f = Math.max(1, floor);
  if (f > STORY_FLOORS) return { name: 'Nekonečná hlubina', from: STORY_FLOORS + 1, to: Infinity };
  const i = Math.floor((f - 1) / AREA_FLOORS);
  return { name: AREA_NAMES[Math.floor(i / 5)][i % 5], from: i * AREA_FLOORS + 1, to: (i + 1) * AREA_FLOORS };
}

// Monster families (see families.ts)
/** the two families of each area of ten floors (25 areas of the story; the endless depths repeat them) */
const AREA_FAMILIES: [string, string][] = [
  // the dungeon
  ['undead', 'vermin'],
  ['greenskin', 'spider'],
  ['ghoul', 'vampire'],
  ['undead', 'golem'],
  ['cult', 'void'],
  // the caves
  ['vermin', 'greenskin'],
  ['spider', 'vermin'],
  ['ghoul', 'golem'],
  ['spider', 'vermin'],
  ['spider', 'ghoul'],
  // the ice
  ['frost', 'undead'],
  ['golem', 'frost'],
  ['frost', 'vampire'],
  ['undead', 'vampire'],
  ['cult', 'frost'],
  // the forge
  ['hell', 'golem'],
  ['golem', 'hell'],
  ['greenskin', 'golem'],
  ['cult', 'hell'],
  ['hell', 'vampire'],
  // the void
  ['void', 'cult'],
  ['void', 'vampire'],
  ['cult', 'void'],
  ['void', 'undead'],
  ['void', 'hell'],
];

/** the families met on a floor (a rift has its own twisted crowd) */
export function familiesFor(floor: number, rift?: 'rift' | 'dream' | 'last'): [string, string] {
  if (rift === 'rift') return floor > 4 * BIOME_FLOORS && floor <= BIOME_COUNT * BIOME_FLOORS ? ['hell', 'golem'] : ['void', 'hell'];
  const f = ((Math.max(1, floor) - 1) % (BIOME_FLOORS * BIOME_COUNT)) + 1;
  return AREA_FAMILIES[Math.floor((f - 1) / AREA_FLOORS)] ?? AREA_FAMILIES[0];
}
