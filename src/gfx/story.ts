// Pixel-art illustrations and portraits for the story cutscenes. Everything is painted procedurally
// at a low resolution (240x135 scenes, 40x40 portraits) and shown enlarged with crisp pixels.
import type { SceneId, SpeakerId } from '../data/story';
import { canvas, rect, px, line, shade, hash } from './pixel';

export const ART_W = 240;
export const ART_H = 135;
const W = ART_W,
  H = ART_H;

type Ctx = CanvasRenderingContext2D;

// ------------------------------------------------------------------ primitives (all hard-edged)
function fillPoly(ctx: Ctx, pts: number[][], col: string, h = H) {
  ctx.fillStyle = col;
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys))),
    y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i],
        [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - 0.5),
        xb = Math.floor(xs[k + 1] - 0.5);
      if (xb >= xa) ctx.fillRect(xa, y, xb - xa + 1, 1);
    }
  }
}

function pell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
}

function ring(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, step = 1) {
  const n = Math.ceil(Math.PI * (rx + ry) * 1.2);
  for (let i = 0; i < n; i += step) {
    const a = (i / n) * Math.PI * 2;
    px(ctx, Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), col);
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** vertical gradient through the given colours, ordered-dithered like old pixel art */
function dgrad(ctx: Ctx, x: number, y: number, w: number, h: number, cols: string[]) {
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * (cols.length - 1);
    const a = Math.min(cols.length - 2, Math.floor(t));
    const f = t - a;
    for (let i = 0; i < w; i++) {
      const th = (BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] + 0.5) / 16;
      ctx.fillStyle = f > th ? cols[a + 1] : cols[a];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/** soft round light (added on top of what is painted); 'dark' mode deepens the shadow instead */
function glow(ctx: Ctx, cx: number, cy: number, r: number, col: string, strength = 0.6, mode: 'light' | 'dark' = 'light') {
  const n = parseInt(col.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${rgb},${Math.min(1, strength * 0.8)})`);
  g.addColorStop(0.45, `rgba(${rgb},${Math.min(1, strength * 0.35)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = mode === 'light' ? 'lighter' : 'source-over';
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** jagged mountain range: linear segments between random peaks, filled down to the bottom */
function range(ctx: Ctx, base: number, amp: number, seed: number, col: string, peaks = 7, snow?: string) {
  const pts: number[][] = [[0, H]];
  const n = peaks * 2;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W + (hash(i, seed, 1) - 0.5) * (W / n) * 0.8;
    const up = i % 2 === 0;
    const y = base - (up ? amp * (0.55 + hash(seed, i, 2) * 0.45) : amp * hash(i, seed, 3) * 0.35);
    pts.push([x, y]);
  }
  pts.push([W, H]);
  fillPoly(ctx, pts, col);
  if (snow)
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      if (pts[i - 1][1] > y && pts[i + 1][1] > y && base - y > amp * 0.6) fillPoly(ctx, [[x, y], [x - 4, y + 5], [x - 1, y + 4], [x + 2, y + 6], [x + 4, y + 4]], snow);
    }
}

function stars(ctx: Ctx, n: number, maxY: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, seed, 4) * W),
      y = Math.floor(hash(seed, i, 5) * maxY);
    const b = hash(i, i, seed);
    px(ctx, x, y, b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8d0f0' : '#7a84b0');
  }
}

function pine(ctx: Ctx, x: number, ground: number, h: number, col: string) {
  for (let k = 0; k < 3; k++) {
    const top = ground - h + k * (h / 4);
    const wd = (h / 4) * (1 + k * 0.5);
    fillPoly(ctx, [[x, top], [x - wd, top + h / 2.4], [x + wd, top + h / 2.4]], col);
  }
  rect(ctx, x - 1, ground - h / 6, 2, h / 6, col);
}

function house(ctx: Ctx, x: number, ground: number, w: number, h: number, body: string, roof: string, lit: string | null, seed: number) {
  rect(ctx, x, ground - h, w, h, body);
  fillPoly(ctx, [[x - 3, ground - h + 1], [x + w / 2, ground - h - w * 0.55], [x + w + 3, ground - h + 1]], roof);
  rect(ctx, x + w - 6, ground - h - w * 0.5, 3, 7, roof);
  const nWin = Math.max(1, Math.floor(w / 9));
  for (let i = 0; i < nWin; i++) {
    const wx = x + 3 + i * Math.floor((w - 6) / nWin);
    const on = lit && hash(seed, i, 6) > 0.25;
    rect(ctx, wx, ground - h + 4, 3, 3, on ? lit! : shade(body, -0.3));
    if (on) px(ctx, wx + 1, ground - h + 7, shade(lit!, -0.35));
  }
  rect(ctx, x + Math.floor(w / 2) - 1, ground - 5, 3, 5, shade(body, -0.35));
}

function torch(ctx: Ctx, x: number, y: number) {
  glow(ctx, x, y - 3, 16, '#ffb050', 0.35);
  rect(ctx, x - 1, y, 2, 6, '#5a3416');
  pell(ctx, x, y - 2, 2.2, 3.4, '#ff6a1a');
  pell(ctx, x, y - 1, 1.3, 2, '#ffd23a');
  px(ctx, x, y - 1, '#fff6d0');
}

function crystal(ctx: Ctx, x: number, base: number, h: number, w: number, col: string, hi: string) {
  fillPoly(ctx, [[x - w, base], [x, base - h], [x + w, base]], col);
  line(ctx, x, base - h + 1, x, base - 1, hi);
}

function mushroom(ctx: Ctx, x: number, ground: number, s: number, cap: string, glowCol: string) {
  glow(ctx, x, ground - s * 2, s * 5, glowCol, 0.35);
  rect(ctx, x, ground - s * 2, Math.max(1, Math.round(s / 2)), s * 2, '#d8d0bc');
  pell(ctx, x + s / 4, ground - s * 2, s * 1.4, s * 0.8, cap);
  px(ctx, Math.round(x - s / 3), Math.round(ground - s * 2.2), '#d8fff6');
}

// ------------------------------------------------------------------ scenes
function village(ctx: Ctx, mood: 'night' | 'danger' | 'dawn') {
  const danger = mood === 'danger',
    dawn = mood === 'dawn';
  dgrad(
    ctx,
    0,
    0,
    W,
    96,
    dawn ? ['#22305e', '#4a4a86', '#b06a8a', '#f09a6a', '#ffd08a'] : danger ? ['#07040e', '#1a0812', '#43101a', '#7a2416'] : ['#05080f', '#0b1230', '#18224e', '#283062'],
  );
  if (!dawn) stars(ctx, danger ? 40 : 90, danger ? 50 : 75, 11);
  // moon / sun
  if (dawn) {
    glow(ctx, 150, 58, 44, '#ffe0a0', 0.6);
    pell(ctx, 150, 60, 12, 12, '#fff0b8');
    pell(ctx, 150, 60, 9, 9, '#fffadc');
  } else {
    glow(ctx, 196, 26, 22, danger ? '#5a1a1a' : '#2c3a70', 0.55);
    pell(ctx, 196, 26, 11, 11, danger ? '#e8a090' : '#f2ecc4');
    pell(ctx, 192, 23, 2.5, 2, danger ? '#c88070' : '#d8d0a4');
    pell(ctx, 199, 30, 3, 2.2, danger ? '#c88070' : '#d8d0a4');
  }
  range(ctx, 78, 34, 3, dawn ? '#5a4a7a' : danger ? '#2a1222' : '#1b2246', 6, dawn ? '#f0d8e0' : danger ? undefined : '#5a6290');
  range(ctx, 92, 22, 8, dawn ? '#3e3462' : danger ? '#1e0c18' : '#141a38', 8);
  // the castle ruin on its hill, with the dungeon gate
  const hill = dawn ? '#2e2850' : danger ? '#170a14' : '#10142c';
  pell(ctx, 62, 104, 46, 18, hill);
  const ruin = dawn ? '#241e40' : danger ? '#120810' : '#0c1024';
  rect(ctx, 40, 72, 9, 20, ruin);
  rect(ctx, 76, 66, 10, 26, ruin);
  rect(ctx, 49, 80, 27, 12, ruin);
  for (let i = 0; i < 3; i++) {
    rect(ctx, 40 + i * 3, 70, 2, 2, ruin);
    rect(ctx, 76 + i * 4, 64, 2, 2, ruin);
  }
  fillPoly(ctx, [[58, 80], [64, 74], [67, 80]], ruin);
  px(ctx, 80, 72, dawn ? '#ffd08a' : '#ffcf6a');
  // gate
  rect(ctx, 58, 85, 7, 7, danger ? '#ff5a2a' : dawn ? '#140f22' : '#3a1a10');
  if (danger) glow(ctx, 61, 88, 16, '#ff3a1a', 0.55);
  // foreground village
  const ground = 124;
  rect(ctx, 0, ground, W, H - ground, dawn ? '#2a2236' : danger ? '#120a10' : '#0c0f1c');
  const body = dawn ? '#3a2e3e' : danger ? '#1c1018' : '#181424',
    roof = dawn ? '#2a1e2c' : danger ? '#120a10' : '#100d1a';
  const lit = danger ? '#ffb050' : '#ffcf6a';
  house(ctx, 104, ground, 22, 16, body, roof, lit, 1);
  house(ctx, 132, ground, 16, 12, body, roof, lit, 2);
  house(ctx, 154, ground, 26, 18, body, roof, lit, 3);
  house(ctx, 188, ground, 18, 13, body, roof, lit, 4);
  house(ctx, 212, ground, 24, 15, body, roof, lit, 5);
  house(ctx, 6, ground, 18, 12, body, roof, lit, 6);
  for (const [x, h] of [[30, 22], [96, 18], [150, 14], [228, 20], [86, 26]] as [number, number][]) pine(ctx, x, ground + 1, h, dawn ? '#1e1830' : '#090b16');
  // well
  pell(ctx, 120, ground + 4, 6, 2.2, dawn ? '#4a3e52' : '#26222e');
  rect(ctx, 115, ground - 6, 1, 8, '#2a1e16');
  rect(ctx, 125, ground - 6, 1, 8, '#2a1e16');
  rect(ctx, 114, ground - 7, 13, 1, '#3a2a1e');
  // path to the castle
  for (let i = 0; i < 30; i++) px(ctx, 64 + i * 1.4 + Math.round(hash(i, 3, 7) * 2), ground - 2 - i * 0.9, dawn ? '#5a4a5a' : '#1e2030');
  if (danger) {
    // glowing cracks and the shapes crawling out of the dark
    const crack = (pts: number[][]) => {
      for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#ff4a1a');
    };
    crack([[20, 134], [34, 128], [44, 131], [60, 126], [70, 129]]);
    crack([[150, 134], [158, 129], [172, 131], [180, 127]]);
    glow(ctx, 44, 130, 14, '#ff3a1a', 0.4);
    glow(ctx, 166, 130, 12, '#ff3a1a', 0.4);
    for (const [x, y] of [[74, 118], [84, 115], [92, 119]]) {
      pell(ctx, x, y, 3, 4, '#05030a');
      px(ctx, x - 1, y - 2, '#ff2a2a');
      px(ctx, x + 1, y - 2, '#ff2a2a');
    }
  }
  if (dawn) {
    // people with lanterns at the gate
    for (let i = 0; i < 9; i++) {
      const x = 22 + i * 9 + Math.round(hash(i, 1, 8) * 4);
      rect(ctx, x, ground - 7, 3, 7, '#1a1424');
      pell(ctx, x + 1.5, ground - 8.5, 1.8, 1.8, '#1a1424');
      glow(ctx, x + 4, ground - 5, 5, '#ffd27a', 0.6);
      px(ctx, x + 4, ground - 5, '#fff2b0');
    }
    for (const [x, y] of [[60, 30], [70, 26], [78, 33]]) {
      px(ctx, x - 1, y, '#3a2a40');
      px(ctx, x, y + 1, '#3a2a40');
      px(ctx, x + 1, y, '#3a2a40');
    }
  }
}

function hut(ctx: Ctx) {
  // plank walls
  for (let x = 0; x < W; x += 12) {
    rect(ctx, x, 0, 12, H, hash(x, 1, 9) > 0.5 ? '#3c2818' : '#43301e');
    rect(ctx, x, 0, 1, H, '#24170e');
  }
  rect(ctx, 0, 8, W, 5, '#2a1a10');
  rect(ctx, 0, 13, W, 1, '#1a100a');
  // window with the night outside
  rect(ctx, 22, 26, 42, 32, '#2a1a10');
  dgrad(ctx, 25, 29, 36, 26, ['#0b1230', '#1a2450']);
  for (let i = 0; i < 9; i++) px(ctx, 26 + Math.floor(hash(i, 2, 1) * 34), 30 + Math.floor(hash(2, i, 1) * 20), '#c8d0f0');
  pell(ctx, 52, 36, 4, 4, '#f2ecc4');
  rect(ctx, 42, 29, 2, 26, '#2a1a10');
  rect(ctx, 25, 41, 36, 2, '#2a1a10');
  // shelves with jars and books
  for (const sy of [70, 88]) {
    rect(ctx, 14, sy, 60, 3, '#2a1a10');
    for (let i = 0; i < 7; i++) {
      const jx = 18 + i * 8,
        jh = 6 + Math.floor(hash(i, sy, 2) * 6);
      const c = ['#3a7a5a', '#8a2a2a', '#2a4a8a', '#a8802a', '#5a2c7a'][Math.floor(hash(sy, i, 3) * 5)];
      if (hash(i, sy, 4) > 0.5) {
        pell(ctx, jx + 2, sy - jh / 2, 2.6, jh / 2, c);
        px(ctx, jx + 1, sy - jh + 2, shade(c, 0.4));
      } else rect(ctx, jx, sy - jh, 3, jh, c);
    }
  }
  // fireplace
  const fx = 168;
  rect(ctx, fx - 30, 46, 60, 74, '#4a4650');
  for (let y = 46; y < 120; y += 6)
    for (let x = fx - 30 + ((y / 6) % 2) * 5; x < fx + 30; x += 10) rect(ctx, x, y, 1, 6, '#3a3640');
  for (let y = 52; y < 120; y += 6) rect(ctx, fx - 30, y, 60, 1, '#3a3640');
  rect(ctx, fx - 34, 42, 68, 5, '#5a5660');
  pell(ctx, fx, 96, 18, 22, '#100a08');
  rect(ctx, fx - 18, 96, 36, 24, '#100a08');
  glow(ctx, fx, 104, 44, '#ff9a3a', 0.4);
  pell(ctx, fx, 108, 12, 10, '#ff6a1a');
  pell(ctx, fx - 4, 106, 6, 9, '#ff9a2a');
  pell(ctx, fx + 4, 109, 5, 7, '#ffd23a');
  pell(ctx, fx, 112, 3, 4, '#fff2c0');
  rect(ctx, fx - 14, 116, 28, 3, '#3a2010');
  // floor and table with the old map of the seal
  rect(ctx, 0, 120, W, 15, '#2a1c12');
  for (let x = 0; x < W; x += 20) rect(ctx, x, 120, 1, 15, '#1e140c');
  rect(ctx, 84, 104, 56, 5, '#5a3a22');
  rect(ctx, 88, 109, 4, 14, '#3a2414');
  rect(ctx, 132, 109, 4, 14, '#3a2414');
  rect(ctx, 96, 101, 30, 4, '#e8d8b0');
  ring(ctx, 111, 103, 6, 1.6, '#c8902a', 1);
  rect(ctx, 130, 94, 3, 8, '#f0e8d0');
  glow(ctx, 131, 92, 10, '#ffcf6a', 0.5);
  px(ctx, 131, 92, '#ffd23a');
  px(ctx, 131, 91, '#fff6d0');
}

function gate(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, 40, ['#05080f', '#0b1230', '#18224e']);
  stars(ctx, 30, 30, 21);
  // the cliff
  dgrad(ctx, 0, 24, W, H - 24, ['#2a2c3a', '#22232e', '#181820']);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(hash(i, 4, 2) * W),
      y = 30 + Math.floor(hash(4, i, 3) * 90);
    line(ctx, x, y, x + 4 + Math.floor(hash(i, 5, 4) * 8), y + 1, '#14141c');
  }
  fillPoly(ctx, [[0, 24], [40, 18], [90, 26], [150, 16], [200, 24], [240, 20], [240, 30], [0, 34]], '#2a2c3a');
  // stone arch
  const cx = 120;
  pell(ctx, cx, 64, 38, 34, '#5a5866');
  rect(ctx, cx - 38, 64, 76, 60, '#5a5866');
  for (let a = 0; a < 13; a++) {
    const ang = Math.PI + (a / 12) * Math.PI;
    line(ctx, Math.round(cx + Math.cos(ang) * 28), Math.round(64 + Math.sin(ang) * 26), Math.round(cx + Math.cos(ang) * 38), Math.round(64 + Math.sin(ang) * 34), '#3e3c48');
  }
  pell(ctx, cx, 64, 28, 26, '#040306');
  rect(ctx, cx - 28, 64, 56, 60, '#040306');
  // stairs going down into the dark
  for (let i = 0; i < 8; i++) {
    const y = 122 - i * 5,
      w = 54 - i * 5;
    rect(ctx, cx - w / 2, y, w, 2, shade('#5a5866', -i * 0.11));
  }
  // pillars with torches
  for (const sx of [cx - 50, cx + 50]) {
    rect(ctx, sx - 5, 60, 10, 64, '#46444f');
    rect(ctx, sx - 6, 56, 12, 5, '#5a5866');
    torch(ctx, sx, 50);
  }
  rect(ctx, 0, 124, W, 11, '#1e1e26');
  for (let i = 0; i < 14; i++) pell(ctx, 10 + i * 17 + hash(i, 6, 1) * 6, 126 + hash(6, i, 2) * 4, 3 + hash(i, 7, 3) * 3, 2, '#2e2e38');
}

