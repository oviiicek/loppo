import { ClassId, Element } from './types';

// Buff modifiers usable by spells (additive while active).
export interface BuffMods {
  dmgPct?: number;
  atkSpdPct?: number;
  armorPct?: number;
  move?: number;
  crit?: number;
  critDmg?: number;
  lifesteal?: number;
  dodge?: number;
  cdrRate?: number; // extra cooldown recovery speed (0.5 = 50 % faster)
  regenPct?: number; // % of max HP healed per second
  spellDmg?: number;
  thornsPct?: number; // reflect % of damage taken
  invuln?: boolean;
  onHitChain?: boolean;
  onHitPoison?: boolean;
  onHitFire?: boolean;
  range?: number;
  novaPulse?: number; // periodic nova every second with this multiplier
}

export type FxType =
  | 'proj'
  | 'nova'
  | 'aoe'
  | 'rain'
  | 'melee'
  | 'dash'
  | 'blink'
  | 'buff'
  | 'heal'
  | 'shield'
  | 'summon'
  | 'field'
  | 'chain'
  | 'stealth'
  | 'trap'
  | 'totem'
  | 'whirl'
  | 'dance'
  | 'mana'
  | 'orbit';

export interface Fx {
  t: FxType;
  p?: number; // damage multiplier
  el?: Element;
  n?: number;
  spread?: number;
  speed?: number;
  pierce?: number;
  explode?: number;
  bounce?: number;
  homing?: boolean;
  size?: number;
  sprite?: string;
  r?: number;
  dur?: number;
  delay?: number;
  dist?: number;
  arc?: number;
  range?: number;
  hits?: number;
  slow?: number;
  stun?: number;
  freeze?: number;
  dot?: number;
  pull?: boolean;
  heal?: number;
  mods?: BuffMods;
  kind?: string;
  follow?: boolean;
  lifesteal?: number;
  execute?: boolean;
  vuln?: number;
  knock?: number;
  ring?: boolean;
  back?: boolean;
  line?: boolean;
}

export interface SpellDef {
  id: string;
  name: string;
  cls: ClassId | 'universal';
  lvl: number;
  ult?: boolean;
  mana: number;
  cd: number;
  scale: 'weapon' | 'magic';
  fx: Fx[];
  icon: string;
  color: string;
  desc: string;
}

const C = {
  fire: '#ff7a2a',
  ice: '#6fd3ff',
  light: '#ffe45c',
  poison: '#7be05a',
  holy: '#fff2a8',
  shadow: '#a16bff',
  phys: '#d9d9d9',
  blood: '#ff3b3b',
  nature: '#4fd06b',
  arcane: '#c77dff',
  heal: '#52ff8f',
  shield: '#7fb2ff',
};

function S(cls: ClassId | 'universal', n: number, name: string, lvl: number, mana: number, cd: number, scale: 'weapon' | 'magic', fx: Fx[], icon: string, color: string, desc: string, ult = false): SpellDef {
  return { id: `${cls}_${n}`, name, cls, lvl, mana, cd, scale, fx, icon, color, desc, ult };
}

const W = 'weapon' as const;
const M = 'magic' as const;

