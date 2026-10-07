// Pet sprites, drawn natively at double detail like the heroes (shown at half size). Six frames each:
// 0–1 a breathing idle, 2–5 a walk (or, for the flyers, beating wings). They face right.
import type { PetId } from '../data/pets';
import { rect, px } from './pixel';

type Ctx = CanvasRenderingContext2D;

export interface PetArt {
  w: number;
  h: number;
  draw: (ctx: Ctx, f: number) => void;
}

function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx: Ctx, pts: number[], col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

/** a leg from the hip down to the foot (the foot may step forward / back and lift) */
function leg(ctx: Ctx, hx: number, hy: number, fx: number, fy: number, w: number, col: string, paw?: string) {
  poly(ctx, [hx, hy, hx + w, hy, fx + w, fy, fx, fy], col);
  if (paw) rect(ctx, fx - 0.5, fy - 1.5, w + 1, 1.5, paw);
}

/** a soft tail as a row of round blobs along a curve */
function tail(ctx: Ctx, pts: [number, number][], r0: number, r1: number, col: string, tip?: string) {
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // quadratic Bézier through the three points
    const [a, b, c] = pts;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1];
    const r = r0 + (r1 - r0) * t;
    ell(ctx, x, y, r, r, tip && t > 0.75 ? tip : col);
  }
}

// four-legged walk: [pair A foot dx, pair A lift, pair B foot dx, pair B lift, body bob]
const QUAD: number[][] = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1],
  [2, 0, -2, 0, 0],
  [0, 2, 0, 0, 1],
  [-2, 0, 2, 0, 0],
  [0, 0, 0, 2, 1],
];
// sway of tails and ears per frame
const SWAY = [0, 1, -1, 0, 1, 0];

function cat(ctx: Ctx, f: number) {
  const [ad, al, bd, bl, bob] = QUAD[f];
  const O = '#e8924a',
    OD = '#b8622a',
    OL = '#ffb46a',
    W = '#fbeedd',
    FAR = '#c8743a';
  const g = 23;
  // far legs, then the tail behind the body
  leg(ctx, 9, 15, 9 + bd, g - bl, 3, FAR, '#e8d8c8');
  leg(ctx, 20, 15, 20 + ad, g - al, 3, FAR, '#e8d8c8');
  const s = SWAY[f];
  tail(ctx, [[6, 12 + bob], [0 + s, 9], [3 + s, 1]], 1.7, 1.5, O, OD);
  // body
  ell(ctx, 13, 13 + bob, 9, 5, O);
  ell(ctx, 13, 10.5 + bob, 6.5, 1.8, OL);
  ell(ctx, 14, 16 + bob, 6.5, 2.4, W);
  for (const x of [8, 11, 14]) rect(ctx, x, 8.5 + bob, 1.5, 2.5, OD);
  // near legs with white socks
  leg(ctx, 6, 15, 6 + ad, g - al, 3, O, W);
  leg(ctx, 17, 15, 17 + bd, g - bl, 3, O, W);
  // head
  const hy = 8 + bob;
  poly(ctx, [16, hy - 1, 17, hy - 8, 20.5, hy - 4], O);
  poly(ctx, [21.5, hy - 4.5, 24.5, hy - 8, 25.5, hy - 1.5], O);
  poly(ctx, [17.5, hy - 2.5, 17.8, hy - 6, 19.5, hy - 4], '#ff9aa8');
  poly(ctx, [22.5, hy - 4.5, 24.2, hy - 6.5, 24.5, hy - 2.5], '#ff9aa8');
  ell(ctx, 21, hy, 5.5, 4.8, O);
  rect(ctx, 19, hy - 4, 1.5, 2, OD);
  rect(ctx, 21.5, hy - 4.5, 1.5, 2, OD);
  ell(ctx, 24, hy + 2.5, 2.8, 1.9, W);
  // eye: green with a dark slit and a shine
  rect(ctx, 22, hy - 2, 2, 3, '#5ac83a');
  rect(ctx, 23, hy - 2, 1, 3, '#14200f');
  px(ctx, 22, hy - 2, '#eaffd8');
  px(ctx, 26, hy + 1, '#ff7a96');
  px(ctx, 25, hy + 3, '#5a3020');
  px(ctx, 22, hy + 2, '#ff9a8a');
}

