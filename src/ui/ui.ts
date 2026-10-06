import Phaser from 'phaser';
import type { GameScene, MerchantStock } from '../scenes/GameScene';
import type { Enemy } from '../game/entities';
import { iconURL, spellIcon } from '../gfx/textures';
import { SPELL_BY_ID } from '../data/spells';
import { Item } from '../data/types';
import { itemIcon } from '../data/items';
import { xpForLevel, game as G, saveGame } from '../systems/state';
import { bus } from '../systems/events';
import { sfx, unlockAudio } from '../systems/audio';
import { Panels } from './panels';
import { Menus } from './menus';
import { TS } from '../game/map';
import { T_FLOOR, T_WALL } from '../systems/dungeon';

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
  hud: HTMLElement | null = null;
  panel: HTMLElement | null = null;
  panels = new Panels(this);
  menus = new Menus(this);
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
    bus.on('buffs', () => this.renderBuffs());
    bus.on('equip', () => this.refreshSkills());
    document.addEventListener('pointerdown', () => unlockAudio(), { once: true });
    window.addEventListener('resize', () => this.layout());
    // prevent context menu / double-tap zoom
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------- flow
  showMainMenu() {
    this.clearAll();
    if (this.game.scene.isActive('Game')) this.game.scene.stop('Game');
    this.menus.main();
  }

  startGame() {
    this.clearAll();
    const save = G.save!;
    if (this.game.scene.isActive('Game') || this.game.scene.isPaused('Game')) this.game.scene.stop('Game');
    this.game.scene.start('Game', { save });
    try {
      if (!document.fullscreenElement && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
        document.documentElement.requestFullscreen?.().then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  clearAll() {
    this.root.innerHTML = '';
    this.hud = null;
    this.panel = null;
    this.scene = null;
  }

  attachGame(scene: GameScene) {
    this.scene = scene;
    this.root.innerHTML = '';
    this.panel = null;
    this.buildHud();
    this.refreshSkills();
    this.renderBuffs();
    this.layout();
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const s = this.scene!.save;
    const hud = el(`<div class="passthrough" style="position:absolute;inset:0">
      <div class="vignette"></div>
      <div class="joyzone"><div class="joy"><span class="arr u"></span><span class="arr d"></span><span class="arr l"></span><span class="arr r"></span><div class="knob"></div></div></div>
      <div class="hud-status">
        <div class="portrait"><img class="px" src="${iconURL('pl_' + s.cls, 64)}"></div>
        <div class="bars">
          <div class="bar hp"><div class="fill"></div><div class="fill shieldfill" style="background:rgba(160,210,255,.55);transform:scaleX(0)"></div><div class="txt"></div></div>
          <div class="bar mp"><div class="fill"></div><div class="txt"></div></div>
          <div class="xprow"><span class="lv">LV 1</span><div class="bar xp"><div class="fill"></div></div></div>
          <div class="meta"><span><img src="${iconURL('ic_gold', 24)}"> <b class="gold">0</b></span><span class="kills"></span></div>
          <div class="buffs"></div>
        </div>
      </div>
      <div class="minimap"><canvas width="124" height="124"></canvas></div>
      <div class="floorlbl"></div>
      <div class="topbtns">
        <div class="rbtn" data-a="spells" title="Kouzla (K)">✦<span class="badge sp"></span></div>
        <div class="rbtn" data-a="character" title="Postava (C)">☗<span class="badge at"></span></div>
        <div class="rbtn" data-a="pause" title="Menu (Esc)">☰</div>
      </div>
      <div class="bossbar"><div class="name"></div><div class="bar hp"><div class="fill"></div></div></div>
      <div class="toasts"></div>
      <div class="banner"><h1></h1><p></p></div>
      <div class="levelup"><h2></h2><p>+3 body atributů • +1 bod kouzel</p></div>
      <div class="skills"></div>
      <div class="action"></div>
    </div>`);
    this.root.appendChild(hud);
    this.hud = hud;
    this.toastBox = $('.toasts', hud);
    this.minimapCtx = ($('.minimap canvas', hud) as HTMLCanvasElement).getContext('2d');
    hud.querySelectorAll<HTMLElement>('.topbtns .rbtn').forEach((b) => {
      b.style.pointerEvents = 'auto';
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        sfx('ui');
        const a = b.dataset.a!;
        if (a === 'pause') this.togglePause();
        else this.openPanel(a);
      });
    });
    $('.topbtns', hud).style.pointerEvents = 'auto';
    const act = $('.action', hud);
    act.style.pointerEvents = 'auto';
    act.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.scene?.doAction();
    });
    this.buildSkills();
    this.setupJoystick();
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
    });
    const portrait = $('.portrait img', this.hud) as HTMLImageElement;
    portrait.src = iconURL('pl_' + s.cls, 64);
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
      const sc = Math.max(0.7, Math.min(1, h / 520));
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
  }

  layout() {
    if (!this.hud) return;
    const h = window.innerHeight,
      w = window.innerWidth;
    const sc = Math.max(0.6, Math.min(1, Math.min(h / 560, w / 1000)));
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
    $('.floorlbl', hud).textContent = `Patro ${sc.floor}`;
    // low hp vignette
    const vig = $('.vignette', hud);
    vig.classList.toggle('low', hpF < 0.3 && !p.dead);
    // badges
    const at = $('.badge.at', hud);
    at.textContent = String(s.attrPoints);
    at.classList.toggle('on', s.attrPoints > 0);
    const sp = $('.badge.sp', hud);
    sp.textContent = String(s.spellPoints);
    sp.classList.toggle('on', s.spellPoints > 0);
    const inv = $('.badge.inv', hud);
    const free = s.inventory.filter((x) => !x).length;
    inv.textContent = free === 0 ? '!' : '';
    inv.classList.toggle('on', free === 0);
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
      }
    }
    for (const e of sc.enemies) {
      if (e.dead) continue;
      const tx = Math.floor(e.x / TS),
        ty = Math.floor(e.y / TS);
      if (!m.explored[m.idx(tx, ty)]) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > 200 && !e.boss) continue;
      const [mx, my] = toMini(e.x, e.y);
      ctx.fillStyle = e.boss ? '#ff3030' : e.elite ? '#ffa020' : '#e04040';
      ctx.fillRect(mx - (e.boss ? 3 : 1.5), my - (e.boss ? 3 : 1.5), e.boss ? 6 : 3, e.boss ? 6 : 3);
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
      a.textContent = label;
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
    $('h2', l).textContent = `ÚROVEŇ ${level}!`;
    l.classList.add('on');
    clearTimeout((l as any)._t);
    (l as any)._t = setTimeout(() => l.classList.remove('on'), 2200);
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
    $('.name', bb).textContent = b.name;
    bb.classList.add('on');
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
    if (sc) {
      sc.paused = false;
      this.game.scene.resume('Game');
      saveGame(sc.save);
    }
  }

  showOverlay(content: HTMLElement, onClose?: () => void, pause = true) {
    this.closeOverlay(false);
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

  closeOverlay(resume = true) {
    if (this.panel) {
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

  confirm(title: string, text: string, yes: () => void, yesLabel = 'Ano', noLabel = 'Ne') {
    const p = el(`<div class="panel small"><div class="head"><h2>${esc(title)}</h2></div>
      <div style="padding:14px"><p class="hint" style="font-size:15px;margin:0 0 14px">${esc(text)}</p>
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
    };
    $('[data-a=yes]', p).addEventListener('click', () => done(true));
    $('[data-a=no]', p).addEventListener('click', () => done(false));
  }

  lockpick(floor: number, cb: (ok: boolean, consumed: boolean) => void) {
    this.panels.lockpick(floor, cb);
  }

  death(floor: number, lostGold: number) {
    this.menus.death(floor, lostGold);
  }
}

function bagIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const x = c.getContext('2d')!;
  x.fillStyle = '#5a3416';
  x.fillRect(4, 7, 16, 14);
  x.fillStyle = '#8a5a2b';
  x.fillRect(5, 8, 14, 12);
  x.fillStyle = '#a87a4a';
  x.fillRect(5, 8, 14, 4);
  x.fillStyle = '#5a3416';
  x.fillRect(8, 3, 8, 5);
  x.fillStyle = '#0000';
  x.clearRect(10, 4, 4, 3);
  x.fillStyle = '#e9b949';
  x.fillRect(11, 11, 2, 3);
  x.fillStyle = '#16121c';
  x.strokeStyle = '#16121c';
  x.strokeRect(3.5, 6.5, 17, 15);
  const big = document.createElement('canvas');
  big.width = big.height = 48;
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, 48, 48);
  return big.toDataURL();
}

export const UI = new UIManager();
