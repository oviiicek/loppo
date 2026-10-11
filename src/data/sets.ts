// Item sets: named groups of four pieces. Wearing two, three or all four pieces of a set adds its bonuses;
// the full set adds special effects of legendary items. Every area of the dungeon keeps three sets of its own
// (75 in all): set pieces drop instead of some legendary items from floor 10 on, always from the area the hero
// is in and most likely a piece the hero does not have yet, and every guardian leaves one – so a set can really
// be completed within its area (and the older areas can be visited again for theirs).
import type { Item, Slot, Stats } from './types';

export interface SetDef {
  id: string;
  name: string;
  /** the area of the dungeon whose floors drop it (see data/biomes.ts) */
  area: number;
  /** the pieces: base item type and its fixed name */
  pieces: { base: string; name: string }[];
  /** bonuses by the number of pieces worn */
  bonuses: { n: number; stats?: Stats; specials?: string[] }[];
}

export const SET_COLOR = '#2fe0b0';
export const SET_MIN_FLOOR = 10;

export const SETS: SetDef[] = [
  {
    id: 'gate',
    area: 0,
    name: 'Výzbroj strážce bran',
    pieces: [
      { base: 'helmet', name: 'Helma strážce bran' },
      { base: 'chest', name: 'Krunýř strážce bran' },
      { base: 'pants', name: 'Kalhoty strážce bran' },
      { base: 'boots', name: 'Boty strážce bran' },
    ],
    bonuses: [
      { n: 2, stats: { hpPct: 12 } },
      { n: 3, stats: { block: 8, hpRegen: 6 } },
      { n: 4, stats: { hpPct: 10 }, specials: ['thornNova'] },
    ],
  },
  {
    id: 'five',
    area: 16,
    name: 'Plamen Pětice',
    pieces: [
      { base: 'helmet', name: 'Koruna Pětice' },
      { base: 'amulet', name: 'Náhrdelník Pětice' },
      { base: 'ring', name: 'Prsten Pětice' },
      { base: 'bracer', name: 'Náramek Pětice' },
    ],
    bonuses: [
      { n: 2, stats: { dmgPct: 12 } },
      { n: 3, stats: { spellDmg: 15 } },
      { n: 4, specials: ['burnOnHit', 'explodeOnKill'] },
    ],
  },
  {
    id: 'frost',
    area: 4,
    name: 'Dar Ledové královny',
    pieces: [
      { base: 'chest', name: 'Šat Ledové královny' },
      { base: 'belt', name: 'Opasek Ledové královny' },
      { base: 'boots', name: 'Střevíce Ledové královny' },
      { base: 'ring', name: 'Prsten Ledové královny' },
    ],
    bonuses: [
      { n: 2, stats: { move: 8 } },
      { n: 3, stats: { crit: 5 } },
      { n: 4, stats: { critDmg: 40 }, specials: ['frostOnHit'] },
    ],
  },
  {
    id: 'shadow',
    area: 7,
    name: 'Šepot stínů',
    pieces: [
      { base: 'helmet', name: 'Kápě šepotu' },
      { base: 'pants', name: 'Kalhoty šepotu' },
      { base: 'bracer', name: 'Náramek šepotu' },
      { base: 'ring', name: 'Prsten šepotu' },
    ],
    bonuses: [
      { n: 2, stats: { dodge: 5 } },
      { n: 3, stats: { atkSpdPct: 10 } },
      { n: 4, stats: { lifesteal: 2 }, specials: ['doubleStrike'] },
    ],
  },
  {
    id: 'storm',
    area: 10,
    name: 'Hněv bouře',
    pieces: [
      { base: 'chest', name: 'Plášť bouře' },
      { base: 'amulet', name: 'Amulet bouře' },
      { base: 'boots', name: 'Boty bouře' },
      { base: 'bracer', name: 'Náramek bouře' },
    ],
    bonuses: [
      { n: 2, stats: { mpRegen: 4 } },
      { n: 3, stats: { cdr: 8 } },
      { n: 4, specials: ['chainOnHit', 'spellEcho'] },
    ],
  },
  {
    id: 'thorns',
    area: 9,
    name: 'Hradba trnů',
    pieces: [
      { base: 'helmet', name: 'Trnitá přilba' },
      { base: 'chest', name: 'Trnitý krunýř' },
      { base: 'shield', name: 'Trnitý štít' },
      { base: 'bracer', name: 'Trnitý náramek' },
    ],
    bonuses: [
      { n: 2, stats: { thornsPct: 15, armorPct: 15 } },
      { n: 3, stats: { thorns: 60 }, specials: ['thornAura'] },
      { n: 4, stats: { thornsPct: 20 }, specials: ['thornArmor', 'thornNova'] },
    ],
  },
  {
    id: 'goblin',
    area: 1,
    name: 'Poklad skřetího krále',
    pieces: [
      { base: 'belt', name: 'Opasek skřetího krále' },
      { base: 'ring', name: 'Prsten skřetího krále' },
      { base: 'amulet', name: 'Náhrdelník skřetího krále' },
      { base: 'boots', name: 'Boty skřetího krále' },
    ],
    bonuses: [
      { n: 2, stats: { gold: 30 } },
      { n: 3, stats: { magicFind: 25 } },
      { n: 4, stats: { xp: 10 }, specials: ['goldRush'] },
    ],
  },
];

