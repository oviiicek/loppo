// The bestiary: every kind of monster has elements it fears and elements it shrugs off. The more of a kind
// the hero kills, the more the bestiary tells (its nature, then its weak spots, then what it carries) – and
// at last the hero masters fighting it (more damage against that kind).
import type { Element } from './types';

export interface BeastInfo {
  /** what the monster is like */
  note: string;
  weak: Element[];
  resist: Element[];
  /** what it tends to carry */
  loot: string;
}

/** damage multipliers for a weak spot and for a resistance */
export const WEAK_MULT = 1.5;
export const RESIST_MULT = 0.6;

/** kills needed to learn: its weak spots, its loot, mastery I and II */
export const KNOW_AT = { weak: 10, loot: 25, master1: 50, master2: 100 };

export const BEASTS: Record<string, BeastInfo> = {
  skeleton: { note: 'Vězni kobek, které ani smrt nepustila. Neúnavní, ale křehcí.', weak: ['holy', 'fire'], resist: ['poison', 'ice'], loot: 'Zlato, občas zbraň po padlém vojákovi.' },
  skelArcher: { note: 'Drží si odstup: když se přiblížíš, couvá a střílí dál. Zažeň ho do kouta, nebo ho sundej z dálky.', weak: ['holy', 'fire'], resist: ['poison', 'ice'], loot: 'Zlato, luky a šípy, občas prsten.' },
  skelKnight: { note: 'Rytíř se štítem chrání nestvůry kolem sebe – dostávají o 40 % menší poškození. Nejdřív rytíř, potom ostatní.', weak: ['holy', 'lightning'], resist: ['poison', 'ice'], loot: 'Zbroj a štíty, občas meč.' },
  skelMage: { note: 'Metá stínové střely zpoza ostatních kostlivců.', weak: ['holy', 'fire'], resist: ['shadow', 'poison'], loot: 'Hole, prach a svitky.' },
  necromancer: { note: 'Oživuje padlé nestvůry, a když kolem žádné nejsou, vyvolá kostlivce. Zabij ho první, jinak boj nikdy neskončí.', weak: ['holy', 'fire'], resist: ['shadow', 'poison'], loot: 'Hole, runy a prach.' },
  boneSniper: { note: 'Dlouho míří – červená čára prozradí kam. Uhni z ní, nebo ho silně zasáhni, než vystřelí. Jeho šíp strašně bolí.', weak: ['holy', 'fire'], resist: ['poison', 'ice'], loot: 'Kuše, šipky a zlato.' },
  boneGiant: { note: 'Hora kostí s kyjem. Když dupne, otřese se země kolem – ustup z kruhu.', weak: ['holy', 'lightning'], resist: ['poison', 'ice'], loot: 'Těžké zbraně a kameny vylepšení.' },
  bat: { note: 'Kličkuje ve tmě, kouše a zase mizí. Vadí mu hlavně blesk.', weak: ['lightning'], resist: ['poison'], loot: 'Málokdy něco – netopýři kapsy nemají.' },
  slime: { note: 'Kyselá hmota, která se po zásahu rozpadne na menší kusy.', weak: ['fire', 'ice'], resist: ['poison'], loot: 'Lektvary, které spolkl. Malé slizy nic nenesou.' },
  goblin: { note: 'Rychlý a zlodějský. V tlupě nebezpečnější, než vypadá.', weak: ['fire'], resist: [], loot: 'Hodně zlata a ukradené cetky.' },
  goblinShaman: { note: 'Léčí ostatní goblíny a schovává se za ně. Zabij ho první.', weak: ['fire', 'phys'], resist: ['lightning'], loot: 'Hole, lektvary a amulety.' },
  orcBerserker: { note: 'Žene se dopředu a každá jeho rána tě odhodí. Pod polovinou zdraví zuří.', weak: ['ice', 'lightning'], resist: [], loot: 'Sekery, zbroj a zlato.' },
  spiderling: { note: 'Malí pavouci chodí v hloučcích. Jeden nic, deset problém.', weak: ['fire'], resist: ['poison'], loot: 'Málokdy něco.' },
  spider: { note: 'Skočí z dálky a otráví kousnutím. Jed mu neublíží.', weak: ['fire', 'ice'], resist: ['poison'], loot: 'Zlato a občas prsten oběti.' },
  webSpider: { note: 'Drží se v odstupu a střílí lepkavé sítě, které tě zpomalí.', weak: ['fire'], resist: ['poison'], loot: 'Zlato a cetky obětí.' },
  blastSpider: { note: 'Rozběhne se k tobě a vybuchne. Zabij ho z dálky – i mrtvý ještě bouchne.', weak: ['ice'], resist: ['fire'], loot: 'Málokdy něco.' },
  spiderGuard: { note: 'Pavouk v pancíři. Chrání pavouky kolem sebe – nejdřív musí padnout on.', weak: ['fire', 'lightning'], resist: ['poison'], loot: 'Zbroj a zlato.' },
  spiderMother: { note: 'Klade vejce, ze kterých se líhnou malí pavouci. Rozbij vejce, nebo jdi rovnou po ní.', weak: ['fire', 'ice'], resist: ['poison'], loot: 'Prsteny obětí a hodně zlata.' },
  zombie: { note: 'Pomalý a odolný. Kdo neuhne, toho rozdrtí.', weak: ['fire', 'holy'], resist: ['poison', 'ice'], loot: 'Zbroj, kterou kdysi nosil.' },
  cultist: { note: 'Služebník Nyx’thara. Metá stínové střely z bezpečné vzdálenosti.', weak: ['holy'], resist: ['shadow'], loot: 'Hole, prach a svitky.' },
  orc: { note: 'Obrněný válečník, který se rozběhne a srazí, co mu stojí v cestě.', weak: ['ice', 'lightning'], resist: [], loot: 'Těžké zbraně a zbroj, hodně zlata.' },
  imp: { note: 'Malý ohnivý skřet. Oheň ho jen pobaví, mráz ho zabije.', weak: ['ice'], resist: ['fire'], loot: 'Zlato a ohnivé runy.' },
  ghost: { note: 'Prochází zdmi. Zbraně jím projdou jako mlhou (poloviční poškození), kouzla ho trhají (+35 %).', weak: ['holy', 'lightning'], resist: ['poison', 'ice'], loot: 'Prach a magické cetky.' },
  ghoul: { note: 'Rychlý a skáče na kořist z dálky. Uhni skoku do strany.', weak: ['fire', 'holy'], resist: ['poison'], loot: 'Zlato a cetky.' },
  plagueGhoul: { note: 'Šíří kolem sebe jed a po smrti zanechá jedovatý mrak. Nestůj u něj.', weak: ['fire'], resist: ['poison'], loot: 'Lektvary a byliny.' },
  hungryGhoul: { note: 'Žere těla padlých – s každým je větší a silnější. Nenech ho hodovat.', weak: ['fire', 'holy'], resist: ['poison'], loot: 'Zlato a kosti.' },
  alphaGhoul: { note: 'Zařve a přivolá další ghúly, kteří pak běhají rychleji. Vůdce smečky zabij první.', weak: ['fire', 'holy'], resist: ['poison', 'ice'], loot: 'Zbraně a hodně zlata.' },
  mutantGhoul: { note: 'Pokaždé jiný: obří, rychlý, kyselý, pancéřový, výbušný… Co je zač, prozradí jeho jméno.', weak: ['fire'], resist: ['poison'], loot: 'Lektvary a zvláštní cetky.' },
  darkMage: { note: 'Povolává kostlivce a schovává se za ně. Zabij ho první.', weak: ['holy', 'phys'], resist: ['shadow'], loot: 'Hole, prach, runy kouzel.' },
  golem: { note: 'Kámen s pancířem, na který zbraně skoro nestačí. Je ale velmi pomalý – na něj patří magie.', weak: ['lightning', 'ice'], resist: ['poison', 'fire'], loot: 'Kameny na vylepšování, těžká zbroj.' },
  brokenGolem: { note: 'Po smrti se rozpadne na dva menší golemy.', weak: ['lightning', 'ice'], resist: ['poison', 'fire'], loot: 'Kameny vylepšení.' },
  crystalGolem: { note: 'Odráží třetinu magického poškození zpět na toho, kdo kouzlí. Na něj se hodí zbraně.', weak: ['phys', 'lightning'], resist: ['ice', 'fire'], loot: 'Kameny a magický prach.' },
  stormGolem: { note: 'Kolem sebe metá blesky a čas od času se vybije – utíkej z kruhu, dokud můžeš.', weak: ['ice', 'poison'], resist: ['lightning'], loot: 'Kameny a bleskové runy.' },
  wraith: { note: 'Ledový přízrak, který zmrazí krev v žilách.', weak: ['fire', 'holy'], resist: ['ice', 'poison'], loot: 'Prach a mrazivé runy.' },
  hexWitch: { note: 'Proklíná: Kletba rozkladu ti sebere půlku léčení, Kletba únavy zpomalí útoky. Její střelám se dá uhnout.', weak: ['holy', 'fire'], resist: ['shadow', 'poison'], loot: 'Hole, prsteny a lektvary.' },
  darkPriest: { note: 'Žehná nestvůrám (silnější a rychlejší) a tebe znamená zranitelností. Zabij ho první.', weak: ['holy'], resist: ['shadow'], loot: 'Amulety a svitky.' },
  bloodWitch: { note: 'Obětuje zdraví okolních nestvůr a sama se tím léčí. Krev, kterou ti vysaje střelami, ji hojí.', weak: ['holy', 'ice'], resist: ['shadow'], loot: 'Prsteny a krvavé runy.' },
  portalMage: { note: 'Otevírá portály, ze kterých lezou nestvůry. Rozbij portál, nebo zabij mága – pak portály zhasnou.', weak: ['holy', 'lightning'], resist: ['shadow'], loot: 'Hole a runy kouzel.' },
  illusionist: { note: 'Rozdělí se na čtyři – jen jeden je pravý. Iluze zmizí po jediném zásahu.', weak: ['holy'], resist: ['shadow'], loot: 'Prsteny a magický prach.' },
  timeMage: { note: 'Zrychluje nestvůry kolem sebe a pod tebou otevírá kruh zpomaleného času – vystup z něj včas.', weak: ['fire', 'lightning'], resist: ['ice'], loot: 'Amulety a runy kouzel.' },
  mageHunter: { note: 'Kdykoli sešleš kouzlo, skočí k tobě. Magie mu ubližuje méně, zbraně víc.', weak: ['phys'], resist: ['shadow'], loot: 'Dýky a lehká zbroj.' },
  mindMage: { note: 'Zmate tě: na pár sekund se obrátí ovládání. Jeho růžové kouli se dá uhnout.', weak: ['phys', 'holy'], resist: ['shadow'], loot: 'Hole a magický prach.' },
  swarmBat: { note: 'Mnoho malých netopýrů. Jednotlivá kouzla je často minou, kouzla na plochu je smetou.', weak: ['lightning', 'fire'], resist: ['poison'], loot: 'Nic – roj kapsy nemá.' },
  vampire: { note: 'Teleportuje se k tobě, saje krev a když je zle, rozpadne se na chvíli v netopýry.', weak: ['holy', 'fire'], resist: ['shadow', 'poison'], loot: 'Prsteny, amulety a zlato.' },
  vampireLord: { note: 'Rozlévá krvavé louže – tobě ubližují, nestvůry v nich se hojí. Každá jeho rána ho silně léčí.', weak: ['holy', 'fire'], resist: ['shadow', 'poison', 'ice'], loot: 'Šperky a hodně zlata.' },
  manaBeast: { note: 'Má štít z many (modrý pruh). Dokud ho nerozbiješ, zdraví jí neubývá. Rozbitý štít ji na chvíli omráčí.', weak: ['lightning'], resist: ['ice'], loot: 'Magický prach a krystaly.' },
  buffEater: { note: 'Ukradne ti aktivní posílení a sám ho používá. Když ho zabiješ, posílení se ti vrátí.', weak: ['holy'], resist: ['shadow'], loot: 'Magický prach a prsteny.' },
  adaptive: { note: 'Zvyká si na poškození: když ho pořád biješ stejně, odolává tomu víc a víc. Střídej zbraně a živly.', weak: [], resist: [], loot: 'Cokoli – pokaždé něco jiného.' },
  mirrorDemon: { note: 'Zkopíruje tvé kouzlo a sešle ho na tebe. Čím silnější kouzlo, tím horší odraz.', weak: ['phys', 'holy'], resist: ['shadow'], loot: 'Zrcadlové střepy a runy kouzel.' },
  mushroom: { note: 'Rozprašuje jedovaté spory na tebe a léčivé na havěť kolem sebe. Zabij ho první.', weak: ['fire'], resist: ['poison'], loot: 'Lektvary a byliny.' },
  troll: { note: 'Jeskynní troll – hora svalů. Oheň je jediné, čeho se bojí.', weak: ['fire'], resist: ['ice', 'poison'], loot: 'Hodně zlata a těžké zbraně.' },
  iceGolem: { note: 'Golem z věčného ledu. Roztaví ho jen oheň.', weak: ['fire'], resist: ['ice', 'poison'], loot: 'Kameny a mrazivé runy.' },
  frostWolf: { note: 'Loví ve smečce a jeho kousnutí mrazí.', weak: ['fire'], resist: ['ice'], loot: 'Kůže, zlato, občas mrazivý prsten.' },
  hellhound: { note: 'Pes z výhně. Jeho dech pálí, led ho ochromí.', weak: ['ice'], resist: ['fire'], loot: 'Zlato a ohnivé runy.' },
  magmaGolem: { note: 'Golem z tekoucí lávy – kudy jde, tudy hoří země. Neber ho zblízka.', weak: ['ice'], resist: ['fire', 'poison'], loot: 'Kameny, ohnivé runy, těžká zbroj.' },
  voidEye: { note: 'Oko propasti, které vidí všechno. Světlo ho oslepí.', weak: ['holy', 'lightning'], resist: ['shadow'], loot: 'Prach a runy zkázy.' },
  shade: { note: 'Plave zdmi a útočí z kamene, kam na něj nedosáhneš. Udeř, až vyleze – nebo použij kouzlo na plochu.', weak: ['holy'], resist: ['shadow', 'phys'], loot: 'Prach a temné cetky.' },
  mimic: { note: 'Truhla se zuby. Kdo je chamtivý, ten na ni sáhne.', weak: ['lightning'], resist: [], loot: 'Vždy předmět – je to přece truhla.' },
  thief: { note: 'Zlatý skřet s pytlem lupu. Nikdy neútočí, jen utíká.', weak: [], resist: [], loot: 'Hromady zlata a drahokamy.' },
};

