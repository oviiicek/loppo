// The ground of the village, painted pixel by pixel at double detail (like the dungeon tiles): grass
// with flowers, cobbled paths that sink into the meadow, the round paving of the square, the pond with
// its shore, the palace courtyard, garden beds, the graveyard and the gravel around the castle ruins.
// What lies where comes from systems/villagemap.ts, so the painted ground and the walkable grid agree.
// It is painted once per session (the village never changes its shape) and kept as a few big textures.
import { G, GInfo, Seg, groundInfo, segsNear, pondValue, vnoise, VW, VH, PLAZA, PIER, POND } from '../systems/villagemap';

/** ground pixels per tile (the world has 16, the ground is drawn at double detail) */
const S = 32;
/** chunk size in tiles: 2 × 2 chunks of 1024 × 768 cover the village */
const CW = 32,
  CH = 24;
const TEX = 128;

// ------------------------------------------------------------------ colours and noise
const rgb = (hex: string) => parseInt(hex.slice(1), 16);
/** a colour as the little-endian pixel of ImageData (alpha 255) */
const px32 = (c: number) => (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
const scale = (c: number, k: number) => {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * k))),
    g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * k))),
    b = Math.min(255, Math.max(0, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
};
const mix = (a: number, b: number, t: number) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t),
    g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t),
    bb = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bb);
};

function hh(x: number, y: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** tileable value noise (period in lattice cells) in 0..1 */
function tnoise(x: number, y: number, period: number, s: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const w = (v: number) => ((v % period) + period) % period;
  const a = hh(w(ix), w(iy), s),
    b = hh(w(ix + 1), w(iy), s),
    c = hh(w(ix), w(iy + 1), s),
    d = hh(w(ix + 1), w(iy + 1), s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** a tileable texture of TEX × TEX pixels (colours as 0xRRGGBB) */
function texture(fn: (x: number, y: number) => number): Uint32Array {
  const t = new Uint32Array(TEX * TEX);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) t[y * TEX + x] = fn(x, y);
  return t;
}

/** cobbles: a jittered grid of stones (Voronoi cells) that wraps around */
function voronoi(cell: number, seed: number) {
  const n = TEX / cell;
  const pts: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push((i + 0.2 + hh(i, j, seed) * 0.6) * cell, (j + 0.2 + hh(j, i, seed + 1) * 0.6) * cell);
  return (x: number, y: number) => {
    const ci = Math.floor(x / cell),
      cj = Math.floor(y / cell);
    let d1 = 1e9,
      d2 = 1e9,
      best = 0,
      bx = 0,
      by = 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const i = (((ci + di) % n) + n) % n,
          j = (((cj + dj) % n) + n) % n;
        const px = pts[(j * n + i) * 2] + (ci + di - i) * cell,
          py = pts[(j * n + i) * 2 + 1] + (cj + dj - j) * cell;
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = j * n + i;
          bx = px;
          by = py;
        } else if (d < d2) d2 = d;
      }
    return { id: best, edge: Math.sqrt(d2) - Math.sqrt(d1), dx: x - bx, dy: y - by };
  };
}

// ------------------------------------------------------------------ the materials
interface Mats {
  grass: Uint32Array;
  forest: Uint32Array;
  grave: Uint32Array;
  cobble: Uint32Array;
  dirt: Uint32Array;
  court: Uint32Array;
  soil: Uint32Array;
  ruin: Uint32Array;
  pier: Uint32Array;
}

function pick(pal: number[], v: number) {
  return pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
}

