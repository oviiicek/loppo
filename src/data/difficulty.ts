// Combat difficulty of a character (chosen at the start, can be changed in the pause menu from the next
// floor on) and the hardcore flag: a hardcore hero who dies is gone for good.
export interface Difficulty {
  id: 'easy' | 'normal' | 'hard' | 'nightmare';
  name: string;
  desc: string;
  color: string;
  /** monster health, damage dealt to the hero and speed */
  enemyHp: number;
  enemyDmg: number;
  enemySpeed: number;
  /** how often monsters are elite champions */
  elite: number;
  /** rewards: experience and gold multipliers, magic find bonus (percent) */
  xp: number;
  gold: number;
  mf: number;
  /** what a (non-hardcore) death costs: share of the gold and of the progress to the next level */
  goldLoss: number;
  xpLoss: number;
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'easy',
    name: 'Lehká',
    desc: 'Slabší nepřátelé a mírnější trest za smrt. Na klidné objevování a příběh.',
    color: '#7ad87a',
    enemyHp: 0.65,
    enemyDmg: 0.6,
    enemySpeed: 0.92,
    elite: 0.5,
    xp: 1,
    gold: 1,
    mf: 0,
    goldLoss: 0.05,
    xpLoss: 0.1,
  },
  {
    id: 'normal',
    name: 'Normální',
    desc: 'Pořádná výzva: nestvůry vydrží a bolí, lektvary nejsou samospásné.',
    color: '#e9d27a',
    enemyHp: 1.2,
    enemyDmg: 1.22,
    enemySpeed: 1,
    elite: 1.25,
    xp: 1,
    gold: 1,
    mf: 0,
    goldLoss: 0.15,
    xpLoss: 0.3,
  },
  {
    id: 'hard',
    name: 'Těžká',
    desc: 'Odolnější a silnější nepřátelé a víc šampionů. Za to víc zkušeností, zlata a lepší kořist.',
    color: '#ff9a4a',
    enemyHp: 1.6,
    enemyDmg: 1.55,
    enemySpeed: 1.05,
    elite: 1.6,
    xp: 1.25,
    gold: 1.25,
    mf: 25,
    goldLoss: 0.2,
    xpLoss: 0.4,
  },
  {
    id: 'nightmare',
    name: 'Noční můra',
    desc: 'Pro zkušené: nepřátelé vydrží skoro dvakrát víc a bolí mnohem víc. Odměny jsou ale největší.',
    color: '#ff5a72',
    enemyHp: 2.2,
    enemyDmg: 1.95,
    enemySpeed: 1.1,
    elite: 2.3,
    xp: 1.6,
    gold: 1.6,
    mf: 50,
    goldLoss: 0.25,
    xpLoss: 0.5,
  },
];

export const DEFAULT_DIFFICULTY = 1;

export function difficultyOf(s: { difficulty?: number }): Difficulty {
  return DIFFICULTIES[s.difficulty ?? DEFAULT_DIFFICULTY] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

/** short summary of what a difficulty changes (for the selection cards) */
export function difficultyLines(d: Difficulty): string[] {
  const pct = (v: number) => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + ' %';
  const lines: string[] = [];
  if (d.enemyHp === 1 && d.enemyDmg === 1) lines.push('Nepřátelé: běžní');
  else lines.push(`Zdraví nepřátel ${pct(d.enemyHp)}`, `Poškození nepřátel ${pct(d.enemyDmg)}`);
  if (d.xp > 1) lines.push(`Zkušenosti a zlato ${pct(d.xp)}`);
  if (d.mf > 0) lines.push(`Lepší kořist +${d.mf} %`);
  lines.push(`Smrt: −${Math.round(d.goldLoss * 100)} % zlata`);
  return lines;
}

/** seconds before another potion of the same kind can be drunk (a potion has to take effect first) */
export const POTION_CD = { hpPotion: 4, mpPotion: 3 };
