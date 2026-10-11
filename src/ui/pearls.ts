import { $, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { TRAILS, TRAIL_BY_ID, PEARL_OFFERS, PEARL_PACKS, PearlOffer, pearlState, pearlGold, pearlWord } from '../data/pearls';
import { addPearls, addToInventory, addGem, addRune, saveGame, bagSize } from '../systems/state';
import { generateItem, itemColor, itemIcon } from '../data/items';
import { randomGem, gemName } from '../data/gems';
import { randomRune, runeName } from '../data/runes';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';

type UIM = typeof UIType;

const n = (v: number) => v.toLocaleString('cs-CZ');

// The pearls of the depths: what they buy (comfort, help for a while, gold), the trails behind the hero, and
// where they come from – with the packs that will be sold for real money once payments are ready.
export class PearlPanels {
  ui: UIM;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  get sc() {
    return this.ui.scene!;
  }
  get save() {
    return this.sc.save;
  }

  open(tab = 'shop') {
    const tabs = [
      { id: 'shop', label: 'Obchod' },
      { id: 'trails', label: 'Stopy' },
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
        this.render(p, active);
      }),
    );
    this.ui.showOverlay(p, () => {});
    this.render(p, active);
  }

  private render(p: HTMLElement, tab: string) {
    this.ui.panels.headMats(p);
    const body = $('.body', p);
    if (tab === 'trails') this.trails(p, body);
    else if (tab === 'get') this.get(body);
    else this.shop(p, body);
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

  private trails(p: HTMLElement, body: HTMLElement) {
    const s = this.save;
    const st = pearlState(s);
    const have = st.trails ?? [];
    const pearls = s.pearls ?? 0;
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint">Stopa se táhne za hrdinou, kudy chodí – a ve společné hře ji vidí i ostatní. Koupená stopa zůstává navždy, nosit jde jedna.</div>
      <div class="pshop">${TRAILS.map((t) => {
        const own = have.includes(t.id);
        const on = st.trail === t.id;
        const btn = on ? `<button class="btn small" data-off="1">Sundat</button>` : own ? `<button class="btn small green" data-wear="${t.id}">Nosit</button>` : `<button class="btn small violet" data-trail="${t.id}" ${pearls < t.price ? 'disabled' : ''}>${t.price} 💠</button>`;
        return `<div class="poffer box ${on ? 'on' : ''}" style="--pc:${t.css}"><img src="${spellIcon(t.glyph, t.css, 44)}"><div class="pinfo"><b>${esc(t.name)}</b><span class="hint">${esc(t.desc)}</span>${on ? '<span class="pown">nosíš</span>' : own ? '<span class="pown">koupeno</span>' : ''}</div>${btn}</div>`;
      }).join('')}</div>
    </div>`;
    body.querySelectorAll<HTMLElement>('[data-trail]').forEach((b) =>
      b.addEventListener('click', () => {
        const t = TRAIL_BY_ID[b.dataset.trail!];
        if (!t || (s.pearls ?? 0) < t.price || have.includes(t.id)) return;
        addPearls(s, -t.price);
        st.trails = [...have, t.id];
        st.trail = t.id;
        sfx('coin');
        this.ui.toast(`✨ Nová stopa: ${t.name}`, t.css);
        saveGame(s);
        this.render(p, 'trails');
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-wear]').forEach((b) =>
      b.addEventListener('click', () => {
        st.trail = b.dataset.wear!;
        sfx('ui');
        saveGame(s);
        this.render(p, 'trails');
      }),
    );
    body.querySelector('[data-off]')?.addEventListener('click', () => {
      st.trail = null;
      sfx('ui');
      saveGame(s);
      this.render(p, 'trails');
    });
  }

  private get(body: HTMLElement) {
    const st = pearlState(this.save);
    body.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="hint" style="font-size:17px">Kde se berou perly hlubin:</div>
      <ul class="pways">
        <li><b>Denní dar</b> – za každý den hry 1 perla, každý sedmý den v řadě 3 (teď ${st.streak ?? 0} ${st.streak === 1 ? 'den' : (st.streak ?? 0) >= 2 && (st.streak ?? 0) <= 4 ? 'dny' : 'dní'} v řadě).</li>
        <li><b>Úspěchy</b> – každý nový úspěch 1 perla.</li>
        <li><b>Strážci</b> – první vítězství nad každým strážcem 3 perly, nad strážcem příběhu 5.</li>
        <li><b>Šampioni</b> – občas nesou perlu (zkažení a nemesis častěji).</li>
        <li><b>Fontána přání</b> – v Loppu se v ní sem tam zaleskne i perla.</li>
      </ul>
      <div class="hint">Celkem nalezeno: ${n(st.earned ?? 0)} ${pearlWord(st.earned ?? 0)}.</div>
      <div class="ppacks">${PEARL_PACKS.map((k) => `<div class="ppack box"><img src="${iconURL('ic_pearl', 40)}"><b>${n(k.pearls)}${k.bonus ? ` <span class="pbonus">+${k.bonus}</span>` : ''}</b><span>${k.price}</span><button class="btn small" disabled>Brzy</button></div>`).join('')}</div>
      <div class="hint" style="margin-top:6px">Nákup perel za skutečné peníze bude dostupný později. Všechno z obchodu se dá získat i hraním.</div>
    </div>`;
  }
}
