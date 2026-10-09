// The descent: 25 areas of ten floors, each with its own look, monsters and story. Five of them close a
// chapter of the story with a story guardian (floors 50, 100 … 250); below floor 250 the endless depths
// go through the areas again.
export const AREA_FLOORS = 10;
export const STORY_FLOORS = 250;

export interface Area {
  name: string;
  /** one line about it (the floor card of its first floor, the expedition) */
  desc: string;
  /** its look: an index into THEMES (gfx/textures.ts, gfx/areathemes.ts) */
  theme: number;
  /** its two monster families (the first one is met more often) */
  families: [string, string];
  /** the notes and wall writings found there (data/lore.ts: 0 dungeons, 1 caves, 2 ice, 3 fire, 4 abyss) */
  lore: number;
}

const A = (name: string, theme: number, families: [string, string], lore: number, desc: string): Area => ({ name, desc, theme, families, lore });

export const AREAS: Area[] = [
  // Chapter I · the frozen lock (1–50)
  A('Stará krypta', 6, ['undead', 'vermin'], 0, 'Hrobky mnichů pod zříceninou hradu. Ne všichni tu spí klidně.'),
  A('Jeskyně', 1, ['greenskin', 'spider'], 1, 'Kapající chodby, svítící houby a skřetí tábory.'),
  A('Katakomby', 7, ['undead', 'ghoul'], 0, 'Zdi z lebek a kostí. Mrtví tu marně hledají cestu ven.'),
  A('Zatopené ruiny', 8, ['vermin', 'ghoul'], 1, 'Utopené město horníků. Voda stoupá a ve tmě něco plave.'),
  A('Ledový dungeon', 2, ['frost', 'undead'], 2, 'Síně z věčného ledu. Na jejich konci čeká Isolda.'),
  // Chapter II · the hungry depths (51–100)
  A('Démonické podzemí', 9, ['hell', 'cult'], 3, 'Puklinami sem prosakuje oheň z hlubin – a jeho služebníci.'),
  A('Houbový les', 10, ['vermin', 'spider'], 1, 'Houby vysoké jako stromy. Vzduch je hustý sporami.'),
  A('Pavoučí hnízda', 11, ['spider', 'vampire'], 1, 'Pavučiny jako opony a v nich zámotky. Některé se hýbou.'),
  A('Hrobka pouštních králů', 12, ['undead', 'cult'], 0, 'Písek, zlato a prokletí králů, kteří odmítli zemřít.'),
  A('Kořeny světa', 13, ['vermin', 'golem'], 1, 'Kořeny prastarého stromu prorůstají skálou. Tady roste Matka spor.'),
  // Chapter III · the gate of the underworld (101–150)
  A('Krystalové jeskyně', 14, ['golem', 'frost'], 2, 'Krystaly zpívají, když se jich dotkne světlo.'),
  A('Trpasličí síně', 15, ['golem', 'greenskin'], 3, 'Opuštěné sály trpaslíků, kteří prokopali cestu k pečeti.'),
  A('Kostnice', 16, ['undead', 'ghoul'], 0, 'Lustry z kostí a oltáře z lebek. Kosti tu šeptají jména.'),
  A('Zatopená katedrála', 17, ['cult', 'vampire'], 2, 'Svatyně kněžky Svatavy. Pod hladinou zvoní utopené zvony.'),
  A('Brána podsvětí', 18, ['undead', 'hell'], 3, 'Obří brána s řetězy. Hlídá ji Morgrim, Strážce bran.'),
  // Chapter IV · the shadow citadel (151–200)
  A('Popelavé pláně', 19, ['hell', 'golem'], 3, 'Pláně šedého popela. Z kamenného nebe prší jiskry.'),
  A('Kovárny Pětice', 3, ['golem', 'hell'], 3, 'Výheň, ve které kovář Bořiv ukul pečeť. Kovadliny ještě žhnou.'),
  A('Hnijící bažiny', 20, ['vermin', 'ghoul'], 1, 'Teplá zelená voda a mlha. Všechno tu hnije – i čas.'),
  A('Obsidiánová hlubina', 21, ['hell', 'void'], 3, 'Černé sklo a láva. V odrazech se pohybuje něco cizího.'),
  A('Stínová citadela', 22, ['vampire', 'cult'], 4, 'Pevnost ze stínů. Vládne jí Hlas hlubin.'),
  // Chapter V · the bottom of the world (201–250)
  A('Okraj prázdnoty', 4, ['void', 'cult'], 4, 'Tady končí kámen. Dál je jen tma a mosty přes nic.'),
  A('Plovoucí ostrovy', 23, ['void', 'frost'], 4, 'Kusy skal plují v prázdnotě. Nedívej se dolů.'),
  A('Zrcadlový palác', 24, ['void', 'vampire'], 4, 'Každé zrcadlo ukazuje někoho jiného. Žádné neukazuje pravdu.'),
  A('Hlubina snů', 25, ['void', 'undead'], 4, 'Sny všech, kdo tu kdy usnuli. Některé jsou noční můry.'),
  A('Dno světa', 26, ['void', 'hell'], 4, "Nejhlubší místo pod horou. Tady spí Nyx'thar."),
];

/** the area a floor belongs to (0 … 24; the endless depths below the story go through them again) */
export function areaIndex(floor: number) {
  return Math.floor((Math.max(1, floor) - 1) / AREA_FLOORS) % AREAS.length;
}

export const areaOf = (floor: number) => AREAS[areaIndex(floor)];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** name of the area a floor belongs to and its floors (the endless depths number their rounds: Stará krypta II …) */
export function areaForFloor(floor: number): { name: string; from: number; to: number; area: Area; index: number } {
  const f = Math.max(1, floor);
  const i = areaIndex(f);
  const from = Math.floor((f - 1) / AREA_FLOORS) * AREA_FLOORS + 1;
  const round = Math.floor((f - 1) / STORY_FLOORS);
  const name = AREAS[i].name + (round > 0 ? ' ' + (ROMAN[round + 1] ?? round + 1) : '');
  return { name, from, to: from + AREA_FLOORS - 1, area: AREAS[i], index: i };
}

/** the look of a floor (an index into THEMES) */
export function themeForFloor(floor: number) {
  return AREAS[areaIndex(floor)].theme;
}

/** the families met on a floor (a rift has its own twisted crowd) */
export function familiesFor(floor: number, rift?: 'rift' | 'dream' | 'last'): [string, string] {
  const a = areaIndex(floor);
  if (rift === 'rift') return a >= 20 ? ['hell', 'golem'] : ['void', 'hell'];
  return AREAS[a].families;
}

/** the look of a rift: the forge's fire under the void, the void everywhere else */
export const riftTheme = (floor: number) => (areaIndex(floor) >= 20 ? 3 : 4);
