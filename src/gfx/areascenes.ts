// The illustrations of the 25 areas (and of their guardians) for the story scenes: 240x135 pixel art
// painted from the primitives in paint.ts. The five original pictures (caves, ice, forge, abyss and the
// seal) live in story.ts.
import { rect, px, line, shade, hash } from './pixel';
import {
  ART_W,
  ART_H,
  fillPoly,
  pell,
  ring,
  dgrad,
  glow,
  range,
  stars,
  torch,
  mushroom,
  archPts,
  arch,
  archRing,
  shaft,
  reflect,
  skull,
  prism,
  chain,
  swag,
  deadTree,
  web,
  fog,
  vignette,
  candle,
  wanderer,
  speckle,
  bricks,
} from './paint';
import type { Ctx, ParticleKind } from './paint';

const W = ART_W,
  H = ART_H;

// ------------------------------------------------------------------ small things
/** a stone sarcophagus seen from the front-side: the box, the lid and a carved figure on it */
function sarcophagus(ctx: Ctx, x: number, y: number, w: number, h: number, depth: number, stone: string, skew: number) {
  // the lid's top face in perspective (skew moves its back edge towards the middle)
  fillPoly(ctx, [[x, y], [x + w, y], [x + w + skew, y - depth], [x + skew, y - depth]], shade(stone, 0.12));
  rect(ctx, x, y, w, h, stone);
  rect(ctx, x, y, w, 1, shade(stone, 0.25));
  rect(ctx, x, y + h - 1, w, 1, shade(stone, -0.35));
  // carved panels on the front
  for (let k = 0; k < 3; k++) {
    const px0 = x + 3 + Math.round(k * ((w - 6) / 3));
    const pw = Math.round((w - 6) / 3) - 2;
    rect(ctx, px0, y + 3, pw, h - 6, shade(stone, -0.12));
    rect(ctx, px0, y + 3, pw, 1, shade(stone, -0.28));
  }
  // the effigy lying on the lid
  const ex = x + skew / 2,
    ey = y - depth / 2;
  pell(ctx, ex + w * 0.2, ey, Math.max(2, depth * 0.35), Math.max(1.5, depth * 0.3), shade(stone, 0.22));
  fillPoly(ctx, [[ex + w * 0.28, ey - depth * 0.28], [ex + w * 0.85, ey - depth * 0.22], [ex + w * 0.85, ey + depth * 0.22], [ex + w * 0.28, ey + depth * 0.28]], shade(stone, 0.18));
  speckle(ctx, x, y, w, h, stone, x + y, 0.05);
}

/** a stone column with a capital and a base; `broken` cuts its top off at an angle */
function column(ctx: Ctx, x: number, top: number, bottom: number, w: number, col: string, broken = 0) {
  const hw = Math.floor(w / 2);
  if (broken) fillPoly(ctx, [[x - hw, bottom], [x - hw, top + broken], [x + hw, top], [x + hw, bottom]], col);
  else {
    rect(ctx, x - hw, top + 3, w, bottom - top - 3, col);
    rect(ctx, x - hw - 2, top, w + 4, 3, shade(col, 0.15));
  }
  rect(ctx, x - hw - 2, bottom - 3, w + 4, 3, shade(col, 0.08));
  // fluting and shading
  rect(ctx, x - hw, top + (broken ? broken : 3), 1, bottom - top - (broken ? broken : 3) - 3, shade(col, 0.2));
  rect(ctx, x + hw - 1, top + 3, 1, bottom - top - 6, shade(col, -0.3));
  for (let fx = x - hw + 3; fx < x + hw - 2; fx += 3) rect(ctx, fx, top + (broken ? broken + 2 : 4), 1, bottom - top - (broken ? broken + 2 : 4) - 4, shade(col, -0.12));
}

/** a big mushroom: a bent stem and a domed cap with spots and a glowing underside */
function bigShroom(ctx: Ctx, x: number, ground: number, h: number, capW: number, stem: string, cap: string, spot: string, glowCol: string, bend = 0) {
  const sw = Math.max(2, Math.round(capW * 0.16));
  // stem
  const steps = Math.max(4, Math.round(h / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x + Math.sin(t * Math.PI * 0.8) * bend;
    const ww = sw * (1.3 - t * 0.35);
    rect(ctx, Math.round(cx - ww), Math.round(ground - t * h), Math.round(ww * 2), 2, shade(stem, -0.1 + t * 0.15));
    px(ctx, Math.round(cx + ww - 1), Math.round(ground - t * h), shade(stem, -0.35));
  }
  const cx = x + Math.sin(Math.PI * 0.8) * bend,
    cy = ground - h;
  glow(ctx, cx, cy + 3, capW * 1.4, glowCol, 0.4);
  // cap: a dome over a flat underside with gills
  const pts: number[][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    pts.push([cx + Math.cos(a) * capW, cy + Math.sin(a) * capW * 0.62]);
  }
  pts.push([cx + capW * 0.9, cy + 2], [cx - capW * 0.9, cy + 2]);
  fillPoly(ctx, pts, cap);
  fillPoly(ctx, [[cx - capW * 0.9, cy + 1], [cx + capW * 0.9, cy + 1], [cx + capW * 0.6, cy + 4], [cx - capW * 0.6, cy + 4]], shade(glowCol, -0.2));
  for (let gx = Math.round(cx - capW * 0.8); gx < cx + capW * 0.8; gx += 2) px(ctx, gx, Math.round(cy + 2), shade(glowCol, 0.2));
  // light on the cap's top and its spots
  for (let i = 3; i <= 9; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    px(ctx, Math.round(cx + Math.cos(a) * (capW - 1)), Math.round(cy + Math.sin(a) * (capW * 0.62 - 1)), shade(cap, 0.3));
  }
  for (let k = 0; k < Math.max(2, Math.round(capW / 4)); k++) {
    const a = Math.PI + (0.15 + hash(k, x, 3) * 0.7) * Math.PI;
    const rr = 0.35 + hash(x, k, 4) * 0.45;
    pell(ctx, cx + Math.cos(a) * capW * rr, cy + Math.sin(a) * capW * 0.62 * rr, 1.2 + hash(k, k, x) * 1.6, 1 + hash(k, k, x) * 1.2, spot);
  }
}

/** a thick, bending root or branch from a list of points (stamped circles of shrinking radius) */
function rootPath(ctx: Ctx, pts: number[][], r0: number, r1: number, col: string, hi: string) {
  const segs: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k < n; k++) segs.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  segs.forEach(([x, y], i) => {
    const r = r0 + (r1 - r0) * (i / segs.length);
    pell(ctx, x, y, r, r, col);
  });
  segs.forEach(([x, y], i) => {
    const r = r0 + (r1 - r0) * (i / segs.length);
    if (i % 2 === 0) px(ctx, Math.round(x - r * 0.6), Math.round(y - r * 0.5), hi);
  });
}

/** a hanging cocoon on its thread */
function cocoon(ctx: Ctx, x: number, top: number, y: number, len: number, col: string) {
  line(ctx, x, top, x, y - len, shade(col, -0.2));
  pell(ctx, x, y, Math.max(2, len * 0.32), len, col);
  for (let k = -len + 2; k < len - 1; k += 3) line(ctx, Math.round(x - len * 0.3), Math.round(y + k), Math.round(x + len * 0.3), Math.round(y + k + 2), shade(col, -0.18));
  px(ctx, x - 1, y - len + 2, shade(col, 0.3));
}

/** a spider hanging or crawling: body, eight legs and red eyes */
function spider(ctx: Ctx, x: number, y: number, s: number, col: string) {
  for (let k = 0; k < 4; k++) {
    const a = 0.35 + k * 0.32;
    for (const d of [-1, 1]) {
      const kx = x + d * Math.cos(a) * s * 1.6,
        ky = y - Math.sin(a) * s * 0.9;
      const fx = x + d * Math.cos(a) * s * 2.6,
        fy = y + s * (0.6 + k * 0.25);
      line(ctx, Math.round(x), Math.round(y), Math.round(kx), Math.round(ky), col);
      line(ctx, Math.round(kx), Math.round(ky), Math.round(fx), Math.round(fy), col);
    }
  }
  pell(ctx, x, y + s * 0.2, s, s * 0.85, col);
  pell(ctx, x, y - s * 0.75, s * 0.55, s * 0.45, col);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [2, 0]]) px(ctx, Math.round(x + dx * Math.max(1, s * 0.22)), Math.round(y - s * 0.75 + dy), '#ff2a2a');
}

/** pairs of eyes shining in the dark */
function eyes(ctx: Ctx, pts: number[][], col: string) {
  for (const [x, y] of pts) {
    glow(ctx, x + 1, y, 4, col, 0.4);
    px(ctx, x, y, col);
    px(ctx, x + 3, y, col);
  }
}

