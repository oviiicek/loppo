import { Element } from './types';
import { familiesFor } from './biomes';

export type Behavior =
  | 'melee'
  | 'ranged'
  | 'caster'
  | 'charger'
  | 'erratic'
  | 'summoner'
  | 'splitter'
  | 'mimic'
  | 'ghost'
  | 'thief'
  // keeps its distance and backs away from the hero
  | 'kiter'
  // aims for a long time, then one huge shot from afar
  | 'sniper'
  // fast and leaps at the hero
  | 'leaper'
  // stays behind the others and works on them (healing, blessings, portals)
  | 'support'
  // runs at the hero and blows up
  | 'bomber'
  // lurks inside the walls and strikes from them
  | 'lurker'
  // does not move (portals, eggs)
  | 'static';

/** what a monster does in its pack; the dangerous ones carry a sign above the head ("kill me first") */
export type Role = 'healer' | 'reviver' | 'summoner' | 'guardian' | 'sniper' | 'buffer' | 'curser' | 'berserker' | 'heavy';

/** roles that get a sign above the head */
export const PRIORITY_ROLES: Role[] = ['healer', 'reviver', 'summoner', 'guardian', 'sniper', 'buffer', 'curser'];

export const ROLE_INFO: Record<Role, { name: string; color: string; desc: string }> = {
  healer: { name: 'léčitel', color: '#52ff8f', desc: 'léčí ostatní nestvůry' },
  reviver: { name: 'křísitel', color: '#9dffb0', desc: 'oživuje padlé nestvůry' },
  summoner: { name: 'vyvolávač', color: '#c77dff', desc: 'povolává další nestvůry' },
  guardian: { name: 'ochránce', color: '#7fb2ff', desc: 'chrání nestvůry kolem sebe' },
  sniper: { name: 'odstřelovač', color: '#ff5a4a', desc: 'střílí zezadu, dlouho míří' },
  buffer: { name: 'posilovač', color: '#ffb04a', desc: 'posiluje ostatní a oslabuje hrdinu' },
  curser: { name: 'zaklínač', color: '#e07dff', desc: 'proklíná hrdinu' },
  berserker: { name: 'berserkr', color: '#ff7a4a', desc: 'tlačí se dopředu a odhazuje hrdinu' },
  heavy: { name: 'obr', color: '#c8b8a0', desc: 'pomalý, ale nesmírně odolný' },
};

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
  /** its job in a pack (see ROLE_INFO) */
  role?: Role;
  /** its special power (see game/powers.ts) */
  ability?: string;
  /** weapons pass through it (half damage), spells tear it apart (+35 %) */
  ethereal?: boolean;
  /** comes as a crowd of this many (a swarm of bats) */
  group?: number;
  /** not a real monster (portals, eggs, illusions): no bestiary entry, no champions, no corruption */
  thing?: boolean;
  /** a feminine or neuter name (for the words around it) */
  g?: 'f' | 'n';
}

/** "Zkažený / Zkažená / Zkažené …" */
export function corruptName(def: EnemyDef) {
  return `${def.g === 'f' ? 'Zkažená' : def.g === 'n' ? 'Zkažené' : 'Zkažený'} ${def.name.charAt(0).toLowerCase() + def.name.slice(1)}`;
}