function makeMats(): Mats {
  // grass: soft patches of green, short blades and light specks
  const grassPal = ['#457f34', '#4e8a39', '#57953f', '#5fa045', '#68a94b'].map(rgb);
  const meadow = (pal: number[], seed: number, blades: number, dark: number, light: number) => {
    const t = texture((x, y) => {
      const n = tnoise(x / 16, y / 16, TEX / 16, seed) * 0.55 + tnoise(x / 5.333, y / 5.333, 24, seed + 3) * 0.3 + hh(x, y, seed + 5) * 0.15;
      return pick(pal, n * 1.15 - 0.08);
    });
    for (let k = 0; k < blades; k++) {
      const x0 = Math.floor(hh(k, 1, seed) * TEX),
        y0 = Math.floor(hh(k, 2, seed) * TEX);
      const len = 2 + Math.floor(hh(k, 3, seed) * 3);
      const lean = hh(k, 4, seed) < 0.5 ? -1 : 1;
      const col = hh(k, 5, seed) < 0.62 ? dark : light;
      for (let i = 0; i < len; i++) {
        const x = (x0 + (i >= len - 1 ? lean : 0) + TEX) % TEX,
          y = (y0 - i + TEX) % TEX;
        t[y * TEX + x] = col;
      }
    }
    return t;
  };
  const grass = meadow(grassPal, 11, 520, rgb('#3a6e2c'), rgb('#7cba58'));
  const forest = meadow(['#2c5126', '#325a2b', '#386430', '#3e6c35', '#335c2d'].map(rgb), 21, 300, rgb('#24421f'), rgb('#4f7a3c'));
  for (let k = 0; k < 160; k++) {
    // fallen needles and leaves
    const x = Math.floor(hh(k, 7, 22) * TEX),
      y = Math.floor(hh(k, 8, 22) * TEX);
    forest[y * TEX + x] = pick([rgb('#6a5232'), rgb('#7a5e36'), rgb('#5a4428')], hh(k, 9, 22));
  }
  const grave = meadow(['#3a6440', '#416c46', '#48764c', '#3f6a4a', '#365c3c'].map(rgb), 31, 360, rgb('#2c4e32'), rgb('#62906a'));

  // cobbles: grey stones of different sizes in earthy joints, lit from the top left
  const cv = voronoi(16, 41);
  const stonePal = ['#9b958a', '#908a7f', '#a59f93', '#8a847a', '#97918a', '#a19a8c'].map(rgb);
  const mortar = rgb('#5f5749');
  const cobble = texture((x, y) => {
    const c = cv(x, y);
    if (c.edge < 2.1) return hh(x, y, 43) < 0.12 ? rgb('#4f7a38') : mortar;
    const base = stonePal[Math.floor(hh(c.id, 3, 44) * stonePal.length)];
    let k = 1 + (hh(x, y, 45) - 0.5) * 0.06;
    if (c.edge < 4) k += c.dx + c.dy < 0 ? 0.1 : -0.13;
    return scale(base, k);
  });
  // packed earth with pebbles
  const dirtPal = ['#7f6043', '#86664a', '#8d6c4e', '#7a5b3f', '#937252'].map(rgb);
  const dirt = texture((x, y) => pick(dirtPal, tnoise(x / 8, y / 8, 16, 51) * 0.7 + hh(x, y, 52) * 0.3));
  for (let k = 0; k < 120; k++) {
    const x = Math.floor(hh(k, 1, 53) * TEX),
      y = Math.floor(hh(k, 2, 53) * TEX);
    const big = hh(k, 3, 53) < 0.3;
    const col = pick(['#a8957c', '#9a8a74', '#b5a48a', '#6a5038'].map(rgb), hh(k, 4, 53));
    dirt[y * TEX + x] = col;
    dirt[((y + 1) % TEX) * TEX + x] = scale(col, 0.7);
    if (big) {
      dirt[y * TEX + ((x + 1) % TEX)] = col;
      dirt[((y + 1) % TEX) * TEX + ((x + 1) % TEX)] = scale(col, 0.7);
    }
  }
  // the courtyard: big pale flagstones in staggered rows
  const courtPal = ['#cec5b2', '#c5bba7', '#d5ccba', '#beb4a0', '#c9c0ae'].map(rgb);
  const court = texture((x, y) => {
    const row = Math.floor(y / 32),
      off = (row % 2) * 32;
    const xx = (x + off) % TEX,
      col = Math.floor(xx / 64);
    const ly = y % 32,
      lx = xx % 64;
    if (ly < 2 || lx < 2) return rgb('#857b6a');
    let c = courtPal[Math.floor(hh(col, row, 61) * courtPal.length)];
    if (ly < 4 || lx < 4) c = scale(c, 1.06);
    else if (ly > 29 || lx > 61) c = scale(c, 0.9);
    return scale(c, 1 + (hh(x, y, 62) - 0.5) * 0.05 + (tnoise(x / 6, y / 6, TEX / 6.4, 63) - 0.5) * 0.06);
  });
  // tilled soil: ridges and furrows
  const soil = texture((x, y) => {
    const r = y % 10;
    const base = r < 2 ? rgb('#7d5a3a') : r < 6 ? rgb('#684a2f') : rgb('#523823');
    return scale(base, 1 + (hh(x, y, 71) - 0.5) * 0.14);
  });
  // gravel and broken stones around the ruins, a little grass between them
  const rv = voronoi(8, 81);
  const ruinPal = ['#857e72', '#7a7368', '#8f887b', '#716a60', '#99917f'].map(rgb);
  const ruin = texture((x, y) => {
    const c = rv(x, y);
    if (c.edge < 1.4) return hh(x, y, 82) < 0.25 ? rgb('#557a3a') : rgb('#5a534a');
    const base = ruinPal[Math.floor(hh(c.id, 1, 83) * ruinPal.length)];
    return scale(base, c.dx + c.dy < -2 ? 1.08 : c.dx + c.dy > 3 ? 0.88 : 1);
  });
  // the pier: planks across, dark gaps, nails
  const plankPal = ['#8a6038', '#7f5732', '#946840', '#86603a'].map(rgb);
  const pier = texture((x, y) => {
    const p = Math.floor(x / 8);
    if (x % 8 === 0) return rgb('#3a2616');
    let c = plankPal[Math.floor(hh(p, 1, 91) * plankPal.length)];
    if ((y % 32 === 5 || y % 32 === 26) && x % 8 === 4) return rgb('#c8b088');
    c = scale(c, 1 + (hh(x, Math.floor(y / 3), 92) - 0.5) * 0.12);
    return c;
  });
  return { grass, forest, grave, cobble, dirt, court, soil, ruin, pier };
}

