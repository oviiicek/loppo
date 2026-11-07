import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { pearlState, pearlWord, pearlGold, TRAIL_BY_ID } from '../data/pearls';
import {
  Reward,
  AURA_BY_ID,
  TITLE_BY_ID,
  grantLook,
  CANDLE_MAX,
  CANDLE_PRICE,
  WELCOME,
  welcomeReady,
  dayTasks,
  taskProgress,
  taskDone,
  swapTask,
  TASK_BY_ID,
  TASK_SPARKS,
  BONUS_SPARKS,
  BONUS_PEARLS,
  SWAP_PRICE,
  seasonNow,
  seasonOf,
  seasonStep,
  addSparks,
  freeReward,
  premiumReward,
  SEASON_STEPS,
  STEP_SPARKS,
  PREMIUM_PRICE,
  STEP_PRICE,
  delveToday,
  delveDay,
  delveOpen,
  delveFloor,
  DELVE_TRIES,
  DELVE_FLOOR,
  DELVE_PEARLS,
  DELVE_S_PEARLS,
  DELVE_SPARKS,
  DelveResult,
  mmss,
  flameAlive,
} from '../data/live';
import { dayKey } from '../data/pearls';
import { addPearls, addToInventory, addGem, addRune, saveGame } from '../systems/state';
import { generateItem, itemColor, itemIcon } from '../data/items';
import { randomGem, gemName, gemIcon } from '../data/gems';
import { randomRune, runeName, runeIcon } from '../data/runes';
import { MAT_INFO } from '../game/loot';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { tr } from '../i18n/i18n';
import { Net } from '../net/net';
import { monthPearlsToday } from '../systems/store';

type UIM = typeof UIType;

const n = (v: number) => v.toLocaleString('cs-CZ');

/** gold worth n heaps for the hero's deepest floor */
export function rewardGold(maxFloor: number, k: number) {
  return Math.round(pearlGold(maxFloor) * 0.4 * k / 100) * 100;
}

// What comes back every day: the flame of the wick, the newcomer's path, the daily depth and the tasks of the day
// (the "Dnes" tab of the pearls' panel), the season's path (the "Sezóna" tab), the result of the daily depth to
// share, and the gifts all of them give.
export class LivePanels {
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

  /** gifts waiting to be taken (the dot on the flame button) */
  waiting(): number {
    const s = this.save;
    const st = pearlState(s);
    let k = welcomeReady(st) ? 1 : 0;
    // the month of pearls bought: today's pearls
    if (monthPearlsToday(s)) k++;
    const t = dayTasks(s);
    k += t.list.filter((x) => !x.paid && taskDone(s, x)).length;
    if (!t.bonus && t.list.every((x) => x.paid)) k++;
    return k + this.seasonWaiting();
  }

  /** rewards of the season's path reached and not taken yet */
  seasonWaiting(): number {
    const se = seasonOf(this.save);
    let k = 0;
    for (let i = 1; i <= seasonStep(se); i++) k += (se.free.includes(i) ? 0 : 1) + (se.premium && !se.prem.includes(i) ? 1 : 0);
    return k;
  }

  /** today's daily depth is open and not tried yet */
  delveWaiting() {
    return delveOpen(this.save) && delveDay(this.save).tries === 0;
  }

