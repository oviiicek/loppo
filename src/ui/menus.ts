import { $, el, esc } from './ui';
import type { UI as UIType } from './ui';
import { iconURL, spellIcon } from '../gfx/textures';
import { CLASSES, CLASS_BY_ID } from '../data/classes';
import { spellsForClass } from '../data/spells';
import { BASE_BY_ID, RARITIES, BASES, CATEGORY_NAMES } from '../data/items';
import { PETS, PET_BY_ID, petTitle, petLevel } from '../data/pets';
import { ClassId } from '../data/types';
import { ACHIEVEMENTS, achievementReward } from '../data/achievements';
import { loadGame, newCharacter, saveGame, game as G, deleteSave, listSlots, setActiveSlot, activeSlot, SLOTS, exportSave, importSave, listFallen, heroTitle, LEECH_CAP } from '../systems/state';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, difficultyOf, difficultyLines } from '../data/difficulty';
import { areaForFloor } from '../data/biomes';
import { sfx, isMuted, setMuted, unlockAudio, settings, saveSettings, startMusic, stopMusic } from '../systems/audio';
import { fsButtonHTML, isStandalone } from './fullscreen';
import { CHRONICLE_ORDER, CUTSCENE_BY_ID } from '../data/story';
import { LORE, LORE_BY_ID } from '../data/lore';
import { BEASTS, KNOW_AT, EL_NAME, EL_CSS, masteryPct } from '../data/bestiary';
import { ENEMY_BY_ID, ROLE_INFO, isBossFloor } from '../data/enemies';
import { FAMILIES } from '../data/families';
import { cleanName } from '../data/nemesis';
import { codexOf, codexCount, CODEX_TOTAL, CODEX_TOTALS, ALL_STONES } from '../data/codex';
import { UNIQUES, POWER_BY_ID } from '../data/uniques';
import { SETS, SET_COLOR } from '../data/sets';
import { parseGem, gemIcon, gemName } from '../data/gems';
import { runeIcon, runeName } from '../data/runes';
import { SPELL_RUNE_BY_ID, spellRuneIcon } from '../data/spellrunes';
import { isCampFloor } from '../data/bands';
import { Net, embedded } from '../net/net';

type UIM = typeof UIType;

function uiScaleName() {
  return settings.uiScale >= 1.15 ? 'velké' : settings.uiScale >= 1 ? 'střední' : 'malé';
}

function salvageName() {
  const n = settings.lootRules.filter((r) => r && r !== 'keep').length;
  return n ? `${n}× auto` : 'vše nechat';
}

function fxName() {
  return settings.lowFx ? 'Grafika: úsporná' : 'Grafika: plná';
}