export const ENEMIES: EnemyDef[] = [
  // --- the undead (crypts): skeleton → archer → knight → mage → necromancer → bone giant → the Bone King
  { id: 'skeleton', name: 'Kostlivec', sprite: 'en_skeleton', hp: 32, dmg: 6, speed: 46, xp: 10, behavior: 'melee', range: 18, atkCd: 1.2, minFloor: 1, weight: 10 },
  { id: 'skelArcher', name: 'Kostěný lučištník', sprite: 'en_skelArcher', hp: 24, dmg: 5, speed: 44, xp: 12, behavior: 'kiter', range: 115, atkCd: 1.8, proj: 'arrow', minFloor: 1, weight: 6 },
  { id: 'skelKnight', name: 'Kostěný rytíř', sprite: 'en_skelKnight', hp: 70, dmg: 9, speed: 38, xp: 22, behavior: 'melee', range: 18, atkCd: 1.4, minFloor: 4, weight: 4, armor: 14, scale: 1.1, role: 'guardian', ability: 'guard' },
  { id: 'skelMage', name: 'Kostěný mág', sprite: 'en_skelMage', hp: 30, dmg: 8, speed: 36, xp: 16, behavior: 'caster', range: 120, atkCd: 2.0, proj: 'shadow', el: 'shadow', minFloor: 5, weight: 5 },
  { id: 'necromancer', name: 'Nekromant', sprite: 'en_necromancer', hp: 48, dmg: 8, speed: 34, xp: 30, behavior: 'support', range: 130, atkCd: 2.4, proj: 'shadow', el: 'shadow', minFloor: 6, weight: 3, role: 'reviver', ability: 'revive', summon: 'skeleton' },
  { id: 'boneSniper', name: 'Kostěný odstřelovač', sprite: 'en_boneSniper', hp: 28, dmg: 7, speed: 34, xp: 24, behavior: 'sniper', range: 210, atkCd: 4.2, proj: 'arrow', minFloor: 8, weight: 3, role: 'sniper' },
  { id: 'boneGiant', name: 'Kostěný obr', sprite: 'en_boneGiant', hp: 200, dmg: 20, speed: 28, xp: 50, behavior: 'melee', range: 24, atkCd: 2.2, minFloor: 12, weight: 2, armor: 12, scale: 1.45, radius: 9, role: 'heavy', ability: 'slam' },
  { id: 'bat', name: 'Netopýr', sprite: 'en_bat', hp: 14, dmg: 4, speed: 78, xp: 6, behavior: 'erratic', range: 14, atkCd: 0.9, minFloor: 1, weight: 7, radius: 5 },
  { id: 'slime', name: 'Sliz', sprite: 'en_slime', hp: 36, dmg: 5, speed: 34, xp: 9, behavior: 'splitter', range: 16, atkCd: 1.1, minFloor: 1, weight: 6, poison: true },
  // --- greenskins: goblins with their shaman, orcs and their berserkers, trolls
  { id: 'goblin', name: 'Goblin', sprite: 'en_goblin', hp: 26, dmg: 6, speed: 64, xp: 11, behavior: 'melee', range: 16, atkCd: 0.9, minFloor: 2, weight: 8 },
  { id: 'goblinShaman', name: 'Goblin šaman', sprite: 'en_goblinShaman', hp: 30, dmg: 5, speed: 46, xp: 20, behavior: 'support', range: 110, atkCd: 2.2, proj: 'bolt', el: 'lightning', minFloor: 4, weight: 3, role: 'healer', ability: 'heal' },
  // --- spiders: little spider → venomous → weaver → bomber → guardian → Spider Mother → the Spider Queen
  { id: 'spiderling', name: 'Malý pavouk', sprite: 'en_spiderling', hp: 10, dmg: 3, speed: 84, xp: 4, behavior: 'melee', range: 12, atkCd: 0.8, minFloor: 2, weight: 5, radius: 3, group: 3 },
  { id: 'spider', name: 'Jedovatý pavouk', sprite: 'en_spider', hp: 28, dmg: 5, speed: 70, xp: 12, behavior: 'charger', range: 16, atkCd: 1.0, minFloor: 4, weight: 6, poison: true },
  { id: 'webSpider', name: 'Pavouk tkadlec', sprite: 'en_webSpider', hp: 30, dmg: 5, speed: 50, xp: 16, behavior: 'kiter', range: 120, atkCd: 2.6, proj: 'web', minFloor: 6, weight: 4, ability: 'web' },
  { id: 'blastSpider', name: 'Výbušný pavouk', sprite: 'en_blastSpider', hp: 18, dmg: 10, speed: 92, xp: 12, behavior: 'bomber', range: 20, atkCd: 1, el: 'fire', minFloor: 9, weight: 4, radius: 4 },
  { id: 'spiderGuard', name: 'Pavoučí strážce', sprite: 'en_spiderGuard', hp: 110, dmg: 12, speed: 40, xp: 34, behavior: 'melee', range: 20, atkCd: 1.5, minFloor: 12, weight: 3, armor: 18, scale: 1.3, radius: 7, poison: true, role: 'guardian', ability: 'guard' },
  { id: 'spiderMother', g: 'f', name: 'Pavoučí matka', sprite: 'en_spiderMother', hp: 140, dmg: 10, speed: 26, xp: 50, behavior: 'support', range: 110, atkCd: 2.6, proj: 'poison', el: 'poison', minFloor: 15, weight: 2, scale: 1.5, radius: 9, role: 'summoner', ability: 'eggs', summon: 'spiderling' },
  { id: 'spiderEgg', g: 'n', name: 'Pavoučí vejce', sprite: 'en_spiderEgg', hp: 16, dmg: 0, speed: 0, xp: 2, behavior: 'static', range: 0, atkCd: 99, minFloor: 9999, weight: 0, radius: 4, ability: 'hatch', thing: true },
  { id: 'zombie', g: 'f', name: 'Zombie', sprite: 'en_zombie', hp: 60, dmg: 9, speed: 28, xp: 14, behavior: 'melee', range: 18, atkCd: 1.5, minFloor: 3, weight: 6, armor: 5 },
  { id: 'cultist', name: 'Kultista', sprite: 'en_cultist', hp: 30, dmg: 7, speed: 38, xp: 16, behavior: 'caster', range: 120, atkCd: 2.0, proj: 'shadow', el: 'shadow', minFloor: 6, weight: 5 },
  { id: 'orc', name: 'Ork', sprite: 'en_orc', hp: 80, dmg: 12, speed: 44, xp: 20, behavior: 'charger', range: 20, atkCd: 1.4, minFloor: 8, weight: 6, armor: 10, scale: 1.15 },
  { id: 'orcBerserker', name: 'Ork berserkr', sprite: 'en_orcBerserker', hp: 95, dmg: 14, speed: 58, xp: 30, behavior: 'charger', range: 20, atkCd: 1.2, minFloor: 10, weight: 3, armor: 6, scale: 1.2, role: 'berserker', ability: 'berserk' },
  { id: 'imp', name: 'Ohnivý skřet', sprite: 'en_imp', hp: 30, dmg: 7, speed: 60, xp: 15, behavior: 'ranged', range: 100, atkCd: 1.5, proj: 'fire', el: 'fire', minFloor: 10, weight: 5 },
  { id: 'ghost', name: 'Duch', sprite: 'en_ghost', hp: 40, dmg: 8, speed: 50, xp: 18, behavior: 'ghost', range: 16, atkCd: 1.2, minFloor: 9, weight: 5, ethereal: true },
  { id: 'darkMage', name: 'Temný mág', sprite: 'en_darkMage', hp: 45, dmg: 10, speed: 36, xp: 24, behavior: 'summoner', range: 130, atkCd: 2.2, proj: 'shadow', el: 'shadow', minFloor: 14, weight: 4, summon: 'skeleton', role: 'summoner' },
  // --- ghouls
  { id: 'ghoul', name: 'Ghúl', sprite: 'en_ghoul', hp: 34, dmg: 8, speed: 70, xp: 14, behavior: 'leaper', range: 16, atkCd: 0.9, minFloor: 6, weight: 6 },
  { id: 'plagueGhoul', name: 'Morový ghúl', sprite: 'en_plagueGhoul', hp: 50, dmg: 7, speed: 50, xp: 20, behavior: 'melee', range: 16, atkCd: 1.2, minFloor: 9, weight: 4, poison: true, ability: 'plague' },
  { id: 'hungryGhoul', name: 'Hladový ghúl', sprite: 'en_hungryGhoul', hp: 44, dmg: 8, speed: 64, xp: 18, behavior: 'melee', range: 16, atkCd: 1.0, minFloor: 10, weight: 4, ability: 'eat' },
  { id: 'alphaGhoul', name: 'Alfa ghúl', sprite: 'en_alphaGhoul', hp: 110, dmg: 14, speed: 62, xp: 45, behavior: 'leaper', range: 18, atkCd: 1.2, minFloor: 14, weight: 2, scale: 1.3, radius: 7, role: 'summoner', ability: 'roar', summon: 'ghoul' },
  { id: 'mutantGhoul', name: 'Mutovaný ghúl', sprite: 'en_mutantGhoul', hp: 50, dmg: 10, speed: 62, xp: 24, behavior: 'melee', range: 16, atkCd: 1.0, minFloor: 18, weight: 4, ability: 'mutate' },
  // --- golems
  { id: 'golem', name: 'Kamenný golem', sprite: 'en_golem', hp: 200, dmg: 18, speed: 20, xp: 44, behavior: 'melee', range: 22, atkCd: 2.0, minFloor: 18, weight: 3, armor: 45, scale: 1.3, radius: 9, role: 'heavy' },
  { id: 'brokenGolem', name: 'Rozbitý golem', sprite: 'en_brokenGolem', hp: 150, dmg: 14, speed: 26, xp: 40, behavior: 'melee', range: 22, atkCd: 1.9, minFloor: 20, weight: 3, armor: 22, scale: 1.3, radius: 9, ability: 'shatter', summon: 'golemShard' },
  { id: 'golemShard', name: 'Úlomek golema', sprite: 'en_brokenGolem', hp: 45, dmg: 8, speed: 40, xp: 8, behavior: 'melee', range: 18, atkCd: 1.4, minFloor: 9999, weight: 0, armor: 15, scale: 0.75 },
  { id: 'crystalGolem', name: 'Krystalový golem', sprite: 'en_crystalGolem', hp: 170, dmg: 15, speed: 24, xp: 42, behavior: 'melee', range: 22, atkCd: 1.9, minFloor: 24, weight: 3, armor: 20, scale: 1.3, radius: 9, ability: 'crystal' },
  { id: 'stormGolem', name: 'Bouřný golem', sprite: 'en_stormGolem', hp: 170, dmg: 15, speed: 26, xp: 44, behavior: 'melee', range: 22, atkCd: 2.0, el: 'lightning', minFloor: 32, weight: 3, armor: 22, scale: 1.3, radius: 9, ability: 'storm' },
  { id: 'wraith', name: 'Ledový přízrak', sprite: 'en_wraith', hp: 50, dmg: 10, speed: 46, xp: 26, behavior: 'caster', range: 120, atkCd: 1.8, proj: 'ice', el: 'ice', minFloor: 20, weight: 4 },
  // --- the cult: witches, priests and mages of every kind
  { id: 'hexWitch', g: 'f', name: 'Prokletá čarodějnice', sprite: 'en_hexWitch', hp: 40, dmg: 8, speed: 38, xp: 28, behavior: 'caster', range: 130, atkCd: 2.2, proj: 'shadow', el: 'shadow', minFloor: 9, weight: 3, role: 'curser', ability: 'hex' },
  { id: 'darkPriest', name: 'Temný kněz', sprite: 'en_darkPriest', hp: 44, dmg: 7, speed: 34, xp: 30, behavior: 'support', range: 140, atkCd: 2.4, proj: 'shadow', el: 'shadow', minFloor: 10, weight: 3, role: 'buffer', ability: 'bless' },
  { id: 'bloodWitch', g: 'f', name: 'Krvavá čarodějnice', sprite: 'en_bloodWitch', hp: 55, dmg: 9, speed: 38, xp: 32, behavior: 'caster', range: 120, atkCd: 2.0, proj: 'blood', el: 'shadow', minFloor: 16, weight: 3, role: 'healer', ability: 'sacrifice' },
  { id: 'portalMage', name: 'Portálový mág', sprite: 'en_portalMage', hp: 50, dmg: 8, speed: 34, xp: 34, behavior: 'support', range: 130, atkCd: 2.4, proj: 'magic', el: 'shadow', minFloor: 16, weight: 2, role: 'summoner', ability: 'portal' },
  { id: 'portal', name: 'Portál', sprite: 'en_portal', hp: 40, dmg: 0, speed: 0, xp: 6, behavior: 'static', range: 0, atkCd: 99, minFloor: 9999, weight: 0, radius: 6, ability: 'portalSpawn', thing: true },
  { id: 'illusionist', name: 'Iluzionista', sprite: 'en_illusionist', hp: 44, dmg: 8, speed: 40, xp: 30, behavior: 'caster', range: 120, atkCd: 2.0, proj: 'magic', el: 'shadow', minFloor: 20, weight: 3, ability: 'illusion' },
  { id: 'timeMage', name: 'Časový mág', sprite: 'en_timeMage', hp: 46, dmg: 8, speed: 36, xp: 34, behavior: 'support', range: 140, atkCd: 2.4, proj: 'time', el: 'ice', minFloor: 24, weight: 2, role: 'buffer', ability: 'time' },
  { id: 'mageHunter', name: 'Lovec mágů', sprite: 'en_mageHunter', hp: 60, dmg: 12, speed: 60, xp: 34, behavior: 'melee', range: 18, atkCd: 1.0, minFloor: 24, weight: 3, ability: 'hunter' },
  { id: 'mindMage', name: 'Mág mysli', sprite: 'en_mindMage', hp: 42, dmg: 7, speed: 36, xp: 32, behavior: 'caster', range: 130, atkCd: 2.6, proj: 'mind', el: 'shadow', minFloor: 26, weight: 2, role: 'curser', ability: 'mind' },
  // --- vampires
  { id: 'swarmBat', name: 'Netopýří roj', sprite: 'en_swarmBat', hp: 6, dmg: 2.5, speed: 92, xp: 3, behavior: 'erratic', range: 12, atkCd: 0.8, minFloor: 8, weight: 3, radius: 3, group: 7, ability: 'swarm' },
  { id: 'vampire', name: 'Vampýr', sprite: 'en_vampire', hp: 60, dmg: 11, speed: 56, xp: 30, behavior: 'melee', range: 18, atkCd: 1.1, minFloor: 12, weight: 4, ability: 'vampire' },
  { id: 'vampireLord', name: 'Vampýrský lord', sprite: 'en_vampireLord', hp: 160, dmg: 16, speed: 50, xp: 60, behavior: 'melee', range: 20, atkCd: 1.3, minFloor: 22, weight: 2, armor: 8, scale: 1.3, radius: 7, role: 'heavy', ability: 'bloodpool' },
  // --- aberrations of the void
  { id: 'manaBeast', g: 'f', name: 'Manová bestie', sprite: 'en_manaBeast', hp: 90, dmg: 12, speed: 46, xp: 40, behavior: 'charger', range: 18, atkCd: 1.3, minFloor: 30, weight: 3, scale: 1.2, radius: 7, ability: 'manaShield' },
  { id: 'buffEater', name: 'Požírač buffů', sprite: 'en_buffEater', hp: 80, dmg: 11, speed: 44, xp: 40, behavior: 'melee', range: 18, atkCd: 1.2, minFloor: 34, weight: 3, ability: 'eatBuff' },
  { id: 'adaptive', g: 'n', name: 'Adaptivní monstrum', sprite: 'en_adaptive', hp: 120, dmg: 13, speed: 40, xp: 46, behavior: 'melee', range: 20, atkCd: 1.3, minFloor: 36, weight: 2, scale: 1.2, radius: 7, ability: 'adapt' },
  { id: 'mirrorDemon', name: 'Zrcadlový démon', sprite: 'en_mirrorDemon', hp: 75, dmg: 12, speed: 42, xp: 44, behavior: 'caster', range: 120, atkCd: 2.2, proj: 'magic', el: 'shadow', minFloor: 40, weight: 2, ability: 'mirror' },
  // deeper biomes (caves 51+, ice 101+, forge 151+, abyss 201+) – most of their families appear earlier too
  { id: 'mushroom', name: 'Houbař', sprite: 'en_mushroom', hp: 55, dmg: 9, speed: 30, xp: 22, behavior: 'caster', range: 110, atkCd: 2.2, proj: 'poison', el: 'poison', minFloor: 6, weight: 5, poison: true, role: 'healer', ability: 'spores' },
  { id: 'troll', name: 'Jeskynní troll', sprite: 'en_troll', hp: 150, dmg: 16, speed: 40, xp: 36, behavior: 'charger', range: 22, atkCd: 1.6, minFloor: 15, weight: 4, armor: 12, scale: 1.35, radius: 8, role: 'heavy' },
  { id: 'iceGolem', name: 'Ledový golem', sprite: 'en_iceGolem', hp: 170, dmg: 15, speed: 28, xp: 38, behavior: 'melee', range: 22, atkCd: 1.8, el: 'ice', minFloor: 101, weight: 4, armor: 20, scale: 1.25, radius: 8, role: 'heavy' },
  { id: 'frostWolf', name: 'Mrazivý vlk', sprite: 'en_frostWolf', hp: 45, dmg: 9, speed: 84, xp: 20, behavior: 'charger', range: 16, atkCd: 0.9, el: 'ice', minFloor: 101, weight: 6 },
  { id: 'hellhound', name: 'Pekelný pes', sprite: 'en_hellhound', hp: 50, dmg: 11, speed: 88, xp: 22, behavior: 'charger', range: 16, atkCd: 0.9, el: 'fire', minFloor: 151, weight: 6 },
  { id: 'magmaGolem', name: 'Lávový golem', sprite: 'en_magmaGolem', hp: 180, dmg: 17, speed: 26, xp: 40, behavior: 'melee', range: 22, atkCd: 1.9, el: 'fire', minFloor: 28, weight: 4, armor: 22, scale: 1.3, radius: 9, ability: 'lava' },
  { id: 'voidEye', g: 'n', name: 'Oko propasti', sprite: 'en_voidEye', hp: 48, dmg: 11, speed: 40, xp: 26, behavior: 'caster', range: 130, atkCd: 1.9, proj: 'shadow', el: 'shadow', minFloor: 201, weight: 5 },
  { id: 'shade', name: 'Stín', sprite: 'en_shade', hp: 55, dmg: 12, speed: 62, xp: 26, behavior: 'lurker', range: 30, atkCd: 1.4, minFloor: 30, weight: 4 },
  // Elara's shadow sisters (only summoned by her)
  { id: 'shadowClone', name: 'Stín Elary', sprite: 'en_elaraDark', hp: 40, dmg: 9, speed: 40, xp: 0, behavior: 'caster', range: 120, atkCd: 1.8, proj: 'shadow', el: 'shadow', minFloor: 9999, weight: 0 },
  { id: 'mimic', name: 'Mimik', sprite: 'en_mimic', hp: 120, dmg: 14, speed: 62, xp: 50, behavior: 'mimic', range: 18, atkCd: 1.0, minFloor: 2, weight: 0, armor: 10 },
  // rare treasure goblin: never attacks, flees and escapes through a portal unless caught in time
  { id: 'thief', name: 'Zlatý skřet', sprite: 'en_thief', hp: 60, dmg: 0, speed: 56, xp: 60, behavior: 'thief', range: 0, atkCd: 99, minFloor: 2, weight: 0, scale: 1.1 },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export type BossPattern =
  | 'summon'
  | 'radial'
  | 'volley'
  | 'charge'
  | 'slam'
  | 'meteors'
  | 'breath'
  | 'teleport'
  | 'spiral'
  // story guardians
  | 'sweep'
  | 'chains'
  | 'spores'
  | 'roots'
  | 'shardRain'
  | 'icePrison'
  | 'clones'
  | 'darkNova'
  | 'hands'
  | 'lasers'
  | 'voidZones'
  // learned in the later phases of a fight
  | 'spikes'
  | 'cross'
  | 'nova'
  | 'web'
  | 'drain';

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
  /** feminine name (for the words around it) */
  fem?: boolean;
}