function kobky(ctx: Ctx) {
  const vx = 120,
    vy = 64,
    fw = 26,
    fh = 24;
  // ceiling, walls and floor in perspective
  fillPoly(ctx, [[0, 0], [W, 0], [vx + fw, vy - fh], [vx - fw, vy - fh]], '#1a1822');
  fillPoly(ctx, [[0, 0], [vx - fw, vy - fh], [vx - fw, vy + fh], [0, H]], '#3e3c4a');
  fillPoly(ctx, [[W, 0], [vx + fw, vy - fh], [vx + fw, vy + fh], [W, H]], '#35333f');
  fillPoly(ctx, [[0, H], [vx - fw, vy + fh], [vx + fw, vy + fh], [W, H]], '#5a3e26');
  rect(ctx, vx - fw, vy - fh, fw * 2, fh * 2, '#07060a');
  // brick courses on the walls and flagstone joints on the floor
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    const yl = t * H,
      yr = vy - fh + t * fh * 2;
    line(ctx, 0, Math.round(yl), vx - fw, Math.round(yr), '#2a2834');
    line(ctx, W, Math.round(yl), vx + fw, Math.round(yr), '#24222c');
  }
  for (let k = 1; k < 6; k++) {
    const x = Math.round((vx - fw) * (1 - Math.pow(1 - k / 6, 1.6)));
    const t = x / (vx - fw);
    line(ctx, x, Math.round(t * (vy - fh)), x, Math.round(H - t * (H - vy - fh)), '#2a2834');
    line(ctx, W - x, Math.round(t * (vy - fh)), W - x, Math.round(H - t * (H - vy - fh)), '#24222c');
  }
  for (let k = -4; k <= 4; k++) line(ctx, vx + k * 6, vy + fh, vx + k * 60, H, '#3e2a1a');
  for (let k = 1; k < 5; k++) {
    const y = vy + fh + Math.pow(k / 5, 1.8) * (H - vy - fh);
    line(ctx, 0, Math.round(y), W, Math.round(y), '#3e2a1a');
  }
  torch(ctx, 46, 44);
  torch(ctx, 194, 44);
  torch(ctx, 84, 56);
  torch(ctx, 156, 56);
  glow(ctx, vx, vy, 30, '#0a0910', 0.8, 'dark');
}

