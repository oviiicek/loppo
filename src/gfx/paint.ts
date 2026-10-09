// Drawing primitives of the story illustrations (240x135 pixel art): hard-edged polygons and ellipses,
// dithered gradients, soft lights, mountain ranges and a few small things the scenes share.
import { canvas, rect, px, line, shade, hash } from './pixel';

export const ART_W = 240;
export const ART_H = 135;
const W = ART_W,
  H = ART_H;

export type Ctx = CanvasRenderingContext2D;

// ------------------------------------------------------------------ primitives (all hard-edged)
export function fillPoly(ctx: Ctx, pts: number[][], col: string, h = H) {
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

export function pell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
}

export function ring(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, step = 1) {
  const n = Math.ceil(Math.PI * (rx + ry) * 1.2);
  for (let i = 0; i < n; i += step) {
    const a = (i / n) * Math.PI * 2;
    px(ctx, Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), col);
  }
}

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** vertical gradient through the given colours, ordered-dithered like old pixel art */
export function dgrad(ctx: Ctx, x: number, y: number, w: number, h: number, cols: string[]) {
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
export function glow(ctx: Ctx, cx: number, cy: number, r: number, col: string, strength = 0.6, mode: 'light' | 'dark' = 'light') {
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
export function range(ctx: Ctx, base: number, amp: number, seed: number, col: string, peaks = 7, snow?: string) {
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

export function stars(ctx: Ctx, n: number, maxY: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, seed, 4) * W),
      y = Math.floor(hash(seed, i, 5) * maxY);
    const b = hash(i, i, seed);
    px(ctx, x, y, b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8d0f0' : '#7a84b0');
  }
}

export function pine(ctx: Ctx, x: number, ground: number, h: number, col: string) {
  for (let k = 0; k < 3; k++) {
    const top = ground - h + k * (h / 4);
    const wd = (h / 4) * (1 + k * 0.5);
    fillPoly(ctx, [[x, top], [x - wd, top + h / 2.4], [x + wd, top + h / 2.4]], col);
  }
  rect(ctx, x - 1, ground - h / 6, 2, h / 6, col);
}

export function house(ctx: Ctx, x: number, ground: number, w: number, h: number, body: string, roof: string, lit: string | null, seed: number) {
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

export function torch(ctx: Ctx, x: number, y: number) {
  glow(ctx, x, y - 3, 16, '#ffb050', 0.35);
  rect(ctx, x - 1, y, 2, 6, '#5a3416');
  pell(ctx, x, y - 2, 2.2, 3.4, '#ff6a1a');
  pell(ctx, x, y - 1, 1.3, 2, '#ffd23a');
  px(ctx, x, y - 1, '#fff6d0');
}

export function crystal(ctx: Ctx, x: number, base: number, h: number, w: number, col: string, hi: string) {
  fillPoly(ctx, [[x - w, base], [x, base - h], [x + w, base]], col);
  line(ctx, x, base - h + 1, x, base - 1, hi);
}

export function mushroom(ctx: Ctx, x: number, ground: number, s: number, cap: string, glowCol: string) {
  glow(ctx, x, ground - s * 2, s * 5, glowCol, 0.35);
  rect(ctx, x, ground - s * 2, Math.max(1, Math.round(s / 2)), s * 2, '#d8d0bc');
  pell(ctx, x + s / 4, ground - s * 2, s * 1.4, s * 0.8, cap);
  px(ctx, Math.round(x - s / 3), Math.round(ground - s * 2.2), '#d8fff6');
}

// ------------------------------------------------------------------ more shapes for the areas
export type ParticleKind = 'twinkle' | 'snow' | 'embers' | 'spores' | 'dust' | 'motes' | 'smoke' | 'sparkle' | 'drip' | 'ash';

const toRgb = (col: string) => {
  const n = parseInt(col.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** outline of a pointed arch standing on `base`: straight sides, then two arcs of radius r meeting at the tip
 *  (r = half the width gives a round arch) */
export function archPts(cx: number, base: number, w: number, h: number, r = w * 0.8): number[][] {
  const hw = w / 2;
  r = Math.max(hw, r);
  const a1 = Math.acos((hw - r) / r);
  const tip = r * Math.sin(a1);
  const spring = base - Math.max(0, h - tip);
  const pts: number[][] = [
    [cx - hw, base],
    [cx - hw, spring],
  ];
  const n = 12;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI - (Math.PI - a1) * (i / n);
    pts.push([cx - hw + r + r * Math.cos(a), spring - r * Math.sin(a)]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const a = Math.PI - (Math.PI - a1) * (i / n);
    pts.push([cx + hw - r - r * Math.cos(a), spring - r * Math.sin(a)]);
  }
  pts.push([cx + hw, spring], [cx + hw, base]);
  return pts;
}

/** an arch in a wall: the stone frame (with a lit rim) and the dark opening */
export function arch(ctx: Ctx, cx: number, base: number, w: number, h: number, frame: string, hole: string, t = 4, r?: number) {
  fillPoly(ctx, archPts(cx, base, w + t * 2, h + t, r === undefined ? undefined : r + t), frame);
  fillPoly(ctx, archPts(cx, base, w, h, r), hole);
  // voussoir joints on the frame
  const pts = archPts(cx, base, w + t, h + t / 2, r === undefined ? undefined : r + t / 2);
  for (let i = 3; i < pts.length - 3; i += 3) px(ctx, Math.round(pts[i][0]), Math.round(pts[i][1]), shade(frame, -0.3));
}

/** a beam of light: a polygon added on top of what is painted */
export function shaft(ctx: Ctx, pts: number[][], col: string, a = 0.12) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  fillPoly(ctx, pts, col);
  ctx.restore();
}

/** still water from row y0 down: the picture above mirrored, rippled and tinted (deeper = more tint) */
export function reflect(ctx: Ctx, y0: number, h: number, tint: string, amount = 0.45, seed = 1) {
  const src = ctx.getImageData(0, 0, W, H).data;
  const img = ctx.getImageData(0, y0, W, h);
  const out = img.data;
  const [tr, tg, tb] = toRgb(tint);
  for (let j = 0; j < h; j++) {
    const sy = Math.max(0, y0 - 1 - j);
    const off = Math.round(Math.sin(j * 1.3 + seed) * (j < 2 ? 0 : 0.6 + j / 14));
    const k = Math.min(0.92, amount + (1 - amount) * (j / h) * 0.55);
    for (let i = 0; i < W; i++) {
      const sx = Math.min(W - 1, Math.max(0, i + off));
      const si = (sy * W + sx) * 4,
        oi = (j * W + i) * 4;
      out[oi] = src[si] * (1 - k) + tr * k;
      out[oi + 1] = src[si + 1] * (1 - k) + tg * k;
      out[oi + 2] = src[si + 2] * (1 - k) + tb * k;
      out[oi + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, y0);
  // a few glints on the surface
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, seed, 41) * W),
      y = y0 + 1 + Math.floor(hash(seed, i, 42) * (h - 2));
    const len = 3 + Math.floor(hash(i, i, 43) * 9);
    rect(ctx, x, y, len, 1, shade(tint, 0.35 + hash(i, 2, 44) * 0.2));
  }
}

/** a small skull (5x5) */
export function skull(ctx: Ctx, x: number, y: number, bone: string, dark = '#120c08') {
  rect(ctx, x + 1, y, 3, 1, bone);
  rect(ctx, x, y + 1, 5, 3, bone);
  px(ctx, x + 1, y + 2, dark);
  px(ctx, x + 3, y + 2, dark);
  px(ctx, x + 1, y + 4, bone);
  px(ctx, x + 3, y + 4, bone);
  px(ctx, x + 1, y + 1, shade(bone, 0.25));
  px(ctx, x + 4, y + 3, shade(bone, -0.25));
}

/** a crystal: a pointed prism with a lit and a shaded face */
export function prism(ctx: Ctx, x: number, base: number, h: number, w: number, lean: number, col: string, hi: string) {
  const tx = x + lean,
    ty = base - h,
    sh = h * 0.78,
    mx = x + lean * 0.35;
  fillPoly(ctx, [[x - w, base], [x - w + lean * 0.75, base - sh], [tx, ty], [mx, base]], hi);
  fillPoly(ctx, [[mx, base], [tx, ty], [x + w + lean * 0.75, base - sh], [x + w, base]], col);
  line(ctx, Math.round(tx), Math.round(ty), Math.round(mx), Math.round(base - 1), shade(hi, 0.4));
  px(ctx, Math.round(tx), Math.round(ty), '#ffffff');
}

/** a hanging chain of links from (x, y0) to (x, y1) */
export function chain(ctx: Ctx, x: number, y0: number, y1: number, col: string) {
  for (let y = y0, k = 0; y < y1; y += 3, k++) {
    if (k % 2) rect(ctx, x, y, 1, 3, col);
    else {
      rect(ctx, x - 1, y, 3, 3, col);
      px(ctx, x, y + 1, shade(col, -0.6));
    }
  }
}

/** a sagging chain between two points */
export function swag(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, col: string) {
  const n = Math.max(4, Math.round(Math.abs(x1 - x0) / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    if (i % 2) px(ctx, x, y, col);
    else rect(ctx, x - 1, y - 1, 2, 2, col);
  }
}

/** a bare, twisted tree (or a root) grown from (x, y) */
export function deadTree(ctx: Ctx, x: number, y: number, len: number, ang: number, depth: number, col: string, seed: number) {
  const x2 = Math.round(x + Math.cos(ang) * len),
    y2 = Math.round(y - Math.sin(ang) * len);
  line(ctx, Math.round(x), Math.round(y), x2, y2, col);
  if (depth > 1) line(ctx, Math.round(x) + 1, Math.round(y), x2 + 1, y2, col);
  if (depth > 2) line(ctx, Math.round(x) - 1, Math.round(y), x2 - 1, y2, col);
  if (depth <= 0) return;
  const s = hash(seed, depth, 7);
  deadTree(ctx, x2, y2, len * (0.62 + s * 0.15), ang + 0.35 + s * 0.4, depth - 1, col, seed * 3 + 1);
  deadTree(ctx, x2, y2, len * (0.58 + s * 0.2), ang - 0.4 - (1 - s) * 0.35, depth - 1, col, seed * 5 + 2);
}

/** a spider web: spokes and sagging rings */
export function web(ctx: Ctx, cx: number, cy: number, r: number, col: string, spokes = 12) {
  const ends: number[][] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + 0.2;
    const rr = r * (0.85 + hash(i, 3, 9) * 0.3);
    ends.push([Math.cos(a), Math.sin(a), rr]);
    line(ctx, Math.round(cx), Math.round(cy), Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), col);
  }
  for (let k = 1; k <= 6; k++) {
    const f = k / 6.5;
    for (let i = 0; i < spokes; i++) {
      const [ax, ay, ar] = ends[i],
        [bx, by, br] = ends[(i + 1) % spokes];
      const x0 = cx + ax * ar * f,
        y0 = cy + ay * ar * f,
        x1 = cx + bx * br * f,
        y1 = cy + by * br * f;
      // the thread sags towards the centre a little
      const mx = (x0 + x1) / 2 - (((x0 + x1) / 2 - cx) * 0.08),
        my = (y0 + y1) / 2 - (((y0 + y1) / 2 - cy) * 0.08);
      line(ctx, Math.round(x0), Math.round(y0), Math.round(mx), Math.round(my), col);
      line(ctx, Math.round(mx), Math.round(my), Math.round(x1), Math.round(y1), col);
    }
  }
}

/** soft fog: horizontal bands of a colour at low opacity */
export function fog(ctx: Ctx, y: number, h: number, col: string, a = 0.25, seed = 1) {
  ctx.save();
  for (let j = 0; j < h; j++) {
    ctx.globalAlpha = a * Math.sin((j / h) * Math.PI) * (0.7 + hash(j, seed, 3) * 0.3);
    ctx.fillStyle = col;
    const wob = Math.round(Math.sin(j * 0.7 + seed) * 6);
    ctx.fillRect(wob - 10, y + j, W + 20, 1);
  }
  ctx.restore();
}

/** darkens the corners (a vignette that frames the picture) */
export function vignette(ctx: Ctx, col = '#000000', a = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  const [r, gg, b] = toRgb(col);
  g.addColorStop(0, `rgba(${r},${gg},${b},0)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},${a})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** a candle with its little flame and light */
export function candle(ctx: Ctx, x: number, y: number, h = 4, wax = '#e8dcc0') {
  glow(ctx, x, y - h - 2, 9, '#ffc870', 0.45);
  rect(ctx, x, y - h, 2, h, wax);
  px(ctx, x + 1, y - h, shade(wax, -0.2));
  px(ctx, x, y - h - 1, '#ffb040');
  px(ctx, x, y - h - 2, '#fff0b0');
}

/** a small figure seen from behind (the hero in the scene), with a lantern */
export function wanderer(ctx: Ctx, x: number, ground: number, col = '#141018', lamp = true) {
  rect(ctx, x - 2, ground - 9, 5, 7, col);
  rect(ctx, x - 2, ground - 2, 2, 2, col);
  rect(ctx, x + 1, ground - 2, 2, 2, col);
  pell(ctx, x + 0.5, ground - 11, 2.2, 2.4, col);
  fillPoly(ctx, [[x - 3, ground - 8], [x + 4, ground - 8], [x + 5, ground - 1], [x - 4, ground - 1]], col);
  if (lamp) {
    line(ctx, x + 4, ground - 8, x + 6, ground - 6, col);
    glow(ctx, x + 7, ground - 5, 14, '#ffd27a', 0.6);
    rect(ctx, x + 6, ground - 6, 2, 3, '#ffe9a8');
    px(ctx, x + 6, ground - 6, '#fff8e0');
  }
}

/** the stone frame of an arch alone (the opening stays see-through) */
export function archRing(ctx: Ctx, cx: number, base: number, w: number, h: number, t: number, col: string, r?: number) {
  const [c, x] = canvas(W, H);
  fillPoly(x, archPts(cx, base, w + t * 2, h + t, r === undefined ? undefined : r + t), col);
  x.globalCompositeOperation = 'destination-out';
  fillPoly(x, archPts(cx, base, w, h, r), '#000000');
  ctx.drawImage(c, 0, 0);
}

/** speckles that make a flat surface look like stone */
export function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number, n = 0.08) {
  const cnt = Math.round(w * h * n);
  for (let i = 0; i < cnt; i++) {
    const X = x + Math.floor(hash(i, seed, 51) * w),
      Y = y + Math.floor(hash(seed, i, 52) * h);
    px(ctx, X, Y, shade(base, hash(i, i, seed) > 0.5 ? 0.12 : -0.18));
  }
}

/** courses of bricks on a wall */
export function bricks(ctx: Ctx, x: number, y: number, w: number, h: number, col: string, mortar: string, bw = 12, bh = 6, seed = 1) {
  rect(ctx, x, y, w, h, mortar);
  for (let r = 0; r * bh < h; r++)
    for (let c = -1; c * bw < w; c++) {
      const bx = x + c * bw + (r % 2 ? bw / 2 : 0),
        by = y + r * bh;
      const x0 = Math.max(x, Math.round(bx) + 1),
        x1 = Math.min(x + w, Math.round(bx + bw));
      if (x1 <= x0) continue;
      const v = (hash(c + 7, r, seed) - 0.5) * 0.16;
      rect(ctx, x0, by + 1, x1 - x0, Math.min(bh - 1, y + h - by - 1), shade(col, v));
      rect(ctx, x0, by + 1, x1 - x0, 1, shade(col, v + 0.1));
    }
}