// ------------------------------------------------------------------ the sets of every area
/** what a set does, by its kind; t is the chapter of its area (0–4), so deeper sets give a little more */
type Arch = 'guard' | 'blade' | 'arcane' | 'hunter' | 'shadow' | 'flame' | 'frost' | 'storm' | 'venom' | 'fortune' | 'life' | 'holy' | 'dread' | 'fury';
const ARCH: Record<Arch, (t: number) => SetDef['bonuses']> = {
  guard: (t) => [
    { n: 2, stats: { hpPct: 10 + 2 * t } },
    { n: 3, stats: { armorPct: 15 + 3 * t, block: 5 } },
    { n: 4, stats: { hpRegen: 4 + 2 * t }, specials: ['thornNova', 'lastStand'] },
  ],
  blade: (t) => [
    { n: 2, stats: { dmgPct: 10 + 2 * t } },
    { n: 3, stats: { atkSpdPct: 8 + t } },
    { n: 4, stats: { critDmg: 35 + 5 * t }, specials: ['doubleStrike', 'sunder'] },
  ],
  arcane: (t) => [
    { n: 2, stats: { spellDmg: 12 + 2 * t } },
    { n: 3, stats: { cdr: 6 + t, mpRegen: 3 + t } },
    { n: 4, specials: ['spellEcho', 'arcaneOrbit'] },
  ],
  hunter: (t) => [
    { n: 2, stats: { crit: 4 + t } },
    { n: 3, stats: { atkSpdPct: 8 + t } },
    { n: 4, stats: { critDmg: 40 + 5 * t }, specials: ['pierceShots', 'firstStrike'] },
  ],
  shadow: (t) => [
    { n: 2, stats: { dodge: 4 + t } },
    { n: 3, stats: { move: 8, crit: 3 + t } },
    { n: 4, stats: { lifesteal: 2 }, specials: ['ghostStep', 'doubleStrike'] },
  ],
  flame: (t) => [
    { n: 2, stats: { dmgPct: 8 + 2 * t, fireDmg: 15 + 3 * t } },
    { n: 3, stats: { spellDmg: 10 + 2 * t } },
    { n: 4, specials: ['burnOnHit', 'explodeOnKill'] },
  ],
  frost: (t) => [
    { n: 2, stats: { hpPct: 8 + 2 * t, iceDmg: 15 + 3 * t } },
    { n: 3, stats: { crit: 4 + t } },
    { n: 4, stats: { critDmg: 30 + 5 * t }, specials: ['frostOnHit', 'iceSkin'] },
  ],
  storm: (t) => [
    { n: 2, stats: { spellDmg: 10 + 2 * t, lightDmg: 15 + 3 * t } },
    { n: 3, stats: { cdr: 6 + t } },
    { n: 4, specials: ['chainOnHit', 'cdrOnKill'] },
  ],
  venom: (t) => [
    { n: 2, stats: { dmgPct: 8 + 2 * t, poisonDmg: 15 + 3 * t } },
    { n: 3, stats: { atkSpdPct: 8 + t } },
    { n: 4, stats: { crit: 4 }, specials: ['bleedOnHit', 'critSplash'] },
  ],
  fortune: (t) => [
    { n: 2, stats: { gold: 25 + 5 * t } },
    { n: 3, stats: { magicFind: 20 + 5 * t } },
    { n: 4, stats: { xp: 8 + 2 * t }, specials: ['goldRush', 'goldOnHit'] },
  ],
  life: (t) => [
    { n: 2, stats: { hpRegen: 4 + 2 * t } },
    { n: 3, stats: { hpPct: 8 + 2 * t, lifesteal: 1 } },
    { n: 4, specials: ['healOnKill', 'secondWind'] },
  ],
  holy: (t) => [
    { n: 2, stats: { hpPct: 8 + 2 * t, holyDmg: 15 + 3 * t } },
    { n: 3, stats: { armorPct: 12 + 3 * t } },
    { n: 4, specials: ['holySmite', 'potionPower'] },
  ],
  dread: (t) => [
    { n: 2, stats: { dmgPct: 8 + 2 * t, shadowDmg: 15 + 3 * t } },
    { n: 3, stats: { lifesteal: 1.5 } },
    { n: 4, specials: ['vampAura', 'lifeTap'] },
  ],
  fury: (t) => [
    { n: 2, stats: { dmgPct: 12 + 2 * t } },
    { n: 3, stats: { hpPct: 8 + t, atkSpdPct: 6 } },
    { n: 4, specials: ['berserk', 'frenzy'] },
  ],
};