/** a seated statue of a king (a stone block figure with a crown) */
function kingStatue(ctx: Ctx, x: number, ground: number, s: number, stone: string, headless = false) {
  const lit = shade(stone, 0.15),
    dk = shade(stone, -0.3);
  // plinth
  rect(ctx, x - s * 1.4, ground - s * 0.6, s * 2.8, s * 0.6, dk);
  rect(ctx, x - s * 1.4, ground - s * 0.6, s * 2.8, 1, lit);
  // throne back and the body
  rect(ctx, x - s * 1.1, ground - s * 3.6, s * 2.2, s * 3, shade(stone, -0.12));
  fillPoly(ctx, [[x - s * 0.8, ground - s * 0.6], [x - s * 0.8, ground - s * 2.9], [x + s * 0.8, ground - s * 2.9], [x + s * 0.8, ground - s * 0.6]], stone);
  // knees and the hands on them
  rect(ctx, x - s * 0.9, ground - s * 1.6, s * 1.8, s * 0.5, lit);
  rect(ctx, x - s * 0.8, ground - s * 1.1, s * 0.6, s * 0.5, stone);
  rect(ctx, x + s * 0.2, ground - s * 1.1, s * 0.6, s * 0.5, stone);
  if (!headless) {
    pell(ctx, x, ground - s * 3.25, s * 0.45, s * 0.5, stone);
    // crown
    for (const dx of [-0.35, 0, 0.35]) fillPoly(ctx, [[x + (dx - 0.15) * s, ground - s * 3.65], [x + dx * s, ground - s * 4.1], [x + (dx + 0.15) * s, ground - s * 3.65]], '#d8a840');
    rect(ctx, x - s * 0.45, ground - s * 3.7, s * 0.9, s * 0.15, '#c89830');
  } else {
    // broken neck
    fillPoly(ctx, [[x - s * 0.4, ground - s * 2.9], [x - s * 0.2, ground - s * 3.15], [x + s * 0.1, ground - s * 3.0], [x + s * 0.4, ground - s * 3.2], [x + s * 0.4, ground - s * 2.9]], dk);
  }
  rect(ctx, x + s * 0.75, ground - s * 2.9, 1, s * 2.3, dk);
}

/** a horizontal band of little carved glyphs */
function glyphs(ctx: Ctx, x: number, y: number, w: number, col: string, seed: number) {
  for (let gx = x; gx < x + w - 3; gx += 5) {
    const k = Math.floor(hash(gx, seed, 2) * 6);
    if (k === 0) rect(ctx, gx, y, 3, 3, col);
    else if (k === 1) {
      rect(ctx, gx + 1, y, 1, 4, col);
      rect(ctx, gx, y + 1, 3, 1, col);
    } else if (k === 2) {
      px(ctx, gx, y, col);
      px(ctx, gx + 2, y, col);
      rect(ctx, gx, y + 2, 3, 1, col);
    } else if (k === 3) {
      rect(ctx, gx, y + 3, 3, 1, col);
      px(ctx, gx + 1, y, col);
      px(ctx, gx + 1, y + 1, col);
    } else if (k === 4) pell(ctx, gx + 1.5, y + 1.5, 1.5, 1.5, col);
    else {
      line(ctx, gx, y, gx + 2, y + 3, col);
      line(ctx, gx + 2, y, gx, y + 3, col);
    }
  }
}

/** a lantern (the hero's or Elara's) */
function lantern(ctx: Ctx, x: number, y: number, lit = true) {
  if (lit) glow(ctx, x, y + 3, 16, '#ffd27a', 0.55);
  rect(ctx, x - 2, y, 5, 1, '#3a2a1a');
  rect(ctx, x - 2, y + 1, 5, 5, lit ? '#ffe9a8' : '#6a5a40');
  rect(ctx, x - 2, y + 1, 1, 5, '#3a2a1a');
  rect(ctx, x + 2, y + 1, 1, 5, '#3a2a1a');
  rect(ctx, x - 2, y + 6, 5, 1, '#3a2a1a');
  px(ctx, x, y - 1, '#3a2a1a');
  if (lit) px(ctx, x, y + 3, '#ffffff');
}

// ------------------------------------------------------------------ chapter I
/** the old crypt: a vaulted hall of sarcophagi, candles and an altar at the end of the aisle */
function crypt(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0b0a0f', '#14131a', '#1c1b23']);
  // far wall with the altar niche
  bricks(ctx, 40, 18, 160, 86, '#2a2932', '#18171d', 10, 5, 3);
  arch(ctx, 120, 96, 34, 50, '#3a3944', '#0d0c11', 4);
  glow(ctx, 120, 82, 30, '#ffb860', 0.35);
  // the altar with the sign of the Five
  rect(ctx, 108, 86, 24, 10, '#4a4852');
  rect(ctx, 106, 85, 28, 2, '#5c5a66');
  for (const [dx, dy] of [[-6, 0], [6, 0], [-3, -5], [3, -5], [0, 4]] as [number, number][]) ring(ctx, 120 + dx, 70 + dy, 2.6, 2.6, '#d8b060', 1);
  glow(ctx, 120, 70, 14, '#ffe0a0', 0.4);
  candle(ctx, 110, 85, 4);
  candle(ctx, 129, 85, 5);
  // the floor of the aisle in perspective
  fillPoly(ctx, [[0, 135], [40, 104], [200, 104], [240, 135]], '#2a2830');
  for (let k = -5; k <= 5; k++) line(ctx, 120 + k * 16, 104, 120 + k * 52, 135, '#1f1e25');
  for (const y of [108, 113, 120, 129]) line(ctx, 0, y, W, y, '#1f1e25');
  speckle(ctx, 0, 104, W, 31, '#2a2830', 9, 0.05);
  // the middle vault: two pillars and the ribbed arch between them
  archRing(ctx, 120, 106, 112, 92, 8, '#33323c');
  for (const x of [60, 180]) {
    column(ctx, x, 30, 106, 12, '#3c3b46');
    candle(ctx, x - 1, 30, 3);
  }
  // the near vault framing the picture
  archRing(ctx, 120, 150, 214, 156, 14, '#18171d', 150);
  for (const x of [6, 234]) column(ctx, x, 40, 135, 14, '#211f27');
  // sarcophagi along the aisle
  sarcophagus(ctx, 54, 104, 30, 8, 5, '#45434e', 8);
  sarcophagus(ctx, 156, 104, 30, 8, 5, '#45434e', -8);
  sarcophagus(ctx, 10, 117, 50, 13, 8, '#504e5a', 14);
  sarcophagus(ctx, 180, 117, 50, 13, 8, '#504e5a', -14);
  candle(ctx, 14, 108, 5);
  candle(ctx, 225, 108, 6);
  candle(ctx, 58, 98, 3);
  candle(ctx, 182, 98, 3);
  // light falling through a grate in the vault
  shaft(ctx, [[96, 0], [112, 0], [150, 104], [118, 104]], '#fff0c8', 0.07);
  // cobwebs in the corners of the middle vault
  web(ctx, 66, 34, 14, 'rgba(200,200,210,0.35)', 7);
  web(ctx, 174, 34, 12, 'rgba(200,200,210,0.3)', 7);
  wanderer(ctx, 118, 131);
  vignette(ctx, '#000000', 0.5);
}

/** the catacombs: a wall built of skulls with niches of bones and candles, a passage into the dark */
function catacombs(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0e0b08', '#1c160f', '#241c13']);
  // the wall of skulls
  rect(ctx, 0, 10, W, 96, '#3a3124');
  const bones = ['#d8ccb0', '#cbbd9c', '#bfb08e', '#e2d6bc'];
  for (let r = 0; r < 16; r++)
    for (let c = 0; c < 42; c++) {
      const x = c * 6 + (r % 2 ? 3 : 0) - 2,
        y = 12 + r * 6;
      if (r === 5 || r === 10) continue;
      skull(ctx, x, y, shade(bones[Math.floor(hash(c, r, 5) * 4)], -0.1 - (Math.abs(x - 120) / 240) * 0.3), '#16110b');
    }
  // bands of crossed thigh bones
  for (const y of [42, 72]) {
    rect(ctx, 0, y - 1, W, 6, '#2a2219');
    for (let x = -2; x < W; x += 8) {
      line(ctx, x, y, x + 6, y + 4, '#d0c4a6');
      line(ctx, x + 6, y, x, y + 4, '#bfb08e');
      px(ctx, x, y, '#efe6d0');
      px(ctx, x + 6, y, '#efe6d0');
    }
  }
  // niches with bones and candles
  for (const nx of [34, 76, 164, 206]) {
    arch(ctx, nx, 100, 22, 30, '#6a604e', '#140f0a', 3, 11);
    for (let k = 0; k < 6; k++) line(ctx, nx - 8 + k * 3, 99, nx - 4 + k * 2, 94 - (k % 3), '#bfb08e');
    skull(ctx, nx - 2, 89, '#d8ccb0');
    candle(ctx, nx + 6, 96, 4);
  }
  // the passage
  arch(ctx, 120, 108, 34, 54, '#7a6e58', '#060504', 5, 17);
  dgrad(ctx, 106, 64, 28, 44, ['#060504', '#120d08', '#2a1c10']);
  glow(ctx, 120, 98, 14, '#ff9a40', 0.25);
  torch(ctx, 96, 58);
  torch(ctx, 144, 58);
  // floor with scattered bones
  dgrad(ctx, 0, 106, W, 29, ['#2e261b', '#231c14']);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i, 9, 1) * W),
      y = 110 + Math.floor(hash(9, i, 2) * 22);
    if (hash(i, 3, 3) > 0.6) skull(ctx, x, y, '#bfb08e');
    else line(ctx, x, y, x + 5 + Math.floor(hash(i, 4, 4) * 4), y + Math.floor(hash(4, i, 5) * 3) - 1, '#b0a284');
  }
  vignette(ctx, '#000000', 0.55);
}

