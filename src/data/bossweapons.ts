// Weapons of the guardians: every guardian keeps a weapon for every class, named after it ("Dlouhý luk
// Isoldy"), with the guardian's own power and spell. The first time a guardian falls there is a 35 % chance it
// leaves the weapon for the hero's class; every later fight with it (fought again from the village's gate, or
// the same guardian deeper down) has 10 % – the chance never drops further, so every weapon can still be won.
import type { ClassId, Item } from './types';
import { CLASS_BY_ID } from './classes';
import { BASE_BY_ID, generateItem, isWeaponBase } from './items';
import { BOSSES, STORY_BOSSES, bossForFloor, isStoryBossFloor, STORY_END } from './enemies';
import type { RNG } from '../systems/rng';

export interface BossArms {
  /** the guardian (a BossDef id or a StoryBossDef id) */
  id: string;
  /** the guardian's name in the genitive: "<weapon> <of>" */
  of: string;
  /** the unique power every weapon of the guardian carries (see POWERS) */
  power: string;
  /** the weapon spell every weapon of the guardian casts (see weaponspells.ts) */
  spell: string;
  lore: string;
}

export const BOSS_ARMS: BossArms[] = [
  // the guardians of the floors (every tenth floor)
  { id: 'skelKing', of: 'Kostěného krále', power: 'soulRise', spell: 'skeletons@kill12', lore: 'Kosti jeho dvora poslouchají i nového pána.' },
  { id: 'slimeKing', of: 'Obřího slizu', power: 'secondWind', spell: 'poison@hit15', lore: 'Lepkavá, nezničitelná a pořád hladová.' },
  { id: 'spiderQueen', of: 'Pavoučí královny', power: 'markOfDeath', spell: 'poison@crit', lore: 'Kdo uvízne v její síti, už se nevymotá.' },
  { id: 'orcLord', of: 'válečníka Grukha', power: 'bloodlust', spell: 'warcry@kill5', lore: 'Grukh nikdy neustoupil. Jeho zbraň také ne.' },
  { id: 'lich', of: 'Licha', power: 'arcaneFlow', spell: 'bloodwave@cast', lore: 'Stará magie, která přežila svého pána.' },
  { id: 'fireDemon', of: 'Démona plamenů', power: 'fireTrail', spell: 'fireballs@kill5', lore: 'Ještě teď je horká jako výheň pekel.' },
  { id: 'colossus', of: 'Kamenného kolosu', power: 'stoneSkin', spell: 'quake@hurt', lore: 'Vytesaná z jeho srdce. Těžká jako hora.' },
  { id: 'vampLord', of: 'Upířího lorda', power: 'lifeTap', spell: 'bloodwave@crit', lore: 'Pije za tebe – a nikdy nemá dost.' },
  { id: 'shadowKnight', of: 'Stínového rytíře', power: 'echoStrike', spell: 'spiritblade@elite', lore: 'Každý úder má svůj stín, který udeří znovu.' },
  { id: 'dragon', of: 'draka Vermithraxe', power: 'meteorCrit', spell: 'firering@timer', lore: 'Šupina z jeho hrudi, kovaná v jeho vlastním ohni.' },
  // the guardians of the story
  { id: 'abbot', of: 'opata Benedikta', power: 'cheatDeath', spell: 'skeletons@lowhp', lore: 'Opat se smrti nebál. Proč by ses bál ty?' },
  { id: 'isolda', of: 'Isoldy', power: 'frostAura', spell: 'frostnova@hurt', lore: 'Led královny, který nikdy neroztaje.' },
  { id: 'sporeMother', of: 'Matky spor', power: 'thornAura', spell: 'poison@timer', lore: 'Kořeny z jejího srdce rostou dál.' },
  { id: 'jailer', of: 'žalářníka Grota', power: 'executioner', spell: 'quake@crit', lore: 'Klíče od kostnice. A řetězy pro ty, kdo neposlechnou.' },
  { id: 'morgrim', of: 'Morgrima', power: 'reflect', spell: 'stoneshield@lowhp', lore: 'Štítonoš držel brány sto let. Teď drží tebe.' },
  { id: 'elara', of: 'Elary', power: 'starfall', spell: 'chain@cast', lore: 'Hlas hlubin v ní dál šeptá – tentokrát tobě.' },
  { id: 'nyxthar', of: "Nyx'thara", power: 'phoenix', spell: 'meteor@elite', lore: 'Kus samotného dna světa. Žádná zbraň není hlubší.' },
];