function caves(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0e0c0a', '#1c1814', '#141210']);
  // far wall layers
  range(ctx, 96, 30, 31, '#24201a', 9);
  range(ctx, 112, 20, 37, '#1c1814', 11);
  // stalactites
  for (let i = 0; i < 16; i++) {
    const x = 6 + i * 15 + Math.round(hash(i, 8, 1) * 8),
      h = 10 + Math.round(hash(8, i, 2) * 26);
    fillPoly(ctx, [[x - 5, 0], [x + 5, 0], [x, h]], i % 2 ? '#2e2822' : '#38302a');
    line(ctx, x - 2, 0, x, h - 2, '#4a4038');
  }
  // underground river
  dgrad(ctx, 0, 112, W, 23, ['#0a1418', '#10222a', '#0a1418']);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 9, 3) * W),
      y = 114 + Math.floor(hash(9, i, 4) * 18);
    line(ctx, x, y, x + 6 + Math.floor(hash(i, 1, 5) * 10), y, '#2a6a6a');
  }
  // ledges with glowing mushrooms
  fillPoly(ctx, [[0, 100], [60, 96], [84, 112], [0, 116]], '#2a241e');
  fillPoly(ctx, [[150, 112], [184, 92], [240, 90], [240, 116]], '#2a241e');
  for (const [x, g, s] of [[14, 100, 3], [24, 99, 2], [40, 98, 4], [52, 99, 2], [176, 97, 3], [196, 92, 4], [210, 92, 2], [226, 91, 3]] as [number, number, number][]) mushroom(ctx, x, g, s, '#2a9a88', '#4ff0d0');
  // stalagmites
  for (const [x, h] of [[96, 22], [110, 14], [130, 18]] as [number, number][]) {
    fillPoly(ctx, [[x - 5, 114], [x, 114 - h], [x + 5, 114]], '#3a322a');
    line(ctx, x, 115 - h, x - 2, 112, '#4e4438');
  }
}

