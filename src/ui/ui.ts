import Phaser from 'phaser';
import { BOSS_PHASE_HP, BOSS_PHASES } from '../data/bossphases';
import { SPELL_RUNE_BY_ID } from '../data/spellrunes';
import type { GameScene, MerchantStock } from '../scenes/GameScene';
import type { Enemy } from '../game/entities';
import { iconURL, spellIcon } from '../gfx/textures';
import { SPELL_BY_ID } from '../data/spells';
import { Item } from '../data/types';
import { itemIcon } from '../data/items';
import { xpForLevel, game as G, saveGame, setActiveSlot, freeTalentPoints } from '../systems/state';
import { bus } from '../systems/events';
import { sfx, unlockAudio, startMusic, settings } from '../systems/audio';
import { Panels } from './panels';
import { Menus } from './menus';
import { Pad } from './gamepad';
import type { Bounty } from '../scenes/GameScene';
import { TS } from '../game/map';
import { T_FLOOR, T_WALL } from '../systems/dungeon';
import { playCutscene, CutsceneOpts } from './cutscene';
import { CUTSCENE_BY_ID, Shot } from '../data/story';
import { storyOf } from '../systems/state';
import { FS_HELP, autoFullscreen, fsActive, fsButtonHTML, fsSupported, isStandalone, onFullscreenChange, syncFsButtons, toggleFullscreen } from './fullscreen';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const SKILL_LAYOUT = [
  { cx: 158, cy: 108, size: 64 },
  { cx: 128, cy: 178, size: 64 },
  { cx: 58, cy: 210, size: 64 },
  { cx: 58, cy: 110, size: 100 },
  { cx: 140, cy: 46, size: 54 },
];
const SKILL_KEYS = ['1', '2', '3', '4', 'Q'];