/** the four kinds of things a set of each kind is made of */
const PIECES: Record<Arch, string[]> = {
  guard: ['helmet', 'chest', 'pants', 'boots'],
  blade: ['helmet', 'chest', 'bracer', 'belt'],
  arcane: ['helmet', 'amulet', 'ring', 'bracer'],
  hunter: ['chest', 'boots', 'bracer', 'ring'],
  shadow: ['helmet', 'pants', 'bracer', 'ring'],
  flame: ['chest', 'amulet', 'ring', 'boots'],
  frost: ['helmet', 'chest', 'belt', 'ring'],
  storm: ['amulet', 'ring', 'boots', 'bracer'],
  venom: ['pants', 'bracer', 'ring', 'belt'],
  fortune: ['belt', 'ring', 'amulet', 'boots'],
  life: ['chest', 'belt', 'amulet', 'pants'],
  holy: ['helmet', 'chest', 'amulet', 'belt'],
  dread: ['helmet', 'amulet', 'ring', 'pants'],
  fury: ['helmet', 'chest', 'bracer', 'boots'],
};
const NOUN: Record<string, string> = { helmet: 'Helma', chest: 'Brnění', pants: 'Kalhoty', boots: 'Boty', belt: 'Opasek', bracer: 'Náramek', ring: 'Prsten', amulet: 'Náhrdelník' };

/** a set of an area: its name, whose it was (the pieces are named after them) and what kind of set it is */
const mk = (id: string, area: number, name: string, of: string, arch: Arch): SetDef => ({
  id,
  name,
  area,
  pieces: PIECES[arch].map((base) => ({ base, name: `${NOUN[base]} ${of}` })),
  bonuses: ARCH[arch](Math.min(4, Math.floor(area / 5))),
});