/** coloured difficulty name with the hardcore skull */
function diffTag(s: { difficulty?: number; hardcore?: boolean }) {
  const d = difficultyOf(s);
  return `<span style="color:${d.color}">${d.name}</span>${s.hardcore ? ' <span class="hctag">☠ Hardcore</span>' : ''}`;
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
      ${save ? `<button class="btn green" data-a="continue">Pokračovat</button><div class="saveinfo">${esc(CLASS_BY_ID[save.cls].name)} • úroveň ${save.level} • patro ${save.floor} • ${diffTag(save)}</div>` : ''}
      <button class="btn" data-a="new">Nová hra</button>
      <button class="btn" data-a="slots">Postavy</button>
      <button class="btn blue" data-a="help">Jak hrát</button>
      <div class="row" style="justify-content:center"><button class="btn small" data-a="sound" style="min-width:0;font-size:18px">${isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut'}</button>${isStandalone() ? '' : `<button class="btn small" data-a="fs" data-fs="label" style="min-width:0;font-size:18px">${fsButtonHTML('label')}</button>`}</div>
      <div class="sprites">${CLASSES.map((c, i) => `<img src="${iconURL('pl_' + c.id, 64)}" style="animation-delay:${i * 0.15}s">`).join('')}</div>
      <div class="version">verze ${__APP_VERSION__} beta</div>
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
        const slots = listSlots();
        const empty = slots.findIndex((x) => !x);
        if (empty >= 0) {
          setActiveSlot(empty);
          m.remove();
          this.classSelect();
        } else this.slots(m, 'Všechny sloty jsou obsazené. Vyber postavu, kterou chceš nahradit.');
      } else if (a === 'slots') this.slots(m);
      else if (a === 'help') this.help(m);
      else if (a === 'fs') this.ui.toggleFullscreen();
      else if (a === 'sound') {
        setMuted(!isMuted());
        b.textContent = isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut';
      }
    });
  }

  slots(menu: HTMLElement, note = '') {
    const slots = listSlots();
    const act = activeSlot();
    const p = el(`<div class="overlay" style="z-index:80"><div class="panel" style="height:auto;max-height:92vh;width:min(94vw,760px)"><div class="head"><h2>Postavy</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:flex;flex-direction:column;gap:8px">
        ${note ? `<div class="hint">${esc(note)}</div>` : ''}
        ${slots
          .map((sv, i) =>
            sv
              ? `<div class="box row" style="justify-content:space-between;flex-wrap:nowrap;${i === act ? 'border-color:#8a6a3a' : ''}"><div class="row" style="flex-wrap:nowrap"><span class="slothero"><img style="height:56px;image-rendering:pixelated" src="${iconURL('pl_' + sv.cls, 64)}">${sv.pets?.active ? `<img class="slotpet" src="${iconURL('pet_' + sv.pets.active, 48)}">` : ''}</span><div><div style="font-size:20px;color:#ffd76a">${sv.heroName ? `${esc(sv.heroName)} – ` : ''}${esc(heroTitle(sv))} • úroveň ${sv.level} <button class="btn small renbtn" data-ren="${i}" title="Pojmenovat hrdinu">✎</button></div><div class="hint">Patro ${sv.floor} (nejhlouběji ${sv.maxFloor}) • ${diffTag(sv)} • ${Math.floor(sv.playTime / 60)} min • zabito ${sv.kills}</div><div class="hint">🏆 ${(sv.achievements ?? []).length}/${ACHIEVEMENTS.length}${sv.pets?.active ? ` • 🐾 ${esc(petTitle(PET_BY_ID[sv.pets.active]))} (úr. ${petLevel(sv.pets, sv.pets.active)})` : ''}</div></div></div>
                 <div class="row" style="flex-wrap:nowrap"><button class="btn green" data-play="${i}">Hrát</button><button class="btn blue small" data-exp="${i}">Přenést</button><button class="btn red small" data-del="${i}">Smazat</button></div></div>`
              : `<div class="box row" style="justify-content:space-between"><span class="hint" style="font-size:18px">Slot ${i + 1} – volný</span><div class="row"><button class="btn" data-new="${i}">Nová postava</button><button class="btn blue small" data-imp="${i}">Vložit kód</button></div></div>`,
          )
          .join('')}
        ${this.fallenHTML()}
      </div></div></div>`);
    this.ui.root.appendChild(p);
    $('.close', p).addEventListener('click', () => p.remove());
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx('ui');
      if (b.dataset.play !== undefined) {
        const i = +b.dataset.play;
        const sv = listSlots()[i];
        if (!sv) return;
        setActiveSlot(i);
        G.save = sv;
        p.remove();
        menu.remove();
        this.ui.startGame();
      } else if (b.dataset.new !== undefined) {
        setActiveSlot(+b.dataset.new);
        p.remove();
        menu.remove();
        this.classSelect();
      } else if (b.dataset.ren !== undefined) {
        const i = +b.dataset.ren;
        const sv = listSlots()[i];
        if (!sv) return;
        const d = el(`<div class="overlay" style="z-index:90"><div class="panel small"><div class="head"><h2>Jméno hrdiny</h2></div><div style="padding:14px"><label class="heroname" style="margin:0 0 12px"><span>Jméno</span><input type="text" maxlength="14" placeholder="nepovinné" autocomplete="off" spellcheck="false"></label><div class="row" style="justify-content:flex-end"><button class="btn" data-x="no">Zpět</button><button class="btn green" data-x="yes">Uložit</button></div></div></div></div>`);
        const inp = $('input', d) as HTMLInputElement;
        inp.value = sv.heroName ?? '';
        // typing must not reach the game's keyboard shortcuts
        inp.addEventListener('keydown', (ev) => ev.stopPropagation());
        this.ui.root.appendChild(d);
        d.addEventListener('click', (ev) => {
          const bb = (ev.target as HTMLElement).closest('button');
          if (!bb) return;
          sfx('ui');
          if (bb.dataset.x === 'yes') {
            const nm = cleanName(inp.value);
            if (nm) sv.heroName = nm;
            else delete sv.heroName;
            saveGame(sv);
            if (G.save?.slot === i) G.save.heroName = sv.heroName;
          }
          d.remove();
          if (bb.dataset.x === 'yes') {
            p.remove();
            this.slots(menu);
          }
        });
      } else if (b.dataset.exp !== undefined) {
        const sv = listSlots()[+b.dataset.exp];
        if (sv) this.transferOut(sv);
      } else if (b.dataset.imp !== undefined) {
        this.transferIn(+b.dataset.imp, () => {
          p.remove();
          this.slots(menu);
        });
      } else if (b.dataset.del !== undefined) {
        const i = +b.dataset.del;
        const sure = el(`<div class="overlay" style="z-index:90"><div class="panel small"><div class="head"><h2>Smazat postavu?</h2></div><div style="padding:14px"><p class="hint" style="font-size:16px">Postava ve slotu ${i + 1} bude nenávratně smazána.</p><div class="row" style="justify-content:flex-end"><button class="btn" data-x="no">Zpět</button><button class="btn red" data-x="yes">Smazat</button></div></div></div></div>`);
        this.ui.root.appendChild(sure);
        sure.addEventListener('click', (ev) => {
          const bb = (ev.target as HTMLElement).closest('button');
          if (!bb) return;
          if (bb.dataset.x === 'yes') {
            deleteSave(i);
            sure.remove();
            p.remove();
            menu.remove();
            this.main();
          } else sure.remove();
        });
      }
    });
  }

  /** hardcore heroes who died, newest first */
  fallenHTML() {
    const list = listFallen();
    if (!list.length) return '';
    return `<div class="fallen"><h3>☠ Síň padlých</h3>${list
      .map(
        (f) =>
          `<div class="row" style="flex-wrap:nowrap"><img class="px" src="${iconURL('pl_' + f.cls, 64)}"><div><div>${esc(CLASS_BY_ID[f.cls]?.name ?? f.cls)} • úroveň ${f.level} • konec v patře ${f.floor} (${esc(areaForFloor(f.floor).name)})</div><div class="hint">${diffTag({ difficulty: f.difficulty })} • nejhlouběji ${f.maxFloor} • zabito ${f.kills} • ${Math.floor(f.playTime / 60)} min • ${new Date(f.date).toLocaleDateString('cs-CZ')}</div></div></div>`,
      )
      .join('')}</div>`;
  }

  // export: show the transfer code with a copy button (clipboard may be refused, so the text stays selectable)
  transferOut(sv: NonNullable<ReturnType<typeof loadGame>>) {
    const code = exportSave(sv);
    const p = el(`<div class="overlay" style="z-index:90"><div class="panel small" style="width:min(94vw,560px)"><div class="head"><h2>Přenést postavu</h2><button class="close">✕</button></div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:8px">
        <p class="hint" style="margin:0">Zkopíruj tento kód a na jiném zařízení ho vlož v menu Postavy → Vložit kód.</p>
        <textarea class="code" readonly></textarea>
        <div class="row" style="justify-content:flex-end"><span class="hint" data-msg></span><button class="btn green" data-x="copy">Kopírovat</button></div>
      </div></div></div>`);
    const ta = $('textarea', p) as HTMLTextAreaElement;
    ta.value = code;
    this.ui.root.appendChild(p);
    $('.close', p).addEventListener('click', () => p.remove());
    $('[data-x=copy]', p).addEventListener('click', () => {
      const msg = $('[data-msg]', p);
      const manual = () => {
        ta.focus();
        ta.select();
        msg.textContent = 'Text je označený – zkopíruj ho ručně.';
      };
      try {
        navigator.clipboard.writeText(code).then(() => (msg.textContent = 'Zkopírováno ✓'), manual);
      } catch {
        manual();
      }
    });
  }

  transferIn(slot: number, done: () => void) {
    const p = el(`<div class="overlay" style="z-index:90"><div class="panel small" style="width:min(94vw,560px)"><div class="head"><h2>Vložit kód postavy</h2><button class="close">✕</button></div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:8px">
        <p class="hint" style="margin:0">Vlož kód zkopírovaný z menu Postavy → Přenést.</p>
        <textarea class="code" placeholder="LOPPO1:…"></textarea>
        <div class="row" style="justify-content:flex-end"><span class="hint" data-msg style="color:#ff8080"></span><button class="btn green" data-x="load">Načíst do slotu ${slot + 1}</button></div>
      </div></div></div>`);
    this.ui.root.appendChild(p);
    const ta = $('textarea', p) as HTMLTextAreaElement;
    // the game blocks text selection globally; the code box needs normal editing
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('.close', p).addEventListener('click', () => p.remove());
    $('[data-x=load]', p).addEventListener('click', () => {
      const r = importSave(ta.value, slot);
      if (typeof r === 'string') {
        $('[data-msg]', p).textContent = r;
        return;
      }
      sfx('levelup');
      p.remove();
      done();
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
        <p><b style="color:#ffd76a">Zbraně:</b> 30 druhů a každá classa má své – kladkový luk střílí tři šípy najednou, opakovací kuše dávky, hromová hůl blesk, který přeskakuje, kosa seče skoro dokola. Zbraně tvé classy padají častěji. Co dělá zbraň jinak, píše její popis (➤).</p>
        <p><b style="color:#ffd76a">Kouzla:</b> 3 běžná kouzla, 1 ultimátní (velké tlačítko) a 1 univerzální (zelené). Na PC klávesy 1–4 a Q. Kouzla se odemykají s úrovní a zesiluješ je body kouzel.</p>
        <p><b style="color:#ffd76a">Postava a kouzla:</b> klepnutím na portrét vlevo nahoře otevřeš postavu (klávesa C), kniha kouzel vpravo nahoře otevře kouzla a talenty (klávesa K). Když čekají nevyužité body, jejich zlatý rámeček září.</p>
        <p><b style="color:#ffd76a">Lektvary:</b> červený obnoví zdraví, modrý manu (klávesy H / J).</p>
        <p><b style="color:#ffd76a">Interakce:</b> u obchodníka, kovadliny, svatyně, schodů nebo zamčených truhel se objeví zlaté tlačítko akce (klávesa E / mezerník).</p>
        <p><b style="color:#ffd76a">Ovladač (gamepad):</b> stačí ho připojit a zmáčknout libovolné tlačítko. Levá páčka – pohyb, A – akce, X / Y / B – kouzla 1–3, RT – ultimátní kouzlo, RB – univerzální kouzlo, LB / LT – lektvar zdraví / many, Start – pauza, Back – inventář, křížový ovladač: ↑ postava, ← kouzla, → inventář, ↓ mapa. V menu vybíráš křížovým ovladačem nebo páčkou, A potvrdí, B vrátí zpět, LB / RB přepínají záložky a pravá páčka posouvá dlouhé texty. Na ovladači PlayStation platí ✕ = A, ○ = B, □ = X, △ = Y.</p>
        <p><b style="color:#ffd76a">Úrovně:</b> za každou úroveň dostaneš 3 body atributů a 1 bod kouzel. Atributy: síla, obratnost, zdraví, mana, magická síla, rychlost útoku.</p>
        <p><b style="color:#ffd76a">Inventář:</b> podržením předmětu začneš vybírat víc předmětů najednou – další klepnutí je přidávají nebo odebírají a dole je prodáš nebo rozebereš jedním tlačítkem (na PC i Ctrl + klik).</p>
        <p><b style="color:#ffd76a">Kořist:</b> 7 kvalit – běžná, neobvyklá, vzácná, epická, legendární, mýtická a krvavě rudá <b style="color:#ff2a2a">pradávná</b>. Legendární a lepší předměty jsou unikáty s vlastní schopností. Předměty můžeš nasadit, prodat, rozebrat, vylepšit (+1 až +10), očarovat, přehodit jim vlastnost a zamknout proti hromadnému prodeji. Co se má s kterou kvalitou dělat hned po sebrání (nechat / prodat / rozebrat), nastavíš v pauze (Kořist).</p>
        <p><b style="color:#ffd76a">Drahokamy a runy:</b> do soketů vkládej drahokamy (tři stejné se spojí ve vyšší stupeň). Každá zbraň má runový soket – runa má při zásahu šanci zapálit, otrávit, zmrazit, vyvolat blesk, pustit krev, oslabit nebo vysát život. Runy kouzel (ozvěna, rozštěpení, oheň, mráz…) mění, jak kouzlo funguje – vkládají se v okně Kouzla.</p>
        <p><b style="color:#ffd76a">Sady a kletby:</b> kusy sad dávají bonus za 2–4 nasazené kusy. Prokletý předmět má velký bonus a postih – v chrámu v Loppu jde kletbu zkrotit. Pět předmětů stejné kvality spojí alchymista v jeden lepší (transmutace).</p>
        <p><b style="color:#ffd76a">Talenty a multiclass:</b> bod talentu dostaneš za každou druhou úroveň; každá classa má tři větve (Kouzla → Talenty). Od úrovně 100 si zvolíš druhou classu a získáš spojený titul.</p>
        <p><b style="color:#ffd76a">Šampioni a bestiář:</b> šampioni mají vlastnosti (ohnivý, zrcadlový, nesmrtelný, štítonoš…), hlouběji i dvě či tři najednou. Každý druh nestvůry má slabiny a odolnosti vůči živlům – zabíjením je odhalíš v Bestiáři (Úspěchy) a nakonec získáš mistrovství.</p>
        <p><b style="color:#ffd76a">Rodiny nestvůr:</b> každá oblast patří dvěma rodinám (nemrtví, pavouci, ghúlové, golemové, kult, upíři…) a každá místnost má smečku jedné rodiny. Nestvůry se <b>znamením nad hlavou</b> zabij první: léčitel ✚ hojí ostatní, nekromant oživuje padlé, vyvolávač povolává další, ochránce zmenšuje poškození nestvůr kolem sebe, odstřelovač dlouho míří (červená čára), posilovač žehná smečce a zaklínač proklíná tebe. Kletby (zranitelnost, rozklad, únava, zpomalený čas, zmatení) vidíš v liště posílení s červeným rámečkem.</p>
        <p><b style="color:#c88aff">Zkažené nestvůry:</b> velmi vzácně se objeví černofialová zkažená verze nestvůry – pětinásobné zdraví, tři náhodné vlastnosti a vždy dobrá kořist (aspoň epický předmět).</p>
        <p><b style="color:#ffd76a">Vysávání a trny:</b> vysávání života a many léčí z poškození, které rozdáš – nejvýš ale ${LEECH_CAP.hp} % zdraví a ${LEECH_CAP.mp} % many za sekundu. Trny vrací útočníkům pevné poškození, odraz vrací část přijaté rány; obojí jde přes jejich brnění. Sada Hradba trnů a unikáty Ostnatý krunýř, Trnová koruna a Ježek z toho udělají celý styl boje.</p>
        <p><b style="color:#ffd76a">Strážci:</b> při 70, 40 a 10 % zdraví změní útoky i arénu a v posledních 10 % zuří.</p>
        <p><b style="color:#ffd76a">Žoldák, soupeři a nemesis:</b> v pauze si najmi žoldáka (tank, léčitel, lučištník, mág) a dej mu vybavení a rozkazy. Jiní dobrodruzi v kobkách se mohou přidat, obchodovat, nebo bojovat. Šampion, který tě zabije, se může stát tvým nemesis – a vrátí se.</p>
        <p><b style="color:#9fe6ff">Hra pro dva:</b> v pauze „Hra pro dva“ – kdo hru založí, dostane kód a druhý hráč ho zadá. Hraje se svět zakladatele; nestvůr je 1,5× víc, mají 2× víc zdraví a 1,5× silnější útoky. Každý sbírá svou kořist, zahozený předmět může vzít i ten druhý. Ke strážci a po schodech dolů se jde jen spolu (2/2).</p>
        <p><b style="color:#ffd76a">Události:</b> zajatci, oltáře, duchové, trhliny se strážcem, rvačky nestvůr, krvavá výzva, rozhodnutí s následky, kostlivci u karet, dopisy padlých a nápisy na zdech. Velmi vzácně i zlatá komnata, zlatý drak, snový portál nebo zlatý déšť.</p>
        <p><b style="color:#ffd76a">Loppo a úkoly:</b> z pauzy se vrátíš domů do Loppa, zpět do kobek vede brána ve zřícenině hradu. Zachránění vesničané tam otevřou kovárnu, obchod, nástěnku úkolů, laboratoř, věž mága, cvičiště a chrám – a budovy rostou za zlato. V tvém domě je truhla, postel (odpočinek dává zkušenosti navíc) a trofeje. Úkoly z nástěnky tě pošlou na konkrétní patra; odměnu si vyzvedneš zase na nástěnce.</p>
        <p><b style="color:#ffd76a">Král Dobromil:</b> před zámkem dává královské úkoly. Za ně roste přízeň krále a s ní pocty s trvalými bonusy – až po Korunu Loppa. Ve vesnici se střídá den a noc podle hodin.</p>
        <p><b style="color:#ffd76a">Vybavení:</b> jednoruční zbraň + štít, dvě jednoruční zbraně, nebo obouruční zbraň. Dále helma, brnění, kalhoty, opasek, boty, 2 prsteny, náhrdelník a náramek.</p>
        <p><b style="color:#ffd76a">Dungeon:</b> každé patro je náhodně generované. V každé desítce jsou první patra malá a ke konci desítky rostou. Hledej tajné místnosti (praskliny ve zdech), trezory zamčené paklíčem a obchodníky. Na konci každé desítky pater (10., 20., 30. …) hlídá strážce – po jeho porážce vysype svůj poklad a otevře se další desítka. Příběhoví strážci čekají také na 25. a 125. patře.</p>
        <p><b style="color:#ffd76a">Příběh:</b> sestup až na 250. patro, na dno světa. Příběh má pět kapitol po 50 patrech a každou uzavírá příběhový strážce – Isolda, Matka spor, Morgrim, Elara a Nyx'thar. Bojují ve více fázích a souboj s nimi trvá zhruba 10 (50. a 150. patro), 15 (100. a 200.) a 20 minut (250.); kratší souboje na 2–3 minuty čekají na 25. patře (Opat Benedikt) a na 125. patře (Grot). Strážce nejde uspěchat, ale když se fáze táhne, pomohou ti pečetní střepy. Každá desítka pater začíná vlastní scénou a v táboře uprostřed ní leží stránka deníku nebo vzkaz. Přečtené scény najdeš v pauze v Kronice. Pod 250. patrem pokračuje Nekonečná hlubina.</p>
        <p><b style="color:#ffd76a">Prostředí:</b> každých 10 pater je jiná oblast – 25 oblastí od Staré krypty přes Katakomby, Zatopené ruiny, Ledový dungeon, Houbový les nebo Hrobku pouštních králů až po Dno světa. Každá má vlastní vzhled, nestvůry a počasí.</p>
        <p><b style="color:#ffd76a">Výprava a desítky pater:</b> kobky se dělí na desítky (1–10, 11–20 …). Brána v Loppu ukáže každou desítku s nejhlubším dosaženým patrem, doporučenou úrovní, bonusem ke kořisti a jejím strážcem. Nová výprava začíná prvním patrem desítky; strážce na jejím konci otevře další. Běží vždy jen jedna výprava – kdo začne jinou, tu rozběhnutou ukončí.</p>
        <p><b style="color:#ffd76a">Checkpointy a tábor:</b> uprostřed každé desítky (5., 15., 35. …) je tábor – bezpečné patro s ohništěm (plné zdraví a mana, posila na 5 minut), obchodníkem, kovadlinou, alchymistou a truhlou úložiště. Smrt tě vrátí na poslední checkpoint: první patro desítky, nebo tábor, pokud do něj výprava už došla. Na lehké obtížnosti začneš stejné patro znovu.</p>
        <p><b style="color:#ffd76a">Patra strážců:</b> na patře se strážcem vede od schodů krátká chodba do přípravné místnosti (oheň k odpočinku, obchodník, kovadlina, alchymista a úložiště) a za ní je aréna. Jakmile do ní vstoupíš, zavře se za tebou bariéra, dokud strážce nepadne. Kdo v aréně zemře, začne znovu v přípravné místnosti. Poražený strážce místo truhel vysype svůj poklad – vždy v něm je epická nebo lepší věc.</p>
        <p><b style="color:#ffd76a">Dveře:</b> po patře si vybereš ze 2–3 dveří: nebezpečná cesta (silnější nestvůry, lepší kořist), běžná cesta nebo cesta k obchodníkovi, a neznámá oblast (pokladnice, síň hádanek, místo setkání nebo patro s osudem).</p>
        <p><b style="color:#ffd76a">Osudy pater:</b> asi každé třetí patro má osud, který se ukáže hned po příchodu – Temnota, Krvavý měsíc, Dvojitá kořist, Bez léčení, Invaze elit, Patro pokladů, Zlatá horečka, Prokletí nebo Hordy. Pod jménem patra je vidět, který platí.</p>
        <p><b style="color:#ffd76a">Patra bez boje:</b> křižovatka obchodníků, pokladnice, síň hádanek (přečti tabulku a šlápni na runové desky ve správném pořadí) a místo setkání s věštkyní, hráči karet a oltáři.</p>
        <p><b style="color:#ff8a7a">Poslední šance:</b> velmi vzácně tě smrt nechá bojovat v aréně. Když 40 sekund vydržíš proti vlnám nestvůr, vrátíš se do patra s jediným bodem zdraví.</p>
        <p><b style="color:#ffd76a">Lektvary:</b> po vypití se lektvar chvíli nedá použít znovu (zdraví 4 s, mana 3 s) – na tlačítku je vidět, kdy bude znovu připravený.</p>
        <p><b style="color:#ffd76a">Mapa:</b> klepni na minimapu (klávesa M) pro velkou mapu prozkoumaného patra. Pozor na bodcové pasti!</p>
        <p><b style="color:#ffd76a">Obchodník:</b> kromě nákupu a prodeje nabízí zpětný odkup prodaných věcí, tajemné zboží neznámé kvality, kovárnu, úložiště a změnu classy.</p>
        <p><b style="color:#ffd76a">Zlatý skřet:</b> občas se v patře skrývá zlatý skřet. Jakmile tě uvidí, uteče a za 18 sekund zmizí portálem. Když ho chytíš, vysype spoustu zlata a vzácný předmět.</p>
        <p><b style="color:#ffd76a">Mazlíčci:</b> v kobkách čeká v klecích 8 zvířátek (kočka, pes, liška, sova, želva, sliz, bludička a dráček). První klec najdeš nejpozději ve 3. patře – dojdi k ní a otevři ji. Mazlíček s tebou chodí, nosí ti kořist, která leží kolem, a dává svůj bonus. Pes kouše a dráček plive oheň. Za každá 4 patra, která s tebou sestoupí, získá úroveň (nejvýš 10). Vyměnit ho jde v pauze (Mazlíčci).</p>
        <p><b style="color:#ffd76a">Deník úkolů:</b> tlačítko Úkoly pod minimapou ukazuje postup úkolu patra; klepnutím otevřeš deník s hlavním úkolem příběhu, úkolem patra, vedlejšími úkoly (z nástěnky jich uneseš 5–10) a mapami pokladů. Mapa pokladu občas leží v truhle nebo ji nosí šampion či zloděj: zlatý křížek na mapě ukáže, kde v patře kopat.</p>
        <p><b style="color:#ffd76a">Prokletá truhla:</b> černá truhla se zelenými runami. Kdo ji otevře, musí 30 sekund odolávat vlnám nestvůr – čím víc jich porazíš, tím bohatší kořist v ní najdeš.</p>
        <p><b style="color:#ffd76a">Úspěchy a statistiky:</b> v menu pauzy najdeš ${ACHIEVEMENTS.length} úspěchů s odměnami (zlato, materiály, paklíče i body atributů) a na druhé záložce statistiky tvé postavy.</p>
        <p><b style="color:#ffd76a">Obtížnost:</b> při zakládání postavy si vybereš Lehkou, Normální, Těžkou nebo Noční můru. Na vyšší obtížnosti mají nepřátelé víc zdraví a silnější útoky, ale dávají víc zkušeností, zlata a lepší kořist. Změnit ji jde v pauze.</p>
        <p><b style="color:#ffd76a">Smrt:</b> přijdeš o část zlata (Lehká 5 %, Normální 15 %, Těžká 20 %, Noční můra 25 %) a zkušeností a začneš patro znovu. V režimu <b style="color:#ff6b6b">☠ Hardcore</b> máš jen jeden život – po smrti postava navždy zmizí.</p>
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
        sfx('ui');
        this.difficultySelect(sel, m);
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

  /** second step of a new hero: the combat difficulty and hardcore */
  difficultySelect(cls: ClassId, menu: HTMLElement) {
    let dsel = DEFAULT_DIFFICULTY;
    let hc = false;
    const p = el(`<div class="overlay" style="z-index:85"><div class="panel diffpanel">
      <div class="head"><h2>Obtížnost boje</h2><button class="close">✕</button></div>
      <div class="body scroll">
        <div class="diffgrid">${DIFFICULTIES.map(
          (d, i) =>
            `<div class="dcard ${i === dsel ? 'sel' : ''}" data-d="${i}" style="--dc:${d.color}"><div class="dn">${d.name}</div><div class="dd">${esc(d.desc)}</div><ul>${difficultyLines(d)
              .map((l) => `<li>${esc(l)}</li>`)
              .join('')}</ul></div>`,
        ).join('')}</div>
        <button class="hcbox" data-a="hc"><span class="tick"></span><span class="hctext"><b>☠ Hardcore</b><small>Jen jeden život: po smrti postava navždy zmizí a začínáš znovu od začátku.</small></span></button>
        <label class="heroname"><span>Jméno hrdiny</span><input type="text" maxlength="14" placeholder="nepovinné" autocomplete="off" spellcheck="false"></label>
        <div class="row diffgo"><span class="hint">Obtížnost jde později změnit v pauze (platí od dalšího patra), Hardcore ne.</span><button class="btn green" data-a="go">Do hlubin!</button></div>
      </div></div></div>`);
    this.ui.root.appendChild(p);
    const close = () => p.remove();
    $('.close', p).addEventListener('click', close);
    p.querySelectorAll<HTMLElement>('.dcard').forEach((c) =>
      c.addEventListener('click', () => {
        sfx('ui');
        dsel = +c.dataset.d!;
        p.querySelectorAll('.dcard').forEach((x) => x.classList.toggle('sel', x === c));
      }),
    );
    ($('.heroname input', p) as HTMLInputElement).addEventListener('keydown', (ev) => ev.stopPropagation());
    const hcBtn = $('[data-a=hc]', p);
    hcBtn.addEventListener('click', () => {
      sfx('ui');
      hc = !hc;
      hcBtn.classList.toggle('on', hc);
    });
    $('[data-a=go]', p).addEventListener('click', () => {
      sfx('levelup');
      const save = newCharacter(cls, { difficulty: dsel, hardcore: hc });
      const nm = cleanName(($('.heroname input', p) as HTMLInputElement).value);
      if (nm) save.heroName = nm;
      save.slot = activeSlot();
      G.save = save;
      saveGame(save);
      p.remove();
      menu.remove();
      this.ui.startGame();
    });
  }

  /** pause menu: another difficulty from the next floor on */
  changeDifficulty(onDone: () => void) {
    const sc = this.ui.scene!;
    const s = sc.save;
    const cur = s.difficulty ?? DEFAULT_DIFFICULTY;
    const p = el(`<div class="overlay" style="z-index:75"><div class="panel diffpanel">
      <div class="head"><h2>Obtížnost boje</h2><button class="close">✕</button></div>
      <div class="body scroll">
        <div class="diffgrid">${DIFFICULTIES.map(
          (d, i) =>
            `<div class="dcard ${i === cur ? 'sel' : ''}" data-d="${i}" style="--dc:${d.color}"><div class="dn">${d.name}</div><div class="dd">${esc(d.desc)}</div><ul>${difficultyLines(d)
              .map((l) => `<li>${esc(l)}</li>`)
              .join('')}</ul></div>`,
        ).join('')}</div>
        <div class="hint" style="margin-top:8px">Změna platí od dalšího patra (nebo po smrti).${s.hardcore ? ' Postava zůstává v režimu ☠ Hardcore.' : ''}</div>
      </div></div></div>`);
    this.ui.root.appendChild(p);
    $('.close', p).addEventListener('click', () => p.remove());
    p.querySelectorAll<HTMLElement>('.dcard').forEach((c) =>
      c.addEventListener('click', () => {
        const i = +c.dataset.d!;
        sfx('ui');
        p.remove();
        if (i === cur) return;
        s.difficulty = i;
        saveGame(s);
        this.ui.toast(`Obtížnost ${DIFFICULTIES[i].name} platí od dalšího patra`, DIFFICULTIES[i].color);
        onDone();
      }),
    );
  }

  pause() {
    const sc = this.ui.scene!;
    const p = el(`<div class="panel small"><div class="head"><h2>Pauza</h2><button class="close">✕</button></div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:8px">
        <div class="hint">${esc(heroTitle(sc.save))} • úroveň ${sc.save.level} • patro ${sc.floor} • herní čas ${Math.floor(sc.save.playTime / 60)} min • <button class="linkbtn" data-a="diff">${diffTag(sc.save)} ✎</button></div>
        <button class="btn green" data-a="resume">Pokračovat</button>
        <div class="row" style="flex-wrap:nowrap"><button class="btn" style="flex:1" data-a="inv">Inventář</button><button class="btn" style="flex:1" data-a="char">Postava</button><button class="btn" style="flex:1" data-a="spells">Kouzla</button><button class="btn" style="flex:1" data-a="merc">⚔️ Žoldák</button></div>
        <div class="row" style="flex-wrap:nowrap"><button class="btn" style="flex:1" data-a="pets">🐾 Mazlíčci</button><button class="btn" style="flex:1" data-a="ach">🏆 Úspěchy</button><button class="btn purple" style="flex:1" data-a="chron">Kronika</button></div>
        <div class="row" style="flex-wrap:nowrap">${sc.save.maxFloor >= 2 || sc.inVillage ? `<button class="btn gold" style="flex:1" data-a="home">${sc.inVillage ? '⬇ Do kobek' : '🏠 Domů do Loppa'}</button>` : ''}<button class="btn" style="flex:1" data-a="quests">📜 Úkoly${(sc.save.village?.quests ?? []).some((q) => q.done) || sc.save.village?.royal?.quest?.done ? ' ✔' : ''}</button><button class="btn blue" style="flex:1" data-a="coop">👥 Hra pro dva${Net.active ? ' ✔' : ''}</button></div>
        <div class="row" style="justify-content:center"><button class="btn small blue" data-a="sound">${isMuted() ? '🔇 Zvuk vypnut' : '🔊 Zvuk zapnut'}</button><button class="btn small blue" data-a="music">${settings.music ? '🎵 Hudba zapnuta' : '🎵 Hudba vypnuta'}</button><button class="btn small blue" data-a="vibrate">${settings.vibrate ? '📳 Vibrace zapnuty' : '📳 Vibrace vypnuty'}</button>${isStandalone() ? '' : `<button class="btn small blue" data-a="fs" data-fs="label">${fsButtonHTML('label')}</button>`}</div>
        <div class="row" style="justify-content:center"><button class="btn small blue" data-a="uiscale">Ovládání: ${uiScaleName()}</button><button class="btn small blue" data-a="salvage">Kořist: ${salvageName()}</button><button class="btn small blue" data-a="fx">${fxName()}</button></div>
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
      else if (a === 'diff') this.changeDifficulty(() => (b.innerHTML = diffTag(sc.save) + ' ✎'));
      else if (a === 'fs') this.ui.toggleFullscreen();
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
        this.ui.panels.lootRules(() => (b.textContent = 'Kořist: ' + salvageName()));
      } else if (a === 'fx') {
        settings.lowFx = !settings.lowFx;
        saveSettings();
        b.textContent = fxName();
      } else if (a === 'vibrate') {
        settings.vibrate = !settings.vibrate;
        saveSettings();
        b.textContent = settings.vibrate ? '📳 Vibrace zapnuty' : '📳 Vibrace vypnuty';
      } else if (a === 'ach') {
        this.achievements();
      } else if (a === 'chron') {
        this.chronicle();
      } else if (a === 'quests') {
        this.ui.quests.log();
      } else if (a === 'coop') {
        this.coop();
      } else if (a === 'home') {
        if (sc.inVillage) {
          this.ui.closeOverlay();
          this.ui.expedition();
          return;
        }
        const why = sc.canGoHome();
        if (why) return void this.ui.toast(why, '#ff8a7a');
        this.ui.confirm('Domů do Loppa?', `Doma tě čeká osada a její budovy. Patro ${sc.floor} pak začneš znovu od schodů.`, () => {
          this.ui.closeOverlay();
          sc.goToVillage();
        }, 'Domů', 'Zůstat');
      } else if (a === 'inv' || a === 'char' || a === 'spells' || a === 'pets' || a === 'merc') {
        this.ui.closeOverlay();
        this.ui.openPanel(a === 'inv' ? 'inventory' : a === 'char' ? 'character' : a === 'pets' ? 'pets' : a === 'merc' ? 'merc' : 'spells');
      } else if (a === 'quit') {
        Net.leave();
        saveGame(sc.save);
        this.ui.closeOverlay(false);
        this.ui.showMainMenu();
      }
    });
  }

  /** playing for two: open a game (a code for the other player), join one, or end it */
  coop() {
    const sc = this.ui.scene!;
    const me = { name: sc.save.heroName || CLASS_BY_ID[sc.save.cls].name, cls: sc.save.cls, lvl: sc.save.level };
    const p = el(`<div class="panel small coop"><div class="head"><h2>👥 Hra pro dva</h2><button class="close">✕</button></div><div class="body scroll" style="display:block;padding:12px"></div></div>`);
    const body = $('.body', p);
    let err = '';
    const rules = `<ul class="mprules">
        <li>Hraje se svět toho, kdo hru založí. Druhý hráč se připojí kódem a objeví se ve stejném patře.</li>
        <li>Nestvůr je o polovinu víc, mají dvojnásobné zdraví a o polovinu silnější útoky.</li>
        <li>Každý vidí a sbírá svou vlastní kořist. Předmět, který někdo zahodí z batohu, může sebrat i ten druhý.</li>
        <li>Po schodech dolů a do arény strážce se jde jen spolu (2/2) – kdo dorazí dřív, počká.</li>
        <li>Kdo padne, za chvíli vstane u spoluhráče. Hra se při otevřeném menu nezastavuje.</li>
        <li>Oba potřebujete internet (spojení jde přímo mezi zařízeními).</li>
        ${embedded() ? '<li class="mpwarn">Tahle verze běží uvnitř jiné stránky, kde prohlížeč přímé spojení nedovolí. Pro hru pro dva ji otevři přímo na <b>oviiicek.github.io/loppo</b>.</li>' : ''}
      </ul>`;
    const render = () => {
      const st = Net.status;
      if (st === 'on')
        body.innerHTML = `<div class="mpon">Hrajete spolu: <b>${esc(Net.partner?.name ?? '')}</b> (${esc(CLASS_BY_ID[Net.partner?.cls ?? 'warrior']?.name ?? '')}, úroveň ${Net.partner?.lvl ?? 1}).</div>
          <div class="hint" style="margin:6px 0 10px">${Net.role === 'host' ? 'Hru hostíš ty: hraje se tvůj svět a ty vybíráš cestu dolů.' : 'Hraje se svět druhé strany. Tvoje zkušenosti, kořist a zlato zůstávají tvé.'}</div>
          <button class="btn red" data-a="leave">Ukončit hru pro dva</button>`;
      else if (st === 'waiting')
        body.innerHTML = `<div class="hint">Kód tvé hry – dej ho druhému hráči:</div><div class="mpcode">${esc(Net.code)}</div>
          <div class="hint" style="margin:6px 0 10px">Čekám, až se připojí… (druhý hráč otevře v pauze „Hra pro dva“ a zadá kód)</div>
          <button class="btn" data-a="leave">Zrušit</button>`;
      else if (st === 'connecting') body.innerHTML = `<div class="hint" style="padding:10px 0">Připojuji…</div><button class="btn" data-a="leave">Zrušit</button>`;
      else
        body.innerHTML = `${rules}${err ? `<div class="mperr">${esc(err)}</div>` : ''}
          <div class="mpacts"><button class="btn green" data-a="host">Založit hru</button>
          <div class="mpjoin"><input class="mpin" maxlength="5" placeholder="KÓD" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn blue" data-a="join">Připojit se</button></div></div>`;
    };
    const off = Net.onChange(() => render());
    render();
    this.ui.showOverlay(p, () => off());
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b || b.classList.contains('close')) return;
      sfx('ui');
      const a = b.dataset.a;
      if (a === 'host') {
        err = '';
        Net.host(me).catch((x: Error) => {
          err = x.message;
          render();
        });
      } else if (a === 'join') {
        const code = (body.querySelector<HTMLInputElement>('.mpin')?.value ?? '').trim().toUpperCase();
        if (code.length < 4) {
          err = 'Zadej kód hry (5 znaků).';
          return render();
        }
        err = '';
        Net.join(code, me).catch((x: Error) => {
          err = x.message;
          render();
        });
      } else if (a === 'leave') Net.leave();
    });
  }

  /** the story so far: every scene and page seen can be played again */
  chronicle() {
    const sc = this.ui.scene!;
    const st = sc.save.story ?? { seen: [], shards: 0, blessing: false, ended: false };
    const seen = CHRONICLE_ORDER.filter((id) => st.seen.includes(id));
    const p = el(`<div class="panel"><div class="head"><h2>Kronika</h2><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">
        <div class="hint" style="margin-bottom:8px">Pečetní střepy: ${st.shards}/4${st.blessing ? ' • Elařino požehnání' : ''}${st.ended ? ' • Příběh dokončen' : ''} – klepnutím si scénu přehraješ znovu.</div>
        ${
          seen.length
            ? seen
                .map((id) => {
                  const c = CUTSCENE_BY_ID[id];
                  const page = id.startsWith('camp');
                  return `<button class="btn ${page ? '' : 'blue'} chron" data-id="${id}" style="display:block;width:100%;text-align:left;margin-bottom:6px;white-space:normal">${page ? '📜' : '🎬'} ${esc(c.name)}</button>`;
                })
                .join('')
            : '<div class="hint">Zatím tu nic není.</div>'
        }
        <div class="hint" style="margin-top:6px">Každá desítka pater začíná svou scénou a v táboře uprostřed ní (5. patro) leží další stránka.</div>
        <h3 class="chronh">Zápisky z hlubin <span class="hint">${(sc.save.lore ?? []).filter((id) => LORE_BY_ID[id]).length}/${LORE.length}</span></h3>
        ${
          (sc.save.lore ?? []).filter((id) => LORE_BY_ID[id]).length
            ? (sc.save.lore ?? [])
                .map((id) => LORE_BY_ID[id])
                .filter(Boolean)
                .map((l) => `<button class="btn chron lore" data-lore="${l.id}" style="display:block;width:100%;text-align:left;margin-bottom:6px;white-space:normal">${l.kind === 'wall' ? '🪨' : '✉️'} ${esc(l.title)}</button>`)
                .join('')
            : '<div class="hint">Dopisy padlých dobrodruhů a nápisy na zdech najdeš v kobkách.</div>'
        }
      </div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.chron');
      if (!b) return;
      sfx('ui');
      if (b.dataset.lore) {
        const l = LORE_BY_ID[b.dataset.lore];
        if (l) this.ui.panels.note(l.title, l.text, l.kind);
        return;
      }
      const c = CUTSCENE_BY_ID[b.dataset.id!];
      // guardian dialogues happen in the dungeon; the chronicle shows them over their area
      if (c) void this.ui.cutscene(c.shots, { scene: c.scene });
    });
  }

  /** achievements and, on the second tab, the hero's statistics */
  achievements(tab: 'ach' | 'stats' | 'nem' | 'codex' | 'beast' = 'ach') {
    const sc = this.ui.scene!;
    const s = sc.save;
    const got = s.achievements ?? [];
    const st = s.stats ?? {};
    const n = (v?: number) => (v ?? 0).toLocaleString('cs-CZ');
    let body: string;
    if (tab === 'ach') {
      body = `<div class="spgrid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${ACHIEVEMENTS.map((a) => {
        const done = got.includes(a.id);
        return `<div class="spcard ${done ? '' : 'locked'}" style="align-items:flex-start"><div style="font-size:26px;line-height:1">${done ? '🏆' : '🔒'}</div><div style="min-width:0"><div class="nm" style="color:${done ? '#ffd76a' : '#ddd'}">${esc(a.name)}</div><div class="lv2">${esc(a.desc)}</div><div class="lv2" style="color:#9dff9d">Odměna: ${achievementReward(a.reward)}</div></div></div>`;
      }).join('')}</div>`;
    } else if (tab === 'codex') {
      const c = codexOf(s);
      const icon = (base: string, tier = 4) => iconURL(`${BASE_BY_ID[base].icon}_t${tier}`, 32);
      const uq = UNIQUES.map((u) => {
        const found = c.u.includes(u.id);
        return `<div class="cxe ${found ? 'found' : ''}"><img src="${icon(u.base)}"><div style="min-width:0"><div class="nm">${found ? esc(u.name) : '???'}</div><div class="lv2">${found ? esc(POWER_BY_ID[u.power]?.desc ?? '') : esc(BASE_BY_ID[u.base].noun)}</div></div></div>`;
      }).join('');
      const sets = SETS.map(
        (d) =>
          `<div class="cxset"><span class="nm" style="color:${SET_COLOR}">${esc(d.name)}</span>${d.pieces
            .map((pc, i) => {
              const found = c.s.includes(`${d.id}:${i}`);
              return `<span class="cxp ${found ? 'found' : ''}" title="${found ? esc(pc.name) : '???'}"><img src="${icon(pc.base)}"></span>`;
            })
            .join('')}</div>`,
      ).join('');
      const kinds = `<table class="cxtab"><tr><th></th>${RARITIES.map((r) => `<th style="color:${r.color}">${esc(r.name.slice(0, 3))}</th>`).join('')}</tr>${BASES.map(
        (b) => `<tr><td>${esc(b.noun)}</td>${RARITIES.map((r, i) => `<td>${c.b.includes(`${b.id}:${i}`) ? `<b style="color:${r.color}">●</b>` : '<span class="cxno">·</span>'}</td>`).join('')}</tr>`,
      ).join('')}</table>`;
      const stones = ALL_STONES.map((k) => {
        const found = c.g.includes(k);
        const sr = k.startsWith('spell:') ? SPELL_RUNE_BY_ID[k.slice(6)] : null;
        const ic = sr ? spellRuneIcon(sr.id) : parseGem(k) ? gemIcon(k) : runeIcon(k);
        return `<span class="cxp ${found ? 'found' : ''}" title="${found ? esc(sr ? sr.name : parseGem(k) ? gemName(k) : runeName(k)) : '???'}"><img src="${iconURL(ic, 30)}"></span>`;
      }).join('');
      body = `<div class="codexhead">Objeveno <b>${codexCount(s)}/${CODEX_TOTAL}</b> · unikáty ${c.u.length}/${CODEX_TOTALS.u} · kusy sad ${c.s.length}/${CODEX_TOTALS.s} · druhy předmětů ${c.b.length}/${CODEX_TOTALS.b} · drahokamy a runy ${c.g.length}/${CODEX_TOTALS.g}</div>
        <h3 class="cxh">Legendární unikáty</h3><div class="cxgrid">${uq}</div>
        <h3 class="cxh">Sady</h3><div class="cxsets">${sets}</div>
        <h3 class="cxh">Drahokamy a runy</h3><div class="cxstones">${stones}</div>
        <h3 class="cxh">Druhy předmětů podle vzácnosti</h3><div style="overflow-x:auto">${kinds}</div>`;
    } else if (tab === 'beast') {
      const kills = s.bestiary ?? {};
      const known = Object.keys(BEASTS).filter((id) => (kills[id] ?? 0) > 0).length;
      const els = (l: string[]) => (l.length ? l.map((x) => `<b style="color:${EL_CSS[x as 'fire']}">${esc(EL_NAME[x as 'fire'])}</b>`).join(', ') : 'žádné');
      const card = (id: string) => {
          const b = BEASTS[id];
          const def = ENEMY_BY_ID[id];
          const k = kills[id] ?? 0;
          if (!def || !b) return '';
          if (!k) return `<div class="bstc"><img class="unk" src="${iconURL(def.sprite, 48)}"><div style="min-width:0"><div class="nm">???</div><div class="lv2">Ještě nepotkán${def.minFloor > 1 ? ` · od ${def.minFloor}. patra` : ''}</div></div></div>`;
          const next = k < KNOW_AT.weak ? KNOW_AT.weak : k < KNOW_AT.loot ? KNOW_AT.loot : k < KNOW_AT.master1 ? KNOW_AT.master1 : k < KNOW_AT.master2 ? KNOW_AT.master2 : 0;
          const m = masteryPct(s, id);
          const role = def.role ? ROLE_INFO[def.role] : null;
          return `<div class="bstc found"><img src="${iconURL(def.sprite, 48)}"><div style="min-width:0"><div class="nm">${esc(def.name)} <span class="hint">· zabito ${n(k)}${next ? ` / ${next}` : ''}</span></div>
            ${role ? `<div class="lv2" style="color:${role.color}">${esc(role.name)} – ${esc(role.desc)}</div>` : ''}
            <div class="lv2">${esc(b.note)}</div>
            <div class="lv2">${k >= KNOW_AT.weak ? `Slabiny: ${els(b.weak)} · odolnosti: ${els(b.resist)}` : `Slabiny a odolnosti: <span class="hint">po ${KNOW_AT.weak} zabitích</span>`}</div>
            <div class="lv2">${k >= KNOW_AT.loot ? `Kořist: ${esc(b.loot)}` : `Kořist: <span class="hint">po ${KNOW_AT.loot} zabitích</span>`}</div>
            ${m ? `<div class="lv2" style="color:#9dff7a">Mistrovství: +${m} % poškození</div>` : `<div class="lv2 hint">Mistrovství po ${KNOW_AT.master1} zabitích</div>`}</div></div>`;
      };
      // grouped by family (a monster of several families stands with the first one)
      const shown = new Set<string>();
      const groups = Object.values(FAMILIES).map((f) => {
        const ids = f.members.filter((id) => BEASTS[id] && !shown.has(id));
        ids.forEach((id) => shown.add(id));
        return ids.length ? `<h3 class="cxh">${esc(f.name)}</h3><div class="bstgrid">${ids.map(card).join('')}</div>` : '';
      });
      const rest = Object.keys(BEASTS).filter((id) => !shown.has(id));
      if (rest.length) groups.push(`<h3 class="cxh">Zvláštní</h3><div class="bstgrid">${rest.map(card).join('')}</div>`);
      body = `<div class="codexhead">Poznáno <b>${known}/${Object.keys(BEASTS).length}</b> druhů nestvůr · slabina = poškození ×${1.5}, odolnost = ×${0.6} · nestvůry se znamením nad hlavou zabij první</div>${groups.join('')}`;
    } else if (tab === 'nem') {
      const list = s.nemeses ?? [];
      const beaten = st.nemeses ?? 0;
      body =
        `<p class="hint" style="margin:0 0 8px">Šampion, který tě zabije, si může vysloužit jméno. Vrátí se o pár pater hlouběji – a s každým dalším vítězstvím nad tebou sílí. Když ho porazíš, nechá po sobě legendární kořist. Poraženo nemesis: <b style="color:#ffd76a">${beaten}</b>.</p>` +
        (list.length
          ? `<div class="nemlist">${list
              .map((nm) => {
                const def = ENEMY_BY_ID[nm.base];
                return `<div class="nemcard"><img src="${iconURL(def?.sprite ?? 'en_skeleton', 48)}"><div style="min-width:0"><div class="nm">☠ ${esc(nm.name)}, ${esc(nm.title)}</div><div class="lv2">${esc(def?.name ?? '')}${nm.affix ? ' · ' + esc(nm.affix) : ''} · úroveň ${nm.level}</div><div class="lv2">Zabil tě ${nm.kills}× · poprvé v patře ${nm.born} · ${nm.next <= s.floor ? 'může se objevit kdykoli' : 'objeví se od patra ' + nm.next}</div></div></div>`;
              })
              .join('')}</div>`
          : `<div class="box hint" style="text-align:center;padding:18px">Zatím tě žádný šampion nepřemohl.</div>`);
    } else {
      const t = Math.round(s.playTime);
      const time = t >= 3600 ? `${Math.floor(t / 3600)} h ${Math.floor((t % 3600) / 60)} min` : `${Math.floor(t / 60)} min`;
      const best = RARITIES[st.bestRarity ?? 0];
      const tiles: [string, string, string, string?][] = [
        ['⏱️', 'Herní čas', time],
        ['⬇️', 'Nejhlubší patro', String(s.maxFloor)],
        ['⭐', 'Úroveň', String(s.level)],
        ['⚔️', 'Poražených nepřátel', n(s.kills)],
        ['👑', 'Z toho šampionů', n(st.elites)],
        ['🟣', 'Zkažených nestvůr', n(st.corrupted)],
        ['🎯', 'Nestvůr se znamením', n(st.priority)],
        ['🌵', 'Zabito trny', n(st.thornKills)],
        ['🔥', 'Nejdelší série zabití', n(st.streak)],
        ['☠️', 'Poražených strážců', n(st.bosses)],
        ['💰', 'Sebraného zlata', n(st.goldEarned)],
        ['🎒', 'Sebraných předmětů', n(st.items)],
        ['💎', 'Nejlepší nález', best.name, best.color],
        ['⚒️', 'Nejvyšší vylepšení', '+' + (st.maxUpgrade ?? 0)],
        ['💥', 'Nejsilnější zásah', n(st.maxHit)],
        ['📦', 'Otevřených truhel', n(st.chests)],
        ['🟩', 'Prokletých truhel', n(st.cursed)],
        ['✅', 'Splněných úkolů', n(st.bounties)],
        ['🚪', 'Tajných místností', n(st.secrets)],
        ['🔑', 'Odemčených zámků', n(st.locks)],
        ['👺', 'Chycených skřetů', n(st.thieves)],
        ['🧪', 'Vypitých lektvarů', n(st.potions)],
        ['🐾', 'Osvobozených mazlíčků', `${s.pets?.owned.length ?? 0}/${PETS.length}`],
        ['🗡️', 'Poražených nemesis', n(st.nemeses)],
        ['🪢', 'Zachráněných zajatců', n(st.rescued)],
        ['🌀', 'Uzavřených trhlin', n(st.rifts)],
        ['🩸', 'Krvavých výzev', n(st.arenas)],
        ['📜', 'Přečtených zápisků', `${s.lore?.length ?? 0}/${LORE.length}`],
        ['✨', 'Neuvěřitelných chvil', n(st.wtf)],
        ['⚰️', 'Smrtí', n(st.deaths)],
      ];
      body = `<div class="statgrid">${tiles.map(([ic, lb, vl, col]) => `<div class="stattile"><span class="ic">${ic}</span><span><span class="lb">${lb}</span><br><b class="vl" ${col ? `style="color:${col}"` : ''}>${esc(vl)}</b></span></div>`).join('')}</div>`;
    }
    const p = el(`<div class="panel"><div class="head"><h2>${tab === 'ach' ? `Úspěchy ${got.length}/${ACHIEVEMENTS.length}` : tab === 'nem' ? 'Nemesis' : tab === 'codex' ? `Kodex ${codexCount(s)}/${CODEX_TOTAL}` : tab === 'beast' ? 'Bestiář' : 'Statistiky'}</h2><div class="tabs"><button class="tab ${tab === 'ach' ? 'on' : ''}" data-tab="ach">Úspěchy</button><button class="tab ${tab === 'stats' ? 'on' : ''}" data-tab="stats">Statistiky</button><button class="tab ${tab === 'nem' ? 'on' : ''}" data-tab="nem">Nemesis${s.nemeses?.length ? ` (${s.nemeses.length})` : ''}</button><button class="tab ${tab === 'codex' ? 'on' : ''}" data-tab="codex">Kodex</button><button class="tab ${tab === 'beast' ? 'on' : ''}" data-tab="beast">Bestiář</button></div><button class="close">✕</button></div>
      <div class="body scroll" style="display:block">${body}</div></div>`);
    this.ui.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.ui.closeOverlay());
    p.querySelectorAll<HTMLElement>('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.tab === tab) return;
        sfx('ui');
        this.achievements(b.dataset.tab as 'ach' | 'stats' | 'nem' | 'codex' | 'beast');
      }),
    );
  }

  /** who dealt the last blow, how hard, and a tip fitting it */
  recapHtml() {
    const h = this.ui.scene?.lastHit;
    if (!h) return '';
    const el: Record<string, string> = { fire: 'ohněm', ice: 'mrazem', lightning: 'bleskem', poison: 'jedem', holy: 'svatým světlem', shadow: 'stínem' };
    const tip =
      h.kind === 'boss'
        ? 'Červené kruhy ukazují, kam strážce udeří – včas z nich uhni a lektvar si nech na chvíli po jeho velkém útoku.'
        : h.kind === 'elite'
          ? 'Šampioni vydrží víc a bijí víc. Bojuj s nimi s plným zdravím a nenech je obklopit ostatními nestvůrami.'
          : h.kind === 'trap'
            ? 'Bodcové pasti se vysouvají v pravidelném rytmu – přeběhni je, když jsou zatažené.'
            : h.el === 'fire' || h.el === 'poison'
              ? 'Z hořící nebo jedovaté země co nejdřív vystup – zraňuje, dokud v ní stojíš.'
              : 'Vylepši výbavu u kovadliny, vsaď drahokamy do soketů, nebo si v pauze zvol nižší obtížnost.';
    const nem = this.ui.scene?.nemesisNote;
    return `<div class="recap"><div>Poslední úder: <b>${esc(h.who)}</b> – ${h.amount.toLocaleString('cs-CZ')} poškození${el[h.el] ? ' ' + el[h.el] : ''}</div>${nem ? `<div class="nemnote">${esc(nem)}</div>` : ''}<div class="hint">💡 ${tip}</div></div>`;
  }

  death(floor: number, lostGold: number) {
    const sc = this.ui.scene!;
    const back = sc.deathReturnFloor();
    const where =
      back === floor
        ? `Patro ${floor} začneš znovu ${isBossFloor(floor) && !sc.inVillage ? 'v přípravné místnosti u ohně' : 'od schodů'}.`
        : `Výprava se vrací na checkpoint: <b style="color:#ffd76a">patro ${back}</b> (${isBossFloor(back) ? 'příprava na strážce' : isCampFloor(back) ? 'tábor' : 'začátek desítky'}).`;
    const p = el(`<div class="panel small" style="border-color:#8a2a2a"><div class="head" style="background:linear-gradient(#3a1414,#1a0a0a)"><h2 style="color:#ff6b6b">Porážka</h2></div>
      <div style="padding:16px;text-align:center">
        <p style="font-size:20px;margin:0 0 4px">Tvoje cesta skončila v patře ${floor}.</p>
        <p style="font-size:17px;margin:0 0 6px">${where}</p>
        <p class="hint">Přijdeš o ${lostGold} zlata a část zkušeností do další úrovně. Předměty i úroveň ti zůstanou.</p>
        ${this.recapHtml()}
        ${
          sc.lastChanceOffer
            ? `<div class="lastch"><b>⚔ Poslední šance</b><span>Smrt váhá. Vydrž 40 sekund v aréně proti vlnám nestvůr – a vrátíš se do patra ${floor} s jediným bodem zdraví. Prohra tě pošle na checkpoint.</span><button class="btn red" data-a="last">Bojovat o život</button></div>`
            : ''
        }
        <div class="row" style="justify-content:center;margin-top:10px"><button class="btn green" data-a="retry">Pokračovat (patro ${back})</button><button class="btn" data-a="menu">Hlavní menu</button></div>
      </div></div>`);
    this.ui.showOverlay(p, undefined, true, true);
    $('[data-a=retry]', p).addEventListener('click', () => {
      this.ui.closeOverlay(false, true);
      this.ui.game.scene.resume('Game');
      sc.respawn();
    });
    p.querySelector('[data-a=last]')?.addEventListener('click', () => {
      this.ui.closeOverlay(false, true);
      this.ui.game.scene.resume('Game');
      sc.lastChance();
    });
    $('[data-a=menu]', p).addEventListener('click', () => {
      sc.payForDeath();
      this.ui.closeOverlay(false, true);
      this.ui.showMainMenu();
    });
  }

  /** a hardcore hero died: the save is already gone, only a new hero or the menu remain */
  hardcoreDeath(floor: number) {
    const sc = this.ui.scene!;
    const s = sc.save;
    const p = el(`<div class="panel small hcdeath"><div class="head"><h2>☠ Konec cesty</h2></div>
      <div style="padding:14px 16px;text-align:center">
        <img class="px" src="${iconURL('pl_' + s.cls, 96)}">
        <p style="font-size:21px;margin:6px 0">Tvoje cesta skončila v patře ${floor} – ${esc(areaForFloor(floor).name)}.</p>
        <p class="hint" style="margin:0 0 6px">Hardcore postava se nedá oživit. ${esc(CLASS_BY_ID[s.cls].name)} úrovně ${s.level} odchází do Síně padlých.</p>
        <div class="hint">Nejhlouběji: patro ${s.maxFloor} • zabito ${s.kills} • ${Math.floor(s.playTime / 60)} min • ${diffTag(s)}</div>
        ${this.recapHtml()}
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn green" data-a="new">Nová postava</button><button class="btn" data-a="menu">Hlavní menu</button></div>
      </div></div>`);
    this.ui.showOverlay(p, undefined, true, true);
    $('[data-a=new]', p).addEventListener('click', () => {
      this.ui.closeOverlay(false, true);
      this.ui.newHero(s.slot ?? activeSlot());
    });
    $('[data-a=menu]', p).addEventListener('click', () => {
      this.ui.closeOverlay(false, true);
      this.ui.showMainMenu();
    });
  }
}