/** the ossuary: a chapel of bones with a chandelier of skulls and an altar of the Five */
function ossuary(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#070a08', '#101612', '#18201a']);
  // back wall: pillars of stacked skulls
  rect(ctx, 0, 8, W, 98, '#222a24');
  for (const [x0, w] of [[0, 52], [188, 52], [70, 100]] as [number, number][])
    for (let r = 0; r < 15; r++)
      for (let c = 0; c * 6 < w; c++) skull(ctx, x0 + c * 6 + (r % 2 ? 3 : 0), 12 + r * 6, shade('#cfd0bc', -0.15 - hash(c, r, 7) * 0.25), '#0c100c');
  // the altar: a pyramid of skulls under the five rings
  arch(ctx, 120, 106, 70, 72, '#4a564c', '#0c100d', 5, 35);
  for (let r = 0; r < 6; r++) {
    const n = 9 - r;
    for (let c = 0; c < n; c++) skull(ctx, 120 - n * 3 + c * 6, 100 - r * 5, shade('#e0e2d0', -r * 0.04 - hash(c, r, 8) * 0.12));
  }
  for (const [dx, dy] of [[-8, 0], [8, 0], [-4, -7], [4, -7], [0, 6]] as [number, number][]) ring(ctx, 120 + dx, 54 + dy, 3.4, 3.4, '#a8e0b0', 1);
  glow(ctx, 120, 56, 22, '#8affb0', 0.35);
  // the chandelier of bones
  chain(ctx, 120, 0, 18, '#5a5a50');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 120 + Math.cos(a) * 26,
      y = 24 + Math.sin(a) * 6;
    if (Math.sin(a) < 0) skull(ctx, Math.round(x) - 2, Math.round(y) - 2, '#bfc0ac');
  }
  ring(ctx, 120, 26, 26, 6, '#d8d8c4', 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 120 + Math.cos(a) * 26,
      y = 24 + Math.sin(a) * 6;
    if (Math.sin(a) >= 0) skull(ctx, Math.round(x) - 2, Math.round(y) - 2, '#e0e2d0');
    if (i % 2 === 0) candle(ctx, Math.round(x), Math.round(y) - 2, 3, '#f0ead0');
  }
  // floor
  dgrad(ctx, 0, 106, W, 29, ['#1e2620', '#141a16']);
  for (let k = -5; k <= 5; k++) line(ctx, 120 + k * 18, 106, 120 + k * 50, 135, '#18201a');
  // eerie light from above
  shaft(ctx, [[104, 0], [136, 0], [168, 106], [72, 106]], '#b8ffc8', 0.06);
  vignette(ctx, '#000000', 0.6);
}

/** the drowned ruins: broken columns and arches of a mining town standing in still water */
function flooded(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, 96, ['#04100f', '#08201e', '#0f3230', '#1a4642']);
  // light through cracks in the cave roof
  for (const [x, w] of [[46, 10], [150, 16], [196, 8]] as [number, number][]) shaft(ctx, [[x, 0], [x + w, 0], [x + w * 3, 96], [x - w, 96]], '#9affe0', 0.08);
  // the town behind: rooftops, a tower and the old mine wheel
  for (const [x, w, h] of [[8, 26, 30], [36, 18, 22], [92, 30, 36], [172, 24, 28], [200, 34, 24]] as [number, number, number][]) {
    rect(ctx, x, 96 - h, w, h, '#123230');
    fillPoly(ctx, [[x - 2, 96 - h], [x + w / 2, 96 - h - w * 0.45], [x + w + 2, 96 - h]], '#0f2a28');
    for (let k = 0; k < Math.floor(w / 8); k++) rect(ctx, x + 3 + k * 8, 96 - h + 6, 3, 4, '#0a1a19');
  }
  rect(ctx, 128, 36, 12, 60, '#123230');
  fillPoly(ctx, [[126, 36], [134, 24], [142, 36]], '#0f2a28');
  ring(ctx, 70, 64, 16, 16, '#1e4a46', 1);
  ring(ctx, 70, 64, 15, 15, '#1e4a46', 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(ctx, 70, 64, Math.round(70 + Math.cos(a) * 15), Math.round(64 + Math.sin(a) * 15), '#1e4a46');
  }
  // the near ruins: an aqueduct arch and broken columns
  archRing(ctx, 120, 98, 44, 40, 7, '#3a5a54', 22);
  rect(ctx, 91, 52, 58, 6, '#3a5a54');
  rect(ctx, 91, 52, 58, 1, '#5a7e76');
  for (const [x, top, br] of [[24, 40, 8], [54, 56, 0], [190, 46, 10], [222, 60, 6]] as [number, number, number][]) column(ctx, x, top, 98, 10, '#466a62', br);
  // algae hanging from the stones
  for (let i = 0; i < 20; i++) {
    const x = 92 + Math.floor(hash(i, 4, 1) * 56);
    line(ctx, x, 58, x + (i % 2), 58 + 2 + Math.floor(hash(4, i, 2) * 6), '#3f7a3a');
  }
  // the water
  reflect(ctx, 98, 37, '#0e3a3a', 0.4, 3);
  rect(ctx, 0, 98, W, 1, '#7ae0c8');
  // a fallen statue's head and lily pads
  pell(ctx, 172, 108, 10, 6, '#3e5e58');
  pell(ctx, 168, 105, 4, 2, '#5a7e76');
  px(ctx, 166, 106, '#0a1a19');
  px(ctx, 172, 106, '#0a1a19');
  for (const [x, y, r] of [[30, 112, 4], [44, 120, 3], [206, 116, 5], [120, 126, 3]] as [number, number, number][]) {
    pell(ctx, x, y, r, r * 0.4, '#2e6a3a');
    px(ctx, x + 1, y, '#e8b0d0');
  }
  vignette(ctx, '#000a08', 0.5);
}

/** the demonic underworld: a horned idol carved into the rock, braziers and cracks full of fire */
function demons(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#080203', '#1e0606', '#3e0c08', '#200606']);
  // the cavern's ragged roof
  for (let i = 0; i < 18; i++) {
    const x = i * 14 + Math.round(hash(i, 2, 1) * 6),
      h = 8 + Math.round(hash(2, i, 2) * 20);
    fillPoly(ctx, [[x - 7, 0], [x + 7, 0], [x, h]], i % 2 ? '#1a0606' : '#240808');
  }
  // the idol: a horned head with burning eyes and an open maw
  const cx = 120;
  glow(ctx, cx, 56, 60, '#ff3a10', 0.3);
  fillPoly(ctx, [[cx - 34, 30], [cx - 58, 2], [cx - 30, 20]], '#2a0a08');
  fillPoly(ctx, [[cx + 34, 30], [cx + 58, 2], [cx + 30, 20]], '#2a0a08');
  pell(ctx, cx, 50, 34, 32, '#2e0c0a');
  fillPoly(ctx, [[cx - 30, 54], [cx + 30, 54], [cx + 18, 92], [cx - 18, 92]], '#2e0c0a');
  // brows, eyes and the maw
  fillPoly(ctx, [[cx - 24, 38], [cx - 6, 44], [cx - 24, 46]], '#1a0606');
  fillPoly(ctx, [[cx + 24, 38], [cx + 6, 44], [cx + 24, 46]], '#1a0606');
  for (const ex of [cx - 15, cx + 15]) {
    glow(ctx, ex, 48, 10, '#ff6a1a', 0.7);
    pell(ctx, ex, 48, 5, 2.5, '#ffb347');
    pell(ctx, ex, 48, 2.5, 1.5, '#fff0a0');
  }
  fillPoly(ctx, [[cx - 16, 66], [cx + 16, 66], [cx + 10, 86], [cx - 10, 86]], '#ff6a1a');
  fillPoly(ctx, [[cx - 12, 70], [cx + 12, 70], [cx + 7, 84], [cx - 7, 84]], '#ffd060');
  for (let k = 0; k < 6; k++) {
    fillPoly(ctx, [[cx - 15 + k * 6, 66], [cx - 11 + k * 6, 66], [cx - 13 + k * 6, 71]], '#e8dcc0');
    fillPoly(ctx, [[cx - 12 + k * 5, 86], [cx - 8 + k * 5, 86], [cx - 10 + k * 5, 81]], '#e8dcc0');
  }
  // steps up to the maw
  for (let i = 0; i < 5; i++) rect(ctx, cx - 26 - i * 8, 92 + i * 3, 52 + i * 16, 3, shade('#2a0a08', i * 0.05));
  // braziers
  for (const bx of [40, 200]) {
    glow(ctx, bx, 78, 24, '#ff8a2a', 0.5);
    fillPoly(ctx, [[bx - 8, 84], [bx + 8, 84], [bx + 5, 90], [bx - 5, 90]], '#1a0a08');
    rect(ctx, bx - 1, 90, 3, 14, '#1a0a08');
    rect(ctx, bx - 6, 104, 13, 2, '#1a0a08');
    pell(ctx, bx, 79, 6, 7, '#ff5a1a');
    pell(ctx, bx, 81, 4, 4, '#ffb347');
    pell(ctx, bx, 82, 2, 2, '#fff0a0');
  }
  // the floor: basalt split by glowing cracks and a circle of runes
  dgrad(ctx, 0, 106, W, 29, ['#1a0606', '#120404']);
  ring(ctx, 120, 120, 54, 10, '#c82a10', 1);
  ring(ctx, 120, 120, 46, 8, '#ff5a1a', 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.round(120 + Math.cos(a) * 50),
      y = Math.round(120 + Math.sin(a) * 9);
    rect(ctx, x - 1, y - 1, 3, 2, '#ff8a3a');
  }
  const crack = (pts: number[][]) => {
    for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#ff6a1a');
  };
  crack([[0, 118], [14, 114], [26, 120], [40, 116], [58, 124]]);
  crack([[240, 112], [222, 118], [210, 114], [190, 124], [180, 130]]);
  crack([[70, 135], [80, 128], [92, 132]]);
  glow(ctx, 30, 118, 16, '#ff3a10', 0.35);
  glow(ctx, 214, 116, 16, '#ff3a10', 0.35);
  vignette(ctx, '#000000', 0.5);
}