export const BOSSES: BossDef[] = [
  { id: 'skelKing', name: 'Kostěný král', sprite: 'en_skelKing', scale: 2.2, hp: 700, dmg: 12, speed: 40, patterns: ['summon', 'slam', 'charge', 'radial'], proj: 'bone', el: 'phys', summon: 'skeleton' },
  { id: 'slimeKing', name: 'Obří sliz', sprite: 'en_slime', scale: 3.2, hp: 900, dmg: 13, speed: 36, patterns: ['slam', 'radial', 'summon', 'charge'], proj: 'poison', el: 'poison', summon: 'slime', tint: 0x9dff7a },
  { id: 'spiderQueen', name: 'Pavoučí královna', sprite: 'en_spider', scale: 2.8, hp: 1000, dmg: 14, speed: 56, patterns: ['volley', 'summon', 'charge', 'spiral'], proj: 'poison', el: 'poison', summon: 'spider', tint: 0xd070ff, fem: true },
  { id: 'orcLord', name: 'Ork válečník Grukh', sprite: 'en_orc', scale: 2.3, hp: 1200, dmg: 18, speed: 48, patterns: ['charge', 'slam', 'summon', 'radial'], proj: 'axe', el: 'phys', summon: 'goblin', tint: 0xffb0b0 },
  { id: 'lich', name: 'Lich', sprite: 'en_lich', scale: 2.2, hp: 1100, dmg: 16, speed: 40, patterns: ['spiral', 'teleport', 'summon', 'meteors', 'volley'], proj: 'shadow', el: 'shadow', summon: 'skeleton' },
  { id: 'fireDemon', name: 'Démon plamenů', sprite: 'en_demon', scale: 2.4, hp: 1400, dmg: 20, speed: 46, patterns: ['meteors', 'breath', 'radial', 'charge'], proj: 'fire', el: 'fire', summon: 'imp' },
  { id: 'colossus', name: 'Kamenný kolos', sprite: 'en_golem', scale: 2.4, hp: 1800, dmg: 24, speed: 30, patterns: ['slam', 'volley', 'slam', 'radial'], proj: 'rock', el: 'phys', summon: 'golem', tint: 0xc8b8a0 },
  { id: 'vampLord', name: 'Upíří lord', sprite: 'en_vampire', scale: 2.2, hp: 1600, dmg: 20, speed: 60, patterns: ['teleport', 'summon', 'charge', 'spiral'], proj: 'blood', el: 'shadow', summon: 'bat' },
  { id: 'shadowKnight', name: 'Stínový rytíř', sprite: 'en_shadowKnight', scale: 2.2, hp: 1700, dmg: 24, speed: 64, patterns: ['charge', 'teleport', 'slam', 'volley'], proj: 'shadow', el: 'shadow', summon: 'ghost' },
  { id: 'dragon', name: 'Starý drak Vermithrax', sprite: 'en_dragon', scale: 2.6, hp: 2600, dmg: 28, speed: 44, patterns: ['breath', 'meteors', 'charge', 'radial', 'summon'], proj: 'fire', el: 'fire', summon: 'imp' },
];

