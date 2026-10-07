import { Element } from './types';

export type Behavior = 'melee' | 'ranged' | 'caster' | 'charger' | 'erratic' | 'summoner' | 'splitter' | 'mimic' | 'ghost' | 'thief';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  hp: number;
  dmg: number;
  speed: number;
  xp: number;
  behavior: Behavior;
  range: number; // attack range px
  atkCd: number; // seconds
  proj?: string;
  el?: Element;
  scale?: number;
  minFloor: number;
  weight: number;
  armor?: number;
  radius?: number;
  poison?: boolean;
  summon?: string;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'skeleton', name: 'Kostlivec', sprite: 'en_skeleton', hp: 32, dmg: 6, speed: 46, xp: 10, behavior: 'melee', range: 18, atkCd: 1.2, minFloor: 1, weight: 10 },
  { id: 'skelArcher', name: 'Kostlivý lučištník', sprite: 'en_skelArcher', hp: 24, dmg: 5, speed: 40, xp: 12, behavior: 'ranged', range: 110, atkCd: 1.8, proj: 'arrow', minFloor: 1, weight: 6 },
  { id: 'bat', name: 'Netopýr', sprite: 'en_bat', hp: 14, dmg: 4, speed: 78, xp: 6, behavior: 'erratic', range: 14, atkCd: 0.9, minFloor: 1, weight: 7, radius: 5 },
  { id: 'slime', name: 'Sliz', sprite: 'en_slime', hp: 36, dmg: 5, speed: 34, xp: 9, behavior: 'splitter', range: 16, atkCd: 1.1, minFloor: 1, weight: 6, poison: true },
  { id: 'goblin', name: 'Goblin', sprite: 'en_goblin', hp: 26, dmg: 6, speed: 64, xp: 11, behavior: 'melee', range: 16, atkCd: 0.9, minFloor: 3, weight: 8 },
  { id: 'spider', name: 'Jeskynní pavouk', sprite: 'en_spider', hp: 28, dmg: 5, speed: 70, xp: 12, behavior: 'charger', range: 16, atkCd: 1.0, minFloor: 4, weight: 6, poison: true },
  { id: 'zombie', name: 'Zombie', sprite: 'en_zombie', hp: 60, dmg: 9, speed: 28, xp: 14, behavior: 'melee', range: 18, atkCd: 1.5, minFloor: 5, weight: 6, armor: 5 },
  { id: 'cultist', name: 'Kultista', sprite: 'en_cultist', hp: 30, dmg: 7, speed: 38, xp: 16, behavior: 'caster', range: 120, atkCd: 2.0, proj: 'shadow', el: 'shadow', minFloor: 6, weight: 5 },
  { id: 'orc', name: 'Ork', sprite: 'en_orc', hp: 80, dmg: 12, speed: 44, xp: 20, behavior: 'charger', range: 20, atkCd: 1.4, minFloor: 8, weight: 6, armor: 10, scale: 1.15 },
  { id: 'imp', name: 'Ohnivý skřet', sprite: 'en_imp', hp: 30, dmg: 7, speed: 60, xp: 15, behavior: 'ranged', range: 100, atkCd: 1.5, proj: 'fire', el: 'fire', minFloor: 10, weight: 5 },
  { id: 'ghost', name: 'Přízrak', sprite: 'en_ghost', hp: 40, dmg: 8, speed: 50, xp: 18, behavior: 'ghost', range: 16, atkCd: 1.2, minFloor: 12, weight: 5 },
  { id: 'darkMage', name: 'Temný mág', sprite: 'en_darkMage', hp: 45, dmg: 10, speed: 36, xp: 24, behavior: 'summoner', range: 130, atkCd: 2.2, proj: 'shadow', el: 'shadow', minFloor: 14, weight: 4, summon: 'skeleton' },
  { id: 'golem', name: 'Kamenný golem', sprite: 'en_golem', hp: 180, dmg: 18, speed: 26, xp: 40, behavior: 'melee', range: 22, atkCd: 2.0, minFloor: 18, weight: 3, armor: 25, scale: 1.3, radius: 9 },
  { id: 'wraith', name: 'Ledový přízrak', sprite: 'en_wraith', hp: 50, dmg: 10, speed: 46, xp: 26, behavior: 'caster', range: 120, atkCd: 1.8, proj: 'ice', el: 'ice', minFloor: 20, weight: 4 },
  { id: 'mimic', name: 'Mimik', sprite: 'en_mimic', hp: 120, dmg: 14, speed: 62, xp: 50, behavior: 'mimic', range: 18, atkCd: 1.0, minFloor: 2, weight: 0, armor: 10 },
  // rare treasure goblin: never attacks, flees and escapes through a portal unless caught in time
  { id: 'thief', name: 'Zlatý skřet', sprite: 'en_goblin', hp: 60, dmg: 0, speed: 56, xp: 60, behavior: 'thief', range: 0, atkCd: 99, minFloor: 2, weight: 0, scale: 1.1 },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export type BossPattern = 'summon' | 'radial' | 'volley' | 'charge' | 'slam' | 'meteors' | 'breath' | 'teleport' | 'spiral';