// ------------------------------------------------------------------ chapter II
/** the mushroom forest: mushrooms as tall as trees, glowing caps and spores */
function mushrooms(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#07040e', '#140a24', '#22103a', '#16202a']);
  // far silhouettes
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 27 + Math.round(hash(i, 3, 1) * 10);
    bigShroom(ctx, x, 104, 30 + hash(3, i, 2) * 24, 9 + hash(i, i, 3) * 7, '#1e1430', '#24163a', '#2c1c46', '#3a2a6a');
  }
  fog(ctx, 70, 30, '#6a4aa0', 0.18, 2);
  // the middle row
  bigShroom(ctx, 60, 112, 56, 22, '#b8a8c8', '#7a2a9a', '#e0a0ff', '#c070ff', 4);
  bigShroom(ctx, 178, 114, 64, 26, '#a8c8c0', '#1a7a7a', '#80ffe0', '#40e0d0', -5);
  bigShroom(ctx, 122, 110, 34, 14, '#c8b0b8', '#a03a6a', '#ffb0d8', '#ff70b0', 2);
  // the ground with little glowing mushrooms
  dgrad(ctx, 0, 110, W, 25, ['#1a1428', '#120e1c']);
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(hash(i, 6, 1) * W),
      g = 114 + Math.floor(hash(6, i, 2) * 18);
    const pal = [['#7a2a9a', '#d070ff'], ['#1a7a7a', '#4ff0d0'], ['#a03a6a', '#ff70b0']][i % 3];
    mushroom(ctx, x, g, 1 + Math.floor(hash(i, 2, 3) * 3), pal[0], pal[1]);
  }
  // giant caps in the front corners
  bigShroom(ctx, 6, 140, 70, 34, '#2a1e3a', '#3a1a52', '#7a4aaa', '#8a4aff', 6);
  bigShroom(ctx, 238, 140, 80, 30, '#1e2a30', '#123a40', '#4a9a9a', '#30c0b0', -6);
  vignette(ctx, '#000000', 0.45);
}

/** the spider nests: curtains of webs, cocoons, a lost lantern and eyes in the dark */
function webs(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#050706', '#0e1410', '#18201a', '#0c100d']);
  range(ctx, 110, 30, 61, '#141c16', 8);
  // stalactites
  for (let i = 0; i < 14; i++) {
    const x = 8 + i * 17 + Math.round(hash(i, 1, 2) * 6),
      h = 8 + Math.round(hash(1, i, 3) * 22);
    fillPoly(ctx, [[x - 5, 0], [x + 5, 0], [x, h]], '#1c241e');
  }
  // the great web and a smaller one
  web(ctx, 96, 52, 58, 'rgba(210,220,205,0.55)', 14);
  web(ctx, 206, 26, 34, 'rgba(210,220,205,0.4)', 10);
  web(ctx, 18, 100, 26, 'rgba(210,220,205,0.3)', 8);
  // cocoons
  cocoon(ctx, 150, 0, 40, 9, '#c8c8b4');
  cocoon(ctx, 170, 0, 58, 11, '#b8b8a4');
  cocoon(ctx, 40, 0, 30, 8, '#c0c0ac');
  // a boot sticking out of the big one
  rect(ctx, 168, 69, 4, 3, '#4a2a1a');
  // Elara's lantern caught in the web
  line(ctx, 74, 30, 78, 40, 'rgba(210,220,205,0.7)');
  lantern(ctx, 78, 40, true);
  // the spider
  line(ctx, 214, 0, 214, 70, 'rgba(210,220,205,0.6)');
  spider(ctx, 214, 76, 6, '#0e0e0c');
  // eyes in the dark
  eyes(ctx, [[22, 60], [30, 64], [228, 104], [128, 110], [60, 118]], '#ff3a2a');
  // floor
  dgrad(ctx, 0, 112, W, 23, ['#141a16', '#0a0e0b']);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(hash(i, 8, 1) * W);
    line(ctx, x, 112, x + 12, 118 + Math.floor(hash(8, i, 2) * 10), 'rgba(210,220,205,0.25)');
  }
  vignette(ctx, '#000000', 0.55);
}

/** the tomb of the desert kings: a golden sarcophagus between two stone kings, sand and treasure */
function tomb(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#120c06', '#2a1c0e', '#3e2a14']);
  // the walls of carved sandstone
  bricks(ctx, 0, 6, W, 100, '#8a6a3c', '#5a4224', 16, 8, 7);
  for (const y of [20, 44, 68]) {
    rect(ctx, 0, y, W, 7, '#a07c48');
    glyphs(ctx, 2, y + 2, W - 4, '#5a3e1e', y);
  }
  // the portal (a tapering doorway) with the sarcophagus standing in it
  fillPoly(ctx, [[86, 106], [94, 30], [146, 30], [154, 106]], '#c89a5a');
  fillPoly(ctx, [[94, 106], [100, 38], [140, 38], [146, 106]], '#140c06');
  rect(ctx, 88, 24, 64, 8, '#d8aa66');
  glyphs(ctx, 92, 26, 56, '#6a4a22', 3);
  glow(ctx, 120, 72, 34, '#ffd060', 0.4);
  // the golden sarcophagus
  fillPoly(ctx, [[110, 104], [108, 56], [112, 46], [120, 42], [128, 46], [132, 56], [130, 104]], '#e0b040');
  pell(ctx, 120, 50, 7, 7, '#f0c858');
  rect(ctx, 116, 49, 3, 1, '#2a1a08');
  rect(ctx, 122, 49, 3, 1, '#2a1a08');
  for (let y = 60; y < 102; y += 5) rect(ctx, 110, y, 20, 2, '#2a4a8a');
  fillPoly(ctx, [[112, 58], [128, 58], [124, 66], [116, 66]], '#c89030');
  line(ctx, 113, 47, 113, 100, '#fff0a0');
  // the stone kings on their thrones
  kingStatue(ctx, 46, 112, 14, '#b08a50');
  kingStatue(ctx, 194, 112, 14, '#b08a50');
  torch(ctx, 76, 50);
  torch(ctx, 164, 50);
  // sand drifting in, and gold
  dgrad(ctx, 0, 106, W, 29, ['#c8a060', '#a8803e']);
  fillPoly(ctx, [[0, 112], [30, 102], [70, 110], [0, 135]], '#d4ae6c');
  fillPoly(ctx, [[240, 106], [200, 112], [176, 135], [240, 135]], '#d4ae6c');
  for (const [x, y] of [[96, 118], [150, 120], [60, 126], [190, 128]] as [number, number][]) {
    pell(ctx, x, y, 8, 3, '#d8a830');
    for (let k = 0; k < 5; k++) px(ctx, x - 6 + Math.floor(hash(k, x, 1) * 12), y - 2 + Math.floor(hash(x, k, 2) * 3), '#fff0a0');
  }
  fillPoly(ctx, [[160, 116], [164, 106], [170, 106], [174, 116]], '#3a6a8a');
  shaft(ctx, [[110, 0], [130, 0], [150, 106], [90, 106]], '#ffe8b0', 0.08);
  vignette(ctx, '#140800', 0.5);
}