/** the guardian waits on the last floor of every band of ten */
export function isBossFloor(floor: number) {
  return floor % 10 === 0;
}

/** every 50th floor (up to the end of the story) belongs to a story boss */
export function isStoryBossFloor(floor: number) {
  return floor % 50 === 0 && floor <= STORY_END;
}

/** the monster families each guardian rules */
const BOSS_FAMILIES: Record<string, string[]> = {
  skelKing: ['undead'],
  slimeKing: ['vermin'],
  spiderQueen: ['spider'],
  orcLord: ['greenskin'],
  lich: ['ghoul', 'cult', 'undead'],
  fireDemon: ['hell'],
  colossus: ['golem'],
  vampLord: ['vampire'],
  shadowKnight: ['void', 'frost'],
  dragon: ['hell', 'void', 'frost'],
};

export function bossForFloor(floor: number): { def: BossDef; tier: number } {
  // the regular guardians cycle on the boss floors that are not story floors
  const storyBefore = Math.floor(Math.min(floor - 1, STORY_END) / 50);
  const idx = Math.max(0, floor / 10 - 1 - storyBefore);
  const def = BOSSES[idx % BOSSES.length];
  const tier = Math.floor(idx / BOSSES.length);
  // the guardian belongs to the area's families (the first boss floor of an area to the main one), with the
  // strength of the one whose turn it is
  const fams = familiesFor(floor);
  const fam = Math.floor(floor / 10) % 2 ? fams[0] : fams[1];
  const fits = BOSSES.filter((b) => BOSS_FAMILIES[b.id]?.includes(fam));
  if (!fits.length || fits.includes(def)) return { def, tier };
  const pick = fits[Math.floor(floor / 10) % fits.length];
  return { def: { ...pick, hp: def.hp, dmg: def.dmg }, tier };
}

