// The story of Loppo: the hero descends 250 floors to renew the five locks of the seal that holds
// Nyx'thar, Lord of the Depths, and to find Elara, the daughter of the old seal-keeper Ilda.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).

export type SpeakerId = 'narrator' | 'ilda' | 'elara' | 'elaraDark' | 'morgrim' | 'spore' | 'isolda' | 'nyx' | 'diary' | 'smith';
export type SceneId = 'village' | 'quake' | 'hut' | 'gate' | 'kobky' | 'caves' | 'ice' | 'forge' | 'abyss' | 'seal' | 'dawn' | 'black';

export interface Shot {
  scene?: SceneId;
  speaker?: SpeakerId;
  text: string;
  /** chapter card: [small line, big line] */
  title?: [string, string];
  fx?: 'shake' | 'flash';
}

export interface Cutscene {
  id: string;
  /** name in the chronicle */
  name: string;
  shots: Shot[];
}

export const SPEAKERS: Record<SpeakerId, { name: string; color: string }> = {
  narrator: { name: '', color: '#d8ccb4' },
  ilda: { name: 'Ilda', color: '#ffd76a' },
  elara: { name: 'Elara', color: '#9fe6ff' },
  elaraDark: { name: 'Elara', color: '#d49aff' },
  morgrim: { name: 'Morgrim', color: '#ffa070' },
  spore: { name: 'Matka spor', color: '#7affd2' },
  isolda: { name: 'Isolda', color: '#c8ecff' },
  nyx: { name: "Nyx'thar", color: '#c77dff' },
  diary: { name: 'Elařin deník', color: '#e8d8b0' },
  smith: { name: 'Vyrytý nápis', color: '#ffb36a' },
};

const N = (text: string, scene?: SceneId, fx?: Shot['fx']): Shot => ({ speaker: 'narrator', text, scene, fx });
const S = (speaker: SpeakerId, text: string, scene?: SceneId, fx?: Shot['fx']): Shot => ({ speaker, text, scene, fx });
const T = (scene: SceneId, small: string, big: string): Shot => ({ scene, title: [small, big], text: '' });

export const CHAPTERS = [
  { floor: 1, small: 'Kapitola I', big: 'Zapomenuté kobky' },
  { floor: 51, small: 'Kapitola II', big: 'Hladové jeskyně' },
  { floor: 101, small: 'Kapitola III', big: 'Ledové hlubiny' },
  { floor: 151, small: 'Kapitola IV', big: 'Ohnivá výheň' },
  { floor: 201, small: 'Kapitola V', big: 'Propast' },
];

