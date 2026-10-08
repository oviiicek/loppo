// Decisions with consequences: a few people (and one demon) the hero meets in the dungeon ask for
// something. What the hero chooses comes back a few floors deeper – as help, a gift or a betrayal.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).

export type FateId = 'necro' | 'knight' | 'bottle';

/** a choice made, waiting for its consequence */
export interface Fate {
  id: FateId;
  choice: string;
  /** floor where it was made */
  at: number;
  /** floor from which the consequence comes */
  due: number;
  /** the outcome decided when it comes (help / betray …) */
  outcome?: string;
}

export interface FateChoice {
  id: string;
  label: string;
  cls?: string;
}

export interface FateDef {
  id: FateId;
  name: string;
  title: string;
  /** sprite of the one who asks */
  key: string;
  intro: string;
  choices: FateChoice[];
  minFloor: number;
}

export const FATES: FateDef[] = [
  {
    id: 'necro',
    name: 'Morvan',
    title: 'spoutaný nekromant',
    key: 'npc_necro',
    intro:
      'Pst! Ty tam! Osvoboď mě z těch řetězů. Nejsem žádná zrůda – jen jsem studoval, co jsem studovat neměl. Pomoz mi a jednou ti to oplatím. Přísahám na svou duši… na to, co z ní zbylo.',
    choices: [
      { id: 'free', label: 'Osvobodit ho', cls: 'green' },
      { id: 'kill', label: 'Zabít ho', cls: 'red' },
      { id: 'leave', label: 'Nechat ho být' },
    ],
    minFloor: 6,
  },
  {
    id: 'knight',
    name: 'Bertram',
    title: 'raněný rytíř',
    key: 'npc_knight',
    intro: 'Prosím… nemáš lektvar zdraví? Ta rána nepřestává krvácet. Nemám čím zaplatit. Jen slovem rytíře – a to jsem nikdy neporušil.',
    choices: [
      { id: 'give', label: 'Dát mu lektvar zdraví', cls: 'green' },
      { id: 'leave', label: 'Nemám nazbyt' },
    ],
    minFloor: 4,
  },
  {
    id: 'bottle',
    name: 'Lahev s démonem',
    title: 'zakletý démon',
    key: 'demonbottle',
    intro: 'V lahvi se zmítá drobný rudý démon a tluče pěstičkou do skla: „Pusť mě ven! Rozbij lahev a splním ti jedno přání. Jedno jediné! Žádný háček. Skoro žádný.“',
    choices: [
      { id: 'break', label: 'Rozbít lahev', cls: 'red' },
      { id: 'leave', label: 'Nechat ho v lahvi' },
    ],
    minFloor: 8,
  },
];

export const FATE_BY_ID = Object.fromEntries(FATES.map((f) => [f.id, f])) as Record<FateId, FateDef>;

/** the demon's wishes */
export const WISHES = [
  { id: 'gold', label: 'Bohatství', desc: 'hromada zlata' },
  { id: 'power', label: 'Moc', desc: 'legendární předmět' },
  { id: 'wisdom', label: 'Vědění', desc: '+3 body atributů' },
];

/** what the consequence says when it comes */
export const FATE_LINES: Record<string, string> = {
  necroHelp: 'Říkal jsem, že dluh splatím. Mrtví budou dnes bojovat za tebe!',
  necroBetray: 'Díky za svobodu, bláhová duše. Tvoje duše mi poslouží mnohem líp než ty řetězy.',
  necroGhost: 'Můj život skončil tvou rukou… ale pro nekromanta je smrt jen další dveře. Teď si pro tebe přišel můj stín!',
  knightHelp: 'To jsi ty! Tvůj lektvar mi zachránil život. Rytíř dluhy splácí – dnes jdu s tebou.',
  knightDead: 'U zdi leží rytíř v proražené zbroji. Bertram. V ruce svírá meč a vzkaz: „Kdyby mi tak někdo pomohl…“',
  demonBack: 'Přišel čas zaplatit, smrtelná duše! Třetinu tvého zlata – nebo tvoji kůži. Vyber si!',
};

export function fateDueIn(id: FateId): [number, number] {
  return id === 'knight' ? [3, 6] : [4, 8];
}