SETS.push(
  // Chapter I
  mk('crypt_abbot', 0, 'Odkaz opata Benedikta', 'opata Benedikta', 'holy'),
  mk('crypt_digger', 0, 'Výstroj kryptového hrobníka', 'kryptového hrobníka', 'blade'),
  mk('cave_hunter', 1, 'Výstroj jeskynního lovce', 'jeskynního lovce', 'hunter'),
  mk('cave_bat', 1, 'Výbava netopýřího stopaře', 'netopýřího stopaře', 'shadow'),
  mk('cata_bone', 2, 'Kostěná zbroj katakomb', 'kostěného rytíře', 'guard'),
  mk('cata_ghoul', 2, 'Dar ghúlího krále', 'ghúlího krále', 'fury'),
  mk('cata_lamp', 2, 'Výbava strážce lamp', 'strážce lamp', 'holy'),
  mk('ruin_miner', 3, 'Výstroj utopeného horníka', 'utopeného horníka', 'guard'),
  mk('ruin_eel', 3, 'Dar bahenního hada', 'bahenního hada', 'venom'),
  mk('ruin_mage', 3, 'Odkaz potopeného mága', 'potopeného mága', 'arcane'),
  mk('ice_guard', 4, 'Zbroj zimní stráže', 'zimní stráže', 'guard'),
  mk('ice_hunter', 4, 'Výstroj mrazivého lovce', 'mrazivého lovce', 'hunter'),
  // Chapter II
  mk('hell_knight', 5, 'Výzbroj pekelného rytíře', 'pekelného rytíře', 'flame'),
  mk('hell_cult', 5, 'Roucho kultu plamene', 'kultisty plamene', 'dread'),
  mk('hell_horn', 5, 'Dar rohatého démona', 'rohatého démona', 'fury'),
  mk('shroom_druid', 6, 'Výbava sporového druida', 'sporového druida', 'life'),
  mk('shroom_venom', 6, 'Plášť jedového sběrače', 'jedového sběrače', 'venom'),
  mk('shroom_moss', 6, 'Výstroj mechového tuláka', 'mechového tuláka', 'shadow'),
  mk('spider_queen', 7, 'Dar Pavoučí královny', 'Pavoučí královny', 'venom'),
  mk('spider_count', 7, 'Výzbroj krvavého hraběte', 'krvavého hraběte', 'dread'),
  mk('desert_king', 8, 'Poklad pouštního krále', 'pouštního krále', 'fortune'),
  mk('desert_sun', 8, 'Výzbroj sluneční gardy', 'sluneční gardy', 'holy'),
  mk('desert_scarab', 8, 'Zbroj skarabea', 'skarabea', 'guard'),
  mk('roots_mother', 9, 'Dar Matky spor', 'Matky spor', 'life'),
  mk('roots_tracker', 9, 'Výstroj lesního stopaře', 'lesního stopaře', 'hunter'),
  // Chapter III
  mk('crystal_mind', 10, 'Krystalová mysl', 'krystalového mága', 'arcane'),
  mk('crystal_golem', 10, 'Krystalová zbroj', 'krystalového golema', 'guard'),
  mk('dwarf_smith', 11, 'Zbroj trpasličího kováře', 'trpasličího kováře', 'guard'),
  mk('dwarf_berserk', 11, 'Výzbroj trpasličího berserkra', 'trpasličího berserkra', 'fury'),
  mk('dwarf_lord', 11, 'Poklad trpasličích pánů', 'trpasličího pána', 'fortune'),
  mk('ossuary_cantor', 12, 'Kostěný chorál', 'kostěného kantora', 'dread'),
  mk('ossuary_jailer', 12, 'Výzbroj žalářníka Grota', 'žalářníka Grota', 'blade'),
  mk('ossuary_saint', 12, 'Ostatky světce', 'světce z kostnice', 'holy'),
  mk('cathedral_priest', 13, 'Dar kněžky Svatavy', 'kněžky Svatavy', 'arcane'),
  mk('cathedral_bell', 13, 'Zbroj utopeného zvoníka', 'utopeného zvoníka', 'guard'),
  mk('cathedral_bishop', 13, 'Plášť upířího biskupa', 'upířího biskupa', 'dread'),
  mk('gate_morgrim', 14, 'Výzbroj Morgrima', 'Morgrima', 'guard'),
  mk('gate_chain', 14, 'Řetězy podsvětí', 'řetězového kata', 'blade'),
  mk('gate_ferry', 14, 'Výbava převozníka duší', 'převozníka duší', 'arcane'),
  // Chapter IV
  mk('ash_walker', 15, 'Výstroj popelavého poutníka', 'popelavého poutníka', 'shadow'),
  mk('ash_prophet', 15, 'Dar ohnivého proroka', 'ohnivého proroka', 'flame'),
  mk('ash_giant', 15, 'Zbroj popelavého obra', 'popelavého obra', 'guard'),
  mk('forge_boriv', 16, 'Výzbroj kováře Bořiva', 'kováře Bořiva', 'blade'),
  mk('forge_anvil', 16, 'Kovadlinová zbroj', 'kovadlinového strážce', 'guard'),
  mk('swamp_hag', 17, 'Dar bažinné čarodějnice', 'bažinné čarodějnice', 'venom'),
  mk('swamp_troll', 17, 'Výzbroj bahenního trola', 'bahenního trola', 'life'),
  mk('swamp_hunter', 17, 'Výstroj mlžného lovce', 'mlžného lovce', 'hunter'),
  mk('obsidian_knight', 18, 'Obsidiánová zbroj', 'obsidiánového rytíře', 'guard'),
  mk('obsidian_heart', 18, 'Dar lávového srdce', 'lávového démona', 'flame'),
  mk('obsidian_shade', 18, 'Výbava zrcadlového stínu', 'zrcadlového stínu', 'shadow'),
  mk('citadel_voice', 19, 'Dar Hlasu hlubin', 'Hlasu hlubin', 'arcane'),
  mk('citadel_noble', 19, 'Výzbroj stínového šlechtice', 'stínového šlechtice', 'dread'),
  mk('citadel_knight', 19, 'Zbroj stínového rytíře', 'stínového rytíře', 'blade'),
  // Chapter V
  mk('void_walker', 20, 'Výstroj poutníka prázdnoty', 'poutníka prázdnoty', 'shadow'),
  mk('void_priest', 20, 'Roucho kněze prázdnoty', 'kněze prázdnoty', 'arcane'),
  mk('void_bridge', 20, 'Zbroj strážce mostů', 'strážce mostů', 'guard'),
  mk('isle_storm', 21, 'Dar nebeské bouře', 'nebeského bouřníka', 'storm'),
  mk('isle_gale', 21, 'Výstroj vichrného lovce', 'vichrného lovce', 'hunter'),
  mk('isle_frost', 21, 'Plášť větrného tuláka', 'větrného tuláka', 'frost'),
  mk('mirror_king', 22, 'Výzbroj zrcadlového krále', 'zrcadlového krále', 'blade'),
  mk('mirror_vamp', 22, 'Dar upíří kněžny', 'upíří kněžny', 'dread'),
  mk('mirror_illusion', 22, 'Šat iluzionisty', 'iluzionisty', 'shadow'),
  mk('dream_sleeper', 23, 'Dar věčného spáče', 'věčného spáče', 'life'),
  mk('dream_nightmare', 23, 'Výzbroj noční můry', 'noční můry', 'fury'),
  mk('dream_oracle', 23, 'Roucho snové věštkyně', 'snové věštkyně', 'arcane'),
  mk('bottom_guard', 24, "Výzbroj Nyx'tharovy stráže", "Nyx'tharovy stráže", 'guard'),
  mk('bottom_star', 24, 'Dar padlé hvězdy', 'padlé hvězdy', 'holy'),
  mk('bottom_hero', 24, 'Výbava posledního hrdiny', 'posledního hrdiny', 'blade'),
);