export interface BossDef {
  id: string;
  name: string;
  sprite: string;
  scale: number;
  hp: number;
  dmg: number;
  speed: number;
  patterns: BossPattern[];
  proj: string;
  el: Element;
  summon: string;
  tint?: number;
}

export const BOSSES: BossDef[] = [
  { id: 'skelKing', name: 'Kostěný král', sprite: 'en_skelKing', scale: 2.2, hp: 700, dmg: 12, speed: 40, patterns: ['summon', 'slam', 'charge', 'radial'], proj: 'bone', el: 'phys', summon: 'skeleton' },
  { id: 'slimeKing', name: 'Obří sliz', sprite: 'en_slime', scale: 3.2, hp: 900, dmg: 13, speed: 36, patterns: ['slam', 'radial', 'summon', 'charge'], proj: 'poison', el: 'poison', summon: 'slime', tint: 0x9dff7a },
  { id: 'spiderQueen', name: 'Pavoučí královna', sprite: 'en_spider', scale: 2.8, hp: 1000, dmg: 14, speed: 56, patterns: ['volley', 'summon', 'charge', 'spiral'], proj: 'poison', el: 'poison', summon: 'spider', tint: 0xd070ff },
  { id: 'orcLord', name: 'Ork válečník Grukh', sprite: 'en_orc', scale: 2.3, hp: 1200, dmg: 18, speed: 48, patterns: ['charge', 'slam', 'summon', 'radial'], proj: 'axe', el: 'phys', summon: 'goblin', tint: 0xffb0b0 },
  { id: 'lich', name: 'Lich', sprite: 'en_lich', scale: 2.2, hp: 1100, dmg: 16, speed: 40, patterns: ['spiral', 'teleport', 'summon', 'meteors', 'volley'], proj: 'shadow', el: 'shadow', summon: 'skeleton' },
  { id: 'fireDemon', name: 'Démon plamenů', sprite: 'en_demon', scale: 2.4, hp: 1400, dmg: 20, speed: 46, patterns: ['meteors', 'breath', 'radial', 'charge'], proj: 'fire', el: 'fire', summon: 'imp' },
  { id: 'colossus', name: 'Kamenný kolos', sprite: 'en_golem', scale: 2.4, hp: 1800, dmg: 24, speed: 30, patterns: ['slam', 'volley', 'slam', 'radial'], proj: 'rock', el: 'phys', summon: 'golem', tint: 0xc8b8a0 },
  { id: 'vampLord', name: 'Upíří lord', sprite: 'en_vampire', scale: 2.2, hp: 1600, dmg: 20, speed: 60, patterns: ['teleport', 'summon', 'charge', 'spiral'], proj: 'blood', el: 'shadow', summon: 'bat' },
  { id: 'shadowKnight', name: 'Stínový rytíř', sprite: 'en_shadowKnight', scale: 2.2, hp: 1700, dmg: 24, speed: 64, patterns: ['charge', 'teleport', 'slam', 'volley'], proj: 'shadow', el: 'shadow', summon: 'ghost' },
  { id: 'dragon', name: 'Starý drak Vermithrax', sprite: 'en_dragon', scale: 2.6, hp: 2600, dmg: 28, speed: 44, patterns: ['breath', 'meteors', 'charge', 'radial', 'summon'], proj: 'fire', el: 'fire', summon: 'imp' },
];

export function isBossFloor(floor: number) {
  return floor % 5 === 0;
}

export function bossForFloor(floor: number): { def: BossDef; tier: number } {
  const idx = floor / 5 - 1;
  const def = BOSSES[idx % BOSSES.length];
  const tier = Math.floor(idx / BOSSES.length);
  return { def, tier };
}

// Scaling curves
// Enemy power grows polynomially plus a gentle exponential so the endless dungeon keeps up with loot
export function enemyHpScale(floor: number) {
  const f = floor - 1;
  return 1.15 * (1 + 0.35 * f + 0.02 * f * f) * Math.pow(1.03, f);
}
export function enemyDmgScale(floor: number) {
  const f = floor - 1;
  return 1.6 * (1 + 0.26 * f + 0.012 * f * f) * Math.pow(1.02, f);
}
export function enemyXpScale(floor: number) {
  return 1 + 0.25 * (floor - 1) + 0.004 * (floor - 1) * (floor - 1);
}