function ice(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0e2238', '#1e4664', '#3a7aa0', '#8ac2de']);
  // frozen waterfall
  for (let x = 100; x < 140; x++) {
    const c = hash(x, 2, 7) > 0.6 ? '#e8f8ff' : hash(x, 3, 7) > 0.4 ? '#bfe6fb' : '#9ad2f0';
    rect(ctx, x, 0, 1, 108 + Math.round(Math.sin(x * 0.7) * 3), c);
  }
  glow(ctx, 120, 60, 40, '#d8f2ff', 0.25);
  // ice walls with crystals
  fillPoly(ctx, [[0, 0], [70, 0], [56, 40], [80, 90], [40, 135], [0, 135]], '#2e5a7e');
  fillPoly(ctx, [[W, 0], [170, 0], [186, 50], [160, 96], [200, 135], [W, 135]], '#2a5476');
  for (const [x, b, h, w] of [[30, 118, 40, 7], [48, 120, 26, 5], [14, 124, 30, 6], [200, 120, 44, 8], [218, 124, 30, 6], [182, 126, 22, 5]] as [number, number, number, number][]) crystal(ctx, x, b, h, w, '#6fc8ff', '#e8f8ff');
  // icicles
  for (let i = 0; i < 20; i++) {
    const x = 60 + i * 6 + Math.round(hash(i, 5, 1) * 3),
      h = 6 + Math.round(hash(5, i, 2) * 16);
    if (x > 98 && x < 142) continue;
    fillPoly(ctx, [[x - 2, 0], [x + 2, 0], [x, h]], '#cfeefe');
  }
  // snowy floor
  dgrad(ctx, 0, 112, W, 23, ['#cfe6f3', '#eef8ff', '#ffffff']);
  for (let i = 0; i < 12; i++) pell(ctx, Math.floor(hash(i, 6, 3) * W), 114 + Math.floor(hash(6, i, 4) * 6), 6 + hash(i, 7, 5) * 10, 1.6, '#b8d8ea');
  for (let i = 0; i < 26; i++) px(ctx, Math.floor(hash(i, 8, 6) * W), Math.floor(hash(8, i, 7) * 110), '#ffffff');
}

