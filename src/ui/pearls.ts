import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { TRAILS, TRAIL_BY_ID, PEARL_OFFERS, PearlOffer, pearlState, pearlGold, pearlWord } from '../data/pearls';
import { AURAS, AURA_BY_ID, TITLES, TITLE_BY_ID, CANDLE_MAX, redeemCode, seasonNow, dealToday, dealOpen, starterUntil, Deal } from '../data/live';
import { PRODUCTS, PRODUCT_BY_ID, Product, STARTER_DAYS, MONTH_DAILY, MONTH_DAYS, productWorth, currencyFor, formatPrice, pearlRate } from '../data/store';
import { storeOpen, storeKind, priceOf, buyProduct, canBuy, firstPurchase, monthPearlsToday, takeMonthPearls } from '../systems/store';
import { currentLang } from '../i18n/i18n';
import { dayKey } from '../data/pearls';
import { addPearls, addToInventory, addGem, addRune, saveGame, bagSize } from '../systems/state';
import { generateItem, itemColor, itemIcon } from '../data/items';
import { randomGem, gemName } from '../data/gems';
import { randomRune, runeName } from '../data/runes';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { LivePanels } from './live';

type UIM = typeof UIType;

const n = (v: number) => v.toLocaleString('cs-CZ');

// The pearls of the depths: what comes back every day (the "Dnes" tab: the flame of the wick, the newcomer's path,
// the daily depth, the tasks), the season's path, what pearls buy (comfort, help for a while, gold), the looks
// (trails, auras, titles), and where pearls come from – with the packs that will be sold for real money once
// payments are ready.
export class PearlPanels {
  ui: UIM;
  live: LivePanels;
  constructor(ui: UIM) {
    this.ui = ui;
    this.live = new LivePanels(ui);
  }

  get sc() {
    return this.ui.scene!;
  }
  get save() {
    return this.sc.save;
  }

  /** the pearls' panel that is open (it is drawn again when a purchase arrives) */
  private cur: { p: HTMLElement; tab: string } | null = null;

  refresh() {
    const c = this.cur;
    if (c && c.p.isConnected) this.render(c.p, c.tab);
  }

