import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { Quest, questOffers, rewardText, QUEST_COUNTER } from '../data/quests';
import { villageOf, questSlots, questRewardMult } from '../data/village';
import { generateItem } from '../data/items';
import { addToInventory, saveGame, addRune, addSpellRune } from '../systems/state';
import { questCounter } from '../game/quests';
import { randomRune } from '../data/runes';
import { randomGem } from '../data/gems';
import { SPELL_RUNES } from '../data/spellrunes';
import { addGem } from '../systems/state';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { iconURL } from '../gfx/textures';
import { royalOf, makeRoyalQuest, RoyalQuest, HONORS, honorsOf, kingGreeting, rarityName } from '../data/royal';

type UIM = typeof UIType;

/** the notice board in Loppo and the quest log */
export class QuestPanels {
  ui: UIM;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  get sc() {
    return this.ui.scene!;
  }

  /** a quest's card: who asks, the story, the progress and the reward */
  card(q: Quest, actions: string, taken = true) {
    const pct = q.goal > 1 ? Math.round((q.have / q.goal) * 100) : q.done ? 100 : 0;
    return `<div class="qcard ${q.done ? 'done' : ''}"><div class="qtop"><b>${esc(q.title)}</b><span class="hint">${esc(q.giver)}</span></div>
      <div class="qtext">${esc(q.text)}</div>
      ${!taken ? '' : q.goal > 1 ? `<div class="qbar"><i style="width:${pct}%"></i><span>${q.have}/${q.goal}</span></div>` : q.done ? '<div class="qok">✔ Splněno</div>' : ''}
      <div class="qrew">Odměna: ${esc(rewardText(q.reward))}</div>${actions}</div>`;
  }

