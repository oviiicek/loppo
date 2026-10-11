import { $, esc, keepScrollOn } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { BUILDING_BY_ID, BuildingId, BLESSINGS, BLESSING_BY_ID, blessingFloors, activeBlessing, buildingLevel, villageOf, runeMaxTier, restFloors, restedOf, BUILDINGS, prosperityLevel } from '../data/village';
import { PROSPERITY_STEPS, PROSPERITY_RANKS, prosperityCost, prosperityStats, prosperityRank, nextRank, wishCost, rollWish, fountainLuck } from '../data/fountain';
import { pearlWord } from '../data/pearls';
import { generateItem, itemColor, itemIcon, formatStat } from '../data/items';
import { randomGem, gemName, gemIcon } from '../data/gems';
import { randomRune } from '../data/runes';
import type { StatKey } from '../data/types';
import { honorsOf } from '../data/royal';
import { ACHIEVEMENTS } from '../data/achievements';
import { codexCount, CODEX_TOTAL } from '../data/codex';
import { ROMAN } from '../game/village';
import { RUNES, runeKey, runeName, runeIcon, runeDesc } from '../data/runes';
import { SPELL_RUNES, spellRuneIcon } from '../data/spellrunes';
import { CURSE_BY_ID } from '../data/curses';
import { Item } from '../data/types';
import { addRune, addSpellRune, saveGame, addGem, addPearls, addToInventory, bumpStat } from '../systems/state';
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
    // a building's tab drawn anew (an upgrade bought, a potion brewed) stays scrolled where it was
    keepScrollOn(this, ['potions', 'runes', 'blessings', 'curses', 'rest', 'trophies', 'upgrade', 'wishes', 'prosperity']);
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

  // ---------------------------------------------------------------- the fountain of wishes (see data/fountain.ts)
  /** results of the last wishes (newest first) */
  private wishLog: { text: string; color: string; icon: string }[] = [];

  /** the fountain in the king's courtyard: a coin for a wish, or gold given for the prosperity of Loppo */
  fountain(tab = 'wish') {
    const tabs = [
      { id: 'wish', label: 'Přání' },
      { id: 'pros', label: 'Prosperita Loppa' },
    ];
    let active = tab;
    const p = this.P.frame('Fontána přání', tabs, active);
    p.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        if (t.dataset.tab === active) return;
        sfx('ui');
        active = t.dataset.tab!;
        p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        this.fountainTab(p, active);
      }),
    );
    this.ui.showOverlay(p, () => {});
    this.fountainTab(p, active);
  }

  private fountainTab(p: HTMLElement, tab: string) {
    this.P.headMats(p);
    if (tab === 'pros') this.prosperity(p);
    else this.wishes(p);
  }

  private wishes(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const one = wishCost(s.maxFloor),
      big = wishCost(s.maxFloor, true);
    const luck = villageOf(s).luck;
    const lucky = luck && s.floor <= luck.until ? `<div class="box" style="color:#52ff8f">Štěstí fontány: +${luck.mf} % magického nálezu do ${luck.until}. patra.</div>` : '';
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint" style="font-size:17px">Na podstavci je vytesáno: „Dar krále Dobromila III. obyvatelům Loppa. Kdo hodí minci, ten se vrátí.“ Hoď do fontány minci a splní ti přání – co přinese, se nikdy neví.</div>
      ${lucky}
      <div class="wishes">
        <div class="wish box"><img src="${iconURL('ic_gold', 40)}"><div class="winfo"><b>Malé přání</b><span class="hint">Materiál, lektvary, paklíče, drahokam, runa, předmět, štěstí fontány nebo zlato zpět – vzácně legendární předmět nebo perla.</span></div>
          <div class="wbtns"><button class="btn small gold" data-wish="1" ${s.gold >= one ? '' : 'disabled'}>Hodit minci · ${n(one)}</button><button class="btn small" data-wish="10" ${s.gold >= one * 10 ? '' : 'disabled'}>10× · ${n(one * 10)}</button></div></div>
        <div class="wish box big"><img src="${iconURL('chest_gold', 40) || iconURL('ic_gold', 40)}"><div class="winfo"><b>Velké přání</b><span class="hint">Hrst mincí: epický či legendární předmět, drahokamy, runy, delší štěstí fontány – vzácně mýtický předmět nebo perly.</span></div>
          <div class="wbtns"><button class="btn small gold" data-big="1" ${s.gold >= big ? '' : 'disabled'}>Hodit hrst · ${n(big)}</button></div></div>
      </div>
      ${this.wishLog.length ? `<div class="wishlog">${this.wishLog.map((r) => `<div class="wl"><img src="${r.icon}"><span style="color:${r.color}">${esc(r.text)}</span></div>`).join('')}</div>` : ''}
    </div>`;
    const go = (count: number, isBig: boolean) => {
      const cost = isBig ? big : one;
      if (s.gold < cost * count) return;
      let rare = false;
      for (let i = 0; i < count; i++) {
        if (s.gold < cost) break;
        s.gold -= cost;
        bumpStat(s, 'wishes');
        const r = this.makeWish(isBig);
        rare ||= r.rare;
        this.wishLog.unshift(r);
      }
      this.wishLog = this.wishLog.slice(0, 12);
      this.sc.vil.throwCoin(isBig || count > 1, rare);
      this.sc.player.recalc();
      saveGame(s);
      bus.emit('stats');
      this.P.headMats(p);
      this.wishes(p);
    };
    body.querySelectorAll<HTMLElement>('[data-wish]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.wish!, false)));
    body.querySelector('[data-big]')?.addEventListener('click', () => go(1, true));
  }

  /** what one wish brings (applied at once) */
  private makeWish(big: boolean): { text: string; color: string; icon: string; rare: boolean } {
    const s = this.save;
    const F = Math.max(1, s.maxFloor);
    const rnd = (k: number) => Math.floor(Math.random() * k);
    const kind = rollWish(big);
    switch (kind) {
      case 'mats': {
        const d = big ? 8 + rnd(8) : 2 + rnd(4),
          st = big ? 4 + rnd(6) : 1 + rnd(3);
        s.mats.dust += d;
        s.mats.stone += st;
        if (big) s.mats.lockpick += 2;
        return { text: `${d}× magický prach, ${st}× kámen${big ? ', 2× paklíč' : ''}`, color: '#c8b8ff', icon: iconURL('ic_dust', 32), rare: false };
      }
      case 'potions': {
        const h = 2 + rnd(2),
          m = 1 + rnd(2);
        s.mats.hpPotion += h;
        s.mats.mpPotion += m;
        return { text: `${h}× lektvar zdraví, ${m}× lektvar many`, color: '#ff8a8a', icon: iconURL(MAT_INFO.hpPotion.icon, 32), rare: false };
      }
      case 'lockpick': {
        const k = 1 + rnd(2);
        s.mats.lockpick += k;
        return { text: `${k}× paklíč`, color: '#e8d8b0', icon: iconURL(MAT_INFO.lockpick.icon, 32), rare: false };
      }
      case 'gold': {
        const m = [0.5, 0.5, 1, 1, 1.5, 2, 3][rnd(7)];
        const g = Math.round(wishCost(F, big) * m);
        s.gold += g;
        return { text: `Fontána vrátila ${n(g)} zlata${m >= 2 ? ' – štěstí!' : ''}`, color: '#ffd23a', icon: iconURL('ic_gold', 32), rare: m >= 3 };
      }
      case 'gem':
      case 'gems': {
        const k = kind === 'gems' ? 2 + rnd(2) : 1;
        const got: string[] = [];
        for (let i = 0; i < k; i++) {
          const g = randomGem(F, big ? 1 : 0);
          addGem(s, g);
          got.push(g);
        }
        return { text: got.map((g) => gemName(g)).join(', '), color: '#7cc8ff', icon: iconURL(gemIcon(got[0]), 32), rare: false };
      }
      case 'rune':
      case 'runes': {
        const k = kind === 'runes' ? 2 : 1;
        const got: string[] = [];
        for (let i = 0; i < k; i++) {
          const r = randomRune(F, big ? 1 : 0);
          addRune(s, r);
          got.push(r);
        }
        return { text: got.map((r) => runeName(r)).join(', '), color: '#ffb070', icon: iconURL(runeIcon(got[0]), 32), rare: false };
      }
      case 'srune': {
        const r = SPELL_RUNES[rnd(SPELL_RUNES.length)];
        addSpellRune(s, r.id);
        return { text: r.name, color: r.color, icon: iconURL(spellRuneIcon(r.id), 32), rare: true };
      }
      case 'item':
        return this.wishItem(generateItem(F + (big ? 2 : 0), { rarity: big ? (Math.random() < 0.6 ? 3 : 4) : Math.random() < 0.6 ? 2 : 3 }), false);
      case 'legend':
        return this.wishItem(generateItem(F + 2, { rarity: 4 }), true);
      case 'mythic':
        return this.wishItem(generateItem(F + 3, { rarity: 5 }), true);
      case 'luck': {
        const l = fountainLuck(big);
        const v = villageOf(s);
        const was = v.luck && s.floor <= v.luck.until ? v.luck : null;
        v.luck = { until: Math.max(was?.until ?? 0, s.floor - 1) + l.floors, mf: Math.max(l.mf, was?.mf ?? 0) };
        return { text: `Štěstí fontány: +${v.luck.mf} % magického nálezu do ${v.luck.until}. patra`, color: '#52ff8f', icon: spellIcon('star', '#52ff8f', 32), rare: false };
      }
      case 'pearl': {
        const k = big ? 1 + rnd(3) : 1;
        addPearls(s, k);
        return { text: `${k} ${pearlWord(k)} hlubin!`, color: '#d8ccff', icon: iconURL('ic_pearl', 32), rare: true };
      }
    }
    return { text: 'Mince zmizela pod hladinou…', color: '#9a9aa8', icon: iconURL('ic_gold', 32), rare: false };
  }

  /** an item from a wish: into the bag, or at the hero's feet when the bag is full */
  private wishItem(it: Item, rare: boolean) {
    const s = this.save;
    if (!addToInventory(s, it)) {
      const p = this.sc.player;
      this.sc.loot.dropItem(it, p.x, p.y + 8);
    }
    this.ui.loot(it.name, itemColor(it), iconURL(itemIcon(it), 32));
    return { text: it.name, color: itemColor(it), icon: iconURL(itemIcon(it), 32), rare: rare || it.rarity >= 4 };
  }

  /** the prosperity of Loppo: gold given to the village, a level at a time, without end */
  private prosperity(p: HTMLElement) {
    const body = $('.body', p);
    const s = this.save;
    const lv = prosperityLevel(s);
    const rank = prosperityRank(lv);
    const nr = nextRank(lv);
    const cost = prosperityCost(lv);
    const step = PROSPERITY_STEPS[lv % PROSPERITY_STEPS.length];
    // how many levels the gold the hero has would buy
    let k = 0,
      sum = 0;
    while (k < 50 && sum + prosperityCost(lv + k) <= s.gold) {
      sum += prosperityCost(lv + k);
      k++;
    }
    const stats = prosperityStats(lv);
    const given = s.village?.prosperity?.given ?? 0;
    const from = nr ? PROSPERITY_RANKS.filter((r) => r.lv <= lv).pop()!.lv : lv;
    const frac = nr ? (lv - from) / (nr.lv - from) : 1;
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="prosrank"><b>Loppo · ${esc(rank.name)}</b><span>prosperita ${lv}</span></div>
      <div class="hint">Zlato darované osadě se promění v lepší Loppo: každá úroveň dá tvému hrdinovi trvalý bonus a každá pátá vesnici promění. Úrovní je neomezeně.</div>
      <div class="prosnext box"><div style="min-width:0"><b>Úroveň ${lv + 1}:</b> ${esc(step.text)}<div class="hint">${n(cost)} zlata</div></div><button class="btn gold" data-give="1" ${s.gold >= cost ? '' : 'disabled'}>Darovat ${n(cost)}</button></div>
      ${k >= 2 ? `<div class="row" style="justify-content:flex-end"><button class="btn small" data-give="${k}">Darovat na ${k} úrovní · ${n(sum)}</button></div>` : ''}
      ${nr ? `<div class="prosbar"><span>Do hodnosti ${esc(nr.name)} (úroveň ${nr.lv}): ${esc(nr.adds)}</span><i><b style="width:${Math.round(frac * 100)}%"></b></i></div>` : '<div class="hint" style="color:#ffd76a">Loppo dosáhlo nejvyšší hodnosti – ale každá další úroveň dál přidává bonusy.</div>'}
      <div class="prossum box"><b>Bonusy z prosperity</b>${
        Object.keys(stats).length
          ? `<div class="prostats">${Object.entries(stats)
              .map(([key, v]) => `<span>${esc(formatStat(key as StatKey, v as number))}</span>`)
              .join('')}</div>`
          : '<div class="hint">Zatím žádné – první dar to změní.</div>'
      }</div>
      <div class="prosranks">${PROSPERITY_RANKS.slice(1)
        .map((r) => `<div class="prk ${lv >= r.lv ? 'have' : ''}"><b>${r.lv}</b><span>${esc(r.name)}</span><span class="hint">${esc(r.adds)}</span>${lv >= r.lv ? '<em>✔</em>' : ''}</div>`)
        .join('')}</div>
      <div class="hint">Darováno celkem: ${n(given)} zlata.</div>
    </div>`;
    body.querySelectorAll<HTMLElement>('[data-give]').forEach((b) =>
      b.addEventListener('click', () => {
        const want = +b.dataset.give!;
        const v = villageOf(s);
        const pr = (v.prosperity ??= { lv: 0, given: 0 });
        const before = prosperityRank(pr.lv);
        let bought = 0;
        for (let i = 0; i < want; i++) {
          const c = prosperityCost(pr.lv);
          if (s.gold < c) break;
          s.gold -= c;
          pr.lv++;
          pr.given += c;
          bumpStat(s, 'donated', c);
          bought++;
        }
        if (!bought) return;
        const after = prosperityRank(pr.lv);
        this.sc.player.recalc();
        this.sc.vil.refreshProsperity();
        saveGame(s);
        bus.emit('stats');
        sfx(after !== before ? 'levelup' : 'coin');
        const pl = this.sc.player;
        this.sc.fx.burst(pl.x, pl.y - 10, 0xffd76a, after !== before ? 40 : 14, 'spark');
        if (after !== before) this.ui.toast(`🏰 Loppo je teď ${after.name}! Přibylo: ${after.adds}`, '#ffd76a');
        else this.ui.toast(`Prosperita Loppa ${pr.lv}${bought > 1 ? ` (+${bought})` : ''}: ${PROSPERITY_STEPS[(pr.lv - 1) % PROSPERITY_STEPS.length].text}`, '#ffe9a8');
        this.P.headMats(p);
        this.prosperity(p);
      }),
    );
  }
}