// ------------------------------------------------------------------ painting
const EDGE = { moss: rgb('#557f3a'), joint: rgb('#625a4b'), soil: rgb('#4a3220'), courtDark: rgb('#7d7362'), court: rgb('#a99f8c'), beam: rgb('#5a3a20') };
const PLAZA_PAL = ['#b8ae9d', '#ada392', '#c1b7a5', '#a69c8b', '#b3a996'].map(rgb);
const WATER = { deep: rgb('#25536f'), mid: rgb('#2f6886'), shallow: rgb('#4386a2'), edge: rgb('#5ea2b4'), foam: rgb('#a9d6da'), glint: rgb('#62a6c2') };

/** the colour of the round paving of the square at a ground pixel */
function plazaColor(X: number, Y: number) {
  const cx = PLAZA.x * S,
    cy = PLAZA.y * S;
  const dx = X - cx,
    dy = Y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const R = PLAZA.r * S;
  // the curb around the edge: long dark blocks
  if (r > R - 7) {
    const along = Math.atan2(dy, dx) * R;
    const j = Math.floor(along / 20);
    if (r > R - 1.5 || ((along % 20) + 20) % 20 < 1.5 || r < R - 5.5) return rgb('#5e5648');
    return scale(rgb('#948b7b'), 1 + (hh(j, 3, 71) - 0.5) * 0.12 + (r > R - 3 ? -0.08 : 0.06));
  }
  // rings of stones around the well
  const ring = Math.floor(r / 9);
  const along = (Math.atan2(dy, dx) + Math.PI) * r + ring * 5;
  const j = Math.floor(along / 12);
  const lr = r - ring * 9,
    la = along - j * 12;
  if (lr < 1.3 || la < 1.3) return rgb('#6b6354');
  let c = PLAZA_PAL[Math.floor(hh(j, ring, 73) * PLAZA_PAL.length)];
  // a ring of darker stones every few rings
  if (ring % 4 === 3) c = scale(c, 0.86);
  if (lr < 3 || la < 3) c = scale(c, 1.07);
  else if (lr > 7.5 || la > 10.5) c = scale(c, 0.92);
  return scale(c, 1 + (hh(X, Y, 74) - 0.5) * 0.05);
}

