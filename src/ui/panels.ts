import type { MerchantStock } from '../scenes/GameScene';
import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import {
  BASE_BY_ID,
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
} from '../data/items';
import { Item, Slot, SLOT_NAMES, ATTR_KEYS, ATTR_NAMES, ATTR_DESC, AttrKey, ClassId } from '../data/types';
import { SPELL_BY_ID, spellsForClass, SpellDef, MAX_SPELL_RANK } from '../data/spells';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { derive, equipItem, unequip, addToInventory, spellRank, canInvest, changeClass, classChangeCost, SaveData, freeSlots, newCharacterAttrs, maxStat, STASH_SIZE } from '../systems/state';
import { MAT_INFO, MatKey } from '../game/loot';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';

type UIM = typeof UIType;

const EQUIP_LEFT: Slot[] = ['main', 'helmet', 'chest', 'pants', 'boots'];
const EQUIP_RIGHT: Slot[] = ['off', 'amulet', 'bracer', 'belt', 'ring1', 'ring2'];

// Where the selected item lives
type Sel = { from: 'inv'; idx: number } | { from: 'eq'; slot: Slot } | { from: 'shop'; idx: number } | null;

export class Panels {
  ui: UIM;
  sel: Sel = null;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  get sc() {
    return this.ui.scene!;
  }
  get save(): SaveData {
    return this.ui.scene!.save;
  }

  open(name: string) {
    this.sel = null;
    if (name === 'inventory') this.inventory();
    else if (name === 'character') this.character();
    else if (name === 'spells') this.spells();
  }

