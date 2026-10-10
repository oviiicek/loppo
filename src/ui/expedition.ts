import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, THEMES, themeForFloor } from '../gfx/textures';
import { BAND, bandOf, bandStart, bandEnd, bandOpen, bandDone, bandBest, bandLootBonus, recommendedLevel, bandName, runOf, startRun, isCampFloor, bandCamp, expectedLevel } from '../data/bands';
import { bossForFloor, storyBossForFloor, isBossFloor, STORY_END } from '../data/enemies';
import { saveGame } from '../systems/state';
import { BASE_BY_ID } from '../data/items';
import { codexOf } from '../data/codex';
import { bossWeaponBase, bossWeaponKey, bossWeaponName, BOSS_WEAPON_FIRST, BOSS_WEAPON_AGAIN } from '../data/bossweapons';
import { areaOf } from '../data/biomes';
import type { FloorKind } from '../systems/state';
import { sfx } from '../systems/audio';

type UIM = typeof UIType;

/** the doors after a floor */
const DOORS: Record<'normal' | 'danger' | 'merchant' | 'unknown', { name: string; desc: string; cls: string }> = {
  normal: { name: 'Běžná cesta', desc: 'Obyčejné patro s nestvůrami a kořistí.', cls: 'plain' },
  danger: { name: 'Nebezpečná cesta', desc: 'Silnější nestvůry a víc šampionů. Za to lepší kořist (+60 %), víc zlata a zkušeností.', cls: 'danger' },
  merchant: { name: 'K obchodníkovi', desc: 'Patro bez boje: obchodník, kovadlina, fontána a svatyně.', cls: 'merchant' },
  unknown: { name: 'Neznámá oblast', desc: 'Pokladnice, síň hádanek, místo setkání… nebo patro s nečekaným osudem.', cls: 'unknown' },
};

// The expedition: the bands of ten floors to start in (from the village's gate) and the doors after a floor.
export class ExpeditionPanels {
  ui: UIM;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  get sc() {
    return this.ui.scene!;
  }

  /** the guardians of a band: a story guardian halfway down (floors 25 and 125) and the one at its end */
  private guardianOf(b: number) {
    const f = bandEnd(b);
    const mid = storyBossForFloor(bandCamp(b));
    const story = storyBossForFloor(f);
    const end = story ? `${story.name} – ${story.title}` : bossForFloor(f).def.name;
    return mid ? `${mid.name} (${mid.floor}.) · ${end} (${f}.)` : end;
  }

  /** the guardians that fell already (all of them with the test link "#test-bosses"): fought again from the gate */
  private rematchList() {
    const s = this.sc.save;
    const testAll = typeof location !== 'undefined' && (/[?&]test=bosses/.test(location.search) || /test-bosses/.test(location.hash));
    const top = testAll ? Math.max(STORY_END, s.maxFloor - 1) : s.maxFloor - 1;
    const list: { floor: number; id: string; name: string; title: string; sprite: string; tint?: number; story: boolean; ancient: boolean }[] = [];
    for (let f = BAND; f <= top; f++) {
      if (!isBossFloor(f)) continue;
      const story = storyBossForFloor(f);
      if (story) list.push({ floor: f, id: story.id, name: story.name, title: story.title, sprite: story.phases[0].sprite, tint: story.phases[0].tint, story: true, ancient: false });
      else {
        const { def, tier } = bossForFloor(f);
        list.push({ floor: f, id: def.id, name: (tier > 0 ? 'Prastarý ' : '') + def.name, title: tier > 0 ? 'Prastarý strážce hlubin' : 'Strážce patra', sprite: def.sprite, tint: def.tint, story: false, ancient: tier > 0 });
      }
    }
    return { list, testAll };
  }