/** health and damage a guardian is built from: the later ones in the list are tougher, but only moderately */
export function bossBaseStats(def: { hp: number; dmg: number }) {
  return { hp: def.hp > 1400 ? 1400 + (def.hp - 1400) * 0.4 : def.hp, dmg: 12 + (def.dmg - 12) * 0.35 };
}

// Scaling curves
// Floors 1–40 are tuned by play-testing. Deeper down, monster damage grows with the health of a
// well-equipped hero instead of running away exponentially (so the story can be finished on floor
// 250), and monster health eases off a little in the deepest floors. Past the end of the story (the
// endless depths) both ramp up again.
export const STORY_END = 250;

function baseDmgScale(floor: number) {
  const f = floor - 1;
  return 1.6 * (1 + 0.26 * f + 0.012 * f * f) * Math.pow(1.02, f);
}

export function enemyHpScale(floor: number) {
  const f = floor - 1;
  const base = 1.15 * (1 + 0.35 * f + 0.02 * f * f) * Math.pow(1.03, f);
  if (floor <= 100) return base;
  const g = Math.min(floor, STORY_END) - 100;
  return base / (1 + 0.005 * g + 0.00011 * g * g);
}
export function enemyDmgScale(floor: number) {
  if (floor <= 40) return baseDmgScale(floor);
  const g = Math.min(floor, STORY_END) - 40;
  const v = baseDmgScale(40) * (1 + 0.0242 * g) * (1 + 0.0018 * g);
  return floor > STORY_END ? v * Math.pow(1.02, floor - STORY_END) : v;
}
export function enemyXpScale(floor: number) {
  return 1 + 0.25 * (floor - 1) + 0.004 * (floor - 1) * (floor - 1);
}
/** monster armour stops growing at some depth (otherwise it would shrug off nearly all physical damage) */
export function enemyArmor(base: number, floor: number) {
  return base * (1 + Math.min(floor, 40) * 0.15);
}
export function bossArmor(floor: number) {
  return 10 + Math.min(floor, 60) * 1.5;
}