export const CUTSCENES: Cutscene[] = [
  {
    id: 'prolog',
    name: 'Prolog',
    shots: [
      N('Vesnice Loppo leží na úpatí Šedých hor. Po staletí tu lidé žili v klidu a na staré pověsti o tom, co spí pod horou, dávno zapomněli.', 'village'),
      N('Pak se země začala třást. Ze studní stoupal černý dým a v noci se ze starých kobek pod zříceninou hradu plížily nestvůry.', 'quake', 'shake'),
      S('ilda', 'Konečně jsi tady. Jmenuji se Ilda. Celý život hlídám pečeť, o které už nikdo nechce slyšet.', 'hut'),
      S('ilda', "Před tisíci lety spoutalo pět hrdinů pod horou Nyx'thara, Pána hlubin. Pečeť, kterou ho svázali, má pět zámků – jeden na dně každé vrstvy podsvětí.", 'hut'),
      S('ilda', "Zámky praskají. Nyx'thar se probouzí a jeho hlas mění strážce zámků ve své služebníky.", 'hut'),
      S('ilda', 'Před rokem sestoupila dolů moje dcera Elara, aby pečeť opravila. Nevrátila se.', 'hut'),
      S('ilda', 'Dno podsvětí leží dvě stě padesát pater pod námi. Tam na tebe čeká. Najdi Elaru – a zastav ho, dokud je čas.', 'gate'),
      S('ilda', 'Vezmi si tuhle lucernu. Dokud svítí, uslyším tě – a ty uslyšíš mě.', 'gate'),
      T('kobky', 'Kapitola I', 'Zapomenuté kobky'),
    ],
  },
  {
    id: 'ch2',
    name: 'Kapitola II – Hladové jeskyně',
    shots: [
      T('caves', 'Kapitola II', 'Hladové jeskyně'),
      N('Pod kobkami končí dílo lidských rukou. Začínají jeskyně, kde ve tmě svítí houby a kde je slyšet, jak hora dýchá.', 'caves'),
      N('Někde tady, padesát pater hluboko, roste kolem druhého zámku Matka spor.', 'caves'),
    ],
  },
  {
    id: 'ch3',
    name: 'Kapitola III – Ledové hlubiny',
    shots: [
      T('ice', 'Kapitola III', 'Ledové hlubiny'),
      N('Voda, která v jeskyních hučela, tady zamrzla uprostřed pádu. Každý krok zní jako zvon a dech se mění v jinovatku.', 'ice'),
      N("Třetí zámek prý hlídá Isolda – hrdinka, která kdysi pomáhala Nyx'thara spoutat.", 'ice'),
    ],
  },
  {
    id: 'ch4',
    name: 'Kapitola IV – Ohnivá výheň',
    shots: [
      T('forge', 'Kapitola IV', 'Ohnivá výheň'),
      N('Hlouběji led taje a kámen žhne. Tady kdysi Pětice ukula pečeť. Teď kovadliny bijí do rytmu cizího srdce.', 'forge'),
    ],
  },
  {
    id: 'ch5',
    name: 'Kapitola V – Propast',
    shots: [
      T('abyss', 'Kapitola V', 'Propast'),
      N('Pod výhní už nic není. Jen tma, která si pamatuje dobu, kdy ještě nebylo světlo.', 'abyss'),
      S('nyx', 'Konečně jsi blízko. Slyším tvé srdce. Bije tak rychle…', 'abyss'),
    ],
  },
  // ------------------------------------------------------------ pages found on the way (every 10 floors)
  { id: 'note10', name: 'Deník: Den první', shots: [S('diary', '„Den první. Kobky jsou starší, než jsem čekala. Na zdech jsou znaky Pětice – hrdinů, kteří Nyx\'thara spoutali. Maminka by měla radost, že je konečně vidím na vlastní oči.“', 'kobky')] },
  { id: 'note20', name: 'Deník: Vězni', shots: [S('diary', '„Kostlivci tu nejsou mrtví obyvatelé hradu. Jsou to vězni. Někdo je tu drží i po smrti – Strážce bran, Morgrim.“', 'kobky')] },
  { id: 'note30', name: 'Deník: Kupec', shots: [S('diary', '„Potkala jsem kupce, který tvrdí, že tu obchoduje už sto let. Nevím, jestli mu mám věřit, ale jeho lektvary fungují.“', 'kobky')] },
  { id: 'note40', name: 'Deník: Brána', shots: [S('diary', '„Morgrim hlídá bránu do jeskyní. Zabít ho nedokážu, ale můžu ho spoutat pečetí. Snad to vydrží dost dlouho.“', 'kobky')] },
  { id: 'note60', name: 'Deník: Živé jeskyně', shots: [S('diary', '„Jeskyně jsou živé. Houby tu svítí a dýchají. Místní tvorové šeptají o Matce spor, která roste kolem druhého zámku jako plíseň.“', 'caves')] },
  { id: 'note70', name: 'Deník: Hlas', shots: [S('diary', '„Ve snu slyším hlas. Volá mě jménem. Ví, proč jsem přišla. Ví i o mamince.“', 'caves')] },
  { id: 'note80', name: 'Šepot z hlubin', shots: [S('nyx', 'Další malé světýlko v mé tmě. Pojď blíž. Ukaž mi, jak jasně dokážeš hořet.', 'black')] },
  { id: 'note90', name: 'Deník: Podzemní řeka', shots: [S('diary', '„Matku spor nezastavím. Obešla jsem ji podzemní řekou. Zámek musí počkat… nebo na někoho jiného.“', 'caves')] },
  { id: 'note110', name: 'Deník: Isolda', shots: [S('diary', '„Taková zima. Říká se, že Ledová královna byla kdysi jednou z Pětice. Isolda. Zůstala tu dobrovolně, aby hlídala třetí zámek.“', 'ice')] },
  { id: 'note120', name: 'Šepot z hlubin', shots: [S('nyx', 'Isolda mi vzdorovala tisíc let. Tisíc let! A víš, co z ní zbylo? Led. Jen led.', 'black')] },
  { id: 'note130', name: 'Deník: Sliby', shots: [S('diary', '„Hlas už nemluví jen ve snu. Slibuje, že když mu pomůžu, nikomu nahoře neublíží. Mamince by nikdy nic neudělal.“', 'ice')] },
  { id: 'note140', name: 'Deník: Ledové slzy', shots: [S('diary', '„Isolda mě pustila dál. Plakala ledovými slzami a prosila, ať se vrátím nahoru. Neposlechla jsem ji.“', 'ice')] },
  { id: 'note160', name: 'Deník: Pravda', shots: [S('diary', '„Konečně tomu rozumím. Pečeť není vězení pro něj. Je to vězení pro nás – aby svět nahoře nikdy nepoznal pravou sílu.“', 'forge')] },
  { id: 'note170', name: 'Šepot z hlubin', shots: [S('nyx', 'Ona už je moje. Její světlo tak krásně hoří v mé výhni. Přijď se podívat.', 'black')] },
  { id: 'note180', name: 'Nápis na kovadlině', shots: [S('smith', 'Do kovadliny je vyryto: „Pečeť nezlomí síla, jen srdce, které se vzdá. Kdo sem dojde – nevzdávej se.“ – Bořiv, kovář Pětice', 'forge')] },
  { id: 'note190', name: 'Deník: Poslední stránka', shots: [S('diary', '„…pomoc… maminko… ne. NE. Všechno je tak, jak má být. Pán hlubin mi ukázal pravdu.“', 'forge')] },
  { id: 'note210', name: 'Šepot z hlubin', shots: [S('nyx', 'Bereš mi moje hračky. Nevadí. Najdu si novou – tebe.', 'black')] },
  { id: 'note220', name: 'Elařina pečeť', shots: [S('elara', 'Slyšíš mě? Moje pečeť tě chrání, ale na dno už nedosáhne. Tam to bude jen na tobě.', 'abyss')] },
  { id: 'note230', name: 'Šepot z hlubin', shots: [S('nyx', 'Nabízím ti víc, než ti kdy dají nahoře. Věčnost. Moc. Stačí se zastavit a poslouchat.', 'black')] },
  { id: 'note240', name: 'Lucerny v oknech', shots: [S('ilda', 'Cítím tě až tady nahoře. Celá vesnice drží lucerny v oknech. Svítíme pro tebe. Vrať se nám.', 'village')] },
  // ------------------------------------------------------------ story guardians (intro before the fight, outro after it)
  {
    id: 'boss50',
    name: 'Strážce bran',
    shots: [
      N('Za mřížemi brány se pohnula obrovská postava v rezavém brnění. Řetězy zařinčely.'),
      S('morgrim', 'Další, kdo chce dolů? Ta čarodějka mě spoutala… ale její pouta povolila.'),
      S('morgrim', 'Jeho hlas je teď silnější než moje vůle. Nikdo neprojde branou, dokud stojím!'),
    ],
  },
  {
    id: 'boss50end',
    name: 'Strážce bran – konec',
    shots: [
      S('morgrim', 'Konečně… ticho. Jeho hlas utichl.', 'kobky'),
      S('morgrim', 'Ta dívka… šla dolů. Pustil jsem ji, když mě zlomila její pečeť. Najdi ji… dřív než on.', 'kobky'),
      N('Morgrimovo brnění se rozpadlo v prach. Uprostřed zůstal ležet zářící střep – první zámek pečeti se znovu rozzářil.', 'seal', 'flash'),
      S('ilda', 'Cítím to! První zámek drží. Jsem na tebe pyšná. Jdi dál – a dávej na sebe pozor.', 'seal'),
    ],
  },
  {
    id: 'boss100',
    name: 'Matka spor',
    shots: [
      N('Celá jeskyně se zachvěla. Ze stropu se snesl déšť spor a z podhoubí se zvedla obrovská postava.', undefined, 'shake'),
      S('spore', 'Rosteme… krmíme se… ON nás živí…'),
      S('spore', 'Ty budeš PŮDA.'),
    ],
  },
  { id: 'boss100p2', name: 'Matka spor vykvétá', shots: [N('Matka spor se roztrhla – a z jejího nitra vyrazily nové, jedovaté výhonky!', undefined, 'shake'), S('spore', 'VYKVÉTÁM!')] },
  {
    id: 'boss100end',
    name: 'Matka spor – konec',
    shots: [
      N('Poslední spory se snesly k zemi. Jeskyně poprvé po staletích potemněla a ztichla.', 'caves'),
      N('V kořenech zůstal ležet druhý střep pečeti.', 'seal', 'flash'),
      S('ilda', 'Druhý zámek je obnoven. Elara tudy prošla, viď? Cítím ji… je pořád naživu. Pospěš si.', 'seal'),
    ],
  },
  {
    id: 'boss150',
    name: 'Ledová královna',
    shots: [
      S('isolda', 'Stůj. Tisíc let stojím na stráži. Tisíc let mě jeho hlas mrazí zevnitř.'),
      S('isolda', 'Už nevím, koho chráním… Odpusť mi.'),
      S('isolda', 'Jestli chceš dál, musíš mě porazit. Prosím… poraz mě.'),
    ],
  },
  {
    id: 'boss150end',
    name: 'Ledová královna – konec',
    shots: [
      S('isolda', 'Děkuji… Konečně cítím teplo.', 'ice'),
      S('isolda', 'Ta dívka, Elara… šla dolů s jeho hlasem v hlavě. Ještě není pozdě. Zachraň ji.', 'ice'),
      N('Isolda se rozplynula v jemném sněžení. Tam, kde stála, zářil třetí střep pečeti.', 'seal', 'flash'),
      S('ilda', 'Třetí zámek září. Ale moje dcera… ten hlas… Ne. Věřím jí. A věřím tobě.', 'seal'),
    ],
  },
  {
    id: 'boss200',
    name: 'Hlas hlubin',
    shots: [
      N('V záři výhně stála štíhlá postava. Kolem ní vířily stíny jako černá křídla.'),
      S('elaraDark', 'Takže tě maminka poslala za mnou. Jak dojemné.'),
      S('elaraDark', 'Nepotřebuju, aby mě někdo zachraňoval. Pán hlubin mi ukázal pravdu. Uhni mi z cesty!'),
    ],
  },
  { id: 'boss200p2', name: 'Stínové sestry', shots: [S('elaraDark', 'Myslíš, že mě porazíš? Je nás víc!')] },
  { id: 'boss200p3', name: 'Stínová křídla', shots: [S('elara', 'Pomoz… mi…'), S('elaraDark', 'Mlč! On mi dal moc. A ty mi ji nevezmeš!', undefined, 'shake')] },
  {
    id: 'boss200end',
    name: 'Elara – konec',
    shots: [
      N('Stíny se rozprskly jako sklo. Elara klesla na kolena a poprvé po roce se jí v očích rozsvítilo vlastní světlo.', 'forge', 'flash'),
      S('elara', 'Kde… kde to jsem? Ten hlas… je pryč.', 'forge'),
      S('elara', 'Díky tobě jsem zase sama sebou. Maminka tě poslala, viď? Jak se má?', 'forge'),
      S('elara', "Pátý zámek je na samém dně Propasti. Nyx'thar se tam už skoro osvobodil.", 'forge'),
      S('elara', 'Nemám dost sil jít s tebou. Ale dám ti svou pečeť – bude tě chránit. A čtvrtý střep je tvůj.', 'seal'),
      N('Elařina pečeť ti dává trvalé požehnání: +10 % zdraví a +10 % poškození.', 'seal', 'flash'),
    ],
  },
  {
    id: 'boss250',
    name: 'Pán hlubin',
    shots: [
      N('Na dně Propasti se tma pohnula. Otevřelo se oko velké jako brána hradu.', undefined, 'shake'),
      S('nyx', 'Konečně. Malé světýlko na samém dně mé tmy.'),
      S('nyx', 'Pětice mě spoutala na tisíc let. Tisíc let čekám na někoho, kdo dojde až sem.'),
      S('nyx', 'Pokloň se a dám ti svět. Postav se mi – a zhasneš.'),
    ],
  },
  { id: 'boss250p2', name: 'Pravá podoba', shots: [S('nyx', 'Tohle byl jen můj stín. Teď uvidíš, co spí pod horou!', undefined, 'shake')] },
  { id: 'boss250p3', name: 'Srdce hlubin', shots: [S('nyx', 'Ne… střepy… ty máš všechny čtyři…'), S('nyx', 'Jestli padnu, vezmu tvé světlo s sebou!', undefined, 'shake')] },
  {
    id: 'ending',
    name: 'Konec příběhu',
    shots: [
      N("Čtyři střepy se rozzářily a spojily v jediný kruh světla. Nyx'thar zařval – a tma se poprvé po tisíci letech stáhla.", 'seal', 'flash'),
      S('nyx', 'Pětice mě… jen spoutala… Ty… ty mě…', 'seal'),
      N('Pečeť se tentokrát neuzavřela kolem něj. Pohltila ho celého. Pán hlubin zmizel navždy.', 'seal', 'flash'),
      N('Hora se otřásla naposledy. Pak nastalo ticho – skutečné ticho.', 'black', 'shake'),
      N('Na povrchu svítalo. Celá vesnice stála u brány se zapálenými lucernami.', 'dawn'),
      S('ilda', 'Moje dcera je doma. Hora mlčí. A to všechno díky tobě.', 'dawn'),
      S('elara', "Říká se, že pod dnem Propasti je ještě něco. Hlubiny starší než Nyx'thar… Ale to už je jiný příběh.", 'dawn'),
      T('dawn', 'Konec', 'Děkujeme za hraní!'),
    ],
  },
];