  /** the "Bossové" tab: every guardian that fell, its floor, the level it asks for and its weapon for the hero's class */
  private bossesHtml() {
    const sc = this.sc;
    const s = sc.save;
    const { list, testAll } = this.rematchList();
    const c = codexOf(s);
    const kills = s.bossKills ?? {};
    const rows = list
      .map((b) => {
        const rec = expectedLevel(b.floor);
        const lvCls = s.level >= rec ? 'ok' : s.level >= rec - 5 ? 'near' : 'far';
        const base = BASE_BY_ID[bossWeaponBase(b.id, s.cls)];
        const found = c.bw!.includes(bossWeaponKey(b.id, s.cls));
        const k = kills[b.id] ?? 0;
        const chance = Math.round((k ? BOSS_WEAPON_AGAIN : BOSS_WEAPON_FIRST) * 100);
        return `<div class="rm ${b.story ? 'story' : ''}" data-floor="${b.floor}">
          <img class="rmp" src="${sc.guardianPortrait(b.sprite, b.tint)}">
          <div class="rmi"><div class="rmn"><b>${esc(b.name)}</b> <span class="rmf">${b.floor}. patro</span></div>
            <div class="rmt">${esc(b.title)} · <span class="lv ${lvCls}">úr. ${rec}+</span>${k ? ` · výher: ${k}` : ''}</div>
            <div class="rmw ${found ? 'found' : ''}"><img src="${iconURL(`${base.icon}_t${b.story || b.ancient ? 5 : 4}`, 32)}"><span>${esc(bossWeaponName(b.id, s.cls))}</span><em>${found ? '✔ v kodexu' : `šance ${chance} %`}</em></div>
          </div>
          <button class="btn red" data-a="fight">⚔ Bojovat</button>
        </div>`;
      })
      .join('');
    return `<div class="hint" style="margin-bottom:6px">Strážci, kteří už padli, čekají ve svých arénách na další souboj. Kořist je menší, ale každý strážce má pro tvoji classu vlastní zbraň: poprvé ji nechá s šancí ${Math.round(BOSS_WEAPON_FIRST * 100)} %, pak pokaždé s šancí ${Math.round(BOSS_WEAPON_AGAIN * 100)} %. Prohra nic nestojí – vrátíš se domů.${s.hardcore ? ' <b style="color:#ff8a7a">Hardcore: smrt je i tady konečná.</b>' : ''}${testAll ? ' <b style="color:#9fe6ff">Zkušební odemčení: otevření jsou všichni strážci.</b>' : ''}</div>
      ${rows || '<div class="hint" style="padding:12px 0">Zatím žádný strážce nepadl. První čeká na konci 10. patra.</div>'}`;
  }

