// The dungeon is made of five biomes, 50 floors each; the story ends with the last one (floor 250)
// and the endless depths below cycle through them again.
export const BIOME_FLOORS = 50;
export const BIOME_COUNT = 5;

export function biomeForFloor(floor: number) {
  return Math.floor((Math.max(1, floor) - 1) / BIOME_FLOORS) % BIOME_COUNT;
}
