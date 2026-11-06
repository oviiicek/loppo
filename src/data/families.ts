// Monster families. Every area of ten floors belongs to two families (the first one is met more often)
// and every room holds a pack of a single family: mostly its foot soldiers, sometimes a specialist the
// hero has to deal with first (a healer, a necromancer, a summoner, a guardian, a sniper …) and now and
// then one of its heavies.
import { ENEMY_BY_ID, EnemyDef, PRIORITY_ROLES } from './enemies';
import { familiesFor } from './biomes';
import { RNG } from '../systems/rng';

export { familiesFor };

export interface Family {
  id: string;
  name: string;
  /** its members from the weakest to the most dangerous */
  members: string[];
}

const F = (id: string, name: string, members: string[]): Family => ({ id, name, members });

export const FAMILIES: Record<string, Family> = {
  undead: F('undead', 'Nemrtví', ['skeleton', 'skelArcher', 'zombie', 'skelKnight', 'skelMage', 'necromancer', 'boneSniper', 'ghost', 'boneGiant', 'darkMage', 'shade']),
  vermin: F('vermin', 'Jeskynní havěť', ['bat', 'slime', 'spiderling', 'goblin', 'mushroom', 'troll']),
  greenskin: F('greenskin', 'Zelenokožci', ['goblin', 'goblinShaman', 'orc', 'orcBerserker', 'troll']),
  spider: F('spider', 'Pavouci', ['spiderling', 'spider', 'webSpider', 'blastSpider', 'spiderGuard', 'spiderMother']),
  ghoul: F('ghoul', 'Ghúlové', ['zombie', 'ghoul', 'plagueGhoul', 'hungryGhoul', 'alphaGhoul', 'mutantGhoul']),
  vampire: F('vampire', 'Upíři', ['bat', 'swarmBat', 'vampire', 'bloodWitch', 'vampireLord']),
  golem: F('golem', 'Golemové', ['brokenGolem', 'golem', 'crystalGolem', 'magmaGolem', 'stormGolem']),
  cult: F('cult', 'Kult', ['cultist', 'hexWitch', 'darkPriest', 'darkMage', 'bloodWitch', 'portalMage', 'illusionist', 'mageHunter', 'timeMage', 'mindMage', 'manaBeast']),
  frost: F('frost', 'Mráz', ['frostWolf', 'wraith', 'ghost', 'iceGolem', 'crystalGolem', 'timeMage']),
  hell: F('hell', 'Peklo', ['imp', 'hellhound', 'cultist', 'darkPriest', 'magmaGolem', 'stormGolem', 'mirrorDemon']),
  void: F('void', 'Prázdnota', ['voidEye', 'shade', 'illusionist', 'mageHunter', 'manaBeast', 'buffEater', 'adaptive', 'mirrorDemon']),
};

/** the families a monster belongs to (for the bestiary) */
export function familiesOf(id: string): Family[] {
  return Object.values(FAMILIES).filter((f) => f.members.includes(id));
}

export interface PackSlot {
  id: string;
  /** how many of it come together (little spiders, a swarm of bats) */
  n: number;
}

/** the members of a family that live this deep */
export function familyMembers(fam: Family, floor: number): EnemyDef[] {
  return fam.members.map((id) => ENEMY_BY_ID[id]).filter((d) => d && d.minFloor <= floor);
}

/** its foot soldiers: everything without a special job */
export function familyFodder(fam: Family, floor: number): EnemyDef[] {
  const all = familyMembers(fam, floor);
  const fodder = all.filter((d) => !d.role);
  return fodder.length ? fodder : all;
}

/**
 * A pack for one room: `slots` places of foot soldiers, often led by one specialist (more often deeper
 * down), and in bigger rooms sometimes one of the family's heavies. Families of big monsters (golems)
 * come in smaller packs.
 */
export function makePack(fam: Family, floor: number, slots: number, r: RNG): PackSlot[] {
  const all = familyMembers(fam, floor);
  if (!all.length) return [];
  const special = all.filter((d) => d.role && PRIORITY_ROLES.includes(d.role));
  const heavy = all.filter((d) => d.role === 'heavy' || d.role === 'berserker');
  const fodder = familyFodder(fam, floor);
  // tough families come in smaller packs
  const avgHp = fodder.reduce((a, d) => a + d.hp, 0) / fodder.length;
  let left = Math.max(1, Math.round(slots * Math.min(1, Math.max(0.4, Math.sqrt(40 / avgHp)))));
  const out: PackSlot[] = [];
  const add = (d: EnemyDef) => {
    // a group (little spiders, a swarm) takes the place of two
    const n = d.group ?? 1;
    out.push({ id: d.id, n });
    left -= n > 1 ? 2 : 1;
  };
  if (left >= 3 && special.length && r.chance(Math.min(0.75, 0.3 + floor * 0.01))) {
    add(r.weighted(special, (d) => d.weight));
    if (left >= 7 && special.length > 1 && r.chance(0.35)) add(r.weighted(special, (d) => d.weight));
  }
  if (left >= 4 && heavy.length && r.chance(Math.min(0.5, 0.25 + floor * 0.004))) add(r.weighted(heavy, (d) => d.weight));
  // the rest: mostly one kind of foot soldier, the others mixed in
  const main = r.weighted(fodder, (d) => d.weight * (floor - d.minFloor < 6 ? 1.3 : 1));
  while (left > 0) add(r.chance(0.6) ? main : r.weighted(fodder, (d) => d.weight));
  return out;
}

// Areas differ in how tough their monsters are (golems against cave vermin), and without a correction the
// difficulty would jump from one area to the next: four times the health in one area, a third of it in the
// next. Each area's monsters are brought most of the way to those of the first area (the depth's own curve
// does the rest): an area of tough monsters still feels tougher, just not several times so.
const NORM_PULL = 0.75;
const normCache = new Map<number, { hp: number; dmg: number }>();
let normRef: { hp: number; dps: number } | null = null;

/** the average health and damage per second of a monster of the floor's packs (both families, the first one is
 *  met more often; a group counts as many) */
function packAverage(floor: number) {
  const fams = familiesFor(floor);
  const r = new RNG(floor * 7919 + 13);
  let hp = 0,
    dps = 0,
    n = 0;
  fams.forEach((id, i) => {
    const share = i === 0 ? 0.65 : 0.35;
    for (let k = 0; k < 40; k++)
      for (const s of makePack(FAMILIES[id], floor, 8, r)) {
        const d = ENEMY_BY_ID[s.id];
        if (!d) continue;
        hp += share * s.n * d.hp;
        dps += share * s.n * (d.dmg / d.atkCd);
        n += share * s.n;
      }
  });
  return n ? { hp: hp / n, dps: dps / n } : { hp: 1, dps: 1 };
}

/** how much a regular monster's health and damage are scaled on this floor so that the areas line up */
export function areaNorm(floor: number) {
  const f = Math.max(1, Math.round(floor));
  let v = normCache.get(f);
  if (v) return v;
  if (!normRef) {
    // the first area, as it is met halfway through
    normRef = packAverage(6);
  }
  const a = packAverage(f);
  v = { hp: Math.pow(normRef.hp / a.hp, NORM_PULL), dmg: Math.pow(normRef.dps / a.dps, NORM_PULL) };
  normCache.set(f, v);
  return v;
}