  /** the bands: the current expedition to continue, every band with its best floor, the level it asks for,
   *  its loot and its guardian; a new expedition starts at a band's first floor */
  expedition(tab: 'bands' | 'bosses' = 'bands') {
    const sc = this.sc;
    const s = sc.save;
    const run = runOf(s);
    const cur = s.floor;
    // every band of the story, and below it as far as the hero got (plus the next one, locked)
    const last = Math.max(STORY_END / BAND, bandOf(s.maxFloor) + 2);
    const cards: string[] = [];
    for (let b = 0; b < last; b++) {
      const open = bandOpen(b, s.maxFloor);
      if (!open && b > bandOf(s.maxFloor) + 1 && b >= STORY_END / BAND) break;
      const done = bandDone(b, s.maxFloor);
      const best = bandBest(b, s.maxFloor);
      const rec = recommendedLevel(b);
      const lvCls = s.level >= rec ? 'ok' : s.level >= rec - 5 ? 'near' : 'far';
      const th = THEMES[themeForFloor(bandStart(b))];
      const here = bandOf(cur) === b;
      cards.push(`<div class="band ${open ? '' : 'locked'} ${here ? 'here' : ''}" data-band="${b}" style="--bc:${th.glow[0]}">
        <div class="btop"><b>${bandStart(b)}–${bandEnd(b)}</b><span class="bname">${esc(bandName(b))}</span>${done ? '<span class="bdone">✔</span>' : ''}</div>
        <div class="bdesc">${esc(areaOf(bandStart(b)).desc)}</div>
        ${
          open
            ? `<div class="bstats"><span>Nejlépe: <b>${best || '—'}</b></span><span class="lv ${lvCls}">Doporučeno: úr. ${rec}+</span><span class="loot">Kořist +${bandLootBonus(bandStart(b))} %</span></div>
               <div class="bboss">${storyBossForFloor(bandCamp(b)) ? 'Strážci' : 'Strážce'}: ${esc(this.guardianOf(b))}</div>`
            : `<div class="block">🔒 Poraz strážce ${bandEnd(b - 1)}. patra</div>`
        }
      </div>`);
    }
    const back = run.checkpoint;
    const nBoss = this.rematchList().list.length;
    const p = el(`<div class="panel framed expedition"><div class="head"><h2>Výprava do kobek</h2><div class="tabs"><button class="tab ${tab === 'bands' ? 'on' : ''}" data-tab="bands">Desítky pater</button><button class="tab ${tab === 'bosses' ? 'on' : ''}" data-tab="bosses">Bossové${nBoss ? ` (${nBoss})` : ''}</button></div><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">
        <div class="xtab" data-tab="bosses" ${tab === 'bosses' ? '' : 'hidden'}>${this.bossesHtml()}</div>
        <div class="xtab" data-tab="bands" ${tab === 'bands' ? '' : 'hidden'}>
        <div class="runcard">
          <div><div class="rt">⚑ Aktuální výprava: <b>patro ${cur}</b> · ${esc(bandName(bandOf(cur)))}</div>
          <div class="hint">Checkpoint: patro ${back} (${isBossFloor(back) ? 'příprava na strážce' : isCampFloor(back) ? 'tábor' : 'začátek desítky'}) – sem tě vrátí smrt. Nejhlouběji: patro ${s.maxFloor}.</div></div>
          <button class="btn gold" data-a="cont">Pokračovat ▶</button>
        </div>
        <b class="qsect">Desítky pater</b>
        <div class="hint" style="margin-bottom:6px">Nová výprava začíná prvním patrem desítky. Strážce na jejím konci otevře další desítku. Hlouběji je lepší kořist – a silnější nestvůry.</div>
        <div class="bands">${cards.join('')}</div>
        </div>
      </div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.querySelectorAll<HTMLElement>('.head .tab').forEach((t) =>
      t.addEventListener('click', () => {
        sfx('ui');
        p.querySelectorAll<HTMLElement>('.head .tab').forEach((x) => x.classList.toggle('on', x === t));
        p.querySelectorAll<HTMLElement>('.xtab').forEach((x) => (x.hidden = x.dataset.tab !== t.dataset.tab));
      }),
    );
    p.querySelectorAll<HTMLElement>('.rm [data-a=fight]').forEach((b) =>
      b.addEventListener('click', () => {
        const f = +b.closest<HTMLElement>('.rm')!.dataset.floor!;
        sfx('ui');
        const st = storyBossForFloor(f);
        const name = st ? st.name : bossForFloor(f).def.name;
        this.ui.confirm(`Souboj: ${name}`, `Strážce ${f}. patra tě čeká ve své aréně. Výprava v kobkách zůstane, kde je.`, () => {
          this.ui.closeOverlay();
          sc.startRematch(f);
        }, 'Do arény', 'Zpět');
      }),
    );
    $('[data-a=cont]', p).addEventListener('click', () => {
      sfx('ui');
      this.ui.closeOverlay();
      sc.nextFloor(true);
    });
    p.querySelectorAll<HTMLElement>('.band:not(.locked)').forEach((c) =>
      c.addEventListener('click', () => {
        const b = +c.dataset.band!;
        sfx('ui');
        const begin = () => {
          startRun(s, b);
          saveGame(s);
          this.ui.closeOverlay();
          sc.floor = s.floor;
          sc.nextFloor(true);
        };
        // one expedition at a time: starting another ends the one under way
        if (cur !== bandStart(b)) this.ui.confirm('Nová výprava?', `Opravdu chceš ukončit aktuální výpravu v patře ${cur} a začít znovu od patra ${bandStart(b)}?`, begin, 'Začít novou', 'Ponechat');
        else begin();
      }),
    );
    // the band the hero is in stays in view
    if (tab === 'bands') p.querySelector('.band.here')?.scrollIntoView({ block: 'center' });
  }

  /** the doors after a floor: pick where the path leads */
  pathChoice(next: number, options: FloorKind[], pick: (k: FloorKind) => void) {
    const doors = options
      .map((k) => {
        const d = DOORS[k as keyof typeof DOORS] ?? DOORS.normal;
        return `<button class="door ${d.cls}" data-k="${k}"><img src="${iconURL('ev_doorway', 64)}"><b>${d.name}</b><span>${d.desc}</span></button>`;
      })
      .join('');
    const p = el(`<div class="panel small pathpick"><div class="head"><h2>Kam dál? <small class="hint">patro ${next}</small></h2><button class="close">✕</button></div>
      <div class="doors">${doors}</div>
      <div class="row" style="justify-content:center;padding:0 0 10px"><span class="hint">Hra se uloží. Zpět se vrátit nelze.</span></div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.querySelectorAll<HTMLElement>('.door').forEach((b) =>
      b.addEventListener('click', () => {
        sfx('stairs');
        this.ui.closeOverlay();
        pick(b.dataset.k as FloorKind);
      }),
    );
  }
}