/** the pond: deeper is darker, waves catch the light, foam at the shore */
function waterColor(X: number, Y: number, pv: number) {
  if (pv > 0.955) return hh(X, Y, 81) < 0.6 ? WATER.foam : WATER.edge;
  let c = pv < 0.3 ? WATER.deep : pv < 0.62 ? mix(WATER.deep, WATER.mid, (pv - 0.3) / 0.32) : pv < 0.85 ? mix(WATER.mid, WATER.shallow, (pv - 0.62) / 0.23) : mix(WATER.shallow, WATER.edge, (pv - 0.85) / 0.105);
  const wave = (X * 0.9 + Y * 2.3 + Math.sin(X * 0.045) * 9 + Math.sin(Y * 0.11) * 3) % 23;
  if (wave < 1.2 && pv < 0.9 && hh(Math.floor(X / 3), Y, 82) < 0.8) c = WATER.glint;
  return c;
}

/** the shore: wet dark sand by the water, dry sand further, then grass */
function sandColor(X: number, Y: number, pv: number, grass: number) {
  const t = (pv - 1) / 0.24;
  if (t > 0.72 && hh(X, Y, 91) < (t - 0.72) * 3.2) return grass;
  const base = t < 0.22 ? rgb('#7d6c4e') : t < 0.4 ? rgb('#9c8762') : rgb('#bba57a');
  return scale(base, 1 + (hh(X, Y, 92) - 0.5) * 0.12);
}

/** big soft patches of lighter and darker grass over the whole village (per tile corner) */
function patchGrid() {
  const a = new Float32Array((VW + 1) * (VH + 1));
  for (let y = 0; y <= VH; y++) for (let x = 0; x <= VW; x++) a[y * (VW + 1) + x] = vnoise(x * 0.19, y * 0.19, 601) * 0.07 + vnoise(x * 0.5, y * 0.5, 602) * 0.035;
  return a;
}

// what the flowers and the little things of the meadow look like
const FLOWERS = [
  { petal: rgb('#f4f1e6'), core: rgb('#f2c53a') }, // daisies
  { petal: rgb('#f6d43a'), core: rgb('#e08a1a') }, // buttercups
  { petal: rgb('#9a7ce0'), core: rgb('#f0e0ff') }, // bellflowers
  { petal: rgb('#e8463a'), core: rgb('#2a1a14') }, // poppies
  { petal: rgb('#f19ac2'), core: rgb('#fff0f6') }, // clover
  { petal: rgb('#7ab6f0'), core: rgb('#f4f8ff') }, // forget-me-nots
];