function dog(ctx: Ctx, f: number) {
  const [ad, al, bd, bl, bob] = QUAD[f];
  const B = '#b07440',
    BD = '#7a4a24',
    BL = '#cc8f58',
    C = '#f0d4a8',
    FAR = '#8e5a30';
  const g = 23;
  leg(ctx, 10, 15, 10 + bd, g - bl, 3, FAR, '#d8bc90');
  leg(ctx, 22, 15, 22 + ad, g - al, 3, FAR, '#d8bc90');
  // wagging tail (faster while walking)
  const wag = f < 2 ? SWAY[f] : f % 2 ? 2 : -1;
  tail(ctx, [[6, 11 + bob], [2, 8], [2 + wag, 3]], 1.6, 1.3, B, BL);
  ell(ctx, 14, 13 + bob, 9.5, 5.2, B);
  ell(ctx, 13, 10.3 + bob, 6.5, 1.6, BL);
  ell(ctx, 11, 11.5 + bob, 4, 2.6, BD);
  ell(ctx, 15, 16 + bob, 6, 2.2, C);
  leg(ctx, 7, 15, 7 + ad, g - al, 3, B, C);
  leg(ctx, 19, 15, 19 + bd, g - bl, 3, B, C);
  // collar
  rect(ctx, 17.5, 10.5 + bob, 2.5, 4, '#d63a3a');
  px(ctx, 18.5, 14.5 + bob, '#ffd23a');
  const hy = 8 + bob;
  ell(ctx, 22, hy, 5.2, 4.6, B);
  ell(ctx, 26.5, hy + 2.5, 3, 2.2, C);
  ell(ctx, 29, hy + 1.5, 1.2, 1, '#1a1210');
  // floppy ear
  ell(ctx, 19.5, hy + 0.5 + (f % 2 ? 0.5 : 0), 2.1, 3.6, BD);
  rect(ctx, 23, hy - 2, 2, 2, '#1a1210');
  px(ctx, 23, hy - 2, '#ffffff');
  // panting tongue while running
  if (f >= 2) rect(ctx, 26, hy + 4.5, 1.5, 1.5, '#ff7a8a');
  px(ctx, 27, hy + 4, '#5a3020');
}

function fox(ctx: Ctx, f: number) {
  const [ad, al, bd, bl, bob] = QUAD[f];
  const O = '#f07a28',
    OL = '#ff9e52',
    W = '#fff1dc',
    K = '#2a1a14',
    FAR = '#c85e1a';
  const g = 23;
  const sock = (hx: number, fx: number, lift: number, col: string) => {
    leg(ctx, hx, 15, fx, g - lift, 2.5, col);
    leg(ctx, hx + (fx - hx) * 0.5, 19, fx, g - lift, 2.5, K);
  };
  sock(10, 10 + bd, bl, FAR);
  sock(21, 21 + ad, al, FAR);
  // big bushy tail with a white tip, held up behind
  const s = SWAY[f];
  tail(ctx, [[8, 12 + bob], [1.5, 13 + s * 0.5], [3 + s, 4.5]], 2.6, 3, O, W);
  ell(ctx, 3.2, 10.5 + s * 0.5, 1.4, 2.4, OL);
  ell(ctx, 14, 13 + bob, 8.5, 4.6, O);
  ell(ctx, 13.5, 10.5 + bob, 6, 1.5, OL);
  ell(ctx, 15.5, 15.6 + bob, 5.5, 2, W);
  sock(7, 7 + ad, al, O);
  sock(18, 18 + bd, bl, O);
  const hy = 8 + bob;
  // tall ears with dark tips
  poly(ctx, [17.5, hy - 1, 18.5, hy - 8, 21, hy - 4], O);
  poly(ctx, [21.5, hy - 4, 24, hy - 8.5, 25, hy - 2], O);
  poly(ctx, [18.2, hy - 6.5, 18.5, hy - 8, 19.3, hy - 6.8], K);
  poly(ctx, [23.5, hy - 7, 24, hy - 8.5, 24.5, hy - 7], K);
  poly(ctx, [19, hy - 2.5, 19, hy - 5.5, 20.3, hy - 4], W);
  ell(ctx, 22, hy, 4.8, 4.2, O);
  // long snout, white cheeks
  poly(ctx, [24, hy - 1, 29.5, hy + 1.8, 24, hy + 3.5], O);
  ell(ctx, 24.5, hy + 2.3, 2.8, 1.7, W);
  poly(ctx, [24.5, hy + 2, 29, hy + 2.2, 24.5, hy + 3.8], W);
  px(ctx, 29, hy + 1, K);
  rect(ctx, 23, hy - 2, 2, 2, K);
  px(ctx, 23, hy - 2, '#ffd27a');
}

