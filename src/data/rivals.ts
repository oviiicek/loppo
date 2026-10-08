// Wandering adventurers: now and then another hero walks the same floor. Met face to face they offer to
// go on together, want to trade, or claim the floor for themselves (pay them off or fight).
import type { ClassId } from './types';
import type { MercRole } from './mercs';

export type RivalMood = 'friendly' | 'trader' | 'hostile';

export interface RivalPerson {
  name: string;
  fem: boolean;
}

export const RIVAL_PEOPLE: RivalPerson[] = [
  { name: 'Vilda Šťastlivec', fem: false },
  { name: 'Bára Neohrožená', fem: true },
  { name: 'Ruda Kladivo', fem: false },
  { name: 'Magda Stínová', fem: true },
  { name: 'Tonda Zlatokop', fem: false },
  { name: 'Eliška Hvězdná', fem: true },
  { name: 'Franta Pětiprstý', fem: false },
  { name: 'Jitka Bystrooká', fem: true },
  { name: 'Mirek Medvěd', fem: false },
  { name: 'Hanka Jiskra', fem: true },
  { name: 'Kuba Dlouhán', fem: false },
  { name: 'Zdena Žihadlo', fem: true },
];

/** how an adventurer of a class fights beside (or against) the hero */
export function rivalRole(cls: ClassId): MercRole {
  if (cls === 'ranger') return 'archer';
  if (cls === 'druid') return 'healer';
  if (cls === 'mage' || cls === 'necro' || cls === 'shaman') return 'mage';
  return 'tank';
}

/** the monster an adventurer becomes when they turn on the hero (melee, a shooter or a caster) */
export function rivalFoeBase(role: MercRole) {
  return role === 'archer' ? 'skelArcher' : role === 'mage' || role === 'healer' ? 'cultist' : 'goblin';
}

export const RIVAL_GREETING: Record<RivalMood, string[]> = {
  friendly: [
    'Zdravím! Ve dvou se to tu líp přežije. Půjdeme kus cesty spolu?',
    'Konečně živá duše! Tohle patro je plné havěti – co kdybychom si ho rozdělili napůl?',
    'Ty jdeš taky dolů? Kryju ti záda, když ty kryješ moje.',
  ],
  trader: [
    'Psst! Mám v batohu pár kousků, které se ti budou líbit. Za rozumnou cenu, samozřejmě.',
    'Nesu toho víc, než unesu. Nechceš mi trochu odlehčit? Ne zadarmo, pochopitelně.',
    'Obchodník v hlubinách? Proč ne. Podívej se, co nesu z hlubin.',
  ],
  hostile: [
    'Tohle patro je moje. Buď zaplatíš za průchod, nebo tě tu nechám ležet.',
    'Další lovec pokladů? Tady ti nic nezbyde. Plať, nebo se bij!',
    'Jsi mi v cestě. Mýtné, nebo meč – vyber si.',
  ],
};

/** what paying off a hostile adventurer costs on a floor */
export function rivalToll(floor: number) {
  return Math.round(80 + floor * floor * 1.2 + floor * 20);
}