/** a painted piece of the ground: where it lies (tiles) and its pixels */
export interface GroundChunk {
  tx: number;
  ty: number;
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** everything the painting of one chunk needs */
interface Job {
  tx0: number;
  ty0: number;
  tw: number;
  th: number;
  W: number;
  H: number;
  BW: number;
  BH: number;
  out: Uint32Array;
  code: Uint8Array;
  marg: Float32Array;
  M: Mats;
  TEXRGB: (Uint32Array | undefined)[];
  TEXA: (Uint32Array | undefined)[];
  MEADOW: Uint8Array;
  patch: Float32Array;
}

/**
 * Paints the whole ground of the village into pixel buffers. It touches no page or game object, so it
 * can run in a worker (see gfx/groundLoader.ts) while the hero is still down in the dungeon.
 */
export function paintGround(): GroundChunk[] {
  const M = makeMats();
  const patch = patchGrid();
  const tex: [number, Uint32Array][] = [
    [G.grass, M.grass],
    [G.forest, M.forest],
    [G.grave, M.grave],
    [G.path, M.cobble],
    [G.dirt, M.dirt],
    [G.court, M.court],
    [G.soil, M.soil],
    [G.ruin, M.ruin],
    [G.pier, M.pier],
  ];
  // the material textures once more as ready screen pixels
  const TEXRGB: (Uint32Array | undefined)[] = new Array(16).fill(undefined);
  const TEXA: (Uint32Array | undefined)[] = new Array(16).fill(undefined);
  for (const [k, t] of tex) {
    TEXRGB[k] = t;
    const a = new Uint32Array(t.length);
    for (let i = 0; i < a.length; i++) a[i] = px32(t[i]);
    TEXA[k] = a;
  }
  const MEADOW = new Uint8Array(16);
  for (const g of [G.grass, G.forest, G.grave, G.ruin]) MEADOW[g] = 1;
  const nx = Math.ceil(VW / CW),
    ny = Math.ceil(VH / CH);
  const chunks: GroundChunk[] = [];
  for (let cj = 0; cj < ny; cj++)
    for (let ci = 0; ci < nx; ci++) {
      const tx0 = ci * CW,
        ty0 = cj * CH;
      const tw = Math.min(CW, VW - tx0),
        th = Math.min(CH, VH - ty0);
      const W = tw * S,
        H = th * S;
      const data = new Uint8ClampedArray(W * H * 4);
      // what lies under each world pixel (2 × 2 ground pixels): kind and depth inside it
      const BW = W / 2,
        BH = H / 2;
      const job: Job = { tx0, ty0, tw, th, W, H, BW, BH, out: new Uint32Array(data.buffer), code: new Uint8Array(BW * BH), marg: new Float32Array(BW * BH), M, TEXRGB, TEXA, MEADOW, patch };
      classify(job);
      colour(job);
      edges(job);
      decals(job);
      chunks.push({ tx: tx0, ty: ty0, w: W, h: H, data });
    }
  return chunks;
}

/** the chunk size in tiles (for laying the textures out) */
export const GROUND_CHUNK = { w: CW, h: CH };

function classify(j: Job) {
  const { tx0, ty0, tw, th, BW, code, marg } = j;
  const info: GInfo = { g: G.grass, m: 0, v: 0 };
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) {
      const gx = tx0 + tx,
        gy = ty0 + ty;
      const segs: Seg[] = segsNear(gx - 0.3, gy - 0.3, gx + 1.3, gy + 1.3);
      // a tile whose corners, edges and middle agree is all one thing
      let first = -1,
        uniform = true;
      for (let sy = 0; sy <= 4 && uniform; sy++)
        for (let sx = 0; sx <= 4; sx++) {
          const g = groundInfo(gx + sx / 4, gy + sy / 4, info, segs).g;
          if (first < 0) first = g;
          else if (g !== first) {
            uniform = false;
            break;
          }
        }
      if (uniform) {
        for (let by = 0; by < 16; by++) {
          const row = (ty * 16 + by) * BW + tx * 16;
          code.fill(first, row, row + 16);
          marg.fill(9, row, row + 16);
        }
        continue;
      }
      for (let by = 0; by < 16; by++)
        for (let bx = 0; bx < 16; bx++) {
          const bi = (ty * 16 + by) * BW + tx * 16 + bx;
          groundInfo(gx + (bx + 0.5) / 16, gy + (by + 0.5) / 16, info, segs);
          code[bi] = info.g;
          marg[bi] = info.m;
        }
    }
}

