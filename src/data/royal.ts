// King Dobromil III, lord of the Grey Mountains, moved into his summer palace in Loppo when the earth began
// to shake. He gives the hero royal tasks one after another: a chain of twelve that tell a little story
// of the kingdom, then royal commissions without end. Each finished task raises the king's favour, and
// favour brings honours that help the hero for good.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).
import { Quest, QuestType, nextBossFloor } from './quests';

export interface RoyalState {
  /** the king's favour (a point or two for every finished task) */
  favor: number;
  /** how many royal tasks are behind the hero */
  step: number;
  /** the task the hero carries now */
  quest?: Quest | null;
  /** the crown of Loppo was already given */
  crown?: boolean;
}

export interface Honor {
  at: number;
  name: string;
  perk: string;
  color: string;
  stats?: Record<string, number>;
}

/** the honours of the king, by the favour they need */
export const HONORS: Honor[] = [
  { at: 1, name: 'Bronzová pečeť', perk: '+5 % zlata', color: '#d8925a', stats: { gold: 5 } },
  { at: 3, name: 'Stříbrná pečeť', perk: '+5 % zkušeností', color: '#cfd6dc', stats: { xp: 5 } },
  { at: 6, name: 'Zlatá pečeť', perk: 'o úkol víc na nástěnce', color: '#ffd76a' },
  { at: 10, name: 'Řád lva', perk: '+10 % magického nálezu', color: '#ff9a3a', stats: { magicFind: 10 } },
  { at: 15, name: 'Koruna Loppa', perk: '+5 % poškození a královský dar', color: '#ff6a8a', stats: { dmgPct: 5, spellDmg: 5 } },
];

export function royalOf(s: { village?: { royal?: RoyalState } }): RoyalState {
  const v = (s.village ??= { lv: {}, pity: 0 } as never) as { royal?: RoyalState };
  return (v.royal ??= { favor: 0, step: 0, quest: null });
}

export function honorsOf(favor: number) {
  return HONORS.filter((h) => favor >= h.at);
}