export const CUTSCENE_BY_ID: Record<string, Cutscene> = Object.fromEntries(CUTSCENES.map((c) => [c.id, c]));

/** the page waiting on this floor, if any (every 10th floor that is not a story-boss floor) */
export function noteForFloor(floor: number): string | null {
  const id = 'note' + floor;
  return CUTSCENE_BY_ID[id] ? id : null;
}

export function chapterIntroForFloor(floor: number): string | null {
  const i = CHAPTERS.findIndex((c) => c.floor === floor);
  return i > 0 ? 'ch' + (i + 1) : null;
}

/** order of the chronicle: everything in story order */
export const CHRONICLE_ORDER = [
  'prolog',
  'note10', 'note20', 'note30', 'note40', 'boss50', 'boss50end',
  'ch2', 'note60', 'note70', 'note80', 'note90', 'boss100', 'boss100p2', 'boss100end',
  'ch3', 'note110', 'note120', 'note130', 'note140', 'boss150', 'boss150end',
  'ch4', 'note160', 'note170', 'note180', 'note190', 'boss200', 'boss200p2', 'boss200p3', 'boss200end',
  'ch5', 'note210', 'note220', 'note230', 'note240', 'boss250', 'boss250p2', 'boss250p3', 'ending',
];

export interface StoryState {
  seen: string[];
  /** seal shards collected (story guardians defeated on floors 50, 100, 150, 200) */
  shards: number;
  /** Elara's blessing (floor 200) */
  blessing: boolean;
  /** the final guardian is defeated */
  ended: boolean;
}

export function newStory(): StoryState {
  return { seen: [], shards: 0, blessing: false, ended: false };
}
