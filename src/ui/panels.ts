import type { MerchantStock } from '../scenes/GameScene';
import { parseWeaponSpell } from '../data/weaponspells';
import { $, el, esc, keepScrollOn } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import {
  BASE_BY_ID,
  mainBonus,
  RARITIES,
  CATEGORY_NAMES,
  SPECIAL_BY_ID,
  formatStat,
  itemStats,
  weaponDamage,
  itemValue,
  buyPrice,
  upgradeCost,
  enchantCost,
  salvageResult,
  rollEnchant,
  MAX_UPGRADE,
  isTwoHanded,
  itemIcon,
  scaledAffix,
  generateItem,
  generateSetItem,
  BaseType,
  itemColor,
  rerollCost,
  rerollOptions,
  upgradeAffixMult,
  PRIMAL,
} from '../data/items';
import { setOf, equippedSetCounts, SETS, SET_MIN_FLOOR } from '../data/sets';
import { Item, Slot, SLOT_NAMES, ATTR_KEYS, ATTR_NAMES, ATTR_DESC, AttrKey, ClassId } from '../data/types';
import { SPELL_BY_ID, spellsForClass, SpellDef, MAX_SPELL_RANK } from '../data/spells';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { derive, equipItem, unequip, addToInventory, spellRank, canInvest, changeClass, classChangeCost, SaveData, freeSlots, newCharacterAttrs, maxStat, bumpStat, STASH_SIZE, storyBonusPct, petsOf, gemPouch, addGem, returnGems, saveGame, runePouch, addRune, addSpellRune, freeTalentPoints, multiTalentSpent, heroTitle, LEECH_CAP } from '../systems/state';
import { GEMS, GEM_TIERS, GEM_MAX_TIER, GEM_PLACE_NAME, GemPlace, gemPlace, gemEffect, gemIcon, gemName, parseGem, gemKey, maxSockets, drillCost, combineCost } from '../data/gems';
import { PETS, PET_BY_ID, PetId, petLevel, petFloorsToNext, petBonusText, petTitle, PET_MAX_LEVEL, PET_FLOORS_PER_LEVEL } from '../data/pets';
import { difficultyOf } from '../data/difficulty';
import { MERCS, MERC_BY_ROLE, MERC_SLOTS, MERC_ORDERS, MercSlot, MercRole, MercOrder, mercFits, mercSlotFor, mercPrice, mercLook, mercStats } from '../data/mercs';
import type { RivalMood } from '../data/rivals';
import { TRANSMUTE_N, transmuteOdds, transmuteCost, transmute } from '../data/transmute';
import { CURSE_BY_ID, curseStats } from '../data/curses';
import { POWER_BY_ID, UNIQUE_BY_ID, UNIQUES } from '../data/uniques';
import { parseBossKey, guardianName } from '../data/bossweapons';
import { discoverItem } from '../data/codex';
import { RUNES, RUNE_TIERS, RUNE_MAX_TIER, parseRune, runeName, runeIcon, runeDesc, runeKey, runeSlots, runeSlotCount, runeCombineCost, RuneType } from '../data/runes';
import { SPELL_RUNE_BY_ID, spellRuneIcon } from '../data/spellrunes';
import { TALENT_TREES, TALENT_GATE, TalentDef, COND_NAME, spentIn, canLearn, talentPoints, TALENT_CLASS } from '../data/talents';
import { MULTI_LEVEL, MULTI_COST, MULTI_TALENT_CAP, multiTitle } from '../data/multiclass';
import type { Mercenary } from '../game/merc';
import { MAT_INFO, MatKey, UPGRADE_KEEP } from '../game/loot';
import { stashSize, respecMult, forgeMods, buildingLevel } from '../data/village';
import { sfx, settings, saveSettings, LootRule, vibrate } from '../systems/audio';
import { bus } from '../systems/events';

type UIM = typeof UIType;

const EQUIP_LEFT: Slot[] = ['main', 'helmet', 'chest', 'pants', 'boots'];
const EQUIP_RIGHT: Slot[] = ['off', 'amulet', 'bracer', 'belt', 'ring1', 'ring2'];
// equip buttons of items that fit two slots
const EQUIP_TO: Partial<Record<Slot, string>> = { main: 'Do pravé ruky', off: 'Do levé ruky', ring1: 'Prsten 1', ring2: 'Prsten 2' };

type MysteryId = 'weapon' | 'armor' | 'jewel' | 'any';
/** how many mystery bags one merchant has */
const MYSTERY_PER_MERCHANT = 4;
const MYSTERY: { id: MysteryId; name: string; icon: string }[] = [
  { id: 'weapon', name: 'Zbraň tvého stylu', icon: 'ic_sword_t3' },
  { id: 'armor', name: 'Zbroj', icon: 'ic_chest_t3' },
  { id: 'jewel', name: 'Šperk', icon: 'ic_ring_t3' },
  { id: 'any', name: 'Cokoliv', icon: 'chest_gold' },
];

/** "1 kámen", "3 kameny", "7 kamenů" */
const stonesText = (n: number) => `${n} ${n === 1 ? 'kámen' : n < 5 ? 'kameny' : 'kamenů'}`;

// Where the selected item lives
type Sel = { from: 'inv'; idx: number } | { from: 'eq'; slot: Slot } | { from: 'shop'; idx: number } | null;

export class Panels {
  ui: UIM;
  sel: Sel = null;
  /** inventory places marked together (a long press starts it) to be sold or salvaged at once */
  multi: Set<number> | null = null;
  constructor(ui: UIM) {
    this.ui = ui;
    // the gold and materials in open panel headers follow every purchase, upgrade or reward
    window.setInterval(() => this.syncHeadMats(), 400);
    window.addEventListener('resize', () =>
      requestAnimationFrame(() => this.ui.root?.querySelectorAll<HTMLElement>('.headmats').forEach((b) => b.parentElement && this.fitHead(b.parentElement))),
    );
    // a panel drawn anew (a point added, an item upgraded) stays scrolled where it was
    keepScrollOn(this, ['runes', 'gems', 'inventory', 'character', 'pets', 'merc', 'transmute', 'spells', 'talentsView', 'merchant', 'forge', 'stash', 'classChange']);
  }

  private headSig = '';

  private syncHeadMats() {
    const sc = this.ui.scene;
    const boxes = this.ui.root?.querySelectorAll<HTMLElement>('.headmats');
    if (!sc?.save || !boxes?.length) return;
    const s = sc.save;
    const sig = [s.gold, s.mats.hpPotion, s.mats.mpPotion, s.mats.lockpick, s.mats.stone, s.mats.dust, JSON.stringify(gemPouch(s)), JSON.stringify(runePouch(s))].join('|');
    if (sig === this.headSig) return;
    this.headSig = sig;
    const html = this.matsHtml();
    boxes.forEach((b) => {
      b.innerHTML = html;
      if (b.parentElement) this.fitHead(b.parentElement);
    });
  }

  get sc() {
    return this.ui.scene!;
  }
  get save(): SaveData {
    return this.ui.scene!.save;
  }

  open(name: string) {
    this.sel = null;
    this.multi = null;
    if (name === 'inventory') this.inventory();
    else if (name === 'character') this.character();
    else if (name === 'spells') this.spells();
    else if (name === 'pets') this.pets();
    else if (name === 'gems') this.gems();
    else if (name === 'merc') this.merc();
  }

