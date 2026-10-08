// Talent trees: every class has its own passive tree of three branches (warrior: defender / two-handed /
// two blades, mage: fire / frost / lightning, assassin: poison / crits / shadows ...). A talent point
// comes every second level. Deeper talents of a branch need points spent in it first; the last one of
// each branch grants a power of its own.
import type { ClassId, Stats } from './types';

/** equipment a talent needs to work */
export type TalentCond = 'shield' | 'twoHand' | 'dual' | 'melee' | 'ranged' | 'magic';

export interface TalentDef {
  id: string;
  name: string;
  max: number;
  /** stats per rank */
  stats?: Stats;
  /** a special effect from the first rank on */
  special?: string;
  when?: TalentCond;
  /** text for a special (stats describe themselves) */
  desc?: string;
}

export interface TalentBranch {
  id: string;
  name: string;
  color: string;
  talents: TalentDef[];
}

/** points that must be spent in a branch before the n-th talent of it opens */
export const TALENT_GATE = [0, 3, 6, 9, 12];

export const COND_NAME: Record<TalentCond, string> = {
  shield: 'se štítem',
  twoHand: 's obouruční zbraní',
  dual: 'se dvěma zbraněmi',
  melee: 'se zbraní na blízko',
  ranged: 'se zbraní na dálku',
  magic: 's magickou zbraní',
};

const t = (id: string, name: string, max: number, stats?: Stats, when?: TalentCond): TalentDef => ({ id, name, max, stats, when });
const sp = (id: string, name: string, special: string, desc?: string): TalentDef => ({ id, name, max: 1, special, desc });

