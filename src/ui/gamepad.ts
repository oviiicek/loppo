// Controller (gamepad) support. In the dungeon the left stick walks, the face buttons cast, the shoulder
// buttons and triggers drink potions and fire the strongest spells. In menus, panels and dialogs the
// D-pad (or the stick) moves a highlight between the buttons, A presses it, B goes back, LB/RB switch
// tabs and the right stick scrolls long texts. Any controller the browser maps to the standard layout
// works (Xbox, PlayStation, Switch Pro and most generic pads).
import type { UI as UIType } from './ui';
import { rumbleHook, sfx, unlockAudio } from '../systems/audio';

type UIM = typeof UIType;
type Dir = 'up' | 'down' | 'left' | 'right';

// standard mapping
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

/** controller buttons as the HUD shows them */
export const PAD_GLYPHS = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: 'Start', BACK: 'Back' },
  ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', START: 'Options', BACK: 'Share' },
};
export type PadGlyphs = (typeof PAD_GLYPHS)['xbox'];

// what the highlight can land on in menus and panels
const FOCUSABLE = 'button:not(:disabled), .slot, .ccard, .dcard, .spcard, .lslot, summary, textarea';
// where the highlight starts in a newly opened menu (first match wins); a question starts on its safe
// answer, so pressing A twice never sells or destroys something by accident
const FIRST = ['[data-a="no"]', '.slot.inv', '.slot.shop', '.ccard.sel', '.dcard.sel', '.spcard.sel', '.spcard:not(.locked)', '.btn.green', '.slot', 'button'];