/** the roots of the world: giant roots grow through the rock around the glowing second lock */
function roots(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#060805', '#10140a', '#1a1e10', '#0e100a']);
  // far roots
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * 30;
    rootPath(ctx, [[x, -4], [x + 8, 30], [x - 4, 60], [x + 6, 100]], 4, 2, '#1c1a10', '#24220e');
  }
  // the great roots
  rootPath(ctx, [[30, -6], [44, 30], [76, 52], [98, 70], [104, 96]], 12, 5, '#4a3424', '#6a4a30');
  rootPath(ctx, [[214, -6], [196, 26], [160, 50], [140, 72], [136, 98]], 13, 5, '#45311f', '#684a2e');
  rootPath(ctx, [[120, -6], [118, 20], [126, 44], [120, 60]], 9, 6, '#503826', '#70503a');
  rootPath(ctx, [[0, 80], [30, 92], [60, 104], [90, 118]], 8, 4, '#3e2c1c', '#5a402a');
  rootPath(ctx, [[240, 86], [214, 98], [182, 112], [160, 124]], 9, 4, '#3e2c1c', '#5a402a');
  // sap glowing in the bark
  for (const pts of [
    [[44, 30], [76, 52], [98, 70]],
    [[196, 26], [160, 50], [140, 72]],
  ])
    for (let i = 0; i < pts.length - 1; i++) line(ctx, Math.round(pts[i][0]), Math.round(pts[i][1]), Math.round(pts[i + 1][0]), Math.round(pts[i + 1][1]), '#c8e060');
  // the second lock, held in the roots
  glow(ctx, 120, 76, 40, '#e8ff9a', 0.55);
  ring(ctx, 120, 76, 12, 12, '#ffe070', 1);
  ring(ctx, 120, 76, 9, 9, '#c8a030', 1);
  pell(ctx, 120, 76, 5, 5, '#fff6c0');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    px(ctx, Math.round(120 + Math.cos(a) * 12), Math.round(76 + Math.sin(a) * 12), '#ffffff');
  }
  // the Mother's fungus creeping over the roots
  for (const [x, g, s] of [[92, 98, 3], [100, 100, 2], [146, 96, 3], [154, 99, 2], [68, 112, 2], [176, 114, 3]] as [number, number, number][]) mushroom(ctx, x, g, s, '#1a7a6a', '#4ff0d0');
  // hanging rootlets
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(hash(i, 5, 1) * W);
    line(ctx, x, 0, x + Math.round((hash(5, i, 2) - 0.5) * 4), 6 + Math.floor(hash(i, 6, 3) * 20), '#2e2618');
  }
  dgrad(ctx, 0, 116, W, 19, ['#1a160c', '#100e08']);
  vignette(ctx, '#000000', 0.5);
}

// ------------------------------------------------------------------ chapter III
/** the crystal caves: clusters of singing crystals throwing coloured light */
function crystals(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#05040e', '#0e0c26', '#1a1640', '#100c26']);
  range(ctx, 104, 40, 71, '#120f2a', 7);
  // rays from the crystals
  shaft(ctx, [[118, 60], [124, 60], [200, 0], [170, 0]], '#c8f4ff', 0.08);
  shaft(ctx, [[116, 60], [122, 60], [60, 0], [36, 0]], '#ffc8f0', 0.07);
  // the great cluster in the middle
  glow(ctx, 120, 78, 44, '#a070ff', 0.4);
  prism(ctx, 120, 106, 58, 9, 2, '#6a3ad8', '#b890ff');
  prism(ctx, 106, 106, 38, 7, -8, '#5a2ac0', '#a080f0');
  prism(ctx, 134, 106, 42, 7, 9, '#7a4ae0', '#c8a8ff');
  prism(ctx, 96, 108, 22, 5, -10, '#4a2aa0', '#9070e0');
  prism(ctx, 146, 108, 24, 5, 12, '#5a34b8', '#a890f0');
  // the cyan and pink clusters at the sides
  glow(ctx, 30, 96, 30, '#40d0ff', 0.35);
  prism(ctx, 24, 116, 46, 7, -6, '#1a8ab8', '#6ad8ff');
  prism(ctx, 40, 116, 30, 6, 6, '#1a7aa8', '#5ac8f0');
  prism(ctx, 12, 118, 22, 5, -10, '#16688e', '#4ab8e0');
  glow(ctx, 208, 98, 30, '#ff70c8', 0.35);
  prism(ctx, 212, 118, 44, 7, 6, '#a82a7a', '#ff8ad0');
  prism(ctx, 196, 118, 28, 6, -6, '#922a6a', '#f07ac0');
  prism(ctx, 228, 120, 24, 5, 10, '#7a2058', '#e070b0');
  // crystals growing from the roof
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 26 + Math.round(hash(i, 4, 1) * 8);
    const h = 8 + Math.round(hash(4, i, 2) * 14);
    fillPoly(ctx, [[x - 3, 0], [x + 3, 0], [x, h]], i % 2 ? '#3a2a8a' : '#2a5a8a');
    px(ctx, x, h - 1, '#c8f4ff');
  }
  // the floor, glassy
  dgrad(ctx, 0, 112, W, 23, ['#1a1438', '#0e0a22']);
  for (let i = 0; i < 30; i++) px(ctx, Math.floor(hash(i, 7, 1) * W), 114 + Math.floor(hash(7, i, 2) * 20), ['#c8f4ff', '#ffc8f0', '#b890ff'][i % 3]);
  vignette(ctx, '#000000', 0.45);
}

/** the dwarven halls: a long hall of square pillars, a headless king and the glow of a far forge */
function dwarves(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#080604', '#14100a', '#201810']);
  const vx = 120,
    vy = 62;
  // the far end: the forge's glow and the headless statue
  glow(ctx, vx, vy + 10, 40, '#ff8a2a', 0.45);
  rect(ctx, vx - 24, vy - 30, 48, 52, '#1a140c');
  kingStatue(ctx, vx, vy + 22, 9, '#5a4a36', true);
  // floor and ceiling in perspective
  fillPoly(ctx, [[0, 135], [vx - 30, vy + 22], [vx + 30, vy + 22], [240, 135]], '#2a2016');
  fillPoly(ctx, [[0, 0], [vx - 30, vy - 30], [vx + 30, vy - 30], [240, 0]], '#0c0906');
  // the faded carpet
  fillPoly(ctx, [[96, 135], [vx - 6, vy + 22], [vx + 6, vy + 22], [144, 135]], '#5a1a14');
  for (let k = 0; k < 6; k++) {
    const t = Math.pow(k / 6, 1.6);
    const y = Math.round(vy + 22 + t * (135 - vy - 22));
    line(ctx, Math.round(vx - 6 - t * 18), y, Math.round(vx + 6 + t * 18), y, '#7a2a1c');
  }
  // the rows of pillars, the nearer the bigger
  for (let k = 4; k >= 0; k--) {
    const t = (k + 1) / 5.5;
    const s = 1 - t * 0.82;
    for (const side of [-1, 1]) {
      const x = vx + side * (30 + (120 - 30) * s * 1.05);
      const w = Math.max(4, Math.round(26 * s));
      const top = Math.round(vy - 30 - (vy + 30) * s * 0.9),
        bot = Math.round(vy + 22 + (135 - vy - 22) * s);
      const col = shade('#5a4a36', -0.45 * t);
      rect(ctx, Math.round(x - w / 2), top, w, bot - top, col);
      rect(ctx, Math.round(x - w / 2) - 2, top, w + 4, Math.max(2, Math.round(5 * s)), shade(col, 0.15));
      rect(ctx, Math.round(x - w / 2) - 2, bot - Math.max(2, Math.round(5 * s)), w + 4, Math.max(2, Math.round(5 * s)), shade(col, 0.1));
      rect(ctx, Math.round(x - w / 2) + (side < 0 ? w - 2 : 0), top, 2, bot - top, shade(col, side < 0 ? 0.18 : -0.25));
      // rune carved in the pillar, glowing faintly
      if (s > 0.3) {
        // a dwarven rune: a diamond on a stave
        const ry = Math.round((top + bot) / 2),
          rx = Math.round(x),
          r = Math.max(2, Math.round(3 * s));
        rect(ctx, rx, ry - r * 2, 1, r * 4, '#ffb050');
        line(ctx, rx - r, ry, rx, ry - r, '#ffb050');
        line(ctx, rx, ry - r, rx + r, ry, '#ffb050');
        line(ctx, rx + r, ry, rx, ry + r, '#ffb050');
        line(ctx, rx, ry + r, rx - r, ry, '#ffb050');
        glow(ctx, x, ry, 8 * s + 2, '#ff9a3a', 0.3);
      }
      // a lantern on a chain between the pillars
      if (k % 2 === 0) {
        const lx = Math.round(x + side * -14 * s);
        chain(ctx, lx, 0, Math.round(top + 10 * s), '#3a3026');
        glow(ctx, lx, top + 12 * s, 10 * s + 3, '#ffb050', 0.5);
        rect(ctx, lx - 1, Math.round(top + 10 * s), 3, Math.max(2, Math.round(4 * s)), '#ffd080');
      }
    }
  }
  vignette(ctx, '#000000', 0.55);
}