export const TALENT_TREES: Record<ClassId, TalentBranch[]> = {
  warrior: [
    { id: 'tank', name: 'Obránce', color: '#8fb8ff', talents: [t('w_skin', 'Železná kůže', 5, { armorPct: 5 }), t('w_might', 'Mohutnost', 5, { hpPct: 3 }), t('w_shield', 'Štítonoš', 3, { block: 4 }, 'shield'), t('w_regen', 'Neústupnost', 3, { hpRegen: 1.5 }), sp('w_fort', 'Pevnost', 'stoneSkin')] },
    { id: 'two', name: 'Obouruční mistr', color: '#ff8a5a', talents: [t('w_heavy', 'Těžká ruka', 5, { dmgPct: 4 }, 'twoHand'), t('w_crush', 'Drtivý úder', 5, { critDmg: 6 }), t('w_swing', 'Rozmach', 3, { atkSpdPct: 5 }, 'twoHand'), t('w_break', 'Zlomení', 3, { crit: 3 }), sp('w_whirl', 'Vír oceli', 'whirl')] },
    { id: 'dual', name: 'Dvě čepele', color: '#ffd76a', talents: [t('w_quick', 'Rychlé čepele', 5, { atkSpdPct: 4 }, 'dual'), t('w_prec', 'Přesnost', 5, { crit: 2 }), t('w_blood', 'Krvavé čepele', 3, { lifesteal: 1 }, 'dual'), t('w_dance', 'Tanec ocele', 3, { dodge: 3 }), sp('w_double', 'Dvojitý sek', 'doubleStrike')] },
  ],
  mage: [
    { id: 'fire', name: 'Oheň', color: '#ff7a2a', talents: [t('m_heat', 'Žár', 5, { fireDmg: 6 }), t('m_ignite', 'Vznícení', 5, { crit: 3 }), t('m_pyro', 'Pyroman', 3, { critDmg: 10 }), t('m_mind', 'Rozpálená mysl', 3, { cdr: 3 }), sp('m_meteor', 'Ohnivý déšť', 'meteorCrit')] },
    { id: 'frost', name: 'Mráz', color: '#9fe6ff', talents: [t('m_cold', 'Chlad', 5, { iceDmg: 6 }), t('m_iceshield', 'Ledový krunýř', 5, { hpPct: 3 }), t('m_heart', 'Zmrzlé srdce', 3, { mpRegen: 1 }), t('m_crystal', 'Krystalizace', 3, { critDmg: 6 }), sp('m_winter', 'Věčná zima', 'frostAura')] },
    { id: 'storm', name: 'Blesk', color: '#fff27a', talents: [t('m_spark', 'Jiskra', 5, { lightDmg: 6 }), t('m_quick', 'Rychlé myšlení', 5, { cdr: 2 }), t('m_over', 'Přetížení', 3, { spellDmg: 4 }), sp('m_static', 'Statický výboj', 'chainOnHit'), sp('m_storm', 'Bouřlivák', 'stormAura')] },
  ],
  assassin: [
    { id: 'poison', name: 'Jed', color: '#7bd88f', talents: [t('a_venom', 'Jedovatost', 5, { poisonDmg: 6 }), t('a_hands', 'Hbité ruce', 5, { atkSpdPct: 2 }), sp('a_blades', 'Otrávené čepele', 'poisonOnHit', 'Útoky otravují nepřátele'), t('a_rot', 'Rozklad', 3, { dmgPct: 5 }), sp('a_plague', 'Mor', 'plagueBurst', 'Zabití nepřátelé po sobě nechají jedovatý mrak')] },
    { id: 'crit', name: 'Kritické zásahy', color: '#ff5a5a', talents: [t('a_eye', 'Bystré oko', 5, { crit: 2 }), t('a_lethal', 'Smrtící zásah', 5, { critDmg: 8 }), t('a_bloody', 'Krvavý zásah', 3, { lifesteal: 1 }), t('a_cold', 'Chladnokrevnost', 3, { crit: 3 }), sp('a_exec', 'Poprava', 'executioner')] },
    { id: 'stealth', name: 'Stín', color: '#b07dff', talents: [t('a_shadow', 'Stínochod', 5, { dodge: 3 }), t('a_agile', 'Hbitost', 5, { move: 3 }), t('a_ambush', 'Úder ze stínu', 3, { critDmg: 10 }), t('a_mist', 'Mlha', 3, { cdr: 4 }), sp('a_echo', 'Ozvěna stínu', 'echoStrike')] },
  ],
  ranger: [
    { id: 'sharp', name: 'Ostrostřelec', color: '#ffd76a', talents: [t('r_aim', 'Přesná muška', 5, { dmgPct: 4 }, 'ranged'), t('r_far', 'Daleký dostřel', 5, { range: 5 }), sp('r_multi', 'Dvojitý šíp', 'extraProjectile'), t('r_master', 'Mistr luku', 3, { crit: 3 }), sp('r_ric', 'Odražené šípy', 'ricochet')] },
    { id: 'beast', name: 'Šelmy', color: '#c8955a', talents: [t('r_wild', 'Divoká síla', 5, { hpPct: 3 }), t('r_hunt', 'Lovecký instinkt', 5, { move: 3 }), t('r_trail', 'Krvavá stopa', 3, { lifesteal: 1 }), t('r_pack', 'Smečka', 3, { dmgPct: 5 }), sp('r_wolves', 'Duchové vlci', 'spiritWolves')] },
    { id: 'survival', name: 'Přežití', color: '#7bd88f', talents: [t('r_dodge', 'Uhýbání', 5, { dodge: 2 }), t('r_med', 'Polní medicína', 5, { hpRegen: 1 }), t('r_traps', 'Lstivost', 3, { cdr: 4 }), t('r_tough', 'Otužilost', 3, { armorPct: 6 }), sp('r_wind', 'Druhý dech', 'secondWind')] },
  ],
  paladin: [
    { id: 'holy', name: 'Světlo', color: '#fff2a8', talents: [t('p_light', 'Svaté světlo', 5, { holyDmg: 6 }), t('p_bless', 'Požehnání', 5, { hpRegen: 1 }), t('p_grace', 'Milost', 3, { spellDmg: 3 }), t('p_faith', 'Zbožnost', 3, { cdr: 3 }), sp('p_stars', 'Hvězdný déšť', 'starfall')] },
    { id: 'prot', name: 'Ochrana', color: '#8fb8ff', talents: [t('p_shield', 'Svatý štít', 5, { armorPct: 5 }), t('p_endure', 'Vytrvalost', 5, { hpPct: 3 }), t('p_guard', 'Ochránce', 3, { block: 4 }, 'shield'), sp('p_mirror', 'Zrcadlo víry', 'reflect'), sp('p_unbroken', 'Nezlomnost', 'cheatDeath')] },
    { id: 'ret', name: 'Odplata', color: '#ff8a5a', talents: [t('p_just', 'Spravedlnost', 5, { dmgPct: 4 }), t('p_zeal', 'Horlivost', 5, { atkSpdPct: 3 }), t('p_judge', 'Soud', 3, { crit: 3 }), t('p_punish', 'Trest', 3, { critDmg: 8 }), sp('p_giant', 'Kladivo na obry', 'giantSlayer')] },
  ],
  necro: [
    { id: 'undead', name: 'Nemrtví', color: '#7bd88f', talents: [t('n_bond', 'Temné pouto', 5, { spellDmg: 5 }), t('n_bone', 'Kostěná zbroj', 5, { armorPct: 4 }), t('n_grave', 'Hrobový chlad', 3, { cdr: 3 }), t('n_cold', 'Dech hrobky', 3, { shadowDmg: 5 }), sp('n_rise', 'Pán smrti', 'soulRise')] },
    { id: 'curse', name: 'Kletby', color: '#b07dff', talents: [t('n_shadow', 'Stín', 5, { shadowDmg: 6 }), t('n_weak', 'Oslabení', 5, { crit: 2 }), sp('n_mark', 'Znamení smrti', 'markOfDeath'), t('n_rot', 'Rozklad', 3, { spellDmg: 5 }), sp('n_plague', 'Mor', 'plagueBurst', 'Zabití nepřátelé po sobě nechají jedovatý mrak')] },
    { id: 'blood', name: 'Krev', color: '#ff3a4a', talents: [t('n_tithe', 'Krvavá daň', 5, { lifesteal: 1 }), t('n_thirst', 'Žízeň', 5, { hpPct: 3 }), sp('n_shield', 'Krvavý štít', 'bloodShield'), t('n_mana', 'Krvavá mana', 3, { mpRegen: 1 }), sp('n_lust', 'Krvavá smlouva', 'bloodlust')] },
  ],
  berserker: [
    { id: 'fury', name: 'Zuřivost', color: '#ff5a3a', talents: [t('b_rage', 'Vztek', 5, { dmgPct: 4 }), t('b_frenzy', 'Šílenství', 5, { atkSpdPct: 3 }), sp('b_berserk', 'Bojové šílenství', 'berserk'), t('b_brutal', 'Brutalita', 3, { critDmg: 6 }), sp('b_roar', 'Řev', 'berserkRoar')] },
    { id: 'slaughter', name: 'Řež', color: '#c81a2a', talents: [t('b_sharp', 'Ostří', 5, { crit: 2 }), t('b_feast', 'Hostina', 5, { lifesteal: 1 }), sp('b_heal', 'Krvavé hody', 'healOnKill'), t('b_cleave', 'Rozsekání', 3, { dmgPct: 4 }, 'twoHand'), sp('b_whirl', 'Mlýnek', 'whirl')] },
    { id: 'endure', name: 'Výdrž', color: '#8fb8ff', talents: [t('b_hide', 'Tuhá kůže', 5, { hpPct: 4 }), t('b_heal2', 'Hojení', 5, { hpRegen: 1.5 }), t('b_scars', 'Jizvy', 3, { armorPct: 5 }), t('b_dodge', 'Úskok', 3, { dodge: 2 }), sp('b_wind', 'Nezdolnost', 'secondWind')] },
  ],
  druid: [
    { id: 'nature', name: 'Příroda', color: '#7bd88f', talents: [t('d_regen', 'Míza', 5, { hpRegen: 1 }), t('d_bark', 'Kůra', 5, { hpPct: 3 }), t('d_grow', 'Růst', 3, { spellDmg: 3 }), t('d_season', 'Roční doby', 3, { cdr: 3 }), sp('d_wind', 'Znovuzrození', 'secondWind')] },
    { id: 'beasts', name: 'Zvířata', color: '#c8955a', talents: [t('d_claw', 'Drápy', 5, { spellDmg: 5 }), t('d_run', 'Běh smečky', 5, { move: 3 }), t('d_maul', 'Rvačka', 3, { dmgPct: 5 }), t('d_hide', 'Kožich', 3, { armorPct: 5 }), sp('d_wolves', 'Pán šelem', 'spiritWolves')] },
    { id: 'storm', name: 'Živly', color: '#fff27a', talents: [t('d_light', 'Hrom', 5, { lightDmg: 6 }), t('d_ice', 'Kroupy', 5, { iceDmg: 6 }), t('d_eye', 'Oko bouře', 3, { crit: 3 }), t('d_gale', 'Vichr', 3, { cdr: 4 }), sp('d_storm', 'Bouře', 'stormAura')] },
  ],
  monk: [
    { id: 'fist', name: 'Pěst', color: '#ffb070', talents: [t('o_speed', 'Rychlé pěsti', 5, { atkSpdPct: 3 }), t('o_force', 'Síla úderu', 5, { dmgPct: 3 }), sp('o_double', 'Dvojitý úder', 'doubleStrike'), t('o_vital', 'Životní body', 3, { crit: 2 }), sp('o_echo', 'Ozvěna úderu', 'echoStrike')] },
    { id: 'balance', name: 'Rovnováha', color: '#9fe6ff', talents: [t('o_dodge', 'Plynutí', 5, { dodge: 2 }), t('o_step', 'Lehký krok', 5, { move: 3 }), sp('o_clap', 'Hromové dlaně', 'thunderClap'), t('o_stone', 'Kámen', 3, { armorPct: 4 }), sp('o_calm', 'Tichá mysl', 'timeWarp')] },
    { id: 'spirit', name: 'Duch', color: '#fff2a8', talents: [t('o_breath', 'Dech', 5, { hpRegen: 1 }), t('o_light', 'Vnitřní světlo', 5, { holyDmg: 4 }), t('o_drain', 'Čchi', 3, { lifesteal: 1 }), t('o_body', 'Tělo z oceli', 3, { hpPct: 3 }), sp('o_undying', 'Nesmrtelnost', 'cheatDeath')] },
  ],
  shaman: [
    { id: 'totem', name: 'Totemy', color: '#c8955a', talents: [t('s_carve', 'Řezbář', 5, { spellDmg: 4 }), t('s_rhythm', 'Rytmus bubnů', 5, { cdr: 2 }), t('s_earth', 'Země', 3, { hpPct: 3 }), t('s_rain', 'Déšť', 3, { hpRegen: 1 }), sp('s_aura', 'Bouřný totem', 'stormAura')] },
    { id: 'thunder', name: 'Blesk', color: '#fff27a', talents: [t('s_bolt', 'Blesk', 5, { lightDmg: 6 }), t('s_charge', 'Náboj', 5, { crit: 3 }), sp('s_chain', 'Řetěz', 'chainOnHit'), t('s_surge', 'Výboj', 3, { critDmg: 8 }), sp('s_clap', 'Hrom', 'thunderClap')] },
    { id: 'spirits', name: 'Duchové', color: '#b07dff', talents: [t('s_ancest', 'Předkové', 5, { lifesteal: 1 }), t('s_guard', 'Strážní duch', 5, { hpPct: 3 }), sp('s_wolves', 'Duchové vlci', 'spiritWolves'), t('s_walk', 'Duchovní krok', 3, { move: 3 }), sp('s_rise', 'Volání mrtvých', 'soulRise')] },
  ],
};

export const TALENT_BY_ID: Record<string, TalentDef> = {};
export const TALENT_BRANCH: Record<string, TalentBranch> = {};
export const TALENT_CLASS: Record<string, ClassId> = {};
for (const [cls, branches] of Object.entries(TALENT_TREES) as [ClassId, TalentBranch[]][])
  for (const b of branches)
    for (const tl of b.talents) {
      TALENT_BY_ID[tl.id] = tl;
      TALENT_BRANCH[tl.id] = b;
      TALENT_CLASS[tl.id] = cls;
    }

/** talent points earned by a level: one every second level */
export function talentPoints(level: number) {
  return Math.max(0, Math.floor((level - 1) / 2));
}

export function spentIn(ranks: Record<string, number>, branch: TalentBranch) {
  return branch.talents.reduce((a, tl) => a + (ranks[tl.id] ?? 0), 0);
}

/** can one more point go into this talent? */
export function canLearn(ranks: Record<string, number>, branch: TalentBranch, idx: number, free: number) {
  const tl = branch.talents[idx];
  return free > 0 && (ranks[tl.id] ?? 0) < tl.max && spentIn(ranks, branch) >= TALENT_GATE[idx];
}