function owl(ctx: Ctx, f: number) {
  const Bn = '#8a5a32',
    BD = '#6a4022',
    Bl = '#a87446',
    Cr = '#ead4aa',
    Y = '#ffd23a',
    K = '#1a1210';
  // wings: folded at rest, beating while flying (up, level, down, level)
  const wing = f < 2 ? 'fold' : (['up', 'mid', 'down', 'mid'] as const)[f - 2];
  const bob = f === 1 ? 1 : f === 4 ? 1 : f === 2 ? -1 : 0;
  const wingPts = (side: number) => {
    const cx = 12 + side * 5;
    const o = (x: number) => 12 + side * x;
    if (wing === 'fold') return [cx, 9 + bob, o(8.5), 13 + bob, o(8), 20 + bob, cx, 21 + bob];
    if (wing === 'up') return [o(4), 11 + bob, o(10), 1 + bob, o(12), 7 + bob, o(9), 14 + bob];
    if (wing === 'mid') return [o(4), 11 + bob, o(12), 10 + bob, o(11.5), 15 + bob, o(6), 17 + bob];
    return [o(4), 12 + bob, o(11), 19 + bob, o(8), 22 + bob, o(5), 18 + bob];
  };
  poly(ctx, wingPts(-1), BD);
  poly(ctx, wingPts(1), BD);
  ell(ctx, 12, 14 + bob, 7, 8.5, Bn);
  ell(ctx, 12, 9 + bob, 5.5, 2, Bl);
  ell(ctx, 12, 17.5 + bob, 4.6, 5, Cr);
  // speckled chest
  for (const [x, y] of [
    [10, 15],
    [13, 15],
    [11.5, 17.5],
    [9.5, 19.5],
    [13.5, 19.5],
  ])
    rect(ctx, x, y + bob, 1.5, 1, '#b8915e');
  // ear tufts
  poly(ctx, [6, 8 + bob, 6.5, 3 + bob, 9, 6.5 + bob], BD);
  poly(ctx, [15, 6.5 + bob, 17.5, 3 + bob, 18, 8 + bob], BD);
  // face discs and the big eyes
  ell(ctx, 9.3, 10.5 + bob, 3.2, 3.2, Cr);
  ell(ctx, 14.7, 10.5 + bob, 3.2, 3.2, Cr);
  ell(ctx, 9.3, 10.5 + bob, 1.9, 1.9, Y);
  ell(ctx, 14.7, 10.5 + bob, 1.9, 1.9, Y);
  rect(ctx, 9, 10 + bob, 1.5, 1.5, K);
  rect(ctx, 14.3, 10 + bob, 1.5, 1.5, K);
  px(ctx, 8, 9 + bob, '#ffffff');
  px(ctx, 13.5, 9 + bob, '#ffffff');
  poly(ctx, [11, 12.5 + bob, 13, 12.5 + bob, 12, 15 + bob], '#ff9a2a');
  rect(ctx, 9, 22.5 + bob, 2, 1.5, '#ff9a2a');
  rect(ctx, 13, 22.5 + bob, 2, 1.5, '#ff9a2a');
}

