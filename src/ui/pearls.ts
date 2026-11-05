import { $, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { TRAILS, TRAIL_BY_ID, PEARL_OFFERS, PEARL_PACKS, SPECIAL_PACKS, PearlOffer, pearlState, pearlGold, pearlWord } from '../data/pearls';
import { AURAS, AURA_BY_ID, TITLES, TITLE_BY_ID, CANDLE_MAX, redeemCode, seasonNow } from '../data/live';
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

  open(tab = 'today') {
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
        p.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        // (another tab starts at its top)
        $('.body', p).scrollTop = 0;
        this.render(p, active);
      }),
    );
    this.ui.showOverlay(p, () => {});
    this.render(p, active);
  }

  private render(p: HTMLElement, tab: string) {
    this.ui.panels.headMats(p);
    this.tabDots(p);
    const body = $('.body', p);
    body.classList.add('scroll');
    const again = () => this.render(p, tab);
    if (tab === 'today') this.live.today(body, again);
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
      <div class="pshop">${PEARL_OFFERS.map((o) => {
        const own = this.owned(o);
        const full = o.max !== undefined && own.have >= o.max;
        return `<div class="poffer box" style="--pc:${o.css}"><img src="${spellIcon(o.glyph, o.css, 44)}"><div class="pinfo"><b>${esc(o.name)}</b><span class="hint">${esc(o.desc)}</span>${own.text ? `<span class="pown">${esc(own.text)}</span>` : ''}</div><button class="btn small ${full ? '' : 'violet'}" data-buy="${o.id}" ${full || pearls < o.price ? 'disabled' : ''}>${full ? 'Plné' : `${o.price} 💠`}</button></div>`;
      }).join('')}</div>
      <div class="hint" style="margin-top:8px">Perlovou cestu sezóny najdeš v záložce Sezóna, stopy, aury a tituly ve Vzhledu.</div>
    </div>`;
    body.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = PEARL_OFFERS.find((x) => x.id === b.dataset.buy);
        if (!o || (s.pearls ?? 0) < o.price) return;
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
            ? `<button class="btn small violet" data-get="${kind}:${id}" ${pearls < price ? 'disabled' : ''}>${price} 💠</button>`
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
        if (!pr || (s.pearls ?? 0) < pr || have.includes(id)) return;
        addPearls(s, -pr);
        have.push(id);
        wear(k, id);
        sfx('coin');
        this.ui.toast(`✨ ${k === 'trail' ? 'Nová stopa' : k === 'aura' ? 'Nová aura' : 'Nový titul'}: ${name(k, id)}`, '#d8ccff');
        saveGame(s);
        this.render(p, 'looks');
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

  private get(p: HTMLElement, body: HTMLElement) {
    const st = pearlState(this.save);
    const days = st.streak ?? 0;
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint" style="font-size:17px">Kde se berou perly hlubin:</div>
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
      <b class="qsect">Brzy za skutečné peníze</b>
      <div class="pspecial">${SPECIAL_PACKS.map((k) => `<div class="poffer box" style="--pc:${k.css}"><img src="${spellIcon(k.glyph, k.css, 44)}"><div class="pinfo"><b>${esc(k.name)}</b><span class="hint">${esc(k.desc)}</span></div><button class="btn small" disabled>${k.price}</button></div>`).join('')}</div>
      <div class="ppacks">${PEARL_PACKS.map((k) => `<div class="ppack box">${k.tag ? `<span class="ptag">${esc(k.tag)}</span>` : ''}<img src="${iconURL('ic_pearl', 40)}"><b>${n(k.pearls)}${k.bonus ? ` <span class="pbonus">+${k.bonus}</span>` : ''}</b><span>${k.price}</span><button class="btn small" disabled>Brzy</button></div>`).join('')}</div>
      <div class="hint" style="margin-top:6px">První nákup perel bude za dvojnásobek. Nákup za skutečné peníze bude dostupný později – všechno z obchodu se dá získat i hraním.</div>
    </div>`;
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
