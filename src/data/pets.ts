// Pets: small companions the hero frees from cages down in the dungeon. A pet follows the hero, fetches
// the loot lying around, and gives a bonus of its own that grows as it travels deeper with the hero.
import type { Stats } from './types';

export type PetId = 'cat' | 'dog' | 'fox' | 'owl' | 'turtle' | 'slime' | 'wisp' | 'dragon';

export interface PetDef {
  id: PetId;
  /** its name and what it is (the cage label says "Kočka Mína") */
  name: string;
  species: string;
  /** "freed X" / "X is with you" need the right gender in Czech */
  fem: boolean;
  /** cages with this pet appear from this floor on */
  minFloor: number;
  /** flies above the floor (owl, wisp, dragon): no walls in the way, drawn higher */
  flying?: boolean;
  /** fights next to the hero: bites in melee or spits fire */
  fights?: 'bite' | 'fire';
  /** short description of what it does */
  desc: string;
  /** the stat bonus at a pet level (1–10) */
  stats: (lvl: number) => Stats;
  /** colour of its name and hearts */
  color: string;
}

export const PET_MAX_LEVEL = 10;
/** floors descended together for every pet level */
export const PET_FLOORS_PER_LEVEL = 4;

const r1 = (v: number) => Math.round(v * 10) / 10;

export const PETS: PetDef[] = [
  {
    id: 'cat',
    name: 'Mína',
    species: 'Kočka',
    fem: true,
    minFloor: 3,
    desc: 'Má šťastnou tlapku: lepší kořist.',
    stats: (l) => ({ magicFind: 8 + l * 2 }),
    color: '#ffb36a',
  },
  {
    id: 'dog',
    name: 'Ořech',
    species: 'Pes',
    fem: false,
    minFloor: 7,
    fights: 'bite',
    desc: 'Kouše nepřátele vedle tebe a hlídá ti záda: víc zdraví.',
    stats: (l) => ({ hpPct: 2 + l }),
    color: '#d8a46a',
  },
  {
    id: 'fox',
    name: 'Zrzka',
    species: 'Liška',
    fem: true,
    minFloor: 12,
    desc: 'Vyčmuchá každou minci: víc zlata.',
    stats: (l) => ({ gold: 12 + l * 3 }),
    color: '#ff8a3a',
  },
  {
    id: 'owl',
    name: 'Hú',
    species: 'Sova',
    fem: true,
    minFloor: 20,
    flying: true,
    desc: 'Vidí ve tmě: odkrývá větší kus mapy a radí, takže rychleji získáváš zkušenosti.',
    stats: (l) => ({ xp: 5 + l }),
    color: '#e8c890',
  },
  {
    id: 'turtle',
    name: 'Tonda',
    species: 'Želva',
    fem: false,
    minFloor: 32,
    desc: 'Pevný jako jeho krunýř: víc brnění a zdraví.',
    stats: (l) => ({ hpPct: 3 + l, block: r1(2 + l * 0.4) }),
    color: '#8ad46a',
  },
  {
    id: 'slime',
    name: 'Bublina',
    species: 'Sliz',
    fem: true,
    minFloor: 45,
    desc: 'Léčivý sliz: vysává život z nepřátel a obnovuje zdraví.',
    stats: (l) => ({ lifesteal: r1(1 + l * 0.2), hpRegen: r1(1 + l * 0.6) }),
    color: '#5ae8d0',
  },
  {
    id: 'wisp',
    name: 'Jiskra',
    species: 'Bludička',
    fem: true,
    minFloor: 70,
    flying: true,
    desc: 'Svítí na cestu a posiluje magii: silnější kouzla a rychlejší mana.',
    stats: (l) => ({ spellDmg: 6 + l * 1.5, mpRegen: r1(1 + l * 0.3) }),
    color: '#9ae6ff',
  },
  {
    id: 'dragon',
    name: 'Uhlík',
    species: 'Dráček',
    fem: false,
    minFloor: 100,
    flying: true,
    fights: 'fire',
    desc: 'Plive oheň na nepřátele a učí tě trefovat slabá místa: kritické zásahy.',
    stats: (l) => ({ crit: r1(2 + l * 0.3), critDmg: 5 + l * 2 }),
    color: '#ff6a4a',
  },
];

