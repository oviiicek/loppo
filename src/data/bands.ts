// The descent is split into bands of ten floors. An expedition starts at the first floor of a band the hero
// has opened; the guardian waits on the band's last floor and beating it opens the next band. Halfway down
// every band lies a camp (a safe floor); the band's first floor and its camp are the checkpoints a death
// sends the hero back to. Every band down gives a little better loot.
import { enemyXpScale } from './enemies';
import { xpForLevel } from '../systems/state';
import type { SaveData, RunState } from '../systems/state';
import { areaForFloor } from './biomes';

export const BAND = 10;

/** the band (0, 1, 2 …) a floor belongs to */
export const bandOf = (floor: number) => Math.floor((Math.max(1, floor) - 1) / BAND);
export const bandStart = (b: number) => b * BAND + 1;
export const bandEnd = (b: number) => (b + 1) * BAND;
/** halfway down every band: the camp */
export const isCampFloor = (floor: number) => floor % BAND === 5;
/** a band's camp floor */
export const bandCamp = (b: number) => b * BAND + 5;

/** where a death sends the hero back to: the band's camp once it was reached, otherwise the band's first floor */
export function checkpointFor(floor: number) {
  const b = bandOf(floor);
  return floor >= bandCamp(b) ? bandCamp(b) : bandStart(b);
}

/** a band is open once the hero reached its first floor (beating the guardian above opens it) */
export const bandOpen = (b: number, maxFloor: number) => b === 0 || maxFloor >= bandStart(b);
/** the band's guardian was beaten (the hero got below it) */
export const bandDone = (b: number, maxFloor: number) => maxFloor > bandEnd(b);
/** the deepest floor the hero reached inside a band (0 when never there) */
export const bandBest = (b: number, maxFloor: number) => (maxFloor >= bandStart(b) ? Math.min(maxFloor, bandEnd(b)) : 0);

/** extra loot quality of a band (percent of magic find): every ten floors down a little better */
export const bandLootBonus = (floor: number) => bandOf(floor) * 5;

/** the level of a good player arriving at a floor (the balance model: monsters of every floor above, a
 *  guardian every ten floors) */
const levels: number[] = [];
export function expectedLevel(floor: number): number {
  if (!levels.length) {
    let L = 1,
      xp = 0;
    levels[1] = 1;
    for (let f = 1; f < 400; f++) {
      xp += 0.7 * Math.min(110, 34 + 2 * f) * 15 * enemyXpScale(f) * 1.15;
      if (f % BAND === 0) xp += 600 * enemyXpScale(f);
      while (xp >= xpForLevel(L)) {
        xp -= xpForLevel(L);
        L++;
      }
      levels[f + 1] = L;
    }
  }
  return levels[Math.min(400, Math.max(1, Math.round(floor)))];
}

/** the level the hero should have to start a band without too much trouble */
export const recommendedLevel = (b: number) => Math.max(1, expectedLevel(bandStart(b)) - 1);

/** a band's name (its area) */
export const bandName = (b: number) => areaForFloor(bandStart(b)).name;

/** the expedition of a hero (an older save gets one for the floor it is on) */
export function runOf(s: SaveData): RunState {
  return (s.run ??= { band: bandOf(s.floor), checkpoint: checkpointFor(s.floor) });
}

/** a new expedition from the first floor of a band */
export function startRun(s: SaveData, b: number) {
  s.run = { band: b, checkpoint: bandStart(b), kind: 'normal' };
  s.floor = bandStart(b);
}
