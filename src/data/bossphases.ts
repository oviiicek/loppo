// Boss phases. At 70 %, 40 % and 10 % of its health a guardian changes: first it learns new attacks,
// then the arena turns against the hero, and at the end it makes its last stand (faster, angrier and
// with an all-out attack). Story guardians go through these in their last stage.
import type { BossPattern } from './enemies';
import type { Element } from './types';

export type ArenaKind = 'lava' | 'quake' | 'toxic' | 'darkness' | 'blizzard';

export interface PhasePlan {
  /** signature attacks the guardian adds to its rotation at 70 % */
  learn: BossPattern[];
  /** what happens to the arena at 40 % */
  arena: ArenaKind;
}

/** health fractions where the next phase begins */
export const BOSS_PHASE_HP = [0.7, 0.4, 0.1];
export const BOSS_PHASES = BOSS_PHASE_HP.length + 1;

const BY_BOSS: Record<string, PhasePlan> = {
  skelKing: { learn: ['spikes', 'chains'], arena: 'quake' },
  slimeKing: { learn: ['spores', 'spikes'], arena: 'toxic' },
  spiderQueen: { learn: ['web', 'spores'], arena: 'toxic' },
  orcLord: { learn: ['sweep', 'chains'], arena: 'quake' },
  lich: { learn: ['icePrison', 'hands'], arena: 'darkness' },
  fireDemon: { learn: ['cross', 'spikes'], arena: 'lava' },
  colossus: { learn: ['spikes', 'sweep'], arena: 'quake' },
  vampLord: { learn: ['drain', 'clones'], arena: 'darkness' },
  shadowKnight: { learn: ['sweep', 'cross'], arena: 'darkness' },
  dragon: { learn: ['cross', 'nova'], arena: 'lava' },
};

const BY_ELEMENT: Partial<Record<Element, PhasePlan>> = {
  phys: { learn: ['spikes'], arena: 'quake' },
  poison: { learn: ['web'], arena: 'toxic' },
  ice: { learn: ['cross'], arena: 'blizzard' },
  shadow: { learn: ['cross'], arena: 'darkness' },
  fire: { learn: ['cross'], arena: 'lava' },
  lightning: { learn: ['cross'], arena: 'quake' },
};

export function phasePlan(id: string, el: Element): PhasePlan {
  return BY_BOSS[id] ?? BY_ELEMENT[el] ?? BY_ELEMENT.phys!;
}

export const ARENA_NAME: Record<ArenaKind, string> = {
  lava: 'podlahou prorůstá láva',
  quake: 'strop se hroutí',
  toxic: 'arénu plní jed',
  darkness: 'tma se zavírá',
  blizzard: 'přichází ledová bouře',
};

/** the words under the guardian's name when a phase begins */
export function phaseLine(phase: number, arena: ArenaKind) {
  if (phase === 1) return 'Fáze 2 – nové útoky';
  if (phase === 2) return `Fáze 3 – ${ARENA_NAME[arena]}`;
  return 'Poslední vzdor!';
}