class UIManager {
  game!: Phaser.Game;
  scene: GameScene | null = null;
  root!: HTMLElement;
  joy: [number, number] = [0, 0];
  newItems = 0;
  hud: HTMLElement | null = null;
  panel: HTMLElement | null = null;
  panels = new Panels(this);
  menus = new Menus(this);
  /** controller support (movement, buttons, menu navigation) */
  pad = new Pad(this);
  private tickT = 0;
  private mapT = 0;
  private bossRef: Enemy | null = null;
  private actionLabel: string | null = null;
  private toastBox!: HTMLElement;
  private lastHp = -1;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  init(g: Phaser.Game) {
    this.game = g;
    this.root = document.getElementById('ui')!;
    this.pad.start();
    bus.on('buffs', () => this.renderBuffs());
    bus.on('codex', (name: string) => this.toast(`📖 Nový záznam v kodexu: ${name}`, '#ffc24a'));
    bus.on('equip', () => this.refreshSkills());
    document.addEventListener(
      'pointerdown',
      () => {
        unlockAudio();
        startMusic();
      },
      { once: true },
    );
    // save when the app goes to background (mobile)
    const persist = () => {
      if (this.scene) saveGame(this.scene.save);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        persist();
        if (this.scene && !this.panel && !this.cutsceneActive && !this.scene.player.dead) this.menus.pause();
      }
    });
    window.addEventListener('pagehide', persist);
    // Android back button / browser back: open the pause menu instead of leaving the game
    try {
      history.pushState({ loppo: 1 }, '');
      window.addEventListener('popstate', () => {
        if (this.cutsceneActive) {
          /* the cutscene has its own skip button */
        } else if (this.scene && !this.panel && !this.scene.player.dead) this.menus.pause();
        else if (this.panel && this.scene) this.closeOverlay();
        try {
          history.pushState({ loppo: 1 }, '');
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* history not available (sandbox) */
    }
    // while a panel is open the game scene (and its keyboard input) is paused
    document.addEventListener('keydown', (e) => {
      if (!this.panel || !this.scene) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'i' || k === 'c' || k === 'k' || k === 'm') {
        if (this.panel.querySelector('.lockbar')) return;
        // keep the key away from Phaser (listens on window) so it does not re-open a menu
        e.stopPropagation();
        e.preventDefault();
        this.closeOverlay();
      }
    });
    window.addEventListener('resize', () => this.layout());
    // F = fullscreen on a keyboard (handled here, inside the key event, or the browser refuses)
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'f') return;
      if ((e.target as HTMLElement).closest?.('input, textarea')) return;
      this.toggleFullscreen();
    });
    onFullscreenChange(() => syncFsButtons());
    // prevent context menu / double-tap zoom
    // (text boxes keep their long-press menu so a transfer code can be pasted on phones)
    document.addEventListener('contextmenu', (e) => {
      if (!(e.target as HTMLElement).closest?.('textarea')) e.preventDefault();
    });
    // iOS Safari ignores user-scalable=no; block its pinch-zoom gestures explicitly
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------- flow
  showMainMenu() {
    this.clearAll();
    const sm = this.game.scene;
    if (sm.isActive('Game') || sm.isPaused('Game')) sm.stop('Game');
    if (!sm.isActive('Menu')) sm.start('Menu');
    this.menus.main();
  }

  startGame() {
    this.clearAll();
    const save = G.save!;
    const sm = this.game.scene;
    if (sm.isActive('Menu')) sm.stop('Menu');
    if (sm.isActive('Game') || sm.isPaused('Game')) sm.stop('Game');
    sm.start('Game', { save });
    autoFullscreen();
  }

  clearAll() {
    this.cutsceneActive = false;
    this.fcard = null;
    this.root.innerHTML = '';
    this.hud = null;
    this.panel = null;
    this.scene = null;
  }

  attachGame(scene: GameScene) {
    this.scene = scene;
    this.cutsceneActive = false;
    this.root.innerHTML = '';
    this.panel = null;
    this.panelLocked = false;
    this.buildHud();
    this.refreshSkills();
    this.renderBuffs();
    this.layout();
    // the title card of the floor stays up while the new floor is being set up
    if (this.fcard) this.root.appendChild(this.fcard.el);
  }

  // ---------------------------------------------------------------- floor title card
  private fcard: { el: HTMLElement; shown: number; floor: number; skip: boolean } | null = null;

  /** black full-screen card with the floor number and the name of its area (covers the walk down and the loading) */
  floorCard(c: { floor: number; name: string; region: string; color: string }, sub = '', instant = false) {
    this.fcard?.el.remove();
    const el = document.createElement('div');
    // over an already black screen it must cover the new floor at once
    el.className = 'floorcard' + (instant ? ' now' : '');
    el.style.setProperty('--fc', c.color);
    el.innerHTML = `<div class="fc-in"><div class="fc-floor">Patro ${c.floor}</div><div class="fc-rule"><i></i></div><div class="fc-name"></div><div class="fc-region"></div><div class="fc-sub"></div></div>`;
    $('.fc-name', el).textContent = c.name;
    $('.fc-region', el).textContent = c.region;
    const fc = { el, shown: performance.now(), floor: c.floor, skip: false };
    // a tap shortens it
    el.addEventListener('pointerdown', () => (fc.skip = true));
    this.root.appendChild(el);
    this.fcard = fc;
    if (sub) this.floorCardSub(sub);
  }

  floorCardUp(floor: number) {
    return this.fcard?.floor === floor;
  }

  /** the line about what waits on the floor (known once the floor exists) */
  floorCardSub(text: string) {
    if (!this.fcard || !text) return;
    const s = $('.fc-sub', this.fcard.el);
    s.textContent = text;
    s.classList.add('on');
  }

  /** resolves once the card has been up for `minMs` (or was tapped) */
  async holdFloorCard(minMs: number) {
    const fc = this.fcard;
    while (fc && this.fcard === fc) {
      const t = performance.now() - fc.shown;
      if (t >= minMs || (fc.skip && t > 700)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  hideFloorCard() {
    const fc = this.fcard;
    if (!fc) return;
    this.fcard = null;
    fc.el.classList.add('out');
    setTimeout(() => fc.el.remove(), 800);
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const s = this.scene!.save;
    const hud = el(`<div class="passthrough" style="position:absolute;inset:0">
      <div class="vignette"></div>
      <div class="joyzone"><div class="joy"><span class="arr u"></span><span class="arr d"></span><span class="arr l"></span><span class="arr r"></span><div class="knob"></div></div></div>
      <div class="hud-status">
        <div class="portrait"><img class="px" src="${iconURL('pl_' + s.cls, 64)}">${s.hardcore ? '<span class="hcbadge" title="Hardcore">☠</span>' : ''}</div>
        <div class="bars">
          <div class="bar hp"><div class="fill"></div><div class="fill shieldfill" style="background:rgba(160,210,255,.55);transform:scaleX(0)"></div><div class="txt"></div></div>
          <div class="bar mp"><div class="fill"></div><div class="txt"></div></div>
          <div class="xprow"><span class="lv">LV 1</span><div class="bar xp"><div class="fill"></div></div></div>
          <div class="meta"><span><img src="${iconURL('ic_gold', 24)}"> <b class="gold">0</b></span><span class="kills"></span><span class="mercchip" title="Žoldák"><img><i><b></b></i></span></div>
          <div class="buffs"></div>
        </div>
      </div>
      <div class="minimap"><canvas width="124" height="124"></canvas></div>
      <div class="floorlbl"><div class="fl"></div><div class="bounty"></div></div>
      <div class="topbtns">
        ${fsSupported() && !isStandalone() ? `<div class="rbtn fs" data-a="fs" data-fs="icon" title="Celá obrazovka (F)">${fsButtonHTML('icon')}</div>` : ''}
        <div class="rbtn" data-a="spells" title="Kouzla (K)">✦<span class="badge sp"></span></div>
        <div class="rbtn" data-a="character" title="Postava (C)">☗<span class="badge at"></span></div>
        <div class="rbtn" data-a="pause" title="Menu (Esc)">☰</div>
      </div>
      <div class="bossbar"><div class="name"></div><div class="bar hp"><div class="fill"></div></div></div>
      <div class="eventbar"><div class="name"></div><div class="bar ev"><div class="fill"></div></div></div>
      <div class="streak"><b></b><span>série zabití</span><i></i></div>
      <div class="toasts"></div>
      <div class="lootfeed"></div>
      <div class="banner"><h1></h1><p></p></div>
      <div class="levelup"><h2></h2><p>+3 body atributů • +1 bod kouzel</p></div>
      <div class="skills"></div>
      <div class="hintbox"></div>
      <div class="action"></div>
    </div>`);
    this.root.appendChild(hud);
    this.hud = hud;
    this.toastBox = $('.toasts', hud);
    this.minimapCtx = ($('.minimap canvas', hud) as HTMLCanvasElement).getContext('2d');
    hud.querySelectorAll<HTMLElement>('.topbtns .rbtn').forEach((b) => {
      b.style.pointerEvents = 'auto';
      if (b.dataset.a === 'fs') {
        // fullscreen must come from a click – phones ignore a request made on pointerdown
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          sfx('ui');
          this.toggleFullscreen();
        });
        return;
      }
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        sfx('ui');
        const a = b.dataset.a!;
        if (a === 'pause') this.togglePause();
        else this.openPanel(a);
      });
    });
    $('.topbtns', hud).style.pointerEvents = 'auto';
    // the mercenary's chip: its health; a tap opens its panel
    const chip = $('.mercchip', hud);
    chip.style.pointerEvents = 'auto';
    chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sfx('ui');
      this.openPanel('merc');
    });
    $('.minimap', hud).addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sfx('ui');
      this.bigMap();
    });
    const act = $('.action', hud);
    act.style.pointerEvents = 'auto';
    act.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.scene?.doAction();
    });
    this.buildSkills();
    this.setupJoystick();
    this.padHints();
  }

  buildSkills() {
    const box = $('.skills', this.hud!);
    box.innerHTML = '';
    SKILL_LAYOUT.forEach((L, i) => {
      const b = el(`<div class="skill ${i === 3 ? 'ult' : i === 4 ? 'uni' : ''}" data-i="${i}"><img><div class="cd"></div><div class="cdt"></div><div class="key">${SKILL_KEYS[i]}</div></div>`);
      b.style.width = b.style.height = L.size + 'px';
      b.style.right = L.cx - L.size / 2 + 'px';
      b.style.bottom = L.cy - L.size / 2 + 'px';
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const sc = this.scene;
        if (!sc) return;
        if (!sc.save.loadout[i]) {
          this.openPanel('spells');
          return;
        }
        sc.castSlot(i);
      });
      box.appendChild(b);
    });
    // potions and bag
    const mk = (cls: string, icon: string, cx: number, cy: number, size: number, fn: () => void, withCount = true) => {
      const b = el(`<div class="potion ${cls}"><img src="${iconURL(icon, 48)}">${withCount ? '<span class="cnt">0</span>' : ''}</div>`);
      b.style.width = b.style.height = size + 'px';
      b.style.right = cx - size / 2 + 'px';
      b.style.bottom = cy - size / 2 + 'px';
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
      });
      box.appendChild(b);
    };
    mk('php', 'ic_hpPotion', 262, 34, 54, () => this.scene?.usePotion('hpPotion'));
    mk('pmp', 'ic_mpPotion', 204, 34, 54, () => this.scene?.usePotion('mpPotion'));
    mk('bag', 'ic_belt', 30, 30, 54, () => this.openPanel('inventory'), false);
    const bag = $('.potion.bag img', box) as HTMLImageElement;
    bag.src = bagIcon();
    const badge = el('<span class="badge inv"></span>');
    $('.potion.bag', box).appendChild(badge);
  }

  refreshSkills() {
    const sc = this.scene;
    if (!sc || !this.hud) return;
    const s = sc.save;
    this.hud.querySelectorAll<HTMLElement>('.skill').forEach((b) => {
      const i = +b.dataset.i!;
      const id = s.loadout[i];
      const img = $('img', b) as HTMLImageElement;
      if (id && SPELL_BY_ID[id]) {
        const sp = SPELL_BY_ID[id];
        img.src = spellIcon(sp.icon, sp.color, 80);
        b.classList.remove('empty');
      } else {
        img.src = spellIcon('plus', '#555555', 80);
        b.classList.add('empty');
      }
      // a spell rune shows as a small coloured gem on the button
      const rune = id ? s.spellRunes?.[id] : undefined;
      let mark = b.querySelector<HTMLElement>('.srmark');
      if (rune && SPELL_RUNE_BY_ID[rune]) {
        if (!mark) {
          mark = document.createElement('i');
          mark.className = 'srmark';
          b.appendChild(mark);
        }
        mark.style.background = SPELL_RUNE_BY_ID[rune].color;
      } else mark?.remove();
    });
    const portrait = $('.portrait img', this.hud) as HTMLImageElement;
    portrait.src = iconURL('pl_' + s.cls, 64);
  }

  /** the HUD names the controller buttons while a controller is in use (and the keys otherwise) */
  padHints() {
    if (!this.hud) return;
    const on = this.pad.active;
    const g = this.pad.glyphs;
    const padKeys = [g.X, g.Y, g.B, g.RT, g.RB];
    this.hud.querySelectorAll<HTMLElement>('.skill').forEach((b) => {
      const i = +b.dataset.i!;
      $('.key', b).textContent = on ? padKeys[i] : SKILL_KEYS[i];
    });
    const pk = (sel: string, txt: string) => {
      const b = this.hud!.querySelector<HTMLElement>(sel);
      if (!b) return;
      let k = b.querySelector<HTMLElement>('.pkey');
      if (!k) b.appendChild((k = el('<span class="pkey"></span>')));
      k.textContent = txt;
    };
    pk('.potion.php', g.LB);
    pk('.potion.pmp', g.LT);
    pk('.potion.bag', g.BACK);
    this.setAction(this.actionLabel);
  }

  setupJoystick() {
    const zone = $('.joyzone', this.hud!);
    zone.style.pointerEvents = 'auto';
    const joy = $('.joy', zone);
    const knob = $('.knob', joy);
    let active: number | null = null;
    let cx = 0,
      cy = 0;
    const R = 50;
    const home = () => {
      const h = window.innerHeight;
      const sc = Math.max(0.7, Math.min(1.7, Math.min(h / 520, window.innerWidth / 950))) * (settings.uiScale || 1);
      cx = 30 + 68 * sc + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-l')) || 0);
      cy = zone.clientHeight - 30 - 68 * sc;
      joy.style.left = cx + 'px';
      joy.style.top = cy + 'px';
      joy.style.transform = `scale(${sc})`;
      knob.style.transform = 'translate(0,0)';
      this.joy = [0, 0];
    };
    home();
    (this as any)._joyHome = home;
    const move = (x: number, y: number) => {
      let dx = x - cx,
        dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const m = Math.min(1, d / R);
      this.joy = d > 6 ? [(dx / (Math.hypot(dx, dy) || 1)) * m, (dy / (Math.hypot(dx, dy) || 1)) * m] : [0, 0];
    };
    zone.addEventListener('pointerdown', (e) => {
      if (active !== null) return;
      active = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      cx = e.clientX - r.left;
      cy = e.clientY - r.top;
      joy.style.left = cx + 'px';
      joy.style.top = cy + 'px';
      move(cx, cy);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      const r = zone.getBoundingClientRect();
      move(e.clientX - r.left, e.clientY - r.top);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      home();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    // e.g. an overlay or the system took the touch away – never leave the stick stuck
    zone.addEventListener('lostpointercapture', end);
  }

  layout() {
    if (!this.hud) return;
    const h = window.innerHeight,
      w = window.innerWidth;
    // big screens (tablets, desktop) get a proportionally bigger HUD, like the reference
    const k = Math.max(1, Math.min(1.7, Math.min(h / 520, w / 950)));
    this.hud.style.setProperty('--hud-k', String(k));
    const sc = Math.max(0.72, Math.min(1.7, Math.min(h / 520, w / 950))) * (settings.uiScale || 1);
    const sk = $('.skills', this.hud);
    sk.style.transform = `scale(${sc})`;
    sk.style.transformOrigin = 'bottom right';
    (this as any)._joyHome?.();
  }

  tick(dt: number) {
    const sc = this.scene;
    if (!sc || !this.hud) return;
    this.tickT += dt;
    this.mapT += dt;
    if (this.tickT < 0.066) return;
    this.tickT = 0;
    const p = sc.player;
    const s = sc.save;
    const hud = this.hud;
    // bars
    const hpF = Math.max(0, p.hp / p.d.maxHp);
    ($('.bar.hp .fill', hud) as HTMLElement).style.transform = `scaleX(${hpF})`;
    ($('.bar.hp .shieldfill', hud) as HTMLElement).style.transform = `scaleX(${Math.min(1, p.shield / p.d.maxHp)})`;
    $('.bar.hp .txt', hud).textContent = `${Math.ceil(p.hp)} / ${p.d.maxHp}`;
    ($('.bar.mp .fill', hud) as HTMLElement).style.transform = `scaleX(${Math.max(0, p.mp / p.d.maxMp)})`;
    $('.bar.mp .txt', hud).textContent = `${Math.floor(p.mp)} / ${p.d.maxMp}`;
    $('.lv', hud).textContent = `LV ${s.level}`;
    ($('.bar.xp .fill', hud) as HTMLElement).style.transform = `scaleX(${Math.min(1, s.xp / xpForLevel(s.level))})`;
    $('.gold', hud).textContent = s.gold.toLocaleString('cs-CZ');
    $('.floorlbl .fl', hud).textContent = `Patro ${sc.floor} · ${sc.placeName}${sc.mod ? ' · ' + sc.mod.name : ''}`;
    // low hp vignette
    const vig = $('.vignette', hud);
    vig.classList.toggle('low', hpF < 0.3 && !p.dead);
    // badges
    const at = $('.badge.at', hud);
    at.textContent = String(s.attrPoints);
    at.classList.toggle('on', s.attrPoints > 0);
    const sp = $('.badge.sp', hud);
    const tp = freeTalentPoints(s);
    sp.textContent = String(s.spellPoints + Math.max(0, tp));
    sp.classList.toggle('on', s.spellPoints > 0 || tp > 0);
    const inv = $('.badge.inv', hud);
    const free = s.inventory.filter((x) => !x).length;
    inv.textContent = free === 0 ? 'plno' : this.newItems > 0 ? String(this.newItems) : '';
    inv.classList.toggle('on', free === 0 || this.newItems > 0);
    // potions
    $('.php .cnt', hud).textContent = String(s.mats.hpPotion);
    $('.pmp .cnt', hud).textContent = String(s.mats.mpPotion);
    // skills cooldown
    hud.querySelectorAll<HTMLElement>('.skill').forEach((b) => {
      const i = +b.dataset.i!;
      const id = s.loadout[i];
      const cdEl = $('.cd', b),
        cdt = $('.cdt', b);
      if (!id) {
        cdEl.style.background = '';
        cdt.textContent = '';
        return;
      }
      const spd = SPELL_BY_ID[id];
      const cd = p.cds[i];
      const total = sc.spells.cooldown(spd);
      if (cd > 0) {
        const pct = Math.min(1, cd / total) * 360;
        cdEl.style.background = `conic-gradient(rgba(0,0,0,.72) ${pct}deg, transparent ${pct}deg)`;
        cdt.textContent = cd >= 1 ? Math.ceil(cd).toString() : cd.toFixed(1);
        b.classList.remove('ready');
      } else {
        cdEl.style.background = '';
        cdt.textContent = '';
        b.classList.add('ready');
      }
      b.classList.toggle('nomana', p.mp < sc.spells.manaCost(spd));
    });
    // buff timers
    hud.querySelectorAll<HTMLElement>('.buff').forEach((b) => {
      const id = b.dataset.id!;
      const bf = p.buffs.find((x) => x.id === id) ?? sc.shrineBuffs.find((x) => 'shrine_' + x.id === id);
      const t = $('.bt', b);
      if (bf) t.textContent = Math.ceil(bf.t).toString();
    });
    // the mercenary
    const mc = $('.mercchip', hud);
    const merc = sc.merc;
    mc.classList.toggle('on', !!merc);
    if (merc) {
      const img = $('img', mc) as HTMLImageElement;
      const want = iconURL(merc.spriteKey, 32);
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
      ($('b', mc) as HTMLElement).style.transform = `scaleX(${merc.down ? 0 : Math.max(0, merc.hp / merc.maxHp)})`;
      mc.classList.toggle('down', merc.down);
    }
    // boss
    if (this.bossRef) {
      const b = this.bossRef;
      ($('.bossbar .fill', hud) as HTMLElement).style.transform = `scaleX(${Math.max(0, b.hp / b.maxHp)})`;
      if (b.dead) this.hideBoss();
    }
    if (this.mapT > 0.25) {
      this.mapT = 0;
      this.drawMinimap();
    }
    if (this.lastHp > p.hp + 0.5) {
      /* handled by hurtVignette */
    }
    this.lastHp = p.hp;
  }

  drawMinimap() {
    const sc = this.scene!;
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const m = sc.map;
    const W = 124,
      H = 124;
    const cell = 3;
    const p = sc.player;
    const ptx = p.x / TS,
      pty = p.y / TS;
    ctx.fillStyle = '#0a0910';
    ctx.fillRect(0, 0, W, H);
    const half = W / cell / 2;
    const x0 = Math.floor(ptx - half),
      y0 = Math.floor(pty - half);
    const offX = (ptx - half - x0) * cell,
      offY = (pty - half - y0) * cell;
    for (let y = y0; y < y0 + W / cell + 2; y++)
      for (let x = x0; x < x0 + W / cell + 2; x++) {
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        const i = m.idx(x, y);
        if (!m.explored[i]) continue;
        const t = m.d.grid[i];
        if (t === T_FLOOR) ctx.fillStyle = '#6a5a4a';
        else if (t === T_WALL) ctx.fillStyle = '#2c2a34';
        else continue;
        ctx.fillRect((x - x0) * cell - offX, (y - y0) * cell - offY, cell, cell);
      }
    const toMini = (wx: number, wy: number): [number, number] => [(wx / TS - x0) * cell - offX, (wy / TS - y0) * cell - offY];
    // explored stairs / merchant outside the minimap: arrow on the rim pointing at them
    const edgeArrow = (wx: number, wy: number, color: string) => {
      const [mx, my] = toMini(wx, wy);
      // the minimap is drawn as a circle
      if (Math.hypot(mx - W / 2, my - H / 2) < W / 2 - 6) return;
      const a = Math.atan2(my - H / 2, mx - W / 2);
      const rr = W / 2 - 7;
      ctx.save();
      ctx.translate(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr);
      ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    for (const it of sc.interactables) {
      if ((it.kind === 'stairs' || it.kind === 'merchant') && m.explored[m.idx(it.tx, it.ty)]) edgeArrow(it.x, it.y, it.kind === 'stairs' ? '#ffd23a' : '#c77dff');
    }
    // interactables
    for (const it of sc.interactables) {
      if (it.used && it.kind !== 'stairs') continue;
      if (!m.explored[m.idx(it.tx, it.ty)]) continue;
      const [mx, my] = toMini(it.x, it.y);
      if (it.kind === 'stairs') {
        ctx.fillStyle = '#ffd23a';
        ctx.fillRect(mx - 3, my - 3, 6, 6);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(mx - 3, my - 3, 6, 6);
      } else if (it.kind === 'merchant') {
        ctx.fillStyle = '#c77dff';
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'chest' || it.kind === 'mimic') {
        ctx.fillStyle = '#e9b949';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      } else if (['shrine', 'fountain', 'anvil'].includes(it.kind)) {
        ctx.fillStyle = '#7cc8ff';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      } else if (it.kind === 'cage') {
        ctx.fillStyle = '#ff9ab0';
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'alchemist') {
        ctx.fillStyle = '#7dffcf';
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'cursed') {
        ctx.fillStyle = '#7dff9a';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
      }
    }
    for (const e of sc.enemies) {
      if (e.dead) continue;
      const tx = Math.floor(e.x / TS),
        ty = Math.floor(e.y / TS);
      // a spotted treasure goblin (or nemesis) stays on the map even when it runs into the unknown
      const thief = (e.def.behavior === 'thief' || !!e.nemesis) && e.spotted;
      if (!m.explored[m.idx(tx, ty)] && !thief) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > 200 && !e.boss && !thief) continue;
      const [mx, my] = toMini(e.x, e.y);
      const big = e.boss || thief;
      ctx.fillStyle = e.boss ? '#ff3030' : e.nemesis ? '#ff5a8a' : thief ? '#ffd23a' : e.elite ? '#ffa020' : '#e04040';
      ctx.fillRect(mx - (big ? 3 : 1.5), my - (big ? 3 : 1.5), big ? 6 : 3, big ? 6 : 3);
    }
    // player arrow
    const [px, py] = toMini(p.x, p.y);
    ctx.save();
    ctx.translate(px, py);
    const mv = sc.moveVec;
    const ang = Math.hypot(mv[0], mv[1]) > 0.1 ? Math.atan2(mv[1], mv[0]) + Math.PI / 2 : p.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  bigMap() {
    const sc = this.scene;
    if (!sc || this.panel) return;
    const m = sc.map;
    const p = el(`<div class="panel" style="width:min(96vw,1000px)"><div class="head"><h2>Mapa – patro ${sc.floor}</h2><span class="hint"><b style="color:#fff">●</b> ty &nbsp; <b style="color:#ffd23a">■</b> schody &nbsp; <b style="color:#c77dff">●</b> obchodník &nbsp; <b style="color:#e9b949">■</b> truhla &nbsp; <b style="color:#7cc8ff">■</b> svatyně / fontána / kovadlina &nbsp; <b style="color:#ff9ab0">●</b> klec &nbsp; <b style="color:#7dff9a">■</b> prokletá truhla &nbsp; <b style="color:#7dffcf">●</b> alchymista &nbsp; <b style="color:#ff3030">●</b> strážce${sc.nemesis?.spotted && !sc.nemesis.dead ? ' &nbsp; <b style="color:#ff5a8a">●</b> nemesis' : ''}</span><button class="close">✕</button></div>
      <div class="body" style="align-items:center;justify-content:center"><canvas></canvas></div></div>`);
    this.showOverlay(p, () => {});
    $('.close', p).addEventListener('click', () => this.closeOverlay());
    const body = $('.body', p);
    const cv = $('canvas', p) as HTMLCanvasElement;
    const bw = body.clientWidth - 20,
      bh = body.clientHeight - 20;
    const cell = Math.max(2, Math.floor(Math.min(bw / m.w, bh / m.h)));
    cv.width = m.w * cell;
    cv.height = m.h * cell;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0a0910';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = m.idx(x, y);
        if (!m.explored[i]) continue;
        const t = m.d.grid[i];
        ctx.fillStyle = t === T_FLOOR ? '#6a5a4a' : t === T_WALL ? '#2c2a34' : '#000';
        if (t) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    const dot = (wx: number, wy: number, col: string, r: number, square = false) => {
      const x = (wx / TS) * cell,
        y = (wy / TS) * cell;
      ctx.fillStyle = col;
      if (square) ctx.fillRect(x - r, y - r, r * 2, r * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (const it of sc.interactables) {
      if (!m.explored[m.idx(it.tx, it.ty)]) continue;
      if (it.kind === 'stairs') dot(it.x, it.y, '#ffd23a', Math.max(3, cell), true);
      else if (it.used) continue;
      else if (it.kind === 'merchant') dot(it.x, it.y, '#c77dff', Math.max(3, cell));
      else if (it.kind === 'chest' || it.kind === 'mimic') dot(it.x, it.y, '#e9b949', Math.max(2, cell * 0.6), true);
      else if (['shrine', 'fountain', 'anvil'].includes(it.kind)) dot(it.x, it.y, '#7cc8ff', Math.max(2, cell * 0.6), true);
      else if (it.kind === 'cage') dot(it.x, it.y, '#ff9ab0', Math.max(3, cell * 0.8));
      else if (it.kind === 'cursed') dot(it.x, it.y, '#7dff9a', Math.max(3, cell * 0.8), true);
      else if (it.kind === 'alchemist') dot(it.x, it.y, '#7dffcf', Math.max(3, cell));
    }
    if (sc.boss && !sc.boss.dead && m.explored[m.idx(Math.floor(sc.boss.x / TS), Math.floor(sc.boss.y / TS))]) dot(sc.boss.x, sc.boss.y, '#ff3030', Math.max(4, cell * 1.2));
    const nem = sc.nemesis;
    if (nem && !nem.dead && nem.spotted) dot(nem.x, nem.y, '#ff5a8a', Math.max(4, cell * 1.1));
    dot(sc.player.x, sc.player.y, '#ffffff', Math.max(3, cell));
  }

  renderBuffs() {
    const sc = this.scene;
    if (!sc || !this.hud) return;
    const box = $('.buffs', this.hud);
    box.innerHTML = '';
    for (const b of sc.player.buffs) {
      const sp = SPELL_BY_ID[b.id];
      const icon = sp ? spellIcon(sp.icon, sp.color, 48) : spellIcon('star', '#ffffff', 48);
      box.appendChild(el(`<div class="buff" data-id="${b.id}" title="${esc(b.name)}"><img src="${icon}"><span class="bt"></span></div>`));
    }
    for (const b of sc.shrineBuffs) {
      const col = '#' + b.color.toString(16).padStart(6, '0');
      box.appendChild(el(`<div class="buff" data-id="shrine_${b.id}" title="${esc(b.name)}"><img src="${spellIcon('cross', col, 48)}"><span class="bt"></span></div>`));
    }
  }

  setAction(label: string | null) {
    if (!this.hud) return;
    const a = $('.action', this.hud);
    this.actionLabel = label;
    if (label) {
      a.innerHTML = (this.pad.active ? `<b class="pk">${this.pad.glyphs.A}</b> ` : '') + esc(label);
      a.classList.add('on');
    } else a.classList.remove('on');
  }

  toast(text: string, color = '#ffffff', item?: Item) {
    if (!this.toastBox) return;
    const icon = item ? `<img src="${iconURL(itemIcon(item), 32)}">` : '';
    const t = el(`<div class="toast" style="color:${color}">${icon}<span>${esc(text)}</span></div>`);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 4) this.toastBox.firstElementChild!.remove();
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 400);
    }, 2400);
  }

  hint(text: string, ms = 5000) {
    if (!this.hud) return;
    const h = $('.hintbox', this.hud);
    h.textContent = text;
    h.classList.add('on');
    clearTimeout((h as any)._t);
    (h as any)._t = setTimeout(() => h.classList.remove('on'), ms);
  }

  // ---------------------------------------------------------------- story
  cutsceneActive = false;

  /** plays a story scene (by id or as shots) with the game paused; remembers it as seen */
  async cutscene(idOrShots: string | Shot[], opts: CutsceneOpts = {}) {
    const shots = typeof idOrShots === 'string' ? CUTSCENE_BY_ID[idOrShots]?.shots : idOrShots;
    if (!shots?.length || this.cutsceneActive) return;
    const sc = this.scene;
    this.cutsceneActive = true;
    if (sc) {
      sc.paused = true;
      this.game.scene.pause('Game');
    }
    this.joy = [0, 0];
    try {
      await playCutscene(this.root, shots, opts);
    } finally {
      this.cutsceneActive = false;
      if (typeof idOrShots === 'string' && sc) {
        const st = storyOf(sc.save);
        if (!st.seen.includes(idOrShots)) st.seen.push(idOrShots);
        saveGame(sc.save);
      }
      if (sc && this.scene === sc && !this.panel) this.resumeGame();
    }
  }

  /** after the last guardian: the story is over, the endless depths wait below */
  storyEnd() {
    const sc = this.scene;
    if (!sc) return;
    const s = sc.save;
    const p = el(`<div class="panel small storyend"><div class="head"><h2>Příběh je u konce</h2></div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
        <p class="hint" style="font-size:18px;margin:0">Pečeť je obnovena a Pán hlubin zmizel navždy. Loppo je v bezpečí.</p>
        <div class="box" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:17px">
          <span>Úroveň</span><b>${s.level}</b>
          <span>Herní čas</span><b>${Math.floor(s.playTime / 3600)} h ${Math.floor((s.playTime % 3600) / 60)} min</b>
          <span>Poražení nepřátelé</span><b>${s.kills.toLocaleString('cs-CZ')}</b>
          <span>Poražení strážci</span><b>${s.stats?.bosses ?? 0}</b>
        </div>
        <p class="hint" style="margin:0">Pod dnem Propasti pokračuje Nekonečná hlubina – stále těžší patra a lepší kořist.</p>
        <button class="btn green" data-a="go">Pokračovat do Nekonečné hlubiny</button>
        <button class="btn" data-a="menu">Uložit a odejít do menu</button>
      </div></div>`);
    this.showOverlay(p, undefined, true, true);
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx('ui');
      if (b.dataset.a === 'go') {
        this.closeOverlay(true, true);
        this.toast('Truhly strážce a schody dolů čekají v aréně', '#ffd23a');
      } else {
        saveGame(s);
        this.closeOverlay(false, true);
        this.showMainMenu();
      }
    });
  }

  /** a short message shown above everything, menus included */
  notice(text: string, ms = 6000) {
    let n = document.querySelector<HTMLElement>('.notice');
    if (!n) {
      n = el('<div class="notice"></div>');
      document.body.appendChild(n);
    }
    const box = n;
    box.textContent = text;
    box.classList.add('on');
    clearTimeout((box as any)._t);
    (box as any)._t = setTimeout(() => box.classList.remove('on'), ms);
  }

  /** fullscreen buttons and the F key; explains it when the browser refuses */
  toggleFullscreen() {
    const leaving = fsActive();
    toggleFullscreen().then((ok) => {
      if (!ok && !leaving) this.notice(FS_HELP, 8000);
    });
  }

  banner(title: string, sub = '') {
    if (!this.hud) return;
    const b = $('.banner', this.hud);
    $('h1', b).textContent = title;
    $('p', b).textContent = sub;
    b.classList.add('on');
    clearTimeout((b as any)._t);
    (b as any)._t = setTimeout(() => b.classList.remove('on'), 2600);
  }

  levelUp(level: number) {
    if (!this.hud) return;
    const l = $('.levelup', this.hud);
    $('h2', l).textContent = `Úroveň ${level}!`;
    const { left, right, top } = this.topSlot(210);
    l.style.left = `${(left + right) / 2}px`;
    l.style.top = `${top}px`;
    l.style.maxWidth = `${Math.max(180, right - left)}px`;
    l.classList.remove('on');
    void l.offsetWidth;
    l.classList.add('on');
    clearTimeout((l as any)._t);
    (l as any)._t = setTimeout(() => l.classList.remove('on'), 2600);
  }

  /** free space at the top centre between the health bars and the buttons (on narrow phones that gap
   *  is too small, so it is just below the buttons, left of the minimap); relative to the game root */
  topSlot(need: number) {
    const root = this.root.getBoundingClientRect();
    const bars = $('.hud-status', this.hud!).getBoundingClientRect();
    const btns = $('.topbtns', this.hud!).getBoundingClientRect();
    const mini = $('.minimap', this.hud!).getBoundingClientRect();
    let left = bars.right + 8,
      right = btns.left - 8,
      top = 8;
    if (right - left < need) {
      right = mini.left - 8;
      top = btns.bottom + 6;
    }
    return { left: left - root.left, right: right - root.left, top };
  }

  /** small pickup line on the left side (items and materials picked up) */
  loot(text: string, color: string, icon: string) {
    if (!this.hud) return;
    const box = $('.lootfeed', this.hud);
    const t = el(`<div class="lootline" style="color:${color}"><img src="${icon}"><span>${esc(text)}</span></div>`);
    box.appendChild(t);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 450);
    }, 2800);
  }

  hurtVignette() {
    if (!this.hud) return;
    const v = $('.vignette', this.hud);
    v.style.opacity = '0.8';
    clearTimeout((v as any)._t);
    (v as any)._t = setTimeout(() => (v.style.opacity = ''), 160);
  }

  showBoss(b: Enemy) {
    if (!this.hud) return;
    this.bossRef = b;
    const bb = $('.bossbar', this.hud);
    // between the health bars and the buttons, or below them on narrow screens
    const { left, right, top } = this.topSlot(280);
    bb.style.left = `${(left + right) / 2}px`;
    bb.style.top = `${top}px`;
    bb.style.width = `${Math.min(420, right - left)}px`;
    const stages = b.phaseCount > 1 ? ` · fáze ${b.phase + 1}/${b.phaseCount}` : '';
    $('.name', bb).textContent = b.story ? `${b.name}, ${b.story.title}${stages}` : `${b.name} · fáze ${b.bphase + 1}/${BOSS_PHASES}`;
    bb.classList.toggle('story', !!b.story);
    bb.classList.toggle('last', b.lastStand);
    // marks on the health bar where the next phases begin
    const bar = $('.bar', bb);
    bar.querySelectorAll('.tick').forEach((t) => t.remove());
    if (b.phased)
      BOSS_PHASE_HP.forEach((f, i) => {
        const t = document.createElement('i');
        t.className = 'tick' + (i < b.bphase ? ' past' : '');
        t.style.left = `${f * 100}%`;
        bar.appendChild(t);
      });
    bb.classList.add('on');
  }

  /** a guardian entered its next phase: the bar flashes and the change is announced */
  bossPhase(b: Enemy, line: string) {
    if (!this.hud) return;
    this.showBoss(b);
    const bb = $('.bossbar', this.hud);
    bb.classList.remove('flash');
    void bb.offsetWidth;
    bb.classList.add('flash');
    this.banner(b.name, line);
  }

  /** the kill streak counter at the top (from three kills on); n = 0 hides it */
  streak(n: number, frac: number) {
    if (!this.hud) return;
    const st = $('.streak', this.hud);
    if (n < 3) {
      if (!st.classList.contains('end')) st.classList.remove('on');
      return;
    }
    if (!st.classList.contains('on') || st.classList.contains('end')) {
      clearTimeout((st as any)._t);
      st.classList.remove('end');
      const { left, right, top } = this.topSlot(170);
      const busy = $('.bossbar', this.hud).classList.contains('on') || $('.eventbar', this.hud).classList.contains('on');
      st.style.left = `${(left + right) / 2}px`;
      st.style.top = `${top + (busy ? 42 : 0)}px`;
      st.classList.add('on');
      $('span', st).textContent = 'série zabití';
    }
    const b = $('b', st);
    const txt = `×${n}`;
    if (b.textContent !== txt) {
      b.textContent = txt;
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
    }
    ($('i', st) as HTMLElement).style.transform = `scaleX(${frac})`;
  }

  /** the streak ended with a bonus: shown for a moment where the counter was */
  streakEnd(n: number, xp: number) {
    if (!this.hud) return;
    const st = $('.streak', this.hud);
    if (!st.classList.contains('on')) this.streak(n, 0);
    st.classList.add('on', 'end');
    $('b', st).textContent = `×${n}`;
    $('span', st).textContent = `+${xp.toLocaleString('cs-CZ')} zkušeností`;
    ($('i', st) as HTMLElement).style.transform = 'scaleX(0)';
    clearTimeout((st as any)._t);
    (st as any)._t = setTimeout(() => st.classList.remove('on', 'end'), 1800);
  }

  /** the optional task of the floor, under the minimap */
  bounty(b: Bounty | null) {
    if (!this.hud) return;
    const el2 = $('.floorlbl .bounty', this.hud);
    el2.classList.toggle('on', !!b);
    if (!b) return;
    const frac = Math.min(1, b.have / b.goal);
    const count = b.kind === 'explore' ? `${b.have} %` : `${b.have}/${b.goal}`;
    el2.classList.toggle('done', b.done);
    el2.innerHTML = `<div class="bt">${b.done ? '✔ Úkol splněn' : '✦ Úkol patra'}<span>${b.done ? '' : count}</span></div><div class="bx">${esc(b.text)}</div><div class="bb"><i style="width:${Math.round(frac * 100)}%"></i></div>`;
    if (b.done) {
      clearTimeout((el2 as any)._t);
      (el2 as any)._t = setTimeout(() => el2.classList.add('faded'), 6000);
    } else el2.classList.remove('faded');
  }

  /** progress of a floor event (the cursed chest) at the top of the screen */
  eventBar(text: string, frac: number) {
    if (!this.hud) return;
    const b = $('.eventbar', this.hud);
    if (!b.classList.contains('on')) {
      const { left, right, top } = this.topSlot(260);
      b.style.left = `${(left + right) / 2}px`;
      b.style.top = `${top}px`;
      b.style.width = `${Math.min(380, right - left)}px`;
    }
    b.classList.add('on');
    const n = $('.name', b);
    if (n.textContent !== text) n.textContent = text;
    ($('.fill', b) as HTMLElement).style.transform = `scaleX(${frac})`;
  }

  hideEventBar() {
    if (this.hud) $('.eventbar', this.hud).classList.remove('on');
  }

  hideBoss() {
    this.bossRef = null;
    if (this.hud) $('.bossbar', this.hud).classList.remove('on');
  }

  // ---------------------------------------------------------------- panels
  pauseGame() {
    const sc = this.scene;
    if (sc) {
      sc.paused = true;
      this.game.scene.pause('Game');
    }
    this.joy = [0, 0];
  }

  resumeGame() {
    const sc = this.scene;
    if (sc && !this.cutsceneActive) {
      sc.paused = false;
      this.game.scene.resume('Game');
      saveGame(sc.save);
    }
  }

  // a locked overlay (death screen) can only be closed by its own buttons
  private panelLocked = false;

  showOverlay(content: HTMLElement, onClose?: () => void, pause = true, locked = false) {
    this.closeOverlay(false, true);
    this.panelLocked = locked;
    const ov = el('<div class="overlay"></div>');
    ov.appendChild(content);
    ov.addEventListener('pointerdown', (e) => {
      if (e.target === ov && onClose !== undefined) {
        this.closeOverlay();
        onClose?.();
      }
    });
    this.root.appendChild(ov);
    this.panel = ov;
    if (pause) this.pauseGame();
    return ov;
  }

  closeOverlay(resume = true, force = false) {
    if (this.panel) {
      if (this.panelLocked && !force) return;
      this.panelLocked = false;
      this.panel.remove();
      this.panel = null;
      if (resume) this.resumeGame();
      this.refreshSkills();
    }
  }

  openPanel(name: string) {
    if (!this.scene || this.scene.player.dead) return;
    if (this.panel) {
      this.closeOverlay();
      return;
    }
    this.panels.open(name);
  }

  openMerchant(stock: MerchantStock) {
    this.panels.merchant(stock);
  }

  openForge() {
    this.panels.forge();
  }

  togglePause() {
    if (!this.scene) return;
    if (this.panel) {
      this.closeOverlay();
      return;
    }
    this.menus.pause();
  }

  /** a dialog over the open panel (which comes back when the dialog closes); returns the close function */
  dialog(content: HTMLElement): () => void {
    const prev = this.panel;
    if (prev) prev.style.display = 'none';
    const ov = el('<div class="overlay" style="z-index:70"></div>');
    ov.appendChild(content);
    this.root.appendChild(ov);
    if (!prev) this.pauseGame();
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      ov.remove();
      if (prev) prev.style.display = '';
      else this.resumeGame();
    };
  }

  confirm(title: string, text: string, yes: () => void, yesLabel = 'Ano', noLabel = 'Ne', no?: () => void) {
    const p = el(`<div class="panel small"><div class="head"><h2>${esc(title)}</h2></div>
      <div style="padding:14px"><p class="hint" style="font-size:19px;margin:0 0 14px">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn red" data-a="no">${esc(noLabel)}</button><button class="btn green" data-a="yes">${esc(yesLabel)}</button></div></div></div>`);
    const wasOpen = !!this.panel;
    const prev = this.panel;
    if (wasOpen) prev!.style.display = 'none';
    const ov = el('<div class="overlay" style="z-index:70"></div>');
    ov.appendChild(p);
    this.root.appendChild(ov);
    if (!wasOpen) this.pauseGame();
    const done = (ok: boolean) => {
      ov.remove();
      if (wasOpen) prev!.style.display = '';
      else this.resumeGame();
      if (ok) yes();
      else no?.();
    };
    $('[data-a=yes]', p).addEventListener('click', () => done(true));
    $('[data-a=no]', p).addEventListener('click', () => done(false));
  }

  lockpick(floor: number, cb: (ok: boolean, consumed: boolean) => void) {
    this.panels.lockpick(floor, cb);
  }

  death(floor: number, lostGold: number) {
    if (this.scene?.save.hardcore) this.menus.hardcoreDeath(floor);
    else this.menus.death(floor, lostGold);
  }

  /** straight to the class choice of a new hero in a slot (after a hardcore death) */
  newHero(slot: number) {
    this.clearAll();
    const sm = this.game.scene;
    if (sm.isActive('Game') || sm.isPaused('Game')) sm.stop('Game');
    if (!sm.isActive('Menu')) sm.start('Menu');
    setActiveSlot(slot);
    this.menus.classSelect();
  }
}