function forge(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0a0404', '#1e0a06', '#3a1408', '#6a240c']);
  range(ctx, 92, 40, 41, '#1a0a08', 6);
  // chains from the dark above
  for (const cx of [40, 76, 170, 206]) {
    const len = 30 + Math.round(hash(cx, 1, 2) * 40);
    for (let y = 0; y < len; y += 4) {
      rect(ctx, cx - 1, y, 3, 3, '#3a3236');
      px(ctx, cx, y + 1, '#120c0e');
    }
  }
  // the great anvil of the Five
  glow(ctx, 120, 84, 46, '#ff6a1a', 0.35);
  fillPoly(ctx, [[84, 70], [160, 70], [168, 64], [150, 64], [146, 58], [94, 58], [90, 64], [72, 64]], '#2a2226');
  rect(ctx, 104, 70, 32, 20, '#221a1e');
  fillPoly(ctx, [[94, 102], [146, 102], [136, 90], [104, 90]], '#2a2226');
  line(ctx, 94, 58, 146, 58, '#ff9a3a');
  line(ctx, 72, 64, 90, 64, '#c86a2a');
  // lava river
  for (let y = 106; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const w = Math.sin(x * 0.09 + y * 0.6) + Math.sin(x * 0.03 - y * 0.3);
      px(ctx, x, y, w > 1.1 ? '#fff0a0' : w > 0.3 ? '#ffb347' : w > -0.6 ? '#ff6a1a' : '#c83a10');
    }
  }
  rect(ctx, 0, 104, W, 2, '#1a0a06');
  for (let i = 0; i < 8; i++) pell(ctx, 10 + i * 30 + hash(i, 3, 3) * 10, 105, 8, 2.5, '#1a0a06');
}

function abyss(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#05020a', '#120a20', '#1e1034', '#0a0612']);
  // the vortex
  for (let k = 0; k < 9; k++) ring(ctx, 120, 58, 14 + k * 11, 7 + k * 5.5, k % 2 ? '#2a1648' : '#3a1e5e', 2);
  glow(ctx, 120, 58, 34, '#7a3aff', 0.45);
  // the eye in the dark
  pell(ctx, 120, 58, 16, 7, '#12081c');
  pell(ctx, 120, 58, 13, 5, '#c77dff');
  pell(ctx, 120, 58, 2, 5, '#05020a');
  px(ctx, 116, 56, '#f6e6ff');
  // floating islands with violet rim light
  for (const [x, y, w] of [[40, 92, 26], [196, 84, 22], [150, 112, 18], [80, 118, 14]] as [number, number, number][]) {
    fillPoly(ctx, [[x - w, y], [x + w, y], [x + w * 0.5, y + w * 0.5], [x, y + w * 0.9], [x - w * 0.6, y + w * 0.45]], '#1a1226');
    line(ctx, x - w, y, x + w, y, '#8a4aff');
    rect(ctx, x - w + 2, y - 1, w * 2 - 4, 1, '#3a2a52');
  }
  // floating runes (diamond, forked stave, eye-triangle)
  [[30, 30], [206, 28], [60, 58], [180, 50], [104, 100], [140, 22]].forEach(([x, y], i) => {
    glow(ctx, x + 3, y + 3, 7, '#7a3aff', 0.5);
    const c = '#c77dff';
    if (i % 3 === 0) {
      line(ctx, x + 3, y, x + 6, y + 3, c);
      line(ctx, x + 6, y + 3, x + 3, y + 6, c);
      line(ctx, x + 3, y + 6, x, y + 3, c);
      line(ctx, x, y + 3, x + 3, y, c);
      px(ctx, x + 3, y + 3, '#f0d0ff');
    } else if (i % 3 === 1) {
      line(ctx, x + 3, y + 2, x + 3, y + 7, c);
      line(ctx, x + 3, y + 3, x, y, c);
      line(ctx, x + 3, y + 3, x + 6, y, c);
      px(ctx, x + 3, y, '#f0d0ff');
    } else {
      line(ctx, x, y + 6, x + 3, y, c);
      line(ctx, x + 3, y, x + 6, y + 6, c);
      line(ctx, x, y + 6, x + 6, y + 6, c);
      px(ctx, x + 3, y + 4, '#f0d0ff');
    }
  });
}

function seal(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#05030a', '#0e0a18', '#1a1424']);
  // the seal on the floor
  glow(ctx, 120, 92, 70, '#ffd27a', 0.3);
  for (const [rx, ry, c] of [[84, 30, '#c8902a'], [74, 26, '#ffd27a'], [52, 18, '#c8902a'], [30, 10, '#ffd27a']] as [number, number, string][]) ring(ctx, 120, 92, rx, ry, c, 1);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    line(ctx, Math.round(120 + Math.cos(a) * 74), Math.round(92 + Math.sin(a) * 26), Math.round(120 + Math.cos(a) * 80), Math.round(92 + Math.sin(a) * 28), '#ffd27a');
  }
  // five points of the seal (four lit shards and the last lock in the middle)
  const pts = [[120, 64], [196, 92], [120, 120], [44, 92]];
  for (const [x, y] of pts) {
    rect(ctx, x, 6, 1, y - 10, '#fff2c0');
    glow(ctx, x, y - 8, 14, '#fff2c0', 0.55);
    fillPoly(ctx, [[x, y - 16], [x + 4, y - 8], [x, y], [x - 4, y - 8]], '#9fe6ff');
    line(ctx, x, y - 15, x, y - 2, '#ffffff');
  }
  glow(ctx, 120, 92, 18, '#ffffff', 0.6);
}