// ---------------------------------------------------------------------------
// Story guardians (floors 50, 100, 150, 200 and the final one on 250). Every hundredth floor and the
// end have several stages: when a stage's health runs out the guardian changes and gets a new bar.
// Health and damage are multiples of a reference guardian on that floor. Very strong heroes are held back
// by a damage budget instead (see Combat.damageEnemy), so the health can stay fair for everyone else.
// ---------------------------------------------------------------------------
export interface StoryPhase {
  sprite: string;
  scale: number;
  tint?: number;
  hp: number;
  dmg: number;
  speed: number;
  patterns: BossPattern[];
  proj: string;
  el: Element;
  summon: string;
  /** seconds between attacks */
  cadence: number;
  /** cutscene played when this stage begins (stages after the first) */
  intro?: string;
}

export interface StoryBossDef {
  floor: number;
  id: string;
  name: string;
  title: string;
  intro: string;
  outro: string;
  phases: StoryPhase[];
}

export const STORY_BOSSES: StoryBossDef[] = [
  {
    floor: 50,
    id: 'morgrim',
    name: 'Morgrim',
    title: 'Strážce bran',
    intro: 'boss50',
    outro: 'boss50end',
    phases: [{ sprite: 'en_morgrim', scale: 1.5, hp: 2.0, dmg: 1.0, speed: 38, patterns: ['sweep', 'chains', 'summon', 'slam', 'sweep', 'charge', 'radial'], proj: 'axe', el: 'phys', summon: 'skeleton', cadence: 3.0 }],
  },
  {
    floor: 100,
    id: 'sporeMother',
    name: 'Matka spor',
    title: 'Srdce jeskyní',
    intro: 'boss100',
    outro: 'boss100end',
    phases: [
      { sprite: 'en_sporeMother', scale: 1.45, hp: 2.6, dmg: 1.0, speed: 24, patterns: ['spores', 'summon', 'volley', 'slam', 'spores', 'radial'], proj: 'poison', el: 'poison', summon: 'mushroom', cadence: 3.2 },
      { sprite: 'en_sporeMother', scale: 1.65, tint: 0xb8ffe8, hp: 2.6, dmg: 1.1, speed: 32, patterns: ['roots', 'spores', 'spiral', 'summon', 'roots', 'radial'], proj: 'poison', el: 'poison', summon: 'mushroom', cadence: 2.7, intro: 'boss100p2' },
    ],
  },
  {
    floor: 150,
    id: 'isolda',
    name: 'Isolda',
    title: 'Ledová královna',
    intro: 'boss150',
    outro: 'boss150end',
    phases: [{ sprite: 'en_isolda', scale: 1.45, hp: 3.2, dmg: 1.05, speed: 40, patterns: ['shardRain', 'icePrison', 'spiral', 'teleport', 'volley', 'summon', 'icePrison'], proj: 'ice', el: 'ice', summon: 'frostWolf', cadence: 2.9 }],
  },
  {
    floor: 200,
    id: 'elara',
    name: 'Elara',
    title: 'Hlas hlubin',
    intro: 'boss200',
    outro: 'boss200end',
    phases: [
      { sprite: 'en_elaraDark', scale: 1.4, hp: 1.9, dmg: 1.0, speed: 46, patterns: ['volley', 'teleport', 'meteors', 'spiral'], proj: 'shadow', el: 'shadow', summon: 'shade', cadence: 2.9 },
      { sprite: 'en_elaraDark', scale: 1.4, tint: 0xe0b0ff, hp: 1.9, dmg: 1.05, speed: 50, patterns: ['clones', 'teleport', 'radial', 'volley', 'meteors'], proj: 'shadow', el: 'shadow', summon: 'shade', cadence: 2.7, intro: 'boss200p2' },
      { sprite: 'en_elaraWings', scale: 1.55, hp: 2.2, dmg: 1.15, speed: 56, patterns: ['darkNova', 'meteors', 'spiral', 'charge', 'teleport', 'clones'], proj: 'shadow', el: 'shadow', summon: 'shade', cadence: 2.4, intro: 'boss200p3' },
    ],
  },
  {
    floor: 250,
    id: 'nyxthar',
    name: "Nyx'thar",
    title: 'Pán hlubin',
    intro: 'boss250',
    outro: 'ending',
    phases: [
      { sprite: 'en_nyxShadow', scale: 1.6, hp: 1.8, dmg: 1.05, speed: 44, patterns: ['hands', 'spiral', 'teleport', 'summon', 'volley', 'hands'], proj: 'shadow', el: 'shadow', summon: 'shade', cadence: 2.8 },
      { sprite: 'en_nyxTrue', scale: 1.7, hp: 2.0, dmg: 1.1, speed: 16, patterns: ['lasers', 'voidZones', 'radial', 'summon', 'lasers', 'meteors'], proj: 'shadow', el: 'shadow', summon: 'voidEye', cadence: 2.7, intro: 'boss250p2' },
      { sprite: 'en_nyxTrue', scale: 1.9, tint: 0xff9ad8, hp: 2.3, dmg: 1.2, speed: 22, patterns: ['lasers', 'hands', 'darkNova', 'voidZones', 'spiral', 'lasers'], proj: 'shadow', el: 'shadow', summon: 'voidEye', cadence: 2.3, intro: 'boss250p3' },
    ],
  },
];

export function storyBossForFloor(floor: number): StoryBossDef | null {
  return STORY_BOSSES.find((b) => b.floor === floor) ?? null;
}

/** health and damage of the reference guardian a story guardian's stages are measured against */
export function storyBossBase(floor: number) {
  return { hp: 1400 * 0.5 * enemyHpScale(floor), dmg: 15 * enemyDmgScale(floor) };
}
