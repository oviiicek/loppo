// The fate of a floor: on arrival a floor may turn out different from the others (darker, richer, more
// dangerous …); the banner and the floor's name in the HUD say so. The dangerous path (chosen at the doors
// after a floor) works the same way and stacks with a fate.

export interface FloorMod {
  id: string;
  name: string;
  desc: string;
  /** a word for the fate card ('danger' paints it red, 'gift' gold) */
  tone?: 'danger' | 'gift' | 'odd';
  enemyHp?: number;
  enemyDmg?: number;
  enemySpeed?: number;
  xp?: number;
  gold?: number;
  mf?: number;
  extraEnemies?: number;
  eliteMult?: number;
  darkness?: number;
  /** the colour of the darkness (the blood moon paints it red) */
  darkColor?: number;
  chestBonus?: boolean;
  /** more chests and gold scattered over the floor */
  extraChests?: number;
  /** everything monsters and chests drop comes this many times */
  lootMult?: number;
  /** potions of health do nothing and the hero does not regenerate */
  noHeal?: boolean;
}

export const FLOOR_MODS: FloorMod[] = [
  { id: 'dark', name: 'Temnota', desc: 'Je tu mnohem větší tma, ale kořist je lepší.', tone: 'odd', darkness: 0.86, mf: 40 },
  { id: 'bloodMoon', name: 'Krvavý měsíc', desc: 'Nestvůry jsou rychlejší a bolí víc. Dávají ale víc zkušeností.', tone: 'danger', enemyDmg: 1.25, enemySpeed: 1.2, xp: 0.5, mf: 20, darkColor: 0x2a0306 },
  { id: 'doubleLoot', name: 'Dvojitá kořist', desc: 'Nestvůry i truhly dávají dvakrát tolik.', tone: 'gift', lootMult: 2 },
  { id: 'noHeal', name: 'Bez léčení', desc: 'Lektvary zdraví nepůsobí a zdraví se samo neobnovuje. Za to víc zlata a lepší kořist.', tone: 'danger', noHeal: true, gold: 0.6, mf: 40 },
  { id: 'elites', name: 'Invaze elit', desc: 'Šampionů je tu třikrát víc.', tone: 'danger', eliteMult: 3, mf: 25, xp: 0.2 },
  { id: 'treasure', name: 'Patro pokladů', desc: 'Všude truhly a hromádky zlata a truhly mají lepší předměty.', tone: 'gift', chestBonus: true, extraChests: 7 },
  { id: 'gold', name: 'Zlatá horečka', desc: 'Nestvůry a truhly dávají dvojnásobek zlata.', tone: 'gift', gold: 1 },
  { id: 'curse', name: 'Prokletí', desc: 'Silnější nepřátelé, víc zkušeností a lepší kořist.', tone: 'danger', enemyHp: 1.2, enemyDmg: 1.25, xp: 0.4, mf: 40 },
  { id: 'horde', name: 'Hordy', desc: 'Mnohem víc nepřátel a víc zkušeností.', tone: 'danger', extraEnemies: 0.4, xp: 0.2 },
];
export const FLOOR_MOD_BY_ID: Record<string, FloorMod> = Object.fromEntries(FLOOR_MODS.map((m) => [m.id, m]));

/** the dangerous path from the doors: tougher and more champions, better loot, more gold and experience */
export const DANGER_MOD: FloorMod = { id: 'danger', name: 'Nebezpečná cesta', desc: 'Silnější nestvůry a víc šampionů – a lepší kořist.', tone: 'danger', enemyHp: 1.35, enemyDmg: 1.25, eliteMult: 1.8, mf: 60, gold: 0.5, xp: 0.3 };

/** a fate and the dangerous path at once */
export function mergeMods(a: FloorMod | null, b: FloorMod | null): FloorMod | null {
  if (!a || !b) return a ?? b;
  const mul = (x?: number, y?: number) => (x ?? 1) * (y ?? 1);
  const add = (x?: number, y?: number) => (x ?? 0) + (y ?? 0);
  return {
    id: a.id + '+' + b.id,
    name: `${a.name} · ${b.name}`,
    desc: `${a.desc} ${b.desc}`,
    tone: a.tone === 'danger' || b.tone === 'danger' ? 'danger' : a.tone,
    enemyHp: mul(a.enemyHp, b.enemyHp),
    enemyDmg: mul(a.enemyDmg, b.enemyDmg),
    enemySpeed: mul(a.enemySpeed, b.enemySpeed),
    eliteMult: Math.max(a.eliteMult ?? 1, b.eliteMult ?? 1) * (a.eliteMult && b.eliteMult ? 1.3 : 1),
    lootMult: Math.max(a.lootMult ?? 1, b.lootMult ?? 1),
    xp: add(a.xp, b.xp),
    gold: add(a.gold, b.gold),
    mf: add(a.mf, b.mf),
    extraEnemies: add(a.extraEnemies, b.extraEnemies),
    extraChests: add(a.extraChests, b.extraChests),
    darkness: Math.max(a.darkness ?? 0, b.darkness ?? 0) || undefined,
    darkColor: a.darkColor ?? b.darkColor,
    chestBonus: a.chestBonus || b.chestBonus,
    noHeal: a.noHeal || b.noHeal,
  };
}

/** how often a regular floor has a fate (the dangerous path makes it likelier) */
export const FATE_CHANCE = 0.3;