/** colour every ground pixel from its material */
function colour(j: Job) {
  const { tx0, ty0, W, H, BW, BH, out, code, marg, M, TEXRGB, TEXA, MEADOW, patch } = j;
  // the soft patches of the meadow are worked out per 4 × 4 pixels, the pond per world pixel
  const QW = W / 4,
    QH = H / 4;
  const tintK = new Float32Array(QW * QH),
    tintY = new Float32Array(QW * QH);
  for (let qy = 0; qy < QH; qy++) {
    const tyf = (ty0 * S + qy * 4 + 2) / S;
    const ty = Math.floor(tyf),
      fy = tyf - ty;
    for (let qx = 0; qx < QW; qx++) {
      const txf = (tx0 * S + qx * 4 + 2) / S;
      const tx = Math.floor(txf),
        fx = txf - tx;
      const i0 = ty * (VW + 1) + tx;
      const pp = patch[i0] * (1 - fx) * (1 - fy) + patch[i0 + 1] * fx * (1 - fy) + patch[i0 + VW + 1] * (1 - fx) * fy + patch[i0 + VW + 2] * fx * fy;
      tintK[qy * QW + qx] = 1 + pp;
      tintY[qy * QW + qx] = pp > 0.03 ? Math.min(0.25, (pp - 0.03) * 3) : 0;
    }
  }
  const pondV = new Float32Array(BW * BH);
  for (let i = 0; i < BW * BH; i++) {
    const g = code[i];
    if (g === G.water || g === G.sand) pondV[i] = pondValue((tx0 * S + (i % BW) * 2 + 1) / S, (ty0 * S + Math.floor(i / BW) * 2 + 1) / S);
  }
  const grassA = TEXA[G.grass]!;
  for (let y = 0; y < H; y++) {
    const Y = ty0 * S + y;
    const rowT = (Y & (TEX - 1)) * TEX;
    const rowB = (y >> 1) * BW;
    const rowQ = (y >> 2) * QW;
    const rowO = y * W;
    for (let x = 0; x < W; x++) {
      const X = tx0 * S + x;
      const bi = rowB + (x >> 1);
      const g = code[bi];
      const ti = rowT + (X & (TEX - 1));
      let v: number;
      if (g === G.plaza) v = px32(plazaColor(X, Y));
      else if (g === G.water) v = px32(waterColor(X, Y, pondV[bi]));
      else if (g === G.sand) v = px32(sandColor(X, Y, pondV[bi], M.grass[ti]));
      else {
        const mp = marg[bi] * S;
        if (mp < 4) v = px32(edgeColor(g, mp, X, Y, (TEXRGB[g] ?? M.grass)[ti], M.grass[ti]));
        else v = (TEXA[g] ?? grassA)[ti];
        if (g === G.pier && (Y - PIER.y0 * S < 3 || PIER.y1 * S - Y < 3 || X > PIER.x1 * S - 3)) v = px32(EDGE.beam);
        if (MEADOW[g]) {
          // brighter and darker patches over the meadow, a touch of yellow where it is sunny
          const q = rowQ + (x >> 2);
          const k = tintK[q];
          let r = (v & 255) * k,
            gg = ((v >> 8) & 255) * k,
            b = ((v >> 16) & 255) * k;
          const yw = g === G.grass ? tintY[q] : 0;
          if (yw > 0) {
            r += (0x8f - r) * yw;
            gg += (0xae - gg) * yw;
            b += (0x4a - b) * yw;
          }
          v = (0xff000000 | ((b > 255 ? 255 : b) << 16) | ((gg > 255 ? 255 : gg) << 8) | (r > 255 ? 255 : r)) >>> 0;
        }
      }
      out[rowO + x] = v;
    }
  }
}

/** edges: cobbles sink into earth, earth and beds fray into the grass */
function edgeColor(g: number, mp: number, X: number, Y: number, col: number, grass: number) {
  if (g === G.path) return mp < 1.6 ? (hh(X, Y, 3) < 0.35 ? EDGE.moss : EDGE.joint) : scale(col, 0.9);
  if ((g === G.dirt || g === G.ruin || g === G.forest) && mp < 3.5 && hh(X, Y, 4) < (3.5 - mp) / 5) return grass;
  if (g === G.soil && mp < 2.5) return EDGE.soil;
  if (g === G.court && mp < 3) return mp < 1.5 ? EDGE.courtDark : EDGE.court;
  return col;
}

const HARD = new Uint8Array(16);
HARD[G.path] = HARD[G.plaza] = HARD[G.court] = HARD[G.pier] = 1;

/** grass right at the edge of a way is a shade darker (the way looks laid into the meadow) */
function edges(j: Job) {
  const { W, BW, BH, out, code } = j;
  for (let by = 1; by < BH - 1; by++)
    for (let bx = 1; bx < BW - 1; bx++) {
      const bi = by * BW + bx;
      const g = code[bi];
      if (g !== G.grass && g !== G.grave) continue;
      if (!(HARD[code[bi - 1]] || HARD[code[bi + 1]] || HARD[code[bi - BW]] || HARD[code[bi + BW]])) continue;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const o = (by * 2 + dy) * W + bx * 2 + dx;
          const v = out[o];
          // darken in place (the pixel is ABGR)
          out[o] = (0xff000000 | (Math.round(((v >> 16) & 255) * 0.78) << 16) | (Math.round(((v >> 8) & 255) * 0.8) << 8) | Math.round((v & 255) * 0.78)) >>> 0;
        }
    }
}