  /** the panel; `over`: as a dialog over another overlay (the death screen), which comes back when it closes */
  open(tab = 'today', over = false) {
    const tabs = [
      { id: 'today', label: 'Dnes' },
      { id: 'season', label: 'Sezóna' },
      { id: 'shop', label: 'Obchod' },
      { id: 'looks', label: 'Vzhled' },
      { id: 'get', label: 'Získat perly' },
    ];
    let active = tab;
    const p = this.ui.panels.frame('Perly hlubin', tabs, active);
    p.classList.add('pearlpanel');
    p.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        if (t.dataset.tab === active) return;
        sfx('ui');
        active = t.dataset.tab!;
        this.cur = { p, tab: active };
        p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        // (another tab starts at its top)
        $('.body', p).scrollTop = 0;
        this.render(p, active);
      }),
    );
    if (over) {
      const close = this.ui.dialog(p);
      // the frame's close button would close the overlay underneath: it closes the dialog instead
      const old = $('.close', p);
      const btn = old.cloneNode(true) as HTMLElement;
      old.replaceWith(btn);
      btn.addEventListener('click', () => {
        sfx('ui');
        close();
      });
    } else this.ui.showOverlay(p, () => {});
    this.cur = { p, tab: active };
    this.render(p, active);
  }

  /** shows another tab of the open panel */
  private goTab(p: HTMLElement, tab: string) {
    const t = p.querySelector<HTMLElement>(`.tab[data-tab=${tab}]`);
    if (t) t.click();
  }

  /** not enough pearls for something: how many are missing and the way to get them */
  shortfall(need: number, p?: HTMLElement) {
    const have = this.save.pearls ?? 0;
    const miss = Math.max(1, need - have);
    // the smallest pack of pearls that covers what is missing (the biggest one when none does)
    const open = storeOpen();
    const first = firstPurchase(this.save);
    const packs = PRODUCTS.filter((x) => x.kind === 'pearls');
    const gives = (x: Product) => x.pearls * (first ? 2 : 1) + (x.bonus ?? 0);
    const pick = open ? packs.find((x) => gives(x) >= miss) ?? packs[packs.length - 1] : null;
    const d = el(`<div class="panel small shortfall"><div class="head"><h2>Chybí ti perly</h2></div><div style="padding:14px">
      <p class="hint" style="font-size:18px;margin:0 0 6px">Na tohle potřebuješ ${n(need)} 💠, máš ${n(have)} 💠 – chybí ${n(miss)} 💠.</p>
      <p class="hint" style="margin:0 0 12px">Perly dávají denní úkoly, denní hlubina, plamen knotu a sezónní cesta.${open ? ' Nebo si je můžeš koupit.' : ''}</p>
      ${pick ? `<div class="sfpack"><span class="hint">${gives(pick) >= miss ? 'Stačí ti:' : 'Největší balíček:'}</span>${this.productHtml(pick, first)}</div>` : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" data-x="no">Zpět</button><button class="btn violet" data-x="get">💠 Získat perly</button></div></div></div>`);
    const close = this.ui.dialog(d);
    this.bindPay(d, close);
    d.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b || b.dataset.pay) return;
      sfx('ui');
      close();
      if (b.dataset.x === 'get') {
        if (p?.isConnected) this.goTab(p, 'get');
        // (over the death screen the panel opens as a dialog, so the screen comes back)
        else this.open('get', !!this.ui.scene?.player.dead);
      }
    });
  }

  private render(p: HTMLElement, tab: string) {
    this.ui.panels.headMats(p);
    this.tabDots(p);
    const body = $('.body', p);
    body.classList.add('scroll');
    const again = () => this.render(p, tab);
    if (tab === 'today') {
      this.live.today(body, again);
      // the month's pearls of today and today's deal right under the flame
      body.querySelector('.lvsec.flame')?.insertAdjacentHTML('afterend', (monthPearlsToday(this.save) ? this.monthHtml() : '') + this.dealHtml());
      this.bindDeal(p, body, again);
      this.bindMonth(body, again);
    }
    else if (tab === 'season') this.live.season(body, again);
    else if (tab === 'looks') this.looks(p, body);
    else if (tab === 'get') this.get(p, body);
    else this.shop(p, body);
  }

  /** a dot on the tabs with something to take (or today's daily depth not tried yet) */
  private tabDots(p: HTMLElement) {
    const live = this.live;
    const season = live.seasonWaiting();
    const dot = (id: string, on: boolean) => p.querySelector(`.tab[data-tab=${id}]`)?.classList.toggle('dot', on);
    dot('today', live.waiting() - season > 0 || live.delveWaiting());
    dot('season', season > 0);
  }

  /** how many of an offer the hero has (or has bought) and whether more can be bought */
  private owned(o: PearlOffer): { have: number; text: string } {
    const st = pearlState(this.save);
    const f = this.sc.floor;
    switch (o.id) {
      case 'wisdom':
        return { have: 0, text: (st.wisdom ?? 0) >= f ? `působí do ${st.wisdom}. patra` : '' };
      case 'luck':
        return { have: 0, text: (st.luck ?? 0) >= f ? `působí do ${st.luck}. patra` : '' };
      case 'phoenix':
        return { have: st.phoenix ?? 0, text: `máš ${st.phoenix ?? 0} z ${o.max}` };
      case 'candle':
        return { have: st.candles ?? 0, text: `máš ${st.candles ?? 0} z ${o.max}` };
      case 'bag':
        return { have: st.bag ?? 0, text: `batoh: ${bagSize(this.save)} míst` };
      case 'stash':
        return { have: st.stash ?? 0, text: `koupeno ${st.stash ?? 0} z ${o.max}` };
      case 'gold':
        return { have: 0, text: `${n(pearlGold(this.save.maxFloor))} zlata` };
      default:
        return { have: 0, text: '' };
    }
  }

  private shop(p: HTMLElement, body: HTMLElement) {
    const s = this.save;
    const pearls = s.pearls ?? 0;
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Perly hlubin jsou vzácnější než zlato. Máš <b class="pearlnum">${n(pearls)}</b> ${pearlWord(pearls)}.</div>
      ${this.dealHtml()}
      <div class="pshop">${PEARL_OFFERS.map((o) => {
        const own = this.owned(o);
        const full = o.max !== undefined && own.have >= o.max;
        return `<div class="poffer box" style="--pc:${o.css}"><img src="${spellIcon(o.glyph, o.css, 44)}"><div class="pinfo"><b>${esc(o.name)}</b><span class="hint">${esc(o.desc)}</span>${own.text ? `<span class="pown">${esc(own.text)}</span>` : ''}</div><button class="btn small ${full ? '' : 'violet'} ${!full && pearls < o.price ? 'short' : ''}" data-buy="${o.id}" ${full ? 'disabled' : ''}>${full ? 'Plné' : `${o.price} 💠`}</button></div>`;
      }).join('')}</div>
      <div class="hint" style="margin-top:8px">Perlovou cestu sezóny najdeš v záložce Sezóna, stopy, aury a tituly ve Vzhledu.</div>
    </div>`;
    this.bindDeal(p, body, () => this.render(p, 'shop'));
    body.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = PEARL_OFFERS.find((x) => x.id === b.dataset.buy);
        if (!o) return;
        if ((s.pearls ?? 0) < o.price) return this.shortfall(o.price, p);
        if (this.buy(o)) {
          sfx('coin');
          saveGame(s);
          bus.emit('stats');
        }
        this.render(p, 'shop');
      }),
    );
  }

  /** an offer bought: false when it could not be (a full bag, the most feathers held already) */
  private buy(o: PearlOffer): boolean {
    const s = this.save;
    const st = pearlState(s);
    const sc = this.sc;
    const f = Math.max(sc.floor, 1);
    switch (o.id) {
      case 'wisdom':
        st.wisdom = Math.max(st.wisdom ?? 0, f - 1) + 10;
        this.ui.toast(`📖 Kniha moudrosti: +50 % zkušeností do ${st.wisdom}. patra`, '#9fe6ff');
        break;
      case 'luck':
        st.luck = Math.max(st.luck ?? 0, f - 1) + 10;
        this.ui.toast(`🍀 Měšec štěstí: +50 % magického nálezu do ${st.luck}. patra`, '#52ff8f');
        break;
      case 'phoenix':
        if ((st.phoenix ?? 0) >= (o.max ?? 3)) return false;
        st.phoenix = (st.phoenix ?? 0) + 1;
        this.ui.toast(`🔥 Pírko fénixe (${st.phoenix}) – až padneš, vrátí tě do boje`, '#ffb070');
        break;
      case 'candle':
        if ((st.candles ?? 0) >= CANDLE_MAX) return false;
        st.candles = (st.candles ?? 0) + 1;
        this.ui.toast('🕯 Strážná svíce – plamen knotu přečká vynechaný den', '#ffc46a');
        break;
      case 'chest': {
        const ilvl = s.maxFloor + 2;
        const it = generateItem(ilvl, { rarity: Math.random() < 0.15 ? 5 : 4 });
        if (!addToInventory(s, it)) {
          this.ui.toast('Batoh je plný – udělej místo a otevři truhlu znovu', '#ff8080');
          return false;
        }
        const g1 = randomGem(s.maxFloor, 1),
          g2 = randomGem(s.maxFloor, 1);
        addGem(s, g1);
        addGem(s, g2);
        const r = randomRune(s.maxFloor, 1);
        addRune(s, r);
        this.ui.loot(it.name, itemColor(it), iconURL(itemIcon(it), 32));
        this.ui.toast(`👑 Perlová truhla: ${it.name}, ${gemName(g1)}, ${gemName(g2)}, ${runeName(r)}`, itemColor(it));
        sc.player.recalc();
        break;
      }
      case 'bag':
        if ((st.bag ?? 0) >= (o.max ?? 3)) return false;
        st.bag = (st.bag ?? 0) + 1;
        while (s.inventory.length < bagSize(s)) s.inventory.push(null);
        this.ui.toast(`🎒 Větší batoh: ${bagSize(s)} míst`, '#e8c890');
        break;
      case 'stash':
        if ((st.stash ?? 0) >= (o.max ?? 3)) return false;
        st.stash = (st.stash ?? 0) + 1;
        this.ui.toast('🧰 Truhla doma má o 42 míst víc', '#c8a070');
        break;
      case 'gold': {
        const g = pearlGold(s.maxFloor);
        s.gold += g;
        this.ui.toast(`🪙 Směna: +${n(g)} zlata`, '#ffd23a');
        break;
      }
    }
    addPearls(s, -o.price);
    return true;
  }

  /** the looks: trails behind the hero, auras under them and titles next to the name (seen by the others too) */
  private looks(p: HTMLElement, body: HTMLElement) {
    const s = this.save;
    const st = pearlState(s);
    const pearls = s.pearls ?? 0;
    const season = seasonNow();
    const row = (kind: 'trail' | 'aura' | 'title', id: string, name: string, desc: string, price: number, glyph: string, css: string, how?: string) => {
      const have = (kind === 'trail' ? st.trails : kind === 'aura' ? st.auras : st.titles) ?? [];
      const own = have.includes(id);
      const on = (kind === 'trail' ? st.trail : kind === 'aura' ? st.aura : st.title) === id;
      const btn = on
        ? `<button class="btn small" data-off="${kind}">Sundat</button>`
        : own
          ? `<button class="btn small green" data-wear="${kind}:${id}">${kind === 'title' ? 'Použít' : 'Nosit'}</button>`
          : price
            ? `${kind !== 'title' ? `<button class="btn small" data-try="${kind}:${id}" title="Vyzkoušet na 30 sekund">👁</button>` : ''}<button class="btn small violet ${pearls < price ? 'short' : ''}" data-get="${kind}:${id}">${price} 💠</button>`
            : `<span class="lock" title="${esc(how ?? '')}">🔒</span>`;
      return `<div class="poffer box ${on ? 'on' : ''} ${!own && !price ? 'earn' : ''}" style="--pc:${css}"><img src="${spellIcon(glyph, css, 44)}"><div class="pinfo"><b>${esc(name)}</b><span class="hint">${esc(desc)}</span>${on ? `<span class="pown">${kind === 'title' ? 'používáš' : 'nosíš'}</span>` : own ? '<span class="pown">máš</span>' : how ? `<span class="phow">${esc(how)}</span>` : ''}</div>${btn}</div>`;
    };
    // a season's look shows only in its season, or once the hero has it
    const showSeason = (id: string, sn: number | undefined, have: string[] | undefined) => !sn || (have ?? []).includes(id) || (sn - 1) % 4 === (season.n - 1) % 4;
    const trails = TRAILS.filter((t) => showSeason(t.id, t.season, st.trails)).map((t) => row('trail', t.id, t.name, t.desc, t.price, t.glyph, t.css, t.season ? 'Perlová cesta sezóny, 10. stupeň' : undefined));
    const auras = AURAS.filter((a) => showSeason(a.id, a.season, st.auras)).map((a) => row('aura', a.id, a.name, a.desc, a.price, a.glyph, a.css, a.how ?? (a.season ? 'Perlová cesta sezóny, 20. stupeň' : undefined)));
    const titles = TITLES.filter((t) => showSeason(t.id, t.season, st.titles)).map((t) => row('title', t.id, t.name, 'Píše se pod tvé jméno – ve společné hře ho uvidí ostatní.', t.price, 'crown', t.css, t.price ? undefined : t.how ?? 'Perlová cesta sezóny, 30. stupeň'));
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Vzhled nic nepřidává k síle – jen ukazuje, kudy jdeš. Ve společné hře ho vidí i ostatní. Koupené věci zůstávají navždy, nosit jde od každého druhu jedna.</div>
      <b class="qsect">Stopy</b><div class="pshop">${trails.join('')}</div>
      <b class="qsect">Aury</b><div class="pshop">${auras.join('')}</div>
      <b class="qsect">Tituly</b><div class="pshop">${titles.join('')}</div>
    </div>`;
    const key = (k: string) => (k === 'trail' ? 'trails' : k === 'aura' ? 'auras' : 'titles') as 'trails' | 'auras' | 'titles';
    const price = (k: string, id: string) => (k === 'trail' ? TRAIL_BY_ID[id]?.price : k === 'aura' ? AURA_BY_ID[id]?.price : TITLE_BY_ID[id]?.price) ?? 0;
    const name = (k: string, id: string) => (k === 'trail' ? TRAIL_BY_ID[id]?.name : k === 'aura' ? AURA_BY_ID[id]?.name : TITLE_BY_ID[id]?.name) ?? id;
    const wear = (k: string, id: string | null) => {
      if (k === 'trail') st.trail = id;
      else if (k === 'aura') st.aura = id;
      else st.title = id;
    };
    body.querySelectorAll<HTMLElement>('[data-get]').forEach((b) =>
      b.addEventListener('click', () => {
        const [k, id] = b.dataset.get!.split(':');
        const pr = price(k, id);
        const have = (st[key(k)] ??= []);
        if (!pr || have.includes(id)) return;
        if ((s.pearls ?? 0) < pr) return this.shortfall(pr, p);
        addPearls(s, -pr);
        have.push(id);
        wear(k, id);
        sfx('coin');
        this.ui.toast(`✨ ${k === 'trail' ? 'Nová stopa' : k === 'aura' ? 'Nová aura' : 'Nový titul'}: ${name(k, id)}`, '#d8ccff');
        saveGame(s);
        this.render(p, 'looks');
      }),
    );
    // trying a look on: the panel closes and the hero wears it for half a minute
    body.querySelectorAll<HTMLElement>('[data-try]').forEach((b) =>
      b.addEventListener('click', () => {
        const [k, id] = b.dataset.try!.split(':') as ['trail' | 'aura', string];
        st.trying = { kind: k, id, until: performance.now() + 30000 };
        sfx('ui');
        this.ui.closeOverlay();
        this.ui.toast(`👁 Náhled: ${name(k, id)} na 30 sekund – projdi se. Koupit ho můžeš ve Vzhledu.`, '#d8ccff');
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-wear]').forEach((b) =>
      b.addEventListener('click', () => {
        const [k, id] = b.dataset.wear!.split(':');
        wear(k, id);
        sfx('ui');
        saveGame(s);
        this.render(p, 'looks');
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-off]').forEach((b) =>
      b.addEventListener('click', () => {
        wear(b.dataset.off!, null);
        sfx('ui');
        saveGame(s);
        this.render(p, 'looks');
      }),
    );
  }

  /** today's deal (in the shop and the "Dnes" tab): about forty per cent off, once a day */
  dealHtml(): string {
    const st = pearlState(this.save);
    const d = dealToday(st);
    const open = dealOpen(st);
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const left = mid.getTime() - now.getTime();
    const h = Math.floor(left / 3600000),
      m = Math.floor((left % 3600000) / 60000);
    const off = Math.round((1 - d.price / d.was) * 100);
    return `<div class="deal box ${open ? '' : 'sold'}" style="--pc:${d.css}">
      <span class="dtag">−${off} %</span>
      <img src="${spellIcon(d.glyph, d.css, 52)}">
      <div class="pinfo"><span class="dhead">🏷 Nabídka dne · ještě ${h} h ${m} min</span><b>${esc(d.name)}</b><span class="hint">${esc(d.desc)}</span></div>
      ${open ? `<button class="btn violet ${(this.save.pearls ?? 0) < d.price ? 'short' : ''}" data-a="deal"><s>${d.was}</s> ${d.price} 💠</button>` : '<span class="pown">✔ Koupeno – zítra nová nabídka</span>'}
    </div>`;
  }

  bindDeal(p: HTMLElement, root: HTMLElement, again: () => void) {
    root.querySelector('[data-a=deal]')?.addEventListener('click', () => {
      const s = this.save;
      const st = pearlState(s);
      const d: Deal = dealToday(st);
      if (!dealOpen(st)) return;
      if ((s.pearls ?? 0) < d.price) return this.shortfall(d.price, p);
      // (the item first: a full bag stops the deal before the pearls are paid)
      if (!this.live.grantAll(d.give, `Nabídka dne: ${d.name}`)) return;
      addPearls(s, -d.price);
      st.deal = dayKey(new Date());
      saveGame(s);
      bus.emit('stats');
      again();
    });
  }

  /** the month of pearls bought: today's pearls to take */
  monthHtml(): string {
    const st = pearlState(this.save);
    const until = st.month?.until.split('-').map(Number) ?? [0, 0, 0];
    return `<div class="lvsec box monthday"><div class="pinfo"><b>🌙 Měsíc perel</b><span class="hint">Dnešních ${MONTH_DAILY} perel čeká · do ${until[2]}. ${until[1]}.</span></div><button class="btn gold" data-a="month">Vyzvednout</button></div>`;
  }

  bindMonth(root: HTMLElement, again: () => void) {
    root.querySelector('[data-a=month]')?.addEventListener('click', () => {
      const s = this.save;
      const got = takeMonthPearls(s);
      if (!got) return;
      sfx('coin');
      this.ui.toast(`🌙 Měsíc perel: +${got} ${pearlWord(got)}`, '#9fe6ff');
      saveGame(s);
      this.ui.liveBadge();
      again();
    });
  }

  /** after a hero's first guardian: the newcomer's pack, offered once while it can still be bought (it is a good
   *  deal and the moment fits: the hero has just won and the first week is not over) */
  starterNudge() {
    const s = this.save;
    if (!s || !storeOpen() || this.ui.panel || this.ui.cutsceneActive || this.ui.scene?.cinematic || this.ui.scene?.player.dead) return;
    const st = pearlState(s);
    const pr = PRODUCT_BY_ID.starter;
    const end = starterUntil(st, STARTER_DAYS);
    if (st.nudged || !end || !canBuy(s, pr)) return;
    st.nudged = true;
    saveGame(s);
    const ms = end.getTime() - Date.now();
    const d = Math.floor(ms / 86400000),
      h = Math.floor((ms % 86400000) / 3600000);
    const left = d > 0 ? `zbývá ${d} d ${h} h` : `zbývá ${h} h`;
    const box = el(`<div class="panel small nudge"><div class="head"><h2>🎁 Nabídka pro nováčky</h2></div><div style="padding:14px">
      <p class="hint" style="margin:0 0 10px">První strážce padl! Balíček nováčka je jen pro první týden hraní a koupit ho jde jen jednou.</p>
      <div class="starter box"><span class="dtag">${esc(left)}</span>${this.productHtml(pr, false)}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-x="no">Teď ne</button></div></div></div>`);
    const close = this.ui.dialog(box);
    this.bindPay(box, close);
    $('[data-x=no]', box).addEventListener('click', () => {
      sfx('ui');
      close();
    });
  }

  /** the price buttons of products for real money; `done` runs once a purchase went through (or was started) */
  private bindPay(root: HTMLElement, done?: () => void) {
    root.querySelectorAll<HTMLButtonElement>('[data-pay]').forEach((b) =>
      b.addEventListener('click', async () => {
        const pr = PRODUCT_BY_ID[b.dataset.pay!];
        if (!pr) return;
        sfx('ui');
        b.disabled = true;
        const err = await buyProduct(pr);
        if (err) {
          b.disabled = false;
          this.ui.toast(err, '#ff8080');
        } else done?.();
      }),
    );
  }

  /** a product for real money: its card (the price, what it is worth, a ribbon) */
  private productHtml(pr: Product, first: boolean): string {
    const open = storeOpen();
    const can = canBuy(this.save, pr);
    const btn = !open ? '<button class="btn small" disabled>Brzy</button>' : can ? `<button class="btn small gold" data-pay="${pr.id}">${esc(priceOf(pr))}</button>` : '<span class="pown">✔ Máš</span>';
    if (pr.kind === 'pearls') {
      const doubled = first && open;
      return `<div class="ppack box ${pr.tag ? 'tagged' : ''}">${doubled ? '<span class="ptag x2">2× první nákup</span>' : pr.tag ? `<span class="ptag">${esc(pr.tag)}</span>` : ''}<img src="${iconURL('ic_pearl', 40)}"><b>${n(pr.pearls + (doubled ? pr.pearls : 0))}${pr.bonus ? ` <span class="pbonus">+${pr.bonus}</span>` : ''}</b>${btn}</div>`;
    }
    const worth = productWorth(pr);
    const css = pr.kind === 'starter' ? '#ffb347' : '#9fe6ff';
    const glyph = pr.kind === 'starter' ? 'star' : 'moon';
    const title = pr.kind === 'starter' ? 'Balíček nováčka' : 'Měsíc perel';
    const desc = pr.kind === 'starter' ? '100 perel, Žhnoucí aura a 2 pírka fénixe. Jen jednou za hru.' : `${pr.pearls} perel hned a pak ${MONTH_DAILY} perel každý den po dobu ${MONTH_DAYS} dní – celkem ${pr.pearls + MONTH_DAYS * MONTH_DAILY} perel.`;
    return `<div class="poffer box special" style="--pc:${css}"><img src="${spellIcon(glyph, css, 44)}"><div class="pinfo"><b>${esc(title)}</b><span class="hint">${esc(desc)}</span><span class="pworth">Hodnota ${n(worth)} 💠</span></div>${btn}</div>`;
  }

  private get(p: HTMLElement, body: HTMLElement) {
    const s = this.save;
    const st = pearlState(s);
    const days = st.streak ?? 0;
    const open = storeOpen();
    const first = firstPurchase(s);
    const starter = PRODUCT_BY_ID.starter;
    const sEnd = starterUntil(st, STARTER_DAYS);
    const showStarter = canBuy(s, starter) && !!sEnd;
    let starterLeft = '';
    if (sEnd) {
      const ms = sEnd.getTime() - Date.now();
      const d = Math.floor(ms / 86400000),
        h = Math.floor((ms % 86400000) / 3600000);
      starterLeft = d > 0 ? `zbývá ${d} d ${h} h` : `zbývá ${h} h`;
    }
    const month = monthPearlsToday(s);
    const cur = currencyFor(currentLang());
    const rate = formatPrice(Math.round(pearlRate(cur) * 100) / 100, cur);
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      ${month ? this.monthHtml() : ''}
      ${showStarter ? `<div class="starter box"><span class="dtag">${esc(starterLeft)}</span>${this.productHtml(starter, false)}</div>` : ''}
      <b class="qsect">${open ? 'Perly hlubin' : 'Brzy za skutečné peníze'}</b>
      <div class="ppacks">${PRODUCTS.filter((x) => x.kind === 'pearls').map((x) => this.productHtml(x, first)).join('')}</div>
      ${open && first ? '<div class="hint">🎁 První nákup perel ti dá dvakrát tolik perel.</div>' : ''}
      <div class="pspecial">${this.productHtml(PRODUCT_BY_ID.month, false)}</div>
      <div class="hint">${open ? `Perly se připíšou postavě, se kterou hraješ. Kupované perly: 1 💠 ≈ ${rate} (u větších balíčků méně). Platí <a href="${__APP_URL__}terms.html" target="_blank" rel="noopener">obchodní podmínky</a>.` : 'Nákup za skutečné peníze bude dostupný později – všechno z obchodu se dá získat i hraním.'}${storeKind() === 'test' ? ' <b style="color:#ff8a5a">Testovací režim: nic se neplatí.</b>' : ''}</div>
      <b class="qsect">Zdarma ve hře</b>
      <ul class="pways">
        <li><b>Plamen knotu</b> – za každý den hry 1 perla, každý sedmý den v řadě 3 (teď ${days === 1 ? '1 den' : days >= 2 && days <= 4 ? `${days} dny` : `${days} dní`} v řadě).</li>
        <li><b>Cesta nováčka</b> – prvních sedm dní hraní dárek každý den, celkem 40 perel.</li>
        <li><b>Denní úkoly</b> – za splnění všech tří 2 perly.</li>
        <li><b>Denní hlubina</b> – poprvé za den 3 perly, za hodnocení S 5.</li>
        <li><b>Cesta sezóny</b> – perly na stupních zdarma, na perlové cestě víc, než stojí.</li>
        <li><b>Úspěchy</b> – každý nový úspěch 1 perla.</li>
        <li><b>Strážci</b> – první vítězství nad každým strážcem 3 perly, nad strážcem příběhu 5.</li>
        <li><b>Šampioni</b> – občas nesou perlu (zkažení a nemesis častěji).</li>
        <li><b>Fontána přání</b> – v Loppu se v ní sem tam zaleskne i perla.</li>
      </ul>
      <div class="hint">Celkem nalezeno: ${n(st.earned ?? 0)} ${pearlWord(st.earned ?? 0)}.</div>
      <div class="pcode box"><b>🎟 Kód</b><span class="hint">Kódy rozdáváme na sociálních sítích a při akcích.</span><div class="row"><input type="text" maxlength="24" placeholder="Napiš kód" autocomplete="off" spellcheck="false"><button class="btn small violet" data-a="code">Uplatnit</button></div></div>
    </div>`;
    this.bindMonth(body, () => this.render(p, 'get'));
    this.bindPay(body);
    const inp = $('.pcode input', body) as HTMLInputElement;
    // typing must not reach the game's keyboard shortcuts
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ($('[data-a=code]', body) as HTMLButtonElement).click();
    });
    $('[data-a=code]', body).addEventListener('click', () => {
      const r = redeemCode(st, inp.value);
      if (typeof r === 'string') {
        sfx('ui');
        this.ui.toast(r, '#ff8080');
        return;
      }
      addPearls(this.save, r);
      sfx('coin');
      this.ui.toast(`🎟 Kód uplatněn: +${r} ${pearlWord(r)}`, '#d8ccff');
      saveGame(this.save);
      this.render(p, 'get');
    });
  }
}