/** the drowned cathedral: a rose window of coloured glass, pillars and bells under the water */
function cathedral(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, 96, ['#030614', '#081230', '#0e1c44', '#132656']);
  // the nave's back wall with the rose window
  rect(ctx, 56, 8, 128, 88, '#16224a');
  const cx = 120,
    cy = 42;
  glow(ctx, cx, cy, 52, '#c8a8ff', 0.35);
  pell(ctx, cx, cy, 27, 27, '#2a2a4a');
  const glass = ['#e04a4a', '#4a7ae0', '#e0c04a', '#4ac07a', '#c04ae0', '#4ad0e0'];
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2,
      a1 = ((i + 1) / 12) * Math.PI * 2;
    fillPoly(ctx, [[cx, cy], [cx + Math.cos(a0) * 24, cy + Math.sin(a0) * 24], [cx + Math.cos((a0 + a1) / 2) * 25, cy + Math.sin((a0 + a1) / 2) * 25], [cx + Math.cos(a1) * 24, cy + Math.sin(a1) * 24]], glass[i % 6]);
    line(ctx, cx, cy, Math.round(cx + Math.cos(a0) * 24), Math.round(cy + Math.sin(a0) * 24), '#1a1a30');
  }
  ring(ctx, cx, cy, 24, 24, '#1a1a30', 1);
  ring(ctx, cx, cy, 12, 12, '#1a1a30', 1);
  pell(ctx, cx, cy, 6, 6, '#fff0c0');
  // its light falling into the water
  shaft(ctx, [[cx - 18, cy + 16], [cx + 18, cy + 16], [cx + 44, 96], [cx - 44, 96]], '#d8c8ff', 0.1);
  // tall windows at the sides
  for (const x of [72, 168]) {
    fillPoly(ctx, archPts(x, 80, 12, 44, 8), '#2a3a7a');
    fillPoly(ctx, archPts(x, 80, 8, 40, 5), '#5a7ad0');
    rect(ctx, x, 40, 1, 40, '#2a3a7a');
  }
  // clustered pillars and the vault
  for (const x of [22, 50, 190, 218]) {
    rect(ctx, x - 6, 0, 12, 96, '#1e2a5a');
    rect(ctx, x - 6, 0, 2, 96, '#2e3e7a');
    rect(ctx, x + 4, 0, 2, 96, '#141c40');
    rect(ctx, x - 1, 0, 2, 96, '#26346a');
  }
  archRing(ctx, 120, 120, 150, 118, 8, '#1a2450', 90);
  // a drowned bell
  chain(ctx, 36, 0, 40, '#4a4a3a');
  fillPoly(ctx, [[30, 44], [42, 44], [46, 58], [26, 58]], '#8a7a3a');
  pell(ctx, 36, 44, 6, 4, '#8a7a3a');
  rect(ctx, 26, 57, 20, 2, '#a8984a');
  // the water fills the nave
  reflect(ctx, 96, 39, '#0a1840', 0.45, 5);
  rect(ctx, 0, 96, W, 1, '#8aa8ff');
  vignette(ctx, '#000008', 0.5);
}

/** the gate of the underworld: a colossal chained door glowing from within, a tiny figure before it */
function hellgate(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0a0204', '#1a0406', '#2a0806', '#120304']);
  // the rock around the gate
  range(ctx, 40, 40, 81, '#140406', 6);
  // the gate's frame
  const cx = 120;
  fillPoly(ctx, archPts(cx, 112, 120, 104, 70), '#3a2a2a');
  fillPoly(ctx, archPts(cx, 112, 104, 96, 60), '#0a0404');
  // the doors, slightly open
  fillPoly(ctx, [[cx - 52, 112], [cx - 52, 40], [cx - 3, 22], [cx - 3, 112]], '#2a1a16');
  fillPoly(ctx, [[cx + 52, 112], [cx + 52, 40], [cx + 3, 22], [cx + 3, 112]], '#261612');
  glow(ctx, cx, 70, 40, '#ff3a10', 0.55);
  rect(ctx, cx - 3, 22, 6, 90, '#ff6a1a');
  rect(ctx, cx - 1, 22, 2, 90, '#fff0a0');
  // iron bands and rivets
  for (const y of [44, 66, 88, 106]) {
    rect(ctx, cx - 52, y, 49, 4, '#3a3236');
    rect(ctx, cx + 3, y, 49, 4, '#3a3236');
    for (let x = cx - 50; x < cx + 52; x += 7) if (Math.abs(x - cx) > 4) px(ctx, x, y + 1, '#8a7a7a');
  }
  // the skull keystone
  pell(ctx, cx, 14, 9, 8, '#c8b8a0');
  rect(ctx, cx - 4, 19, 8, 4, '#c8b8a0');
  pell(ctx, cx - 4, 13, 2.4, 2.4, '#ff3a10');
  pell(ctx, cx + 4, 13, 2.4, 2.4, '#ff3a10');
  for (let k = -3; k <= 3; k += 2) px(ctx, cx + k, 22, '#3a2a2a');
  // the great chains across the doors
  swag(ctx, 0, 30, cx - 20, 60, 12, '#5a4a4a');
  swag(ctx, 240, 26, cx + 20, 62, 12, '#5a4a4a');
  swag(ctx, 0, 70, cx - 40, 84, 6, '#4a3a3a');
  swag(ctx, 240, 74, cx + 40, 86, 6, '#4a3a3a');
  // stairs and spikes with skulls
  for (let i = 0; i < 6; i++) rect(ctx, cx - 60 - i * 10, 112 + i * 4, 120 + i * 20, 4, shade('#3a2a2a', -i * 0.06));
  for (const x of [26, 46, 194, 214]) {
    rect(ctx, x, 70, 2, 50, '#2a2226');
    skull(ctx, x - 2, 66, '#c8b8a0');
  }
  wanderer(ctx, cx, 131);
  vignette(ctx, '#000000', 0.5);
}

// ------------------------------------------------------------------ chapter IV
/** the ashen plains: grey dunes under a smouldering stone sky, dead trees and the citadel far away */
function ashes(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, 90, ['#0a0404', '#2a0c06', '#5a1c0a', '#8a3a14', '#b8641e']);
  // the citadel on the horizon
  glow(ctx, 196, 60, 30, '#a050ff', 0.35);
  rect(ctx, 190, 34, 8, 44, '#140a18');
  fillPoly(ctx, [[188, 34], [194, 18], [200, 34]], '#140a18');
  rect(ctx, 180, 50, 6, 28, '#140a18');
  fillPoly(ctx, [[179, 50], [183, 40], [187, 50]], '#140a18');
  rect(ctx, 202, 46, 7, 32, '#140a18');
  fillPoly(ctx, [[201, 46], [205, 36], [210, 46]], '#140a18');
  px(ctx, 193, 30, '#e0b0ff');
  // ash dunes
  range(ctx, 84, 10, 91, '#3a3436', 5);
  range(ctx, 96, 12, 93, '#4a4446', 6);
  range(ctx, 112, 14, 95, '#5e5858', 7);
  dgrad(ctx, 0, 112, W, 23, ['#6a6464', '#4e4848']);
  // burnt trees
  deadTree(ctx, 40, 112, 20, Math.PI / 2 + 0.1, 4, '#120c0c', 3);
  deadTree(ctx, 70, 100, 12, Math.PI / 2 - 0.1, 3, '#1e1616', 7);
  deadTree(ctx, 150, 104, 14, Math.PI / 2 + 0.15, 3, '#1a1414', 11);
  // the path of footprints and the wanderer
  for (let i = 0; i < 10; i++) px(ctx, 104 + i * 5 + (i % 2), 128 - i * 2, '#3a3434');
  wanderer(ctx, 104, 132);
  // embers in the sky
  for (let i = 0; i < 30; i++) px(ctx, Math.floor(hash(i, 3, 1) * W), Math.floor(hash(3, i, 2) * 80), hash(i, i, 3) > 0.5 ? '#ffb347' : '#ff6a1a');
  vignette(ctx, '#000000', 0.45);
}

/** the rotting swamp: dead trees in green water, mist and will-o'-wisps */
function swamp(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, 96, ['#030604', '#0a140a', '#14240e', '#22361a']);
  fog(ctx, 50, 40, '#9ac87a', 0.2, 3);
  // trees in the back and front
  for (const [x, h, c] of [[20, 50, '#0e1a0c'], [70, 40, '#0e1a0c'], [180, 54, '#0e1a0c'], [214, 38, '#0e1a0c']] as [number, number, string][]) {
    rect(ctx, x - 2, 96 - h, 5, h, c);
    deadTree(ctx, x, 96 - h, h * 0.35, Math.PI / 2, 3, c, x);
  }
  deadTree(ctx, 132, 96, 30, Math.PI / 2 + 0.2, 4, '#1a2410', 5);
  rect(ctx, 128, 70, 6, 26, '#1a2410');
  // hanging moss
  for (let i = 0; i < 16; i++) {
    const x = 110 + Math.floor(hash(i, 2, 1) * 50);
    line(ctx, x, 46 + Math.floor(hash(2, i, 2) * 10), x, 60 + Math.floor(hash(i, 3, 3) * 14), '#4a6a2a');
  }
  // the water
  reflect(ctx, 96, 39, '#1a3a14', 0.5, 7);
  rect(ctx, 0, 96, W, 1, '#8ac860');
  // a rotten log, lily pads and reeds
  fillPoly(ctx, [[30, 108], [92, 102], [94, 108], [32, 114]], '#2a2416');
  pell(ctx, 92, 105, 3, 3, '#3a3220');
  for (const [x, y] of [[150, 114], [170, 122], [204, 110], [60, 126]] as [number, number][]) pell(ctx, x, y, 5, 2, '#3a6a24');
  for (let i = 0; i < 12; i++) {
    const x = 6 + Math.floor(hash(i, 6, 1) * 40);
    line(ctx, x, 100, x + (i % 3) - 1, 84 + Math.floor(hash(6, i, 2) * 10), '#3a5a20');
  }
  // will-o'-wisps
  for (const [x, y] of [[96, 70], [160, 60], [48, 80], [200, 84]] as [number, number][]) {
    glow(ctx, x, y, 12, '#d8ff7a', 0.6);
    pell(ctx, x, y, 1.6, 1.6, '#f8ffd0');
  }
  fog(ctx, 92, 18, '#b8e09a', 0.22, 9);
  vignette(ctx, '#000000', 0.5);
}

