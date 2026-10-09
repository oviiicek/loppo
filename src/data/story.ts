// The story of Loppo: the hero descends 250 floors through 25 areas to renew the five locks of the seal
// that holds Nyx'thar, Lord of the Depths, and to find Elara, the daughter of the old seal-keeper Ilda.
// A thousand years ago the Five (Isolda, Květa, Morgrim, Bořiv and Svatava) bound him; three of them
// stayed below to guard the locks and his voice has turned them into monsters.
// Every area opens with a short scene on its first floor, every camp (the 5th floor of an area) keeps a
// page – Elara's diary, a whisper from the depths, a word from Ilda or a carving of the Five – and every
// fiftieth floor closes a chapter with a story guardian.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).

export type SpeakerId = 'narrator' | 'ilda' | 'elara' | 'elaraDark' | 'morgrim' | 'spore' | 'isolda' | 'nyx' | 'diary' | 'smith';
export type SceneId =
  | 'village'
  | 'quake'
  | 'hut'
  | 'gate'
  | 'seal'
  | 'dawn'
  | 'black'
  // the areas
  | 'crypt'
  | 'caves'
  | 'catacombs'
  | 'flooded'
  | 'ice'
  | 'demons'
  | 'mushrooms'
  | 'webs'
  | 'tomb'
  | 'roots'
  | 'crystals'
  | 'dwarves'
  | 'ossuary'
  | 'cathedral'
  | 'hellgate'
  | 'ashes'
  | 'forge'
  | 'swamp'
  | 'obsidian'
  | 'citadel'
  | 'abyss'
  | 'islands'
  | 'mirrors'
  | 'dreams'
  | 'bottom';

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
  /** the picture behind it in the chronicle when its shots name none (the guardians' scenes play over the game) */
  scene?: SceneId;
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

/** the five chapters: fifty floors each, closed by a story guardian */
export const CHAPTERS = [
  { floor: 1, small: 'Kapitola I', big: 'Mrazivá pečeť' },
  { floor: 51, small: 'Kapitola II', big: 'Hladové hlubiny' },
  { floor: 101, small: 'Kapitola III', big: 'Brána podsvětí' },
  { floor: 151, small: 'Kapitola IV', big: 'Stínová citadela' },
  { floor: 201, small: 'Kapitola V', big: 'Dno světa' },
];

/** the picture of every area (data/biomes.ts AREAS, in the same order) */
export const AREA_SCENES: SceneId[] = [
  'crypt', 'caves', 'catacombs', 'flooded', 'ice',
  'demons', 'mushrooms', 'webs', 'tomb', 'roots',
  'crystals', 'dwarves', 'ossuary', 'cathedral', 'hellgate',
  'ashes', 'forge', 'swamp', 'obsidian', 'citadel',
  'abyss', 'islands', 'mirrors', 'dreams', 'bottom',
];

/** a camp's page (the 5th floor of every area) */
const page = (floor: number, name: string, shot: Shot): Cutscene => ({ id: 'camp' + floor, name, shots: [shot] });
/** an area's opening scene (its first floor) */
const area = (n: number, name: string, shots: Shot[]): Cutscene => ({ id: 'area' + n, name, shots });