  frame(title: string, tabs: { id: string; label: string }[] = [], active = '') {
    const p = el(`<div class="panel">
      <div class="head"><h2>${esc(title)}</h2><div class="tabs">${tabs.map((t) => `<button class="tab ${t.id === active ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div><button class="close">✕</button></div>
      <div class="body"></div></div>`);
    $('.close', p).addEventListener('click', () => {
      sfx('ui');
      this.ui.closeOverlay();
    });
    return p;
  }

  // ------------------------------------------------------------------ helpers
  slotHtml(it: Item | null | undefined, extra = '', label = '', price?: number, better = false) {
    if (!it) return `<div class="slot ${extra}">${label ? `<span class="lbl">${esc(label)}</span>` : ''}</div>`;
    return `<div class="slot r${it.rarity} ${extra}"><img src="${iconURL(itemIcon(it), 48)}">${it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}${better ? '<span class="better">▲</span>' : ''}${price !== undefined ? `<span class="price">${price}</span>` : ''}</div>`;
  }

  matsHtml() {
    const s = this.save;
    const m = (k: MatKey) => `<span title="${MAT_INFO[k].name}"><img src="${iconURL(MAT_INFO[k].icon, 32)}">${s.mats[k]}</span>`;
    return `<div class="mats"><span><img src="${iconURL('ic_gold', 32)}"><b style="color:#ffd76a">${s.gold.toLocaleString('cs-CZ')}</b></span>${m('hpPotion')}${m('mpPotion')}${m('lockpick')}${m('stone')}${m('dust')}</div>`;
  }

  itemDetailHtml(it: Item, compareTo?: Item | null) {
    const base = BASE_BY_ID[it.base];
    const rar = RARITIES[it.rarity];
    let h = `<h3 style="color:${rar.color}">${it.upgrade ? '+' + it.upgrade + ' ' : ''}${esc(it.name)}</h3>`;
    h += `<div class="sub">${rar.name} • ${CATEGORY_NAMES[base.cat]} • úroveň předmětu ${it.ilvl}</div>`;
    if (it.dmgMin !== undefined) {
      const [a, b] = weaponDamage(it);
      const kind = base.attack === 'melee' ? 'na blízko' : base.attack === 'ranged' ? 'na dálku' : 'magická';
      h += `<div class="main">Poškození: <b>${a}–${b}</b></div><div class="main">Útoků za sekundu: ${base.aps?.toFixed(2).replace('.', ',')} • zbraň ${kind}</div>`;
      h += `<div class="hint">Dosah: ${base.attack === 'melee' ? 'krátký (' + Math.round((base.range ?? 0) / 16 * 10) / 10 + ' pole)' : Math.round((base.range ?? 0) / 16) + ' polí'}</div>`;
    }
    const st = itemStats(it);
    if (st.armor) h += `<div class="main">Brnění: <b>${st.armor}</b></div>`;
    if (st.block) h += `<div class="main">Šance na blok: ${st.block} %</div>`;
    if (base.implicit) for (const [k, v] of Object.entries(base.implicit)) h += `<div class="aff" style="color:#c9c9c9">${formatStat(k as any, v as number)}</div>`;
    const am = 1 + 0.04 * it.upgrade;
    for (const a of it.affixes) h += `<div class="aff">${formatStat(a.key, scaledAffix(a.key, a.value, am))}</div>`;
    if (it.enchant) h += `<div class="ench">✧ Očarování: ${formatStat(it.enchant.key, scaledAffix(it.enchant.key, it.enchant.value, am))}</div>`;
    for (const s of it.specials) h += `<div class="spec">★ ${esc(SPECIAL_BY_ID[s]?.desc ?? s)}</div>`;
    if (base.cat === 'weapon2h') h += `<div class="hint">Obouruční – zabírá obě ruce</div>`;
    if (base.cat === 'weapon1h') h += `<div class="hint">Jednoruční – lze nosit se štítem nebo dvě zbraně</div>`;
    h += `<div class="hint" style="margin-top:4px">Prodejní cena: <span style="color:#ffd76a">${itemValue(it)}</span> zlata</div>`;
    if (compareTo !== undefined) h += this.compareHtml(it);
    return h;
  }

  // compare derived stats if item were equipped
  compareHtml(it: Item) {
    const s = this.save;
    const before = derive(s);
    const clone: SaveData = JSON.parse(JSON.stringify(s));
    const idx = clone.inventory.findIndex((x) => x?.uid === it.uid);
    if (idx < 0) return '';
    equipItem(clone, idx);
    const after = derive(clone);
    const dps = (d: typeof before) => ((d.dmgMin + d.dmgMax) / 2) * d.aps * (1 + (d.crit / 100) * (d.critDmg / 100 - 1));
    const rows: [string, number, number, boolean?][] = [
      ['DPS', dps(before), dps(after)],
      ['Brnění', before.armor, after.armor],
      ['Max. HP', before.maxHp, after.maxHp],
      ['Max. mana', before.maxMp, after.maxMp],
      ['Síla kouzel', before.spellMult * 100, after.spellMult * 100],
      ['Krit. šance', before.crit, after.crit],
    ];
    let h = '<div class="cmp"><div class="hint">Po nasazení:</div>';
    let any = false;
    for (const [n, a, b] of rows) {
      const d = b - a;
      if (Math.abs(d) < 0.05) continue;
      any = true;
      h += `<div class="statline"><span>${n}</span><b class="${d > 0 ? 'up-g' : 'up-r'}">${d > 0 ? '+' : ''}${Math.abs(d) >= 10 ? Math.round(d) : d.toFixed(1).replace('.', ',')}</b></div>`;
    }
    if (!any) h += '<div class="hint">beze změny hlavních statistik</div>';
    return h + '</div>';
  }

  // ------------------------------------------------------------------ INVENTORY
  inventory(mode: 'normal' | 'sell' = 'normal', host?: HTMLElement) {
    this.ui.newItems = 0;
    const p = host ?? this.frame('Inventář');
    const body = $('.body', p);
    const s = this.save;
    const d = derive(s);
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
            </div>
          </div>
          <div class="side">${EQUIP_RIGHT.map((sl) => this.slotHtml(s.equip[sl] ?? (sl === 'off' && isTwoHanded(s.equip.main) ? null : null), `eq ${sl === 'off' && isTwoHanded(s.equip.main) ? 'blocked' : ''}" data-slot="${sl}`, sl === 'off' && isTwoHanded(s.equip.main) ? '2H' : SLOT_NAMES[sl])).join('')}</div>
        </div>
      </div>
      <div class="col" style="flex:1;min-width:0">
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `inv" data-idx="${i}`, '', undefined, !!it && this.sc.loot.isUpgrade(it))).join('')}</div></div>
        <div class="box">${this.matsHtml()}</div>
        <div class="row">${mode === 'sell' ? '<button class="btn small" data-a="sellcommon">Prodat běžné a neobvyklé</button>' : '<button class="btn small" data-a="salvcommon">Rozebrat běžné předměty</button>'}<button class="btn small blue" data-a="sort">Seřadit</button><span class="hint">Volno: ${freeSlots(s)}/${s.inventory.length}</span></div>
      </div>
      <div class="col detail box scroll" style="width:min(300px,34%)"></div>`;
    const detail = $('.detail', body);
    const renderDetail = () => {
      const sel = this.sel;
      let it: Item | null | undefined = null;
      if (sel?.from === 'inv') it = s.inventory[sel.idx];
      else if (sel?.from === 'eq') it = s.equip[sel.slot];
      if (!it) {
        detail.innerHTML = `<p class="hint">Klepni na předmět pro zobrazení detailu.</p><p class="hint">Předměty se sbírají automaticky, když přes ně přejdeš. Nepotřebné věci můžeš prodat u obchodníka, nebo rozebrat na materiály pro vylepšování.</p>`;
        return;
      }
      const base = BASE_BY_ID[it.base];
      let actions = '';
      if (sel!.from === 'inv') {
        if (base.cat === 'weapon1h') actions += `<button class="btn green" data-a="equip">Do hlavní ruky</button><button class="btn green" data-a="equipoff">Do druhé ruky</button>`;
        else if (base.cat === 'ring') actions += `<button class="btn green" data-a="equip" data-t="ring1">Prsten 1</button><button class="btn green" data-a="equip" data-t="ring2">Prsten 2</button>`;
        else actions += `<button class="btn green" data-a="equip">Nasadit</button>`;
        if (mode === 'sell') actions += `<button class="btn" data-a="sell">Prodat (${itemValue(it)} zl.)</button>`;
        const sv = salvageResult(it);
        actions += `<button class="btn purple" data-a="salvage">Rozebrat</button>`;
        void sv;
        actions += `<button class="btn red" data-a="drop">Zahodit</button>`;
      } else {
        actions += `<button class="btn" data-a="unequip">Sundat</button>`;
      }
      detail.innerHTML = this.itemDetailHtml(it, sel!.from === 'inv' ? null : undefined) + `<div class="row" style="margin-top:8px">${actions}</div>` + (sel!.from === 'inv' ? `<div class="hint" style="margin-top:4px">Rozebrání dá: ${this.salvageText(it)}</div>` : '');
    };
    const rerender = () => this.inventory(mode, p);
    body.querySelectorAll<HTMLElement>('.slot.inv').forEach((sl) =>
      sl.addEventListener('click', () => {
        const i = +sl.dataset.idx!;
        if (!s.inventory[i]) return;
        sfx('ui');
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
        if (!s.equip[slot]) return;
        sfx('ui');
        this.sel = { from: 'eq', slot };
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        renderDetail();
      }),
    );
    detail.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx('ui');
      const a = b.dataset.a;
      const sel = this.sel;
      if (!sel) return;
      if (a === 'equip' || a === 'equipoff') {
        if (sel.from !== 'inv') return;
        const err = equipItem(s, sel.idx, a === 'equipoff' ? 'off' : (b.dataset.t as Slot | undefined));
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
        s.gold += itemValue(it);
        this.sold(it, itemValue(it));
        s.inventory[sel.idx] = null;
        sfx('coin');
        this.sel = null;
      } else if (a === 'salvage' && sel.from === 'inv') {
        this.salvage(sel.idx);
        this.sel = null;
      } else if (a === 'drop' && sel.from === 'inv') {
        const it = s.inventory[sel.idx]!;
        s.inventory[sel.idx] = null;
        this.sc.loot.dropItem(it, this.sc.player.x, this.sc.player.y + 8);
        this.sel = null;
      }
      rerender();
    });
    body.querySelector('[data-a=sellcommon]')?.addEventListener('click', () => {
      let n = 0,
        g = 0;
      s.inventory.forEach((it, i) => {
        if (it && it.rarity <= 1 && !this.sc.loot.isUpgrade(it)) {
          g += itemValue(it);
          this.sold(it, itemValue(it));
          s.inventory[i] = null;
          n++;
        }
      });
      s.gold += g;
      if (n) sfx('coin');
      this.ui.toast(n ? `Prodáno ${n} předmětů za ${g} zlata` : 'Nic k prodeji', '#ffd76a');
      rerender();
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
    body.querySelector('[data-a=salvcommon]')?.addEventListener('click', () => {
      let n = 0;
      s.inventory.forEach((it, i) => {
        if (it && it.rarity === 0 && !this.sc.loot.isUpgrade(it)) {
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
      ['Vysávání života', fmt(d.lifesteal) + ' %'],
      ['Rychlost pohybu', Math.round((d.move / 72) * 100) + ' %'],
      ['Snížení přebíjení', fmt(d.cdr) + ' %'],
      ['Nalezené zlato', '+' + fmt(d.gold) + ' %'],
      ['Lepší kořist', '+' + fmt(d.magicFind) + ' %'],
      ['Zkušenosti', '+' + fmt(d.xp) + ' %'],
      ['Trny', fmt(d.thorns)],
    ];
    if (d.elem.fire) st.push(['Ohnivé poškození', '+' + fmt(d.elem.fire)]);
    if (d.elem.ice) st.push(['Mrazivé poškození', '+' + fmt(d.elem.ice)]);
    if (d.elem.lightning) st.push(['Bleskové poškození', '+' + fmt(d.elem.lightning)]);
    if (d.elem.poison) st.push(['Jedové poškození', '+' + fmt(d.elem.poison)]);
    const specials = [...d.specials].map((x) => `<div class="spec" style="color:#ffb347;font-size:17px">★ ${esc(SPECIAL_BY_ID[x]?.desc ?? x)}</div>`).join('');
    body.innerHTML = `
      <div class="col" style="width:min(240px,28%)">
        <div class="box" style="text-align:center"><img class="px" style="height:96px;image-rendering:pixelated" src="${iconURL('pl_' + s.cls, 96)}">
          <div style="font-size:26px;color:#ffd76a">${cls.name}</div><div class="hint">Úroveň ${s.level} • Patro ${s.floor} (max ${s.maxFloor})</div>
          <div class="hint" style="margin-top:6px">${esc(cls.desc)}</div>
          <div style="margin-top:6px;font-size:17px;color:#9dff9d">Pasivní: ${esc(cls.passive)}</div>
          <div class="hint" style="margin-top:6px">Zabito nepřátel: ${s.kills.toLocaleString('cs-CZ')}</div>
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

  // ------------------------------------------------------------------ SPELLS
  spellTab: 'class' | 'universal' = 'class';
  selSpell: string | null = null;

  spells(host?: HTMLElement) {
    const p = host ?? this.frame('Kouzla a schopnosti', [
      { id: 'class', label: CLASS_BY_ID[this.save.cls].name },
      { id: 'universal', label: 'Univerzální' },
    ], this.spellTab);
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
    const body = $('.body', p);
    const s = this.save;
    const list = spellsForClass(this.spellTab === 'class' ? s.cls : 'universal');
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
          if (a === 'invest') {
            if (!canInvest(s, sp.id)) return;
            s.spellPoints--;
            s.spellRanks[sp.id] = (s.spellRanks[sp.id] ?? 0) + 1;
          } else if (a.startsWith('slot')) {
            const i = +a.slice(4);
            // remove from other slots
            s.loadout = s.loadout.map((x) => (x === sp.id ? null : x));
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
    const type = sp.ult ? '<span style="color:#ffb347">Ultimátní kouzlo</span>' : sp.cls === 'universal' ? '<span style="color:#7dff9a">Univerzální kouzlo</span>' : 'Kouzlo classy';
    let btns = '';
    if (!locked) {
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
      ${btns ? `<div class="hint" style="margin-top:8px">Přiřadit do slotu:</div><div class="row">${btns}</div>` : ''}`;
  }

  // ------------------------------------------------------------------ MERCHANT
  merchantTab: 'buy' | 'sell' | 'forge' | 'class' | 'stash' = 'buy';

  curStock: MerchantStock | null = null;

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
    if (this.merchantTab === 'sell') return this.inventory('sell', p);
    if (this.merchantTab === 'forge') return this.forge(p);
    if (this.merchantTab === 'class') return this.classChange(p);
    if (this.merchantTab === 'stash') return this.stash(p);
    const body = $('.body', p);
    const s = this.save;
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Zboží se u každého obchodníka liší. Klepni na předmět pro detail.</div>
        <div class="scroll" style="flex:1"><div class="grid">${stock.items.map((it, i) => this.slotHtml(it, `shop" data-idx="${i}`, '', buyPrice(it))).join('')}</div>
        ${stock.buyback?.length ? `<b style="color:#ffd76a;display:block;margin-top:8px">Zpětný odkup</b><div class="hint">Předměty, které jsi tu prodal. Koupíš je zpět za stejnou cenu.</div><div class="grid">${stock.buyback.map((b, i) => this.slotHtml(b.it, `back" data-idx="${i}`, '', b.price)).join('')}</div>` : ''}
        <div class="box" style="margin-top:8px">${stock.mats
          .map(
            (m, i) => `<div class="statline" style="align-items:center"><span class="row"><img style="width:28px;height:28px;image-rendering:pixelated" src="${iconURL(MAT_INFO[m.key].icon, 32)}">${MAT_INFO[m.key].name} <span class="hint">(skladem ${m.qty})</span></span>
            <span class="row"><span style="color:#ffd76a">${m.price} zl.</span><button class="btn small green" data-mat="${i}" ${m.qty <= 0 || s.gold < m.price ? 'disabled' : ''}>Koupit</button></span></div>`,
          )
          .join('')}</div></div>
        <div class="box">${this.matsHtml()}</div>
      </div>
      <div class="col detail box scroll" style="width:min(320px,36%)"><p class="hint">Vyber předmět.</p></div>`;
    const detail = $('.detail', body);
    body.querySelectorAll<HTMLElement>('.slot.shop').forEach((sl) =>
      sl.addEventListener('click', () => {
        sfx('ui');
        const i = +sl.dataset.idx!;
        const it = stock.items[i];
        if (!it) return;
        body.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        sl.classList.add('sel');
        const price = buyPrice(it);
        detail.innerHTML = this.itemDetailHtml(it) + `<div class="row" style="margin-top:8px"><button class="btn green" data-a="buy" ${s.gold < price ? 'disabled' : ''}>Koupit za ${price} zl.</button></div>`;
        $('[data-a=buy]', detail).addEventListener('click', () => {
          if (s.gold < price) return;
          if (!addToInventory(s, it)) {
            this.ui.toast('Inventář je plný', '#ff8080');
            return;
          }
          s.gold -= price;
          stock.items.splice(i, 1);
          sfx('coin');
          this.ui.toast(`Koupeno: ${it.name}`, RARITIES[it.rarity].color);
          this.merchant(stock, p);
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
        detail.innerHTML = this.itemDetailHtml(bb.it) + `<div class="row" style="margin-top:8px"><button class="btn green" data-a="buyback" ${s.gold < bb.price ? 'disabled' : ''}>Koupit zpět za ${bb.price} zl.</button></div>`;
        $('[data-a=buyback]', detail).addEventListener('click', () => {
          if (s.gold < bb.price) return;
          if (!addToInventory(s, bb.it)) {
            this.ui.toast('Inventář je plný', '#ff8080');
            return;
          }
          s.gold -= bb.price;
          stock.buyback!.splice(i, 1);
          sfx('coin');
          this.ui.toast(`Vráceno do inventáře: ${bb.it.name}`, RARITIES[bb.it.rarity].color);
          this.merchant(stock, p);
        });
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
        this.merchant(stock, p);
      }),
    );
  }

  // ------------------------------------------------------------------ FORGE (upgrade / enchant)
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
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <div class="hint">Vylepšování (+1 až +${MAX_UPGRADE}) zvyšuje základní hodnoty o 10 % a bonusy o 4 % za stupeň. Očarování přidá nebo přehodí jeden magický efekt.</div>
        <b style="color:#ffd76a">Vybavení</b>
        <div class="grid" style="grid-template-columns:repeat(11,1fr)">${eqSlots.map((sl) => this.slotHtml(s.equip[sl], `feq" data-slot="${sl}`, SLOT_NAMES[sl])).join('')}</div>
        <b style="color:#ffd76a">Inventář</b>
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `finv" data-idx="${i}`)).join('')}</div></div>
        <div class="box">${this.matsHtml()}</div>
      </div>
      <div class="col detail box scroll" style="width:min(340px,38%)"></div>`;
    const detail = $('.detail', body);
    const render = () => {
      const it = getItem();
      if (!it) {
        detail.innerHTML = '<p class="hint">Vyber předmět k vylepšení nebo očarování.</p>';
        return;
      }
      const uc = upgradeCost(it);
      const ec = enchantCost(it);
      const canUp = it.upgrade < MAX_UPGRADE && s.gold >= uc.gold && s.mats.stone >= uc.stones;
      const canEn = s.gold >= ec.gold && s.mats.dust >= ec.dust;
      detail.innerHTML =
        this.itemDetailHtml(it) +
        `<div class="box" style="margin-top:8px"><b style="color:#7cc8ff">Vylepšení na +${it.upgrade + 1}</b>
        ${it.upgrade >= MAX_UPGRADE ? '<div class="hint">Maximální stupeň dosažen.</div>' : `<div class="statline"><span>Cena</span><b>${uc.gold} zl. + ${uc.stones}× kámen</b></div><div class="statline"><span>Šance na úspěch</span><b style="color:${uc.chance >= 0.8 ? '#6dff7a' : uc.chance >= 0.5 ? '#ffd76a' : '#ff8080'}">${Math.round(uc.chance * 100)} %</b></div>
        <div class="hint">Při neúspěchu se materiály spotřebují, předmět zůstane.</div><button class="btn blue" data-a="up" ${canUp ? '' : 'disabled'}>Vylepšit</button>`}</div>
        <div class="box" style="margin-top:8px"><b style="color:#d08aff">Očarování</b>
        <div class="statline"><span>Cena</span><b>${ec.gold} zl. + ${ec.dust}× prach</b></div>
        <div class="hint">${it.enchant ? 'Současné očarování bude nahrazeno náhodným novým.' : 'Přidá náhodné magické očarování.'}</div>
        <button class="btn purple" data-a="en" ${canEn ? '' : 'disabled'}>Očarovat</button></div>`;
      detail.querySelector('[data-a=up]')?.addEventListener('click', () => {
        const c = upgradeCost(it);
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
    if (!s.stash) s.stash = new Array(STASH_SIZE).fill(null);
    while (s.stash.length < STASH_SIZE) s.stash.push(null);
    const st = s.stash;
    body.innerHTML = `
      <div class="col" style="flex:1;min-width:0">
        <b style="color:#ffd76a">Inventář</b>
        <div class="scroll" style="flex:1"><div class="grid">${s.inventory.map((it, i) => this.slotHtml(it, `sinv" data-idx="${i}`)).join('')}</div></div>
      </div>
      <div class="col" style="flex:1;min-width:0">
        <b style="color:#ffd76a">Úložiště (${st.filter(Boolean).length}/${STASH_SIZE})</b>
        <div class="scroll" style="flex:1"><div class="grid">${st.map((it, i) => this.slotHtml(it, `sst" data-idx="${i}`)).join('')}</div></div>
      </div>
      <div class="col detail box scroll" style="width:min(280px,32%)"></div>`;
    const detail = $('.detail', body);
    const render = () => {
      const sel = this.stashSel;
      const it = sel ? (sel.from === 'inv' ? s.inventory[sel.idx] : st[sel.idx]) : null;
      if (!it || !sel) {
        detail.innerHTML = '<p class="hint">Úložiště je u každého obchodníka stejné. Ulož si sem předměty, které nechceš nosit, ale nechceš je ani prodat.</p>';
        return;
      }
      detail.innerHTML = this.itemDetailHtml(it) + `<div class="row" style="margin-top:8px"><button class="btn green" data-a="move">${sel.from === 'inv' ? 'Uložit do úložiště' : 'Vzít do inventáře'}</button></div>`;
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