  /** the board: quests taken (with the reward to collect) and what the villagers ask for now */
  board(p: HTMLElement) {
    const s = this.sc.save;
    const v = villageOf(s);
    const active = (v.quests ??= []);
    const slots = questSlots(s);
    if (!v.offers?.length) v.offers = questOffers(active, s.floor, questRewardMult(s), !!s.nemeses?.length);
    const offers = v.offers;
    const body = $('.body', p);
    body.innerHTML = `<div class="col" style="flex:1;min-width:0"><b style="color:#9dff7a">Přijaté úkoly ${active.length}/${slots}</b><div class="scroll" style="flex:1">${
      active.length
        ? active
            .map((q, i) => this.card(q, `<div class="row qact">${q.done ? `<button class="btn small gold" data-claim="${i}">Vyzvednout odměnu</button>` : `<button class="btn small red" data-drop="${i}">Vzdát</button>`}</div>`))
            .join('')
        : '<div class="hint">Zatím žádný. Vyber si úkol z nabídky.</div>'
    }</div></div>
      <div class="col" style="flex:1;min-width:0"><b style="color:#ffd76a">Nabídka</b><div class="scroll" style="flex:1">${
        offers.length
          ? offers.map((q, i) => this.card(q, `<div class="row qact"><button class="btn small green" data-take="${i}" ${active.length >= slots ? 'disabled' : ''}>Přijmout</button></div>`, false)).join('')
          : '<div class="hint">Na nástěnce teď nic nevisí. Přijď po další výpravě.</div>'
      }</div>${active.length >= slots ? '<div class="hint">Víc úkolů najednou neuneseš – vylepši nástěnku nebo nějaký dokonči.</div>' : ''}</div>`;
    body.querySelectorAll<HTMLElement>('[data-take]').forEach((b) =>
      b.addEventListener('click', () => {
        if (active.length >= slots) return;
        const q = offers.splice(+b.dataset.take!, 1)[0];
        const key = QUEST_COUNTER[q.type];
        if (key) q.base = questCounter(s, key);
        active.push(q);
        sfx('ui');
        this.ui.toast(`Přijat úkol: ${q.title}`, '#9dff7a');
        saveGame(s);
        this.board(p);
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-drop]').forEach((b) =>
      b.addEventListener('click', () => {
        const q = active[+b.dataset.drop!];
        this.ui.confirm('Vzdát úkol?', `„${q.title}“ zmizí z tvého deníku.`, () => {
          active.splice(active.indexOf(q), 1);
          saveGame(s);
          this.board(p);
        }, 'Vzdát', 'Ponechat');
      }),
    );
    body.querySelectorAll<HTMLElement>('[data-claim]').forEach((b) =>
      b.addEventListener('click', () => {
        const q = active[+b.dataset.claim!];
        if (!q?.done) return;
        if (!s.inventory.some((x) => !x)) return void this.ui.toast('Uvolni v batohu místo pro odměnu', '#ff8a7a');
        active.splice(active.indexOf(q), 1);
        this.pay(q);
        this.board(p);
      }),
    );
  }

  /** the reward of a finished quest */
  pay(q: Quest) {
    const sc = this.sc;
    const s = sc.save;
    const r = q.reward;
    s.gold += r.gold;
    const it = generateItem(s.floor + 1, { rarity: r.rarity, filter: sc.loot.bias() });
    addToInventory(s, it);
    if (r.extra === 'stone') s.mats.stone += 3;
    else if (r.extra === 'dust') s.mats.dust += 3;
    else if (r.extra === 'gem') addGem(s, randomGem(s.floor, 1));
    else if (r.extra === 'rune') addRune(s, randomRune(s.floor, 1));
    else if (r.extra === 'srune') addSpellRune(s, SPELL_RUNES[Math.floor(Math.random() * SPELL_RUNES.length)].id);
    sfx('levelup');
    this.ui.toast(`Odměna za „${q.title}“: ${rewardText(r)} (${it.name})`, '#ffd76a', it);
    saveGame(s);
    bus.emit('stats');
  }

  /** King Dobromil: his task, the reward, the king's favour and its honours */
  royal() {
    const sc = this.sc;
    const s = sc.save;
    const r = royalOf(s);
    let offer: RoyalQuest | null = null;
    const d = el(`<div class="panel royal"><div class="head"><h2>Král Dobromil III.</h2><span class="hint">vládce Šedých hor</span><button class="close">✕</button></div><div class="body"></div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
    const render = () => {
      const q = r.quest as RoyalQuest | null | undefined;
      if (!q && !offer) offer = makeRoyalQuest(r.step, s.maxFloor);
      const shown = q ?? offer!;
      const speech = q ? (q.done ? 'Výborně! Slovo krále platí – tady je tvá odměna.' : kingGreeting(r.favor)) : shown.speech;
      let actions = '';
      if (!q) actions = `<button class="btn green" data-a="take">Přijmout úkol</button><button class="btn" data-a="later">Později</button>`;
      else if (q.done) actions = `<button class="btn gold" data-a="claim">Převzít odměnu</button>`;
      else if (q.type === 'deliver') actions = `<button class="btn gold" data-a="give">Odevzdat předmět</button><button class="btn red" data-a="drop">Vzdát</button>`;
      else if (q.type === 'tribute') actions = `<button class="btn gold" data-a="pay" ${s.gold >= (q.base ?? 0) ? '' : 'disabled'}>Darovat ${(q.base ?? 0).toLocaleString('cs-CZ')} zlata</button><button class="btn red" data-a="drop">Vzdát</button>`;
      else actions = `<button class="btn red" data-a="drop">Vzdát</button>`;
      const honors = HONORS.map((h) => {
        const got = r.favor >= h.at;
        return `<div class="rhonor ${got ? 'got' : ''}" style="--hc:${h.color}"><b>${got ? '✦' : '✧'} ${esc(h.name)}</b><span class="hint">${h.at} ${h.at === 1 ? 'bod' : h.at < 5 ? 'body' : 'bodů'} přízně · ${esc(h.perk)}</span></div>`;
      }).join('');
      $('.body', d).innerHTML = `<div class="col" style="flex:1;min-width:0">
          <div class="rtbody"><img src="${iconURL('npc_king', 64)}"><p class="rtline">„${esc(speech)}“</p></div>
          <div class="scroll" style="flex:1">${this.card(shown, `<div class="row qact">${actions}</div>`, !!q)}</div>
        </div>
        <div class="col rhonors" style="width:min(250px,38%)"><b style="color:#ffd76a">Přízeň krále: ${r.favor}</b>${honors}<div class="hint">Splněno královských úkolů: ${r.step}</div></div>`;
      const on = (a: string, f: () => void) => d.querySelector(`[data-a=${a}]`)?.addEventListener('click', f);
      on('take', () => {
        if (!offer) return;
        const key = QUEST_COUNTER[offer.type];
        if (key && key !== 'maxFloor') offer.base = questCounter(s, key);
        r.quest = offer;
        offer = null;
        sfx('ui');
        this.ui.toast(`Královský úkol: ${r.quest.title}`, '#ffd76a');
        saveGame(s);
        render();
      });
      on('later', () => close());
      on('drop', () =>
        this.ui.confirm('Vzdát královský úkol?', 'Král ti dá jiný, až se vrátíš. Přízeň neztratíš.', () => {
          r.quest = null;
          saveGame(s);
          render();
        }, 'Vzdát', 'Ponechat'),
      );
      on('pay', () => {
        const qq = r.quest;
        if (!qq || s.gold < (qq.base ?? 0)) return;
        s.gold -= qq.base ?? 0;
        sfx('coin');
        sc.quests.complete(qq);
        bus.emit('stats');
        render();
      });
      on('give', () => {
        const qq = r.quest as RoyalQuest;
        const min = qq.minRarity ?? 2;
        this.ui.panels.offerItem(
          'Dar pro krále',
          `Král chce ${rarityName(min)} nebo lepší předmět. Vyber ho z batohu.`,
          (i) => {
            const it = s.inventory[i];
            if (!it || it.rarity < min) return;
            s.inventory[i] = null;
            sfx('levelup');
            this.ui.toast(`Král přijal: ${it.name}`, '#ffd76a');
            sc.quests.complete(qq);
            render();
          },
          'Odevzdat králi',
          (it) => it.rarity >= min,
        );
      });
      on('claim', () => {
        const qq = r.quest as RoyalQuest | null;
        if (!qq?.done) return;
        if (!s.inventory.some((x) => !x)) return void this.ui.toast('Uvolni v batohu místo pro odměnu', '#ff8a7a');
        const before = honorsOf(r.favor).length;
        r.quest = null;
        r.step++;
        r.favor += qq.favor;
        this.pay(qq);
        const now = honorsOf(r.favor);
        for (const h of now.slice(before)) {
          this.ui.banner(`👑 ${h.name}`, h.perk);
          sfx('levelup');
        }
        // the crown of Loppo comes with the last honour
        if (r.favor >= 15 && !r.crown && s.inventory.some((x) => !x)) {
          r.crown = true;
          const crown = generateItem(s.maxFloor + 5, { rarity: 5, base: 'helmet', noCurse: true });
          crown.name = 'Koruna Loppa';
          addToInventory(s, crown);
          this.ui.toast('Král ti daroval Korunu Loppa!', '#ff6a8a', crown);
        }
        sc.player.recalc();
        bus.emit('stats');
        saveGame(s);
        render();
      });
    };
    render();
  }

  /** the quest log (from the pause menu, anywhere) */
  log() {
    const s = this.sc.save;
    const royal = villageOf(s).royal?.quest;
    const active = [...(royal ? [royal] : []), ...(villageOf(s).quests ?? [])];
    const d = el(`<div class="panel qlog"><div class="head"><h2>Úkoly</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">${
        active.length
          ? active.map((q) => this.card(q, '')).join('')
          : `<div class="hint">${villageOf(s).lv.board ? 'Nemáš žádný úkol. Úkoly visí na nástěnce v Loppu.' : 'Úkoly rozdává lovkyně Jitka u nástěnky v Loppu – nejdřív ji ale musíš najít v kobkách.'}</div>`
      }</div></div>`);
    const close = this.ui.dialog(d);
    $('.close', d).addEventListener('click', () => close());
  }
}