export const CUTSCENES: Cutscene[] = [
  {
    id: 'prolog',
    name: 'Prolog',
    shots: [
      N('Vesnice Loppo leží na úpatí Šedých hor. Po staletí tu lidé žili v klidu a na staré pověsti o tom, co spí pod horou, dávno zapomněli.', 'village'),
      N('Pak se země začala třást. Ze studní stoupal černý dým a v noci se ze staré krypty pod zříceninou hradu plížily nestvůry.', 'quake', 'shake'),
      S('ilda', 'Konečně jsi tady. Jmenuji se Ilda. Celý život hlídám pečeť, o které už nikdo nechce slyšet.', 'hut'),
      S('ilda', "Před tisíci lety spoutala Pětice – pět hrdinů – pod horou Nyx'thara, Pána hlubin. Kovář Bořiv ukul pečeť s pěti zámky a Pětice je rozmístila na cestě do hlubin.", 'hut'),
      S('ilda', 'Tři z nich zůstali dole jako strážci: čarodějka Isolda, druidka Květa a rytíř Morgrim. Čtvrtý zámek střežili kněží v citadele, která tehdy ještě zářila. Pátý leží přímo na něm.', 'hut'),
      S('ilda', 'Jenže tisíc let je dlouhá doba. Jeho hlas prosakuje skálou a mění strážce v nestvůry. Zámky praskají.', 'hut'),
      S('ilda', 'Před rokem sestoupila dolů moje dcera Elara, aby pečeť opravila. Nevrátila se.', 'hut'),
      S('ilda', 'Dno světa leží dvě stě padesát pater pod námi. Každých deset pater je jiný svět a na konci každé desítky čeká strážce.', 'gate'),
      S('ilda', 'Vezmi si tuhle lucernu. Patřila Svatavě, kněžce Pětice. Dokud svítí, uslyším tě – a ty uslyšíš mě.', 'gate'),
      T('crypt', 'Kapitola I', 'Mrazivá pečeť'),
      N('Pod zříceninou hradu začíná Stará krypta. Mniši tu kdysi hlídali vchod do hlubin. Teď tu hlídají jen jejich kosti.', 'crypt'),
    ],
  },
  // ------------------------------------------------------------ chapter I · the frozen lock (floors 1–50)
  page(5, 'Deník: Den první', S('diary', '„Den první. Krypta je starší, než jsem čekala. Na víkách rakví jsou znaky Pětice. Maminka by měla radost, že je konečně vidím na vlastní oči.“', 'crypt')),
  area(2, 'Jeskyně', [
    N('Krypta končí rozbitou zdí. Za ní začínají jeskyně, které nikdo nevykopal. Kape tu voda a ve tmě svítí houby.', 'caves'),
    N('Na stěně jsou čerstvé značky skřetů. A pod nimi jedna starší, vyrytá nožem: „E. → dolů.“', 'caves'),
  ]),
  page(15, 'Deník: Skřetí trh', S('diary', '„Skřeti tu mají celé tržiště. Nechali mě projít za tři koláče. Maminčiny koláče fungují i tady dole.“', 'caves')),
  area(3, 'Katakomby', [
    N('Katakomby. Zdi tu nejsou z kamene, ale z lebek – tisíce prázdných očí sledují každý krok.', 'catacombs'),
    S('ilda', 'Tady pohřbívali ty, kdo padli v první válce s hlubinou. Prokaž jim úctu. Většina z nich za nás kdysi bojovala.', 'catacombs'),
  ]),
  page(25, 'Nápis v katakombách', S('smith', 'Nad branou kostnice je vytesáno: „Padli jsme, aby jiní žili. Neplač nad námi – jdi dál.“', 'catacombs')),
  area(4, 'Zatopené ruiny', [
    N('Pod katakombami leží utopené město. Žili tu horníci, kteří pro Pětici dobývali stříbro na pečeť.', 'flooded'),
    N('Kopali tak hluboko, až prokopali dno. Pak přišla voda. Stoupá dodnes – a v ní plave něco, co nemá jméno.', 'flooded'),
  ]),
  page(35, 'Deník: Stříbro', S('diary', '„Ve sklepech utopeného města jsou pořád hromady stříbra. Nikdo si ho nevzal. Asi proto, že stříbro tu dole křičí, když na něj sáhneš.“', 'flooded')),
  area(5, 'Ledový dungeon', [
    N('Voda tu zamrzla uprostřed vlny. Chodby jsou z modrého ledu a každý krok zní jako zvon.', 'ice'),
    S('ilda', 'Tady drží první zámek Isolda, čarodějka Pětice. Byla z nich nejlaskavější… Jestli ji jeho hlas změnil, nebude to boj, který chceš vyhrát. Ale musíš.', 'ice'),
  ]),
  page(45, 'Deník: Ledové slzy', S('diary', '„Isolda mě pustila dál. Plakala ledovými slzami a prosila, ať se vrátím nahoru. Neposlechla jsem ji.“', 'ice')),
  // ------------------------------------------------------------ chapter II · the hungry depths (51–100)
  area(6, 'Kapitola II – Hladové hlubiny', [
    T('demons', 'Kapitola II', 'Hladové hlubiny'),
    N('Pod ledem se skála otevírá jako rána. Z puklin sálá žár a ozývá se bubnování – démoni se derou nahoru.', 'demons'),
    S('ilda', 'První zámek drží, ale pečeť je jen tak silná jako její nejslabší zámek. Druhý je u Kořenů světa. Hlídá ho Květa, druidka Pětice. Pospěš si.', 'demons'),
  ]),
  page(55, 'Šepot z hlubin', S('nyx', 'Další malé světýlko v mé tmě. Pojď blíž. Ukaž mi, jak jasně dokážeš hořet.', 'black')),
  area(7, 'Houbový les', [
    N('Houby tu rostou do výšky stromů a svítí jako lucerny. Spory padají jako sníh – a kde dopadnou, vyrůstá něco hladového.', 'mushrooms'),
    N('Všechny houby rostou stejným směrem. Dolů. Ke Kořenům světa.', 'mushrooms'),
  ]),
  page(65, 'Deník: Dýchající les', S('diary', '„Houby tu dýchají. Místní tvorové šeptají o Matce spor, která roste kolem druhého zámku jako plíseň. Prý bývala člověkem.“', 'mushrooms')),
  area(8, 'Pavoučí hnízda', [
    N('Pavučiny visí přes chodby jako opony. V zámotcích jsou zbytky dobrodruhů… a mezi nimi lucerna se znakem Pětice.', 'webs'),
    S('ilda', 'To je Elařina lucerna! Proto ji už rok neslyším. Ztratila ji tady… ale šla dál. Musela jít dál.', 'webs'),
  ]),
  page(75, 'Deník: Ticho', S('diary', '„Pavouci mi vzali lucernu i s kusem pláště. Maminku už neslyším. Je tu takové ticho, že slyším vlastní srdce.“', 'webs')),
  area(9, 'Hrobka pouštních králů', [
    N('Písek? Tak hluboko pod horou? Kdysi tu prý byla poušť – než se nad ní zavřela skála. Její králové se dali pohřbít i se zlatem a s prokletím.', 'tomb'),
    N('Na dveřích hrobky stojí: „Kdo vezme zlato krále, zůstane s králem.“', 'tomb'),
  ]),
  page(85, 'Šepot z hlubin', S('nyx', 'Králové pouště mi sloužili rádi. Za věčný život stačilo tak málo. Jen mi dát všechno.', 'black')),
  area(10, 'Kořeny světa', [
    N('Kořeny tlusté jako věže prorůstají skálou. Patří stromu, který roste nahoře v Šedých horách – nejstaršímu stromu světa.', 'roots'),
    S('ilda', 'Květa zapletla druhý zámek do kořenů, aby ho nikdo nenašel. Ale odtud cítím jen hnilobu… a něco, co roste.', 'roots'),
  ]),
  page(95, 'Deník: Podzemní řeka', S('diary', '„Matku spor nezastavím. Obešla jsem ji podzemní řekou. Zámek musí počkat… nebo na někoho jiného.“', 'roots')),
  // ------------------------------------------------------------ chapter III · the gate of the underworld (101–150)
  area(11, 'Kapitola III – Brána podsvětí', [
    T('crystals', 'Kapitola III', 'Brána podsvětí'),
    N('Pod kořeny se skála mění v krystal. Když na něj dopadne světlo lucerny, celá jeskyně zazpívá.', 'crystals'),
    S('ilda', 'Dva zámky drží. Třetí je u Brány podsvětí a hlídá ho Morgrim, rytíř Pětice. Přísahal, že bránou nikdo neprojde. Bojím se, že tu přísahu drží dodnes.', 'crystals'),
  ]),
  page(105, 'Deník: Hlas', S('diary', '„Ve snu slyším hlas. Volá mě jménem. Ví, proč jsem přišla. Ví i o mamince.“', 'crystals')),
  area(12, 'Trpasličí síně', [
    N('Obří síně vytesané do skály. Trpaslíci z Hlubokého kmene tu kdysi prokopali Pětici cestu dolů.', 'dwarves'),
    N('Kovadliny vychladly a sochám králů chybí hlavy. Trpaslíci odešli – nebo kopali příliš hluboko.', 'dwarves'),
  ]),
  page(115, 'Nápis na trůnu', S('smith', 'Do trůnu je vytesáno: „Kopali jsme pro Pětici, kopali jsme pro světlo. Ale hlubina kopala proti nám.“ – Grimbold, poslední král Hlubokého kmene', 'dwarves')),
  area(13, 'Kostnice', [
    N('Kostnice. Lustry z kostí, oltáře z lebek. Leží tu ti, kdo neprošli Morgrimovou branou – a nesmějí odejít ani po smrti.', 'ossuary'),
    N('Kosti tu šeptají. Pořád dokola jen jedno jméno: Morgrim.', 'ossuary'),
  ]),
  page(125, 'Deník: Rytíř', S('diary', '„Morgrim mě nechtěl pustit. Spoutala jsem ho pečetí a on poklekl. Řekl: ‚Jdi, dcero Svatavy. Já tu zůstanu navždy.‘ Bylo mi ho líto.“', 'ossuary')),
  area(14, 'Zatopená katedrála', [
    N('Pod hladinou podzemního jezera stojí katedrála. Postavila ji Svatava, kněžka Pětice – Ildina dávná pramáti.', 'cathedral'),
    S('ilda', 'Tady se modlila, než šla s ostatními dolů. Odtud je i tvoje lucerna. Slyšíš ty zvony pod vodou? Zvoní pro tebe.', 'cathedral'),
  ]),
  page(135, 'Nápis na oltáři', S('smith', 'Na oltáři stojí: „Světlo není to, co svítí. Světlo je to, co se nevzdá tmy.“ – Svatava', 'cathedral')),
  area(15, 'Brána podsvětí', [
    N('Chodba končí branou vysokou jako hora. Visí na ní řetězy silné jako stromy a za mřížemi plane podsvětí.', 'hellgate'),
    S('ilda', 'Za touhle branou už nejsou chodby, které by postavili lidé. Morgrim ji hlídá tisíc let. Doufám, že ještě pozná, kdo je přítel.', 'hellgate'),
  ]),
  page(145, 'Šepot z hlubin', S('nyx', 'Morgrim mi slíbil věrnost dřív, než o tom věděl. Každá přísaha je řetěz. A já držím všechny konce.', 'black')),
  // ------------------------------------------------------------ chapter IV · the shadow citadel (151–200)
  area(16, 'Kapitola IV – Stínová citadela', [
    T('ashes', 'Kapitola IV', 'Stínová citadela'),
    N('Za branou leží pláně šedého popela. Kamenné nebe žhne jako uhlíky a padají z něj jiskry.', 'ashes'),
    N('Na obzoru stojí černá věž. Stínová citadela. Kdysi v ní hořelo světlo Svatavina řádu. Teď z ní vychází jen tma.', 'ashes'),
  ]),
  page(155, 'Deník: Pravda', S('diary', '„Konečně tomu rozumím. Pečeť není vězení pro něj. Je to vězení pro nás – aby svět nahoře nikdy nepoznal pravou sílu.“', 'ashes')),
  area(17, 'Kovárny Pětice', [
    N('Kovárny Pětice. Tady kovář Bořiv sedm dní a sedm nocí kul pečeť. Kovadliny žhnou dodnes – bijí do rytmu cizího srdce.', 'forge'),
    S('ilda', 'Bořiv prý do každého zámku vložil kus vlastního srdce. Proto pečeť vydržela tisíc let.', 'forge'),
  ]),
  page(165, 'Nápis na kovadlině', S('smith', 'Do kovadliny je vyryto: „Pečeť nezlomí síla, jen srdce, které se vzdá. Kdo sem dojde – nevzdávej se.“ – Bořiv, kovář Pětice', 'forge')),
  area(18, 'Hnijící bažiny', [
    N('Teplá zelená voda, mlha a bzučení much. V bažinách hnije všechno – dřevo, kámen, i čas.', 'swamp'),
    N('V bahně jsou otisky malých bot. Čas tu hnije tak pomalu, že jsou pořád čerstvé – i po roce. Vedou k citadele.', 'swamp'),
  ]),
  page(175, 'Šepot z hlubin', S('nyx', 'Ona už je moje. Její světlo tak krásně hoří v mé citadele. Přijď se podívat.', 'black')),
  area(19, 'Obsidiánová hlubina', [
    N('Černé sklo, lávové řeky a tisíce odrazů. V každém se pohne něco, co v jeskyni není.', 'obsidian'),
    S('nyx', 'Vidíš se v tom skle? Takhle tě vidím já. Malé světlo, které jde tak snadno zhasnout.', 'obsidian'),
  ]),
  page(185, 'Deník: Poslední stránka', S('diary', '„…pomoc… maminko… ne. NE. Všechno je tak, jak má být. Pán hlubin mi ukázal pravdu.“', 'obsidian')),
  area(20, 'Stínová citadela', [
    N('Stínová citadela. Brány jsou otevřené dokořán – jako by tu někdo čekal návštěvu.', 'citadel'),
    S('ilda', 'Je tam. Cítím ji. Moje Elara… Ale není sama. Ten hlas je s ní.', 'citadel'),
  ]),
  page(195, 'Ildina prosba', S('ilda', 'Prosím… ať se stane cokoli, neubližuj jí víc, než musíš. Pořád je to moje holčička.', 'citadel')),
  // ------------------------------------------------------------ chapter V · the bottom of the world (201–250)
  area(21, 'Kapitola V – Dno světa', [
    T('abyss', 'Kapitola V', 'Dno světa'),
    N('Tady končí kámen. Dál vede jen pár mostů přes nic – a tma, která si pamatuje dobu, kdy ještě nebylo světlo.', 'abyss'),
    S('nyx', 'Konečně jsi blízko. Slyším tvé srdce. Bije tak rychle…', 'abyss'),
  ]),
  page(205, 'Šepot z hlubin', S('nyx', 'Bereš mi moje hračky. Nevadí. Najdu si novou – tebe.', 'black')),
  area(22, 'Plovoucí ostrovy', [
    N('Kusy skal plují v prázdnotě jako ostrovy v černém moři. Mezi nimi se klenou mosty z ničeho.', 'islands'),
    S('elara', 'Nedívej se dolů. Já se jednou podívala… a hlas mě skoro stáhl s sebou.', 'islands'),
  ]),
  page(215, 'Elařina pečeť', S('elara', 'Slyšíš mě? Moje pečeť tě chrání, ale na dno už nedosáhne. Tam to bude jen na tobě.', 'islands')),
  area(23, 'Zrcadlový palác', [
    N('Palác ze zrcadel. Každé ukazuje někoho jiného – krále, žebráka, nestvůru. Žádné neukazuje pravdu.', 'mirrors'),
    S('nyx', 'Podívej – tady nosíš korunu. A tady jsi jen stín. Vyber si, co chceš být. Já ti to splním.', 'mirrors'),
  ]),
  page(225, 'Šepot z hlubin', S('nyx', 'Nabízím ti víc, než ti kdy dají nahoře. Věčnost. Moc. Stačí se zastavit a poslouchat.', 'black')),
  area(24, 'Hlubina snů', [
    N('Hlubina snů. Zdají se tu sny všem, kdo kdy pod horou usnuli – mnichům, horníkům, trpaslíkům i Pětici.', 'dreams'),
    N('Někde mezi nimi je i sen malé holky z Loppa, která chtěla zachránit svět.', 'dreams'),
  ]),
  page(235, 'Elařin sen', S('elara', 'Ve snech jsem viděla Pětici. Smáli se u ohně jako obyčejní lidé. Nebyli to bohové. Jen se nevzdali. Nevzdávej se ani ty.', 'dreams')),
  area(25, 'Dno světa', [
    N('Dno světa. Pod nohama už není kámen, jen černé sklo – a pod ním se něco obrovského pomalu nadechuje.', 'bottom'),
    S('ilda', 'Za tebou září čtyři zámky. Před tebou je ten poslední. Pětice by na tebe byla pyšná.', 'seal'),
  ]),
  page(245, 'Lucerny v oknech', S('ilda', 'Cítím tě až tady nahoře. Celá vesnice drží lucerny v oknech. Svítíme pro tebe. Vrať se nám.', 'village')),
  // ------------------------------------------------------------ story guardians (intro before the fight, outro after it)
  {
    id: 'boss50',
    name: 'Ledová královna',
    scene: 'ice',
    shots: [
      N('Uprostřed ledové síně stojí trůn z ledu. Žena v plášti z jinovatky vstala – a celý dungeon zazvonil.'),
      S('isolda', 'Stůj. Tisíc let stojím na stráži prvního zámku. Tisíc let mě jeho hlas mrazí zevnitř.'),
      S('isolda', 'Už nevím, koho chráním… Odpusť mi.'),
      S('isolda', 'Jestli chceš dál, musíš mě porazit. Prosím… poraz mě.'),
    ],
  },
  {
    id: 'boss50end',
    name: 'Ledová královna – konec',
    shots: [
      S('isolda', 'Děkuji… Konečně cítím teplo.', 'ice'),
      S('isolda', 'Před rokem tudy šla dívka s lucernou. Elara. Prosila jsem ji, ať se vrátí. Nevrátila se. Najdi ji, dřív než ji najde on.', 'ice'),
      N('Isolda se rozplynula v jemném sněžení. Tam, kde stála, zůstal ležet zářící střep – první zámek pečeti se znovu rozzářil.', 'seal', 'flash'),
      S('ilda', 'Cítím to! První zámek drží a Isolda je konečně volná. Jdi dál – a dávej na sebe pozor.', 'seal'),
    ],
  },
  {
    id: 'boss100',
    name: 'Matka spor',
    scene: 'roots',
    shots: [
      N('Kořeny se zachvěly. Ze stropu se snesl déšť spor a z podhoubí se zvedla obrovská postava porostlá houbami.', undefined, 'shake'),
      S('spore', 'Rosteme… krmíme se… ON nás živí…'),
      S('spore', 'Kdysi… jsem měla jméno… Květa… Ne. Teď jsem MATKA. A ty budeš PŮDA.'),
    ],
  },
  { id: 'boss100p2', name: 'Matka spor vykvétá', scene: 'roots', shots: [N('Matka spor se roztrhla – a z jejího nitra vyrazily nové, jedovaté výhonky!', undefined, 'shake'), S('spore', 'VYKVÉTÁM!')] },
  {
    id: 'boss100end',
    name: 'Matka spor – konec',
    shots: [
      N('Poslední spory se snesly k zemi. Kořeny světa se poprvé po staletích nadechly čistého vzduchu.', 'roots'),
      S('spore', '…děkuji… Už zase slyším strom. Zpívá…', 'roots'),
      N('Uprostřed podhoubí zůstal ležet druhý střep pečeti.', 'seal', 'flash'),
      S('ilda', 'Druhý zámek je obnoven a Květa našla klid. Elara tudy prošla, viď? Cítím ji… je pořád naživu. Pospěš si.', 'seal'),
    ],
  },
  {
    id: 'boss150',
    name: 'Strážce bran',
    scene: 'hellgate',
    shots: [
      N('Brána podsvětí se otevřela s rachotem řetězů. Za ní stál obr v rezavém brnění, s mečem dlouhým jako most.', undefined, 'shake'),
      S('morgrim', 'Jsem Morgrim z Pětice. Přísahal jsem, že bránou nikdo neprojde. Nikdo!'),
      S('morgrim', 'Ta dívka mě spoutala pečetí a prošla. Podruhé to nedovolím. Bojuj – nebo se vrať!'),
    ],
  },
  {
    id: 'boss150end',
    name: 'Strážce bran – konec',
    shots: [
      S('morgrim', 'Konečně… ticho. Jeho hlas utichl. Tisíc let jsem držel přísahu, kterou mi dávno ukradl.', 'hellgate'),
      S('morgrim', 'Ta dívka, Elara… šla do citadely. Tam je jeho hlas nejsilnější. Najdi ji… dřív než bude pozdě.', 'hellgate'),
      N('Morgrimovo brnění se rozpadlo v prach. Uprostřed zůstal ležet třetí střep pečeti.', 'seal', 'flash'),
      S('ilda', 'Třetí zámek září. Ale moje dcera… ten hlas… Ne. Věřím jí. A věřím tobě.', 'seal'),
    ],
  },
  {
    id: 'boss200',
    name: 'Hlas hlubin',
    scene: 'citadel',
    shots: [
      N('V trůnním sále citadely stála štíhlá postava. Kolem ní vířily stíny jako černá křídla.'),
      S('elaraDark', 'Takže tě maminka poslala za mnou. Jak dojemné.'),
      S('elaraDark', 'Nepotřebuju, aby mě někdo zachraňoval. Pán hlubin mi ukázal pravdu. Uhni mi z cesty!'),
    ],
  },
  { id: 'boss200p2', name: 'Stínové sestry', scene: 'citadel', shots: [S('elaraDark', 'Myslíš, že mě porazíš? Je nás víc!')] },
  { id: 'boss200p3', name: 'Stínová křídla', scene: 'citadel', shots: [S('elara', 'Pomoz… mi…'), S('elaraDark', 'Mlč! On mi dal moc. A ty mi ji nevezmeš!', undefined, 'shake')] },
  {
    id: 'boss200end',
    name: 'Elara – konec',
    shots: [
      N('Stíny se rozprskly jako sklo. Elara klesla na kolena a poprvé po roce se jí v očích rozsvítilo vlastní světlo.', 'citadel', 'flash'),
      S('elara', 'Kde… kde to jsem? Ten hlas… je pryč.', 'citadel'),
      S('elara', 'Díky tobě jsem zase sama sebou. Maminka tě poslala, viď? Jak se má?', 'citadel'),
      S('elara', "Pátý zámek je na samém dně světa. Nyx'thar se tam už skoro osvobodil.", 'citadel'),
      S('elara', 'Nemám dost sil jít s tebou. Ale dám ti svou pečeť – bude tě chránit. A čtvrtý střep je tvůj.', 'seal'),
      N('Elařina pečeť ti dává trvalé požehnání: +10 % zdraví a +10 % poškození.', 'seal', 'flash'),
    ],
  },
  {
    id: 'boss250',
    name: 'Pán hlubin',
    scene: 'bottom',
    shots: [
      N('Na dně světa se tma pohnula. Otevřelo se oko velké jako brána hradu.', undefined, 'shake'),
      S('nyx', 'Konečně. Malé světýlko na samém dně mé tmy.'),
      S('nyx', 'Pětice mě spoutala na tisíc let. Tisíc let čekám na někoho, kdo dojde až sem.'),
      S('nyx', 'Pokloň se a dám ti svět. Postav se mi – a zhasneš.'),
    ],
  },
  { id: 'boss250p2', name: 'Pravá podoba', scene: 'bottom', shots: [S('nyx', 'Tohle byl jen můj stín. Teď uvidíš, co spí pod horou!', undefined, 'shake')] },
  { id: 'boss250p3', name: 'Srdce hlubin', scene: 'bottom', shots: [S('nyx', 'Ne… střepy… ty máš všechny čtyři…'), S('nyx', 'Jestli padnu, vezmu tvé světlo s sebou!', undefined, 'shake')] },
  {
    id: 'ending',
    name: 'Konec příběhu',
    shots: [
      N("Čtyři střepy se rozzářily a spojily v jediný kruh světla. Nyx'thar zařval – a tma se poprvé po tisíci letech stáhla.", 'seal', 'flash'),
      S('nyx', 'Pětice mě… jen spoutala… Ty… ty mě…', 'bottom'),
      N('Pečeť se tentokrát neuzavřela kolem něj. Pohltila ho celého. Pán hlubin zmizel navždy.', 'seal', 'flash'),
      N('Hora se otřásla naposledy. Pak nastalo ticho – skutečné ticho.', 'black', 'shake'),
      N('Na povrchu svítalo. Celá vesnice stála u brány se zapálenými lucernami.', 'dawn'),
      S('ilda', 'Moje dcera je doma. Hora mlčí. A to všechno díky tobě.', 'dawn'),
      S('elara', "Říká se, že pod dnem světa je ještě něco. Hlubiny starší než Nyx'thar… Ale to už je jiný příběh.", 'dawn'),
      T('dawn', 'Konec', 'Děkujeme za hraní!'),
    ],
  },
];