/** flowers, tufts, pebbles and mushrooms */
function decals(j: Job) {
  const { tx0, ty0, tw, th, W, H, BW, out, code } = j;
  const put = (x: number, y: number, col: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const g = code[(y >> 1) * BW + (x >> 1)];
    if (g !== G.grass && g !== G.forest && g !== G.grave) return;
    out[y * W + x] = px32(col);
  };
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) {
      const gx = tx0 + tx,
        gy = ty0 + ty;
      const g = code[(ty * 16 + 8) * BW + tx * 16 + 8];
      const r = hh(gx, gy, 501);
      const ox = tx * S,
        oy = ty * S;
      if (g === G.grass && r < 0.22) {
        // a little patch of one kind of flower
        const f = FLOWERS[Math.floor(hh(gx, gy, 502) * FLOWERS.length)];
        const n = 3 + Math.floor(hh(gx, gy, 503) * 5);
        const cx = ox + 6 + Math.floor(hh(gx, gy, 504) * 20),
          cy = oy + 6 + Math.floor(hh(gx, gy, 505) * 20);
        for (let k = 0; k < n; k++) {
          const x = cx + Math.floor((hh(k, gx, gy) - 0.5) * 12),
            y = cy + Math.floor((hh(gy, k, gx) - 0.5) * 10);
          put(x, y + 2, DECAL.stem);
          put(x - 1, y, f.petal);
          put(x + 1, y, f.petal);
          put(x, y - 1, f.petal);
          put(x, y + 1, f.petal);
          put(x, y, f.core);
        }
      } else if ((g === G.grass || g === G.grave) && r < 0.36) {
        // a darker tuft of grass
        const x = ox + 4 + Math.floor(hh(gx, gy, 506) * 24),
          y = oy + 6 + Math.floor(hh(gx, gy, 507) * 22);
        const dark = g === G.grave ? DECAL.tuftGrave : DECAL.tuft;
        put(x, y, dark);
        put(x - 1, y - 1, dark);
        put(x + 1, y - 1, dark);
        put(x - 2, y - 2, dark);
        put(x + 2, y - 2, dark);
        put(x, y - 2, DECAL.blade);
      } else if (g === G.grass && r < 0.42) {
        // a pebble
        const x = ox + 4 + Math.floor(hh(gx, gy, 508) * 24),
          y = oy + 4 + Math.floor(hh(gx, gy, 509) * 24);
        put(x, y, DECAL.pebble[0]);
        put(x + 1, y, DECAL.pebble[1]);
        put(x, y + 1, DECAL.pebble[2]);
        put(x + 1, y + 1, DECAL.pebble[3]);
      } else if ((g === G.forest || g === G.grave) && r < 0.5) {
        // a mushroom
        const x = ox + 6 + Math.floor(hh(gx, gy, 510) * 20),
          y = oy + 6 + Math.floor(hh(gx, gy, 511) * 20);
        const red = r < 0.47;
        const cap = red ? DECAL.capRed : DECAL.capBrown;
        put(x, y + 1, DECAL.stalk);
        put(x - 1, y, cap);
        put(x, y, cap);
        put(x + 1, y, cap);
        put(x, y - 1, cap);
        if (red) put(x, y, DECAL.spot);
      }
    }
}

const DECAL = {
  stem: rgb('#2f5e26'),
  tuft: rgb('#33642a'),
  tuftGrave: rgb('#2a4a30'),
  blade: rgb('#7cba58'),
  pebble: [rgb('#a8a296'), rgb('#b8b2a6'), rgb('#6a665c'), rgb('#7e786c')],
  stalk: rgb('#e8dcc0'),
  capRed: rgb('#c8452e'),
  capBrown: rgb('#a87a4a'),
  spot: rgb('#f4eedc'),
};

void POND;