export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p])) as Record<PetId, PetDef>;

/** "Kočka Mína" */
export const petTitle = (p: PetDef) => `${p.species} ${p.name}`;

const STAT_LABEL: Partial<Record<keyof Stats, (v: number) => string>> = {
  magicFind: (v) => `+${v} % lepší kořist`,
  gold: (v) => `+${v} % zlata`,
  xp: (v) => `+${v} % zkušeností`,
  hpPct: (v) => `+${v} % zdraví`,
  block: (v) => `+${String(v).replace('.', ',')} % blok`,
  lifesteal: (v) => `+${String(v).replace('.', ',')} % vysávání života`,
  hpRegen: (v) => `+${String(v).replace('.', ',')} HP/s`,
  spellDmg: (v) => `+${String(v).replace('.', ',')} % síla kouzel`,
  mpRegen: (v) => `+${String(v).replace('.', ',')} many/s`,
  crit: (v) => `+${String(v).replace('.', ',')} % kritický zásah`,
  critDmg: (v) => `+${v} % kritické poškození`,
};

/** the bonus as text: "+12 % lepší kořist" */
export function petBonusText(p: PetDef, lvl: number) {
  const parts = Object.entries(p.stats(lvl)).map(([k, v]) => STAT_LABEL[k as keyof Stats]?.(v as number) ?? `${k} +${v}`);
  if (p.fights === 'bite') parts.unshift('kouše nepřátele');
  if (p.fights === 'fire') parts.unshift('plive oheň');
  if (p.id === 'owl') parts.push('větší dohled');
  if (p.id === 'wisp') parts.push('svítí');
  return parts.join(', ');
}

/** share of the hero's weapon damage a fighting pet deals per hit */
export const petDamageShare = (lvl: number) => 0.28 + lvl * 0.03;

// ---------------------------------------------------------------- the pets of a character (in the save)
export interface PetState {
  owned: PetId[];
  active: PetId | null;
  /** floors descended with each pet (its level comes from this) */
  floors: Partial<Record<PetId, number>>;
  /** floors since the last cage (raises the chance of the next one) */
  pity: number;
}

export function newPetState(): PetState {
  return { owned: [], active: null, floors: {}, pity: 0 };
}

export function petLevel(st: PetState, id: PetId) {
  return Math.min(PET_MAX_LEVEL, 1 + Math.floor((st.floors[id] ?? 0) / PET_FLOORS_PER_LEVEL));
}

/** floors still to go to the next level (0 at the top) */
export function petFloorsToNext(st: PetState, id: PetId) {
  if (petLevel(st, id) >= PET_MAX_LEVEL) return 0;
  return PET_FLOORS_PER_LEVEL - ((st.floors[id] ?? 0) % PET_FLOORS_PER_LEVEL);
}

/** the pet a new cage on this floor holds (or none: all freed, or none lives this deep yet) */
export function cagePetFor(st: PetState, floor: number, rnd = Math.random): PetId | null {
  const free = PETS.filter((p) => !st.owned.includes(p.id) && p.minFloor <= floor);
  if (!free.length) return null;
  // the pets come roughly in order of depth, with a chance for a deeper one
  free.sort((a, b) => a.minFloor - b.minFloor);
  return (rnd() < 0.7 ? free[0] : free[Math.floor(rnd() * free.length)]).id;
}

/** chance of a cage on a floor: the first pet is guaranteed, later ones come every dozen floors or so */
export function cageChance(st: PetState) {
  if (!st.owned.length) return 1;
  return Math.min(0.6, 0.06 + st.pity * 0.025);
}