function turtle(ctx: Ctx, f: number) {
  // slow steps: the walk frames lift a leg only every other frame
  const [ad, al, bd, bl, bob] = QUAD[f].map((v, i) => (i < 4 ? Math.round(v * 0.6) : v));
  const G = '#3f8a44',
    GD = '#2a6430',
    GL = '#6ab86a',
    S = '#8cc860',
    SD = '#6a9a48',
    R = '#c8d878';
  const g = 17;
  leg(ctx, 8, 11, 8 + bd, g - bl, 3, SD);
  leg(ctx, 18, 11, 18 + ad, g - al, 3, SD);
  // tail and neck behind the shell
  poly(ctx, [4, 11 + bob, 0.5, 13 + bob, 4, 13.5 + bob], S);
  rect(ctx, 20, 8 + bob, 4, 4, S);
  // shell: rim, dome, plates
  ell(ctx, 13, 12 + bob, 10, 2.4, R);
  ell(ctx, 13, 9 + bob, 9, 6.2, G);
  ell(ctx, 13, 5.5 + bob, 5.5, 2, GL);
  for (const [x, y] of [
    [9, 8.5],
    [13.5, 6.5],
    [18, 8.5],
    [13.5, 10.5],
  ])
    ell(ctx, x, y + bob, 2.2, 1.6, GD);
  leg(ctx, 5, 12, 5 + ad, g - al, 3.5, S);
  leg(ctx, 15, 12, 15 + bd, g - bl, 3.5, S);
  // head peeking out
  const hy = 8.5 + bob + (f === 1 ? 0.5 : 0);
  ell(ctx, 24.5, hy, 3.4, 3, S);
  rect(ctx, 25, hy - 1.5, 1.5, 1.5, '#1a1210');
  px(ctx, 25, hy - 1.5, '#ffffff');
  px(ctx, 27, hy + 1, '#3a5a20');
}

function slime(ctx: Ctx, f: number) {
  // [lift, rx, ry]: breathe, then a hop (squash, stretch up, airborne, land)
  const P = [
    [0, 9, 7],
    [0, 9.5, 6.6],
    [0, 10.2, 6],
    [3, 8.2, 7.8],
    [4, 8.8, 7],
    [0, 10, 6.2],
  ][f];
  const [lift, rx, ry] = P;
  const cy = 19 - lift - ry;
  const C = '#4ad8c0',
    CD = '#2a9a88',
    CL = '#bff8ec';
  ell(ctx, 12, cy, rx, ry, C);
  ell(ctx, 12, cy + ry - 1.6, rx - 1.5, 1.6, CD);
  ell(ctx, 8.5, cy - ry * 0.45, 2.3, 1.5, CL);
  px(ctx, 11, cy - ry * 0.7, '#ffffff');
  // face
  rect(ctx, 9, cy - 1, 2, 3, '#0f3a34');
  rect(ctx, 14, cy - 1, 2, 3, '#0f3a34');
  px(ctx, 9, cy - 1, '#ffffff');
  px(ctx, 14, cy - 1, '#ffffff');
  px(ctx, 11, cy + 2.5, '#0f3a34');
  px(ctx, 12, cy + 3, '#0f3a34');
  px(ctx, 13, cy + 2.5, '#0f3a34');
  px(ctx, 7.5, cy + 2, '#ff9ab8');
  px(ctx, 16.5, cy + 2, '#ff9ab8');
}

function wisp(ctx: Ctx, f: number) {
  // a little flame spirit: the tail flickers
  const tx = [10, 9, 8, 9, 11, 12][f];
  const ty = [21, 20, 21, 19, 21, 20][f];
  const O = '#4ab8ff',
    M = '#a8ecff',
    Cc = '#ffffff';
  poly(ctx, [4, 11, tx, ty, 16, 11], O);
  poly(ctx, [7, 12, (tx + 10) / 2, ty - 3, 13, 12], M);
  ell(ctx, 10, 9.5, 6.8, 6.8, O);
  ell(ctx, 10, 9, 5.2, 5.2, M);
  ell(ctx, 9.5, 8, 2.6, 2.4, Cc);
  // tiny face
  rect(ctx, 7.5, 8.5, 1.5, 2.5, '#1a3a6a');
  rect(ctx, 11.5, 8.5, 1.5, 2.5, '#1a3a6a');
  px(ctx, 9.5, 12, '#1a3a6a');
  // sparks around it
  const sp = [
    [2, 3],
    [17, 5],
    [3, 15],
    [16, 16],
  ];
  const [sx, sy] = sp[f % 4];
  px(ctx, sx, sy, M);
}