  // ---------------------------------------------------------------- rewards
  /** the icon of a reward */
  rewardIcon(r: Reward): string {
    switch (r.k) {
      case 'pearls':
        return iconURL('ic_pearl', 32);
      case 'gold':
        return iconURL('ic_gold', 32);
      case 'pots':
        return iconURL(MAT_INFO.hpPotion.icon, 32);
      case 'mats':
        return iconURL(MAT_INFO.stone.icon, 32);
      case 'gem':
        return iconURL(gemIcon(`ruby${Math.min(5, 2 + r.n)}`), 32);
      case 'rune':
        return iconURL(runeIcon(`fire${Math.min(5, 2 + r.n)}`), 32);
      case 'item':
        return spellIcon('crown', r.n >= 4 ? '#ff9f1c' : '#bc6ff1', 32);
      case 'wisdom':
        return spellIcon('eye', '#9fe6ff', 32);
      case 'luck':
        return spellIcon('star', '#52ff8f', 32);
      case 'phoenix':
        return spellIcon('fire', '#ff8a4a', 32);
      case 'candle':
        return spellIcon('fire', '#ffc46a', 32);
      case 'trail': {
        const t = TRAIL_BY_ID[r.id];
        return spellIcon(t?.glyph ?? 'star', t?.css ?? '#fff', 32);
      }
      case 'aura': {
        const a = AURA_BY_ID[r.id];
        return spellIcon(a?.glyph ?? 'sun', a?.css ?? '#fff', 32);
      }
      case 'title':
        return spellIcon('crown', TITLE_BY_ID[r.id]?.css ?? '#ffd76a', 32);
    }
  }

  /** what a reward is, in a few words */
  rewardText(r: Reward): string {
    const s = this.save;
    switch (r.k) {
      case 'pearls':
        return `${r.n} ${pearlWord(r.n)}`;
      case 'gold':
        return `${n(rewardGold(s.maxFloor, r.n))} zlata`;
      case 'pots':
        return r.n >= 5 ? `${r.n} lektvarů` : `${r.n} lektvary`;
      case 'mats':
        return 'Kameny a prach';
      case 'gem':
        return r.n ? 'Drahokam vyššího stupně' : 'Drahokam';
      case 'rune':
        return r.n ? 'Runa vyššího stupně' : 'Runa';
      case 'item':
        return r.n >= 4 ? 'Legendární předmět' : 'Epický předmět';
      case 'wisdom':
        return 'Kniha moudrosti';
      case 'luck':
        return 'Měšec štěstí';
      case 'phoenix':
        return 'Pírko fénixe';
      case 'candle':
        return 'Strážná svíce';
      case 'trail':
        return `Stopa: ${TRAIL_BY_ID[r.id]?.name ?? r.id}`;
      case 'aura':
        return `Aura: ${AURA_BY_ID[r.id]?.name ?? r.id}`;
      case 'title':
        return `Titul: ${TITLE_BY_ID[r.id]?.name ?? r.id}`;
    }
  }

  rewardHtml(r: Reward) {
    return `<span class="rwd"><img src="${this.rewardIcon(r)}">${esc(this.rewardText(r))}</span>`;
  }

  /** a reward goes to the hero; false when it cannot (a full bag) */
  grant(r: Reward): boolean {
    const s = this.save;
    const st = pearlState(s);
    const sc = this.sc;
    const floor = Math.max(1, s.maxFloor);
    switch (r.k) {
      case 'pearls':
        addPearls(s, r.n);
        break;
      case 'gold':
        s.gold += rewardGold(s.maxFloor, r.n);
        break;
      case 'pots':
        s.mats.hpPotion += r.n;
        s.mats.mpPotion += Math.ceil(r.n / 2);
        break;
      case 'mats':
        s.mats.stone += 3 + Math.floor(floor / 10);
        s.mats.dust += 6 + Math.floor(floor / 5);
        break;
      case 'gem': {
        const g = randomGem(floor, 1 + r.n);
        addGem(s, g);
        this.ui.toast(`💎 ${gemName(g)}`, '#9fe6ff');
        break;
      }
      case 'rune': {
        const k = randomRune(floor, 1 + r.n);
        addRune(s, k);
        this.ui.toast(`✦ ${runeName(k)}`, '#ffd76a');
        break;
      }
      case 'item': {
        const it = generateItem(floor + 2, { rarity: r.n });
        if (!addToInventory(s, it)) {
          this.ui.toast('Batoh je plný – udělej místo a vezmi si odměnu znovu', '#ff8080');
          return false;
        }
        this.ui.loot(it.name, itemColor(it), iconURL(itemIcon(it), 32));
        sc.player.recalc();
        break;
      }
      case 'wisdom':
        st.wisdom = Math.max(st.wisdom ?? 0, Math.max(sc.floor, 1) - 1) + 10;
        break;
      case 'luck':
        st.luck = Math.max(st.luck ?? 0, Math.max(sc.floor, 1) - 1) + 10;
        break;
      case 'phoenix':
        st.phoenix = (st.phoenix ?? 0) + 1;
        break;
      case 'candle':
        // (a candle over the limit becomes pearls)
        if ((st.candles ?? 0) < CANDLE_MAX) st.candles = (st.candles ?? 0) + 1;
        else addPearls(s, CANDLE_PRICE);
        break;
      case 'trail':
        grantLook(st, 'trail', r.id);
        break;
      case 'aura':
        grantLook(st, 'aura', r.id);
        break;
      case 'title':
        grantLook(st, 'title', r.id);
        break;
    }
    return true;
  }

