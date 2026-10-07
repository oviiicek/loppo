import type { SaveData } from '../systems/state';
import { equippedSetCounts } from './sets';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  reward: { gold?: number; stone?: number; dust?: number; lockpick?: number; attr?: number };
  check: (s: SaveData) => boolean;
}

const st = (s: SaveData) => s.stats ?? (s.stats = {});

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'kill10', name: 'První krev', desc: 'Zabij 10 nepřátel', reward: { gold: 50 }, check: (s) => s.kills >= 10 },
  { id: 'kill100', name: 'Lovec', desc: 'Zabij 100 nepřátel', reward: { gold: 300, stone: 2 }, check: (s) => s.kills >= 100 },
  { id: 'kill1000', name: 'Kat', desc: 'Zabij 1 000 nepřátel', reward: { gold: 3000, dust: 5, attr: 2 }, check: (s) => s.kills >= 1000 },
  { id: 'kill5000', name: 'Legenda podsvětí', desc: 'Zabij 5 000 nepřátel', reward: { gold: 20000, attr: 5 }, check: (s) => s.kills >= 5000 },
  { id: 'floor5', name: 'Hlouběji', desc: 'Dosáhni patra 5', reward: { gold: 200, lockpick: 1 }, check: (s) => s.maxFloor >= 5 },
  { id: 'floor10', name: 'Temné hlubiny', desc: 'Dosáhni patra 10', reward: { gold: 800, stone: 3 }, check: (s) => s.maxFloor >= 10 },
  { id: 'floor25', name: 'Srdce hory', desc: 'Dosáhni patra 25', reward: { gold: 4000, dust: 6, attr: 2 }, check: (s) => s.maxFloor >= 25 },
  { id: 'floor50', name: 'Na dně světa', desc: 'Dosáhni patra 50', reward: { gold: 20000, attr: 5 }, check: (s) => s.maxFloor >= 50 },
  { id: 'floor100', name: 'Nekonečno', desc: 'Dosáhni patra 100', reward: { gold: 100000, attr: 10 }, check: (s) => s.maxFloor >= 100 },
  { id: 'boss1', name: 'Zabiják strážců', desc: 'Poraz prvního strážce', reward: { gold: 400, dust: 2 }, check: (s) => (st(s).bosses ?? 0) >= 1 },
  { id: 'boss10', name: 'Lovec strážců', desc: 'Poraz 10 strážců', reward: { gold: 15000, attr: 3 }, check: (s) => (st(s).bosses ?? 0) >= 10 },
  { id: 'level10', name: 'Zkušený dobrodruh', desc: 'Dosáhni úrovně 10', reward: { gold: 500 }, check: (s) => s.level >= 10 },
  { id: 'level30', name: 'Veterán', desc: 'Dosáhni úrovně 30', reward: { gold: 5000, attr: 2 }, check: (s) => s.level >= 30 },
  { id: 'level80', name: 'Mistr všech kouzel', desc: 'Dosáhni úrovně 80', reward: { gold: 50000, attr: 5 }, check: (s) => s.level >= 80 },
  { id: 'chest25', name: 'Hledač pokladů', desc: 'Otevři 25 truhel', reward: { gold: 600, lockpick: 2 }, check: (s) => (st(s).chests ?? 0) >= 25 },
  { id: 'chest200', name: 'Zlatokop', desc: 'Otevři 200 truhel', reward: { gold: 8000, dust: 5 }, check: (s) => (st(s).chests ?? 0) >= 200 },
  { id: 'secret1', name: 'Bystré oko', desc: 'Najdi tajnou místnost', reward: { gold: 300, lockpick: 1 }, check: (s) => (st(s).secrets ?? 0) >= 1 },
  { id: 'secret20', name: 'Průzkumník', desc: 'Najdi 20 tajných místností', reward: { gold: 6000, dust: 4 }, check: (s) => (st(s).secrets ?? 0) >= 20 },
  { id: 'thief1', name: 'Lapka', desc: 'Chyť zlatého skřeta', reward: { gold: 1000, lockpick: 2 }, check: (s) => (st(s).thieves ?? 0) >= 1 },
  { id: 'thief10', name: 'Postrach skřetů', desc: 'Chyť 10 zlatých skřetů', reward: { gold: 12000, dust: 5 }, check: (s) => (st(s).thieves ?? 0) >= 10 },
  { id: 'lock10', name: 'Zloděj', desc: 'Odemkni 10 zámků paklíčem', reward: { gold: 800, lockpick: 3 }, check: (s) => (st(s).locks ?? 0) >= 10 },
  { id: 'upgrade5', name: 'Kovář', desc: 'Vylepši předmět na +5', reward: { gold: 1000, stone: 3 }, check: (s) => (st(s).maxUpgrade ?? 0) >= 5 },
  { id: 'upgrade10', name: 'Mistr kovář', desc: 'Vylepši předmět na +10', reward: { gold: 10000, attr: 2 }, check: (s) => (st(s).maxUpgrade ?? 0) >= 10 },
  { id: 'legend', name: 'Legenda', desc: 'Najdi legendární předmět', reward: { gold: 500 }, check: (s) => (st(s).bestRarity ?? 0) >= 4 },
  { id: 'mythic', name: 'Mýtus', desc: 'Najdi mýtický předmět', reward: { gold: 3000, dust: 3 }, check: (s) => (st(s).bestRarity ?? 0) >= 5 },
  { id: 'rich', name: 'Boháč', desc: 'Měj u sebe 10 000 zlata', reward: { dust: 3 }, check: (s) => s.gold >= 10000 },
  { id: 'classchange', name: 'Nová cesta', desc: 'Změň classu u obchodníka', reward: { gold: 500 }, check: (s) => s.classChanges >= 1 },
  // the story
  { id: 'story1', name: 'Brána otevřena', desc: 'Poraz Morgrima, Strážce bran', reward: { gold: 15000, dust: 5, attr: 3 }, check: (s) => (s.story?.shards ?? 0) >= 1 },
  { id: 'story2', name: 'Ticho v jeskyních', desc: 'Poraz Matku spor', reward: { gold: 60000, dust: 8, attr: 4 }, check: (s) => (s.story?.shards ?? 0) >= 2 },
  { id: 'story3', name: 'Teplo pro královnu', desc: 'Vysvoboď Isoldu, Ledovou královnu', reward: { gold: 150000, dust: 10, attr: 5 }, check: (s) => (s.story?.shards ?? 0) >= 3 },
  { id: 'story4', name: 'Návrat Elary', desc: 'Zachraň Elaru z moci hlubin', reward: { gold: 300000, dust: 12, attr: 6 }, check: (s) => !!s.story?.blessing },
  { id: 'story5', name: 'Pečeť hlubin', desc: "Poraz Nyx'thara a dokonči příběh", reward: { gold: 1000000, dust: 20, attr: 10 }, check: (s) => !!s.story?.ended },
  { id: 'pages', name: 'Kronikář', desc: 'Najdi všech 20 stránek a vzkazů', reward: { gold: 100000, attr: 4 }, check: (s) => (s.story?.seen ?? []).filter((x) => x.startsWith('note')).length >= 20 },
  { id: 'floor250', name: 'Dno podsvětí', desc: 'Dosáhni patra 250', reward: { gold: 500000, attr: 8 }, check: (s) => s.maxFloor >= 250 },
  // pets, cursed chests and floor tasks
  { id: 'pet1', name: 'Přítel zvířat', desc: 'Osvoboď prvního mazlíčka z klece', reward: { gold: 300, dust: 2 }, check: (s) => (s.pets?.owned.length ?? 0) >= 1 },
  { id: 'pet4', name: 'Zvěřinec', desc: 'Osvoboď 4 mazlíčky', reward: { gold: 6000, attr: 2 }, check: (s) => (s.pets?.owned.length ?? 0) >= 4 },
  { id: 'pet8', name: 'Pán zvířat', desc: 'Osvoboď všech 8 mazlíčků', reward: { gold: 120000, attr: 5 }, check: (s) => (s.pets?.owned.length ?? 0) >= 8 },
  { id: 'petmax', name: 'Věrný parťák', desc: 'Doveď mazlíčka na úroveň 10', reward: { gold: 25000, dust: 8 }, check: (s) => Object.values(s.pets?.floors ?? {}).some((f) => (f ?? 0) >= 36) },
  { id: 'cursed1', name: 'Prokletí nezlomí', desc: 'Přežij výzvu prokleté truhly', reward: { gold: 1500, dust: 3 }, check: (s) => (st(s).cursed ?? 0) >= 1 },
  { id: 'cursed10', name: 'Lovec prokletí', desc: 'Přežij 10 prokletých truhel', reward: { gold: 30000, attr: 3 }, check: (s) => (st(s).cursed ?? 0) >= 10 },
  { id: 'bounty10', name: 'Spolehlivý', desc: 'Splň 10 úkolů patra', reward: { gold: 3000, stone: 3 }, check: (s) => (st(s).bounties ?? 0) >= 10 },
  { id: 'bounty50', name: 'Žoldák hlubin', desc: 'Splň 50 úkolů patra', reward: { gold: 40000, attr: 3 }, check: (s) => (st(s).bounties ?? 0) >= 50 },
  { id: 'elite100', name: 'Přemožitel šampionů', desc: 'Poraz 100 elitních šampionů', reward: { gold: 15000, dust: 6 }, check: (s) => (st(s).elites ?? 0) >= 100 },
  { id: 'streak25', name: 'Masakr', desc: 'Udělej sérii 25 zabití', reward: { gold: 5000, dust: 3 }, check: (s) => (st(s).streak ?? 0) >= 25 },
  { id: 'streak60', name: 'Smršť zkázy', desc: 'Udělej sérii 60 zabití', reward: { gold: 40000, attr: 3 }, check: (s) => (st(s).streak ?? 0) >= 60 },
  { id: 'set2', name: 'Sběratel', desc: 'Nos dva kusy jedné sady', reward: { gold: 3000, dust: 3 }, check: (s) => Object.values(equippedSetCounts(s.equip)).some((n) => n >= 2) },
  { id: 'set4', name: 'Kompletní sada', desc: 'Nos všechny čtyři kusy jedné sady', reward: { gold: 50000, attr: 4 }, check: (s) => Object.values(equippedSetCounts(s.equip)).some((n) => n >= 4) },
  { id: 'gem1', name: 'Klenotník', desc: 'Vsaď první drahokam do soketu', reward: { gold: 500, stone: 2 }, check: (s) => (st(s).gemsSet ?? 0) >= 1 },
  { id: 'gem4', name: 'Dokonalý lesk', desc: 'Získej dokonalý drahokam', reward: { gold: 8000, dust: 4 }, check: (s) => (st(s).bestGem ?? 0) >= 4 },
  { id: 'gem5', name: 'Královský klenot', desc: 'Získej královský drahokam', reward: { gold: 60000, attr: 3 }, check: (s) => (st(s).bestGem ?? 0) >= 5 },
];

export function achievementReward(r: Achievement['reward']) {
  const parts: string[] = [];
  if (r.gold) parts.push(`${r.gold} zlata`);
  if (r.stone) parts.push(`${r.stone}× kámen`);
  if (r.dust) parts.push(`${r.dust}× prach`);
  if (r.lockpick) parts.push(`${r.lockpick}× paklíč`);
  if (r.attr) parts.push(`${r.attr} body atributů`);
  return parts.join(', ');
}

