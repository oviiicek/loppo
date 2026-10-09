import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, THEMES, themeForFloor } from '../gfx/textures';
import { BAND, bandOf, bandStart, bandEnd, bandOpen, bandDone, bandBest, bandLootBonus, recommendedLevel, bandName, runOf, startRun, isCampFloor, bandCamp } from '../data/bands';
import { bossForFloor, storyBossForFloor, isBossFloor, STORY_END } from '../data/enemies';
import { saveGame } from '../systems/state';
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

  /** the bands: the current expedition to continue, every band with its best floor, the level it asks for,
   *  its loot and its guardian; a new expedition starts at a band's first floor */
  expedition() {
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
    const p = el(`<div class="panel framed expedition"><div class="head"><h2>Výprava do kobek</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">
        <div class="runcard">
          <div><div class="rt">⚑ Aktuální výprava: <b>patro ${cur}</b> · ${esc(bandName(bandOf(cur)))}</div>
          <div class="hint">Checkpoint: patro ${back} (${isBossFloor(back) ? 'příprava na strážce' : isCampFloor(back) ? 'tábor' : 'začátek desítky'}) – sem tě vrátí smrt. Nejhlouběji: patro ${s.maxFloor}.</div></div>
          <button class="btn gold" data-a="cont">Pokračovat ▶</button>
        </div>
        <b class="qsect">Desítky pater</b>
        <div class="hint" style="margin-bottom:6px">Nová výprava začíná prvním patrem desítky. Strážce na jejím konci otevře další desítku. Hlouběji je lepší kořist – a silnější nestvůry.</div>
        <div class="bands">${cards.join('')}</div>
      </div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
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
    p.querySelector('.band.here')?.scrollIntoView({ block: 'center' });
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