/** how a monster kind takes damage of an element */
export function elemMult(id: string, el: Element): number {
  const b = BEASTS[id];
  if (!b) return 1;
  if (b.weak.includes(el)) return WEAK_MULT;
  if (b.resist.includes(el)) return RESIST_MULT;
  return 1;
}

/** the kills of each kind */
export function bestiaryOf(s: { bestiary?: Record<string, number> }) {
  return (s.bestiary ??= {});
}

/** bonus damage against a kind the hero has mastered */
export function masteryPct(s: { bestiary?: Record<string, number> }, id: string) {
  const k = s.bestiary?.[id] ?? 0;
  return k >= KNOW_AT.master2 ? 10 : k >= KNOW_AT.master1 ? 5 : 0;
}

export const EL_NAME: Record<Element, string> = {
  phys: 'zbraně',
  fire: 'oheň',
  ice: 'mráz',
  lightning: 'blesk',
  poison: 'jed',
  holy: 'svaté světlo',
  shadow: 'stín',
};

export const EL_CSS: Record<Element, string> = {
  phys: '#e8e2cf',
  fire: '#ffa860',
  ice: '#9fe6ff',
  lightning: '#fff27a',
  poison: '#9dff7a',
  holy: '#fff6c0',
  shadow: '#d0a8ff',
};