export const BOSS_ARMS_BY_ID = Object.fromEntries(BOSS_ARMS.map((a) => [a.id, a])) as Record<string, BossArms>;

/** the chance the guardian leaves its weapon: the first time it falls, and every time after that */
export const BOSS_WEAPON_FIRST = 0.35;
export const BOSS_WEAPON_AGAIN = 0.1;

/** how a guardian's weapon is known in the codex ("isolda:ranger") */
export const bossWeaponKey = (id: string, cls: ClassId) => `${id}:${cls}`;

/** the kind of weapon a guardian keeps for a class: one of the class's main weapons, a different one for each
 *  guardian, so every class gets bows, crossbows, knives… from the guardians in turn */
export function bossWeaponBase(id: string, cls: ClassId): string {
  const main = CLASS_BY_ID[cls].gear.filter((g) => BASE_BY_ID[g] && isWeaponBase(BASE_BY_ID[g])).slice(0, 6);
  const i = Math.max(0, BOSS_ARMS.findIndex((a) => a.id === id));
  return main[i % main.length] ?? 'sword';
}

export function bossWeaponName(id: string, cls: ClassId) {
  const noun = BASE_BY_ID[bossWeaponBase(id, cls)].noun;
  return `${noun[0].toUpperCase()}${noun.slice(1)} ${BOSS_ARMS_BY_ID[id]?.of ?? ''}`.trim();
}

/** a guardian's weapon for a class: legendary strength (mythic from the story guardians and the ancient ones),
 *  the guardian's power in place of one random special, its spell, its name */
export function makeBossWeapon(id: string, cls: ClassId, ilvl: number, rarity: number, r?: RNG): Item | null {
  const arms = BOSS_ARMS_BY_ID[id];
  if (!arms) return null;
  const it = generateItem(ilvl, { base: bossWeaponBase(id, cls), rarity, r, noCurse: true, noUnique: true, noSpell: true });
  it.specials = [arms.power, ...it.specials.filter((s) => s !== arms.power)].slice(0, Math.max(1, it.specials.length));
  it.spell = arms.spell;
  it.name = bossWeaponName(id, cls);
  it.boss = bossWeaponKey(id, cls);
  return it;
}

/** the guardian of a boss weapon's key, and the class it was made for */
export function parseBossKey(key: string | undefined): { arms: BossArms; cls: ClassId } | null {
  if (!key) return null;
  const [id, cls] = key.split(':');
  const arms = BOSS_ARMS_BY_ID[id];
  return arms && CLASS_BY_ID[cls as ClassId] ? { arms, cls: cls as ClassId } : null;
}

/** the guardian's name as the game shows it ("Isolda – Ledová královna") */
export function guardianName(id: string) {
  const st = STORY_BOSSES.find((b) => b.id === id);
  if (st) return `${st.name} – ${st.title}`;
  return BOSSES.find((b) => b.id === id)?.name ?? id;
}

/** the floors a guardian waits on (down to the end of the story) */
export function guardianFloors(id: string): number[] {
  const st = STORY_BOSSES.find((b) => b.id === id);
  if (st) return [st.floor];
  const out: number[] = [];
  for (let f = 10; f <= STORY_END; f += 10) if (!isStoryBossFloor(f) && bossForFloor(f).def.id === id) out.push(f);
  return out;
}