const PAINTERS: Record<SceneId, (ctx: Ctx) => void> = {
  village: (c) => village(c, 'night'),
  quake: (c) => village(c, 'danger'),
  dawn: (c) => village(c, 'dawn'),
  hut,
  gate,
  kobky,
  caves,
  ice,
  forge,
  abyss,
  seal,
  black: (c) => rect(c, 0, 0, W, H, '#050407'),
};

const sceneCache = new Map<SceneId, HTMLCanvasElement>();
export function sceneCanvas(id: SceneId): HTMLCanvasElement {
  let c = sceneCache.get(id);
  if (!c) {
    const [cv, ctx] = canvas(W, H);
    PAINTERS[id](ctx);
    c = cv;
    sceneCache.set(id, c);
  }
  return c;
}

// ------------------------------------------------------------------ ambient particles
export type ParticleKind = 'twinkle' | 'snow' | 'embers' | 'spores' | 'dust' | 'motes' | 'smoke' | 'sparkle';
export const SCENE_PARTICLES: Record<SceneId, { kind: ParticleKind; color: string[]; n: number }> = {
  village: { kind: 'twinkle', color: ['#ffffff', '#c8d0f0'], n: 14 },
  quake: { kind: 'embers', color: ['#ff6a2a', '#ffb050'], n: 26 },
  dawn: { kind: 'motes', color: ['#fff0c0', '#ffd27a'], n: 16 },
  hut: { kind: 'embers', color: ['#ffb347', '#ffd23a'], n: 10 },
  gate: { kind: 'dust', color: ['#8a8698', '#5a5866'], n: 18 },
  kobky: { kind: 'dust', color: ['#c8b89a', '#8a7a64'], n: 22 },
  caves: { kind: 'spores', color: ['#4ff0d0', '#b0fff0'], n: 26 },
  ice: { kind: 'snow', color: ['#ffffff', '#dff4ff'], n: 46 },
  forge: { kind: 'embers', color: ['#ff6a1a', '#ffb347', '#fff0a0'], n: 40 },
  abyss: { kind: 'motes', color: ['#c77dff', '#8a4aff', '#f0d0ff'], n: 30 },
  seal: { kind: 'sparkle', color: ['#fff2c0', '#ffd27a', '#9fe6ff'], n: 30 },
  black: { kind: 'dust', color: ['#3a3446', '#2a2434'], n: 12 },
};

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  t: number;
}

/** runs the ambient particles of a scene on a canvas of the art's size; returns a stop function */
export function runParticles(cv: HTMLCanvasElement, id: SceneId): () => void {
  const cfg = SCENE_PARTICLES[id];
  const ctx = cv.getContext('2d')!;
  const spawn = (initial: boolean): P => {
    const c = cfg.color[Math.floor(Math.random() * cfg.color.length)];
    const x = Math.random() * W,
      y = initial ? Math.random() * H : 0;
    switch (cfg.kind) {
      case 'snow':
        return { x, y: initial ? y : -2, vx: -3 + Math.random() * 2, vy: 8 + Math.random() * 10, c, t: Math.random() * 10 };
      case 'embers':
        return { x, y: initial ? y : H + 2, vx: -2 + Math.random() * 4, vy: -(6 + Math.random() * 14), c, t: Math.random() * 10 };
      case 'spores':
        return { x, y: initial ? y : H + 2, vx: -2 + Math.random() * 4, vy: -(2 + Math.random() * 4), c, t: Math.random() * 10 };
      case 'sparkle':
        return { x: 40 + Math.random() * 160, y: initial ? y : H - 20, vx: -1 + Math.random() * 2, vy: -(6 + Math.random() * 8), c, t: Math.random() * 10 };
      case 'twinkle':
        return { x, y: Math.random() * 70, vx: 0, vy: 0, c, t: Math.random() * 10 };
      default:
        return { x, y: initial ? Math.random() * H : Math.random() * H, vx: -1.5 + Math.random() * 3, vy: -1 + Math.random() * 2, c, t: Math.random() * 10 };
    }
  };
  const ps: P[] = [];
  for (let i = 0; i < cfg.n; i++) ps.push(spawn(true));
  let last = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      p.x += (p.vx + (cfg.kind === 'snow' || cfg.kind === 'spores' ? Math.sin(p.t * 1.7) * 4 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.y < -4 || p.y > H + 4 || p.x < -4 || p.x > W + 4 || (cfg.kind !== 'twinkle' && cfg.kind !== 'snow' && cfg.kind !== 'embers' && cfg.kind !== 'spores' && cfg.kind !== 'sparkle' && p.t > 8)) {
        ps[i] = spawn(false);
        continue;
      }
      if (cfg.kind === 'twinkle' && Math.sin(p.t * 3) < 0.3) continue;
      if (cfg.kind === 'sparkle' && Math.sin(p.t * 9) < -0.2) continue;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      if (cfg.kind === 'smoke') ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y), 1, 1);
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// ------------------------------------------------------------------ portraits (40x40, shown enlarged)
const PW = 40;

