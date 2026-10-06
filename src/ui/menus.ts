import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { spellsForClass } from '../data/spells';
import { BASE_BY_ID } from '../data/items';
import { ClassId } from '../data/types';
import { ACHIEVEMENTS, achievementReward } from '../data/achievements';
import { loadGame, newCharacter, saveGame, game as G, deleteSave } from '../systems/state';
import { sfx, isMuted, setMuted, unlockAudio, settings, saveSettings, startMusic, stopMusic } from '../systems/audio';

type UIM = typeof UIType;

function uiScaleName() {
  return settings.uiScale >= 1.15 ? 'velké' : settings.uiScale >= 1 ? 'střední' : 'malé';
}

function salvageName() {
  return ['nic', 'běžné', 'běžné + neobvyklé'][settings.autoSalvage] ?? 'nic';
}

export class Menus {
  ui: UIM;
  constructor(ui: UIM) {
    this.ui = ui;
  }

  main() {
    const save = loadGame();
    const m = el(`<div class="menu">
      <div class="torchglow" style="left:-10vw;top:10vh"></div><div class="torchglow" style="right:-10vw;top:10vh"></div>
      <h1>LOPPO</h1>
      <div class="subtitle">Nekonečný dungeon</div>
      ${save ? `<button class="btn green" data-a="continue">Pokračovat</button><div class="saveinfo">${esc(CLASS_BY_ID[save.cls].name)} • úroveň ${save.level} • patro ${save.floor}</div>` : ''}
      <button class="btn" data-a="new">Nová hra</button>
      <button class="btn blue" data-a="help">Jak hrát</button>
      <button class="btn small" data-a="sound" style="min-width:0;font-size:18px">${isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut'}</button>
      <div class="sprites">${CLASSES.map((c, i) => `<img src="${iconURL('pl_' + c.id, 64)}" style="animation-delay:${i * 0.15}s">`).join('')}</div>
    </div>`);
    this.ui.root.appendChild(m);
    m.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      unlockAudio();
      sfx('ui');
      const a = b.dataset.a;
      if (a === 'continue' && save) {
        G.save = save;
        m.remove();
        this.ui.startGame();
      } else if (a === 'new') {
        if (save) this.confirmNew(m);
        else {
          m.remove();
          this.classSelect();
        }
      } else if (a === 'help') this.help(m);
      else if (a === 'sound') {
        setMuted(!isMuted());
        b.textContent = isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut';
      }
    });
  }

  confirmNew(menu: HTMLElement) {
    const p = el(`<div class="overlay" style="z-index:80"><div class="panel small"><div class="head"><h2>Nová hra?</h2></div>
      <div style="padding:14px"><p class="hint" style="font-size:19px">Současná postava bude smazána. Opravdu chceš začít znovu?</p>
      <div class="row" style="justify-content:flex-end"><button class="btn red" data-a="no">Ne</button><button class="btn green" data-a="yes">Ano, nová hra</button></div></div></div></div>`);
    this.ui.root.appendChild(p);
    $('[data-a=no]', p).addEventListener('click', () => p.remove());
    $('[data-a=yes]', p).addEventListener('click', () => {
      deleteSave();
      p.remove();
      menu.remove();
      this.classSelect();
    });
  }

  help(menu: HTMLElement) {
    const p = el(`<div class="overlay" style="z-index:80"><div class="panel" style="height:auto;max-height:92vh"><div class="head"><h2>Jak hrát</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:block;font-size:18px;line-height:1.45">
        <p><b style="color:#ffd76a">Pohyb:</b> virtuální joystick vlevo dole (na PC klávesy WASD / šipky).</p>
        <p><b style="color:#ffd76a">Útok:</b> automatický. Když se přiblížíš k nepříteli na dosah své zbraně, postava sama útočí. Meč musí přijít blízko, luk a hůl střílí z dálky.</p>
        <p><b style="color:#ffd76a">Kouzla:</b> 3 běžná kouzla, 1 ultimátní (velké tlačítko) a 1 univerzální (zelené). Na PC klávesy 1–4 a Q. Kouzla se odemykají s úrovní a zesiluješ je body kouzel.</p>
        <p><b style="color:#ffd76a">Lektvary:</b> červený obnoví zdraví, modrý manu (klávesy H / J).</p>
        <p><b style="color:#ffd76a">Interakce:</b> u obchodníka, kovadliny, svatyně, schodů nebo zamčených truhel se objeví zlaté tlačítko akce (klávesa E / mezerník).</p>
        <p><b style="color:#ffd76a">Úrovně:</b> za každou úroveň dostaneš 3 body atributů a 1 bod kouzel. Atributy: síla, obratnost, zdraví, mana, magická síla, rychlost útoku.</p>
        <p><b style="color:#ffd76a">Kořist:</b> 6 kvalit – běžná, neobvyklá, vzácná, epická, legendární a mýtická. Předměty můžeš nasadit, prodat, rozebrat, vylepšit (+1 až +10) a očarovat.</p>
        <p><b style="color:#ffd76a">Vybavení:</b> jednoruční zbraň + štít, dvě jednoruční zbraně, nebo obouruční zbraň. Dále helma, brnění, kalhoty, opasek, boty, 2 prsteny, náhrdelník a náramek.</p>
        <p><b style="color:#ffd76a">Dungeon:</b> každé patro je náhodně generované a postupně větší. Hledej tajné místnosti (praskliny ve zdech), trezory zamčené paklíčem a obchodníky. Každé 5. patro hlídá strážce – po jeho porážce si vybereš jednu ze tří truhel.</p>
        <p><b style="color:#ffd76a">Prostředí:</b> každých 10 pater se dungeon promění – Kobky, Krypta, Jeskyně, Výheň a Ledové hlubiny, každé s vlastními nepřáteli.</p>
        <p><b style="color:#ffd76a">Mapa:</b> klepni na minimapu (klávesa M) pro velkou mapu prozkoumaného patra. Pozor na bodcové pasti!</p>
        <p><b style="color:#ffd76a">Úspěchy:</b> v menu pauzy najdeš 25 úspěchů s odměnami (zlato, materiály i body atributů).</p>
        <p><b style="color:#ffd76a">Smrt:</b> přijdeš o 15 % zlata a část zkušeností a začneš patro znovu.</p>
      </div></div></div>`);
    this.ui.root.appendChild(p);
    $('.close', p).addEventListener('click', () => p.remove());
    void menu;
  }

  classSelect() {
    let sel: ClassId = 'warrior';
    const m = el(`<div class="menu" style="justify-content:flex-start;padding:10px">
      <div class="panel" style="width:min(98vw,1150px);height:min(96vh,660px)">
        <div class="head"><h2>Vyber si classu</h2><button class="close">✕</button></div>
        <div class="body">
          <div class="col scroll" style="flex:1.4;min-width:0"><div class="classgrid">${CLASSES.map(
            (c) => `<div class="ccard ${c.id === sel ? 'sel' : ''}" data-cls="${c.id}"><img src="${iconURL('pl_' + c.id, 64)}"><div class="nm">${c.name}</div><div class="st">${c.style}</div></div>`,
          ).join('')}</div></div>
          <div class="col detail box" style="flex:1;min-width:0"></div>
        </div>
      </div></div>`);
    this.ui.root.appendChild(m);
    const detail = $('.detail', m);
    const render = () => {
      const c = CLASS_BY_ID[sel];
      const sp = spellsForClass(sel);
      const weapon = BASE_BY_ID[c.weapon];
      const off = c.offhand ? BASE_BY_ID[c.offhand] : null;
      const attrs = Object.entries(c.attrs)
        .map(([k, v]) => `${({ str: 'Síla', dex: 'Obratnost', vit: 'Zdraví', ene: 'Mana', int: 'Magická síla', spd: 'Rychlost útoku' } as any)[k]} +${v}`)
        .join(', ');
      detail.innerHTML = `<div class="scroll" style="flex:1;min-height:0"><div class="row" style="flex-wrap:nowrap"><img style="height:84px;image-rendering:pixelated" src="${iconURL('pl_' + sel, 96)}"><div><h3 style="color:#ffd76a;font-size:31px;margin:0">${c.name}</h3><div class="sub">${c.style}</div></div></div>
        <p style="font-size:18px;margin:6px 0">${esc(c.desc)}</p>
        <div style="color:#9dff9d;font-size:17px">Pasivní: ${esc(c.passive)}</div>
        <div class="hint" style="margin-top:4px">Výchozí zbraň: ${esc(weapon.noun)}${off ? ' + ' + esc(off.noun) : ''}</div>
        <div class="hint">Bonus atributů: ${attrs}</div>
        <div class="hint" style="margin-top:6px">Kouzla classy (${sp.length}, odemykají se s úrovní):</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0">${sp.map((x) => `<img title="${esc(x.name)} (úr. ${x.lvl})" style="width:30px;height:30px;border-radius:5px;${x.ult ? 'outline:2px solid #ffb347' : ''}" src="${spellIcon(x.icon, x.color, 60)}">`).join('')}</div></div>
        <button class="btn green" data-a="start" style="font-size:24px;width:100%;flex-shrink:0">Začít dobrodružství</button>`;
      $('[data-a=start]', detail).addEventListener('click', () => {
        sfx('levelup');
        const save = newCharacter(sel);
        G.save = save;
        saveGame(save);
        m.remove();
        this.ui.startGame();
      });
    };
    m.querySelectorAll<HTMLElement>('.ccard').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        sel = c.dataset.cls as ClassId;
        m.querySelectorAll('.ccard').forEach((x) => x.classList.toggle('sel', x === c));
        render();
      }),
    );
    $('.close', m).addEventListener('click', () => {
      m.remove();
      this.main();
    });
    render();
  }

  pause() {
    const sc = this.ui.scene!;
    const p = el(`<div class="panel small"><div class="head"><h2>Pauza</h2><button class="close">✕</button></div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:8px">
        <div class="hint">${esc(CLASS_BY_ID[sc.save.cls].name)} • úroveň ${sc.save.level} • patro ${sc.floor} • herní čas ${Math.floor(sc.save.playTime / 60)} min</div>
        <button class="btn green" data-a="resume">Pokračovat</button>
        <button class="btn" data-a="inv">Inventář</button>
        <button class="btn" data-a="char">Postava</button>
        <button class="btn" data-a="spells">Kouzla</button>
        <button class="btn" data-a="ach">Úspěchy (${(sc.save.achievements ?? []).length}/${ACHIEVEMENTS.length})</button>
        <div class="row" style="justify-content:center"><button class="btn small blue" data-a="sound">${isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut'}</button><button class="btn small blue" data-a="music">${settings.music ? '🎵 Hudba zapnuta' : '🎵 Hudba vypnuta'}</button><button class="btn small blue" data-a="vibrate">${settings.vibrate ? '📳 Vibrace zapnuty' : '📳 Vibrace vypnuty'}</button></div>
        <div class="row" style="justify-content:center"><button class="btn small blue" data-a="uiscale">Ovládání: ${uiScaleName()}</button><button class="btn small blue" data-a="salvage">Rozebírat: ${salvageName()}</button></div>
        <button class="btn red" data-a="quit">Uložit a odejít do menu</button>
      </div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b || b.classList.contains('close')) return;
      sfx('ui');
      const a = b.dataset.a;
      if (a === 'resume') this.ui.closeOverlay();
      else if (a === 'sound') {
        setMuted(!isMuted());
        b.textContent = isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut';
      } else if (a === 'music') {
        settings.music = !settings.music;
        saveSettings();
        if (settings.music) startMusic();
        else stopMusic();
        b.textContent = settings.music ? '🎵 Hudba zapnuta' : '🎵 Hudba vypnuta';
      } else if (a === 'uiscale') {
        settings.uiScale = settings.uiScale >= 1.15 ? 0.85 : settings.uiScale >= 1 ? 1.2 : 1;
        saveSettings();
        this.ui.layout();
        b.textContent = 'Ovládání: ' + uiScaleName();
      } else if (a === 'salvage') {
        settings.autoSalvage = (settings.autoSalvage + 1) % 3;
        saveSettings();
        b.textContent = 'Rozebírat: ' + salvageName();
      } else if (a === 'vibrate') {
        settings.vibrate = !settings.vibrate;
        saveSettings();
        b.textContent = settings.vibrate ? '📳 Vibrace zapnuty' : '📳 Vibrace vypnuty';
      } else if (a === 'ach') {
        this.achievements();
      } else if (a === 'inv' || a === 'char' || a === 'spells') {
        this.ui.closeOverlay();
        this.ui.openPanel(a === 'inv' ? 'inventory' : a === 'char' ? 'character' : 'spells');
      } else if (a === 'quit') {
        saveGame(sc.save);
        this.ui.closeOverlay(false);
        this.ui.showMainMenu();
      }
    });
  }

  achievements() {
    const sc = this.ui.scene!;
    const got = sc.save.achievements ?? [];
    const st = sc.save.stats ?? {};
    const p = el(`<div class="panel"><div class="head"><h2>Úspěchy ${got.length}/${ACHIEVEMENTS.length}</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">
        <div class="hint" style="margin-bottom:8px">Strážců poraženo: ${st.bosses ?? 0} • truhel otevřeno: ${st.chests ?? 0} • tajných místností: ${st.secrets ?? 0} • zámků odemčeno: ${st.locks ?? 0} • nepřátel zabito: ${sc.save.kills}</div>
        <div class="spgrid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${ACHIEVEMENTS.map((a) => {
          const done = got.includes(a.id);
          return `<div class="spcard ${done ? '' : 'locked'}" style="align-items:flex-start"><div style="font-size:26px;line-height:1">${done ? '🏆' : '🔒'}</div><div style="min-width:0"><div class="nm" style="color:${done ? '#ffd76a' : '#ddd'}">${esc(a.name)}</div><div class="lv2">${esc(a.desc)}</div><div class="lv2" style="color:#9dff9d">Odměna: ${achievementReward(a.reward)}</div></div></div>`;
        }).join('')}</div>
      </div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
  }

  death(floor: number, lostGold: number) {
    const sc = this.ui.scene!;
    const p = el(`<div class="panel small" style="border-color:#8a2a2a"><div class="head" style="background:linear-gradient(#3a1414,#1a0a0a)"><h2 style="color:#ff6b6b">Padl jsi</h2></div>
      <div style="padding:16px;text-align:center">
        <p style="font-size:20px">Tvoje cesta skončila v patře ${floor}.</p>
        <p class="hint">Přijdeš o ${lostGold} zlata a část zkušeností do další úrovně. Předměty i úroveň ti zůstanou.</p>
        <div class="row" style="justify-content:center;margin-top:10px"><button class="btn green" data-a="retry">Zkusit patro znovu</button><button class="btn" data-a="menu">Hlavní menu</button></div>
      </div></div>`);
    this.ui.showOverlay(p, undefined);
    $('[data-a=retry]', p).addEventListener('click', () => {
      this.ui.closeOverlay(false);
      this.ui.game.scene.resume('Game');
      sc.respawn();
    });
    $('[data-a=menu]', p).addEventListener('click', () => {
      const lost = Math.round(sc.save.gold * 0.15);
      sc.save.gold -= lost;
      sc.save.xp = Math.round(sc.save.xp * 0.7);
      saveGame(sc.save);
      this.ui.closeOverlay(false);
      this.ui.showMainMenu();
    });
  }
}