export const SPELLS: SpellDef[] = [
  // ------------------------------------------------------------- BOJOVNÍK
  S('warrior', 1, 'Mocný úder', 1, 8, 4, W, [{ t: 'melee', p: 2.4, arc: 100, range: 40 }], 'sword', C.phys, 'Silný úder zbraní před sebe.'),
  S('warrior', 2, 'Válečný pokřik', 2, 15, 16, W, [{ t: 'buff', dur: 8, mods: { dmgPct: 30, armorPct: 20 } }, { t: 'nova', p: 0.5, r: 50, stun: 0.6 }], 'shout', C.blood, 'Zvýší poškození a brnění, krátce omráčí okolí.'),
  S('warrior', 3, 'Výpad', 4, 12, 7, W, [{ t: 'dash', dist: 90, p: 1.6 }], 'dash', C.phys, 'Vrhne se vpřed a zraní vše v cestě.'),
  S('warrior', 4, 'Zemětřesení', 6, 35, 40, W, [{ t: 'nova', p: 4.5, r: 90, stun: 1.5 }], 'burst', '#c98b4a', 'Udeří do země – obrovská rázová vlna omráčí nepřátele.', true),
  S('warrior', 5, 'Otočka', 8, 20, 10, W, [{ t: 'whirl', dur: 2.5, r: 38, p: 0.55 }], 'whirl', C.phys, 'Točí se se zbraní a zasahuje vše kolem.'),
  S('warrior', 6, 'Štítový val', 10, 18, 18, W, [{ t: 'shield', heal: 0.3, dur: 6 }], 'shield', C.shield, 'Vytvoří štít pohlcující poškození.'),
  S('warrior', 7, 'Rozseknutí', 13, 18, 6, W, [{ t: 'melee', p: 2.8, arc: 200, range: 48 }], 'slash', C.phys, 'Široký sek, který zasáhne vše před tebou.'),
  S('warrior', 8, 'Drtivý skok', 16, 25, 11, W, [{ t: 'dash', dist: 110, p: 0.5 }, { t: 'nova', p: 2.6, r: 60, stun: 0.8 }], 'hammer', '#c98b4a', 'Skočí k nepříteli a dopadne s drtivou silou.'),
  S('warrior', 9, 'Železná kůže', 19, 20, 22, W, [{ t: 'buff', dur: 10, mods: { armorPct: 100, thornsPct: 30 } }], 'shield', '#9aa3ad', 'Zdvojnásobí brnění a odráží poškození.'),
  S('warrior', 10, 'Hněv titánů', 22, 50, 60, W, [{ t: 'buff', dur: 12, mods: { atkSpdPct: 60, dmgPct: 50 } }, { t: 'nova', p: 3, r: 80 }], 'crown', C.blood, 'Masivní zesílení útoku a rychlosti.', true),
  S('warrior', 11, 'Rázová vlna', 26, 22, 8, W, [{ t: 'proj', p: 3, speed: 220, pierce: 99, sprite: 'wave', size: 1.6 }], 'wave', C.phys, 'Vyšle průrazovou vlnu energie.'),
  S('warrior', 12, 'Krvavá čepel', 30, 25, 20, W, [{ t: 'buff', dur: 8, mods: { lifesteal: 15, dmgPct: 20 } }], 'drop', C.blood, 'Útoky vysávají život.'),
  S('warrior', 13, 'Řetězy', 35, 25, 14, W, [{ t: 'field', r: 90, dur: 0.6, pull: true, p: 0.4 }, { t: 'nova', p: 2.2, r: 50, delay: 0.6 }], 'chain', '#9aa3ad', 'Přitáhne nepřátele a udeří je.'),
  S('warrior', 14, 'Hromový úder', 40, 30, 10, W, [{ t: 'melee', p: 5, arc: 120, range: 46, stun: 1.2, el: 'lightning' }], 'bolt', C.light, 'Úder nabitý bleskem, který omráčí.'),
  S('warrior', 15, 'Meteorický pád', 45, 70, 70, W, [{ t: 'dash', dist: 140, p: 1 }, { t: 'nova', p: 9, r: 110, stun: 2, el: 'fire' }], 'meteor', C.fire, 'Vyskočí do nebe a dopadne jako meteor.', true),
  S('warrior', 16, 'Válečná zuřivost', 50, 30, 25, W, [{ t: 'buff', dur: 10, mods: { crit: 30, critDmg: 50 } }], 'eye', C.blood, 'Velká šance na kritické zásahy.'),
  S('warrior', 17, 'Smršť čepelí', 56, 40, 16, W, [{ t: 'whirl', dur: 4.5, r: 50, p: 0.9 }], 'whirl', C.blood, 'Delší a silnější otočka.'),
  S('warrior', 18, 'Nezlomný', 62, 40, 35, W, [{ t: 'heal', heal: 0.3 }, { t: 'shield', heal: 0.3, dur: 8 }], 'heart', C.heal, 'Vyléčí a ochrání štítem.'),
  S('warrior', 19, 'Seismický úder', 70, 45, 12, W, [{ t: 'rain', n: 6, p: 3.2, r: 34, line: true, delay: 0.1, el: 'phys' }], 'burst', '#c98b4a', 'Série výbuchů země v řadě před tebou.'),
  S('warrior', 20, 'Avatar války', 80, 100, 100, W, [{ t: 'buff', dur: 15, mods: { dmgPct: 100, atkSpdPct: 50, armorPct: 100, novaPulse: 1.5 } }], 'crown', '#ffd34d', 'Stane se avatarem války – obrovské zesílení a pulzující rázové vlny.', true),

  // ------------------------------------------------------------- ASSASSIN
  S('assassin', 1, 'Bodnutí', 1, 8, 3.5, W, [{ t: 'melee', p: 2.6, arc: 70, range: 36, execute: true }], 'dagger', C.phys, 'Přesný bod, silnější proti zraněným.'),
  S('assassin', 2, 'Vrhací nože', 2, 10, 4, W, [{ t: 'proj', n: 3, spread: 24, p: 1, speed: 320, sprite: 'knife' }], 'knives', C.phys, 'Hodí vějíř nožů.'),
  S('assassin', 3, 'Stínový krok', 4, 12, 7, W, [{ t: 'blink', range: 140 }, { t: 'melee', p: 1.8, arc: 140, range: 40 }], 'ghost', C.shadow, 'Teleportuje se k nepříteli a udeří.'),
  S('assassin', 4, 'Tanec smrti', 6, 35, 40, W, [{ t: 'dance', hits: 8, p: 2 }], 'slash', C.shadow, 'Bleskově přeskakuje mezi nepřáteli a seká.', true),
  S('assassin', 5, 'Jed na čepeli', 8, 15, 18, W, [{ t: 'buff', dur: 10, mods: { onHitPoison: true, dmgPct: 10 } }], 'poison', C.poison, 'Útoky otráví nepřátele.'),
  S('assassin', 6, 'Kouřová clona', 10, 20, 20, W, [{ t: 'stealth', dur: 4 }, { t: 'field', r: 60, dur: 4, slow: 0.5, p: 0.1 }], 'eye', '#888', 'Zmizí v kouři, nepřátelé zpomalí.'),
  S('assassin', 7, 'Vějíř čepelí', 13, 20, 8, W, [{ t: 'proj', n: 12, ring: true, p: 1.1, speed: 280, sprite: 'knife' }], 'knives', C.phys, 'Vystřelí nože do všech stran.'),
  S('assassin', 8, 'Zákeřný úder', 16, 20, 9, W, [{ t: 'melee', p: 4.4, arc: 80, range: 38, execute: true }], 'dagger', C.blood, 'Smrtící úder, drtivý proti zraněným.'),
  S('assassin', 9, 'Pasti', 19, 22, 12, W, [{ t: 'trap', n: 3, p: 2.6, r: 36 }], 'trap', '#c0c0c0', 'Rozmístí výbušné pasti.'),
  S('assassin', 10, 'Stínový klon', 22, 50, 55, W, [{ t: 'summon', kind: 'shadow', n: 2, dur: 14 }], 'ghost', C.shadow, 'Vyvolá dva stínové klony.', true),
  S('assassin', 11, 'Smrtící vír', 26, 25, 10, W, [{ t: 'whirl', dur: 2, r: 40, p: 1.0 }], 'whirl', C.shadow, 'Rychlá rotace čepelí.'),
  S('assassin', 12, 'Jedová bomba', 30, 25, 10, W, [{ t: 'aoe', p: 1.5, r: 55, delay: 0.4, el: 'poison' }, { t: 'field', r: 55, dur: 5, p: 0.6, el: 'poison' }], 'poison', C.poison, 'Hodí bombu, která zanechá jedový mrak.'),
  S('assassin', 13, 'Odrazné čepele', 35, 25, 7, W, [{ t: 'proj', n: 2, spread: 12, p: 2, bounce: 5, speed: 300, sprite: 'knife' }], 'knives', '#c0c0c0', 'Nože se odráží mezi nepřáteli.'),
  S('assassin', 14, 'Rozpárání', 40, 25, 8, W, [{ t: 'melee', p: 3.2, arc: 120, range: 40, dot: 1.2 }], 'claw', C.blood, 'Sek způsobující krvácení.'),
  S('assassin', 15, 'Popravčí', 45, 60, 50, W, [{ t: 'blink', range: 160 }, { t: 'melee', p: 15, arc: 60, range: 40, execute: true }], 'skull', C.blood, 'Teleport a zničující poprava jednoho cíle.', true),
  S('assassin', 16, 'Mrštnost', 50, 30, 24, W, [{ t: 'buff', dur: 10, mods: { dodge: 30, atkSpdPct: 40, move: 25 } }], 'wing', C.shadow, 'Úhyb, rychlost útoku i pohybu.'),
  S('assassin', 17, 'Ostří stínů', 56, 35, 9, W, [{ t: 'proj', n: 8, spread: 50, p: 1.6, pierce: 5, speed: 340, sprite: 'shadow' }], 'knives', C.shadow, 'Vystřelí stínové střepy.'),
  S('assassin', 18, 'Neviditelnost', 62, 40, 30, W, [{ t: 'stealth', dur: 8 }, { t: 'buff', dur: 8, mods: { crit: 40 } }], 'eye', C.shadow, 'Dlouhá neviditelnost a jisté kritické zásahy.'),
  S('assassin', 19, 'Kruh čepelí', 70, 45, 20, W, [{ t: 'orbit', n: 6, dur: 8, p: 1.4, r: 36 }], 'whirl', '#c0c0c0', 'Kolem tebe krouží čepele.'),
  S('assassin', 20, 'Noc tisíce čepelí', 80, 100, 95, W, [{ t: 'rain', n: 24, p: 4, r: 40, delay: 0.05, el: 'shadow' }], 'knives', C.shadow, 'Z temnoty prší tisíce čepelí.', true),

  // ------------------------------------------------------------- LUČIŠNÍK
  S('ranger', 1, 'Silný výstřel', 1, 8, 3.5, W, [{ t: 'proj', p: 2.6, pierce: 3, speed: 380, sprite: 'arrow', size: 1.3 }], 'arrow', C.phys, 'Průrazný silný šíp.'),
  S('ranger', 2, 'Vícenásobný výstřel', 2, 12, 5, W, [{ t: 'proj', n: 5, spread: 40, p: 1.0, speed: 340, sprite: 'arrow' }], 'arrows', C.phys, 'Vystřelí vějíř šípů.'),
  S('ranger', 3, 'Úskok', 4, 10, 6, W, [{ t: 'dash', dist: 80, back: true, p: 0 }, { t: 'proj', n: 3, spread: 20, p: 0.8, speed: 340, sprite: 'arrow' }], 'dash', C.nature, 'Odskočí od nepřátel a vystřelí.'),
  S('ranger', 4, 'Déšť šípů', 6, 35, 35, W, [{ t: 'rain', n: 16, p: 1.8, r: 30, delay: 0.06 }], 'rain', C.phys, 'Na oblast se snese déšť šípů.', true),
  S('ranger', 5, 'Ohnivý šíp', 8, 15, 6, W, [{ t: 'proj', p: 2.2, explode: 40, speed: 340, sprite: 'fire', el: 'fire' }], 'fire', C.fire, 'Šíp vybuchne v plamenech.'),
  S('ranger', 6, 'Mrazivá past', 10, 18, 14, W, [{ t: 'trap', n: 1, p: 1.6, r: 60, freeze: 2.5, el: 'ice' }], 'trap', C.ice, 'Past, která zmrazí nepřátele.'),
  S('ranger', 7, 'Jestřáb', 13, 25, 30, W, [{ t: 'summon', kind: 'hawk', n: 1, dur: 25 }], 'wing', '#d0a060', 'Vyvolá jestřába, který útočí na nepřátele.'),
  S('ranger', 8, 'Odrážený šíp', 16, 18, 7, W, [{ t: 'proj', p: 2.2, bounce: 4, speed: 360, sprite: 'arrow' }], 'arrow', '#c0c0c0', 'Šíp se odrazí na další cíle.'),
  S('ranger', 9, 'Orlí oko', 19, 20, 24, W, [{ t: 'buff', dur: 12, mods: { crit: 25, critDmg: 40, range: 40 } }], 'eye', C.light, 'Vyšší šance na kritický zásah a dosah.'),
  S('ranger', 10, 'Vlčí smečka', 22, 50, 60, W, [{ t: 'summon', kind: 'wolf', n: 3, dur: 25 }], 'wolf', '#a0a0a0', 'Vyvolá smečku vlků.', true),
  S('ranger', 11, 'Výbušný šíp', 26, 25, 9, W, [{ t: 'proj', p: 4, explode: 60, speed: 320, sprite: 'fire', el: 'fire', size: 1.3 }], 'burst', C.fire, 'Šíp s mohutnou explozí.'),
  S('ranger', 12, 'Kruhová salva', 30, 25, 9, W, [{ t: 'proj', n: 16, ring: true, p: 1.3, speed: 330, sprite: 'arrow' }], 'arrows', C.phys, 'Šípy do všech směrů.'),
  S('ranger', 13, 'Prošpikování', 35, 25, 8, W, [{ t: 'proj', p: 5.5, pierce: 99, speed: 450, sprite: 'arrow', size: 1.6 }], 'arrow', C.blood, 'Ohromně silný průrazný šíp.'),
  S('ranger', 14, 'Jedovatý šíp', 40, 25, 9, W, [{ t: 'proj', p: 2, explode: 50, speed: 340, sprite: 'poison', el: 'poison' }, { t: 'field', r: 50, dur: 5, p: 0.8, el: 'poison', delay: 0.3 }], 'poison', C.poison, 'Šíp zanechá jedový mrak.'),
  S('ranger', 15, 'Hromový luk', 45, 60, 60, W, [{ t: 'buff', dur: 12, mods: { onHitChain: true, atkSpdPct: 30 } }], 'bolt', C.light, 'Každý zásah vyvolá řetězový blesk.', true),
  S('ranger', 16, 'Rychlá palba', 50, 30, 25, W, [{ t: 'buff', dur: 10, mods: { atkSpdPct: 80 } }], 'arrows', C.light, 'Masivně zvýší rychlost střelby.'),
  S('ranger', 17, 'Šípová bouře', 56, 40, 16, W, [{ t: 'rain', n: 26, p: 2.2, r: 26, delay: 0.04 }], 'rain', '#c0c0c0', 'Hustá bouře šípů.'),
  S('ranger', 18, 'Duchovní šípy', 62, 35, 9, W, [{ t: 'proj', n: 6, spread: 70, p: 2, homing: true, speed: 260, sprite: 'magic' }], 'arrows', C.arcane, 'Samonaváděcí duchovní šípy.'),
  S('ranger', 19, 'Drakobijec', 70, 50, 14, W, [{ t: 'proj', p: 12, pierce: 99, speed: 420, sprite: 'arrow', size: 2.2, explode: 40 }], 'arrow', C.fire, 'Gigantický šíp, který probije vše.'),
  S('ranger', 20, 'Hvězdný déšť', 80, 100, 95, W, [{ t: 'rain', n: 40, p: 4, r: 36, delay: 0.04, el: 'holy' }], 'star', C.holy, 'Z nebe prší hvězdy.', true),

  // ------------------------------------------------------------- MÁG
  S('mage', 1, 'Ohnivá koule', 1, 10, 2.5, M, [{ t: 'proj', p: 1.6, explode: 34, speed: 260, sprite: 'fire', el: 'fire' }], 'fire', C.fire, 'Ohnivá koule, která vybuchne.'),
  S('mage', 2, 'Ledový šíp', 2, 9, 3, M, [{ t: 'proj', p: 1.3, slow: 0.5, speed: 320, sprite: 'ice', el: 'ice', pierce: 1 }], 'ice', C.ice, 'Ledový střep zpomalí cíl.'),
  S('mage', 3, 'Teleport', 4, 12, 8, M, [{ t: 'blink', range: 130 }], 'ghost', C.arcane, 'Teleportuje tě ve směru pohybu.'),
  S('mage', 4, 'Meteor', 6, 40, 30, M, [{ t: 'aoe', p: 6, r: 80, delay: 1, el: 'fire', sprite: 'meteor' }], 'meteor', C.fire, 'Na cíl dopadne obrovský meteor.', true),
  S('mage', 5, 'Mrazivá nova', 8, 20, 10, M, [{ t: 'nova', p: 1.6, r: 70, freeze: 2, el: 'ice' }], 'ice', C.ice, 'Zmrazí všechny nepřátele kolem.'),
  S('mage', 6, 'Magický štít', 10, 25, 20, M, [{ t: 'shield', heal: 0.4, dur: 8 }], 'shield', C.arcane, 'Silný magický štít.'),
  S('mage', 7, 'Řetězový blesk', 13, 20, 5, M, [{ t: 'chain', n: 5, p: 1.8, el: 'lightning' }], 'bolt', C.light, 'Blesk přeskakuje mezi nepřáteli.'),
  S('mage', 8, 'Ohnivá zeď', 16, 25, 12, M, [{ t: 'field', r: 40, dur: 5, p: 1.2, el: 'fire', line: true }], 'fire', C.fire, 'Řada plamenů spaluje nepřátele.'),
  S('mage', 9, 'Arkánní střely', 19, 22, 6, M, [{ t: 'proj', n: 5, spread: 60, p: 1.1, homing: true, speed: 240, sprite: 'magic', el: 'shadow' }], 'orb', C.arcane, 'Samonaváděcí magické střely.'),
  S('mage', 10, 'Vánice', 22, 55, 50, M, [{ t: 'field', r: 110, dur: 7, p: 1.4, slow: 0.6, el: 'ice' }], 'ice', C.ice, 'Obrovská ledová bouře.', true),
  S('mage', 11, 'Ohnivý dech', 26, 25, 7, M, [{ t: 'proj', n: 9, spread: 50, p: 1, speed: 230, sprite: 'fire', el: 'fire', range: 120 }], 'fire', C.fire, 'Kužel plamenů.'),
  S('mage', 12, 'Kulový blesk', 30, 30, 10, M, [{ t: 'proj', p: 0.8, speed: 70, sprite: 'bolt', el: 'lightning', size: 2, pierce: 99, dot: 1.5 }], 'bolt', C.light, 'Pomalá koule blesku zraňuje vše kolem.'),
  S('mage', 13, 'Černá díra', 35, 35, 16, M, [{ t: 'field', r: 100, dur: 3, pull: true, p: 1.5, el: 'shadow' }], 'vortex', C.shadow, 'Vtáhne nepřátele a drtí je.'),
  S('mage', 14, 'Ledová kopí', 40, 30, 8, M, [{ t: 'proj', n: 3, spread: 20, p: 3, pierce: 99, speed: 360, sprite: 'ice', el: 'ice', size: 1.6, slow: 0.5 }], 'ice', C.ice, 'Tři průrazná ledová kopí.'),
  S('mage', 15, 'Armagedon', 45, 80, 70, M, [{ t: 'rain', n: 18, p: 4, r: 50, delay: 0.12, el: 'fire', sprite: 'meteor' }], 'meteor', C.fire, 'Déšť meteorů.', true),
  S('mage', 16, 'Arkánní moc', 50, 30, 30, M, [{ t: 'buff', dur: 12, mods: { spellDmg: 50, cdrRate: 0.5 } }], 'star', C.arcane, 'Silnější kouzla a rychlejší přebíjení.'),
  S('mage', 17, 'Ohnivý kruh', 56, 40, 18, M, [{ t: 'field', r: 60, dur: 8, p: 1.5, el: 'fire', follow: true }], 'fire', C.fire, 'Kolem tebe hoří kruh plamenů.'),
  S('mage', 18, 'Bouře blesků', 62, 45, 14, M, [{ t: 'rain', n: 12, p: 3.5, r: 34, delay: 0.1, el: 'lightning' }], 'bolt', C.light, 'Blesky bijí do nepřátel.'),
  S('mage', 19, 'Absolutní nula', 70, 60, 20, M, [{ t: 'nova', p: 8, r: 110, freeze: 3, el: 'ice' }], 'ice', '#bff3ff', 'Vše kolem zmrzne na kost.'),
  S('mage', 20, 'Supernova', 80, 120, 100, M, [{ t: 'nova', p: 25, r: 180, el: 'fire' }], 'sun', '#fff1a0', 'Exploze hvězdné síly.', true),

  // ------------------------------------------------------------- PALADIN
  S('paladin', 1, 'Svatý úder', 1, 8, 4, W, [{ t: 'melee', p: 2.2, arc: 110, range: 40, el: 'holy', lifesteal: 20 }], 'hammer', C.holy, 'Svatý úder, který tě trochu vyléčí.'),
  S('paladin', 2, 'Požehnání', 2, 15, 18, M, [{ t: 'buff', dur: 10, mods: { armorPct: 40, regenPct: 1.5 } }], 'cross', C.holy, 'Brnění a regenerace zdraví.'),
  S('paladin', 3, 'Nápor', 4, 12, 7, W, [{ t: 'dash', dist: 100, p: 1.6, stun: 0.6 }], 'dash', C.holy, 'Rozběhne se a srazí nepřátele.'),
  S('paladin', 4, 'Božský soud', 6, 35, 35, M, [{ t: 'aoe', p: 5.5, r: 80, delay: 0.8, el: 'holy', sprite: 'pillar' }], 'sun', C.holy, 'Sloup světla z nebes.', true),
  S('paladin', 5, 'Zasvěcená půda', 8, 20, 14, M, [{ t: 'field', r: 60, dur: 6, p: 1, el: 'holy' }], 'cross', C.holy, 'Posvátná půda spaluje nepřátele.'),
  S('paladin', 6, 'Božský štít', 10, 20, 20, M, [{ t: 'shield', heal: 0.35, dur: 8 }], 'shield', C.holy, 'Štít světla.'),
  S('paladin', 7, 'Kladivo spravedlnosti', 13, 18, 8, W, [{ t: 'proj', p: 2.6, stun: 1.5, speed: 280, sprite: 'hammer', el: 'holy' }], 'hammer', C.holy, 'Hozené kladivo omráčí.'),
  S('paladin', 8, 'Léčivé světlo', 16, 25, 16, M, [{ t: 'heal', heal: 0.4 }], 'plus', C.heal, 'Silné léčení.'),
  S('paladin', 9, 'Aura pomsty', 19, 20, 24, W, [{ t: 'buff', dur: 12, mods: { thornsPct: 60, dmgPct: 15 } }], 'shield', C.blood, 'Odráží velkou část poškození.'),
  S('paladin', 10, 'Andělská křídla', 22, 50, 60, M, [{ t: 'buff', dur: 12, mods: { dmgPct: 50, regenPct: 3, move: 20 } }], 'wing', C.holy, 'Křídla anděla – síla a léčení.', true),
  S('paladin', 11, 'Svatá kladiva', 26, 30, 16, W, [{ t: 'orbit', n: 3, dur: 7, p: 1.6, r: 40, sprite: 'hammer' }], 'hammer', C.holy, 'Kolem tebe obíhají kladiva.'),
  S('paladin', 12, 'Paprsek světla', 30, 25, 8, M, [{ t: 'proj', p: 3.5, pierce: 99, speed: 420, sprite: 'holy', el: 'holy', size: 1.6 }], 'sun', C.holy, 'Průrazný paprsek světla.'),
  S('paladin', 13, 'Očista', 35, 30, 14, M, [{ t: 'nova', p: 4, r: 80, el: 'holy' }, { t: 'heal', heal: 0.15 }], 'cross', C.holy, 'Nova světla, která léčí.'),
  S('paladin', 14, 'Hněv nebes', 40, 35, 14, M, [{ t: 'rain', n: 8, p: 3.5, r: 40, delay: 0.15, el: 'holy', sprite: 'pillar' }], 'sun', C.holy, 'Sloupy světla dopadají kolem.'),
  S('paladin', 15, 'Nesmrtelnost', 45, 60, 90, M, [{ t: 'buff', dur: 4, mods: { invuln: true } }, { t: 'heal', heal: 1 }], 'crown', '#fff', 'Plné vyléčení a 4 s nezranitelnosti.', true),
  S('paladin', 16, 'Křižácký útok', 50, 30, 9, W, [{ t: 'melee', p: 5.5, arc: 200, range: 50, el: 'holy' }], 'sword', C.holy, 'Široký svatý sek.'),
  S('paladin', 17, 'Svatá nova', 56, 35, 12, M, [{ t: 'proj', n: 14, ring: true, p: 1.8, speed: 260, sprite: 'holy', el: 'holy' }], 'star', C.holy, 'Kruh svatých střel.'),
  S('paladin', 18, 'Světelný meč', 62, 45, 40, M, [{ t: 'summon', kind: 'spiritSword', n: 1, dur: 25 }], 'sword', C.holy, 'Vyvolá létající meč světla.'),
  S('paladin', 19, 'Archandělův úder', 70, 50, 14, W, [{ t: 'melee', p: 11, arc: 140, range: 54, el: 'holy', stun: 1 }], 'hammer', '#fff', 'Drtivý úder archanděla.'),
  S('paladin', 20, 'Den soudu', 80, 120, 100, M, [{ t: 'rain', n: 30, p: 5, r: 44, delay: 0.06, el: 'holy', sprite: 'pillar' }, { t: 'heal', heal: 0.5 }], 'sun', '#fff', 'Nebesa se otevřou a spálí nepřátele.', true),

  // ------------------------------------------------------------- NEKROMANT
  S('necro', 1, 'Kostěné kopí', 1, 9, 2.5, M, [{ t: 'proj', p: 1.5, pierce: 3, speed: 300, sprite: 'bone' }], 'skull', '#e8e2cf', 'Průrazné kostěné kopí.'),
  S('necro', 2, 'Vyvolej kostlivce', 2, 20, 20, M, [{ t: 'summon', kind: 'skeleton', n: 2, dur: 30 }], 'skull', '#e8e2cf', 'Vyvolá dva kostlivce.'),
  S('necro', 3, 'Mrtvolná exploze', 4, 15, 6, M, [{ t: 'aoe', p: 2.2, r: 55, delay: 0.2, el: 'shadow' }], 'burst', C.blood, 'Exploze temné energie u nepřítele.'),
  S('necro', 4, 'Armáda mrtvých', 6, 45, 45, M, [{ t: 'summon', kind: 'skeleton', n: 6, dur: 20 }], 'skull', C.shadow, 'Vyvolá armádu kostlivců.', true),
  S('necro', 5, 'Vysátí života', 8, 15, 5, M, [{ t: 'proj', p: 1.6, lifesteal: 50, speed: 260, sprite: 'shadow', el: 'shadow' }], 'drop', C.blood, 'Vysaje život z nepřítele.'),
  S('necro', 6, 'Kostěný štít', 10, 20, 20, M, [{ t: 'shield', heal: 0.35, dur: 8 }], 'shield', '#e8e2cf', 'Štít z kostí.'),
  S('necro', 7, 'Mor', 13, 22, 12, M, [{ t: 'field', r: 70, dur: 6, p: 1, el: 'poison' }], 'poison', C.poison, 'Mrak moru.'),
  S('necro', 8, 'Vyvolej mága', 16, 30, 30, M, [{ t: 'summon', kind: 'skelMage', n: 2, dur: 30 }], 'skull', C.arcane, 'Vyvolá kostlivé mágy.'),
  S('necro', 9, 'Prokletí slabosti', 19, 20, 18, M, [{ t: 'field', r: 80, dur: 8, p: 0.2, vuln: 0.35, el: 'shadow' }], 'eye', C.shadow, 'Nepřátelé v oblasti dostávají více poškození.'),
  S('necro', 10, 'Kostěný golem', 22, 60, 60, M, [{ t: 'summon', kind: 'boneGolem', n: 1, dur: 35 }], 'skull', '#e8e2cf', 'Vyvolá mohutného kostěného golema.', true),
  S('necro', 11, 'Kostěná bouře', 26, 30, 16, M, [{ t: 'orbit', n: 5, dur: 7, p: 1.4, r: 38, sprite: 'bone' }], 'whirl', '#e8e2cf', 'Kosti krouží kolem tebe.'),
  S('necro', 12, 'Duše', 30, 30, 9, M, [{ t: 'proj', n: 6, spread: 80, p: 1.6, homing: true, speed: 220, sprite: 'soul', el: 'shadow' }], 'ghost', C.shadow, 'Samonaváděcí duše.'),
  S('necro', 13, 'Smrtící dotek', 35, 30, 9, M, [{ t: 'melee', p: 6, arc: 100, range: 44, el: 'shadow', lifesteal: 30 }], 'claw', C.shadow, 'Dotek smrti, vysává život.'),
  S('necro', 14, 'Temná nova', 40, 35, 12, M, [{ t: 'nova', p: 4.5, r: 85, el: 'shadow' }], 'burst', C.shadow, 'Výbuch temné energie.'),
  S('necro', 15, 'Podoba liche', 45, 60, 70, M, [{ t: 'buff', dur: 15, mods: { spellDmg: 80, lifesteal: 10, cdrRate: 0.3 } }], 'crown', C.shadow, 'Promění se v liche.', true),
  S('necro', 16, 'Rudá mlha', 50, 35, 16, M, [{ t: 'field', r: 70, dur: 6, p: 1.6, el: 'shadow', lifesteal: 20 }], 'drop', C.blood, 'Mlha vysává život nepřátel.'),
  S('necro', 17, 'Kostěný déšť', 56, 40, 14, M, [{ t: 'rain', n: 14, p: 3, r: 32, delay: 0.08, el: 'phys', sprite: 'bone' }], 'skull', '#e8e2cf', 'Z nebe prší kosti.'),
  S('necro', 18, 'Rytíři smrti', 62, 50, 45, M, [{ t: 'summon', kind: 'deathKnight', n: 2, dur: 30 }], 'sword', C.shadow, 'Vyvolá dva rytíře smrti.'),
  S('necro', 19, 'Pohřební zvon', 70, 55, 20, M, [{ t: 'nova', p: 9, r: 120, stun: 2, el: 'shadow' }], 'burst', C.shadow, 'Ohlušující zvon smrti.'),
  S('necro', 20, 'Apokalypsa', 80, 120, 100, M, [{ t: 'rain', n: 26, p: 5, r: 44, delay: 0.06, el: 'shadow' }, { t: 'summon', kind: 'deathKnight', n: 3, dur: 20 }], 'skull', C.blood, 'Konec světa – déšť smrti a rytíři.', true),

  // ------------------------------------------------------------- BERSERKER
  S('berserker', 1, 'Divoký úder', 1, 8, 3.5, W, [{ t: 'melee', p: 1.3, arc: 130, range: 40, hits: 2 }], 'slash', C.blood, 'Dva rychlé divoké seky.'),
  S('berserker', 2, 'Zuřivost', 2, 12, 15, W, [{ t: 'buff', dur: 7, mods: { atkSpdPct: 45 } }], 'shout', C.blood, 'Zvýší rychlost útoku.'),
  S('berserker', 3, 'Skok', 4, 12, 7, W, [{ t: 'dash', dist: 110, p: 0.4 }, { t: 'nova', p: 1.8, r: 50 }], 'dash', C.blood, 'Skočí mezi nepřátele.'),
  S('berserker', 4, 'Krvavá lázeň', 6, 35, 40, W, [{ t: 'whirl', dur: 4, r: 50, p: 1.0 }, { t: 'buff', dur: 4, mods: { lifesteal: 25 } }], 'whirl', C.blood, 'Krvavý vír, který léčí.', true),
  S('berserker', 5, 'Řev', 8, 15, 12, W, [{ t: 'nova', p: 1, r: 70, stun: 1.2 }], 'shout', '#c98b4a', 'Ohlušující řev omráčí nepřátele.'),
  S('berserker', 6, 'Krvelačnost', 10, 15, 20, W, [{ t: 'buff', dur: 10, mods: { lifesteal: 20 } }], 'drop', C.blood, 'Útoky vysávají život.'),
  S('berserker', 7, 'Hod sekerou', 13, 15, 6, W, [{ t: 'proj', p: 2.2, bounce: 3, speed: 300, sprite: 'axe' }], 'axe', C.phys, 'Hozená sekera se odráží.'),
  S('berserker', 8, 'Vír', 16, 22, 10, W, [{ t: 'whirl', dur: 3, r: 42, p: 0.8 }], 'whirl', C.phys, 'Točí se se zbraní.'),
  S('berserker', 9, 'Rozdrcení', 19, 20, 8, W, [{ t: 'melee', p: 4.2, arc: 90, range: 42, vuln: 0.25 }], 'hammer', C.blood, 'Úder, po kterém cíl dostává více poškození.'),
  S('berserker', 10, 'Nezastavitelný', 22, 45, 55, W, [{ t: 'buff', dur: 10, mods: { dmgPct: 60, atkSpdPct: 60, move: 30 } }], 'crown', C.blood, 'Nezastavitelná zuřivost.', true),
  S('berserker', 11, 'Válečný dupot', 26, 25, 10, W, [{ t: 'nova', p: 3.6, r: 70, stun: 0.6 }], 'burst', '#c98b4a', 'Dupnutí otřese zemí.'),
  S('berserker', 12, 'Krvavé sekery', 30, 30, 9, W, [{ t: 'proj', n: 8, ring: true, p: 1.6, speed: 260, sprite: 'axe', bounce: 1 }], 'axe', C.blood, 'Sekery letí do všech stran.'),
  S('berserker', 13, 'Masakr', 35, 30, 9, W, [{ t: 'melee', p: 3.4, arc: 360, range: 52 }], 'slash', C.blood, 'Sek kolem dokola.'),
  S('berserker', 14, 'Vztek', 40, 25, 25, W, [{ t: 'heal', heal: 0.3 }, { t: 'buff', dur: 6, mods: { dmgPct: 30 } }], 'heart', C.blood, 'Vyléčí se vztekem.'),
  S('berserker', 15, 'Berserkr', 45, 60, 70, W, [{ t: 'buff', dur: 15, mods: { dmgPct: 120, atkSpdPct: 40, lifesteal: 10 } }], 'crown', '#ff0000', 'Čistá zuřivost.', true),
  S('berserker', 16, 'Hromový skok', 50, 35, 10, W, [{ t: 'dash', dist: 130, p: 0.6 }, { t: 'nova', p: 4.5, r: 70, el: 'lightning', stun: 1 }], 'bolt', C.light, 'Skok s bleskovým dopadem.'),
  S('berserker', 17, 'Řezník', 56, 35, 10, W, [{ t: 'melee', p: 8.5, arc: 120, range: 46 }], 'axe', C.blood, 'Masivní úder.'),
  S('berserker', 18, 'Krvavá smršť', 62, 45, 16, W, [{ t: 'whirl', dur: 6, r: 52, p: 1.1 }], 'whirl', C.blood, 'Dlouhá krvavá smršť.'),
  S('berserker', 19, 'Zemětřas', 70, 45, 12, W, [{ t: 'rain', n: 8, p: 3.6, r: 36, line: true, delay: 0.08 }], 'burst', '#c98b4a', 'Země puká v řadě.'),
  S('berserker', 20, 'Bůh války', 80, 110, 100, W, [{ t: 'nova', p: 20, r: 150, stun: 2 }, { t: 'buff', dur: 12, mods: { dmgPct: 80, atkSpdPct: 50 } }], 'crown', '#ffd34d', 'Zničující nova a božská síla.', true),

  // ------------------------------------------------------------- DRUID
  S('druid', 1, 'Trnová střela', 1, 9, 2.5, M, [{ t: 'proj', p: 1.4, speed: 280, sprite: 'thorn', el: 'poison', dot: 0.4 }], 'leaf', C.nature, 'Jedovatý trn.'),
  S('druid', 2, 'Omlazení', 2, 15, 16, M, [{ t: 'buff', dur: 8, mods: { regenPct: 3 } }], 'leaf', C.heal, 'Postupně léčí.'),
  S('druid', 3, 'Kořeny', 4, 14, 10, M, [{ t: 'nova', p: 0.8, r: 70, stun: 2 }], 'tree', '#8b5a2b', 'Kořeny uvězní nepřátele.'),
  S('druid', 4, 'Hurikán', 6, 40, 40, M, [{ t: 'field', r: 80, dur: 8, p: 1.4, follow: true, el: 'phys' }], 'tornado', '#cfe8ff', 'Kolem tebe zuří hurikán.', true),
  S('druid', 5, 'Vlci', 8, 25, 25, M, [{ t: 'summon', kind: 'wolf', n: 2, dur: 30 }], 'wolf', '#a0a0a0', 'Vyvolá dva vlky.'),
  S('druid', 6, 'Kůra', 10, 18, 20, M, [{ t: 'buff', dur: 12, mods: { armorPct: 80, regenPct: 1 } }], 'tree', '#8b5a2b', 'Kůže ztvrdne jako kůra.'),
  S('druid', 7, 'Jedovaté spóry', 13, 20, 10, M, [{ t: 'aoe', p: 1, r: 60, delay: 0.3, el: 'poison' }, { t: 'field', r: 60, dur: 6, p: 1.0, el: 'poison' }], 'poison', C.poison, 'Mrak jedovatých spór.'),
  S('druid', 8, 'Měsíční paprsek', 16, 22, 8, M, [{ t: 'aoe', p: 3.2, r: 50, delay: 0.5, el: 'holy', sprite: 'pillar' }], 'moon', '#cfe8ff', 'Paprsek měsíčního světla.'),
  S('druid', 9, 'Medvěd', 19, 35, 40, M, [{ t: 'summon', kind: 'bear', n: 1, dur: 35 }], 'bear', '#8b5a2b', 'Vyvolá mohutného medvěda.'),
  S('druid', 10, 'Hněv přírody', 22, 55, 55, M, [{ t: 'rain', n: 20, p: 2.6, r: 36, delay: 0.07, el: 'poison', sprite: 'thorn' }], 'leaf', C.nature, 'Z nebe prší trny.', true),
  S('druid', 11, 'Tornádo', 26, 25, 8, M, [{ t: 'proj', p: 1.2, pierce: 99, speed: 120, sprite: 'tornado', size: 1.8, dot: 1.2 }], 'tornado', '#cfe8ff', 'Putující tornádo.'),
  S('druid', 12, 'Liány', 30, 25, 14, M, [{ t: 'field', r: 90, dur: 2, pull: true, p: 1, slow: 0.6 }], 'leaf', C.nature, 'Liány stáhnou nepřátele.'),
  S('druid', 13, 'Roj', 35, 30, 10, M, [{ t: 'proj', n: 10, spread: 120, p: 1.2, homing: true, speed: 200, sprite: 'bee', el: 'poison' }], 'leaf', C.light, 'Roj vos.'),
  S('druid', 14, 'Zemětřesení', 40, 35, 12, M, [{ t: 'nova', p: 5, r: 90, stun: 1 }], 'burst', '#8b5a2b', 'Otřese zemí.'),
  S('druid', 15, 'Strážce lesa', 45, 70, 70, M, [{ t: 'summon', kind: 'treant', n: 1, dur: 40 }], 'tree', C.nature, 'Vyvolá obřího enta.', true),
  S('druid', 16, 'Sluneční záře', 50, 35, 14, M, [{ t: 'nova', p: 4.5, r: 90, el: 'holy' }, { t: 'heal', heal: 0.2 }], 'sun', C.light, 'Záře slunce léčí a spaluje.'),
  S('druid', 17, 'Krupobití', 56, 40, 14, M, [{ t: 'rain', n: 16, p: 3, r: 32, delay: 0.06, el: 'ice' }], 'ice', C.ice, 'Ledové kroupy.'),
  S('druid', 18, 'Smečka', 62, 50, 45, M, [{ t: 'summon', kind: 'wolf', n: 5, dur: 30 }], 'wolf', '#cfcfcf', 'Vyvolá velkou smečku.'),
  S('druid', 19, 'Dech hvozdu', 70, 45, 16, M, [{ t: 'field', r: 110, dur: 6, p: 2.5, el: 'poison', follow: true }], 'tree', C.nature, 'Les dýchá smrt na nepřátele.'),
  S('druid', 20, 'Gaia', 80, 120, 100, M, [{ t: 'heal', heal: 1 }, { t: 'rain', n: 26, p: 5, r: 40, delay: 0.05, el: 'poison', sprite: 'thorn' }, { t: 'summon', kind: 'treant', n: 2, dur: 25 }], 'tree', '#7fff7f', 'Probudí sílu samotné země.', true),

  // ------------------------------------------------------------- MNICH
  S('monk', 1, 'Úder dlaní', 1, 7, 3, W, [{ t: 'melee', p: 2.3, arc: 80, range: 36, knock: 40 }], 'fist', C.light, 'Úder dlaní odhodí nepřítele.'),
  S('monk', 2, 'Vnitřní klid', 2, 12, 14, W, [{ t: 'heal', heal: 0.18 }], 'heart', C.heal, 'Meditace tě vyléčí.'),
  S('monk', 3, 'Létající kop', 4, 12, 6, W, [{ t: 'dash', dist: 100, p: 2 }], 'dash', C.light, 'Kop ve skoku.'),
  S('monk', 4, 'Sto pěstí', 6, 35, 35, W, [{ t: 'melee', p: 1.1, arc: 120, range: 42, hits: 10 }], 'fist', C.light, 'Smršť stovky úderů.', true),
  S('monk', 5, 'Rázová dlaň', 8, 15, 6, W, [{ t: 'proj', p: 2, pierce: 99, speed: 260, sprite: 'wave' }], 'wave', C.light, 'Vlna chi.'),
  S('monk', 6, 'Diamantová kůže', 10, 18, 20, W, [{ t: 'shield', heal: 0.35, dur: 6 }], 'shield', '#bff3ff', 'Neprůstřelná kůže.'),
  S('monk', 7, 'Vír kopů', 13, 20, 9, W, [{ t: 'whirl', dur: 2, r: 40, p: 1.0 }], 'whirl', C.light, 'Točivé kopy.'),
  S('monk', 8, 'Výbuch chi', 16, 22, 10, W, [{ t: 'nova', p: 3, r: 70, knock: 60 }], 'burst', C.light, 'Výbuch vnitřní energie.'),
  S('monk', 9, 'Rychlost větru', 19, 20, 22, W, [{ t: 'buff', dur: 10, mods: { move: 40, atkSpdPct: 35, dodge: 15 } }], 'wing', '#cfe8ff', 'Rychlost jako vítr.'),
  S('monk', 10, 'Dračí dech', 22, 50, 50, W, [{ t: 'proj', n: 15, spread: 60, p: 2, speed: 260, sprite: 'fire', el: 'fire', range: 140 }], 'fire', C.fire, 'Chrlí oheň jako drak.', true),
  S('monk', 11, 'Tlakový bod', 26, 20, 8, W, [{ t: 'melee', p: 4, arc: 70, range: 36, stun: 2 }], 'fist', C.arcane, 'Zásah do tlakového bodu omráčí.'),
  S('monk', 12, 'Sedm úderů', 30, 30, 14, W, [{ t: 'dance', hits: 7, p: 2.2 }], 'fist', C.light, 'Sedm bleskových úderů.'),
  S('monk', 13, 'Duch tygra', 35, 40, 40, W, [{ t: 'summon', kind: 'tiger', n: 1, dur: 30 }], 'claw', '#ff9f1c', 'Vyvolá ducha tygra.'),
  S('monk', 14, 'Zlatý zvon', 40, 30, 25, W, [{ t: 'shield', heal: 0.4, dur: 8 }, { t: 'buff', dur: 8, mods: { thornsPct: 40 } }], 'shield', C.light, 'Zlatý zvon chrání a odráží.'),
  S('monk', 15, 'Osvícení', 45, 60, 70, W, [{ t: 'buff', dur: 15, mods: { dmgPct: 70, atkSpdPct: 50, dodge: 25, regenPct: 2 } }], 'sun', C.light, 'Dosáhne osvícení.', true),
  S('monk', 16, 'Mantra', 50, 30, 25, W, [{ t: 'buff', dur: 12, mods: { regenPct: 3, armorPct: 50 } }], 'cross', C.light, 'Mantra léčení a ochrany.'),
  S('monk', 17, 'Hromová dlaň', 56, 30, 7, W, [{ t: 'chain', n: 6, p: 3, el: 'lightning' }], 'bolt', C.light, 'Blesk z dlaně.'),
  S('monk', 18, 'Nebeský skok', 62, 40, 12, W, [{ t: 'dash', dist: 140, p: 1 }, { t: 'nova', p: 6, r: 80, el: 'holy' }], 'wing', C.holy, 'Skok z nebes.'),
  S('monk', 19, 'Pěst boha', 70, 50, 16, W, [{ t: 'aoe', p: 12, r: 70, delay: 0.6, el: 'holy', sprite: 'pillar' }], 'fist', '#fff', 'Obří pěst z nebes.'),
  S('monk', 20, 'Nirvána', 80, 120, 100, W, [{ t: 'nova', p: 25, r: 170, el: 'holy' }, { t: 'heal', heal: 1 }], 'sun', '#fff', 'Absolutní harmonie.', true),

  // ------------------------------------------------------------- ŠAMAN
  S('shaman', 1, 'Blesk', 1, 9, 2.5, M, [{ t: 'chain', n: 3, p: 1.3, el: 'lightning' }], 'bolt', C.light, 'Blesk přeskočí na 3 cíle.'),
  S('shaman', 2, 'Léčivý totem', 2, 18, 20, M, [{ t: 'totem', kind: 'heal', dur: 10 }], 'totem', C.heal, 'Totem léčí v okolí.'),
  S('shaman', 3, 'Hromový úder', 4, 14, 8, M, [{ t: 'nova', p: 1.6, r: 65, stun: 1, el: 'lightning' }], 'bolt', C.light, 'Hromová nova omráčí.'),
  S('shaman', 4, 'Bouřkový totem', 6, 40, 40, M, [{ t: 'totem', kind: 'storm', dur: 14, p: 1.8 }], 'totem', C.light, 'Totem bije blesky do nepřátel.', true),
  S('shaman', 5, 'Ohnivý totem', 8, 22, 18, M, [{ t: 'totem', kind: 'fire', dur: 12, p: 1.1 }], 'totem', C.fire, 'Totem metá ohnivé koule.'),
  S('shaman', 6, 'Duchovní štít', 10, 20, 20, M, [{ t: 'shield', heal: 0.35, dur: 8 }], 'shield', C.ice, 'Štít předků.'),
  S('shaman', 7, 'Řetězový blesk', 13, 20, 5, M, [{ t: 'chain', n: 6, p: 1.9, el: 'lightning' }], 'bolt', C.light, 'Silný řetězový blesk.'),
  S('shaman', 8, 'Lávová koule', 16, 20, 7, M, [{ t: 'proj', p: 2.6, explode: 50, speed: 240, sprite: 'fire', el: 'fire', size: 1.4 }], 'fire', C.fire, 'Koule lávy.'),
  S('shaman', 9, 'Duchovní vlci', 19, 30, 35, M, [{ t: 'summon', kind: 'spiritWolf', n: 2, dur: 30 }], 'wolf', C.ice, 'Vyvolá duchovní vlky.'),
  S('shaman', 10, 'Ohnivý elementál', 22, 55, 60, M, [{ t: 'summon', kind: 'fireElemental', n: 1, dur: 35 }], 'fire', C.fire, 'Vyvolá elementála ohně.', true),
  S('shaman', 11, 'Zemětřesení', 26, 30, 14, M, [{ t: 'rain', n: 10, p: 2.8, r: 36, delay: 0.1 }], 'burst', '#8b5a2b', 'Otřesy země.'),
  S('shaman', 12, 'Ledový totem', 30, 25, 20, M, [{ t: 'totem', kind: 'ice', dur: 12, p: 0.8 }], 'totem', C.ice, 'Totem zpomaluje a zraňuje.'),
  S('shaman', 13, 'Kulový blesk', 35, 30, 10, M, [{ t: 'proj', p: 1, speed: 80, sprite: 'bolt', el: 'lightning', size: 2, pierce: 99, dot: 2 }], 'bolt', C.light, 'Pomalá koule blesků.'),
  S('shaman', 14, 'Hrom', 40, 35, 10, M, [{ t: 'aoe', p: 6, r: 60, delay: 0.5, el: 'lightning' }], 'bolt', '#fff', 'Mohutný úder hromu.'),
  S('shaman', 15, 'Bouře', 45, 70, 70, M, [{ t: 'rain', n: 26, p: 3.5, r: 40, delay: 0.06, el: 'lightning' }], 'bolt', C.light, 'Bouře nad bojištěm.', true),
  S('shaman', 16, 'Krvežíznivost', 50, 30, 30, M, [{ t: 'buff', dur: 12, mods: { atkSpdPct: 50, spellDmg: 30, move: 15 } }], 'drop', C.blood, 'Zvýší rychlost a sílu kouzel.'),
  S('shaman', 17, 'Lávový proud', 56, 40, 14, M, [{ t: 'field', r: 40, dur: 6, p: 2.4, el: 'fire', line: true }], 'fire', C.fire, 'Proud lávy.'),
  S('shaman', 18, 'Předkové', 62, 50, 45, M, [{ t: 'summon', kind: 'ancestor', n: 3, dur: 30 }], 'ghost', C.ice, 'Vyvolá duchy předků.'),
  S('shaman', 19, 'Výboj', 70, 55, 18, M, [{ t: 'nova', p: 10, r: 120, el: 'lightning', stun: 1.5 }], 'bolt', '#fff', 'Masivní elektrický výboj.'),
  S('shaman', 20, 'Hněv bohů', 80, 120, 100, M, [{ t: 'rain', n: 30, p: 5, r: 44, delay: 0.05, el: 'lightning' }, { t: 'chain', n: 15, p: 5, el: 'lightning' }], 'bolt', '#fff', 'Bohové sesílají svůj hněv.', true),

  // ------------------------------------------------------------- UNIVERZÁLNÍ
  S('universal', 1, 'Léčení', 1, 15, 14, M, [{ t: 'heal', heal: 0.3 }], 'plus', C.heal, 'Vyléčí 30 % zdraví.'),
  S('universal', 2, 'Sprint', 5, 10, 14, M, [{ t: 'buff', dur: 4, mods: { move: 60 } }], 'wing', '#cfe8ff', 'Krátce výrazně zrychlí pohyb.'),
  S('universal', 3, 'Mrknutí', 10, 12, 10, M, [{ t: 'blink', range: 120 }], 'ghost', C.arcane, 'Teleport ve směru pohybu.'),
  S('universal', 4, 'Ochranná bariéra', 15, 20, 22, M, [{ t: 'shield', heal: 0.3, dur: 8 }], 'shield', C.shield, 'Štít pohlcující poškození.'),
  S('universal', 5, 'Regenerace', 20, 20, 25, M, [{ t: 'buff', dur: 10, mods: { regenPct: 4 } }], 'leaf', C.heal, 'Rychlá regenerace zdraví.'),
  S('universal', 6, 'Obnova many', 25, 0, 40, M, [{ t: 'mana', heal: 0.5 }], 'drop', '#4aa3ff', 'Obnoví 50 % many.'),
  S('universal', 7, 'Kamenná kůže', 30, 20, 28, M, [{ t: 'buff', dur: 10, mods: { armorPct: 100 } }], 'shield', '#9aa3ad', 'Zdvojnásobí brnění.'),
  S('universal', 8, 'Velké léčení', 40, 35, 30, M, [{ t: 'heal', heal: 0.65 }], 'plus', '#9dffbc', 'Vyléčí 65 % zdraví.'),
  S('universal', 9, 'Odražení', 50, 25, 18, M, [{ t: 'nova', p: 1, r: 80, knock: 90, stun: 1 }], 'burst', '#cfe8ff', 'Odhodí všechny nepřátele kolem.'),
  S('universal', 10, 'Zrychlení času', 60, 40, 60, M, [{ t: 'buff', dur: 10, mods: { cdrRate: 1 } }], 'clock', C.arcane, 'Kouzla se přebíjí dvakrát rychleji.'),
  S('universal', 11, 'Druhý dech', 70, 30, 90, M, [{ t: 'heal', heal: 1 }, { t: 'mana', heal: 1 }], 'heart', '#ff8fb1', 'Plně obnoví zdraví i manu.'),
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export function spellsForClass(cls: ClassId | 'universal') {
  return SPELLS.filter((s) => s.cls === cls).sort((a, b) => a.lvl - b.lvl);
}

export const MAX_SPELL_RANK = 10;
