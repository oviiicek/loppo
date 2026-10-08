// Quests from the notice board in Loppo. Some send the hero to a floor (a lost adventurer, a cursed tomb,
// a rift, a guardian's artifact), some count deeds (secret rooms, champions, captives freed, letters read).
// A finished quest pays at the board.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).

export type QuestType = 'lost' | 'artifact' | 'tomb' | 'nopotion' | 'secret' | 'elites' | 'kills' | 'rescue' | 'lore' | 'rift' | 'nemesis' | 'deliver' | 'tribute' | 'depth' | 'treasure';

export interface Quest {
  id: number;
  type: QuestType;
  giver: string;
  title: string;
  text: string;
  /** from this floor on (floor quests) */
  floor: number;
  goal: number;
  have: number;
  /** a counter's value when the quest was taken (counting quests) */
  base?: number;
  done: boolean;
  reward: QuestReward;
  /** the lost adventurer */
  name?: string;
  fem?: boolean;
}

export interface QuestReward {
  gold: number;
  rarity: number;
  extra?: 'gem' | 'rune' | 'stone' | 'dust' | 'srune';
}

const GIVERS = ['Starosta Vít', 'Pekařka Marta', 'Mlynář Karel', 'Kovář Bořek', 'Kupkyně Šárka', 'Lovkyně Jitka', 'Kněžka Bohdana', 'Hostinská Dora', 'Pastýř Jakub', 'Ilda'];
const LOST = [
  { name: 'Matouš', fem: false, who: 'můj syn Matouš' },
  { name: 'Rozálie', fem: true, who: 'moje dcera Rozálie' },
  { name: 'Ondřej', fem: false, who: 'můj bratr Ondřej' },
  { name: 'Kristýna', fem: true, who: 'moje sestra Kristýna' },
  { name: 'Vojtěch', fem: false, who: 'můj učeň Vojtěch' },
  { name: 'Anežka', fem: true, who: 'moje žena Anežka' },
  { name: 'Tomáš', fem: false, who: 'můj muž Tomáš' },
];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** the next guardian floor from a floor on */
export function nextBossFloor(floor: number) {
  return Math.ceil(Math.max(1, floor) / 5) * 5;
}

/** quest types that are floor bound (they place something on a floor) */
export const FLOOR_QUESTS: QuestType[] = ['lost', 'tomb', 'rift', 'treasure'];

/** treasure maps the hero can carry at once (the board's slots do not count them) */
export const MAX_TREASURE_MAPS = 3;

/** a floor where a treasure can be buried: not a guardian's floor and not a camp */
function digFloor(f: number) {
  while (f % 10 === 0 || f % 10 === 5) f++;
  return f;
}

/** a treasure map found in the dungeon: a cross on one of the next floors (dug up on the spot, no claiming) */
export function makeTreasureMap(floor: number): Quest {
  const at = digFloor(Math.max(1, floor) + rnd(1, 3));
  return {
    id: Date.now() + Math.floor(Math.random() * 1e6),
    type: 'treasure',
    giver: 'Mapa pokladu',
    title: `Poklad v ${at}. patře`,
    text: `Na zažloutlé mapě je křížkem označené místo v ${at}. patře. Najdi ho (na mapě ho uvidíš zlatě) a vykopej, co tam kdosi zakopal.`,
    floor: at,
    goal: 1,
    have: 0,
    done: false,
    reward: { gold: 0, rarity: 3, extra: 'gem' },
  };
}

/** the counter a counting quest follows (see stats in the save) */
export const QUEST_COUNTER: Partial<Record<QuestType, string>> = {
  secret: 'secrets',
  elites: 'elites',
  kills: 'kills',
  rescue: 'rescued',
  lore: 'lore',
  rift: 'rifts',
  nemesis: 'nemeses',
  depth: 'maxFloor',
};