function face(ctx: Ctx, cx: number, cy: number, skin: string, shadow: string, eye: string, opts: { old?: boolean; glowEyes?: boolean } = {}) {
  pell(ctx, cx, cy, 8.5, 10.5, skin);
  pell(ctx, cx + 2, cy + 2, 6, 8, skin);
  rect(ctx, cx + 5, cy - 6, 2, 14, shadow);
  // eyes
  for (const ex of [cx - 4, cx + 3]) {
    rect(ctx, ex, cy - 1, 3, 2, opts.glowEyes ? eye : '#f6f0e8');
    px(ctx, ex + 1, cy - 1, opts.glowEyes ? '#ffffff' : eye);
    px(ctx, ex + 1, cy, opts.glowEyes ? eye : '#1a1420');
    rect(ctx, ex - 1, cy - 3, 4, 1, shade(shadow, -0.2));
  }
  // nose and mouth
  line(ctx, cx, cy, cx + 1, cy + 4, shadow);
  rect(ctx, cx - 2, cy + 6, 5, 1, shade(shadow, -0.15));
  if (opts.old) {
    line(ctx, cx - 7, cy + 2, cx - 5, cy + 6, shadow);
    line(ctx, cx + 7, cy + 2, cx + 6, cy + 6, shadow);
    rect(ctx, cx - 4, cy - 5, 8, 1, shadow);
  }
}

function portIlda(ctx: Ctx) {
  // hood and cloak
  fillPoly(ctx, [[6, 40], [8, 22], [12, 10], [20, 5], [28, 10], [32, 22], [34, 40]], '#5a3a24', PW);
  fillPoly(ctx, [[10, 40], [12, 26], [28, 26], [30, 40]], '#4a2e1c', PW);
  // grey hair
  fillPoly(ctx, [[11, 16], [20, 9], [29, 16], [29, 28], [26, 20], [14, 20], [11, 28]], '#c8c8cc', PW);
  face(ctx, 20, 21, '#e2b494', '#b8866a', '#4a6a8a', { old: true });
  rect(ctx, 14, 16, 12, 1, '#a8a8b0');
  // braid over the shoulder
  for (let i = 0; i < 6; i++) pell(ctx, 29 + (i % 2), 28 + i * 2, 1.8, 1.4, i % 2 ? '#b8b8c0' : '#d8d8dc');
  // lantern glow
  pell(ctx, 9, 35, 4, 4, '#ffcf6a');
  pell(ctx, 9, 35, 2, 2.4, '#fff2c0');
  rect(ctx, 8, 30, 2, 2, '#5a4a32');
}

function portElara(ctx: Ctx, dark: boolean) {
  const hair = dark ? '#3a2a4a' : '#e2bf6a',
    hairD = dark ? '#24182e' : '#b8944a';
  const robe = dark ? '#24122e' : '#2f5fa8',
    trim = dark ? '#8a3aff' : '#c8d8f0';
  fillPoly(ctx, [[8, 40], [12, 30], [20, 28], [28, 30], [32, 40]], robe, PW);
  line(ctx, 20, 30, 20, 40, trim);
  rect(ctx, 12, 30, 16, 1, trim);
  // long hair behind
  fillPoly(ctx, [[9, 36], [10, 14], [20, 6], [30, 14], [31, 36], [26, 30], [14, 30]], hairD, PW);
  face(ctx, 20, 20, dark ? '#d8c4d4' : '#f2caa2', dark ? '#a888a8' : '#c89a78', dark ? '#e080ff' : '#3a7ad8', { glowEyes: dark });
  // fringe and circlet
  fillPoly(ctx, [[11, 15], [20, 8], [29, 15], [27, 12], [20, 11], [13, 12]], hair, PW);
  rect(ctx, 12, 13, 16, 1, dark ? '#5a3a6a' : '#d0d8e8');
  px(ctx, 20, 12, dark ? '#c77dff' : '#4fa8ff');
  px(ctx, 20, 13, dark ? '#f0d0ff' : '#9fe6ff');
  if (dark) {
    // veins of darkness and wisps
    line(ctx, 13, 22, 15, 26, '#6a2a8a');
    line(ctx, 27, 22, 25, 26, '#6a2a8a');
    for (const [x, y] of [[4, 20], [35, 16], [6, 30], [34, 32]]) {
      line(ctx, x, y, x + (x < 20 ? 3 : -3), y - 4, '#8a3aff');
      px(ctx, x, y, '#c77dff');
    }
  }
}

function portMorgrim(ctx: Ctx) {
  fillPoly(ctx, [[4, 40], [8, 28], [32, 28], [36, 40]], '#5a3418', PW);
  for (let x = 6; x < 36; x += 4) rect(ctx, x, 31, 2, 2, '#8a8a96');
  // horned rusty helm with a T visor
  fillPoly(ctx, [[3, 6], [9, 14], [11, 12]], '#d8c8a8', PW);
  fillPoly(ctx, [[37, 6], [31, 14], [29, 12]], '#d8c8a8', PW);
  pell(ctx, 20, 18, 11, 12, '#7a4a2a');
  rect(ctx, 9, 18, 22, 11, '#7a4a2a');
  rect(ctx, 10, 9, 20, 2, '#a86a3a');
  for (let i = 0; i < 9; i++) px(ctx, 11 + Math.floor(hash(i, 3, 3) * 18), 12 + Math.floor(hash(3, i, 4) * 16), '#5a3418');
  rect(ctx, 11, 17, 18, 3, '#0a0606');
  rect(ctx, 18, 17, 4, 10, '#0a0606');
  px(ctx, 14, 18, '#ff8a2a');
  px(ctx, 25, 18, '#ff8a2a');
  px(ctx, 15, 18, '#ffd060');
  px(ctx, 26, 18, '#ffd060');
  rect(ctx, 9, 28, 22, 2, '#5a3418');
}

