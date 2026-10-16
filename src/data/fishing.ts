// Fishing on Loppo's pond (only at home, the dungeon has nothing like it): the hero casts from the pier, waits
// for the float to dip and strikes in time. Fish are sold to the fisherman at once; now and then the line brings
// up an old boot, a little chest from the mud, a bottle with a message or – once in a long while – the golden
// fish. Baits come back with the floors the hero goes down.

export type CatchKind = 'fish' | 'junk' | 'chest' | 'bottle' | 'golden';

export interface FishDef {
  id: string;
  name: string;
  kind: CatchKind;
  /** how often it bites (relative) */
  weight: number;
  /** a fish's price as a share of the pond's base price (see fishPrice) */
  value?: number;
  /** body length and colours of its icon */
  len?: number;
  body: string;
  belly?: string;
  fin?: string;
}

export const FISH: FishDef[] = [
  { id: 'roach', name: 'Plotice', kind: 'fish', weight: 32, value: 0.6, len: 9, body: '#b8c8d0', belly: '#e8eef0', fin: '#d85a4a' },
  { id: 'perch', name: 'Okoun', kind: 'fish', weight: 22, value: 0.9, len: 10, body: '#9ab858', belly: '#e0e8a0', fin: '#e8803a' },
  { id: 'carp', name: 'Kapr', kind: 'fish', weight: 15, value: 1.5, len: 12, body: '#c89a48', belly: '#f0d890', fin: '#a87030' },
  { id: 'pike', name: 'Štika', kind: 'fish', weight: 8, value: 2.6, len: 14, body: '#5a9a70', belly: '#c8e0a8', fin: '#7a8a40' },
  { id: 'catfish', name: 'Sumec', kind: 'fish', weight: 3, value: 5, len: 15, body: '#6a6078', belly: '#b8b0c0', fin: '#4a4058' },
  { id: 'boot', name: 'Stará bota', kind: 'junk', weight: 8, body: '#7a5a3a' },
  { id: 'chest', name: 'Truhlička z bahna', kind: 'chest', weight: 5, body: '#9a6a3a' },
  { id: 'bottle', name: 'Láhev se vzkazem', kind: 'bottle', weight: 2.5, body: '#7ac8a8' },
  { id: 'golden', name: 'Zlatá rybka', kind: 'golden', weight: 0.5, len: 8, body: '#ffc83a', belly: '#fff0a0', fin: '#ff9a2a' },
];

export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f])) as Record<string, FishDef>;

/** what the hero keeps from the pond (in the village state) */
export interface FishState {
  bait: number;
  /** catches by kind */
  caught: Record<string, number>;
  /** bottles read so far (indices into BOTTLE_NOTES) */
  notes?: number[];
}

export const BAIT_MAX = 5;

export function fishOf(v: { fish?: FishState }): FishState {
  return (v.fish ??= { bait: BAIT_MAX, caught: {} });
}

/** a floor gone down brings a bait back (up to the full tin) */
export function addBait(v: { fish?: FishState }) {
  const f = fishOf(v);
  f.bait = Math.min(BAIT_MAX, f.bait + 1);
}

/** what the fisherman pays for a fish (grows with the deepest floor, like everything bought and sold) */
export function fishPrice(f: FishDef, maxFloor: number) {
  return Math.max(1, Math.round((6 + Math.max(1, maxFloor) * 1.6) * (f.value ?? 0)));
}

/** what bites (a better rod would go here one day) */
export function rollCatch(rnd = Math.random): FishDef {
  const total = FISH.reduce((a, f) => a + f.weight, 0);
  let x = rnd() * total;
  for (const f of FISH) {
    x -= f.weight;
    if (x <= 0) return f;
  }
  return FISH[0];
}

/** messages in bottles: bits of Loppo's past and the dungeon's rumours */
export const BOTTLE_NOTES = [
  '„Kdo najde tuhle láhev, ať ví, že jsem chytil sumce velkého jako vůz. Nikdo mi to nevěří. – Ludvík, rybář“',
  '„Pod třetí vrbou na jižním břehu jsem zakopal svoje úspory. Nebo pod čtvrtou? Já už nevím.“',
  '„Strážci pod hradem nespí. Jen čekají, až někdo sejde dost hluboko.“',
  '„Milá Bohdano, v chrámu se mi zjevila světla. Možná to byly jen svíčky. Ale možná ne.“',
  '„Pečeť drží, dokud ji někdo drží. Kdo ji drží dnes?“',
  '„Na dně rybníka svítí něco zlatého. Rybka? Mince? Oko něčeho většího?“',
  '„Zkoušel jsem chytat na sýr. Ryby se smály.“',
  '„Kdo hodí minci do fontány, ten se vrátí. Já jich hodil sto. Pořád jsem tady.“',
];
