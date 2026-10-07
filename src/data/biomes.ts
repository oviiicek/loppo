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