// leather backpack (like the reference HUD), 24 px pixel art shown at 48 px
function bagIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const x = c.getContext('2d')!;
  const R = (col: string, a: number, b: number, w: number, h: number) => {
    x.fillStyle = col;
    x.fillRect(a, b, w, h);
  };
  const OUT = '#1e120a';
  // carrying loop
  R(OUT, 9, 1, 6, 1);
  R(OUT, 8, 2, 1, 3);
  R(OUT, 15, 2, 1, 3);
  R('#6e4220', 9, 2, 6, 1);
  // side pockets
  R(OUT, 2, 11, 4, 9);
  R(OUT, 18, 11, 4, 9);
  R('#7a4a22', 3, 12, 2, 7);
  R('#7a4a22', 19, 12, 2, 7);
  // body
  R(OUT, 4, 5, 16, 18);
  R(OUT, 5, 4, 14, 1);
  R('#8a5a2b', 5, 5, 14, 17);
  R('#a8743c', 5, 5, 14, 2);
  R('#a8743c', 5, 5, 2, 15);
  R('#6a4020', 5, 19, 14, 3);
  // flap
  R(OUT, 4, 5, 16, 9);
  R('#74461f', 5, 6, 14, 7);
  R('#94602e', 5, 6, 14, 1);
  R(OUT, 6, 13, 12, 1);
  // strap with a brass buckle
  R(OUT, 11, 9, 2, 10);
  R('#4a2c12', 11, 9, 2, 10);
  R(OUT, 10, 13, 4, 4);
  R('#e9b949', 10, 13, 4, 4);
  R('#8a6418', 11, 14, 2, 2);
  R('#fff2a8', 10, 13, 1, 1);
  // stitching
  x.fillStyle = '#c89a5a';
  for (let i = 6; i < 18; i += 2) x.fillRect(i, 21, 1, 1);
  const big = document.createElement('canvas');
  big.width = big.height = 48;
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, 48, 48);
  return big.toDataURL();
}

export const UI = new UIManager();