/** the obsidian deep: spires of black glass over a lake of fire, and a face in one of them */
function obsidian(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#05020a', '#120614', '#24081a', '#3a0c10']);
  // the lake of fire
  for (let y = 104; y < H; y++)
    for (let x = 0; x < W; x++) {
      const w = Math.sin(x * 0.08 + y * 0.5) + Math.sin(x * 0.025 - y * 0.35);
      px(ctx, x, y, w > 1.2 ? '#ffd080' : w > 0.4 ? '#ff8a2a' : w > -0.5 ? '#d8401a' : '#8a1a0a');
    }
  glow(ctx, 120, 110, 120, '#ff5a1a', 0.25);
  // spires
  const spire = (x: number, base: number, h: number, w: number, lean: number) => {
    prism(ctx, x, base, h, w, lean, '#0a060c', '#1a1220');
    // fire reflected on the edges
    line(ctx, Math.round(x - w), base, Math.round(x - w + lean * 0.75), Math.round(base - h * 0.78), '#ff7a2a');
    line(ctx, Math.round(x + lean * 0.35), base - 1, Math.round(x + lean), base - h, '#c77dff');
  };
  spire(30, 108, 70, 12, 6);
  spire(64, 106, 46, 8, -4);
  spire(176, 106, 60, 10, -8);
  spire(214, 108, 86, 13, 4);
  spire(150, 106, 30, 6, 3);
  // the great slab with the face in it
  fillPoly(ctx, [[94, 106], [98, 30], [142, 26], [146, 106]], '#0c0810');
  line(ctx, 98, 30, 142, 26, '#ff8a3a');
  line(ctx, 94, 106, 98, 30, '#5a2a6a');
  ctx.save();
  ctx.globalAlpha = 0.35;
  pell(ctx, 120, 62, 14, 18, '#6a2a8a');
  ctx.restore();
  pell(ctx, 114, 58, 2.5, 1.5, '#e0a0ff');
  pell(ctx, 126, 58, 2.5, 1.5, '#e0a0ff');
  glow(ctx, 120, 58, 14, '#c77dff', 0.35);
  vignette(ctx, '#000000', 0.45);
}

/** the shadow citadel: a black castle under a violet vortex, one window lit in the highest tower */
function citadel(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#05020a', '#120620', '#24103a', '#1a0a26']);
  for (let k = 0; k < 7; k++) ring(ctx, 132, 24, 20 + k * 14, 6 + k * 4, k % 2 ? '#2a1446' : '#341a56', 2);
  stars(ctx, 30, 60, 77);
  // the cliff
  fillPoly(ctx, [[60, 135], [70, 100], [96, 92], [180, 90], [206, 104], [220, 135]], '#0c0612');
  // the citadel
  const C = '#0a0410';
  rect(ctx, 96, 60, 72, 34, C);
  for (let x = 96; x < 168; x += 6) rect(ctx, x, 57, 3, 3, C);
  rect(ctx, 124, 20, 16, 74, C);
  fillPoly(ctx, [[121, 20], [132, 0], [143, 20]], C);
  rect(ctx, 100, 38, 12, 56, C);
  fillPoly(ctx, [[98, 38], [106, 22], [114, 38]], C);
  rect(ctx, 152, 42, 12, 52, C);
  fillPoly(ctx, [[150, 42], [158, 28], [166, 42]], C);
  // the lit window and the gate
  glow(ctx, 132, 30, 12, '#d8a0ff', 0.6);
  rect(ctx, 131, 28, 2, 4, '#f0d0ff');
  for (const [x, y] of [[104, 50], [156, 54], [110, 70], [150, 74]] as [number, number][]) rect(ctx, x, y, 1, 2, '#6a3a9a');
  fillPoly(ctx, archPts(132, 94, 12, 16, 6), '#3a1a5a');
  // shadow wings around the highest tower
  for (const d of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const y0 = 26 + k * 6;
      fillPoly(ctx, [[132 + d * 10, y0], [132 + d * (40 + k * 6), y0 - 12 + k * 4], [132 + d * (30 + k * 4), y0 + 6]], k % 2 ? '#1a0a2a' : '#24103a');
    }
  // the bridge and the wanderer on it
  fillPoly(ctx, [[0, 120], [96, 96], [100, 100], [0, 126]], '#120a18');
  for (let x = 4; x < 96; x += 8) rect(ctx, x, Math.round(120 - x * 0.25) - 3, 1, 3, '#120a18');
  wanderer(ctx, 30, 114);
  vignette(ctx, '#000000', 0.45);
}

// ------------------------------------------------------------------ chapter V
/** the floating islands: rocks drifting in the starry void, waterfalls falling into nothing */
function islands(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#020208', '#080a20', '#10123a', '#0a0a26']);
  stars(ctx, 120, H, 33);
  glow(ctx, 60, 40, 50, '#4a5aff', 0.2);
  const island = (x: number, y: number, w: number, seed: number) => {
    fillPoly(ctx, [[x - w, y], [x + w, y], [x + w * 0.6, y + w * 0.4], [x + w * 0.2, y + w * 0.95], [x - w * 0.3, y + w * 0.6], [x - w * 0.8, y + w * 0.3]], '#2a2440');
    fillPoly(ctx, [[x - w, y], [x + w, y], [x + w * 0.7, y + 3], [x - w * 0.8, y + 3]], '#3a6a4a');
    rect(ctx, Math.round(x - w), y, Math.round(w * 2), 1, '#6ac07a');
    for (let k = 0; k < 4; k++) line(ctx, Math.round(x - w * 0.5 + k * w * 0.3), Math.round(y + w * 0.4), Math.round(x - w * 0.5 + k * w * 0.3 + (hash(k, seed, 1) - 0.5) * 4), Math.round(y + w * 0.4 + 4 + hash(seed, k, 2) * 8), '#3a3050');
  };
  island(46, 80, 30, 1);
  island(186, 58, 26, 2);
  island(120, 104, 18, 3);
  island(210, 112, 12, 4);
  island(120, 30, 14, 5);
  // a ruined arch and crystals on the big island
  archRing(ctx, 46, 80, 16, 20, 4, '#6a6080', 8);
  prism(ctx, 66, 80, 12, 3, 2, '#3a7ad8', '#8ac8ff');
  glow(ctx, 66, 74, 10, '#6ac0ff', 0.4);
  // waterfalls into nothing
  for (let x = 176; x < 184; x++) {
    const len = 30 + Math.floor(hash(x, 1, 2) * 30);
    for (let y = 58; y < 58 + len; y++) if (hash(x, y, 3) > (y - 58) / len) px(ctx, x, y, hash(x, y, 4) > 0.5 ? '#c8e8ff' : '#7ab0e0');
  }
  // bridges between them
  swag(ctx, 76, 80, 160, 58, 10, '#8a7a5a');
  swag(ctx, 138, 104, 198, 112, 4, '#8a7a5a');
  wanderer(ctx, 112, 104);
  vignette(ctx, '#000000', 0.4);
}

/** the mirror palace: tall mirrors in silver frames, each showing someone else */
function mirrors(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#0a0812', '#18142a', '#221c3a']);
  rect(ctx, 0, 8, W, 92, '#1e1a30');
  // the chequered floor in perspective
  const vy = 100;
  for (let r = 0; r < 8; r++) {
    const y0 = vy + Math.round(Math.pow(r / 8, 1.5) * 35),
      y1 = vy + Math.round(Math.pow((r + 1) / 8, 1.5) * 35);
    for (let c = -10; c < 10; c++) {
      const f0 = 0.3 + (0.7 * (y0 - vy)) / 35,
        f1 = 0.3 + (0.7 * (y1 - vy)) / 35;
      fillPoly(ctx, [[120 + c * 16 * f0, y0], [120 + (c + 1) * 16 * f0, y0], [120 + (c + 1) * 16 * f1, y1], [120 + c * 16 * f1, y1]], (r + c) % 2 ? '#d8d4e8' : '#2a2440');
    }
  }
  // the mirrors and what they show
  const show = ['crown', 'shadow', 'beast', 'none', 'crown2'];
  for (let i = 0; i < 5; i++) {
    const x = 32 + i * 44;
    fillPoly(ctx, archPts(x, 96, 34, 76, 22), '#a8a8c0');
    fillPoly(ctx, archPts(x, 94, 28, 72, 18), '#4a4a6a');
    dgrad(ctx, x - 13, 30, 26, 62, ['#6a6a90', '#4a4a6a', '#3a3a58']);
    line(ctx, x - 10, 40, x - 2, 30, '#c8c8e0');
    // figure
    const f = '#1a1428';
    if (show[i] !== 'none') {
      pell(ctx, x, 62, 4, 4.5, f);
      fillPoly(ctx, [[x - 6, 92], [x - 5, 68], [x + 5, 68], [x + 6, 92]], f);
    }
    if (show[i] === 'crown' || show[i] === 'crown2') for (const dx of [-3, 0, 3]) fillPoly(ctx, [[x + dx - 1, 58], [x + dx, 54], [x + dx + 1, 58]], '#e0c050');
    if (show[i] === 'beast') {
      fillPoly(ctx, [[x - 4, 59], [x - 9, 50], [x - 3, 56]], f);
      fillPoly(ctx, [[x + 4, 59], [x + 9, 50], [x + 3, 56]], f);
      px(ctx, x - 2, 62, '#ff3a3a');
      px(ctx, x + 2, 62, '#ff3a3a');
    }
    if (show[i] === 'shadow') {
      px(ctx, x - 2, 62, '#c77dff');
      px(ctx, x + 2, 62, '#c77dff');
      glow(ctx, x, 70, 12, '#7a3aff', 0.35);
    }
    rect(ctx, x - 15, 94, 30, 3, '#c8c8dc');
  }
  // chandelier
  chain(ctx, 120, 0, 10, '#8a8aa0');
  ring(ctx, 120, 14, 18, 4, '#c8c8dc', 1);
  for (let i = 0; i < 6; i++) candle(ctx, Math.round(120 - 15 + i * 6), 13, 3, '#f0f0ff');
  vignette(ctx, '#000000', 0.5);
}

