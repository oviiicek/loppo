// What the guardians of the floors say before a fight (the story guardians have whole scenes in story.ts).
// One line is picked at random each time, so a second fight with the same guardian sounds a little different.
// The lines speak to the hero without words that would give the hero a gender.

export const GUARDIAN_LINES: Record<string, string[]> = {
  skelKing: [
    'Kdo se opovažuje rušit spánek krále? Mé kosti si pamatují tisíc bitev.',
    'Klekni před svým králem… nebo se k mé armádě přidáš jako kostra.',
    'Koruna je těžká. Tvoje lebka by jí ale slušela.',
  ],
  slimeKing: ['Blub… blub… HLAD.', 'Všechno se jednou rozpustí. I ty.', '*žbluňk* Další sousto do mé lepkavé říše.'],
  spiderQueen: [
    'Mé děti mají hlad. A ty voníš tak… sladce.',
    'Každá nit v této síni vede ke mně. I ta tvoje.',
    'Uvízneš v mé síti stejně jako všichni před tebou.',
  ],
  orcLord: ['GRUKH DRTIT! Malé stvoření, dobrá svačina!', 'Tvoje zbroj bude Grukhova trofej!', 'Umírat hlasitě, ano? Grukh má rád hluk!'],
  lich: ['Smrt je jen začátek. Dovol, abych ti to ukázal.', 'Tvá duše bude zářit v mém fylakteriu.', 'Vstaňte, mí věrní. Máme hosta.'],
  fireDemon: ['Cítím tvůj strach. Voní jako kouř.', 'Popel k popelu. Brzy z tebe zbude jen hromádka.', 'Plameny pekla už na tebe čekají.'],
  colossus: ['…KDO… KRÁČÍ… PO MÉM KAMENI?', 'Hory se nehýbou. Ale já ano.', 'Rozdrtím tě jako oblázek.'],
  vampLord: ['Ach, čerstvá krev. Tak dlouho jsem čekal…', 'Tvé srdce bije tak rychle. Zpomalím ho.', 'Noc je dlouhá a já mám žízeň.'],
  shadowKnight: ['Přísahal jsem bránit tuto bránu. I po smrti.', 'Stín nemá slitování.', 'Tasíš zbraň proti stínu? Odvážné. A marné.'],
  dragon: [
    'Tisíc let jsem spal na svém pokladu. Nebudíš mě beztrestně.',
    'Malý tvore, tvé zlato zazvoní v mé sluji.',
    'Cítíš ten žár? To je teprve můj dech.',
  ],
};

/** the colour of a guardian's name in the dialogue box, by the element it fights with */
export const GUARDIAN_COLORS: Record<string, string> = {
  fire: '#ff9a5a',
  poison: '#9dff7a',
  shadow: '#c9a0ff',
  ice: '#9fe6ff',
  lightning: '#fff27a',
  phys: '#f0d8a8',
};