  frame(title: string, tabs: { id: string; label: string }[] = [], active = '') {
    const p = el(`<div class="panel framed">
      <div class="head"><h2>${esc(title)}</h2><div class="tabs">${tabs.map((t) => `<button class="tab ${t.id === active ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div><button class="close">✕</button></div>
      <div class="body"></div></div>`);
    $('.close', p).addEventListener('click', () => {
      sfx('ui');
      this.ui.closeOverlay();
    });
    // the gem pouch in the materials bar opens the gems over the panel
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-a=gemchip]')) {
        sfx('ui');
        this.gems(undefined, true);
      } else if (t.closest('[data-a=runechip]')) {
        sfx('ui');
        this.runes(undefined, true);
      }
    });
    return p;
  }

  // ------------------------------------------------------------------ helpers
  slotHtml(it: Item | null | undefined, extra = '', label = '', price?: number, better = false) {
    if (!it) return `<div class="slot ${extra}">${label ? `<span class="lbl">${esc(label)}</span>` : ''}</div>`;
    const socks = it.sockets?.length ? `<span class="socks">${it.sockets.map((g) => `<i${g ? ` style="background:${parseGem(g)?.def.color}"` : ''}></i>`).join('')}</span>` : '';
    const lock = it.locked ? '<span class="lockmark">🔒</span>' : '';
    const curse = it.curse ? '<span class="cursemark">☠</span>' : '';
    const spell = it.spell ? '<span class="spellmark">✧</span>' : '';
    return `<div class="slot r${it.rarity}${it.set ? ' set' : ''}${it.boss ? ' bossw' : ''}${it.curse ? ' cursed' : ''} ${extra}"><img src="${iconURL(itemIcon(it), 48)}">${it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}${better ? '<span class="better">▲</span>' : ''}${price !== undefined ? `<span class="price">${price}</span>` : ''}${socks}${lock}${curse}${spell}</div>`;
  }

  /** gold and materials in a panel's header, next to its title and tabs (the body keeps the room) */
  headMats(p: HTMLElement) {
    const head = p.querySelector<HTMLElement>(':scope > .head');
    if (!head) return;
    let hm = head.querySelector<HTMLElement>('.headmats');
    if (!hm) {
      hm = el('<div class="headmats"></div>');
      head.insertBefore(hm, head.querySelector('.headacts') ?? $('.close', head));
    }
    hm.innerHTML = this.matsHtml();
    requestAnimationFrame(() => this.fitHead(head));
  }

  /** a crowded header squeezes until the materials fit: smaller tabs and materials first, then without the title */
  fitHead(head: HTMLElement) {
    const hm = head.querySelector<HTMLElement>(':scope > .headmats');
    head.classList.remove('tight', 'notitle');
    if (!hm || !head.isConnected) return;
    const h2 = head.querySelector<HTMLElement>(':scope > h2');
    const cut = (e: HTMLElement | null) => !!e && e.scrollWidth > e.clientWidth + 1;
    if (!cut(hm) && !cut(h2)) return;
    head.classList.add('tight');
    // a title cut down to a stub says nothing, the tabs tell where you are
    if (head.querySelector('.tabs .tab') && (cut(hm) || (cut(h2) && h2!.clientWidth < 90))) head.classList.add('notitle');
  }

  matsHtml() {
    const s = this.save;
    const m = (k: MatKey) => `<span title="${MAT_INFO[k].name}"><img src="${iconURL(MAT_INFO[k].icon, 32)}">${s.mats[k]}</span>`;
    // the gem pouch: the best gem in it and how many there are (tap: the gems panel)
    const pouch = gemPouch(s);
    const keys = Object.keys(pouch).filter((k) => pouch[k] > 0 && parseGem(k));
    const best = keys.sort((a, b) => parseGem(b)!.tier - parseGem(a)!.tier)[0] ?? gemKey('ruby', 1);
    const n = keys.reduce((a, k) => a + pouch[k], 0);
    const gems = `<button class="matbtn" data-a="gemchip" title="Drahokamy"><img src="${iconURL(gemIcon(best), 30)}"><b>${n}</b></button>`;
    const rp = runePouch(s);
    const rkeys = Object.keys(rp).filter((k) => rp[k] > 0 && parseRune(k));
    const rbest = rkeys.sort((a, b) => parseRune(b)!.tier - parseRune(a)!.tier)[0] ?? runeKey('fire', 1);
    const runes = `<button class="matbtn" data-a="runechip" title="Runy"><img src="${iconURL(runeIcon(rbest), 30)}"><b>${rkeys.reduce((a, k) => a + rp[k], 0)}</b></button>`;
    return `<div class="mats"><span><img src="${iconURL('ic_gold', 32)}"><b style="color:#ffd76a">${s.gold.toLocaleString('cs-CZ')}</b></span>${m('hpPotion')}${m('mpPotion')}${m('lockpick')}${m('stone')}${m('dust')}${gems}${runes}</div>`;
  }

  /** icon, name and kind of an item */
  itemHeadHtml(it: Item) {
    const base = BASE_BY_ID[it.base];
    const rar = RARITIES[it.rarity];
    return `<div class="ihead"><div class="iicon r${it.rarity}${it.set ? ' set' : ''}${it.boss ? ' bossw' : ''}"><img src="${iconURL(itemIcon(it), 48)}"></div><div class="iname"><h3 style="color:${itemColor(it)}">${it.upgrade ? '+' + it.upgrade + ' ' : ''}${esc(it.name)}</h3><div class="sub">${it.set ? 'Předmět sady' : it.boss ? `Zbraň strážce • ${rar.name}` : rar.name} • ${CATEGORY_NAMES[base.cat]} • úroveň ${it.ilvl}</div></div></div>`;
  }

  /** everything an item does */
  itemStatsHtml(it: Item, socketLines = true) {
    const base = BASE_BY_ID[it.base];
    let h = '';
    const uq = it.unique ? UNIQUE_BY_ID[it.unique] : null;
    if (uq) h += `<div class="lore">„${esc(uq.lore)}“</div>`;
    const bw = parseBossKey(it.boss);
    if (bw) h += `<div class="lore bosslore"><b>☠ ${esc(guardianName(bw.arms.id))}</b> „${esc(bw.arms.lore)}“</div>`;
    if (it.dmgMin !== undefined) {
      const [a, b] = weaponDamage(it);
      const kind = base.attack === 'melee' ? 'na blízko' : base.attack === 'ranged' ? 'na dálku' : 'magická';
      h += `<div class="main">Poškození: <b>${a}–${b}</b></div><div class="main">Útoků za sekundu: ${base.aps?.toFixed(2).replace('.', ',')} • zbraň ${kind}</div>`;
      h += `<div class="hint">Dosah: ${base.attack === 'melee' ? 'krátký (' + Math.round(((base.range ?? 0) / 16) * 10) / 10 + ' pole)' : Math.round((base.range ?? 0) / 16) + ' polí'}</div>`;
      const mb = mainBonus(it);
      if (mb) h += `<div class="mainb"><span>Hlavní bonus</span> ${formatStat(mb.key, mb.value)}</div>`;
      if (base.trait) h += `<div class="trait">➤ ${esc(base.trait)}</div>`;
    }
    const st = itemStats(it);
    if (st.armor) h += `<div class="main">Brnění: <b>${st.armor}</b></div>`;
    if (st.block) h += `<div class="main">Šance na blok: ${st.block} %</div>`;
    if (base.implicit) for (const [k, v] of Object.entries(base.implicit)) h += `<div class="aff" style="color:#c9c9c9">${formatStat(k as any, v as number)}</div>`;
    const am = 1 + 0.04 * it.upgrade;
    for (const a of it.affixes) h += `<div class="aff">${formatStat(a.key, scaledAffix(a.key, a.value, am))}</div>`;
    if (it.enchant) h += `<div class="ench">✧ Očarování: ${formatStat(it.enchant.key, scaledAffix(it.enchant.key, it.enchant.value, am))}</div>`;
    for (const sp of it.specials) h += POWER_BY_ID[sp] ? `<div class="power">✦ ${esc(POWER_BY_ID[sp].desc)}</div>` : `<div class="spec">★ ${esc(SPECIAL_BY_ID[sp]?.desc ?? sp)}</div>`;
    const ws = parseWeaponSpell(it.spell);
    if (ws) h += `<div class="wspell"><b style="color:${ws.eff.color}">✧ ${esc(ws.eff.name)}</b> – ${esc(ws.trig.text)}<div class="wsdesc">${esc(ws.eff.desc)}</div></div>`;
    if (socketLines && it.sockets?.length) {
      const place = gemPlace(base.cat);
      for (const g of it.sockets) {
        const e = g ? gemEffect(g, place) : null;
        h += g && e ? `<div class="aff" style="color:${parseGem(g)?.def.color}">◆ ${gemName(g)}: ${formatStat(e.key, e.value)}</div>` : `<div class="aff" style="color:#9a94a8">◇ Volný soket</div>`;
      }
    }
    if (it.curse && CURSE_BY_ID[it.curse]) {
      const c = CURSE_BY_ID[it.curse];
      const cs = curseStats(it.curse, it.ilvl);
      h += it.tamed
        ? `<div class="curse tamed"><b>☠ Zkrocené prokletí: ${esc(c.name)}</b>${Object.entries(cs.bonus)
            .map(([k, v]) => `<div class="cbon">${formatStat(k as any, Math.round((v as number) * 0.6))}</div>`)
            .join('')}<div class="hint">Kletba je zkrocená: zbyla jí část síly a žádná daň.</div></div>`
        : `<div class="curse"><b>☠ Prokletí: ${esc(c.name)}</b>${Object.entries(cs.bonus)
            .map(([k, v]) => `<div class="cbon">${formatStat(k as any, v as number)}</div>`)
            .join('')}${Object.entries(cs.malus)
            .map(([k, v]) => `<div class="cmal">${formatStat(k as any, v as number)}</div>`)
            .join('')}${c.malusText ? `<div class="cmal">${esc(c.malusText)}</div>` : ''}</div>`;
    }
    if (socketLines && runeSlotCount(it)) {
      for (const r of runeSlots(it)) h += r ? `<div class="aff" style="color:${parseRune(r)?.def.color}">ᚱ ${runeName(r)}: ${runeDesc(r)}</div>` : `<div class="aff" style="color:#9a94a8">ᚱ Volný runový soket</div>`;
    }
    h += this.setHtml(it);
    if (base.cat === 'weapon2h') h += `<div class="hint">Obouruční – zabírá obě ruce</div>`;
    if (base.cat === 'weapon1h') h += `<div class="hint">Jednoruční – do pravé i levé ruky (se štítem nebo dvě zbraně)</div>`;
    h += `<div class="hint" style="margin-top:4px">Prodejní cena: <span style="color:#ffd76a">${itemValue(it)}</span> zlata</div>`;
    return h;
  }

  /** the anvil's re-roll box: one property of an item can be swapped for one of two new ones */
  rerollBoxHtml(it: Item) {
    if (!it.affixes.length) return '';
    const s = this.save;
    const rc = rerollCost(it);
    const can = s.gold >= rc.gold && s.mats.dust >= rc.dust;
    const am = upgradeAffixMult(it);
    return `<div class="box" style="margin-top:8px"><b style="color:#ffb347">Přebroušení vlastnosti</b>
      <div class="hint">Vyber vlastnost: nabídnou se ti dvě nové, nebo si necháš původní. ${it.reroll !== undefined ? 'U tohoto předmětu jde měnit už jen vlastnost zvolená napoprvé.' : 'U každého předmětu jde měnit jen jedna vlastnost – ta, kterou zvolíš poprvé.'}</div>
      <div class="rrlist">${it.affixes.map((a, i) => `<button class="btn small rr ${it.reroll === i ? 'gold' : ''}" data-rr="${i}" ${(it.reroll !== undefined && it.reroll !== i) || !can ? 'disabled' : ''}>${formatStat(a.key, scaledAffix(a.key, a.value, am))}</button>`).join('')}</div>
      <div class="statline"><span>Cena</span><b>${rc.gold} zl. + ${rc.dust}× prach</b></div></div>`;
  }

  /** pays, rolls two new properties and lets the player pick (or keep the old one) */
  rerollAffix(it: Item, i: number, after: () => void) {
    const s = this.save;
    const rc = rerollCost(it);
    if (s.gold < rc.gold || s.mats.dust < rc.dust || (it.reroll !== undefined && it.reroll !== i) || !it.affixes[i]) return;
    s.gold -= rc.gold;
    s.mats.dust -= rc.dust;
    it.reroll = i;
    it.rerolls = (it.rerolls ?? 0) + 1;
    const am = upgradeAffixMult(it);
    const old = it.affixes[i];
    const opts = [old, ...rerollOptions(it, i)];
    const p = el(`<div class="panel small"><div class="head"><h2>Přebroušení</h2><button class="close">✕</button></div>
      <div style="padding:10px"><div class="hint" style="margin-bottom:6px">${esc(it.name)} – vyber, co bude místo „${formatStat(old.key, scaledAffix(old.key, old.value, am))}“:</div>
      <div class="gemlist">${opts.map((a, k) => `<button class="spcard gempick" data-opt="${k}"><div><div class="nm" style="color:${k ? '#9dff9d' : '#ddd'}">${formatStat(a.key, scaledAffix(a.key, a.value, am))}</div><div class="lv2">${k ? 'nová vlastnost' : 'ponechat původní'}</div></div></button>`).join('')}</div></div></div>`);
    const close = this.ui.dialog(p);
    const pick = (k: number) => {
      it.affixes[i] = opts[k];
      if (k) {
        sfx('upgrade');
        this.ui.toast(`Přebroušeno: ${formatStat(opts[k].key, scaledAffix(opts[k].key, opts[k].value, am))}`, '#ffb347');
      }
      this.sc.player.recalc();
      close();
      after();
    };
    // closing keeps the old property (the price is paid either way)
    $('.close', p).addEventListener('click', () => pick(0));
    p.querySelectorAll<HTMLElement>('[data-opt]').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.opt!)));
  }

  /** a set piece: the set, which pieces are worn and the bonuses (lit up when active) */
  setHtml(it: Item) {
    const so = setOf(it);
    if (!so) return '';
    const n = equippedSetCounts(this.save.equip)[so.def.id] ?? 0;
    const worn = new Set(
      Object.values(this.save.equip)
        .map((x) => setOf(x))
        .filter((x) => x?.def.id === so.def.id)
        .map((x) => x!.piece),
    );
    let h = `<div class="setbox"><div class="setname">${esc(so.def.name)} <span>(${n}/${so.def.pieces.length})</span></div>`;
    h += so.def.pieces.map((p, i) => `<div class="setpiece ${worn.has(i) ? 'on' : ''}">${worn.has(i) ? '✓' : '·'} ${esc(p.name)}</div>`).join('');
    for (const b of so.def.bonuses) {
      const parts = [...Object.entries(b.stats ?? {}).map(([k, v]) => formatStat(k as any, v as number)), ...(b.specials ?? []).map((sp) => '★ ' + esc(SPECIAL_BY_ID[sp]?.desc ?? sp))];
      h += `<div class="setbonus ${n >= b.n ? 'on' : ''}">(${b.n}) ${parts.join(', ')}</div>`;
    }
    return h + '</div>';
  }

  /** the detail column: the name, the actions right under it, then the comparison and the item's text */
  itemDetailHtml(it: Item, actions = '', compare = false, sockets = false) {
    return this.itemHeadHtml(it) + (actions ? `<div class="iacts">${actions}</div>` : '') + (sockets ? this.socketsHtml(it) + this.runeSocketsHtml(it) : '') + (compare ? this.compareHtml(it) : '') + `<div class="orn"><span>Vlastnosti</span></div><div class="istats">${this.itemStatsHtml(it, !sockets)}</div>`;
  }

  /** the sockets of an item as buttons: a set gem (tap: take it out) or an empty socket (tap: set a gem) */
  socketsHtml(it: Item) {
    if (!it.sockets?.length) return '';
    const place = gemPlace(BASE_BY_ID[it.base].cat);
    return `<div class="orn"><span>Sokety</span></div><div class="sockets">${it.sockets
      .map((g, i) => {
        if (!g) return `<button class="sock empty" data-a="sock" data-sock="${i}"><img src="${iconURL('socket_empty', 30)}"><span>Volný soket<small>vsadit drahokam</small></span></button>`;
        const e = gemEffect(g, place)!;
        return `<button class="sock" data-a="sock" data-sock="${i}"><img src="${iconURL(gemIcon(g), 30)}"><span style="color:${parseGem(g)!.def.color}">${gemName(g)}<small>${formatStat(e.key, e.value)} • vyjmout</small></span></button>`;
      })
      .join('')}</div>`;
  }

  /** the rune sockets of a weapon as buttons: a set rune (tap: take it out) or an empty one (tap: set a rune) */
  runeSocketsHtml(it: Item) {
    if (!runeSlotCount(it)) return '';
    return `<div class="orn"><span>Runy</span></div><div class="sockets">${runeSlots(it)
      .map((r, i) => {
        if (!r) return `<button class="sock empty" data-a="rsock" data-sock="${i}"><img src="${iconURL('rune_empty', 30)}"><span>Runový soket<small>vsadit runu</small></span></button>`;
        return `<button class="sock" data-a="rsock" data-sock="${i}"><img src="${iconURL(runeIcon(r), 30)}"><span style="color:${parseRune(r)!.def.color}">${runeName(r)}<small>${runeDesc(r)} • vyjmout</small></span></button>`;
      })
      .join('')}</div>`;
  }

  /** a rune socket was tapped: take the rune out or pick one to set */
  runeSocketClick(it: Item, i: number, after: () => void) {
    const s = this.save;
    const slots = runeSlots(it);
    const r = slots[i];
    if (r === undefined) return;
    if (r) {
      slots[i] = null;
      addRune(s, r);
      sfx('ui');
      this.ui.toast(`${runeName(r)} je zpět ve váčku`, parseRune(r)?.def.color ?? '#fff');
      after();
      return;
    }
    const pouch = runePouch(s);
    const keys = Object.keys(pouch)
      .filter((k) => pouch[k] > 0 && parseRune(k))
      .sort((a, b) => parseRune(b)!.tier - parseRune(a)!.tier);
    const p = el(`<div class="panel small"><div class="head"><h2>Vsadit runu</h2><button class="close">✕</button></div>
      <div style="padding:10px">${
        keys.length
          ? `<div class="gemlist">${keys.map((k) => `<button class="spcard gempick" data-rune="${k}"><img src="${iconURL(runeIcon(k), 30)}"><div><div class="nm" style="color:${parseRune(k)!.def.color}">${runeName(k)} <span class="hint">×${pouch[k]}</span></div><div class="lv2">${runeDesc(k)}</div></div></button>`).join('')}</div>`
          : '<p class="hint">Nemáš žádné runy. Padají ze strážců, šampionů, zlatých skřetů a truhel.</p>'
      }</div></div>`);
    const close = this.ui.dialog(p);
    $('.close', p).addEventListener('click', () => close());
    p.querySelectorAll<HTMLElement>('[data-rune]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.rune!;
        if (!pouch[k] || slots[i]) return close();
        addRune(s, k, -1);
        slots[i] = k;
        sfx('upgrade');
        this.ui.toast(`Vsazeno: ${runeName(k)}`, parseRune(k)!.def.color);
        close();
        after();
      }),
    );
  }

  /** a socket was tapped: take the gem out (it goes back to the pouch) or pick one to set */
  socketClick(it: Item, i: number, after: () => void) {
    const s = this.save;
    const g = it.sockets?.[i];
    if (g === undefined) return;
    if (g) {
      it.sockets![i] = null;
      addGem(s, g);
      sfx('ui');
      this.ui.toast(`${gemName(g)} je zpět ve váčku`, parseGem(g)?.def.color ?? '#fff');
      this.sc.player.recalc();
      after();
      return;
    }
    this.gemPicker(it, i, after);
  }

  /** the gems in the pouch with what each would give in this item */
  gemPicker(it: Item, i: number, after: () => void) {
    const s = this.save;
    const pouch = gemPouch(s);
    const place = gemPlace(BASE_BY_ID[it.base].cat);
    const order = (k: string) => {
      const g = parseGem(k)!;
      return GEMS.indexOf(g.def) * 10 - g.tier;
    };
    const keys = Object.keys(pouch).filter((k) => pouch[k] > 0 && parseGem(k)).sort((a, b) => order(a) - order(b));
    const p = el(`<div class="panel small"><div class="head"><h2>Vsadit drahokam</h2><button class="close">✕</button></div>
      <div style="padding:10px">${
        keys.length
          ? `<div class="hint" style="margin-bottom:6px">Co který drahokam dá ${GEM_PLACE_NAME[place]} (${esc(it.name)}):</div><div class="gemlist">${keys
              .map((k) => {
                const e = gemEffect(k, place)!;
                return `<button class="spcard gempick" data-gem="${k}"><img src="${iconURL(gemIcon(k), 30)}"><div><div class="nm" style="color:${parseGem(k)!.def.color}">${gemName(k)} <span class="hint">×${pouch[k]}</span></div><div class="lv2">${formatStat(e.key, e.value)}</div></div></button>`;
              })
              .join('')}</div>`
          : '<p class="hint">Nemáš žádné drahokamy. Padají z nestvůr (hlavně šampionů), strážců, zlatých skřetů a truhel.</p>'
      }</div></div>`);
    const close = this.ui.dialog(p);
    $('.close', p).addEventListener('click', () => {
      sfx('ui');
      close();
    });
    p.querySelectorAll<HTMLElement>('.gempick').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.gem!;
        if (!pouch[k] || !it.sockets || it.sockets[i]) return close();
        addGem(s, k, -1);
        it.sockets[i] = k;
        bumpStat(s, 'gemsSet');
        sfx('upgrade');
        const e = gemEffect(k, place)!;
        this.ui.toast(`Vsazeno: ${gemName(k)} (${formatStat(e.key, e.value)})`, parseGem(k)!.def.color);
        this.sc.player.recalc();
        close();
        after();
      }),
    );
  }

  // ------------------------------------------------------------------ RUNES
  selRune: string | null = null;

  /** the rune pouch: every rune in every grade, three of a grade join into one of the next */
  runes(host?: HTMLElement, overPanel = false) {
    const p = host ?? this.frame('Runy');
    const body = $('.body', p);
    const s = this.save;
    const pouch = runePouch(s);
    if (!this.selRune || !parseRune(this.selRune)) this.selRune = Object.keys(pouch).find((k) => pouch[k] > 0 && parseRune(k)) ?? runeKey('fire', 1);
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Runy vsadíš do runových soketů zbraní (v detailu zbraně v inventáři nebo u kovadliny). Každá dává zásahům šanci na zvláštní účinek. Tři stejné runy spojíš v jednu silnější.</div>
        <div class="scroll" style="flex:1"><div class="gemgrid">${RUNES.map(
          (r) =>
            `<div class="gemrow"><span class="gname" style="color:${r.color}">${r.name[0].toUpperCase() + r.name.slice(1)}</span>${RUNE_TIERS.map((_, t) => {
              const k = runeKey(r.id, t + 1);
              const n = pouch[k] ?? 0;
              return `<div class="slot gemcell ${n ? '' : 'none'} ${this.selRune === k ? 'sel' : ''}" data-rune="${k}"><img src="${iconURL(runeIcon(k), 30)}"><span class="price">${n ? '×' + n : ''}</span></div>`;
            }).join('')}</div>`,
        ).join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(300px,38%)"></div>`;
    const detail = $('.detail', body);
    const render = () => {
      const k = this.selRune!;
      const r = parseRune(k)!;
      const n = pouch[k] ?? 0;
      const next = r.tier < RUNE_MAX_TIER ? runeKey(r.def.id, r.tier + 1) : null;
      const cost = runeCombineCost(r.tier, this.sc.floor);
      const can = !!next && n >= 3 && s.gold >= cost;
      detail.innerHTML = `<div class="orn"><span>Runa</span></div>
        <div class="petbig"><img src="${iconURL(runeIcon(k), 75)}"></div>
        <div style="text-align:center;font-size:22px;color:${r.def.color}">${runeName(k)}</div>
        <div class="hint" style="text-align:center">ve váčku: ${n}</div>
        <p style="margin:6px 0">Ve zbrani: <b style="color:#9dff9d">${runeDesc(k)}</b> při každém zásahu.</p>
        ${
          next
            ? `<div class="box" style="margin-top:8px"><b style="color:#d08aff">Spojit 3 → 1</b><div class="statline"><span>Vznikne</span><b style="color:${r.def.color}">${runeName(next)}</b></div><div class="statline"><span>Cena</span><b>${cost} zl.</b></div>
              <div class="row eqrow"><button class="btn purple" data-a="join" ${can ? '' : 'disabled'}>Spojit</button></div></div>`
            : '<div class="hint" style="margin-top:8px">Prastará runa je nejsilnější.</div>'
        }`;
      detail.querySelector('[data-a=join]')?.addEventListener('click', () => {
        if (!next || (pouch[k] ?? 0) < 3 || s.gold < cost) return;
        addRune(s, k, -3);
        addRune(s, next);
        s.gold -= cost;
        sfx('upgrade');
        this.ui.toast(`Spojeno: ${runeName(next)}`, r.def.color);
        if ((pouch[k] ?? 0) < 3) this.selRune = next;
        this.runes(p);
      });
    };
    body.querySelectorAll<HTMLElement>('.gemcell').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        this.selRune = c.dataset.rune!;
        body.querySelectorAll('.gemcell').forEach((x) => x.classList.toggle('sel', x === c));
        render();
      }),
    );
    render();
    if (host) return;
    if (overPanel && this.ui.panel) {
      // over another panel (from its materials bar): closing comes back to it, with fresh numbers
      const close = this.ui.dialog(p);
      const x = $('.close', p);
      const nx = x.cloneNode(true) as HTMLElement;
      x.replaceWith(nx);
      nx.addEventListener('click', () => {
        sfx('ui');
        close();
        this.ui.root.querySelectorAll<HTMLElement>('.mats').forEach((m) => (m.outerHTML = this.matsHtml()));
      });
    } else this.ui.showOverlay(p, () => {});
  }

  // ------------------------------------------------------------------ GEMS
  selGem: string | null = null;

  /** the gem pouch: every kind in every grade, joining three into one of the next grade */
  gems(host?: HTMLElement, overPanel = false) {
    const p = host ?? this.frame('Drahokamy');
    const body = $('.body', p);
    const s = this.save;
    const pouch = gemPouch(s);
    if (!this.selGem || !parseGem(this.selGem)) this.selGem = Object.keys(pouch).find((k) => pouch[k] > 0 && parseGem(k)) ?? gemKey('ruby', 1);
    const total = Object.values(pouch).reduce((a, b) => a + b, 0);
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Drahokamy vsadíš do soketů předmětů v detailu předmětu (inventář) – zbraň, zbroj a šperk dostanou od stejného drahokamu jiný bonus. Tři stejné drahokamy spojíš v jeden lepší.</div>
        <div class="scroll" style="flex:1"><div class="gemgrid">${GEMS.map(
          (g) =>
            `<div class="gemrow"><span class="gname" style="color:${g.color}">${g.name[0].toUpperCase() + g.name.slice(1)}</span>${GEM_TIERS.map((_, t) => {
              const k = gemKey(g.id, t + 1);
              const n = pouch[k] ?? 0;
              return `<div class="slot gemcell ${n ? '' : 'none'} ${this.selGem === k ? 'sel' : ''}" data-gem="${k}"><img src="${iconURL(gemIcon(k), 30)}"><span class="price">${n ? '×' + n : ''}</span></div>`;
            }).join('')}</div>`,
        ).join('')}</div></div>
        <div class="hint">Ve váčku: ${total} ${total === 1 ? 'drahokam' : total > 1 && total < 5 ? 'drahokamy' : 'drahokamů'}</div>
      </div>
      <div class="col detail box scroll" style="width:min(300px,38%)"></div>`;
    const detail = $('.detail', body);
    const render = () => {
      detail.scrollTop = 0;
      const k = this.selGem!;
      const g = parseGem(k)!;
      const n = pouch[k] ?? 0;
      const next = g.tier < GEM_MAX_TIER ? gemKey(g.def.id, g.tier + 1) : null;
      const cost = combineCost(g.tier, this.sc.floor);
      const can = !!next && n >= 3 && s.gold >= cost;
      const eff = (pl: GemPlace) => {
        const e = gemEffect(k, pl)!;
        return `<div class="statline"><span>${pl === 'weapon' ? 'Ve zbrani' : pl === 'armor' ? 'Ve zbroji' : 'Ve šperku'}</span><b style="color:#9dff9d;text-align:right">${formatStat(e.key, e.value)}</b></div>`;
      };
      detail.innerHTML = `<div class="orn"><span>Drahokam</span></div>
        <div class="petbig"><img src="${iconURL(gemIcon(k), 75)}"></div>
        <div style="text-align:center;font-size:22px;color:${g.def.color}">${gemName(k)}</div>
        <div class="hint" style="text-align:center">ve váčku: ${n}</div>
        ${eff('weapon')}${eff('armor')}${eff('jewel')}
        <div class="hint" style="margin-top:4px">Zbraň a magická koule berou bonus zbraně; helma, brnění, kalhoty, opasek, boty a štít zbroje; prsten, náhrdelník a náramek šperku.</div>
        ${
          next
            ? `<div class="box" style="margin-top:8px"><b style="color:#d08aff">Spojit 3 → 1</b><div class="statline"><span>Vznikne</span><b style="color:${g.def.color}">${gemName(next)}</b></div><div class="statline"><span>Cena</span><b>${cost} zl.</b></div>
              <div class="row eqrow"><button class="btn purple" data-a="join" ${can ? '' : 'disabled'}>Spojit</button><button class="btn small" data-a="joinall" ${n >= 3 ? '' : 'disabled'}>Spojit vše</button></div></div>`
            : '<div class="hint" style="margin-top:8px">Královský drahokam je nejlepší, dál už spojit nejde.</div>'
        }`;
      const join = (all: boolean) => {
        let made = 0;
        // bottom-up: chips into small ones, small into cut ones… as far as the gold goes
        for (let t = all ? 1 : g.tier; t < GEM_MAX_TIER && (all || t === g.tier); t++) {
          const from = gemKey(g.def.id, t);
          const c = combineCost(t, this.sc.floor);
          while ((pouch[from] ?? 0) >= 3 && s.gold >= c && (all || made === 0)) {
            addGem(s, from, -3);
            addGem(s, gemKey(g.def.id, t + 1));
            s.gold -= c;
            maxStat(s, 'bestGem', t + 1);
            made++;
          }
        }
        if (!made) return this.ui.toast(s.gold < cost ? 'Nemáš dost zlata' : 'Potřebuješ 3 stejné drahokamy', '#ff8080');
        sfx('upgrade');
        this.ui.toast(made === 1 ? `Spojeno: ${gemName(next!)}` : `Spojeno ${made}×`, g.def.color);
        if (!all && (pouch[k] ?? 0) < 3 && next) this.selGem = next;
        this.gems(p);
      };
      detail.querySelector('[data-a=join]')?.addEventListener('click', () => join(false));
      detail.querySelector('[data-a=joinall]')?.addEventListener('click', () => join(true));
    };
    body.querySelectorAll<HTMLElement>('.gemcell').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        this.selGem = c.dataset.gem!;
        body.querySelectorAll('.gemcell').forEach((x) => x.classList.toggle('sel', x === c));
        render();
      }),
    );
    render();
    if (host) return;
    if (overPanel && this.ui.panel) {
      // over another panel (from its materials bar): closing comes back to it, with fresh numbers
      const close = this.ui.dialog(p);
      const x = $('.close', p);
      const nx = x.cloneNode(true) as HTMLElement;
      x.replaceWith(nx);
      nx.addEventListener('click', () => {
        sfx('ui');
        close();
        this.ui.root.querySelectorAll<HTMLElement>('.mats').forEach((m) => (m.outerHTML = this.matsHtml()));
      });
    } else this.ui.showOverlay(p, () => {});
  }

  /** slots an item can be worn in (one-handed weapons and rings fit two) */
  targetSlots(it: Item): Slot[] {
    const cat = BASE_BY_ID[it.base].cat;
    if (cat === 'weapon1h') return ['main', 'off'];
    if (cat === 'ring') return ['ring1', 'ring2'];
    if (cat === 'weapon2h') return ['main'];
    if (cat === 'shield' || cat === 'offhand') return ['off'];
    return [cat as Slot];
  }

  /** the bag's items that fit an equipment slot, best first (tapping the helmet lists every helmet in the bag) */
  fitsHtml(slot: Slot): string {
    const s = this.save;
    const list = s.inventory
      .map((it, i) => ({ it, i }))
      .filter((x): x is { it: Item; i: number } => !!x.it && this.targetSlots(x.it).includes(slot))
      .map((x) => ({ ...x, d: this.slotDelta(x.it, slot) }))
      .sort((a, b) => b.d.score - a.d.score);
    if (!list.length) return `<div class="fits"><div class="orn"><span>Do tohoto místa</span></div><p class="hint">V batohu nemáš nic, co by se sem dalo nasadit (${esc(SLOT_NAMES[slot])}).</p></div>`;
    return `<div class="fits"><div class="orn"><span>Do tohoto místa · ${list.length}</span></div>${list
      .map(({ it, i, d }) => {
        const mark = d.err ? '' : d.score > 0.001 ? '<b class="up">▲</b>' : d.score < -0.001 ? '<b class="down">▼</b>' : '<b class="same">=</b>';
        return `<div class="fit" data-inv="${i}"><img src="${iconURL(itemIcon(it), 32)}"><span class="nm" style="color:${itemColor(it)}">${it.upgrade ? '+' + it.upgrade + ' ' : ''}${esc(it.name)}</span>${mark}<button class="btn green small" data-a="fit" data-i="${i}">Nasadit</button></div>`;
      })
      .join('')}</div>`;
  }

  /** how the hero's main numbers change when the item is worn in a slot (and a rough overall score) */
  slotDelta(it: Item, slot: Slot): { rows: [string, number, string][]; score: number; err?: string } {
    const s = this.save;
    const before = derive(s);
    const clone: SaveData = JSON.parse(JSON.stringify(s));
    // room for whatever the swap pushes out (a full bag must not spoil the comparison)
    clone.inventory.push(null, null);
    let idx = clone.inventory.findIndex((x) => x?.uid === it.uid);
    if (idx < 0) {
      idx = clone.inventory.findIndex((x) => !x);
      clone.inventory[idx] = JSON.parse(JSON.stringify(it));
    }
    const err = equipItem(clone, idx, slot);
    if (err) return { rows: [], score: 0, err };
    const after = derive(clone);
    const dps = (d: typeof before) => ((d.dmgMin + d.dmgMax) / 2) * d.aps * (1 + (d.crit / 100) * (d.critDmg / 100 - 1));
    const all: [string, number, string][] = [
      ['DPS', dps(after) - dps(before), ''],
      ['Síla kouzel', (after.spellMult - before.spellMult) * 100, ' %'],
      ['Brnění', after.armor - before.armor, ''],
      ['HP', after.maxHp - before.maxHp, ''],
      ['Mana', after.maxMp - before.maxMp, ''],
      ['Krit.', after.crit - before.crit, ' %'],
      ['Úhyb', after.dodge - before.dodge, ' %'],
      ['Blok', after.block - before.block, ' %'],
    ];
    const rows = all.filter(([, d]) => Math.abs(d) >= 0.05);
    // relative gains, so a sword is judged by damage and a helmet by health and armour
    const rel = (a: number, b: number) => (b - a) / Math.max(1, Math.abs(a));
    const score = rel(dps(before), dps(after)) + rel(before.spellMult, after.spellMult) + 0.5 * rel(before.maxHp, after.maxHp) + 0.4 * rel(before.armor, after.armor) + 0.2 * rel(before.maxMp, after.maxMp);
    return { rows, score };
  }

  /** the item next to what is worn now: one card per slot it fits, with the change it would make */
  compareHtml(it: Item, slots = this.targetSlots(it)) {
    const s = this.save;
    const fmt = (d: number) => {
      const a = Math.abs(d);
      return (d > 0 ? '+' : '−') + (a >= 10 || Math.abs(a - Math.round(a)) < 0.05 ? Math.round(a).toLocaleString('cs-CZ') : a.toFixed(1).replace('.', ','));
    };
    let h = `<div class="orn"><span>Porovnání s nasazeným</span></div>`;
    for (const sl of slots) {
      const cur = s.equip[sl] ?? null;
      const blocked = sl === 'off' && isTwoHanded(s.equip.main);
      const { rows, err } = this.slotDelta(it, sl);
      const curHtml = cur
        ? `<img src="${iconURL(itemIcon(cur), 32)}"><span style="color:${itemColor(cur)}">${cur.upgrade ? '+' + cur.upgrade + ' ' : ''}${esc(cur.name)}</span>`
        : `<span class="hint">${blocked ? 'zabraná obouruční zbraní' : 'nic nenasazeno'}</span>`;
      const chips = err
        ? `<span class="chip down">${esc(err)}</span>`
        : rows.length
          ? rows.map(([n, d, unit]) => `<span class="chip ${d > 0 ? 'up' : 'down'}">${n} ${fmt(d)}${unit}</span>`).join('')
          : '<span class="chip same">beze změny</span>';
      const note = BASE_BY_ID[it.base].cat === 'weapon2h' && s.equip.off ? `<div class="hint">Uvolní i levou ruku (${esc(s.equip.off.name)}).</div>` : '';
      h += `<div class="cmpcard"><div class="cmpslot">${SLOT_NAMES[sl]}</div><div class="cmpitem">${curHtml}</div><div class="chips">${chips}</div>${note}${
        cur ? `<details><summary>Vlastnosti nasazeného</summary><div class="istats small">${this.itemStatsHtml(cur)}</div></details>` : ''
      }</div>`;
    }
    return h;
  }

  // ------------------------------------------------------------------ INVENTORY
  inventory(mode: 'normal' | 'sell' = 'normal', host?: HTMLElement) {
    this.ui.newItems = 0;
    if (!host) this.multi = null;
    const p = host ?? this.frame('Inventář');
    const body = $('.body', p);
    // a re-render keeps the bag where it was scrolled to
    const scrolled = host ? body.querySelector<HTMLElement>('.bagscroll')?.scrollTop ?? 0 : 0;
    const s = this.save;
    // marked places that no longer hold an item fall out of the selection
    if (this.multi) {
      for (const i of [...this.multi]) if (!s.inventory[i] || s.inventory[i]!.locked) this.multi.delete(i);
      if (!this.multi.size) this.multi = null;
    }
    const multi = this.multi;
    const marked = multi ? [...multi].map((i) => s.inventory[i]!).filter(Boolean) : [];
    const markedValue = marked.reduce((a, it) => a + itemValue(it), 0);
    const d = derive(s);
    const better = s.inventory.map((it) => !!it && this.sc.loot.isUpgrade(it));
    const upgrades = better.filter(Boolean).length;
    body.innerHTML = `
      <div class="col" style="width:min(260px,30%)">
        <div class="box equip">
          <div class="side">${EQUIP_LEFT.map((sl) => this.slotHtml(s.equip[sl], `eq" data-slot="${sl}`, SLOT_NAMES[sl])).join('')}</div>
          <div class="doll"><img src="${iconURL('pl_' + s.cls, 120)}">
            <div style="font-size:15px;text-align:center;line-height:1.35">
              <div>Poškození <b>${d.dmgMin}–${d.dmgMax}</b></div>
              <div>Brnění <b>${d.armor}</b></div>
              <div>HP <b>${d.maxHp}</b> • Mana <b>${d.maxMp}</b></div>
              ${d.dual ? '<div style="color:#ffb347">Dvě zbraně</div>' : ''}
              ${mode === 'sell' ? `<div>Volno v batohu <b>${freeSlots(s)}/${s.inventory.length}</b></div>` : ''}
            </div>
          </div>
          <div class="side">${EQUIP_RIGHT.map((sl) => this.slotHtml(s.equip[sl] ?? (sl === 'off' && isTwoHanded(s.equip.main) ? null : null), `eq ${sl === 'off' && isTwoHanded(s.equip.main) ? 'blocked' : ''}" data-slot="${sl}`, sl === 'off' && isTwoHanded(s.equip.main) ? '2H' : SLOT_NAMES[sl])).join('')}</div>
        </div>
      </div>
      <div class="col" style="flex:1;min-width:0">
        <div class="scroll bagscroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `inv${multi?.has(i) ? ' msel' : ''}" data-idx="${i}`, '', undefined, better[i])).join('')}</div></div>
        ${
          multi
            ? `<div class="row multibar"><span class="mcount">Vybráno <b>${marked.length}</b></span><button class="btn small gold" data-a="msell">Prodat · ${markedValue.toLocaleString('cs-CZ')} zl.</button><button class="btn small purple" data-a="msalv">Rozebrat</button><button class="btn small" data-a="mnone">✕ Zrušit</button></div>`
            : ''
        }
        <div class="row invacts ${mode}"${multi ? ' hidden' : ''}>${mode === 'sell' ? '<button class="btn small twoline gold" data-a="sellpick">Prodat podle<br>kvality ☑</button>' : ''}<button class="btn small blue" data-a="sort">Seřadit</button><button class="btn small" data-a="lootrules" title="Co se má stát se sebranými předměty">⚙<span class="lootlbl"> Kořist</span></button>${mode === 'normal' && upgrades ? `<button class="btn small green" data-a="equipbest">Nasadit lepší ▲ (${upgrades})</button>` : ''}</div>
      </div>
      <div class="col detail box scroll" style="width:min(300px,34%)"></div>`;
    // gold and materials sit in the header next to the title, so the bag gets the room
    this.headMats(p);
    if (mode === 'normal') {
      const head = $('.head', p);
      const h2 = $('h2', head);
      h2.innerHTML = `Inventář <small class="hfree">volno ${freeSlots(s)}/${s.inventory.length}</small>`;
      h2.classList.add('nowrap');
      // salvaging the common items moves up too
      let ha = head.querySelector<HTMLElement>('.headacts');
      if (!ha) {
        ha = el('<div class="headacts"></div>');
        head.insertBefore(ha, $('.close', head));
      }
      ha.innerHTML = '<button class="btn small" data-a="salvcommon" title="Rozebrat běžné předměty">⚒ Rozebrat běžné</button>';
    }
    const bag = body.querySelector<HTMLElement>('.bagscroll');
    if (bag && scrolled) bag.scrollTop = scrolled;
    const detail = $('.detail', body);
    const renderDetail = () => {
      // a newly picked item starts at the top, where its buttons are
      detail.scrollTop = 0;
      // several marked items: what they are and what they would give
      if (this.multi) {
        const r = marked.reduce((a, it) => {
          const x = salvageResult(it);
          return { gold: a.gold + x.gold, dust: a.dust + x.dust, stones: a.stones + x.stones };
        }, { gold: 0, dust: 0, stones: 0 });
        detail.innerHTML = `<div class="orn"><span>Výběr · ${marked.length}</span></div>
          <p class="hint">Klepnutím přidáš nebo odebereš další předmět. Zamčené předměty vybrat nejde.</p>
          <div class="msellist">${marked.map((it) => `<div class="mline"><img src="${iconURL(itemIcon(it), 32)}"><span style="color:${itemColor(it)}">${it.upgrade ? '+' + it.upgrade + ' ' : ''}${esc(it.name)}</span><b>${itemValue(it).toLocaleString('cs-CZ')}</b></div>`).join('')}</div>
          <div class="statline"><span>Prodej</span><b style="color:#ffd76a">${markedValue.toLocaleString('cs-CZ')} zl.</b></div>
          <div class="statline"><span>Rozebrání</span><b style="color:#c8a8ff">${r.gold.toLocaleString('cs-CZ')} zl.${r.dust ? ` · ${r.dust} prach` : ''}${r.stones ? ` · ${stonesText(r.stones)}` : ''}</b></div>`;
        return;
      }
      const sel = this.sel;
      let it: Item | null | undefined = null;
      if (sel?.from === 'inv') it = s.inventory[sel.idx];
      else if (sel?.from === 'eq') it = s.equip[sel.slot];
      // a tapped equipment slot: everything in the bag that fits it, best first, and below it what is worn there
      if (sel?.from === 'eq') {
        const worn = it
          ? this.itemDetailHtml(it, `<div class="row eqrow"><button class="btn" data-a="unequip">Sundat do inventáře</button></div>`, false, true)
          : `<div class="orn"><span>${SLOT_NAMES[sel.slot]}</span></div><p class="hint">Na tomto místě nemáš nic.</p>`;
        detail.innerHTML = this.fitsHtml(sel.slot) + worn;
        return;
      }
      if (!it) {
        detail.innerHTML = `<div class="orn"><span>Předmět</span></div><p class="hint">Klepni na předmět: nahoře se objeví Nasadit a Prodat a pod tím porovnání s tím, co máš na sobě.</p><p class="hint">Předměty se sbírají automaticky, když přes ně přejdeš. Dvojitým klepnutím předmět rovnou nasadíš.</p><p class="hint">Podržením předmětu začneš vybírat víc předmětů najednou – pak je prodáš nebo rozebereš jedním tlačítkem.</p>`;
        return;
      }
      if (sel!.from === 'inv') {
        // equip first (both hands / both rings side by side), then sell / salvage / drop, then the comparison
        const slots = this.targetSlots(it);
        let eq: string;
        if (slots.length > 1) {
          const sc = slots.map((sl) => this.slotDelta(it!, sl).score);
          const best = sc[0] === sc[1] || Math.max(...sc) <= 0.001 ? -1 : sc.indexOf(Math.max(...sc));
          eq = slots.map((sl, i) => `<button class="btn green${i === best ? ' best' : ''}" data-a="equip" data-t="${sl}">${EQUIP_TO[sl] ?? 'Nasadit'}${i === best ? ' ▲' : ''}</button>`).join('');
        } else eq = `<button class="btn green" data-a="equip" data-t="${slots[0]}">Nasadit</button>`;
        // a locked item cannot be sold, salvaged or dropped (one by one or in bulk)
        const acts = it.locked
          ? `<div class="row eqrow">${eq}</div><div class="row subrow"><button class="btn small" data-a="lock">🔓 Odemknout</button><span class="hint">Zamčený – nejde prodat, rozebrat ani zahodit.</span></div>`
          : `<div class="row eqrow">${eq}</div><div class="row subrow"><button class="btn gold small" data-a="sell">Prodat · ${itemValue(it)} zl.</button><button class="btn purple small" data-a="salvage">Rozebrat</button><button class="btn red small" data-a="drop">Zahodit</button><button class="btn small" data-a="lock" title="Zamknout">🔒</button></div>`;
        detail.innerHTML = this.itemDetailHtml(it, acts, true, true) + `<div class="hint" style="margin-top:6px">Rozebrání dá: ${this.salvageText(it)}${it.sockets?.some(Boolean) ? ' Drahokamy se při prodeji i rozebrání vrátí do váčku.' : ''}</div>`;
      }
    };
    const rerender = () => this.inventory(mode, p);
    // marking: a long press starts it, then every tap adds or removes an item (on a PC also Ctrl / Shift + click)
    const toggleMark = (i: number) => {
      const it = s.inventory[i];
      if (!it) return;
      if (it.locked) {
        this.ui.toast('🔒 Zamčený předmět nejde prodat ani rozebrat', '#e9d27a');
        return;
      }
      const m = (this.multi ??= new Set());
      if (m.has(i)) m.delete(i);
      else m.add(i);
      if (!m.size) this.multi = null;
      this.sel = null;
      rerender();
    };
    let pressT = 0;
    let pressAt: [number, number] = [0, 0];
    let swallow = 0;
    body.querySelectorAll<HTMLElement>('.slot.inv').forEach((sl) => {
      const i = +sl.dataset.idx!;
      const cancel = () => clearTimeout(pressT);
      sl.addEventListener('pointerdown', (e) => {
        if (!s.inventory[i]) return;
        pressAt = [e.clientX, e.clientY];
        clearTimeout(pressT);
        pressT = window.setTimeout(() => {
          swallow = Date.now() + 700;
          vibrate(18);
          sfx('ui');
          if (!this.multi?.has(i)) toggleMark(i);
        }, 420);
      });
      sl.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 10) cancel();
      });
      sl.addEventListener('pointerup', cancel);
      sl.addEventListener('pointercancel', cancel);
      sl.addEventListener('pointerleave', cancel);
      // no browser menu over a long-pressed picture
      sl.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    body.querySelectorAll<HTMLElement>('.slot.inv').forEach((sl) =>
      sl.addEventListener('click', (e) => {
        const i = +sl.dataset.idx!;
        if (!s.inventory[i] || Date.now() < swallow) return;
        sfx('ui');
        if (this.multi || e.ctrlKey || e.shiftKey || e.metaKey) return toggleMark(i);
        // double tap equips
        if (this.sel?.from === 'inv' && this.sel.idx === i && mode === 'normal') {
          const err = equipItem(s, i);
          if (err) this.ui.toast(err, '#ff8080');
          else this.afterEquip();
          this.sel = null;
          rerender();
          return;
        }
        this.sel = { from: 'inv', idx: i };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        renderDetail();
      }),
    );
    body.querySelectorAll<HTMLElement>('.slot.eq').forEach((sl) =>
      sl.addEventListener('click', () => {
        const slot = sl.dataset.slot as Slot;
        if (this.multi) return;
        sfx('ui');
        this.sel = { from: 'eq', slot };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        renderDetail();
      }),
    );
    detail.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      // a line of the slot's list: show that item from the bag
      const fit = (e.target as HTMLElement).closest<HTMLElement>('.fit');
      if (fit && !b) {
        sfx('ui');
        const i = +fit.dataset.inv!;
        this.sel = { from: 'inv', idx: i };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        body.querySelector(`.slot.inv[data-idx="${i}"]`)?.classList.add('sel');
        renderDetail();
        return;
      }
      if (!b) return;
      sfx('ui');
      const a = b.dataset.a;
      const sel = this.sel;
      if (!sel) return;
      if (a === 'fit' && sel.from === 'eq') {
        const err = equipItem(s, +b.dataset.i!, sel.slot);
        if (err) this.ui.toast(err, '#ff8080');
        else this.afterEquip();
        rerender();
        return;
      }
      if (a === 'sock' || a === 'rsock') {
        const it = sel.from === 'inv' ? s.inventory[sel.idx] : sel.from === 'eq' ? s.equip[sel.slot] : null;
        if (it) (a === 'sock' ? this.socketClick(it, +b.dataset.sock!, rerender) : this.runeSocketClick(it, +b.dataset.sock!, rerender));
        return;
      }
      if (a === 'lock') {
        const it = sel.from === 'inv' ? s.inventory[sel.idx] : null;
        if (!it) return;
        it.locked = !it.locked;
        this.ui.toast(it.locked ? `🔒 ${it.name} je zamčený` : `🔓 ${it.name} je odemčený`, '#e9d27a');
        rerender();
        return;
      }
      // nothing leaves the bag while it is locked
      if ((a === 'sell' || a === 'salvage' || a === 'drop') && sel.from === 'inv' && s.inventory[sel.idx]?.locked) return;
      if (a === 'equip') {
        if (sel.from !== 'inv') return;
        const err = equipItem(s, sel.idx, b.dataset.t as Slot | undefined);
        if (err) this.ui.toast(err, '#ff8080');
        else this.afterEquip();
        this.sel = null;
      } else if (a === 'unequip' && sel.from === 'eq') {
        const err = unequip(s, sel.slot);
        if (err) this.ui.toast(err, '#ff8080');
        else this.afterEquip();
        this.sel = null;
      } else if (a === 'sell' && sel.from === 'inv') {
        const it = s.inventory[sel.idx]!;
        const sell = () => {
          if (s.inventory[sel.idx] !== it) return;
          const price = itemValue(it);
          s.gold += price;
          if (returnGems(s, it)) this.ui.toast('Drahokamy se vrátily do váčku', '#d08aff');
          this.sold(it, price);
          s.inventory[sel.idx] = null;
          sfx('coin');
          this.ui.toast(`Prodáno za ${price} zlata`, '#ffd76a');
          this.sel = null;
          rerender();
        };
        // valuable things are easy to sell by mistake: ask first
        if (it.rarity >= 3) {
          this.ui.confirm(`Prodat ${it.name}?`, `Dostaneš ${itemValue(it)} zlata. ${RARITIES[it.rarity].name} předmět se nedá vzít zpět.`, sell, 'Prodat', 'Ponechat');
          return;
        }
        sell();
        return;
      } else if (a === 'salvage' && sel.from === 'inv') {
        const it = s.inventory[sel.idx]!;
        const salvage = () => {
          if (s.inventory[sel.idx] !== it) return;
          this.salvage(sel.idx);
          this.sel = null;
          rerender();
        };
        // the same as selling: one stray tap (or button press) does not destroy a valuable item
        if (it.rarity >= 3) {
          this.ui.confirm(`Rozebrat ${it.name}?`, `Rozebrání dá: ${this.salvageText(it)}. ${RARITIES[it.rarity].name} předmět se nedá vzít zpět.`, salvage, 'Rozebrat', 'Ponechat');
          return;
        }
        salvage();
        return;
      } else if (a === 'drop' && sel.from === 'inv') {
        const it = s.inventory[sel.idx]!;
        s.inventory[sel.idx] = null;
        this.sc.loot.throwItem(it);
        this.sel = null;
      }
      rerender();
    });
    const plural = (n: number) => `${n} ${n === 1 ? 'předmět' : n < 5 ? 'předměty' : 'předmětů'}`;
    body.querySelector('[data-a=mnone]')?.addEventListener('click', () => {
      sfx('ui');
      this.multi = null;
      rerender();
    });
    body.querySelector('[data-a=msell]')?.addEventListener('click', () => {
      sfx('ui');
      const idx = [...(this.multi ?? [])].filter((i) => s.inventory[i] && !s.inventory[i]!.locked);
      if (!idx.length) return;
      const go = () => {
        let n = 0,
          g = 0;
        for (const i of idx) {
          const it = s.inventory[i];
          if (!it || it.locked) continue;
          const price = itemValue(it);
          if (returnGems(s, it)) this.ui.toast('Drahokamy se vrátily do váčku', '#d08aff');
          this.sold(it, price);
          s.inventory[i] = null;
          g += price;
          n++;
        }
        s.gold += g;
        this.multi = null;
        this.sel = null;
        if (n) sfx('coin');
        this.ui.toast(`Prodáno: ${plural(n)} za ${g.toLocaleString('cs-CZ')} zlata`, '#ffd76a');
        rerender();
      };
      // something valuable among them: ask first
      const best = Math.max(...idx.map((i) => s.inventory[i]!.rarity));
      if (best >= 3) {
        const total = idx.reduce((a, i) => a + itemValue(s.inventory[i]!), 0);
        this.ui.confirm(`Prodat ${plural(idx.length)}?`, `Dostaneš ${total.toLocaleString('cs-CZ')} zlata. Je mezi nimi i ${RARITIES[best].name.toLowerCase()} předmět – prodej se nedá vzít zpět.`, go, 'Prodat', 'Ponechat');
      } else go();
    });
    body.querySelector('[data-a=msalv]')?.addEventListener('click', () => {
      sfx('ui');
      const idx = [...(this.multi ?? [])].filter((i) => s.inventory[i] && !s.inventory[i]!.locked);
      if (!idx.length) return;
      const go = () => {
        let n = 0;
        const r = { gold: 0, dust: 0, stones: 0 };
        for (const i of idx) {
          const it = s.inventory[i];
          if (!it || it.locked) continue;
          const x = salvageResult(it);
          r.gold += x.gold;
          r.dust += x.dust;
          r.stones += x.stones;
          this.salvage(i, true);
          n++;
        }
        this.multi = null;
        this.sel = null;
        this.ui.toast(`Rozebráno: ${plural(n)} · +${r.gold.toLocaleString('cs-CZ')} zl.${r.dust ? `, +${r.dust} prach` : ''}${r.stones ? `, +${stonesText(r.stones)}` : ''}`, '#c8a8ff');
        rerender();
      };
      const best = Math.max(...idx.map((i) => s.inventory[i]!.rarity));
      if (best >= 3) this.ui.confirm(`Rozebrat ${plural(idx.length)}?`, `Je mezi nimi i ${RARITIES[best].name.toLowerCase()} předmět – rozebrání se nedá vzít zpět.`, go, 'Rozebrat', 'Ponechat');
      else go();
    });
    body.querySelector('[data-a=sellpick]')?.addEventListener('click', () => {
      sfx('ui');
      this.sellByQuality(rerender);
    });
    body.querySelector('[data-a=equipbest]')?.addEventListener('click', () => {
      // equip one upgrade at a time – each swap changes what counts as better
      let n = 0;
      for (let guard = 0; guard < 14; guard++) {
        const i = s.inventory.findIndex((it) => !!it && this.sc.loot.isUpgrade(it));
        if (i < 0 || equipItem(s, i)) break;
        n++;
      }
      if (n) this.afterEquip();
      this.ui.toast(n ? `Nasazeno ${n} lepších předmětů` : 'Nic lepšího není', '#9dff9d');
      this.sel = null;
      rerender();
    });
    body.querySelector('[data-a=lootrules]')?.addEventListener('click', () => {
      sfx('ui');
      this.lootRules();
    });
    body.querySelector('[data-a=sort]')?.addEventListener('click', () => {
      const items = s.inventory.filter((x): x is Item => !!x);
      const catOrder = ['weapon1h', 'weapon2h', 'shield', 'offhand', 'helmet', 'chest', 'pants', 'belt', 'boots', 'ring', 'amulet', 'bracer'];
      items.sort((a, b) => b.rarity - a.rarity || catOrder.indexOf(BASE_BY_ID[a.base].cat) - catOrder.indexOf(BASE_BY_ID[b.base].cat) || b.ilvl - a.ilvl);
      s.inventory = s.inventory.map((_, i) => items[i] ?? null);
      this.sel = null;
      sfx('ui');
      rerender();
    });
    p.querySelector('[data-a=salvcommon]')?.addEventListener('click', () => {
      let n = 0;
      s.inventory.forEach((it, i) => {
        if (it && !it.locked && it.rarity === 0 && !this.sc.loot.isUpgrade(it)) {
          this.salvage(i, true);
          n++;
        }
      });
      this.ui.toast(n ? `Rozebráno ${n} předmětů` : 'Žádné běžné předměty', '#c8a8ff');
      rerender();
    });
    renderDetail();
    if (!host) this.ui.showOverlay(p, () => {});
    bus.emit('stats');
  }

  salvageText(it: Item) {
    const r = salvageResult(it);
    const parts = [`${r.gold} zlata`];
    if (r.dust) parts.push(`${r.dust}× prach`);
    parts.push('šance na kámen');
    return parts.join(', ');
  }

  salvage(idx: number, quiet = false) {
    const s = this.save;
    const it = s.inventory[idx];
    if (!it) return;
    returnGems(s, it);
    const r = salvageResult(it);
    s.gold += r.gold;
    s.mats.dust += r.dust;
    s.mats.stone += r.stones;
    s.inventory[idx] = null;
    if (!quiet) this.ui.toast(`Rozebráno: +${r.gold} zl.${r.dust ? `, +${r.dust} prach` : ''}${r.stones ? `, +${r.stones} kámen` : ''}`, '#c8a8ff');
  }

  afterEquip() {
    sfx('pickup');
    const p = this.sc.player;
    p.recalc();
    bus.emit('equip');
  }

  // ------------------------------------------------------------------ CHARACTER
  character(host?: HTMLElement) {
    const p = host ?? this.frame('Postava');
    const body = $('.body', p);
    const s = this.save;
    const pl = this.sc.player;
    const d = derive(s, pl.buffMods());
    const cls = CLASS_BY_ID[s.cls];
    const fmt = (v: number, dec = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(dec).replace('.', ','));
    const dps = ((d.dmgMin + d.dmgMax) / 2) * d.aps * (1 + (d.crit / 100) * (d.critDmg / 100 - 1));
    const attrRows = ATTR_KEYS.map(
      (k) => `<div class="statline" style="align-items:center"><span><b style="color:#ffd76a">${ATTR_NAMES[k]}</b><br><span class="hint" style="font-size:14px">${ATTR_DESC[k]}</span></span>
      <span class="row" style="flex-wrap:nowrap"><b style="font-size:20px">${d.attrs[k]}</b>${d.attrs[k] !== s.attrs[k] ? `<span class="hint">(${s.attrs[k]}+${d.attrs[k] - s.attrs[k]})</span>` : ''}
      <button class="btn small green" data-attr="${k}" ${s.attrPoints <= 0 ? 'disabled' : ''}>+1</button><button class="btn small green" data-attr5="${k}" ${s.attrPoints < 5 ? 'disabled' : ''}>+5</button></span></div>`,
    ).join('');
    const kind = d.attack === 'melee' ? 'Na blízko' : d.attack === 'ranged' ? 'Na dálku' : 'Magický';
    const st: [string, string][] = [
      ['Poškození zbraně', `${d.dmgMin}–${d.dmgMax}`],
      ['Odhad DPS', fmt(Math.round(dps))],
      ['Typ útoku', kind + (d.dual ? ' (dvě zbraně)' : '')],
      ['Útoků za sekundu', fmt(Math.round(d.aps * 100) / 100, 2)],
      ['Dosah útoku', fmt(Math.round((d.range / 16) * 10) / 10) + ' pole'],
      ['Kritický zásah', fmt(Math.round(d.crit * 10) / 10) + ' %'],
      ['Kritické poškození', Math.round(d.critDmg) + ' %'],
      ['Síla kouzel', Math.round(d.spellMult * 100) + ' %'],
      ['Max. HP', String(d.maxHp)],
      ['Obnova HP', fmt(Math.round(d.hpRegen * 10) / 10) + '/s'],
      ['Max. mana', String(d.maxMp)],
      ['Obnova many', fmt(Math.round(d.mpRegen * 10) / 10) + '/s'],
      ['Brnění', String(d.armor)],
      ['Úhyb', fmt(Math.round(d.dodge * 10) / 10) + ' %'],
      ['Blok', fmt(d.block) + ' %'],
      ['Vysávání života', fmt(d.lifesteal) + ` % (max ${LEECH_CAP.hp} % HP/s)`],
      ['Vysávání many', fmt(d.manasteal) + ` % (max ${LEECH_CAP.mp} % many/s)`],
      ['Rychlost pohybu', Math.round((d.move / 72) * 100) + ' %'],
      ['Snížení přebíjení', fmt(d.cdr) + ' %'],
      ['Nalezené zlato', '+' + fmt(d.gold) + ' %'],
      ['Lepší kořist', '+' + fmt(d.magicFind) + ' %'],
      ['Zkušenosti', '+' + fmt(d.xp) + ' %'],
      ['Trny', fmt(d.thorns)],
      ['Odraz poškození', fmt(d.thornsPct) + ' %'],
    ];
    if (d.elem.fire) st.push(['Ohnivé poškození', '+' + fmt(d.elem.fire)]);
    if (d.elem.ice) st.push(['Mrazivé poškození', '+' + fmt(d.elem.ice)]);
    if (d.elem.lightning) st.push(['Bleskové poškození', '+' + fmt(d.elem.lightning)]);
    if (d.elem.poison) st.push(['Jedové poškození', '+' + fmt(d.elem.poison)]);
    const specials = [...d.specials].map((x) => `<div class="spec" style="color:#ffb347;font-size:17px">★ ${esc(SPECIAL_BY_ID[x]?.desc ?? x)}</div>`).join('');
    body.innerHTML = `
      <div class="col scroll" style="width:min(240px,28%)">
        <div class="box" style="text-align:center"><img class="px" style="height:96px;image-rendering:pixelated" src="${iconURL('pl_' + s.cls, 96)}">
          <div style="font-size:26px;color:#ffd76a">${esc(heroTitle(s))}</div>${s.multi ? `<div class="hint">${esc(cls.name)} + ${esc(CLASS_BY_ID[s.multi].name)}</div>` : ''}<div class="hint">Úroveň ${s.level} • Patro ${s.floor} (max ${s.maxFloor})</div>
          <div style="font-size:17px;margin-top:2px">Obtížnost: <span style="color:${difficultyOf(s).color}">${difficultyOf(s).name}</span>${s.hardcore ? ' <span class="hctag">☠ Hardcore</span>' : ''}</div>
          <div class="hint" style="margin-top:6px">${esc(cls.desc)}</div>
          <div style="margin-top:6px;font-size:17px;color:#9dff9d">Pasivní: ${esc(cls.passive)}</div>
          <div class="hint" style="margin-top:6px">Zabito nepřátel: ${s.kills.toLocaleString('cs-CZ')}</div>
          ${
            s.level >= MULTI_LEVEL
              ? `<button class="btn small purple" data-a="multi" style="margin-top:6px">⚔ ${s.multi ? 'Změnit druhou classu' : 'Zvolit druhou classu'}</button>`
              : `<div class="hint" style="margin-top:6px">⚔ Od úrovně ${MULTI_LEVEL} si můžeš vzít druhou classu.</div>`
          }
          ${this.petLineHtml()}
          ${s.story && (s.story.shards || s.story.blessing) ? `<div style="margin-top:6px;font-size:17px;color:#9fe6ff">Pečetní střepy: ${s.story.shards}/4${s.story.blessing ? ' • Elařino požehnání' : ''}<br><span class="hint">+${storyBonusPct(s)} % zdraví, poškození a síly kouzel</span></div>` : ''}
        </div>
      </div>
      <div class="col scroll" style="flex:1.2">
        <div class="box"><div class="row" style="justify-content:space-between"><b style="color:#ffd76a">Atributy</b><span>Volné body: <b style="color:${s.attrPoints ? '#6dff7a' : '#fff'}">${s.attrPoints}</b></span></div>${attrRows}</div>
      </div>
      <div class="col scroll box" style="flex:1">
        <b style="color:#ffd76a">Statistiky</b>
        ${st.map(([a, b]) => `<div class="statline"><span>${a}</span><b>${b}</b></div>`).join('')}
        ${specials ? '<b style="color:#ffd76a;margin-top:6px">Zvláštní efekty</b>' + specials : ''}
      </div>`;
    body.querySelector('[data-a=pets]')?.addEventListener('click', () => {
      sfx('ui');
      this.pets();
    });
    body.querySelector('[data-a=multi]')?.addEventListener('click', () => {
      sfx('ui');
      this.multiclassDialog(() => this.character(p));
    });
    body.querySelectorAll<HTMLButtonElement>('[data-attr],[data-attr5]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = (b.dataset.attr ?? b.dataset.attr5) as AttrKey;
        const n = b.dataset.attr5 ? 5 : 1;
        if (s.attrPoints < n) return;
        s.attrPoints -= n;
        s.attrs[k] += n;
        sfx('ui');
        pl.recalc();
        this.character(p);
      }),
    );
    if (!host) this.ui.showOverlay(p, () => {});
  }

  /** choose (or change) the second class */
  multiclassDialog(after: () => void) {
    const s = this.save;
    const d = el(`<div class="panel"><div class="head"><h2>Druhá classa</h2><button class="close">✕</button></div><div class="body"><div class="col" style="flex:1;min-width:0">
      <p class="hint" style="margin:0 0 6px">Druhá classa ti dá polovinu svého pasivního bonusu, jedno své kouzlo do běžného slotu a až ${MULTI_TALENT_CAP} bodů talentů ve svém stromu. Stojí ${MULTI_COST.toLocaleString('cs-CZ')} zlata${s.multi ? ' (při změně se talenty staré druhé classy vrátí)' : ''}.</p>
      <div class="scroll" style="flex:1"><div class="mercgrid">${CLASSES.filter((c) => c.id !== s.cls)
        .map(
          (c) => `<div class="merccard" style="--mc:#c77dff"><img src="${iconURL('pl_' + c.id, 64)}"><div class="mtxt"><div class="nm">${esc(multiTitle(s.cls, c.id))}</div><div class="lv2">${esc(CLASS_BY_ID[s.cls].name)} + ${esc(c.name)}</div><div class="lv2 sk">Pasivní (polovina): ${esc(c.passive)}</div></div><button class="btn green small" data-mc="${c.id}" ${s.multi === c.id || s.gold < MULTI_COST ? 'disabled' : ''}>${s.multi === c.id ? 'Máš' : 'Zvolit'}</button></div>`,
        )
        .join('')}</div></div></div></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
    d.querySelectorAll<HTMLElement>('[data-mc]').forEach((b) =>
      b.addEventListener('click', () => {
        const c = b.dataset.mc as ClassId;
        if (s.gold < MULTI_COST || c === s.cls) return;
        s.gold -= MULTI_COST;
        // the old second class leaves: its talents come back, its spell leaves the slots
        const old = s.multi;
        if (old) {
          for (const [id] of Object.entries(s.talents ?? {})) if (TALENT_CLASS[id] === old) delete s.talents![id];
          s.loadout = s.loadout.map((x) => (x && SPELL_BY_ID[x]?.cls === old ? null : x));
        }
        s.multi = c;
        sfx('levelup');
        this.ui.toast(`Nyní jsi ${multiTitle(s.cls, c)}!`, '#c77dff');
        this.sc.player.recalc();
        this.ui.refreshSkills();
        bus.emit('stats');
        saveGame(s);
        close();
        after();
      }),
    );
  }

  // ------------------------------------------------------------------ PETS
  selPet: PetId | null = null;

  /** the active pet in the character panel (with the way to all of them) */
  petLineHtml() {
    const st = petsOf(this.save);
    if (!st.owned.length) return `<div class="hint" style="margin-top:6px">🐾 Mazlíčka zatím nemáš – hledej zvířátka v klecích (od patra 3).</div>`;
    const a = st.active ? PET_BY_ID[st.active] : null;
    return `<div class="petline">${a ? `<img src="${iconURL('pet_' + a.id, 48)}"><span><b style="color:${a.color}">${esc(petTitle(a))}</b><br><span class="hint">úroveň ${petLevel(st, a.id)}</span></span>` : '<span class="hint">Žádný mazlíček s tebou nechodí.</span>'}<button class="btn small" data-a="pets">🐾 Mazlíčci</button></div>`;
  }

  pets(host?: HTMLElement) {
    const p = host ?? this.frame('Mazlíčci');
    const body = $('.body', p);
    const st = petsOf(this.save);
    if (!this.selPet || !PET_BY_ID[this.selPet]) this.selPet = st.active ?? st.owned[0] ?? PETS[0].id;
    const cards = PETS.map((d) => {
      const own = st.owned.includes(d.id);
      const lvl = petLevel(st, d.id);
      const sub = !own ? `klec od patra ${d.minFloor}` : st.active === d.id ? `úroveň ${lvl} • <span style="color:#6dff7a">● s tebou</span>` : `úroveň ${lvl} • ${petBonusText(d, lvl).split(', ').pop()}`;
      return `<div class="spcard petcard ${own ? '' : 'locked'} ${this.selPet === d.id ? 'sel' : ''}" data-pet="${d.id}"><img src="${iconURL('pet_' + d.id, 64)}"><div style="min-width:0"><div class="nm" style="color:${own ? d.color : '#9a94a8'}">${own ? esc(petTitle(d)) : '???'}</div><div class="lv2">${sub}</div></div></div>`;
    }).join('');
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Mazlíčky osvobodíš z klecí v dungeonu. S tebou chodí vždy jeden: nosí ti kořist, která leží kolem, a dává svůj bonus. Za každá ${PET_FLOORS_PER_LEVEL} patra, která s tebou sestoupí, získá úroveň (nejvýš ${PET_MAX_LEVEL}).</div>
        <div class="scroll" style="flex:1"><div class="spgrid petgrid">${cards}</div></div>
        <div class="hint">Osvobozeno: ${st.owned.length}/${PETS.length}</div>
      </div>
      <div class="col detail box scroll" style="width:min(300px,38%)"></div>`;
    const detail = $('.detail', body);
    const renderDetail = () => {
      detail.scrollTop = 0;
      const d = PET_BY_ID[this.selPet!];
      const own = st.owned.includes(d.id);
      if (!own) {
        detail.innerHTML = `<div class="orn"><span>Neznámý mazlíček</span></div><div class="petbig locked"><img src="${iconURL('pet_' + d.id, 96)}"></div><p class="hint">Tohle zvířátko čeká v kleci někde od patra ${d.minFloor} níž. Klec poznáš podle nápisu nad ní – stačí k ní dojít a otevřít ji.</p>`;
        return;
      }
      const lvl = petLevel(st, d.id);
      const next = petFloorsToNext(st, d.id);
      const active = st.active === d.id;
      detail.innerHTML = `<div class="orn"><span>${esc(d.species)}</span></div>
        <div class="petbig"><img src="${iconURL('pet_' + d.id, 96)}"></div>
        <div style="text-align:center;font-size:24px;color:${d.color}">${esc(d.name)}</div>
        <div class="hint" style="text-align:center">úroveň ${lvl}/${PET_MAX_LEVEL}${next ? ` • další za ${next} ${next === 1 ? 'patro' : next < 5 ? 'patra' : 'pater'}` : ' • nejvyšší'}</div>
        <div class="row eqrow" style="margin:8px 0">${active ? '<button class="btn" data-a="home">Nechat doma</button>' : '<button class="btn green" data-a="take">Vzít s sebou</button>'}</div>
        <p style="margin:4px 0">${esc(d.desc)}</p>
        <div class="statline"><span>Bonus teď</span><b style="color:#9dff9d;text-align:right">${petBonusText(d, lvl)}</b></div>
        ${lvl < PET_MAX_LEVEL ? `<div class="statline"><span>Na úrovni ${PET_MAX_LEVEL}</span><b style="color:#c8c0d8;text-align:right">${petBonusText(d, PET_MAX_LEVEL)}</b></div>` : ''}
        <div class="hint" style="margin-top:6px">S tebou ${d.fem ? 'sestoupila' : 'sestoupil'} o ${st.floors[d.id] ?? 0} ${(st.floors[d.id] ?? 0) === 1 ? 'patro' : (st.floors[d.id] ?? 0) > 1 && (st.floors[d.id] ?? 0) < 5 ? 'patra' : 'pater'}.</div>`;
      detail.querySelector('[data-a=take]')?.addEventListener('click', () => {
        sfx('levelup');
        this.sc.setActivePet(d.id);
        this.pets(p);
      });
      detail.querySelector('[data-a=home]')?.addEventListener('click', () => {
        sfx('ui');
        this.sc.setActivePet(null);
        this.pets(p);
      });
    };
    body.querySelectorAll<HTMLElement>('.petcard').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        this.selPet = c.dataset.pet as PetId;
        body.querySelectorAll('.petcard').forEach((x) => x.classList.toggle('sel', x === c));
        renderDetail();
      }),
    );
    renderDetail();
    if (!host) this.ui.showOverlay(p, () => {});
  }

  // ------------------------------------------------------------------ MERCENARY
  /** what is selected in the mercenary panel: one of its slots or an item in the bag */
  mercSel: { slot?: MercSlot; idx?: number } | null = null;

  merc(host?: HTMLElement) {
    const p = host ?? this.frame('Žoldák');
    const body = $('.body', p);
    const s = this.save;
    const m = s.merc;
    const price = mercPrice(s.level);
    const fmt = (v: number) => Math.round(v).toLocaleString('cs-CZ');
    if (!m) {
      this.mercSel = null;
      body.innerHTML = `<div class="col" style="flex:1;min-width:0">
        <div class="hint">Najmi si parťáka, který s tebou půjde do hlubin. Má vlastní tři sloty na vybavení, roste s tvou úrovní a poslouchá jednoduché rozkazy. Najmutí stojí <b style="color:#ffd76a">${fmt(price)} zlata</b> (máš ${fmt(s.gold)}).</div>
        <div class="scroll" style="flex:1"><div class="mercgrid">${MERCS.map(
          (d) => `<div class="merccard" style="--mc:${d.color}"><img src="${iconURL('pl_' + mercLook(d, s.cls), 64)}"><div class="mtxt"><div class="nm">${esc(d.title)}</div><div class="lv2">${esc(d.desc)}</div><div class="lv2 sk">${esc(d.skill)}</div></div><button class="btn green small" data-hire="${d.role}" ${s.gold < price ? 'disabled' : ''}>Najmout</button></div>`,
        ).join('')}</div></div></div>`;
      body.querySelectorAll<HTMLElement>('[data-hire]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!this.sc.hireMerc(b.dataset.hire as MercRole, price)) return;
          sfx('levelup');
          const nm = s.merc!.name;
          this.ui.toast(`${nm} se k tobě přidává!`, MERC_BY_ROLE[s.merc!.role].color);
          this.merc(p);
        }),
      );
      if (!host) this.ui.showOverlay(p, () => {});
      return;
    }
    const def = MERC_BY_ROLE[m.role];
    const ms = this.sc.merc?.s ?? mercStats(m, s.level, derive(s).maxHp);
    const live = this.sc.merc;
    // everything in the bag the mercenary can wear, best first (by what it adds to their fight)
    const heroMax = derive(s).maxHp;
    const mscore = (eq: typeof m.equip) => {
      const st = mercStats({ ...m, equip: eq }, s.level, heroMax);
      return (st.dmg / Math.max(0.3, st.atkCd)) * (1 + (st.crit / 100) * (st.critDmg / 100 - 1)) + st.heal * 0.8 + st.armor * 1.5 + st.maxHp * 0.06;
    };
    const now = mscore(m.equip);
    const fitList = s.inventory
      .map((it, i) => ({ it, i, slot: it ? mercSlotFor(m.role, it) : null }))
      .filter((x): x is { it: Item; i: number; slot: MercSlot } => !!x.it && !!x.slot)
      .map((x) => ({ ...x, delta: mscore({ ...m.equip, [x.slot]: x.it }) / Math.max(0.001, now) - 1 }))
      .sort((a, b) => b.delta - a.delta);
    const sel = this.mercSel;
    const selItem = sel?.slot ? m.equip[sel.slot] : sel?.idx !== undefined ? s.inventory[sel.idx] : null;
    let detail = `<div class="hint">Klepni na předmět v seznamu nebo na slot žoldáka.</div>`;
    if (selItem) {
      const slot = sel?.slot ?? mercSlotFor(m.role, selItem);
      const acts = sel?.slot ? `<button class="btn small" data-ma="off">Sundat do batohu</button>` : slot ? `<button class="btn green small" data-ma="give">Dát žoldákovi</button>` : `<span class="hint">Tohle ${esc(m.name)} nepoužije.</span>`;
      detail = this.itemDetailHtml(selItem, acts);
    }
    body.innerHTML = `
      <div class="col detail box scroll mercinfo">
        <div class="merchead"><img src="${iconURL('pl_' + mercLook(def, s.cls), 64)}"><div><div style="font-size:24px;color:${def.color}">${esc(m.name)}</div><div class="hint">${esc(def.title)} • úroveň ${s.level}${live?.down ? ' • <span style="color:#ff8a7a">vyřazen z boje</span>' : ''}</div></div></div>
        <div class="mercstats">
          <div class="statline"><span>Zdraví</span><b>${fmt(live && !live.down ? live.hp : ms.maxHp)}/${fmt(ms.maxHp)}</b></div>
          <div class="statline"><span>Poškození</span><b>${fmt(ms.dmg)}</b></div>
          ${def.role === 'healer' ? `<div class="statline"><span>Léčení</span><b>${fmt(ms.heal)}</b></div>` : ''}
          <div class="statline"><span>Brnění</span><b>${fmt(ms.armor)}</b></div>
          <div class="statline"><span>Kritický</span><b>${Math.round(ms.crit)} %</b></div>
          ${ms.block ? `<div class="statline"><span>Blok</span><b>${Math.round(ms.block)} %</b></div>` : ''}
        </div>
        <p class="hint" style="margin:4px 0">${esc(def.skill)}</p>
        <div class="orn"><span>Rozkaz</span></div>
        <div class="mercorders">${MERC_ORDERS.map((o) => `<button class="btn small ${m.order === o.id ? 'green' : ''}" data-ord="${o.id}">${o.name}</button>`).join('')}</div>
        <div class="hint">${esc(m.name)} ${MERC_ORDERS.find((o) => o.id === m.order)!.desc}.</div>
        <div class="row" style="margin-top:8px;justify-content:center"><button class="btn small" data-ma="change">Vyměnit…</button><button class="btn red small" data-ma="dismiss">Propustit</button></div>
      </div>
      <div class="col" style="flex:1;min-width:0">
        <div class="orn"><span>Vybavení žoldáka</span></div>
        <div class="mercslots">${MERC_SLOTS.map((sl) => `<div class="mslotwrap"><span class="hint">${sl.name}</span>${this.slotHtml(m.equip[sl.id], `mslot ${sel?.slot === sl.id ? 'sel' : ''}" data-ms="${sl.id}`)}</div>`).join('')}</div>
        <div class="orn"><span>Co mu můžeš dát · ${fitList.length}</span></div>
        <div class="scroll mfits">${
          fitList.length
            ? fitList
                .map(({ it, i, slot, delta }) => {
                  const mark = delta > 0.005 ? `<b class="up">▲${Math.round(delta * 100)} %</b>` : delta < -0.005 ? `<b class="down">▼</b>` : `<b class="same">=</b>`;
                  return `<div class="mfit ${sel?.idx === i ? 'sel' : ''}" data-idx="${i}"><img src="${iconURL(itemIcon(it), 32)}"><span class="nm" style="color:${itemColor(it)}">${it.upgrade ? '+' + it.upgrade + ' ' : ''}${esc(it.name)}</span><span class="msl">${MERC_SLOTS.find((x) => x.id === slot)!.name}</span>${mark}<button class="btn green small" data-give="${i}">Dát</button></div>`;
                })
                .join('')
            : `<p class="hint">V batohu nemáš nic, co by ${esc(m.name)} unesl. ${esc(def.title)} používá: ${esc(def.uses.map((u) => BASE_BY_ID[u]?.noun ?? u).join(', '))}, každou zbroj a šperky.</p>`
        }</div>
        <div class="mercdet box">${detail}</div>
      </div>`;
    const redraw = () => this.merc(p);
    body.querySelectorAll<HTMLElement>('[data-ms]').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        const sl = c.dataset.ms as MercSlot;
        this.mercSel = m.equip[sl] ? { slot: sl } : null;
        redraw();
      }),
    );
    body.querySelectorAll<HTMLElement>('.mfit').forEach((c) =>
      c.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-give]')) return;
        const i = +c.dataset.idx!;
        if (!s.inventory[i]) return;
        sfx('ui');
        this.mercSel = { idx: i };
        redraw();
      }),
    );
    // a direct "give" from the list
    body.querySelectorAll<HTMLElement>('[data-give]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = +b.dataset.give!;
        const it = s.inventory[i];
        const slot = it ? mercSlotFor(m.role, it) : null;
        if (!it || !slot || !mercFits(m.role, slot, it)) return;
        const old = m.equip[slot] ?? null;
        m.equip[slot] = it;
        s.inventory[i] = old;
        this.mercSel = { slot };
        sfx('upgrade');
        this.afterMercGear();
        redraw();
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-ord]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx('ui');
        this.sc.setMercOrder(b.dataset.ord as MercOrder);
        redraw();
      }),
    );
    body.querySelector('[data-ma=give]')?.addEventListener('click', () => {
      const i = sel?.idx;
      if (i === undefined) return;
      const it = s.inventory[i];
      const slot = it ? mercSlotFor(m.role, it) : null;
      if (!it || !slot || !mercFits(m.role, slot, it)) return;
      const old = m.equip[slot] ?? null;
      m.equip[slot] = it;
      s.inventory[i] = old;
      this.mercSel = { slot };
      sfx('upgrade');
      this.afterMercGear();
      redraw();
    });
    body.querySelector('[data-ma=off]')?.addEventListener('click', () => {
      const sl = sel?.slot;
      if (!sl || !m.equip[sl]) return;
      const at = s.inventory.findIndex((x) => !x);
      if (at < 0) {
        this.ui.toast('Batoh je plný', '#ff8a7a');
        return;
      }
      s.inventory[at] = m.equip[sl]!;
      m.equip[sl] = null;
      this.mercSel = { idx: at };
      sfx('ui');
      this.afterMercGear();
      redraw();
    });
    body.querySelector('[data-ma=dismiss]')?.addEventListener('click', () =>
      this.ui.confirm('Propustit žoldáka?', `${m.name} odejde a jeho vybavení se vrátí do batohu. Peníze za najmutí se nevracejí.`, () => {
        this.sc.dismissMerc();
        this.mercSel = null;
        redraw();
      }, 'Propustit', 'Zpět'),
    );
    body.querySelector('[data-ma=change]')?.addEventListener('click', () => {
      // choosing another role: the hire cards, with this one leaving when a new one is hired
      const d = el(`<div class="panel"><div class="head"><h2>Jiný žoldák</h2><button class="close">✕</button></div><div class="body"><div class="col" style="flex:1;min-width:0"><div class="hint">${esc(m.name)} odejde (vybavení se vrátí do batohu) a místo něj přijde nový parťák za <b style="color:#ffd76a">${fmt(price)} zlata</b>.</div><div class="scroll" style="flex:1"><div class="mercgrid">${MERCS.filter((x) => x.role !== m.role)
        .map((x) => `<div class="merccard" style="--mc:${x.color}"><img src="${iconURL('pl_' + mercLook(x, s.cls), 64)}"><div class="mtxt"><div class="nm">${esc(x.title)}</div><div class="lv2">${esc(x.desc)}</div></div><button class="btn green small" data-hire="${x.role}" ${s.gold < price ? 'disabled' : ''}>Najmout</button></div>`)
        .join('')}</div></div></div></div></div>`);
      const close = this.ui.dialog(d);
      $('.close', d).addEventListener('click', () => close());
      d.querySelectorAll<HTMLElement>('[data-hire]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!this.sc.hireMerc(b.dataset.hire as MercRole, price)) return;
          sfx('levelup');
          this.ui.toast(`${s.merc!.name} se k tobě přidává!`, MERC_BY_ROLE[s.merc!.role].color);
          close();
          this.mercSel = null;
          redraw();
        }),
      );
    });
    if (!host) this.ui.showOverlay(p, () => {});
  }

  // ------------------------------------------------------------------ ALCHEMIST
  /** bag indices put into the cauldron */
  brew: number[] = [];

  /** transmuting in Loppo's laboratory (not at a wandering alchemist) */
  villageLab = false;

  transmute(host?: HTMLElement) {
    const p = host ?? this.frame('Alchymista – transmutace');
    const body = $('.body', p);
    const s = this.save;
    const f = this.sc.floor;
    // forget what left the bag meanwhile
    this.brew = this.brew.filter((i) => s.inventory[i] && !s.inventory[i]!.locked);
    const items = this.brew.map((i) => s.inventory[i]!);
    const r = items[0]?.rarity ?? -1;
    const full = items.length === TRANSMUTE_N;
    const cost = r >= 0 ? transmuteCost(r, f) : 0;
    // the grand laboratory in Loppo never fails
    const noFail = this.villageLab && buildingLevel(s, 'lab') >= 3;
    const odds = r >= 0 ? transmuteOdds(r, noFail).outcomes : [];
    const pct = (x: number) => (x >= 0.01 ? Math.round(x * 100) + ' %' : (x * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) + ' %');
    body.innerHTML = `
      <div class="col detail box scroll" style="width:min(320px,40%)">
        <p class="hint" style="margin:0 0 6px">Vlož do kotle ${TRANSMUTE_N} předmětů stejné vzácnosti. Spojí se v jeden – obvykle o stupeň lepší, někdy o dva, a s trochou štěstí i <b style="color:${RARITIES[PRIMAL].color}">${RARITIES[PRIMAL].name.toLowerCase()}</b>. Výsledek má druh jednoho z vložených předmětů.</p>
        <div class="kettle ${full ? 'full' : ''}">${Array.from({ length: TRANSMUTE_N }, (_, i) => this.slotHtml(items[i], `kslot" data-k="${i}`)).join('')}</div>
        ${
          r >= 0
            ? `<div class="odds">${odds
                .filter(([, x]) => x > 0)
                .map(([rr, x]) => `<div class="statline"><span style="color:${RARITIES[rr].color}">${rr === r ? `${RARITIES[rr].name} (nezdar)` : RARITIES[rr].name}</span><b>${pct(x)}</b></div>`)
                .join('')}</div>`
            : '<div class="hint">Kotel je prázdný.</div>'
        }
        <button class="btn green" data-a="brew" ${full && s.gold >= cost ? '' : 'disabled'} style="margin-top:8px">Spojit${full ? ` · ${cost.toLocaleString('cs-CZ')} zl.` : ` (${items.length}/${TRANSMUTE_N})`}</button>
        ${items.length ? '<button class="btn small" data-a="empty" style="margin-top:4px">Vyprázdnit kotel</button>' : ''}
      </div>
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Klepni na předmět v batohu (zamčené a ${RARITIES[PRIMAL].name.toLowerCase()} spojit nejde).</div>
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory
          .map((it, i) => {
            const usable = it && !it.locked && it.rarity < PRIMAL && (r < 0 || it.rarity === r) && !this.brew.includes(i);
            return this.slotHtml(it, `tinv ${this.brew.includes(i) ? 'sel' : usable ? '' : it ? 'dim' : ''}" data-idx="${i}`);
          })
          .join('')}</div></div>
        <div class="hint">Máš ${s.gold.toLocaleString('cs-CZ')} zlata. Volno v batohu: ${freeSlots(s)}.</div>
      </div>`;
    const redraw = () => this.transmute(p);
    body.querySelectorAll<HTMLElement>('.tinv').forEach((c) =>
      c.addEventListener('click', () => {
        const i = +c.dataset.idx!;
        const it = s.inventory[i];
        if (!it) return;
        if (this.brew.includes(i)) this.brew = this.brew.filter((x) => x !== i);
        else {
          if (it.locked) return void this.ui.toast('Zamčený předmět nejde spojit', '#ff8a7a');
          if (it.rarity >= PRIMAL) return void this.ui.toast(`${RARITIES[PRIMAL].name} předmět už výš nejde`, '#ff8a7a');
          if (r >= 0 && it.rarity !== r) return void this.ui.toast(`Do kotle patří jen ${RARITIES[r].name.toLowerCase()} předměty`, '#ff8a7a');
          if (this.brew.length >= TRANSMUTE_N) return void this.ui.toast('Kotel je plný', '#ff8a7a');
          this.brew.push(i);
        }
        sfx('ui');
        redraw();
      }),
    );
    body.querySelectorAll<HTMLElement>('.kslot').forEach((c) =>
      c.addEventListener('click', () => {
        const k = +c.dataset.k!;
        if (this.brew[k] === undefined) return;
        this.brew.splice(k, 1);
        sfx('ui');
        redraw();
      }),
    );
    body.querySelector('[data-a=empty]')?.addEventListener('click', () => {
      this.brew = [];
      sfx('ui');
      redraw();
    });
    body.querySelector('[data-a=brew]')?.addEventListener('click', () => {
      if (!full || s.gold < cost) return;
      const used = this.brew.map((i) => s.inventory[i]!);
      s.gold -= cost;
      for (const i of this.brew) {
        if (returnGems(s, s.inventory[i]!)) this.ui.toast('Drahokamy se vrátily do váčku', '#d08aff');
        s.inventory[i] = null;
      }
      this.brew = [];
      const res = transmute(used, f, Math.random, noFail);
      const at = s.inventory.findIndex((x) => !x);
      s.inventory[at] = res;
      const news = discoverItem(s, res);
      if (news) bus.emit('codex', news);
      bumpStat(s, 'transmutes');
      maxStat(s, 'bestRarity', res.rarity);
      saveGame(s);
      bus.emit('stats');
      // the brew bubbles, then shows what came out
      const kettle = $('.kettle', body);
      kettle.classList.add('brewing');
      sfx('magic');
      setTimeout(() => {
        const up = res.rarity - used[0].rarity;
        sfx(res.rarity >= PRIMAL ? 'boss' : up > 0 ? 'levelup' : 'ui');
        const d = el(`<div class="panel small brewres"><div class="head"><h2>${up >= 2 ? 'Mistrovské dílo!' : up === 1 ? 'Povedlo se!' : 'Nezdar…'}</h2></div><div style="padding:10px 14px">${this.itemDetailHtml(res)}<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn green" data-a="ok">Vzít</button></div></div></div>`);
        const close = this.ui.dialog(d);
        $('[data-a=ok]', d).addEventListener('click', () => {
          close();
          redraw();
        });
      }, 850);
    });
    if (!host) this.ui.showOverlay(p, () => {});
  }

  // ------------------------------------------------------------------ LOOT RULES
  /** for each rarity: keep picked-up items, sell them at once or salvage them at once */
  /** selling by quality: a tick for each colour, what it would bring, then everything ticked goes at once
   *  (locked items and set pieces stay; clear upgrades too while that box is ticked) */
  sellByQuality(onDone: () => void) {
    const s = this.sc.save;
    const d = el(`<div class="panel small sellpick"><div class="head"><h2>Prodat podle kvality</h2><button class="close">✕</button></div><div class="spbody"></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', close);
    const body = $('.spbody', d);
    const pick = new Set(settings.sellPick.filter((r) => r >= 0 && r < RARITIES.length));
    let keepUp = settings.keepUpgrades;
    const matching = (r: number) =>
      s.inventory.map((it, i) => ({ it, i })).filter(({ it }) => !!it && it.rarity === r && !it.locked && !it.set && !(keepUp && this.sc.loot.isUpgrade(it!, UPGRADE_KEEP)));
    const render = () => {
      let n = 0,
        g = 0;
      const rows = RARITIES.map((r, i) => {
        const m = matching(i);
        const v = m.reduce((a, x) => a + itemValue(x.it!), 0);
        if (pick.has(i)) {
          n += m.length;
          g += v;
        }
        return `<button class="hcbox sprow ${pick.has(i) ? 'on' : ''} ${m.length ? '' : 'empty'}" data-r="${i}"><span class="tick"></span><span class="hctext"><b style="color:${r.color}">${esc(r.name)}</b><small>${m.length ? `${m.length}× · ${v.toLocaleString('cs-CZ')} zl.` : 'nic v batohu'}</small></span></button>`;
      }).join('');
      body.innerHTML = `<p class="hint">Zaškrtni barvy, které chceš prodat. Zamčené předměty a části sad zůstanou.</p>
        <div class="sprows">${rows}</div>
        <button class="hcbox ${keepUp ? 'on' : ''}" data-a="upg"><span class="tick"></span><span class="hctext"><b>Vylepšení si nechat</b><small>Předmět aspoň o 12 % lepší než ten, co máš na sobě (▲), se neprodá.</small></span></button>
        <div class="row" style="justify-content:center;gap:10px"><button class="btn gold" data-a="sell" ${n ? '' : 'disabled'}>Prodat ${n}× za ${g.toLocaleString('cs-CZ')} zl.</button></div>`;
      body.querySelectorAll<HTMLElement>('[data-r]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          const r = +b.dataset.r!;
          if (pick.has(r)) pick.delete(r);
          else pick.add(r);
          settings.sellPick = [...pick].sort();
          saveSettings();
          render();
        }),
      );
      $('[data-a=upg]', body).addEventListener('click', () => {
        sfx('ui');
        keepUp = !keepUp;
        render();
      });
      $('[data-a=sell]', body).addEventListener('click', () => {
        const all = [...pick].flatMap((r) => matching(r));
        if (!all.length) return;
        const go = () => {
          let total = 0;
          for (const { it, i } of all) {
            const price = itemValue(it!);
            if (returnGems(s, it!)) this.ui.toast('Drahokamy se vrátily do váčku', '#d08aff');
            this.sold(it!, price);
            s.inventory[i] = null;
            total += price;
          }
          s.gold += total;
          this.multi = null;
          this.sel = null;
          sfx('coin');
          this.ui.toast(`Prodáno: ${all.length}× za ${total.toLocaleString('cs-CZ')} zlata`, '#ffd76a');
          close();
          onDone();
        };
        // something valuable among them: ask first
        const best = Math.max(...all.map((x) => x.it!.rarity));
        if (best >= 3) this.ui.confirm(`Prodat ${all.length} předmětů?`, `Je mezi nimi i ${RARITIES[best].name.toLowerCase()} předmět – prodej se nedá vzít zpět.`, go, 'Prodat', 'Ponechat');
        else go();
      });
    };
    render();
  }

  lootRules(onClose?: () => void) {
    const d = el(`<div class="panel small lootrules"><div class="head"><h2>Automatická kořist</h2><button class="close">✕</button></div><div class="lrbody"></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => {
      close();
      onClose?.();
    });
    const body = $('.lrbody', d);
    const names: Record<LootRule, string> = { keep: 'Nechat', sell: 'Prodat', salvage: 'Rozebrat' };
    const render = () => {
      body.innerHTML = `<p class="hint">Co se stane s předmětem, když ho sebereš. Prodané dají zlato hned, rozebrané zlato a materiál. Sady a zamčené věci se nechávají vždy.</p>
        <div class="lrquick"><span>Prodávat vše až po:</span>${[1, 2, 3]
          .map((q) => `<button class="btn small" data-upto="${q}" style="color:${RARITIES[q].color}">${esc(RARITIES[q].name)}</button>`)
          .join('')}</div>
        ${RARITIES.map(
          (r, i) => `<div class="lrrow"><span class="lrname" style="color:${r.color}">${esc(r.name)}</span>${(['keep', 'sell', 'salvage'] as LootRule[])
            .map((k) => `<button class="btn small ${(settings.lootRules[i] ?? 'keep') === k ? (k === 'keep' ? 'green' : k === 'sell' ? 'gold' : 'purple') : ''}" data-r="${i}" data-k="${k}">${names[k]}</button>`)
            .join('')}</div>`,
        ).join('')}
        <button class="hcbox ${settings.keepUpgrades ? 'on' : ''}" data-a="upg"><span class="tick"></span><span class="hctext"><b>Vylepšení si vždy nechat</b><small>Předmět aspoň o 12 % lepší než ten, co máš na sobě (▲), se neprodá ani nerozebere.</small></span></button>`;
      body.querySelectorAll<HTMLElement>('[data-upto]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          const q = +b.dataset.upto!;
          for (let i = 0; i < RARITIES.length; i++) settings.lootRules[i] = i <= q ? 'sell' : 'keep';
          saveSettings();
          render();
        }),
      );
      body.querySelectorAll<HTMLElement>('[data-k]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          settings.lootRules[+b.dataset.r!] = b.dataset.k as LootRule;
          for (let i = 0; i < RARITIES.length; i++) settings.lootRules[i] ??= 'keep';
          saveSettings();
          render();
        }),
      );
      $('[data-a=upg]', body).addEventListener('click', () => {
        sfx('ui');
        settings.keepUpgrades = !settings.keepUpgrades;
        saveSettings();
        render();
      });
    };
    render();
  }

  // ------------------------------------------------------------------ WANDERING ADVENTURER
  /** meeting an adventurer: their words and what the hero can answer */
  /** someone met in the dungeon speaks; the hero answers with one of the choices */
  talk(o: { title: string; sub?: string; portrait?: string; line: string; choices: { id: string; label: string; cls?: string; disabled?: boolean }[] }, onPick: (choice: string) => void) {
    const img = o.portrait ? iconURL(o.portrait, 64) : '';
    const d = el(`<div class="panel small rivaltalk evtalk"><div class="head"><h2>${esc(o.title)}</h2></div>
      <div class="rtbody">${img ? `<img src="${img}">` : ''}<div style="min-width:0">${o.sub ? `<div class="hint">${esc(o.sub)}</div>` : ''}<p class="rtline">${o.line.startsWith('„') ? esc(o.line) : `„${esc(o.line)}“`}</p></div></div>
      <div class="row rtbtns">${o.choices.map((c) => `<button class="btn ${c.cls ?? ''}" data-rc="${c.id}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div></div>`);
    const close = this.ui.dialog(d);
    d.querySelectorAll<HTMLButtonElement>('[data-rc]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.disabled) return;
        sfx('ui');
        close();
        onPick(b.dataset.rc!);
      }),
    );
  }

  /** a letter found on the dead or words cut into a wall */
  note(title: string, text: string, kind: 'note' | 'wall', after?: () => void) {
    const d = el(`<div class="panel small lorenote ${kind}"><div class="head"><h2>${esc(title)}</h2></div>
      <div class="lorebody"><p>${esc(text)}</p></div>
      <div class="row rtbtns"><button class="btn green" data-a="ok">Zavřít</button></div></div>`);
    const close = this.ui.dialog(d);
    $('[data-a=ok]', d).addEventListener('click', () => {
      sfx('ui');
      close();
      after?.();
    });
  }

  /** picks an item of the bag to give away (the altar of change) */
  offerItem(title: string, hint: string, onPick: (idx: number) => void, giveLabel = 'Položit na oltář', canGive: (it: Item) => boolean = () => true) {
    const s = this.save;
    const d = el(`<div class="panel offerpick"><div class="head"><h2>${esc(title)}</h2><button class="close">✕</button></div>
      <div class="body"><div class="col" style="flex:1;min-width:0"><div class="hint">${esc(hint)}</div>
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `oinv" data-idx="${i}`)).join('')}</div></div></div>
        <div class="col detail box scroll" style="width:min(300px,40%)"><p class="hint">Vyber předmět z batohu.</p></div></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
    const detail = $('.detail', d);
    d.querySelectorAll<HTMLElement>('.slot.oinv').forEach((sl) =>
      sl.addEventListener('click', () => {
        const i = +sl.dataset.idx!;
        const it = s.inventory[i];
        if (!it) return;
        sfx('ui');
        d.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        detail.scrollTop = 0;
        const ok = !it.locked && canGive(it);
        detail.innerHTML = this.itemDetailHtml(it, `<div class="row eqrow"><button class="btn gold" data-a="give" ${ok ? '' : 'disabled'}>${it.locked ? 'Zamčený předmět' : ok ? esc(giveLabel) : 'Tohle nestačí'}</button></div>`);
        $('[data-a=give]', detail).addEventListener('click', () => {
          if (!ok) return;
          close();
          onPick(i);
        });
      }),
    );
  }

  rivalTalk(r: Mercenary, mood: RivalMood, line: string, level: number, toll: number, onPick: (choice: string) => void) {
    const opts: [string, string, string][] =
      mood === 'friendly'
        ? [
            ['join', 'Pojďme spolu', 'green'],
            ['no', 'Každý sám', ''],
          ]
        : mood === 'trader'
          ? [
              ['shop', 'Ukaž zboží', 'green'],
              ['no', 'Ne, díky', ''],
            ]
          : [
              ['pay', `Zaplatit ${toll.toLocaleString('cs-CZ')} zlata`, 'gold'],
              ['fight', 'Bojovat!', 'red'],
            ];
    const cls = CLASS_BY_ID[r.state.look ?? 'warrior'];
    const d = el(`<div class="panel small rivaltalk"><div class="head"><h2>${esc(r.state.name)}</h2></div>
      <div class="rtbody"><img src="${iconURL(r.spriteKey, 64)}"><div style="min-width:0"><div class="hint">${esc(cls.name)} • úroveň ${level}${mood === 'hostile' ? ' • <span style="color:#ff8a7a">nepřátelsky naladěn' + (r.state.fem ? 'á' : 'ý') + '</span>' : ''}</div><p class="rtline">„${esc(line)}“</p></div></div>
      <div class="row rtbtns">${opts.map(([id, label, cl]) => `<button class="btn ${cl}" data-rc="${id}">${esc(label)}</button>`).join('')}</div></div>`);
    const close = this.ui.dialog(d);
    d.querySelectorAll<HTMLElement>('[data-rc]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx('ui');
        close();
        onPick(b.dataset.rc!);
      }),
    );
  }

  /** a trading adventurer's pack: three items for gold, a bit cheaper than the merchant */
  rivalShop(r: Mercenary, wares: (Item | null)[]) {
    const s = this.save;
    const price = (it: Item) => Math.round(buyPrice(it) * 0.8);
    let sel = -1;
    const d = el(`<div class="panel small rivalshop"><div class="head"><h2>Batoh: ${esc(r.state.name)}</h2><button class="close">✕</button></div><div class="rsbody"></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
    const body = $('.rsbody', d);
    const render = () => {
      const it = sel >= 0 ? wares[sel] : null;
      body.innerHTML = `<div class="hint">Máš ${s.gold.toLocaleString('cs-CZ')} zlata.</div>
        <div class="grid" style="grid-template-columns:repeat(3,64px);justify-content:center">${wares.map((w, i) => this.slotHtml(w, `rsw ${i === sel ? 'sel' : ''}" data-i="${i}`, w ? '' : 'prodáno', w ? price(w) : undefined)).join('')}</div>
        <div class="box" style="margin-top:6px;max-height:42vh;overflow-y:auto">${it ? this.itemDetailHtml(it, `<button class="btn green small" data-a="buy" ${s.gold < price(it) ? 'disabled' : ''}>Koupit za ${price(it).toLocaleString('cs-CZ')}</button>`, true) : '<div class="hint">Vyber předmět.</div>'}</div>`;
      body.querySelectorAll<HTMLElement>('.rsw').forEach((c) =>
        c.addEventListener('click', () => {
          if (!wares[+c.dataset.i!]) return;
          sfx('ui');
          sel = +c.dataset.i!;
          render();
        }),
      );
      body.querySelector('[data-a=buy]')?.addEventListener('click', () => {
        const w = wares[sel];
        if (!w || s.gold < price(w)) return;
        if (!addToInventory(s, w)) {
          this.ui.toast('Inventář je plný!', '#ff6060');
          return;
        }
        s.gold -= price(w);
        wares[sel] = null;
        sel = -1;
        sfx('coin');
        bus.emit('stats');
        saveGame(s);
        render();
      });
    };
    render();
  }

  /** the mercenary's gear changed: new numbers and a new weapon in its hand */
  afterMercGear() {
    const live = this.sc.merc;
    if (live) {
      live.recalc();
      live.makeWeapons();
    }
    saveGame(this.save);
  }

  // ------------------------------------------------------------------ SPELLS
  spellTab: 'class' | 'universal' | 'talents' | 'multi' = 'class';
  selSpell: string | null = null;

  spells(host?: HTMLElement) {
    const p = host ?? this.frame('Kouzla a schopnosti', [
      { id: 'class', label: CLASS_BY_ID[this.save.cls].name },
      ...(this.save.multi ? [{ id: 'multi', label: CLASS_BY_ID[this.save.multi].name }] : []),
      { id: 'universal', label: 'Univerzální' },
      { id: 'talents', label: freeTalentPoints(this.save) > 0 ? `Talenty (${freeTalentPoints(this.save)})` : 'Talenty' },
    ], this.spellTab === 'multi' && !this.save.multi ? 'class' : this.spellTab);
    if (!host) {
      p.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
        t.addEventListener('click', () => {
          this.spellTab = t.dataset.tab as any;
          p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
          this.selSpell = null;
          this.spells(p);
        }),
      );
    }
    if (this.spellTab === 'talents') {
      this.talentsView(p);
      if (!host) this.ui.showOverlay(p, () => {});
      return;
    }
    const body = $('.body', p);
    const s = this.save;
    if (this.spellTab === 'multi' && !s.multi) this.spellTab = 'class';
    const list = spellsForClass(this.spellTab === 'class' ? s.cls : this.spellTab === 'multi' ? s.multi! : 'universal');
    const slotNames = ['Kouzlo 1', 'Kouzlo 2', 'Kouzlo 3', 'Ultimátní', 'Univerzální'];
    const loadout = s.loadout
      .map((id, i) => {
        const sp = id ? SPELL_BY_ID[id] : null;
        return `<div class="lslot ${i === 3 ? 'ult' : i === 4 ? 'uni' : ''}" data-slot="${i}" title="${slotNames[i]}"><img src="${sp ? spellIcon(sp.icon, sp.color, 80) : spellIcon('plus', '#444444', 80)}"><span class="n">${slotNames[i]}</span></div>`;
      })
      .join('');
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="box"><div class="loadout">${loadout}</div><div class="hint" style="text-align:center;margin-top:4px">3 běžná kouzla + 1 ultimátní + 1 univerzální. Základní útok je automatický.</div></div>
        <div class="row" style="justify-content:space-between"><span>Body kouzel: <b style="color:${s.spellPoints ? '#6dff7a' : '#fff'}">${s.spellPoints}</b></span><span class="hint">Úroveň postavy ${s.level}</span></div>
        <div class="scroll" style="flex:1"><div class="spgrid">${list
          .map((sp) => {
            const locked = sp.lvl > s.level;
            const rank = spellRank(s, sp.id);
            return `<div class="spcard ${locked ? 'locked' : ''} ${sp.ult ? 'ult' : ''} ${this.selSpell === sp.id ? 'sel' : ''}" data-id="${sp.id}"><img src="${spellIcon(sp.icon, sp.color, 80)}"><div><div class="nm">${esc(sp.name)}${sp.ult ? ' <span style="color:#ffb347">★</span>' : ''}</div><div class="lv2">${locked ? `🔒 úroveň ${sp.lvl}` : `<span class="rank">stupeň ${rank}/${MAX_SPELL_RANK}</span>`}${s.loadout.includes(sp.id) ? ' • ✓' : ''}</div></div></div>`;
          })
          .join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(320px,36%)"></div>`;
    const detail = $('.detail', body);
    const renderDetail = () => {
      const id = this.selSpell;
      if (!id) {
        detail.innerHTML = `<p class="hint">Vyber kouzlo ze seznamu. Kouzla se odemykají s úrovní postavy (poslední až na úrovni 80).</p><p class="hint">Body kouzel (1 za úroveň) zesilují kouzla: +15 % síly a −2 % přebíjení za stupeň.</p><p class="hint">Při změně classy se body z kouzel staré classy vrátí jako volné.</p>`;
        return;
      }
      const sp = SPELL_BY_ID[id];
      detail.innerHTML = this.spellDetailHtml(sp);
      detail.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          const a = b.dataset.a!;
          if (a === 'srin') {
            this.spellRunePicker(sp, () => {
              this.spells(p);
              this.ui.refreshSkills();
            });
            return;
          }
          if (a === 'srout') {
            const r = s.spellRunes?.[sp.id];
            if (r) {
              addSpellRune(s, r);
              delete s.spellRunes![sp.id];
              saveGame(s);
            }
            this.spells(p);
            this.ui.refreshSkills();
            return;
          }
          if (a === 'invest') {
            if (!canInvest(s, sp.id)) return;
            s.spellPoints--;
            s.spellRanks[sp.id] = (s.spellRanks[sp.id] ?? 0) + 1;
          } else if (a.startsWith('slot')) {
            const i = +a.slice(4);
            // remove from other slots; a multiclass hero carries only one spell of the second class
            s.loadout = s.loadout.map((x) => (x === sp.id ? null : x));
            if (s.multi && sp.cls === s.multi) s.loadout = s.loadout.map((x, j) => (j < 3 && x && SPELL_BY_ID[x]?.cls === s.multi ? null : x));
            s.loadout[i] = sp.id;
            this.sc.player.cds[i] = Math.max(this.sc.player.cds[i], 1);
          }
          this.spells(p);
          this.ui.refreshSkills();
        }),
      );
    };
    body.querySelectorAll<HTMLElement>('.spcard').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        this.selSpell = c.dataset.id!;
        body.querySelectorAll('.spcard').forEach((x) => x.classList.toggle('sel', x === c));
        renderDetail();
      }),
    );
    body.querySelectorAll<HTMLElement>('.lslot').forEach((c) =>
      c.addEventListener('click', () => {
        const i = +c.dataset.slot!;
        const id = s.loadout[i];
        if (id) {
          this.selSpell = id;
          const sp = SPELL_BY_ID[id];
          if ((sp.cls === 'universal') !== (this.spellTab === 'universal')) {
            this.spellTab = sp.cls === 'universal' ? 'universal' : 'class';
            p.querySelectorAll<HTMLElement>('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === this.spellTab));
          }
          this.spells(p);
        }
      }),
    );
    renderDetail();
    if (!host) this.ui.showOverlay(p, () => {});
  }

  spellDetailHtml(sp: SpellDef) {
    const s = this.save;
    const sc = this.sc;
    const locked = sp.lvl > s.level;
    const rank = Math.max(1, spellRank(s, sp.id));
    const rankMult = 1 + 0.15 * (rank - 1);
    let dmgTxt = '';
    for (const f of sp.fx) {
      if (f.p !== undefined && !['buff', 'heal', 'shield', 'summon', 'mana', 'stealth'].includes(f.t)) {
        const base = sp.scale === 'weapon' ? sc.player.weaponHit() : sc.player.spellBase();
        const v = Math.round(base * f.p * rankMult);
        const per = f.t === 'field' ? ' / s' : f.t === 'whirl' ? ' / zásah' : '';
        dmgTxt += `<div class="main">Poškození: <b>${v}${per}</b> <span class="hint">(${Math.round(f.p * rankMult * 100)} % ${sp.scale === 'weapon' ? 'zbraně' : 'síly kouzel'})</span></div>`;
        if (f.n && f.n > 1) dmgTxt += `<div class="hint">× ${f.n} ${f.t === 'rain' ? 'zásahů' : f.t === 'proj' ? 'projektilů' : f.t === 'summon' ? '' : ''}</div>`;
      }
      if (f.t === 'heal') dmgTxt += `<div class="main">Léčení: <b>${Math.round((f.heal ?? 0) * 100 * (1 + 0.08 * (rank - 1)))} %</b> max. HP</div>`;
      if (f.t === 'shield') dmgTxt += `<div class="main">Štít: <b>${Math.round((f.heal ?? 0) * 100 * (1 + 0.08 * (rank - 1)))} %</b> max. HP na ${f.dur} s</div>`;
      if (f.t === 'summon') dmgTxt += `<div class="main">Vyvolá: <b>${f.n ?? 1}×</b> na ${f.dur} s</div>`;
      if (f.t === 'buff' && f.dur) dmgTxt += `<div class="main">Trvání: <b>${Math.round(f.dur * (1 + 0.05 * (rank - 1)))} s</b></div>`;
    }
    const type = sp.ult ? '<span style="color:#ffb347">Ultimátní kouzlo</span>' : sp.cls === 'universal' ? '<span style="color:#7dff9a">Univerzální kouzlo</span>' : s.multi && sp.cls === s.multi ? '<span style="color:#c77dff">Kouzlo druhé classy (jen jedno ve slotech)</span>' : 'Kouzlo classy';
    let btns = '';
    if (!locked && s.multi && sp.cls === s.multi && sp.ult) btns = '';
    else if (!locked) {
      if (sp.cls === 'universal') btns += [0, 1, 2].map((i) => `<button class="btn small blue" data-a="slot${i}">Slot ${i + 1}</button>`).join('') + `<button class="btn small green" data-a="slot4">Univerzální slot</button>`;
      else if (sp.ult) btns += `<button class="btn small" data-a="slot3">Ultimátní slot</button>`;
      else btns += [0, 1, 2].map((i) => `<button class="btn small blue" data-a="slot${i}">Slot ${i + 1}</button>`).join('');
    }
    return `<div style="display:flex;gap:8px;align-items:center"><img style="width:56px;height:56px;border-radius:8px" src="${spellIcon(sp.icon, sp.color, 112)}"><div><h3 style="color:${sp.color}">${esc(sp.name)}</h3><div class="sub">${type}</div></div></div>
      <p style="margin:6px 0;font-size:18px">${esc(sp.desc)}</p>
      ${dmgTxt}
      <div class="statline"><span>Mana</span><b style="color:#7fb2ff">${sc.spells.manaCost(sp)}</b></div>
      <div class="statline"><span>Přebíjení</span><b>${sc.spells.cooldown(sp).toFixed(1).replace('.', ',')} s</b></div>
      <div class="statline"><span>Odemčení</span><b>${locked ? '🔒 ' : ''}úroveň ${sp.lvl}</b></div>
      <div class="statline"><span>Stupeň</span><b class="rank">${locked ? '-' : rank + ' / ' + MAX_SPELL_RANK}</b></div>
      ${!locked ? `<div class="row" style="margin-top:8px"><button class="btn green" data-a="invest" ${canInvest(s, sp.id) ? '' : 'disabled'}>Vylepšit (+1 bod)</button></div>` : ''}
      ${btns ? `<div class="hint" style="margin-top:8px">Přiřadit do slotu:</div><div class="row">${btns}</div>` : ''}
      ${locked ? '' : this.spellRuneBoxHtml(sp)}`;
  }

  // ------------------------------------------------------------------ TALENTS
  /** the class's talent tree: three branches, a point into a talent with one tap */
  /** which tree the talents tab shows: the hero's class or the second class */
  talentTree: 'main' | 'multi' = 'main';

  talentsView(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const ranks = (s.talents ??= {});
    const total = talentPoints(s.level);
    const respec = Math.round(150 * s.level * (1 + s.level / 40) * respecMult(s));
    if (!s.multi) this.talentTree = 'main';
    const second = this.talentTree === 'multi' && !!s.multi;
    const branches = TALENT_TREES[second ? s.multi! : s.cls];
    // the second class's tree takes at most a few points
    const free = second ? Math.min(freeTalentPoints(s), MULTI_TALENT_CAP - multiTalentSpent(s)) : freeTalentPoints(s);
    const statText = (tl: TalentDef, r: number) =>
      tl.stats
        ? Object.entries(tl.stats)
            .map(([k, v]) => formatStat(k as any, Math.round((v as number) * Math.max(1, r) * 10) / 10))
            .join(', ') + (tl.when ? ` (${COND_NAME[tl.when]})` : '')
        : (tl.desc ?? POWER_BY_ID[tl.special ?? '']?.desc ?? SPECIAL_BY_ID[tl.special ?? '']?.desc ?? '');
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="row tlhead"><span>Volné body talentů: <b style="color:${freeTalentPoints(s) > 0 ? '#9dff9d' : '#fff'}">${freeTalentPoints(s)}</b> z ${total} <span class="hint">(bod za každou druhou úroveň)</span></span>${
        s.multi
          ? `<span class="row" style="gap:4px"><button class="btn small ${second ? '' : 'gold'}" data-tree="main">${esc(CLASS_BY_ID[s.cls].name)}</button><button class="btn small ${second ? 'gold' : ''}" data-tree="multi">${esc(CLASS_BY_ID[s.multi].name)} (${multiTalentSpent(s)}/${MULTI_TALENT_CAP})</button></span>`
          : ''
      }<button class="btn small red" data-a="respec" ${total - freeTalentPoints(s) > 0 && s.gold >= respec ? '' : 'disabled'}>Zapomenout vše · ${respec.toLocaleString('cs-CZ')} zl.</button></div>
      <div class="scroll" style="flex:1"><div class="tltree">${branches
        .map((b) => {
          const spent = spentIn(ranks, b);
          return `<div class="tlbranch" style="--bc:${b.color}"><div class="tlbname">${esc(b.name)} <span class="hint">${spent} b.</span></div>${b.talents
            .map((tl, i) => {
              const r = ranks[tl.id] ?? 0;
              const open = spent >= TALENT_GATE[i];
              const can = canLearn(ranks, b, i, free);
              return `<div class="tlnode ${r ? 'has' : ''} ${open ? '' : 'locked'} ${r >= tl.max ? 'max' : ''} ${tl.special ? 'cap' : ''}"><div class="tltop"><b>${esc(tl.name)}</b><span class="tlr">${r}/${tl.max}</span></div><div class="lv2">${esc(statText(tl, 1))}${tl.max > 1 && !tl.special ? ' <span class="hint">za stupeň</span>' : ''}${tl.max > 1 && r > 1 ? `<br><span style="color:#9dff9d">celkem ${esc(statText(tl, r))}</span>` : ''}</div>${open ? (r < tl.max ? `<button class="btn small green" data-tl="${tl.id}" ${can ? '' : 'disabled'}>+1</button>` : '') : `<div class="hint">🔒 ${TALENT_GATE[i]} bodů ve větvi</div>`}</div>`;
            })
            .join('')}</div>`;
        })
        .join('')}</div></div></div>`;
    body.querySelectorAll<HTMLElement>('[data-tl]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.tl!;
        const b = branches.find((x) => x.talents.some((tl) => tl.id === id))!;
        const i = b.talents.findIndex((tl) => tl.id === id);
        const left = second ? Math.min(freeTalentPoints(s), MULTI_TALENT_CAP - multiTalentSpent(s)) : freeTalentPoints(s);
        if (!canLearn(ranks, b, i, left)) return;
        ranks[id] = (ranks[id] ?? 0) + 1;
        sfx('upgrade');
        this.sc.player.recalc();
        bus.emit('stats');
        saveGame(s);
        this.refreshTalentTab(p);
        this.talentsView(p);
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-tree]').forEach((b) =>
      b.addEventListener('click', () => {
        sfx('ui');
        this.talentTree = b.dataset.tree as 'main' | 'multi';
        this.talentsView(p);
      }),
    );
    body.querySelector('[data-a=respec]')?.addEventListener('click', () =>
      this.ui.confirm('Zapomenout talenty?', `Všechny body talentů se vrátí a můžeš je rozdělit znovu. Stojí to ${respec.toLocaleString('cs-CZ')} zlata.`, () => {
        if (s.gold < respec) return;
        s.gold -= respec;
        s.talents = {};
        this.sc.player.recalc();
        bus.emit('stats');
        saveGame(s);
        this.refreshTalentTab(p);
        this.talentsView(p);
      }, 'Zapomenout', 'Zpět'),
    );
  }

  /** the tab shows how many points are left */
  refreshTalentTab(p: HTMLElement) {
    const tab = p.querySelector<HTMLElement>('.tab[data-tab=talents]');
    const n = freeTalentPoints(this.save);
    if (tab) tab.textContent = n > 0 ? `Talenty (${n})` : 'Talenty';
  }

  /** the rune slot of a spell: the rune in it (take it out) or the runes in the bag (set one) */
  spellRuneBoxHtml(sp: SpellDef) {
    const s = this.save;
    const rune = s.spellRunes?.[sp.id];
    const def = rune ? SPELL_RUNE_BY_ID[rune] : null;
    const owned = Object.values(s.spellRuneBag ?? {}).reduce((a, b) => a + b, 0);
    return `<div class="box srbox"><b style="color:#d08aff">Runa kouzla</b>${
      def
        ? `<div class="srrow"><img src="${iconURL(spellRuneIcon(def.id), 30)}"><div style="min-width:0"><div style="color:${def.color}">${esc(def.name)}</div><div class="lv2">${esc(def.desc)}</div></div></div><button class="btn small" data-a="srout">Vyjmout runu</button>`
        : `<div class="hint">Runa změní, jak kouzlo funguje. Padají ze strážců, šampionů, nemesis a truhel.</div><button class="btn small purple" data-a="srin" ${owned ? '' : 'disabled'}>Vsadit runu (${owned} v batohu)</button>`
    }</div>`;
  }

  /** choose a spell rune from the bag for a spell */
  spellRunePicker(sp: SpellDef, after: () => void) {
    const s = this.save;
    const bag = s.spellRuneBag ?? {};
    const ids = Object.keys(bag).filter((k) => bag[k] > 0 && SPELL_RUNE_BY_ID[k]);
    const d = el(`<div class="panel small"><div class="head"><h2>Runa pro: ${esc(sp.name)}</h2><button class="close">✕</button></div><div style="padding:10px"><div class="gemlist">${ids
      .map((k) => {
        const r = SPELL_RUNE_BY_ID[k];
        return `<button class="spcard gempick" data-sr="${k}"><img src="${iconURL(spellRuneIcon(k), 30)}"><div><div class="nm" style="color:${r.color}">${esc(r.name)} <span class="hint">×${bag[k]}</span></div><div class="lv2">${esc(r.desc)}</div></div></button>`;
      })
      .join('')}</div></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
    d.querySelectorAll<HTMLElement>('[data-sr]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.sr!;
        if (!bag[k]) return close();
        addSpellRune(s, k, -1);
        (s.spellRunes ??= {})[sp.id] = k;
        sfx('upgrade');
        this.ui.toast(`${SPELL_RUNE_BY_ID[k].name} → ${sp.name}`, SPELL_RUNE_BY_ID[k].color);
        saveGame(s);
        close();
        after();
      }),
    );
  }

  // ------------------------------------------------------------------ MERCHANT
  merchantTab: 'buy' | 'sell' | 'forge' | 'class' | 'stash' = 'buy';

  curStock: MerchantStock | null = null;

  /** a mystery bag costs well above what it gives on average, and every further bag from the same merchant
   *  costs 40 % more than the one before */
  mysteryPrice(id: MysteryId) {
    const f = this.sc.floor;
    const bought = this.curStock?.mystery ?? 0;
    return Math.round(520 * (1 + 0.18 * f) * (id === 'any' ? 0.8 : 1) * Math.pow(1.4, bought));
  }

  rollMystery(id: MysteryId): Item {
    const f = this.sc.floor;
    const main = this.save.equip.main ? BASE_BY_ID[this.save.equip.main.base] : null;
    const filters: Record<MysteryId, ((b: BaseType) => boolean) | undefined> = {
      weapon: (b) => (b.cat === 'weapon1h' || b.cat === 'weapon2h') && (!main?.attack || b.attack === main.attack),
      armor: (b) => ['helmet', 'chest', 'pants', 'belt', 'boots', 'shield'].includes(b.cat),
      jewel: (b) => ['ring', 'amulet', 'bracer'].includes(b.cat),
      any: undefined,
    };
    // uncommon 45 %, rare 32 %, epic 16 %, legendary 6 %, mythic 1 %
    const x = Math.random();
    const rarity = x < 0.45 ? 1 : x < 0.77 ? 2 : x < 0.93 ? 3 : x < 0.99 ? 4 : 5;
    // a legendary roll can be a set piece of the asked kind (armour, jewel or anything)
    if (rarity === 4 && f >= SET_MIN_FLOOR && Math.random() < 0.35) {
      const fit = SETS.flatMap((st) => st.pieces.map((pc, i) => ({ st, i, base: BASE_BY_ID[pc.base] }))).filter((c) => !filters[id] || filters[id]!(c.base));
      const pick = fit[Math.floor(Math.random() * fit.length)];
      if (pick) return generateSetItem(f + 1, pick.st.id, pick.i);
    }
    return generateItem(f + 1, { rarity, filter: filters[id] });
  }

  // sold items stay at the merchant for a while so an accidental sale can be undone
  private sold(it: Item, price: number) {
    const st = this.curStock;
    if (!st) return;
    (st.buyback ??= []).unshift({ it, price });
    st.buyback.length = Math.min(st.buyback.length, 12);
  }

  merchant(stock: MerchantStock, host?: HTMLElement) {
    this.curStock = stock;
    const tabs = [
      { id: 'buy', label: 'Koupit' },
      { id: 'sell', label: 'Prodat' },
      { id: 'forge', label: 'Kovárna' },
      { id: 'stash', label: 'Úložiště' },
      { id: 'class', label: 'Změna classy' },
    ];
    const p = host ?? this.frame('Obchodník', tabs, this.merchantTab);
    if (!host) {
      this.sel = null;
      p.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
        t.addEventListener('click', () => {
          sfx('ui');
          this.merchantTab = t.dataset.tab as any;
          p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
          this.sel = null;
          this.merchant(stock, p);
        }),
      );
      this.ui.showOverlay(p, () => {});
    }
    this.headMats(p);
    if (this.merchantTab === 'sell') return this.inventory('sell', p);
    if (this.merchantTab === 'forge') return this.forge(p);
    if (this.merchantTab === 'class') return this.classChange(p);
    if (this.merchantTab === 'stash') return this.stash(p);
    const body = $('.body', p);
    const s = this.save;
    const mysteryLeft = Math.max(0, MYSTERY_PER_MERCHANT - (stock.mystery ?? 0));
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Zboží se u každého obchodníka liší. Klepni na předmět pro detail.</div>
        <div class="scroll" style="flex:1"><div class="grid">${stock.items.map((it, i) => this.slotHtml(it, `shop" data-idx="${i}`, '', buyPrice(it))).join('')}</div>
        ${stock.buyback?.length ? `<b style="color:#ffd76a;display:block;margin-top:8px">Zpětný odkup</b><div class="hint">Tvé prodané předměty – koupíš je zpět za stejnou cenu.</div><div class="grid">${stock.buyback.map((b, i) => this.slotHtml(b.it, `back" data-idx="${i}`, '', b.price)).join('')}</div>` : ''}
        <div class="box" style="margin-top:8px"><b style="color:#ffd76a">Tajemné zboží</b> <span class="hint">předmět neznámé kvality · ${mysteryLeft ? `zbývá ${mysteryLeft} z ${MYSTERY_PER_MERCHANT}, každý další dražší` : 'vyprodáno – další obchodník bude mít nové'}</span>
          <div class="mystery">${MYSTERY.map(
            (m) => `<div class="myst"><div class="slot r2"><img src="${iconURL(m.icon, 64)}"><span class="q">?</span></div><div class="nm">${m.name}</div><button class="btn small green" data-myst="${m.id}" ${!mysteryLeft || s.gold < this.mysteryPrice(m.id) ? 'disabled' : ''}>${mysteryLeft ? this.mysteryPrice(m.id).toLocaleString('cs-CZ') + ' zl.' : '—'}</button></div>`,
          ).join('')}</div>
        </div>
        <div class="box" style="margin-top:8px">${stock.mats
          .map(
            (m, i) => `<div class="statline" style="align-items:center"><span class="row"><img style="width:28px;height:28px;image-rendering:pixelated" src="${iconURL(MAT_INFO[m.key].icon, 32)}">${MAT_INFO[m.key].name} <span class="hint">(skladem ${m.qty})</span></span>
            <span class="row"><span style="color:#ffd76a">${m.price} zl.</span><button class="btn small green" data-mat="${i}" ${m.qty <= 0 || s.gold < m.price ? 'disabled' : ''}>Koupit</button></span></div>`,
          )
          .join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(320px,36%)"><p class="hint">Vyber předmět.</p></div>`;
    const detail = $('.detail', body);
    // re-render after a purchase without losing the scroll position
    const refresh = () => {
      const sy = $('.scroll', body)?.scrollTop ?? 0;
      this.merchant(stock, p);
      const sc2 = $('.scroll', $('.body', p));
      if (sc2) sc2.scrollTop = sy;
    };
    body.querySelectorAll<HTMLElement>('.slot.shop').forEach((sl) =>
      sl.addEventListener('click', () => {
        sfx('ui');
        const i = +sl.dataset.idx!;
        const it = stock.items[i];
        if (!it) return;
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        const price = buyPrice(it);
        detail.scrollTop = 0;
        detail.innerHTML = this.itemDetailHtml(it, `<div class="row eqrow"><button class="btn green" data-a="buy" ${s.gold < price ? 'disabled' : ''}>Koupit za ${price} zl.</button></div>`, true);
        $('[data-a=buy]', detail).addEventListener('click', () => {
          if (s.gold < price) return;
          if (!addToInventory(s, it)) {
            this.ui.toast('Inventář je plný', '#ff8080');
            return;
          }
          s.gold -= price;
          stock.items.splice(i, 1);
          sfx('coin');
          this.ui.toast(`Koupeno: ${it.name}`, itemColor(it));
          refresh();
        });
      }),
    );
    body.querySelectorAll<HTMLElement>('.slot.back').forEach((sl) =>
      sl.addEventListener('click', () => {
        sfx('ui');
        const i = +sl.dataset.idx!;
        const bb = stock.buyback?.[i];
        if (!bb) return;
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        detail.scrollTop = 0;
        detail.innerHTML = this.itemDetailHtml(bb.it, `<div class="row eqrow"><button class="btn green" data-a="buyback" ${s.gold < bb.price ? 'disabled' : ''}>Koupit zpět za ${bb.price} zl.</button></div>`, true);
        $('[data-a=buyback]', detail).addEventListener('click', () => {
          if (s.gold < bb.price) return;
          if (!addToInventory(s, bb.it)) {
            this.ui.toast('Inventář je plný', '#ff8080');
            return;
          }
          s.gold -= bb.price;
          stock.buyback!.splice(i, 1);
          sfx('coin');
          this.ui.toast(`Vráceno do inventáře: ${bb.it.name}`, itemColor(bb.it));
          refresh();
        });
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-myst]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.myst as MysteryId;
        const price = this.mysteryPrice(id);
        if (s.gold < price || (stock.mystery ?? 0) >= MYSTERY_PER_MERCHANT) return;
        if (!s.inventory.some((x) => !x)) {
          this.ui.toast('Inventář je plný', '#ff8080');
          return;
        }
        const it = this.rollMystery(id);
        addToInventory(s, it);
        s.gold -= price;
        stock.mystery = (stock.mystery ?? 0) + 1;
        maxStat(s, 'bestRarity', it.rarity);
        sfx(it.rarity >= 4 ? 'levelup' : it.rarity >= 3 ? 'chest' : 'coin');
        this.ui.toast(`${it.set ? 'Předmět sady' : RARITIES[it.rarity].name}: ${it.name}`, itemColor(it), it);
        refresh();
        // show what came out of the bag
        const det = $('.detail', $('.body', p));
        det.innerHTML = this.itemDetailHtml(it) + '<p class="hint">Předmět je v inventáři.</p>';
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-mat]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = stock.mats[+b.dataset.mat!];
        if (s.gold < m.price || m.qty <= 0) return;
        s.gold -= m.price;
        m.qty--;
        s.mats[m.key]++;
        sfx('coin');
        refresh();
      }),
    );
  }

  // ------------------------------------------------------------------ FORGE (upgrade / enchant)
  /** the forge in Loppo's smithy (better than an anvil in the dungeon once the smithy grows) */
  villageForge = false;

  upCost(it: Item) {
    const c = upgradeCost(it);
    if (!this.villageForge) return c;
    const m = forgeMods(this.save);
    return { ...c, gold: Math.round(c.gold * m.cost), stones: Math.max(1, Math.round(c.stones * m.cost)), chance: Math.min(1, c.chance + m.chance) };
  }

  drCost(it: Item) {
    const c = drillCost(it);
    if (!this.villageForge) return c;
    const m = forgeMods(this.save);
    return { ...c, gold: Math.round(c.gold * m.cost), stones: Math.max(1, Math.round(c.stones * m.cost)) };
  }

  forgeSel: { from: 'inv'; idx: number } | { from: 'eq'; slot: Slot } | null = null;

  forge(host?: HTMLElement) {
    const p = host ?? this.frame('Kovadlina');
    if (!host) {
      this.forgeSel = null;
      this.ui.showOverlay(p, () => {});
    }
    const body = $('.body', p);
    const s = this.save;
    const eqSlots: Slot[] = [...EQUIP_LEFT, ...EQUIP_RIGHT];
    const getItem = () => (this.forgeSel?.from === 'inv' ? s.inventory[this.forgeSel.idx] : this.forgeSel?.from === 'eq' ? s.equip[this.forgeSel.slot] : null);
    // gold and materials in the header; the bag in the same small slots as the equipment, so all of it fits
    this.headMats(p);
    const scrolled = body.querySelector<HTMLElement>('.forgebag')?.scrollTop ?? 0;
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <b style="color:#ffd76a">Vybavení</b>
        <div class="grid" style="grid-template-columns:repeat(11,1fr)">${eqSlots.map((sl) => this.slotHtml(s.equip[sl], `feq" data-slot="${sl}`, SLOT_NAMES[sl])).join('')}</div>
        <b style="color:#ffd76a">Inventář</b>
        <div class="scroll forgebag" style="flex:1"><div class="grid" style="grid-template-columns:repeat(11,1fr)">${s.inventory.map((it, i) => this.slotHtml(it, `finv" data-idx="${i}`)).join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(340px,38%)"></div>`;
    const fb = body.querySelector<HTMLElement>('.forgebag');
    if (fb && scrolled) fb.scrollTop = scrolled;
    const detail = $('.detail', body);
    const render = () => {
      const it = getItem();
      if (!it) {
        detail.innerHTML = `<p class="hint">Vyber předmět k vylepšení nebo očarování.</p><p class="hint">Vylepšování (+1 až +${MAX_UPGRADE}) zvyšuje základní hodnoty o 10 % a bonusy o 4 % za stupeň. Očarování přidá nebo přehodí jeden magický efekt.</p>`;
        return;
      }
      const uc = this.upCost(it);
      const ec = enchantCost(it);
      const canUp = it.upgrade < MAX_UPGRADE && s.gold >= uc.gold && s.mats.stone >= uc.stones;
      const canEn = s.gold >= ec.gold && s.mats.dust >= ec.dust;
      const nSock = it.sockets?.length ?? 0;
      const maxS = maxSockets(BASE_BY_ID[it.base].cat);
      const dc = this.drCost(it);
      const canDrill = nSock < maxS && s.gold >= dc.gold && s.mats.stone >= dc.stones;
      detail.innerHTML =
        this.itemDetailHtml(it, '', false, true) +
        `<div class="box" style="margin-top:8px"><b style="color:#ff9ab0">Sokety ${nSock}/${maxS}</b>
        ${nSock >= maxS ? '<div class="hint">Víc soketů se do tohoto předmětu nevejde.</div>' : `<div class="statline"><span>Vyvrtat soket</span><b>${dc.gold} zl. + ${dc.stones}× kámen</b></div><div class="hint">Do soketu pak vsadíš drahokam (klepnutím na soket výše).</div><button class="btn" data-a="drill" ${canDrill ? '' : 'disabled'}>Vyvrtat soket</button>`}</div>` +
        `<div class="box" style="margin-top:8px"><b style="color:#7cc8ff">Vylepšení na +${it.upgrade + 1}</b>
        ${it.upgrade >= MAX_UPGRADE ? '<div class="hint">Maximální stupeň dosažen.</div>' : `<div class="statline"><span>Cena</span><b>${uc.gold} zl. + ${uc.stones}× kámen</b></div><div class="statline"><span>Šance na úspěch</span><b style="color:${uc.chance >= 0.8 ? '#6dff7a' : uc.chance >= 0.5 ? '#ffd76a' : '#ff8080'}">${Math.round(uc.chance * 100)} %</b></div>
        <div class="hint">Při neúspěchu se materiály spotřebují, předmět zůstane.</div><button class="btn blue" data-a="up" ${canUp ? '' : 'disabled'}>Vylepšit</button>`}</div>
        <div class="box" style="margin-top:8px"><b style="color:#d08aff">Očarování</b>
        <div class="statline"><span>Cena</span><b>${ec.gold} zl. + ${ec.dust}× prach</b></div>
        <div class="hint">${it.enchant ? 'Současné očarování bude nahrazeno náhodným novým.' : 'Přidá náhodné magické očarování.'}</div>
        <button class="btn purple" data-a="en" ${canEn ? '' : 'disabled'}>Očarovat</button></div>` +
        this.rerollBoxHtml(it);
      detail.querySelector('[data-a=up]')?.addEventListener('click', () => {
        const c = this.upCost(it);
        if (s.gold < c.gold || s.mats.stone < c.stones || it.upgrade >= MAX_UPGRADE) return;
        s.gold -= c.gold;
        s.mats.stone -= c.stones;
        if (Math.random() < c.chance) {
          it.upgrade++;
          maxStat(s, 'maxUpgrade', it.upgrade);
          sfx('upgrade');
          this.ui.toast(`Úspěch! ${it.name} je nyní +${it.upgrade}`, '#7cc8ff');
        } else {
          sfx('lockFail');
          this.ui.toast('Vylepšení se nezdařilo…', '#ff8080');
        }
        this.sc.player.recalc();
        this.forge(p);
      });
      detail.querySelectorAll<HTMLElement>('[data-rr]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          this.rerollAffix(it, +b.dataset.rr!, () => this.forge(p));
        }),
      );
      detail.querySelector('[data-a=drill]')?.addEventListener('click', () => {
        const c = this.drCost(it);
        if (s.gold < c.gold || s.mats.stone < c.stones || (it.sockets?.length ?? 0) >= maxSockets(BASE_BY_ID[it.base].cat)) return;
        s.gold -= c.gold;
        s.mats.stone -= c.stones;
        (it.sockets ??= []).push(null);
        sfx('upgrade');
        this.ui.toast(`Vyvrtán soket (${it.sockets.length}/${maxSockets(BASE_BY_ID[it.base].cat)})`, '#ff9ab0');
        this.forge(p);
      });
      detail.querySelectorAll<HTMLElement>('[data-a=sock]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          this.socketClick(it, +b.dataset.sock!, () => this.forge(p));
        }),
      );
      detail.querySelectorAll<HTMLElement>('[data-a=rsock]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('ui');
          this.runeSocketClick(it, +b.dataset.sock!, () => this.forge(p));
        }),
      );
      detail.querySelector('[data-a=en]')?.addEventListener('click', () => {
        const c = enchantCost(it);
        if (s.gold < c.gold || s.mats.dust < c.dust) return;
        s.gold -= c.gold;
        s.mats.dust -= c.dust;
        it.enchant = rollEnchant(it);
        sfx('upgrade');
        this.ui.toast(`Očarováno: ${formatStat(it.enchant.key, it.enchant.value)}`, '#d08aff');
        this.sc.player.recalc();
        this.forge(p);
      });
    };
    body.querySelectorAll<HTMLElement>('.slot.feq').forEach((sl) =>
      sl.addEventListener('click', () => {
        const slot = sl.dataset.slot as Slot;
        if (!s.equip[slot]) return;
        sfx('ui');
        this.forgeSel = { from: 'eq', slot };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        render();
      }),
    );
    body.querySelectorAll<HTMLElement>('.slot.finv').forEach((sl) =>
      sl.addEventListener('click', () => {
        const i = +sl.dataset.idx!;
        if (!s.inventory[i]) return;
        sfx('ui');
        this.forgeSel = { from: 'inv', idx: i };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        render();
      }),
    );
    // keep selection highlight
    if (this.forgeSel?.from === 'eq') body.querySelector(`.slot.feq[data-slot="${this.forgeSel.slot}"]`)?.classList.add('sel');
    if (this.forgeSel?.from === 'inv') body.querySelector(`.slot.finv[data-idx="${this.forgeSel.idx}"]`)?.classList.add('sel');
    render();
  }

  // ------------------------------------------------------------------ STASH (shared storage at merchants)
  stashSel: { from: 'inv' | 'stash'; idx: number } | null = null;

  stash(host: HTMLElement) {
    const body = $('.body', host);
    const s = this.save;
    const size = stashSize(s);
    if (!s.stash) s.stash = new Array(size).fill(null);
    while (s.stash.length < size) s.stash.push(null);
    const st = s.stash;
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <b style="color:#ffd76a">Inventář</b>
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `sinv" data-idx="${i}`)).join('')}</div></div>
      </div>
      <div class="col" style="flex:1;min-width:0">
        <b style="color:#ffd76a">Úložiště (${st.filter(Boolean).length}/${size})</b>
        <div class="scroll" style="flex:1"><div class="grid">${st.map((it, i) => this.slotHtml(it, `sst" data-idx="${i}`)).join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(280px,32%)"></div>`;
    const detail = $('.detail', body);
    const render = () => {
      const sel = this.stashSel;
      const it = sel ? (sel.from === 'inv' ? s.inventory[sel.idx] : st[sel.idx]) : null;
      if (!it || !sel) {
        detail.innerHTML = '<p class="hint">Sklad je společný: stejný ve skladu v Loppu i u každého obchodníka v kobkách. Ulož si sem předměty, které nechceš nosit, ale nechceš je ani prodat. Větší sklad postavíš v Loppu.</p>';
        return;
      }
      detail.scrollTop = 0;
      detail.innerHTML = this.itemDetailHtml(it, `<div class="row eqrow"><button class="btn green" data-a="move">${sel.from === 'inv' ? 'Uložit do úložiště' : 'Vzít do inventáře'}</button></div>`, sel.from !== 'inv');
      $('[data-a=move]', detail).addEventListener('click', () => {
        sfx('pickup');
        const to = sel.from === 'inv' ? st : s.inventory;
        const free = to.findIndex((x) => !x);
        if (free < 0) {
          this.ui.toast(sel.from === 'inv' ? 'Úložiště je plné' : 'Inventář je plný', '#ff8080');
          return;
        }
        to[free] = it;
        if (sel.from === 'inv') s.inventory[sel.idx] = null;
        else st[sel.idx] = null;
        this.stashSel = null;
        this.stash(host);
      });
    };
    const bind = (cls: string, from: 'inv' | 'stash') =>
      body.querySelectorAll<HTMLElement>('.slot.' + cls).forEach((sl) =>
        sl.addEventListener('click', () => {
          const i = +sl.dataset.idx!;
          if (!(from === 'inv' ? s.inventory[i] : st[i])) return;
          sfx('ui');
          this.stashSel = { from, idx: i };
          body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
          sl.classList.add('sel');
          render();
        }),
      );
    bind('sinv', 'inv');
    bind('sst', 'stash');
    render();
  }

  // ------------------------------------------------------------------ CLASS CHANGE
  classChange(host: HTMLElement) {
    const body = $('.body', host);
    const s = this.save;
    const cost = classChangeCost(s);
    let invested = 0;
    for (const [id, pts] of Object.entries(s.spellRanks)) if (SPELL_BY_ID[id]?.cls !== 'universal') invested += pts;
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Změna classy stojí <b style="color:#ffd76a">${cost} zlata</b> (máš ${s.gold}). Úroveň, atributy, vybavení i univerzální kouzla zůstanou. Body investované do kouzel současné classy (<b>${invested}</b>) se vrátí jako volné.</div>
        <div class="row box" style="justify-content:space-between"><span class="hint">Přerozdělit všechny body atributů (${this.respecCost()} zlata)</span><button class="btn small purple" data-a="respec" ${s.gold < this.respecCost() || s.level <= 1 ? 'disabled' : ''}>Přerozdělit atributy</button></div>
        <div class="scroll" style="flex:1"><div class="classgrid">${CLASSES.map(
          (c) => `<div class="ccard ${c.id === s.cls ? 'sel' : ''}" data-cls="${c.id}"><img src="${iconURL('pl_' + c.id, 64)}"><div class="nm">${c.name}</div><div class="st">${c.style}</div>${c.id === s.cls ? '<div class="st" style="color:#6dff7a">současná</div>' : ''}</div>`,
        ).join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(320px,36%)"><p class="hint">Vyber novou classu.</p></div>`;
    const detail = $('.detail', body);
    body.querySelector('[data-a=respec]')?.addEventListener('click', () => {
      const cost = this.respecCost();
      if (s.gold < cost) return;
      this.ui.confirm('Přerozdělit atributy?', `Všechny body atributů získané za úrovně se vrátí jako volné. Cena ${cost} zlata.`, () => {
        s.gold -= cost;
        const base = newCharacterAttrs(s.cls);
        let refunded = 0;
        for (const k of ATTR_KEYS) {
          refunded += Math.max(0, s.attrs[k] - base[k]);
          s.attrs[k] = base[k];
        }
        s.attrPoints += refunded;
        this.sc.player.recalc();
        sfx('levelup');
        this.ui.toast(`Vráceno ${refunded} bodů atributů`, '#c8a8ff');
        this.classChange(host);
      });
    });
    body.querySelectorAll<HTMLElement>('.ccard').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        const id = c.dataset.cls as ClassId;
        const def = CLASS_BY_ID[id];
        body.querySelectorAll('.ccard').forEach((x) => x.classList.toggle('sel', x === c));
        const sp = spellsForClass(id).slice(0, 6);
        detail.innerHTML = `<h3 style="color:#ffd76a">${def.name}</h3><div class="sub">${def.style}</div><p style="font-size:18px">${esc(def.desc)}</p><div style="color:#9dff9d;font-size:17px">Pasivní: ${esc(def.passive)}</div>
          <div class="hint" style="margin-top:6px">První kouzla:</div>${sp.map((x) => `<div class="row" style="font-size:17px"><img style="width:22px;height:22px" src="${spellIcon(x.icon, x.color, 44)}">${esc(x.name)} <span class="hint">(úr. ${x.lvl})</span></div>`).join('')}
          ${id === s.cls ? '<p class="hint">Tuto classu už máš.</p>' : `<button class="btn green" style="margin-top:8px" data-a="change" ${s.gold < cost ? 'disabled' : ''}>Změnit za ${cost} zl.</button>`}`;
        detail.querySelector('[data-a=change]')?.addEventListener('click', () => {
          if (s.gold < cost) return;
          s.gold -= cost;
          const refund = changeClass(s, id);
          this.sc.refreshPlayerClass();
          sfx('levelup');
          this.ui.toast(`Jsi nyní ${def.name}! Vráceno ${refund} bodů kouzel.`, '#ffd76a');
          this.ui.refreshSkills();
          this.classChange(host);
        });
      }),
    );
  }

  respecCost() {
    return Math.round(150 + this.save.level * this.save.level * 6);
  }

  // ------------------------------------------------------------------ LOCKPICK minigame
  lockpick(floor: number, cb: (ok: boolean, consumed: boolean) => void) {
    const s = this.save;
    const zoneW = Math.max(9, 24 - floor * 0.25);
    const speed = 0.9 + Math.min(1.4, floor * 0.02);
    let zoneX = 15 + Math.random() * (70 - zoneW);
    const p = el(`<div class="panel small"><div class="head"><h2>Páčení zámku</h2><button class="close">✕</button></div>
      <div style="padding:14px">
        <div class="hint">Klepni na „Páčit“, když je jehla v zelené zóně. Při chybě se paklíč může zlomit.</div>
        <div class="lockbar"><div class="lockzone"></div><div class="lockneedle"></div></div>
        <div class="row" style="justify-content:space-between"><span>Paklíče: <b class="lp">${s.mats.lockpick}</b></span><button class="btn green" data-a="pick" style="font-size:26px;padding:12px 28px">Páčit</button></div>
        <div class="msg hint" style="margin-top:6px;min-height:18px"></div>
      </div></div>`);
    const zone = $('.lockzone', p),
      needle = $('.lockneedle', p);
    zone.style.left = zoneX + '%';
    zone.style.width = zoneW + '%';
    let t = 0;
    let raf = 0;
    let last = performance.now();
    let done = false;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t += dt * speed;
      const x = (Math.sin(t * 2.4) * 0.5 + 0.5) * 100;
      needle.style.left = x + '%';
      (needle as any)._x = x;
      if (!done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ov = el('<div class="overlay" style="z-index:70"></div>');
    ov.appendChild(p);
    this.ui.root.appendChild(ov);
    this.ui.pauseGame();
    const finish = () => {
      done = true;
      cancelAnimationFrame(raf);
      ov.remove();
      this.ui.resumeGame();
    };
    $('.close', p).addEventListener('click', finish);
    $('[data-a=pick]', p).addEventListener('click', () => {
      if (s.mats.lockpick <= 0) {
        $('.msg', p).textContent = 'Došly ti paklíče!';
        return;
      }
      const x = (needle as any)._x ?? 0;
      if (x >= zoneX - 1 && x <= zoneX + zoneW + 1) {
        sfx('lockOk');
        s.mats.lockpick--;
        $('.msg', p).textContent = 'Zámek povolil!';
        setTimeout(() => {
          finish();
          cb(true, true);
        }, 300);
      } else {
        sfx('lockFail');
        if (Math.random() < 0.5) {
          s.mats.lockpick--;
          $('.msg', p).textContent = 'Paklíč se zlomil!';
        } else $('.msg', p).textContent = 'Vedle! Zkus to znovu.';
        $('.lp', p).textContent = String(s.mats.lockpick);
        zoneX = 15 + Math.random() * (70 - zoneW);
        zone.style.left = zoneX + '%';
        if (s.mats.lockpick <= 0) {
          setTimeout(() => {
            finish();
            cb(false, false);
          }, 600);
        }
      }
    });
  }
}