/** the deep of dreams: doors floating in a pastel sky, stairs to nowhere and a moon with an eye */
function dreams(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#1a0a3a', '#4a1a6a', '#a04a8a', '#e08aa0', '#80c8d0']);
  // the moon with an eye
  glow(ctx, 186, 34, 34, '#fff0d0', 0.45);
  pell(ctx, 186, 34, 18, 18, '#fff4dc');
  pell(ctx, 194, 30, 15, 16, '#a85a9a');
  pell(ctx, 180, 34, 5, 3, '#ffffff');
  pell(ctx, 180, 34, 2, 2.5, '#3a1a5a');
  // clouds
  for (const [x, y, s] of [[40, 100, 1.4], [150, 112, 1.2], [214, 92, 0.9], [90, 70, 0.8]] as [number, number, number][]) {
    for (const [dx, dy, r] of [[-10, 2, 8], [0, -2, 11], [12, 1, 9], [22, 3, 6]] as [number, number, number][]) pell(ctx, x + dx * s, y + dy * s, r * s, r * 0.6 * s, '#f8e0f0');
    rect(ctx, Math.round(x - 16 * s), Math.round(y + 3 * s), Math.round(44 * s), 2, '#e0b8d8');
  }
  // floating doors, one of them open
  const door = (x: number, y: number, open: boolean, tilt: number) => {
    fillPoly(ctx, [[x, y], [x + 14, y + tilt], [x + 14, y + 24 + tilt], [x, y + 24]], '#5a2a1a');
    fillPoly(ctx, [[x + 2, y + 2], [x + 12, y + 2 + tilt], [x + 12, y + 22 + tilt], [x + 2, y + 22]], open ? '#fff6d0' : '#8a4a2a');
    if (open) glow(ctx, x + 7, y + 12, 18, '#fff0b0', 0.5);
    else px(ctx, x + 10, y + 12 + tilt, '#ffd060');
  };
  door(30, 30, false, 3);
  door(120, 44, true, -2);
  door(64, 16, false, -3);
  // stairs to nowhere
  for (let i = 0; i < 9; i++) rect(ctx, 150 + i * 7, 104 - i * 9, 9, 3, '#3a2a5a');
  // little floating lanterns and a toy horse
  for (const [x, y] of [[100, 26], [214, 70], [24, 64], [160, 20]] as [number, number][]) lantern(ctx, x, y, true);
  fillPoly(ctx, [[86, 100], [100, 100], [102, 94], [98, 92], [88, 94]], '#c87a3a');
  rect(ctx, 86, 100, 2, 4, '#c87a3a');
  rect(ctx, 98, 100, 2, 4, '#c87a3a');
  fillPoly(ctx, [[84, 104], [104, 104], [100, 107], [88, 107]], '#8a4a1a');
  vignette(ctx, '#140028', 0.4);
}

/** the bottom of the world: black glass over the eye of Nyx'thar, cracks of light and the last lock */
function bottom(ctx: Ctx) {
  dgrad(ctx, 0, 0, W, H, ['#020104', '#08040e', '#12061a', '#1e0814']);
  // tendrils rising from the dark
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 28;
    rootPath(ctx, [[x, 100], [x + 6, 70], [x - 6, 44], [x + 4, 20 - (i % 3) * 6]], 4, 1, '#16081e', '#2a1438');
  }
  // the ring of the last lock hovering
  glow(ctx, 120, 44, 36, '#ffd27a', 0.3);
  ring(ctx, 120, 44, 24, 24, '#c8902a', 1);
  ring(ctx, 120, 44, 22, 22, '#ffd27a', 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    pell(ctx, 120 + Math.cos(a) * 23, 44 + Math.sin(a) * 23, 2, 2, '#fff2c0');
  }
  // the floor of black glass and the eye beneath it
  fillPoly(ctx, [[0, 135], [0, 92], [240, 92], [240, 135]], '#0a0610');
  glow(ctx, 120, 116, 70, '#c0204a', 0.4);
  pell(ctx, 120, 116, 56, 14, '#2a0618');
  pell(ctx, 120, 116, 44, 11, '#8a1a3a');
  pell(ctx, 120, 116, 30, 9, '#e04a6a');
  pell(ctx, 120, 116, 4, 9, '#0a0206');
  px(ctx, 110, 112, '#ffd0e0');
  // cracks over it
  const crack = (pts: number[][]) => {
    for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#ff7a9a');
  };
  crack([[20, 96], [40, 104], [62, 100], [80, 110]]);
  crack([[220, 98], [200, 106], [176, 102], [160, 112]]);
  crack([[120, 92], [118, 100], [124, 104]]);
  ctx.save();
  ctx.globalAlpha = 0.45;
  rect(ctx, 0, 92, W, 43, '#05020a');
  ctx.restore();
  rect(ctx, 0, 92, W, 1, '#5a2a6a');
  wanderer(ctx, 120, 102);
  vignette(ctx, '#000000', 0.45);
}

export const AREA_PAINTERS = {
  crypt,
  catacombs,
  ossuary,
  flooded,
  demons,
  mushrooms,
  webs,
  tomb,
  roots,
  crystals,
  dwarves,
  cathedral,
  hellgate,
  ashes,
  swamp,
  obsidian,
  citadel,
  islands,
  mirrors,
  dreams,
  bottom,
};

export const AREA_PARTICLES: Record<keyof typeof AREA_PAINTERS, { kind: ParticleKind; color: string[]; n: number }> = {
  crypt: { kind: 'dust', color: ['#d8c8a8', '#a89878'], n: 22 },
  catacombs: { kind: 'dust', color: ['#e0d0b0', '#b0a080'], n: 20 },
  ossuary: { kind: 'motes', color: ['#c8f0c0', '#90c890'], n: 16 },
  flooded: { kind: 'drip', color: ['#bfe8ff', '#9ad8e8'], n: 12 },
  demons: { kind: 'embers', color: ['#ff6a1a', '#ffb347'], n: 34 },
  mushrooms: { kind: 'spores', color: ['#d0a0ff', '#80ffe0', '#ffd0ff'], n: 30 },
  webs: { kind: 'dust', color: ['#8a9a88', '#c8d0c4'], n: 14 },
  tomb: { kind: 'dust', color: ['#f0d8a0', '#d8b878'], n: 26 },
  roots: { kind: 'spores', color: ['#e8ff9a', '#b0ff70'], n: 24 },
  crystals: { kind: 'sparkle', color: ['#ffffff', '#c8f4ff', '#ffc8f0'], n: 30 },
  dwarves: { kind: 'embers', color: ['#ff9a3a', '#ffd060'], n: 16 },
  cathedral: { kind: 'motes', color: ['#b8d8ff', '#fff0c8'], n: 20 },
  hellgate: { kind: 'embers', color: ['#ff4a1a', '#ff9a3a'], n: 36 },
  ashes: { kind: 'ash', color: ['#9a9a9a', '#c8c4c0', '#5a5656'], n: 50 },
  swamp: { kind: 'motes', color: ['#d8ff7a', '#a8ff9a'], n: 18 },
  obsidian: { kind: 'embers', color: ['#ff8a3a', '#c77dff'], n: 24 },
  citadel: { kind: 'motes', color: ['#c77dff', '#8a4aff'], n: 26 },
  islands: { kind: 'twinkle', color: ['#ffffff', '#c8d0f0'], n: 20 },
  mirrors: { kind: 'sparkle', color: ['#ffffff', '#e0d8ff'], n: 26 },
  dreams: { kind: 'motes', color: ['#ffd0f0', '#c8f0ff', '#fff0b0'], n: 26 },
  bottom: { kind: 'embers', color: ['#ff4a6a', '#c77dff'], n: 30 },
};
