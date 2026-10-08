import { $, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL } from '../gfx/textures';
import { BUILDING_BY_ID, BuildingId, BLESSINGS, BLESSING_BY_ID, blessingFloors, activeBlessing, buildingLevel, villageOf, runeMaxTier, restFloors, restedOf, BUILDINGS } from '../data/village';
import { honorsOf } from '../data/royal';
import { ACHIEVEMENTS } from '../data/achievements';
import { codexCount, CODEX_TOTAL } from '../data/codex';
import { ROMAN } from '../game/village';
import { RUNES, runeKey, runeName, runeIcon, runeDesc } from '../data/runes';
import { SPELL_RUNES, spellRuneIcon } from '../data/spellrunes';
import { CURSE_BY_ID } from '../data/curses';
import { Item } from '../data/types';
import { addRune, addSpellRune, saveGame } from '../systems/state';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { MAT_INFO } from '../game/loot';

type UIM = typeof UIType;

/** the tabs of each building (the last one is always the upgrade) */
const TABS: Record<BuildingId, [string, string][]> = {
  stash: [
    ['stash', 'Truhla'],
    ['rest', 'Postel'],
    ['trophy', 'Trofeje'],
  ],
  smithy: [['forge', 'Kovadlina']],
  shop: [
    ['buy', 'Koupit'],
    ['sell', 'Prodat'],
  ],
  board: [['quests', 'Úkoly']],
  lab: [
    ['brew', 'Transmutace'],
    ['potions', 'Lektvary'],
  ],
  tower: [['runes', 'Runy']],
  trainer: [['class', 'Classa a atributy']],
  temple: [
    ['bless', 'Požehnání'],
    ['curse', 'Kletby'],
  ],
};

const n = (v: number) => v.toLocaleString('cs-CZ');

// The panels of Loppo's buildings: each opens on its own work (the forge, the shop, the laboratory …)
// and on a tab where the hero invests gold to make the building grow.
export class BuildingPanels {
  ui: UIM;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  get P() {
    return this.ui.panels;
  }

  get sc() {
    return this.ui.scene!;
  }

  get save() {
    return this.sc.save;
  }

