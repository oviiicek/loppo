// Bonus spells of weapons: some weapons carry a spell that casts itself when its moment comes - every fifth
// kill, every fifteenth hit, a critical hit, a blow taken, low health, a spell of the hero, every few seconds
// of a fight, a champion's death, a dodge or a block. The better the weapon, the likelier it has one (now and
// then even a plain one does). Twenty spells times ten moments: the same weapon spell rarely turns up twice.
// The spell is kept on the item as "effect@trigger" (see Item.spell); Procs in game/procs.ts casts it.
import type { RNG } from '../systems/rng';

export interface ProcTrigger {
  id: string;
  /** when it casts (shown in the item's description) */
  text: string;
  /** how strong the spell is at this moment (rare moments cast stronger spells) */
  power: number;
  weight: number;
}

export interface ProcEffect {
  id: string;
  name: string;
  /** what it does */
  desc: string;
  color: string;
  weight: number;
}

export const PROC_TRIGGERS: ProcTrigger[] = [
  { id: 'kill5', text: 'každé 5. zabití', power: 1, weight: 10 },
  { id: 'kill12', text: 'každé 12. zabití', power: 2, weight: 5 },
  { id: 'hit15', text: 'každý 15. zásah zbraní', power: 0.8, weight: 9 },
  { id: 'crit', text: 'kritický zásah (šance 25 %, nejvýš jednou za 2 s)', power: 0.7, weight: 7 },
  { id: 'hurt', text: 'když tě něco zasáhne (šance 20 %, nejvýš jednou za 3 s)', power: 0.8, weight: 7 },
  { id: 'lowhp', text: 'když ti klesne zdraví pod 35 % (jednou za 25 s)', power: 2, weight: 4 },
  { id: 'cast', text: 'když sešleš kouzlo (šance 30 %)', power: 0.8, weight: 6 },
  { id: 'timer', text: 'každých 10 s v boji', power: 1, weight: 7 },
  { id: 'elite', text: 'zabití šampiona nebo strážce', power: 2.2, weight: 4 },
  { id: 'dodge', text: 'úhyb nebo blok (nejvýš jednou za 2 s)', power: 0.8, weight: 4 },
];

export const PROC_EFFECTS: ProcEffect[] = [
  { id: 'meteor', name: 'Meteor', desc: 'na nejbližšího nepřítele dopadne meteor', color: '#ff9a5a', weight: 8 },
  { id: 'chain', name: 'Řetězový blesk', desc: 'blesk přeskočí mezi pěti nepřáteli', color: '#fff27a', weight: 8 },
  { id: 'frostnova', name: 'Mrazivá nova', desc: 'kruh mrazu zmrazí nepřátele kolem tebe', color: '#9fe6ff', weight: 7 },
  { id: 'firering', name: 'Ohnivý kruh', desc: 'země kolem tebe vzplane', color: '#ff7a2a', weight: 7 },
  { id: 'poison', name: 'Jedový mrak', desc: 'nad nepřáteli se rozlije jedový mrak', color: '#9dff7a', weight: 6 },
  { id: 'holy', name: 'Svaté světlo', desc: 'vyléčí 12 % zdraví a spálí nepřátele kolem', color: '#fff3b0', weight: 6 },
  { id: 'arrows', name: 'Déšť šípů', desc: 'na nepřátele kolem cíle se snese déšť šípů', color: '#e8d8b0', weight: 6 },
  { id: 'blades', name: 'Vír čepelí', desc: 'tři víry čepelí zasáhnou vše kolem tebe', color: '#e8e0d0', weight: 6 },
  { id: 'skeletons', name: 'Kostlivci', desc: 'vyvolá dva kostlivce na 15 s', color: '#d8d0b8', weight: 5 },
  { id: 'wolves', name: 'Duchovní vlci', desc: 'přivolá dva duchovní vlky na 15 s', color: '#9fd8ff', weight: 5 },
  { id: 'warcry', name: 'Bojový pokřik', desc: '+30 % rychlosti útoku a +20 % poškození na 6 s', color: '#ff8a5a', weight: 6 },
  { id: 'stoneshield', name: 'Kamenný štít', desc: 'štít za 20 % tvého zdraví', color: '#c8c0b0', weight: 5 },
  { id: 'quake', name: 'Otřes země', desc: 'vlna omráčí nepřátele kolem tebe', color: '#d8b080', weight: 6 },
  { id: 'bloodwave', name: 'Krvavá vlna', desc: 'vlna stínu vysaje nepřátele kolem a vyléčí tě', color: '#ff5a7a', weight: 5 },
  { id: 'shards', name: 'Ledové střepy', desc: 'do všech stran vyletí osm ledových střepů', color: '#bfefff', weight: 6 },
  { id: 'fireballs', name: 'Ohnivé koule', desc: 'tři ohnivé koule vyletí po nejbližších nepřátelích', color: '#ffb84a', weight: 6 },
  { id: 'smite', name: 'Úder blesku', desc: 'mocný blesk udeří do nejsilnějšího nepřítele poblíž', color: '#fff7a0', weight: 6 },
  { id: 'spiritblade', name: 'Duchovní meč', desc: 'přivolá létající meč, který 12 s bojuje po tvém boku', color: '#fff2a8', weight: 4 },
  { id: 'haste', name: 'Vítr v zádech', desc: '+35 % rychlosti pohybu a +15 % úhybu na 5 s', color: '#b8f0ff', weight: 4 },
  { id: 'mana', name: 'Pramen many', desc: 'obnoví 20 % many a zkrátí přebíjení kouzel o 1 s', color: '#7ab8ff', weight: 4 },
];

export const PROC_TRIGGER_BY_ID = Object.fromEntries(PROC_TRIGGERS.map((t) => [t.id, t])) as Record<string, ProcTrigger>;
export const PROC_EFFECT_BY_ID = Object.fromEntries(PROC_EFFECTS.map((e) => [e.id, e])) as Record<string, ProcEffect>;

/** the chance that a weapon of each rarity carries a bonus spell (common … primal) */
export const WEAPON_SPELL_CHANCE = [0.03, 0.06, 0.12, 0.22, 0.35, 0.5, 0.7];

export function rollWeaponSpell(r: RNG): string {
  const e = r.weighted(PROC_EFFECTS, (x) => x.weight);
  const t = r.weighted(PROC_TRIGGERS, (x) => x.weight);
  return `${e.id}@${t.id}`;
}

/** the effect and the moment of a weapon spell ("meteor@kill5"), or null for an unknown one */
export function parseWeaponSpell(key: string | undefined): { eff: ProcEffect; trig: ProcTrigger } | null {
  if (!key) return null;
  const [e, t] = key.split('@');
  const eff = PROC_EFFECT_BY_ID[e],
    trig = PROC_TRIGGER_BY_ID[t];
  return eff && trig ? { eff, trig } : null;
}