function dragon(ctx: Ctx, f: number) {
  const R = '#c8402a',
    RD = '#8a2418',
    RL = '#e8624a',
    Bel = '#ffb84a',
    Wg = '#e86a3a',
    K = '#1a1210';
  const wing = f < 2 ? (f === 0 ? 'mid' : 'fold') : (['up', 'mid', 'down', 'mid'] as const)[f - 2];
  const bob = f === 2 ? -1 : f === 4 ? 1 : 0;
  const wingPts = (dx: number): number[] => {
    const o = (pts: number[]) => pts.map((v, i) => (i % 2 ? v + bob : v + dx));
    if (wing === 'up') return o([12, 12, 9, 0, 3, 2, 6, 6, 1, 8, 10, 13]);
    if (wing === 'down') return o([12, 12, 6, 15, 3, 21, 8, 18, 10, 21, 13, 15]);
    if (wing === 'fold') return o([12, 12, 7, 5, 4, 9, 8, 11, 6, 14, 11, 14]);
    return o([12, 12, 5, 6, 1, 10, 5, 11, 2, 15, 11, 14]);
  };
  // far wing, tail, body, legs, near wing, head
  poly(ctx, wingPts(3), RD);
  const s = SWAY[f];
  tail(ctx, [[10, 18 + bob], [5, 22 + s], [1, 18 + s]], 2, 1.2, R);
  poly(ctx, [0, 16 + s, 2.5, 14.5 + s, 3, 18 + s], RD);
  ell(ctx, 14, 15 + bob, 6, 5, R);
  ell(ctx, 13, 12.5 + bob, 4, 1.6, RL);
  ell(ctx, 15.5, 17 + bob, 3.8, 3, Bel);
  rect(ctx, 14, 16 + bob, 3, 0.8, '#e89a2a');
  rect(ctx, 14, 18 + bob, 3, 0.8, '#e89a2a');
  rect(ctx, 11, 19 + bob, 2, 3, RD);
  rect(ctx, 16, 19 + bob, 2, 3, RD);
  px(ctx, 11, 22 + bob, '#f5e6c8');
  px(ctx, 16, 22 + bob, '#f5e6c8');
  const w = wingPts(0);
  poly(ctx, w, Wg);
  // wing bones
  ctx.fillStyle = RD;
  for (let i = 2; i < w.length - 2; i += 4) {
    const x0 = w[0],
      y0 = w[1],
      x1 = w[i],
      y1 = w[i + 1];
    for (let t = 0; t <= 1; t += 0.12) ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
  // head with horns
  const hy = 10 + bob;
  poly(ctx, [17.5, hy - 2, 16.5, hy - 7, 19, hy - 3], '#f5e6c8');
  poly(ctx, [19.8, hy - 3, 20, hy - 7.5, 21.8, hy - 2.5], '#f5e6c8');
  ell(ctx, 20, hy, 4.2, 3.6, R);
  ell(ctx, 24, hy + 1, 2.8, 2, R);
  ell(ctx, 20, hy - 2.5, 2.5, 0.9, RL);
  px(ctx, 26, hy, K);
  // big bright eye
  rect(ctx, 20, hy - 2, 3, 3, '#ffe14a');
  rect(ctx, 21.5, hy - 1.5, 1.5, 2.5, K);
  px(ctx, 20, hy - 2, '#ffffff');
  // a puff of smoke when it rests, an ember while flying
  if (f === 1) px(ctx, 27, hy - 2, '#9a9aa6');
  if (f === 3) px(ctx, 27.5, hy + 1, '#ffd23a');
}

export const PET_ART: Record<PetId, PetArt> = {
  cat: { w: 28, h: 24, draw: cat },
  dog: { w: 31, h: 24, draw: dog },
  fox: { w: 31, h: 24, draw: fox },
  owl: { w: 24, h: 25, draw: owl },
  turtle: { w: 28, h: 18, draw: turtle },
  slime: { w: 24, h: 20, draw: slime },
  wisp: { w: 20, h: 22, draw: wisp },
  dragon: { w: 30, h: 25, draw: dragon },
};