/** a new quest for the board (the floor is where the hero goes next) */
export function makeQuest(type: QuestType, floor: number, rewardMult: number): Quest {
  const giver = pick(GIVERS);
  const f = Math.max(1, floor);
  const id = Date.now() + Math.floor(Math.random() * 1e6);
  const gold = (k: number) => Math.round(300 * (1 + f * 0.25) * k * rewardMult);
  const q = (title: string, text: string, goal: number, k: number, rarity: number, extra?: QuestReward['extra'], at = f): Quest => ({
    id,
    type,
    giver,
    title,
    text,
    floor: at,
    goal,
    have: 0,
    done: false,
    reward: { gold: gold(k), rarity, extra },
  });
  switch (type) {
    case 'lost': {
      const l = pick(LOST);
      const at = f + rnd(1, 3);
      const quest = q(`Ztracen${l.fem ? 'á' : 'ý'}: ${l.name}`, `„${l.who.charAt(0).toUpperCase() + l.who.slice(1)} ${l.fem ? 'sešla' : 'sešel'} do kobek a nevrátil${l.fem ? 'a' : ''} se. Prý ${l.fem ? 'ji' : 'ho'} někdo viděl kolem ${at}. patra. Prosím, přiveď ${l.fem ? 'ji' : 'ho'} domů!“`, 1, 1.4, 3, 'gem', at);
      quest.name = l.name;
      quest.fem = l.fem;
      return quest;
    }
    case 'artifact': {
      const at = nextBossFloor(f + 1);
      return q('Artefakt strážce', `„Strážce ${at}. patra nosí starý artefakt Pětice. Poraz ho a přines nám ho – patří do Loppa.“`, 1, 1.8, 3, 'rune', at);
    }
    case 'tomb': {
      const at = f + rnd(1, 3);
      return q('Prokletá hrobka', `„Kolem ${at}. patra leží prokletá hrobka mého rodu. Otevři ji a odolej tomu, co z ní vyleze. Ať naši předci konečně spí.“`, 1, 1.5, 3, 'dust', at);
    }
    case 'nopotion':
      return q('Zkouška odvahy', '„Opravdový hrdina nepotřebuje lektvary. Poraz strážce patra bez jediného doušku – od chvíle, kdy se probudí, do jeho pádu.“', 1, 2, 4, 'stone', nextBossFloor(f + 1));
    case 'secret': {
      const g = rnd(1, 2);
      return q('Tajné průchody', `„Stará mapa mluví o tajných místnostech v kobkách. Najdi ${g === 1 ? 'aspoň jednu' : 'dvě'} – zeď s prasklinou prozradí, kde hledat.“`, g, 1.1 * g, 2, 'gem');
    }
    case 'elites': {
      const g = rnd(4, 8);
      return q('Lovec šampionů', `„Šampioni v kobkách jsou čím dál silnější. Poraz jich ${g}, než přijdou až k nám.“`, g, 0.25 * g, 3, 'rune');
    }
    case 'kills': {
      const g = rnd(6, 12) * 10;
      return q('Vyčisti kobky', `„V noci slyšíme, jak se ze studní ozývá škrábání. Poraz ${g} nestvůr, ať je v Loppu zase klid.“`, g, g / 70, 2, 'stone');
    }
    case 'rescue': {
      const g = rnd(1, 2);
      return q('Zajatci', `„Nestvůry odvlekly i poutníky, kteří šli kolem. Osvoboď ${g === 1 ? 'aspoň jednoho zajatce' : 'dva zajatce'}.“`, g, 0.9 * g, 2, 'gem');
    }
    case 'lore': {
      const g = rnd(2, 4);
      return q('Kronika Loppa', `„Píšu kroniku a potřebuju svědectví. Přečti ${g} zápisky z kobek – dopisy padlých nebo nápisy na zdech.“`, g, 0.4 * g, 2, 'dust');
    }
    case 'rift':
      return q('Uzavřít trhlinu', '„Z hlubin se trhá sám svět. Najdi trhlinu, vstup do ní a zavři ji – portál se objeví na některém z dalších pater.“', 1, 1.8, 3, 'srune', f + rnd(1, 2));
    case 'nemesis':
      return q('Pomsta', '„Ten, kdo tě kdysi porazil, prý chodí po kobkách a chlubí se tím. Najdi ho a skonči to.“', 1, 2, 4, 'rune');
    default:
      // the king's own kinds of task never hang on the board
      return q('Vyčisti kobky', '„Poraz 60 nestvůr.“', 60, 1, 2, 'stone');
  }
}

/** what the board offers on this visit (a few kinds the hero has not taken yet) */
export function questOffers(active: Quest[], floor: number, rewardMult: number, hasNemesis: boolean, n = 4): Quest[] {
  const taken = new Set(active.map((q) => q.type));
  const kinds: QuestType[] = ['lost', 'artifact', 'tomb', 'nopotion', 'secret', 'elites', 'kills', 'rescue', 'lore'];
  if (floor >= 6) kinds.push('rift');
  if (hasNemesis) kinds.push('nemesis');
  const free = kinds.filter((k) => !taken.has(k));
  const out: Quest[] = [];
  while (out.length < n && free.length) {
    const k = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    const q = makeQuest(k, floor, rewardMult);
    q.id += out.length;
    out.push(q);
  }
  return out;
}

/** "1 500 zlata, epický předmět, drahokam" */
export function rewardText(r: QuestReward) {
  const rar = ['běžný', 'neobvyklý', 'vzácný', 'epický', 'legendární', 'mýtický', 'pradávný'][r.rarity] ?? 'vzácný';
  const extra = { gem: 'drahokam', rune: 'runa', stone: '3× kámen', dust: '3× prach', srune: 'runa kouzla' };
  return [`${r.gold.toLocaleString('cs-CZ')} zlata`, `${rar} předmět`, r.extra ? extra[r.extra] : ''].filter(Boolean).join(', ');
}