function portSpore(ctx: Ctx) {
  // body and drooping tendrils
  fillPoly(ctx, [[10, 40], [13, 24], [27, 24], [30, 40]], '#2a3a30', PW);
  for (const x of [12, 17, 23, 28]) line(ctx, x, 24, x + (x < 20 ? -2 : 2), 38, '#3a5a46');
  pell(ctx, 16, 28, 2, 2.4, '#b0fff0');
  pell(ctx, 24, 28, 2, 2.4, '#b0fff0');
  px(ctx, 16, 28, '#ffffff');
  px(ctx, 24, 28, '#ffffff');
  rect(ctx, 17, 33, 6, 1, '#12201a');
  // the great cap
  pell(ctx, 20, 15, 19, 11, '#3a7a6e');
  pell(ctx, 20, 13, 17, 8, '#4a8f82');
  rect(ctx, 2, 22, 36, 2, '#d8c8a8');
  for (let x = 4; x < 36; x += 3) px(ctx, x, 23, '#a8987a');
  for (const [x, y, r] of [[10, 12, 2], [20, 8, 2.6], [29, 13, 2], [15, 17, 1.4], [26, 18, 1.4]]) {
    pell(ctx, x, y, r, r * 0.8, '#4ff0d0');
    px(ctx, Math.round(x - 0.5), Math.round(y - 0.8), '#d8fff6');
  }
}

function portIsolda(ctx: Ctx) {
  fillPoly(ctx, [[7, 40], [11, 30], [20, 28], [29, 30], [33, 40]], '#6aa8d8', PW);
  rect(ctx, 12, 30, 16, 1, '#e8f8ff');
  fillPoly(ctx, [[8, 38], [10, 14], [20, 7], [30, 14], [32, 38], [27, 30], [13, 30]], '#eef8ff', PW);
  face(ctx, 20, 20, '#d4ecf8', '#9ac0d8', '#5ac8ff', {});
  // tear
  px(ctx, 16, 22, '#e8f8ff');
  px(ctx, 16, 24, '#bfe6fb');
  // ice crown
  for (const [x, h] of [[12, 6], [16, 9], [20, 12], [24, 9], [28, 6]]) {
    fillPoly(ctx, [[x - 2, 12], [x, 12 - h], [x + 2, 12]], '#a8e0ff', PW);
    px(ctx, x, 13 - h, '#ffffff');
  }
  rect(ctx, 10, 11, 20, 2, '#cfeefe');
}

function portNyx(ctx: Ctx) {
  pell(ctx, 20, 22, 19, 18, '#14081e');
  // horns
  fillPoly(ctx, [[6, 14], [2, 2], [10, 10]], '#24142e', PW);
  fillPoly(ctx, [[34, 14], [38, 2], [30, 10]], '#24142e', PW);
  // tendrils
  for (const [x, y] of [[4, 30], [36, 30], [10, 38], [30, 38], [20, 39]]) line(ctx, 20, 26, x, y, '#2a1438');
  // the eye
  pell(ctx, 20, 20, 11, 6, '#2a0a2a');
  pell(ctx, 20, 20, 9, 5, '#c77dff');
  pell(ctx, 20, 20, 5, 4, '#8a3aff');
  rect(ctx, 19, 15, 2, 10, '#05020a');
  px(ctx, 16, 18, '#f6e6ff');
  px(ctx, 17, 18, '#f0d0ff');
  for (let i = 0; i < 8; i++) px(ctx, 4 + Math.floor(hash(i, 7, 9) * 32), 4 + Math.floor(hash(7, i, 9) * 32), '#7a3aff');
}

function portDiary(ctx: Ctx) {
  fillPoly(ctx, [[3, 12], [20, 16], [37, 12], [37, 34], [20, 37], [3, 34]], '#6b3a22', PW);
  fillPoly(ctx, [[5, 12], [19, 15], [19, 34], [5, 31]], '#efe2c0', PW);
  fillPoly(ctx, [[21, 15], [35, 12], [35, 31], [21, 34]], '#e6d8b4', PW);
  for (let i = 0; i < 6; i++) {
    line(ctx, 7, 17 + i * 2.6, 17, 19 + i * 2.6, '#a8906a');
    line(ctx, 23, 19 + i * 2.6, 33, 17 + i * 2.6, '#a8906a');
  }
  rect(ctx, 19, 15, 2, 20, '#4a2614');
  line(ctx, 26, 12, 27, 38, '#b02a3a');
}

function portSmith(ctx: Ctx) {
  glow(ctx, 20, 24, 18, '#ff6a1a', 0.3);
  fillPoly(ctx, [[6, 18], [34, 18], [38, 14], [30, 14], [28, 11], [12, 11], [10, 14], [2, 14]], '#3a3236', PW);
  rect(ctx, 14, 18, 12, 10, '#2a2226');
  fillPoly(ctx, [[8, 36], [32, 36], [27, 28], [13, 28]], '#3a3236', PW);
  line(ctx, 12, 11, 28, 11, '#ff9a3a');
  for (const x of [15, 19, 23]) {
    line(ctx, x, 21, x + 2, 25, '#ffb347');
    px(ctx, x + 1, 23, '#fff0a0');
  }
}

const PORTRAITS: Partial<Record<SpeakerId, (ctx: Ctx) => void>> = {
  ilda: portIlda,
  elara: (c) => portElara(c, false),
  elaraDark: (c) => portElara(c, true),
  morgrim: portMorgrim,
  spore: portSpore,
  isolda: portIsolda,
  nyx: portNyx,
  diary: portDiary,
  smith: portSmith,
};

const portraitCache = new Map<SpeakerId, string>();
/** data URL of a speaker's portrait (empty for the narrator) */
export function portraitURL(id: SpeakerId): string {
  if (!PORTRAITS[id]) return '';
  let u = portraitCache.get(id);
  if (!u) {
    const [c, ctx] = canvas(PW, PW);
    PORTRAITS[id]!(ctx);
    // 1 px dark outline keeps the figure readable on any background
    const img = ctx.getImageData(0, 0, PW, PW);
    const d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < PW && y < PW && d[(y * PW + x) * 4 + 3] > 40;
    const edge: number[] = [];
    for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push(x, y);
    ctx.fillStyle = '#0a0810';
    for (let i = 0; i < edge.length; i += 2) ctx.fillRect(edge[i], edge[i + 1], 1, 1);
    u = c.toDataURL();
    portraitCache.set(id, u);
  }
  return u;
}