/** the bonuses of the honours the hero holds (they count like gear) */
export function royalStats(s: { village?: { royal?: RoyalState } }): Record<string, number> {
  const out: Record<string, number> = {};
  const f = s.village?.royal?.favor ?? 0;
  for (const h of honorsOf(f)) for (const [k, v] of Object.entries(h.stats ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** a royal task: a quest of the board's kinds or one of the king's own (an item, gold, a depth) */
export type RoyalQuest = Quest & { royal: true; minRarity?: number; favor: number; speech: string };

const KING = 'Král Dobromil III.';

interface Step {
  type: QuestType;
  title: string;
  speech: (n: number, f: number) => string;
  text: (n: number, f: number) => string;
  goal: (f: number) => number;
  /** the floor the task points to (floor tasks) */
  at?: (f: number) => number;
  k: number;
  rarity: number;
  favor: number;
  minRarity?: (f: number) => number;
}

const STEPS: Step[] = [
  {
    type: 'kills',
    title: 'Krysy pod trůnem',
    speech: (n) => `Takže ty sestupuješ do kobek pod starým hradem. Loppo je moje letní sídlo – a moje odpovědnost. Ukaž mi, co umíš: poraz ${n} nestvůr.`,
    text: (n) => `Poraz v kobkách ${n} nestvůr.`,
    goal: (f) => 40 + Math.round(f * 1.5),
    k: 1,
    rarity: 2,
    favor: 1,
  },
  {
    type: 'lost',
    title: 'Královský posel',
    speech: (_n, f) => `Můj posel Vavřinec nesl do hor dopis a sešel z cesty – prý ho stopy vedly do kobek. Někdo ho zahlédl kolem ${f}. patra. Přiveď ho živého.`,
    text: (_n, f) => `Najdi posla Vavřince kolem ${f}. patra.`,
    goal: () => 1,
    at: (f) => f + 2,
    k: 1.4,
    rarity: 3,
    favor: 1,
  },
  {
    type: 'deliver',
    title: 'Dar pro pokladnici',
    speech: (_n, f) => `Královská pokladnice zeje prázdnotou a vyslanci sousedních zemí se mi smějí. Přines mi z hlubin něco opravdu cenného – ${rarityName(minRarityFor(f))} předmět nebo lepší.`,
    text: (_n, f) => `Odevzdej králi ${rarityName(minRarityFor(f))} nebo lepší předmět.`,
    goal: () => 1,
    k: 1.6,
    rarity: 3,
    favor: 1,
    minRarity: (f) => minRarityFor(f),
  },
  {
    type: 'elites',
    title: 'Šampioni temnoty',
    speech: (n) => `Strážní hlásí, že se v kobkách rodí šampioni – nestvůry silnější než ostatní. Poraz jich ${n}, než se odváží nahoru.`,
    text: (n) => `Poraz ${n} šampionů.`,
    goal: () => 6,
    k: 1.5,
    rarity: 3,
    favor: 1,
  },
  {
    type: 'artifact',
    title: 'Koruna předků',
    speech: (_n, f) => `Můj praděd ztratil v kobkách korunu předků. Nosí ji prý strážce ${f}. patra jako trofej. Vezmi mu ji – patří Loppu.`,
    text: (_n, f) => `Poraz strážce ${f}. patra.`,
    goal: () => 1,
    at: (f) => nextBossFloor(f + 1),
    k: 2,
    rarity: 3,
    favor: 2,
  },
  {
    type: 'tribute',
    title: 'Na obnovu hradeb',
    speech: (n) => `Hradby Loppa praskají spolu se zemí. Zedníci chtějí zlato a já mám jen sliby. Přispěj ${n.toLocaleString('cs-CZ')} zlaty – nezapomenu na to.`,
    text: (n) => `Daruj králi ${n.toLocaleString('cs-CZ')} zlata.`,
    goal: (f) => Math.round((1500 + f * f * 6 + f * 120) / 100) * 100,
    k: 1.2,
    rarity: 4,
    favor: 2,
  },
  {
    type: 'secret',
    title: 'Tajemství starého hradu',
    speech: (n) => `Stavitelé starého hradu prý ukryli v jeho podzemí tajné komnaty. Najdi jich ${n === 1 ? 'aspoň jednu' : n} – praskliny ve zdech prozradí, kde hledat.`,
    text: (n) => `Najdi ${n} tajné místnosti.`,
    goal: () => 2,
    k: 1.4,
    rarity: 3,
    favor: 1,
  },
  {
    type: 'rescue',
    title: 'Poddaní v okovech',
    speech: (n) => `Nestvůry odvlékají i poutníky z královské cesty. Jsou to moji poddaní. Osvoboď ${n === 1 ? 'aspoň jednoho' : n} z nich.`,
    text: (n) => `Osvoboď ${n} zajatce.`,
    goal: () => 2,
    k: 1.3,
    rarity: 3,
    favor: 1,
  },
  {
    type: 'tomb',
    title: 'Hrobka mého děda',
    speech: (_n, f) => `Můj děd, král Vratislav, odpočívá v hrobce pod horou. Teď z ní v noci vycházejí stíny. Kolem ${f}. patra ji najdeš – otevři ji a dej mu pokoj.`,
    text: (_n, f) => `Otevři prokletou hrobku kolem ${f}. patra.`,
    goal: () => 1,
    at: (f) => f + 2,
    k: 1.6,
    rarity: 3,
    favor: 1,
  },
  {
    type: 'rift',
    title: 'Trhlina v říši',
    speech: () => 'Mágové hlásí trhlinu, kterou do našeho světa prosakuje cizí moc. Vstup do ní a zavři ji. Na království se nesmí nic dostat zvenčí.',
    text: () => 'Najdi trhlinu a zavři ji.',
    goal: () => 1,
    at: (f) => f + 1,
    k: 2,
    rarity: 4,
    favor: 2,
  },
  {
    type: 'nopotion',
    title: 'Zkouška krále',
    speech: () => 'Král potřebuje šampiona, ne lékárníka. Poraz strážce patra bez jediného lektvaru – od chvíle, kdy se probudí, do jeho pádu.',
    text: () => 'Poraz strážce bez lektvarů.',
    goal: () => 1,
    at: (f) => nextBossFloor(f + 1),
    k: 2.2,
    rarity: 4,
    favor: 2,
  },
  {
    type: 'depth',
    title: 'Hlubiny království',
    speech: (n) => `Pod horou leží celé podzemní království a nikdo neví, jak hluboko sahá. Sestup do ${n}. patra a řekni mi, co tam je.`,
    text: (n) => `Dostaň se do ${n}. patra.`,
    goal: (f) => Math.ceil((f + 10) / 5) * 5,
    k: 2.5,
    rarity: 4,
    favor: 3,
  },
];

/** commissions after the chain: the board's kinds with royal pay */
const COMMISSIONS: Step[] = [
  { ...STEPS[0], title: 'Královská zakázka: čistka', speech: (n) => `Kobky se znovu plní. Poraz ${n} nestvůr – koruna platí dobře.`, goal: (f) => 60 + f * 2 },
  { ...STEPS[3], title: 'Královská zakázka: šampioni', speech: (n) => `Další šampioni. Poraz jich ${n}.`, goal: () => 8 },
  { ...STEPS[2], title: 'Královská zakázka: poklad', speech: (_n, f) => `Pokladnice by snesla další skvost. Přines mi ${rarityName(minRarityFor(f))} nebo lepší předmět.` },
  { ...STEPS[5], title: 'Královská zakázka: hradby', speech: (n) => `Hradby potřebují další kámen. Daruj ${n.toLocaleString('cs-CZ')} zlata.` },
  { ...STEPS[4], title: 'Královská zakázka: strážce', speech: (_n, f) => `Strážce ${f}. patra ohrožuje cestu do hor. Poraz ho.` },
  { ...STEPS[9], title: 'Královská zakázka: trhlina', speech: () => 'Další trhlina. Zavři ji.' },
];

function minRarityFor(f: number) {
  return f >= 60 ? 4 : f >= 15 ? 3 : 2;
}

export function rarityName(r: number) {
  return ['běžný', 'neobvyklý', 'vzácný', 'epický', 'legendární', 'mýtický', 'pradávný'][r] ?? 'vzácný';
}

/** the next royal task for a hero who reached a floor */
export function makeRoyalQuest(step: number, floor: number): RoyalQuest {
  const f = Math.max(1, floor);
  const st = step < STEPS.length ? STEPS[step] : COMMISSIONS[(step - STEPS.length) % COMMISSIONS.length];
  const at = st.at ? st.at(f) : f;
  const goal = st.goal(f);
  const shown = st.at ? at : goal;
  const q: RoyalQuest = {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    type: st.type,
    giver: KING,
    title: st.title,
    text: `„${st.text(st.type === 'tribute' || st.type === 'depth' || !st.at ? goal : at, at)}“`,
    speech: st.speech(shown, at),
    floor: at,
    goal: st.type === 'tribute' ? 1 : goal,
    have: 0,
    done: false,
    reward: { gold: st.type === 'tribute' ? 0 : Math.round(600 * (1 + f * 0.3) * st.k), rarity: Math.min(5, st.rarity + (step >= STEPS.length && f >= 80 ? 1 : 0)), extra: step % 3 === 0 ? 'gem' : step % 3 === 1 ? 'rune' : 'stone' },
    royal: true,
    favor: st.favor,
  };
  if (st.type === 'lost') {
    q.name = 'Vavřinec';
    q.fem = false;
  }
  if (st.type === 'tribute') q.base = goal;
  if (st.minRarity) q.minRarity = st.minRarity(f);
  return q;
}

/** the king greets the hero according to how much he trusts them */
export function kingGreeting(favor: number) {
  if (favor >= 15) return 'Ať žije ochránce Loppa! Celé království ti dluží víc, než kdy splatím.';
  if (favor >= 10) return 'Řád lva otevírá v Loppu všechny dveře. Co nového v hlubinách?';
  if (favor >= 6) return 'Ach, má nejlepší naděje. Posaď se – nebo spíš ne, kobky čekají.';
  if (favor >= 3) return 'Zase ty. Dobře. Začínám ti věřit.';
  if (favor >= 1) return 'Splnil se první úkol – a já držím slovo. Mám pro tebe další.';
  return 'Kdo jsi a co chceš v mém letním sídle? Ach – ty chodíš do kobek pod hradem.';
}

/** the guards' chatter */
export const GUARD_LINES = [
  'Ať žije král!',
  'Bez pozvání do zámku nesmíš. Ale s králem mluvit můžeš.',
  'Prý se z kobek vracíš pokaždé po svých. To se každý den nevidí.',
  'Kdyby se z hradu něco vyplazilo, jsme připraveni. Asi.',
  'Král je dnes v dobré náladě. Využij toho.',
  'Ta koruna je těžší, než vypadá. Říkal mi to sám král.',
];