  /** gifts given together: the toast names them; false when one could not be given */
  grantAll(list: Reward[], why: string): boolean {
    // the item first: a full bag stops the whole gift before anything is given
    const items = list.filter((r) => r.k === 'item');
    const rest = list.filter((r) => r.k !== 'item');
    for (const r of items) if (!this.grant(r)) return false;
    for (const r of rest) this.grant(r);
    sfx('coin');
    // the same thing twice is said once with its count ("2× Strážná svíce")
    const counts = new Map<string, number>();
    for (const r of list) {
      const t = this.rewardText(r);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    this.ui.toast(`🎁 ${why}: ${[...counts].map(([t, n]) => (n > 1 ? `${n}× ${t}` : t)).join(', ')}`, '#ffd76a');
    saveGame(this.save);
    bus.emit('stats');
    this.ui.liveBadge();
    return true;
  }

  // ---------------------------------------------------------------- the "today" tab
  today(body: HTMLElement, again: () => void) {
    const s = this.save;
    const st = pearlState(s);
    const streak = flameAlive(st) ? st.streak ?? 0 : 0;
    const candles = st.candles ?? 0;
    const w = st.welcome ?? 0;
    const wReady = welcomeReady(st);
    const t = dayTasks(s);
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const left = Math.max(0, mid.getTime() - now.getTime());
    const h = Math.floor(left / 3600000),
      m = Math.floor((left % 3600000) / 60000);
    const allPaid = t.list.every((x) => x.paid);
    const welcome =
      w < WELCOME.length
        ? `<div class="lvsec box welcome">
            <div class="lvhead"><b>🌅 Cesta nováčka</b><span class="hint">${w}/${WELCOME.length} · každý den hraní jeden dar, sedmý den aura a titul jen pro nováčky</span></div>
            <div class="wdays">${WELCOME.map((g, i) => `<div class="wday ${i < w ? 'got' : i === w ? (wReady ? 'ready' : 'next') : ''}"><span class="wn">${i + 1}. den</span><div class="wg">${g.map((r) => `<img src="${this.rewardIcon(r)}" title="${esc(this.rewardText(r))}">`).join('')}</div>${i < w ? '<span class="wok">✔</span>' : ''}</div>`).join('')}</div>
            <div class="row wrow"><span class="hint">${wReady ? `Dnes: ${WELCOME[w].map((r) => esc(this.rewardText(r))).join(', ')}` : 'Další dar zítra – stačí hru zapnout.'}</span>${wReady ? '<button class="btn gold" data-a="welcome">Vyzvednout</button>' : ''}</div>
          </div>`
        : '';
    body.innerHTML = `<div class="col live" style="flex:1;min-width:0">
      <div class="lvsec box flame">
        <img class="flameimg" src="${spellIcon('fire', streak ? '#ffb347' : '#6a5a4a', 56)}">
        <div class="lvinfo"><b class="fbig">${streak ? (streak === 1 ? 'Plamen knotu: 1 den' : streak <= 4 ? `Plamen knotu: ${streak} dny v řadě` : `Plamen knotu: ${streak} dní v řadě`) : 'Plamen knotu zhasl'}</b>
          <span class="hint">Hraj každý den a plamen nezhasne: každý den perla, každý sedmý den tři. Na 30. den titul, na 100. den aura.</span>
          <span class="candles">${Array.from({ length: CANDLE_MAX }, (_, i) => `<i class="${i < candles ? 'on' : ''}">🕯</i>`).join('')} <span class="hint">Strážné svíce ${candles}/${CANDLE_MAX} – když den vynecháš, svíce dohoří místo plamene.</span></span>
        </div>
        <button class="btn small violet" data-a="candle" ${candles >= CANDLE_MAX || (s.pearls ?? 0) < CANDLE_PRICE ? 'disabled' : ''}>🕯 ${CANDLE_PRICE} 💠</button>
      </div>
      ${welcome}
      ${this.delveCardHtml()}
      <div class="lvsec box tasks">
        <div class="lvhead"><b>📋 Denní úkoly</b><span class="hint">Nové za ${h} h ${m} min · za každý ${TASK_SPARKS} jisker pro cestu sezóny</span></div>
        ${t.list
          .map((k, i) => {
            const d = TASK_BY_ID[k.id];
            const p = taskProgress(s, k);
            const done = p >= k.n;
            const btn = k.paid
              ? '<span class="tdone">✔</span>'
              : done
                ? `<button class="btn small gold" data-task="${i}">+${TASK_SPARKS} ✦</button>`
                : `<button class="btn small" data-swap="${i}" title="${t.swapped ? `Vyměnit úkol za ${SWAP_PRICE} perly` : 'Vyměnit úkol – jednou denně zdarma'}">⟳ ${t.swapped ? `${SWAP_PRICE} 💠` : 'Vyměnit'}</button>`;
            return `<div class="task ${k.paid ? 'paid' : done ? 'done' : ''}"><span class="ti">${d.icon}</span><div class="tinfo"><span>${esc(d.text(k.n))}</span><div class="tbar"><i style="width:${Math.round((p / k.n) * 100)}%"></i><em>${n(p)}/${n(k.n)}</em></div></div>${btn}</div>`;
          })
          .join('')}
        <div class="task bonus ${t.bonus ? 'paid' : ''}"><span class="ti">🎁</span><div class="tinfo"><span>Všechny tři úkoly: ${BONUS_PEARLS} perly a ${BONUS_SPARKS} jisker</span></div>${t.bonus ? '<span class="tdone">✔</span>' : `<button class="btn small gold" data-a="bonus" ${allPaid ? '' : 'disabled'}>Vyzvednout</button>`}</div>
      </div>
    </div>`;
    body.querySelector('[data-a=welcome]')?.addEventListener('click', () => {
      if (!welcomeReady(st)) return;
      const g = WELCOME[st.welcome ?? 0];
      const day = (st.welcome ?? 0) + 1;
      if (!this.grantAll(g, `Cesta nováčka – ${day}. den`)) return;
      st.welcome = day;
      st.wday = dayKey(new Date());
      saveGame(s);
      if (day === WELCOME.length) this.ui.banner('Cesta nováčka splněna!', 'Aura Plamen knotu a titul Mladý plamen najdeš ve Vzhledu');
      again();
    });
    body.querySelector('[data-a=candle]')?.addEventListener('click', () => {
      if ((st.candles ?? 0) >= CANDLE_MAX || (s.pearls ?? 0) < CANDLE_PRICE) return;
      addPearls(s, -CANDLE_PRICE);
      st.candles = (st.candles ?? 0) + 1;
      sfx('coin');
      this.ui.toast('🕯 Strážná svíce – plamen knotu přečká vynechaný den', '#ffc46a');
      saveGame(s);
      again();
    });
    body.querySelectorAll<HTMLElement>('[data-task]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = t.list[+b.dataset.task!];
        if (!k || k.paid || !taskDone(s, k)) return;
        k.paid = true;
        k.told = true;
        const up = addSparks(s, TASK_SPARKS);
        sfx('coin');
        this.ui.toast(`✦ +${TASK_SPARKS} jisker${up ? ` · cesta sezóny: ${seasonStep(seasonOf(s))}. stupeň` : ''}`, '#ffd76a');
        saveGame(s);
        this.ui.liveBadge();
        again();
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-swap]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = +b.dataset.swap!;
        const pay = !!t.swapped;
        if (pay && (s.pearls ?? 0) < SWAP_PRICE) return this.ui.toast(`Výměna stojí ${SWAP_PRICE} perly`, '#ff8080');
        if (!swapTask(s, i)) return;
        if (pay) addPearls(s, -SWAP_PRICE);
        t.swapped = true;
        sfx('ui');
        saveGame(s);
        again();
      }),
    );
    body.querySelector('[data-a=bonus]')?.addEventListener('click', () => {
      if (t.bonus || !t.list.every((x) => x.paid)) return;
      t.bonus = true;
      addSparks(s, BONUS_SPARKS);
      this.grantAll([{ k: 'pearls', n: BONUS_PEARLS }], 'Všechny denní úkoly');
      again();
    });
    this.bindDelve(body);
  }

  // ---------------------------------------------------------------- the daily depth
  /** the card of today's daily depth: its fate, the tries left, the best result and the way in */
  delveCardHtml(): string {
    const s = this.save;
    const d = delveToday();
    const day = delveDay(s);
    if (!delveOpen(s))
      return `<div class="lvsec box delve locked"><div class="lvhead"><b>🌀 Denní hlubina #${d.n}</b><span class="hint">Otevře se, až dojdeš do ${DELVE_FLOOR}. patra.</span></div></div>`;
    const best = day.best;
    const left = DELVE_TRIES - day.tries;
    return `<div class="lvsec box delve">
      <div class="lvhead"><b>🌀 Denní hlubina #${d.n}</b><span class="hint">Dnes pro všechny hráče stejná · ${day.tries}/${DELVE_TRIES} pokusů</span></div>
      <div class="dfate"><b>${esc(d.fate.name)}</b> – ${esc(d.fate.desc)}</div>
      <div class="hint">Trhlina ${delveFloor(s)}. patra: poraz nestvůry, přivolej strážce a zab ho co nejrychleji. Smrt tady nic nestojí. Poprvé za den ${DELVE_PEARLS} perly a ${DELVE_SPARKS} jisker, za hodnocení S o ${DELVE_S_PEARLS} perly víc.</div>
      ${best ? `<div class="dres">${this.resultLine(best)}</div>` : ''}
      <div class="row drow">${left > 0 ? `<button class="btn violet" data-a="delve">${day.tries ? 'Zkusit znovu' : 'Vstoupit'}</button>` : '<span class="hint">Dnešní pokusy jsou vyčerpané – nová hlubina zítra.</span>'}${best ? '<button class="btn blue" data-a="share">📤 Sdílet výsledek</button>' : ''}</div>
    </div>`;
  }

  /** the grade, the squares and the time of a result */
  resultLine(r: DelveResult) {
    return `<span class="grade g${r.grade === '–' ? 'x' : r.grade}">${r.grade}</span><span class="dgrid">${r.grid}</span><span class="dtime">${r.dead ? 'nedokončeno' : mmss(r.t)}</span>`;
  }

  bindDelve(root: HTMLElement) {
    root.querySelector('[data-a=delve]')?.addEventListener('click', () => {
      sfx('ui');
      this.enterDelve();
    });
    root.querySelector('[data-a=share]')?.addEventListener('click', (e) => {
      const best = delveDay(this.save).best;
      if (best) this.share(best, e.currentTarget as HTMLElement);
    });
  }

  /** into the daily depth (asked first; not playing together, not in the middle of a fight) */
  enterDelve() {
    const sc = this.sc;
    const s = this.save;
    const day = delveDay(s);
    if (!delveOpen(s) || day.tries >= DELVE_TRIES) return;
    if (Net.open) return this.ui.toast('Denní hlubinu hraje každý sám – nejdřív opusť společnou hru', '#ff8080');
    if (sc.daily) return this.ui.toast('Už jsi v denní hlubině', '#ff8080');
    const why = sc.inVillage ? null : sc.canGoHome();
    if (why) return this.ui.toast(why, '#ff8080');
    const d = delveToday();
    const text = `${d.fate.name}: ${d.fate.desc} ${sc.inVillage ? '' : 'Patro, na kterém jsi, po návratu začne znovu od schodů. '}${s.hardcore ? 'Hardcore: smrt je i tady konečná.' : 'Smrt tady nic nestojí – vrátíš se domů.'}`;
    this.ui.confirm(`Denní hlubina #${d.n}`, text, () => {
      this.ui.closeOverlay();
      sc.startDelve();
    }, 'Vstoupit', 'Zpět');
  }

  /** the text of a result for the others (in the player's language, with the game's address): the grade and the
   *  try as signs, so a friend reads it in any language */
  shareText(r: DelveResult) {
    const d = delveToday();
    const head = `${__APP_NAME__.toUpperCase()} · ${tr('Denní hlubina')} #${d.n}`;
    const sub = `${tr(d.fate.name)} · ${r.dead ? '💀' : `🏅 ${r.grade}`} · 🎯 ${r.tr}/${DELVE_TRIES}`;
    return `${head}\n${sub}\n${r.grid}${r.dead ? '' : ` ${mmss(r.t)}`}\n${__APP_URL__}`;
  }

  /** the result goes out: the phone's own sharing where there is one, otherwise copied */
  async share(r: DelveResult, btn?: HTMLElement) {
    const text = this.shareText(r);
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await nav.share({ text });
        return;
      } catch {
        /* cancelled or not allowed: copy it instead */
      }
    }
    this.copy(text, btn);
  }

  /** copied to the clipboard (or shown to copy by hand where the clipboard is closed) */
  async copy(text: string, btn?: HTMLElement) {
    try {
      await navigator.clipboard.writeText(text);
      sfx('ui');
      this.ui.toast('📋 Výsledek je zkopírovaný – vlož ho přátelům do zprávy', '#9dff9d');
      if (btn) btn.textContent = '✔ Zkopírováno';
    } catch {
      const p = el(`<div class="panel small"><div class="head"><h2>Výsledek</h2></div><div style="padding:12px"><textarea class="sharetext" readonly rows="5"></textarea><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" data-a="ok">Hotovo</button></div></div></div>`);
      const ta = $('textarea', p) as HTMLTextAreaElement;
      ta.value = text;
      const close = this.ui.dialog(p);
      ta.focus();
      ta.select();
      $('[data-a=ok]', p).addEventListener('click', close);
    }
  }

  /** the daily depth cleared: the grade, the squares, the reward and the result to share */
  delveResult(r: DelveResult, pearls: number, sparks: number) {
    const d = delveToday();
    const day = delveDay(this.save);
    const best = day.best === r;
    const p = el(`<div class="panel small delveres">
      <div class="head"><h2>Denní hlubina #${d.n}</h2></div>
      <div class="dbody">
        <div class="stamp g${r.grade}">${r.grade}</div>
        <div class="dgrid big">${r.grid}</div>
        <div class="dline">Čas <b>${mmss(r.t)}</b> · ${n(r.kills)} nestvůr · ${r.tr}. pokus ze ${DELVE_TRIES}${best && r.tr > 1 ? ' · <b class="nb">nejlepší dnes!</b>' : ''}</div>
        ${pearls || sparks ? `<div class="dline rew">${pearls ? `+${pearls} ${pearlWord(pearls)}` : ''}${pearls && sparks ? ' · ' : ''}${sparks ? `+${sparks} jisker` : ''}</div>` : ''}
        <div class="hint">Pošli výsledek přátelům: dnes mají stejnou hlubinu – zvládnou ji rychleji?</div>
        <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn blue" data-a="share">📤 Sdílet</button><button class="btn" data-a="copy">📋 Kopírovat</button><button class="btn green" data-a="ok">Pokračovat</button></div>
      </div></div>`);
    const close = this.ui.dialog(p);
    $('[data-a=share]', p).addEventListener('click', (e) => this.share(r, e.currentTarget as HTMLElement));
    $('[data-a=copy]', p).addEventListener('click', (e) => this.copy(this.shareText(r), e.currentTarget as HTMLElement));
    $('[data-a=ok]', p).addEventListener('click', () => {
      sfx('ui');
      close();
    });
  }

  /** the part of the death screen for a fall in the daily depth */
  delveDeathHtml(): string {
    const day = delveDay(this.save);
    const r = day.last;
    if (!r) return '';
    const left = DELVE_TRIES - day.tries;
    return `<div class="dres death">${this.resultLine(r)}</div><div class="hint">${left > 1 ? `Zbývají ${left} pokusy – u brány v Loppu nebo v perlách (Dnes).` : left === 1 ? 'Zbývá poslední pokus – u brány v Loppu nebo v perlách (Dnes).' : 'Dnešní pokusy jsou vyčerpané.'}</div>`;
  }

  // ---------------------------------------------------------------- the season's path
  season(body: HTMLElement, again: () => void) {
    const s = this.save;
    const now = seasonNow();
    const se = seasonOf(s);
    const step = seasonStep(se);
    const inStep = step >= SEASON_STEPS ? STEP_SPARKS : se.sparks - step * STEP_SPARKS;
    const pearls = s.pearls ?? 0;
    const th = now.theme;
    const rows: string[] = [];
    for (let i = 1; i <= SEASON_STEPS; i++) {
      const fr = freeReward(i);
      const pr = premiumReward(i, se.n);
      const reached = i <= step;
      const fGot = se.free.includes(i);
      const pGot = se.prem.includes(i);
      const fBtn = fGot ? '<span class="tdone">✔</span>' : reached ? `<button class="btn small gold" data-free="${i}">Vzít</button>` : '';
      const pBtn = pGot ? '<span class="tdone">✔</span>' : reached && se.premium ? `<button class="btn small violet" data-prem="${i}">Vzít</button>` : !se.premium ? '<span class="lock">🔒</span>' : '';
      rows.push(`<div class="sstep ${reached ? 'reached' : ''} ${i === step + 1 ? 'next' : ''}"><span class="sn">${i}</span>
        <div class="sfree">${this.rewardHtml(fr)}${fBtn}</div>
        <div class="sprem ${se.premium ? '' : 'locked'}">${pr.map((r) => this.rewardHtml(r)).join('')}${pBtn}</div></div>`);
    }
    const premTotal = Array.from({ length: SEASON_STEPS }, (_, i) => premiumReward(i + 1, se.n)).flat().reduce((a, r) => a + (r.k === 'pearls' ? r.n : 0), 0);
    body.innerHTML = `<div class="col live season" style="flex:1;min-width:0;--sc:${th.css}">
      <div class="lvsec box shead">
        <div class="lvhead"><b>✦ Sezóna ${se.n}: ${esc(th.name)}</b><span class="hint">${now.left === 1 ? 'Poslední den sezóny!' : now.left <= 4 ? `Sezóna končí za ${now.left} dny` : `Sezóna končí za ${now.left} dní`}</span></div>
        <div class="sprog"><b>${step}/${SEASON_STEPS}</b><div class="tbar big"><i style="width:${Math.round((inStep / STEP_SPARKS) * 100)}%"></i><em>${step >= SEASON_STEPS ? 'hotovo' : `${n(inStep)}/${n(STEP_SPARKS)} jisker`}</em></div>
          ${step < SEASON_STEPS ? `<button class="btn small violet" data-a="step" ${pearls < STEP_PRICE ? 'disabled' : ''} title="Další stupeň hned">+1 stupeň · ${STEP_PRICE} 💠</button>` : ''}</div>
        <div class="hint">Jiskry dávají denní úkoly (${TASK_SPARKS} za každý), denní hlubina (${DELVE_SPARKS}) a boj: nestvůry a strážci. Odměny zůstanou do konce sezóny, pak začne nová cesta.</div>
      </div>
      ${
        se.premium
          ? `<div class="lvsec box premium on"><b>💠 Perlová cesta je odemčená</b><span class="hint">Ke každému stupni máš i perlovou odměnu.</span></div>`
          : `<div class="lvsec box premium"><div class="pinfo"><b>💠 Perlová cesta</b><span class="hint">Odměna navíc na každém stupni: sezónní stopa ${esc(TRAIL_BY_ID[th.trail]?.name ?? '')} (10.), aura ${esc(AURA_BY_ID[th.aura]?.name ?? '')} (20.) a titul ${esc(TITLE_BY_ID[th.title]?.name ?? '')} (30.), legendární předměty, pírka fénixe – a ${premTotal} perel zpátky. Platí i pro stupně, které už máš.</span></div>
             <button class="btn violet" data-a="premium" ${pearls < PREMIUM_PRICE ? 'disabled' : ''}>Odemknout · ${PREMIUM_PRICE} 💠</button></div>`
      }
      <div class="sgrid"><div class="shd"><span></span><b>Zdarma</b><b>Perlová cesta</b></div>${rows.join('')}</div>
    </div>`;
    const keepScroll = () => {
      const sc = body.closest('.body') ?? body;
      const y = sc.scrollTop;
      again();
      requestAnimationFrame(() => (sc.scrollTop = y));
    };
    body.querySelectorAll<HTMLElement>('[data-free]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = +b.dataset.free!;
        if (se.free.includes(i) || i > seasonStep(se)) return;
        if (!this.grantAll([freeReward(i)], `Cesta sezóny – ${i}. stupeň`)) return;
        se.free.push(i);
        saveGame(s);
        keepScroll();
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-prem]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = +b.dataset.prem!;
        if (!se.premium || se.prem.includes(i) || i > seasonStep(se)) return;
        if (!this.grantAll(premiumReward(i, se.n), `Perlová cesta – ${i}. stupeň`)) return;
        se.prem.push(i);
        saveGame(s);
        keepScroll();
      }),
    );
    body.querySelector('[data-a=premium]')?.addEventListener('click', () => {
      if (se.premium || (s.pearls ?? 0) < PREMIUM_PRICE) return;
      this.ui.confirm('Perlová cesta', `Odemknout perlovou cestu sezóny ${se.n} za ${PREMIUM_PRICE} perel? Odměny za stupně, které už máš, si můžeš vzít hned.`, () => {
        addPearls(s, -PREMIUM_PRICE);
        se.premium = true;
        sfx('levelup');
        this.ui.banner('Perlová cesta odemčena!', th.name);
        saveGame(s);
        this.ui.liveBadge();
        again();
      }, 'Odemknout', 'Zpět');
    });
    body.querySelector('[data-a=step]')?.addEventListener('click', () => {
      if ((s.pearls ?? 0) < STEP_PRICE || seasonStep(se) >= SEASON_STEPS) return;
      addPearls(s, -STEP_PRICE);
      se.sparks = (seasonStep(se) + 1) * STEP_SPARKS;
      sfx('coin');
      saveGame(s);
      this.ui.liveBadge();
      keepScroll();
    });
  }
}