  open(id: BuildingId, tab?: string) {
    const b = BUILDING_BY_ID[id];
    const lv = buildingLevel(this.save, id);
    if (lv <= 0) return this.ruins(id);
    const tabs = [...TABS[id], ['up', 'Vylepšení']].map(([tid, label]) => ({ id: tid, label }));
    let active = tab ?? tabs[0].id;
    const p = this.P.frame(`${b.name} ${ROMAN[lv]}${b.who ? ` – ${b.who.name}` : ''}`, tabs, active);
    p.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        if (t.dataset.tab === active) return;
        sfx('ui');
        active = t.dataset.tab!;
        p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        this.render(p, id, active);
      }),
    );
    this.ui.showOverlay(p, () => {});
    this.render(p, id, active);
  }

  private render(p: HTMLElement, id: BuildingId, tab: string) {
    const P = this.P;
    P.sel = null;
    // gold and materials in the header on every tab
    P.headMats(p);
    const body = $('.body', p);
    body.scrollTop = 0;
    switch (tab) {
      case 'stash':
        P.stashSel = null;
        return P.stash(p);
      case 'forge':
        P.villageForge = true;
        P.forgeSel = null;
        return P.forge(p);
      case 'buy':
      case 'sell':
        P.merchantTab = tab;
        return P.merchant(this.sc.vil.shop!, p);
      case 'brew':
        P.villageLab = true;
        return P.transmute(p);
      case 'class':
        return P.classChange(p);
      case 'quests':
        return this.ui.quests.board(p);
      case 'potions':
        return this.potions(p);
      case 'runes':
        return this.runes(p);
      case 'bless':
        return this.blessings(p);
      case 'curse':
        return this.curses(p);
      case 'rest':
        return this.rest(p);
      case 'trophy':
        return this.trophies(p);
      case 'up':
        return this.upgrade(p, id);
    }
  }

  /** a building still in ruins: who must come home to rebuild it */
  private ruins(id: BuildingId) {
    const b = BUILDING_BY_ID[id];
    const who = b.who!;
    this.P.talk(
      {
        title: `${b.name} · v troskách`,
        sub: b.desc,
        portrait: who.key,
        line: `Tady ${who.fem ? 'žila' : 'žil'} ${who.trade} ${who.name}. Nestvůry ${who.fem ? 'ji' : 'ho'} odvlekly do kobek – ${who.fem ? 'bývá k nalezení' : 'bývá k nalezení'} od ${b.rescue}. patra dolů. Až se vrátí, budova znovu ožije.`,
        choices: [{ id: 'ok', label: 'Najdu ' + (who.fem ? 'ji' : 'ho'), cls: 'green' }],
      },
      () => {},
    );
  }

  /** levels of the building and the gold it takes to grow */
  private upgrade(p: HTMLElement, id: BuildingId) {
    const body = $('.body', p);
    const s = this.save;
    const b = BUILDING_BY_ID[id];
    const lv = buildingLevel(s, id);
    const next = b.levels[lv];
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint" style="font-size:18px">${esc(b.desc)}</div>
      <div class="blevels">${b.levels
        .map(
          (l, i) =>
            `<div class="blv ${lv >= i + 1 ? 'have' : ''} ${lv === i ? 'next' : ''}" style="--bc:${b.color}"><div class="blvn">${ROMAN[i + 1]}</div><div style="min-width:0"><div>${esc(l.text)}</div><div class="hint">${i === 0 ? (b.who ? 'po návratu do Loppa' : 'od začátku') : lv >= i + 1 ? 'hotovo' : `${n(l.cost)} zlata`}</div></div>${lv >= i + 1 ? '<span class="blvok">✔</span>' : ''}</div>`,
        )
        .join('')}</div>
      ${
        next
          ? `<div class="row" style="justify-content:space-between;align-items:center;margin-top:10px"><span class="hint">Máš ${n(s.gold)} zlata.</span><button class="btn gold" data-a="invest" ${s.gold >= next.cost ? '' : 'disabled'}>Investovat ${n(next.cost)} zlata</button></div>`
          : '<div class="hint" style="margin-top:10px;color:#9dff9d">Budova je plně vylepšená.</div>'
      }
    </div>`;
    body.querySelector('[data-a=invest]')?.addEventListener('click', () => {
      const lvNow = buildingLevel(s, id);
      const nx = b.levels[lvNow];
      if (!nx || s.gold < nx.cost) return;
      s.gold -= nx.cost;
      villageOf(s).lv[id] = lvNow + 1;
      saveGame(s);
      this.sc.vil.refresh(id);
      if (id === 'shop') this.sc.vil.shop = this.sc.vil.makeShop();
      this.sc.player.recalc();
      this.sc.merc?.recalc();
      bus.emit('stats');
      $('.head h2', p).textContent = `${b.name} ${ROMAN[lvNow + 1]}${b.who ? ` – ${b.who.name}` : ''}`;
      this.ui.toast(`${b.name} ${ROMAN[lvNow + 1]}: ${nx.text}`, b.color);
      this.upgrade(p, id);
    });
  }

  /** the hero's own bed: a night at home heals and leaves the hero rested for a few floors */
  private rest(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const lv = buildingLevel(s, 'stash');
    const floors = restFloors(s);
    const r = restedOf(s);
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint" style="font-size:18px">Doma se spí nejlíp. Po noci ve vlastní posteli máš plné zdraví i manu a ${floors} pater dostáváš +10 % zkušeností${lv >= 3 ? ' a +5 % poškození' : ''}.</div>
      ${r ? `<div class="box" style="color:#9dff9d">Odpočinek platí do ${r.until}. patra.</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn green" data-a="sleep">${r ? 'Prospat se znovu' : 'Odpočinout si'}</button></div>
    </div>`;
    $('[data-a=sleep]', body).addEventListener('click', () => {
      villageOf(s).rested = { until: s.floor + floors - 1, lv };
      const pl = this.sc.player;
      pl.hp = pl.d.maxHp;
      pl.mp = pl.d.maxMp;
      pl.recalc();
      saveGame(s);
      sfx('heal');
      this.sc.fx.burst(pl.x, pl.y - 8, 0x9ad0ff, 16);
      this.ui.toast(`Odpočinek: +10 % zkušeností do ${s.floor + floors - 1}. patra`, '#9dff9d');
      bus.emit('stats');
      this.rest(p);
    });
  }

  /** the trophy wall of the hero's house */
  private trophies(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const st = (s.stats ?? {}) as Record<string, number | undefined>;
    const v = villageOf(s);
    const home = BUILDINGS.filter((b) => b.who && (v.lv[b.id] ?? 0) > 0).length;
    const fav = v.royal?.favor ?? 0;
    const hon = honorsOf(fav);
    const got = (s.achievements ?? []).length;
    const rows: [string, string][] = [
      ['Nejhlubší patro', `${s.maxFloor}.`],
      ['Poražení strážci', n(st.bosses ?? 0)],
      ['Poražené nestvůry', n(s.kills)],
      ['Pomsta na nemesis', n(st.nemeses ?? 0)],
      ['Zachránění vesničané', `${home} ze 7`],
      ['Přízeň krále', hon.length ? `${fav} · ${hon[hon.length - 1].name}` : `${fav}`],
      ['Kodex předmětů', `${codexCount(s)} z ${CODEX_TOTAL}`],
      ['Úspěchy', `${got} z ${ACHIEVEMENTS.length}`],
    ];
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Na stěně visí trofeje z hlubin – a ke každé patří jeden příběh.</div>
      <div class="trophies">${rows.map(([a, b]) => `<div class="statline box"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
      <div class="row" style="justify-content:center"><button class="btn" data-a="ach">🏆 Úspěchy a statistiky</button></div>
    </div>`;
    $('[data-a=ach]', body).addEventListener('click', () => this.ui.menus.achievements('ach'));
  }

  /** potions of the laboratory: cheaper than anywhere in the dungeon, as many as you like */
  private potions(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const f = this.sc.floor;
    const price = { hpPotion: Math.round(25 * (1 + f * 0.12) * 0.7), mpPotion: Math.round(20 * (1 + f * 0.12) * 0.7) };
    const strong = buildingLevel(s, 'lab') >= 2;
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Vanda vaří lektvary za 70 % ceny, kolik jen uneseš.${strong ? ' Lektvary z laboratoře II léčí o 25 % víc – všechny, i ty z kobek.' : ''}</div>
      ${(['hpPotion', 'mpPotion'] as const)
        .map(
          (k) => `<div class="statline box" style="align-items:center"><span class="row"><img style="width:32px;height:32px;image-rendering:pixelated" src="${iconURL(MAT_INFO[k].icon, 32)}">${MAT_INFO[k].name} <span class="hint">(máš ${s.mats[k]})</span></span>
          <span class="row"><span style="color:#ffd76a">${n(price[k])} zl.</span><button class="btn small green" data-buy="${k}" data-n="1" ${s.gold < price[k] ? 'disabled' : ''}>Koupit 1</button><button class="btn small green" data-buy="${k}" data-n="5" ${s.gold < price[k] * 5 ? 'disabled' : ''}>Koupit 5</button></span></div>`,
        )
        .join('')}
    </div>`;
    body.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.buy as 'hpPotion' | 'mpPotion';
        const cnt = +b.dataset.n!;
        if (s.gold < price[k] * cnt) return;
        s.gold -= price[k] * cnt;
        s.mats[k] += cnt;
        sfx('coin');
        bus.emit('stats');
        this.potions(p);
      }),
    );
  }

  runePrice(tier: number) {
    return Math.round(250 * Math.pow(3, tier - 1) * (1 + this.sc.floor / 25));
  }

  spellRunePrice() {
    return Math.round(3000 * (1 + this.sc.floor / 30));
  }

  /** the mage's runes: weapon runes up to the tower's grade, spell runes from the second level */
  private runes(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const max = runeMaxTier(s);
    const lv = buildingLevel(s, 'tower');
    body.innerHTML = `<div class="col" style="flex:1;min-width:0"><div class="scroll" style="flex:1">
      <div class="hint">Runy vložíš do zbraní (Inventář → Runy). Ignác prodává runy do ${max}. stupně${lv < 3 ? ' – vyšší až s větší věží' : ''}.</div>
      <div class="runeshop">${RUNES.map((r) =>
        Array.from({ length: max }, (_, i) => {
          const key = runeKey(r.id, i + 1);
          const pr = this.runePrice(i + 1);
          return `<div class="rsitem"><img src="${iconURL(runeIcon(key), 32)}"><div style="min-width:0"><div style="color:${r.color}">${esc(runeName(key))}</div><div class="hint">${esc(runeDesc(key))}</div></div><button class="btn small gold" data-rune="${key}" data-p="${pr}" ${s.gold < pr ? 'disabled' : ''}>${n(pr)} zl.</button></div>`;
        }).join(''),
      ).join('')}</div>
      <b style="color:#d8a8ff;display:block;margin-top:10px">Runy kouzel</b>
      ${
        lv >= 2
          ? `<div class="runeshop">${SPELL_RUNES.map((r) => `<div class="rsitem"><img src="${iconURL(spellRuneIcon(r.id), 32)}"><div style="min-width:0"><div style="color:${r.color}">${esc(r.name)}</div><div class="hint">${esc(r.desc)}</div></div><button class="btn small gold" data-srune="${r.id}" ${s.gold < this.spellRunePrice() ? 'disabled' : ''}>${n(this.spellRunePrice())} zl.</button></div>`).join('')}</div>`
          : '<div class="hint">Runy kouzel prodává až Věž mága II.</div>'
      }
    </div><div class="hint">Máš ${n(s.gold)} zlata.</div></div>`;
    body.querySelectorAll<HTMLElement>('[data-rune]').forEach((b) =>
      b.addEventListener('click', () => {
        const pr = +b.dataset.p!;
        if (s.gold < pr) return;
        s.gold -= pr;
        addRune(s, b.dataset.rune!);
        sfx('coin');
        this.ui.toast(`Koupeno: ${runeName(b.dataset.rune!)}`, '#d8a8ff');
        bus.emit('stats');
        const sy = $('.scroll', body).scrollTop;
        this.runes(p);
        $('.scroll', body).scrollTop = sy;
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-srune]').forEach((b) =>
      b.addEventListener('click', () => {
        const pr = this.spellRunePrice();
        if (s.gold < pr) return;
        s.gold -= pr;
        addSpellRune(s, b.dataset.srune!);
        sfx('coin');
        this.ui.toast(`Koupeno: ${SPELL_RUNES.find((r) => r.id === b.dataset.srune)!.name}`, '#d8a8ff');
        bus.emit('stats');
        const sy = $('.scroll', body).scrollTop;
        this.runes(p);
        $('.scroll', body).scrollTop = sy;
      }),
    );
  }

  blessingPrice() {
    return Math.round(400 * (1 + this.sc.floor / 8));
  }

  /** the temple's blessings for the next floors */
  private blessings(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const lv = buildingLevel(s, 'temple');
    const floors = blessingFloors(s);
    const cur = activeBlessing(s);
    const price = this.blessingPrice();
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Bohdana ti požehná na ${floors} patra (od patra ${s.floor} do ${s.floor + floors - 1}). Platí jen jedno požehnání najednou.</div>
      ${cur ? `<div class="box" style="color:${BLESSING_BY_ID[cur.id].color}">Teď tě chrání: ${esc(BLESSING_BY_ID[cur.id].name)} (do ${cur.until}. patra)</div>` : ''}
      <div class="blgrid">${BLESSINGS.map(
        (bl) => `<div class="blcard" style="--bc:${bl.color}"><div class="nm">${esc(bl.name)}</div><div class="hint">${esc(bl.desc(lv))}</div><button class="btn gold" data-bl="${bl.id}" ${s.gold < price ? 'disabled' : ''}>${n(price)} zl.</button></div>`,
      ).join('')}</div>
      <div class="hint">Máš ${n(s.gold)} zlata.</div>
    </div>`;
    body.querySelectorAll<HTMLElement>('[data-bl]').forEach((b) =>
      b.addEventListener('click', () => {
        if (s.gold < price) return;
        s.gold -= price;
        villageOf(s).blessing = { id: b.dataset.bl!, until: s.floor + floors - 1, lv };
        saveGame(s);
        this.sc.player.recalc();
        sfx('levelup');
        const p0 = this.sc.player;
        this.sc.fx.ring(p0.x, p0.y - 6, 40, 0xfff2a8, 700);
        this.ui.toast(`${BLESSING_BY_ID[b.dataset.bl!].name} tě provází do ${s.floor + floors - 1}. patra`, BLESSING_BY_ID[b.dataset.bl!].color);
        bus.emit('stats');
        this.blessings(p);
      }),
    );
  }

  tamePrice(it: Item) {
    return Math.round(1500 * (1 + it.ilvl / 15) * (buildingLevel(this.save, 'temple') >= 3 ? 0.5 : 1));
  }

  /** cursed items to tame: they keep part of their bonus and lose their price */
  private curses(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const list: { it: Item; where: string }[] = [];
    for (const it of Object.values(s.equip)) if (it?.curse && !it.tamed) list.push({ it, where: 'nošeno' });
    for (const it of s.inventory) if (it?.curse && !it.tamed) list.push({ it, where: 'v batohu' });
    body.innerHTML = `<div class="col" style="flex:1;min-width:0"><div class="scroll" style="flex:1">
      <div class="hint">Zkrocená kletba si nechá 60 % svého bonusu a přestane brát svou daň (postih zmizí).</div>
      ${
        list.length
          ? list
              .map(({ it, where }, i) => {
                const c = CURSE_BY_ID[it.curse!];
                const pr = this.tamePrice(it);
                return `<div class="rsitem">${this.P.slotHtml(it, '')}<div style="min-width:0"><div>${esc(it.name)}</div><div class="hint">☠ ${esc(c?.name ?? '')} · ${where}</div></div><button class="btn small gold" data-tame="${i}" ${s.gold < pr ? 'disabled' : ''}>Zkrotit · ${n(pr)} zl.</button></div>`;
              })
              .join('')
          : '<div class="hint" style="margin-top:10px">Nemáš u sebe žádný prokletý předmět.</div>'
      }
    </div><div class="hint">Máš ${n(s.gold)} zlata.</div></div>`;
    body.querySelectorAll<HTMLElement>('[data-tame]').forEach((b) =>
      b.addEventListener('click', () => {
        const { it } = list[+b.dataset.tame!];
        const pr = this.tamePrice(it);
        if (s.gold < pr) return;
        s.gold -= pr;
        it.tamed = true;
        saveGame(s);
        this.sc.player.recalc();
        sfx('levelup');
        this.ui.toast(`Kletba zkrocena: ${it.name}`, '#fff2a8');
        bus.emit('stats');
        this.curses(p);
      }),
    );
  }
}