function visible(el: HTMLElement) {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

/** a click as a finger would make it (some controls react to pointer events) */
function tap(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}

export class Pad {
  ui: UIM;
  /** left stick while playing (added to the movement input) */
  move: [number, number] = [0, 0];
  /** the controller is what the player uses right now (highlight and button hints on) */
  active = false;
  /** PlayStation pad: show its symbols */
  ps = false;
  private index = -1;
  private prev: boolean[] = [];
  private held: Dir | null = null;
  private heldT = 0;
  private focus: HTMLElement | null = null;
  private focusSig = '';
  private layerEl: HTMLElement | null = null;
  /** where the highlight was in a panel that a dialog now covers (it comes back there) */
  private memo = new WeakMap<HTMLElement, string>();
  private last = 0;

  constructor(ui: UIM) {
    this.ui = ui;
  }

  get glyphs(): PadGlyphs {
    return this.ps ? PAD_GLYPHS.ps : PAD_GLYPHS.xbox;
  }

  start() {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    window.addEventListener('gamepadconnected', (e) => {
      this.index = (e as GamepadEvent).gamepad.index;
      this.ps = /054c|sony|playstation|dualshock|dualsense/i.test((e as GamepadEvent).gamepad.id);
      this.ui.notice(`🎮 Ovladač připojen (${this.glyphs.A} potvrdit, ${this.glyphs.B} zpět). Rozložení tlačítek je v Jak hrát.`, 4500);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if ((e as GamepadEvent).gamepad.index === this.index) this.index = -1;
      this.move = [0, 0];
      this.setActive(false);
      this.ui.notice('🎮 Ovladač odpojen', 2500);
    });
    // a finger, the mouse or the keyboard take over again
    const off = (e: Event) => {
      if (e.isTrusted) this.setActive(false);
    };
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', off, true);
    rumbleHook.fn = (ms) => this.rumble(ms);
    const loop = (t: number) => {
      try {
        this.poll(t);
      } catch {
        /* never let a controller quirk stop the loop */
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private pad(): Gamepad | null {
    let list: (Gamepad | null)[] = [];
    try {
      list = navigator.getGamepads?.() ?? [];
    } catch {
      return null;
    }
    const cur = this.index >= 0 ? list[this.index] : null;
    if (cur && cur.connected) return cur;
    for (const g of list)
      if (g && g.connected) {
        this.index = g.index;
        return g;
      }
    return null;
  }

  private poll(t: number) {
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0.016;
    this.last = t;
    const gp = this.pad();
    if (!gp) {
      this.move = [0, 0];
      return;
    }
    const pressed = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    const down = (i: number) => !!pressed[i] && !this.prev[i];
    const lx = gp.axes[0] ?? 0,
      ly = gp.axes[1] ?? 0,
      ry = gp.axes[3] ?? 0;
    if (pressed.some(Boolean) || Math.hypot(lx, ly) > 0.4 || Math.abs(ry) > 0.4) {
      if (!this.active) {
        this.ps = /054c|sony|playstation|dualshock|dualsense/i.test(gp.id);
        unlockAudio();
      }
      this.setActive(true);
    }
    const layer = this.layer();
    if (layer) {
      this.move = [0, 0];
      this.menuInput(layer, pressed, down, lx, ly, ry, dt);
    } else {
      this.layerEl = null;
      this.gameInput(down, lx, ly);
    }
    this.prev = pressed;
  }

  // ---------------------------------------------------------------- playing
  private gameInput(down: (i: number) => boolean, lx: number, ly: number) {
    // round dead zone, full speed towards the rim
    const m = Math.hypot(lx, ly);
    const k = m < 0.2 ? 0 : Math.min(1, (m - 0.2) / 0.65) / m;
    this.move = [lx * k, ly * k];
    const ui = this.ui;
    const sc = ui.scene;
    if (!sc || !ui.hud) return;
    if (down(BTN.START)) return ui.togglePause();
    if (down(BTN.BACK) || down(BTN.RIGHT)) return ui.openPanel('inventory');
    if (down(BTN.UP)) return ui.openPanel('character');
    if (down(BTN.LEFT)) return ui.openPanel('spells');
    if (down(BTN.DOWN)) return ui.bigMap();
    if (down(BTN.A)) sc.doAction();
    if (down(BTN.X)) sc.castSlot(0);
    if (down(BTN.Y)) sc.castSlot(1);
    if (down(BTN.B)) sc.castSlot(2);
    if (down(BTN.RT)) sc.castSlot(3);
    if (down(BTN.RB)) sc.castSlot(4);
    if (down(BTN.LB)) sc.usePotion('hpPotion');
    if (down(BTN.LT)) sc.usePotion('mpPotion');
  }

  // ---------------------------------------------------------------- menus
  /** the topmost thing on screen that takes input (story scene, title card, dialog, panel or menu) */
  private layer(): HTMLElement | null {
    const root = this.ui.root;
    if (!root) return null;
    const cs = root.querySelector<HTMLElement>('.cutscene:not(.out)');
    if (cs) return cs;
    const fc = root.querySelector<HTMLElement>('.floorcard:not(.out)');
    if (fc) return fc;
    let best: HTMLElement | null = null,
      bz = -1;
    root.querySelectorAll<HTMLElement>('.overlay').forEach((o) => {
      if (!visible(o)) return;
      const z = parseInt(getComputedStyle(o).zIndex, 10) || 0;
      if (z >= bz) {
        bz = z;
        best = o;
      }
    });
    if (best) return best;
    const menu = root.querySelector<HTMLElement>('.menu');
    return menu && visible(menu) ? menu : null;
  }

  private menuInput(layer: HTMLElement, pressed: boolean[], down: (i: number) => boolean, lx: number, ly: number, ry: number, dt: number) {
    // story scenes: A goes on, B or Start skips
    if (layer.classList.contains('cutscene')) {
      if (down(BTN.A)) tap(layer.querySelector('.cs-box') ?? layer);
      else if (down(BTN.B) || down(BTN.START)) {
        const skip = layer.querySelector('.cs-skip');
        if (skip) tap(skip);
      }
      return;
    }
    // the title card of a floor: any button shortens it
    if (layer.classList.contains('floorcard')) {
      if (down(BTN.A) || down(BTN.B)) layer.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return;
    }
    if (layer !== this.layerEl) {
      if (this.layerEl && this.focusSig) this.memo.set(this.layerEl, this.focusSig);
      this.layerEl = layer;
      this.setFocus(null);
      this.focusSig = this.memo.get(layer) ?? '';
      // a direction still held from opening it (D-pad ← opens the spells) does not move the highlight yet
      this.held = this.dir(pressed, lx, ly);
      this.heldT = 0.36;
    }
    // keep the highlight when the panel redraws itself (find the same button or slot again)
    if (!this.focus || !layer.contains(this.focus) || !visible(this.focus)) {
      const cands = this.focusables(layer);
      this.setFocus(this.same(cands) ?? this.first(cands), true);
    }
    const dir = this.dir(pressed, lx, ly);
    if (dir) {
      if (dir !== this.held) {
        this.held = dir;
        this.heldT = 0.36;
        this.step(dir, layer);
      } else if ((this.heldT -= dt) <= 0) {
        this.heldT = 0.1;
        this.step(dir, layer);
      }
    } else this.held = null;
    if (down(BTN.A) && this.focus) this.focus.click();
    else if (down(BTN.B) || down(BTN.BACK)) this.back(layer);
    else if (down(BTN.START)) {
      if (this.ui.scene && this.ui.panel) this.ui.togglePause();
      else this.back(layer);
    } else if (down(BTN.LB) || down(BTN.RB)) this.tab(layer, down(BTN.RB) ? 1 : -1);
    // right stick scrolls long texts (the item detail first)
    if (Math.abs(ry) > 0.2) {
      const box = this.scroller(layer);
      if (box) box.scrollTop += ry * 700 * dt;
    }
  }

  private focusables(layer: HTMLElement) {
    // close buttons and tabs stay out of the way: B closes and LB/RB switch tabs, so the highlight
    // never lands on ✕ by accident and moving up from the content does not end in the tab bar
    return [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.classList.contains('close') && !el.classList.contains('tab') && visible(el) && !el.closest('[hidden]'));
  }

  private first(cands: HTMLElement[]) {
    for (const sel of FIRST) {
      const el = cands.find((c) => c.matches(sel));
      if (el) return el;
    }
    return cands[0] ?? null;
  }

  /** what an element is, independent of the DOM node (panels redraw by replacing their HTML) */
  private signature(el: HTMLElement) {
    const data = Object.entries(el.dataset)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    const cls = [...el.classList].filter((c) => !['padfocus', 'sel', 'on', 'best'].includes(c)).join('.');
    return `${el.tagName}.${cls}|${data}|${data ? '' : (el.textContent ?? '').trim().slice(0, 24)}`;
  }

  private same(cands: HTMLElement[]) {
    return this.focusSig ? cands.find((c) => this.signature(c) === this.focusSig) ?? null : null;
  }

  private setFocus(el: HTMLElement | null, quiet = false) {
    if (this.focus === el) return;
    this.focus?.classList.remove('padfocus');
    this.focus = el;
    if (!el) return;
    this.focusSig = this.signature(el);
    if (this.active) el.classList.add('padfocus');
    if (!quiet) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private dir(p: boolean[], lx: number, ly: number): Dir | null {
    if (p[BTN.UP]) return 'up';
    if (p[BTN.DOWN]) return 'down';
    if (p[BTN.LEFT]) return 'left';
    if (p[BTN.RIGHT]) return 'right';
    if (Math.hypot(lx, ly) < 0.55) return null;
    return Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'right' : 'left') : ly > 0 ? 'down' : 'up';
  }

  /** the nearest control in a direction, looked for in the closest box, list or row around the highlight
   *  first and then in wider ones (the bottom of the bag goes to the buttons under it, not to a slot of
   *  the equipment next to it) */
  private step(dir: Dir, layer: HTMLElement) {
    const cands = this.focusables(layer);
    const cur = this.focus;
    if (!cur) return this.setFocus(this.first(cands));
    const a = cur.getBoundingClientRect();
    const rects = cands.filter((c) => c !== cur).map((c) => [c, c.getBoundingClientRect()] as const);
    for (let g = cur.parentElement; g; g = g === layer ? null : g.parentElement) {
      const best = this.nearest(dir, a, rects.filter(([c]) => g!.contains(c)));
      if (best) {
        this.setFocus(best);
        sfx('ui');
        return;
      }
    }
  }

  private nearest(dir: Dir, a: DOMRect, cands: (readonly [HTMLElement, DOMRect])[]) {
    const horiz = dir === 'left' || dir === 'right';
    let best: HTMLElement | null = null,
      bs = Infinity;
    for (const [el, b] of cands) {
      // only what lies past the highlighted control's edge (a few pixels of overlap are fine), so at the
      // edge of a grid the highlight stays instead of jumping to a button that is merely lower down
      const main = dir === 'right' ? b.left - a.right : dir === 'left' ? a.left - b.right : dir === 'down' ? b.top - a.bottom : a.top - b.bottom;
      if (main < -6) continue;
      // gap across the direction: 0 in the same row or column
      const cross = horiz ? Math.max(0, b.top - a.bottom, a.top - b.bottom) : Math.max(0, b.left - a.right, a.left - b.right);
      // aligned edges break ties: the slot straight below, and under a wide button the first one of a row
      const off = horiz ? Math.abs(b.top - a.top) : Math.abs(b.left - a.left);
      const score = Math.max(0, main) + cross * 4 + off * 0.1;
      if (score < bs) {
        bs = score;
        best = el;
      }
    }
    return best;
  }

  private back(layer: HTMLElement) {
    const close = [...layer.querySelectorAll<HTMLElement>('.close, [data-a="no"]')].find(visible);
    if (close) close.click();
    else if (this.ui.scene && this.ui.panel) this.ui.closeOverlay();
  }

  private tab(layer: HTMLElement, d: number) {
    const tabs = [...layer.querySelectorAll<HTMLElement>('.tab')].filter(visible);
    if (tabs.length < 2) return;
    const i = Math.max(0, tabs.findIndex((t) => t.classList.contains('on')));
    tabs[(i + d + tabs.length) % tabs.length].click();
  }

  private scroller(layer: HTMLElement): HTMLElement | null {
    const scrolls = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY);
    const detail = layer.querySelector<HTMLElement>('.detail');
    if (scrolls(detail)) return detail;
    for (let el = this.focus; el && el !== layer; el = el.parentElement) if (scrolls(el)) return el;
    return [...layer.querySelectorAll<HTMLElement>('.scroll, .body')].find(scrolls) ?? null;
  }

  // ---------------------------------------------------------------- feedback
  private setActive(on: boolean) {
    if (this.active === on) return;
    this.active = on;
    document.body.classList.toggle('pad', on);
    // LB / RB beside the tab bars
    document.body.style.setProperty('--pad-lb', JSON.stringify(this.glyphs.LB));
    document.body.style.setProperty('--pad-rb', JSON.stringify(this.glyphs.RB));
    if (on) this.focus?.classList.add('padfocus');
    else this.focus?.classList.remove('padfocus');
    this.ui.padHints();
  }

  /** a short shake of the controller when the hero is hit */
  private rumble(ms: number) {
    if (!this.active) return;
    const act = (this.pad() as any)?.vibrationActuator;
    try {
      act?.playEffect?.('dual-rumble', { duration: Math.max(80, ms * 4), strongMagnitude: 0.45, weakMagnitude: 0.3 })?.catch?.(() => {});
    } catch {
      /* not supported */
    }
  }
}
