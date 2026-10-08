// Spell runes: one rune fits into each spell and changes how it works - it echoes, splits, turns into
// fire or frost, hits harder for more mana, comes back sooner, heals, pierces, seeks its target or
// explodes. Together with legendary powers and champion traits the same floor plays differently.
import type { Fx } from './spells';
import type { Element } from './types';

export interface SpellRuneDef {
  id: string;
  name: string;
  color: string;
  desc: string;
  /** element the spell turns into */
  el?: Element;
}

export const SPELL_RUNES: SpellRuneDef[] = [
  { id: 'echo', name: 'Runa ozvěny', color: '#c77dff', desc: '30% šance, že se kouzlo sešle podruhé zdarma' },
  { id: 'split', name: 'Runa rozštěpení', color: '#ffd76a', desc: 'Střely +2 navíc, plošná kouzla o 30 % větší' },
  { id: 'fire', name: 'Runa plamene', color: '#ff7a2a', desc: 'Kouzlo je ohnivé a zapaluje', el: 'fire' },
  { id: 'frost', name: 'Runa mrazu', color: '#9fe6ff', desc: 'Kouzlo je mrazivé a zpomaluje o 40 %', el: 'ice' },
  { id: 'storm', name: 'Runa bouře', color: '#fff27a', desc: 'Kouzlo je bleskové a střely se odrazí k dalšímu nepříteli', el: 'lightning' },
  { id: 'venom', name: 'Runa jedu', color: '#7be05a', desc: 'Kouzlo je jedové a otravuje', el: 'poison' },
  { id: 'power', name: 'Runa síly', color: '#ff5a4a', desc: '+40 % poškození, ale o 40 % víc many' },
  { id: 'haste', name: 'Runa spěchu', color: '#7affd4', desc: 'O 35 % kratší přebíjení, o 15 % menší poškození' },
  { id: 'vamp', name: 'Runa upíra', color: '#ff6a9a', desc: 'Každé seslání tě vyléčí o 4 % zdraví' },
  { id: 'pierce', name: 'Runa průrazu', color: '#d8d8e8', desc: 'Střely prolétnou dvěma dalšími nepřáteli' },
  { id: 'seek', name: 'Runa navádění', color: '#8ab8ff', desc: 'Střely se samy navádějí a letí o 30 % rychleji' },
  { id: 'blast', name: 'Runa výbuchu', color: '#ffa04a', desc: 'Střely při zásahu vybuchnou' },
];

export const SPELL_RUNE_BY_ID = Object.fromEntries(SPELL_RUNES.map((r) => [r.id, r])) as Record<string, SpellRuneDef>;

export const spellRuneIcon = (id: string) => `srune_${id}`;

/** the spell's effect as the rune changes it (a copy) */
export function runeFx(f: Fx, rune: string | undefined): Fx {
  const r = rune ? SPELL_RUNE_BY_ID[rune] : null;
  if (!r) return f;
  const g: Fx = { ...f };
  const damaging = !['buff', 'heal', 'summon', 'blink', 'stealth', 'shield', 'totem'].includes(f.t);
  if (r.el && damaging) g.el = r.el;
  switch (r.id) {
    case 'split':
      if (f.t === 'proj') {
        g.n = (f.n ?? 1) + 2;
        g.spread = Math.max(f.spread ?? 20, 30);
      } else if (f.r) g.r = Math.round(f.r * 1.3);
      break;
    case 'frost':
      if (damaging) g.slow = Math.max(f.slow ?? 0, 0.4);
      break;
    case 'storm':
      if (f.t === 'proj') g.bounce = (f.bounce ?? 0) + 1;
      break;
    case 'power':
      g.p = (f.p ?? 1) * 1.4;
      break;
    case 'haste':
      g.p = (f.p ?? 1) * 0.85;
      break;
    case 'pierce':
      if (f.t === 'proj') g.pierce = (f.pierce ?? 0) + 2;
      break;
    case 'seek':
      if (f.t === 'proj') {
        g.homing = true;
        g.speed = (f.speed ?? 280) * 1.3;
      }
      break;
    case 'blast':
      if (f.t === 'proj' && !f.explode) g.explode = 26;
      break;
  }
  return g;
}