export const CUTSCENE_BY_ID: Record<string, Cutscene> = Object.fromEntries(CUTSCENES.map((c) => [c.id, c]));

/** the page waiting on this floor, if any (the camp of every area) */
export function noteForFloor(floor: number): string | null {
  const id = 'camp' + floor;
  return CUTSCENE_BY_ID[id] ? id : null;
}

/** the opening scene of the area a floor belongs to (the first area's is part of the prologue) */
export function areaIntroForFloor(floor: number): string | null {
  if (floor < 1 || floor > 250) return null;
  const id = 'area' + (Math.floor((floor - 1) / 10) + 1);
  return CUTSCENE_BY_ID[id] ? id : null;
}

/** the floor a scene of the story belongs to (0 for the prologue) */
export function storyFloor(id: string): number {
  if (id === 'prolog') return 0;
  if (id === 'ending') return 250;
  const a = id.match(/^area(\d+)$/);
  if (a) return (+a[1] - 1) * 10 + 1;
  const n = id.match(/\d+/);
  return n ? +n[0] : 9999;
}

/** order of the chronicle: everything in story order */
export const CHRONICLE_ORDER: string[] = CUTSCENES.map((c) => c.id);

export interface StoryState {
  seen: string[];
  /** seal shards collected (story guardians defeated on floors 50, 100, 150, 200) */
  shards: number;
  /** Elara's blessing (floor 200) */
  blessing: boolean;
  /** the final guardian is defeated */
  ended: boolean;
  /** the version of the story the hero knows (2: the story of the 25 areas) */
  v?: number;
}

export function newStory(): StoryState {
  return { seen: [], shards: 0, blessing: false, ended: false, v: 2 };
}

/** a hero from the time of the old story (five biomes): the scenes of the areas already behind count as
 *  seen (they wait in the chronicle), the area the hero is in still opens with its scene */
export function migrateStory(st: StoryState, floor: number) {
  if (st.v === 2) return;
  st.v = 2;
  if (!st.seen.length) return;
  const here = Math.floor((Math.max(1, floor) - 1) / 10) * 10 + 1;
  for (const c of CUTSCENES) {
    if (st.seen.includes(c.id) || c.id.startsWith('boss') || c.id === 'ending') continue;
    if (storyFloor(c.id) < here) st.seen.push(c.id);
  }
}