export const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s])) as Record<string, SetDef>;

/** the three sets of an area (past the last area the areas come round again) */
export function areaSets(area: number): SetDef[] {
  return SETS.filter((s) => s.area === area);
}

/** the set pieces a hero holds (worn, in the bag or in the stash): "setId:piece" */
export function heldSetPieces(s: { equip: Partial<Record<Slot, Item | null>>; inventory: (Item | null)[]; stash?: (Item | null)[] }): Set<string> {
  const out = new Set<string>();
  for (const it of [...Object.values(s.equip), ...s.inventory, ...(s.stash ?? [])]) if (it?.set) out.add(it.set);
  return out;
}

/** which piece of which of the area's sets drops: most likely one the hero does not hold yet, of the set the
 *  hero holds most of (so one set really gets completed) */
export function pickSetPiece(area: number, held: Set<string>, rnd = Math.random): { id: string; piece: number } | null {
  const cands: { id: string; piece: number; w: number }[] = [];
  for (const st of areaSets(area)) {
    const have = st.pieces.filter((_, i) => held.has(`${st.id}:${i}`)).length;
    st.pieces.forEach((_, i) => {
      const own = held.has(`${st.id}:${i}`);
      cands.push({ id: st.id, piece: i, w: own ? 1 : 3 + have * 3 });
    });
  }
  const total = cands.reduce((a, c) => a + c.w, 0);
  let r = rnd() * total;
  for (const c of cands) {
    r -= c.w;
    if (r <= 0) return c;
  }
  return cands[0] ?? null;
}

/** how many different pieces of each set are worn */
export function equippedSetCounts(equip: Partial<Record<Slot, Item | null>>): Record<string, number> {
  const seen = new Map<string, Set<number>>();
  for (const it of Object.values(equip)) {
    if (!it?.set) continue;
    const [id, piece] = it.set.split(':');
    if (!seen.has(id)) seen.set(id, new Set());
    seen.get(id)!.add(+piece);
  }
  const out: Record<string, number> = {};
  for (const [id, s] of seen) out[id] = s.size;
  return out;
}

/** the bonuses of the sets worn, added to stats and specials */
export function addSetBonuses(equip: Partial<Record<Slot, Item | null>>, add: (k: keyof Stats, v: number) => void, specials: Set<string>) {
  for (const [id, n] of Object.entries(equippedSetCounts(equip))) {
    const def = SET_BY_ID[id];
    if (!def) continue;
    for (const b of def.bonuses) {
      if (n < b.n) continue;
      for (const [k, v] of Object.entries(b.stats ?? {})) add(k as keyof Stats, v as number);
      for (const sp of b.specials ?? []) specials.add(sp);
    }
  }
}

/** the set and piece of a set item ("five:2" → the set, piece 2) */
export function setOf(it: Item | null | undefined): { def: SetDef; piece: number } | null {
  if (!it?.set) return null;
  const [id, piece] = it.set.split(':');
  const def = SET_BY_ID[id];
  return def ? { def, piece: +piece } : null;
}
