import Phaser from 'phaser';
import { canvas, rect, px, tpl, outline, shade, hash, line, circle } from './pixel';
import { CLASSES } from '../data/classes';
import { biomeForFloor } from '../data/biomes';
import { buildHeroStrip, HERO_W, HERO_H, HERO_FRAMES } from './heroes';
import { PET_ART } from './pets';
import { GEMS, GEM_MAX_TIER } from '../data/gems';
import { RUNES, RUNE_MAX_TIER } from '../data/runes';
import { SPELL_RUNES } from '../data/spellrunes';

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
let SCENE: Phaser.Scene;
const iconCache = new Map<string, string>();
const canvases = new Map<string, HTMLCanvasElement>();

// Characters, monsters, allies and held weapons are smoothed to double resolution (EPX / Scale2x)
// and drawn at half scale, so they match the double-detail tiles.
export const ACTOR_SCALE = 0.5;
const HI_RES = ['pl_', 'en_', 'al_', 'npc_', 'totem_', 'wp_'];
// dungeon furniture gets the same treatment (placed with ACTOR_SCALE by the scenes)
const PROP_KEYS = new Set(['torch', 'bookshelf', 'crate', 'barrel', 'pot', 'table', 'chair', 'bones', 'skull', 'stairs', 'stairs_up', 'door', 'door_open', 'goldpile', 'anvil', 'fountain', 'fountain_used', 'spikes', 'page', 'cage', 'cage_open']);
const PROP_PREFIX = ['banner_', 'shrine_', 'chest_', 'torch_', 'deco_'];
export const isPropTex = (key: string) => PROP_KEYS.has(key) || PROP_PREFIX.some((p) => key.startsWith(p));
const isHiRes = (key: string) => HI_RES.some((p) => key.startsWith(p)) || isPropTex(key);

function epx2(src: HTMLCanvasElement, fw = src.width): HTMLCanvasElement {
  const w = src.width,
    h = src.height;
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h);
  const s32 = new Uint32Array(sd.data.buffer);
  // every fully transparent pixel compares equal
  for (let i = 0; i < s32.length; i++) if ((s32[i] >>> 24) === 0) s32[i] = 0;
  const [c, ctx] = canvas(w * 2, h * 2);
  const od = ctx.createImageData(w * 2, h * 2);
  const o32 = new Uint32Array(od.data.buffer);
  const W2 = w * 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = s32[y * w + x];
      const fx = x % fw;
      const A = y > 0 ? s32[(y - 1) * w + x] : P;
      const B = fx < fw - 1 ? s32[y * w + x + 1] : P;
      const C = fx > 0 ? s32[y * w + x - 1] : P;
      const D = y < h - 1 ? s32[(y + 1) * w + x] : P;
      let p1 = P,
        p2 = P,
        p3 = P,
        p4 = P;
      if (C === A && C !== D && A !== B) p1 = A;
      if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C;
      if (B === D && B !== A && D !== C) p4 = D;
      const o = y * 2 * W2 + x * 2;
      o32[o] = p1;
      o32[o + 1] = p2;
      o32[o + W2] = p3;
      o32[o + W2 + 1] = p4;
    }
  ctx.putImageData(od, 0, 0);
  return c;
}

function addCanvas(key: string, c: HTMLCanvasElement, native = true) {
  if (native && isHiRes(key)) c = epx2(c);
  canvases.set(key, c);
  if (SCENE.textures.exists(key)) SCENE.textures.remove(key);
  SCENE.textures.addCanvas(key, c);
}

function addStrip(key: string, c: HTMLCanvasElement, fw: number, fh: number, n: number, upscale = true) {
  if (upscale && isHiRes(key)) {
    c = epx2(c, fw);
    fw *= 2;
    fh *= 2;
  }
  canvases.set(key, c);
  if (SCENE.textures.exists(key)) SCENE.textures.remove(key);
  const tex = SCENE.textures.addCanvas(key, c)!;
  for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, fh);
}

// Make semi transparent pixels either fully opaque or transparent (crisp shapes).
function crisp(c: HTMLCanvasElement, threshold = 110) {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] >= threshold ? 255 : 0;
  ctx.putImageData(img, 0, 0);
}

export function iconURL(key: string, size = 48): string {
  const ck = key + '@' + size;
  if (iconCache.has(ck)) return iconCache.get(ck)!;
  const src = canvases.get(key);
  if (!src) return '';
  let sw = src.width,
    sh = src.height;
  // if it is a strip registered with frames, use first frame
  const tex = SCENE?.textures.get(key);
  if (tex && tex.frameTotal > 2) {
    const f = tex.get(0);
    sw = f.width;
    sh = f.height;
  }
  const scale = Math.max(1, Math.floor(size / Math.max(sw, sh)));
  const [c, ctx] = canvas(sw * scale, sh * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, sw * scale, sh * scale);
  const url = c.toDataURL();
  iconCache.set(ck, url);
  return url;
}

export function getCanvas(key: string) {
  return canvases.get(key);
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
const OUT = '#16121c';

// ---------------------------------------------------------------------------
// TILES (16x16) – tileset strip used by the tilemap
// index 0: empty, 1..8 floor variants, 9..16 wall top (mask N/E/W), 17..20 wall front (mask E/W), 21..22 front cracked, 23 floor shadowed
// ---------------------------------------------------------------------------
export const TILE = {
  floor: [1, 2, 3, 4, 5, 6, 7, 8],
  top: 9, // + mask (0..7)
  front: 17, // + mask (0..3)
  frontCrack: 21,
  fog: 24,
  rock: 25, // solid mass far from any room
  count: 26,
};

// Dungeon biomes – each one spans 50 floors and ends with a story boss (the story ends on floor 250,
// after that the endless depths cycle through them again).
export type BiomeStyle = 'bricks' | 'cave' | 'ice' | 'lava' | 'abyss';
export interface Theme {
  name: string; // short name (HUD)
  title: string; // full name (chapter banners)
  style: BiomeStyle;
  floor: string[];
  mortar: string;
  moss: string[];
  stone: { top: string; topHi: string; topLo: string; line: string; edge: string };
  brick: string[];
  brickMortar: string;
  glow: string[]; // accent light colours (fungus, frost, magma, runes)
  torch: number;
  dark: number;
  darkness: number;
  propTint?: number; // crates, barrels and pots take on the biome's colour
}

export const THEMES: Theme[] = [
  {
    name: 'Kobky',
    title: 'Zapomenuté kobky',
    style: 'bricks',
    floor: ['#7a5434', '#74502f', '#7f5837', '#6f4c2e'],
    mortar: '#3a291d',
    moss: ['#3f5a24', '#4d6b2b', '#5d7f33'],
    stone: { top: '#55545e', topHi: '#64636e', topLo: '#47464f', line: '#24232b', edge: '#17161c' },
    brick: ['#5b5a66', '#55545f', '#62616e', '#4f4e59'],
    brickMortar: '#2a2930',
    glow: ['#ffd23a', '#ff9a3a', '#fff0b0'],
    torch: 0xff9a3a,
    dark: 0x05040a,
    darkness: 0.48,
  },
  {
    name: 'Jeskyně',
    title: 'Hladové jeskyně',
    style: 'cave',
    floor: ['#4d4238', '#483d34', '#53473d', '#4f4339'],
    mortar: '#2a231d',
    moss: ['#3d5a2a', '#4f6e33', '#2f4722'],
    stone: { top: '#5d564e', topHi: '#6e665d', topLo: '#4b453f', line: '#282421', edge: '#141110' },
    brick: ['#524b44', '#5a534b', '#4a443e', '#605850'],
    brickMortar: '#211d1a',
    glow: ['#4ff0d0', '#b0fff0', '#2a9a88'],
    torch: 0x5ff5d8,
    dark: 0x020705,
    darkness: 0.52,
    propTint: 0xc8c0b0,
  },
  {
    name: 'Ledové hlubiny',
    title: 'Ledové hlubiny',
    style: 'ice',
    floor: ['#a3c6da', '#9cc0d5', '#abcde0', '#95b9cf'],
    mortar: '#5f86a0',
    moss: ['#f2faff', '#dcf0fb', '#ffffff'],
    stone: { top: '#dcebf4', topHi: '#f0f8fc', topLo: '#bcd4e3', line: '#5a7f99', edge: '#1d3448' },
    brick: ['#80b3d3', '#77aacb', '#89bbd9', '#6da0c3'],
    brickMortar: '#2c4d68',
    glow: ['#e8f8ff', '#a8e0ff', '#6fc8ff'],
    torch: 0x8fdcff,
    dark: 0x02050a,
    darkness: 0.42,
    propTint: 0xc8e4ff,
  },
  {
    name: 'Výheň',
    title: 'Ohnivá výheň',
    style: 'lava',
    floor: ['#3d312d', '#382c29', '#433531', '#352a26'],
    mortar: '#170e0c',
    moss: ['#ff7a1a', '#ffb347', '#c84a10'],
    stone: { top: '#2d2527', topHi: '#3b3032', topLo: '#231c1e', line: '#120c0d', edge: '#0a0607' },
    brick: ['#33292b', '#3d3335', '#2c2426', '#382e30'],
    brickMortar: '#150f10',
    glow: ['#ff6a1a', '#ffb347', '#fff0a0'],
    torch: 0xff6a2a,
    dark: 0x0a0302,
    darkness: 0.44,
    propTint: 0xb89a90,
  },
  {
    name: 'Propast',
    title: 'Propast',
    style: 'abyss',
    floor: ['#2a2134', '#251d2f', '#2e2539', '#221a2b'],
    mortar: '#110c17',
    moss: ['#7a3aff', '#b07dff', '#4a1f9a'],
    stone: { top: '#2e253b', topHi: '#3d3250', topLo: '#241c30', line: '#140f1c', edge: '#0a0710' },
    brick: ['#30273d', '#382e47', '#2a2136', '#332a41'],
    brickMortar: '#120d19',
    glow: ['#c77dff', '#f0d0ff', '#8a4aff'],
    torch: 0xb070ff,
    dark: 0x050208,
    darkness: 0.56,
    propTint: 0xb8a8d8,
  },
];

export const themeForFloor = biomeForFloor;

// Tiles are drawn at 32x32 (double detail) and shown at half scale on the 16px world grid.
export const TILE_RES = 32;

// speckled stone surface with a bevel (light top/left, dark bottom/right)
function stoneBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, seed: number, gap: string, noise = 0.07) {
  rect(ctx, x, y, w, h, col);
  for (let k = 0; k < (w * h) / 9; k++) {
    const sx = x + Math.floor(hash(seed, k, 1) * w),
      sy = y + Math.floor(hash(k, seed, 2) * h);
    px(ctx, sx, sy, shade(col, hash(sx + seed, sy, 3) > 0.5 ? noise : -noise * 1.2));
  }
  rect(ctx, x, y, w, 1, shade(col, 0.16));
  rect(ctx, x, y + 1, 1, h - 2, shade(col, 0.09));
  rect(ctx, x, y + h - 1, w, 1, shade(col, -0.22));
  rect(ctx, x + w - 1, y + 1, 1, h - 1, shade(col, -0.14));
  // chipped corners let the mortar show through
  px(ctx, x, y, gap);
  px(ctx, x + w - 1, y, gap);
  px(ctx, x, y + h - 1, gap);
  px(ctx, x + w - 1, y + h - 1, gap);
}

function crack(ctx: CanvasRenderingContext2D, ox: number, pts: number[][], col: string) {
  for (let i = 0; i < pts.length - 1; i++) line(ctx, ox + pts[i][0], pts[i][1], ox + pts[i + 1][0], pts[i + 1][1], col);
}

function moss(ctx: CanvasRenderingContext2D, ox: number, cx: number, cy: number, r: number, seed: number, cols: string[]) {
  for (let k = 0; k < r * r * 2.2; k++) {
    const a = hash(seed, k, 11) * Math.PI * 2,
      d = Math.sqrt(hash(k, seed, 12)) * r;
    const x = Math.round(cx + Math.cos(a) * d),
      y = Math.round(cy + Math.sin(a) * d * 0.8);
    if (x < 1 || y < 1 || x > 30 || y > 30) continue;
    px(ctx, ox + x, y, cols[Math.floor(hash(x, y, seed) * cols.length)]);
  }
}

// irregular darker/lighter blotches so large surfaces don't look flat
function mottle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, seed: number, amt = 0.08) {
  for (let k = 0; k < Math.max(2, Math.round((w * h) / 160)); k++) {
    const cx = x + hash(seed, k, 31) * w,
      cy = y + hash(k, seed, 32) * h;
    const r = 2 + hash(seed + k, 3, 33) * 4;
    const c = shade(col, hash(k, seed, 34) > 0.45 ? -amt : amt * 0.7);
    for (let yy = Math.floor(cy - r); yy <= cy + r; yy++)
      for (let xx = Math.floor(cx - r); xx <= cx + r; xx++) {
        if (xx < x + 1 || yy < y + 1 || xx > x + w - 2 || yy > y + h - 2) continue;
        if ((xx - cx) ** 2 + ((yy - cy) * 1.3) ** 2 > r * r * (0.6 + hash(xx, yy, seed) * 0.5)) continue;
        px(ctx, xx, yy, c);
      }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const S = TILE_RES;
  const mortar = th.mortar;
  const col = (i: number) => th.floor[(v + i) % th.floor.length];
  rect(ctx, ox, 0, S, S, mortar);
  const slab = (x: number, y: number, w: number, h: number, c: string, seed: number) => {
    stoneBlock(ctx, ox + x, y, w, h, c, seed, mortar, 0.06);
    mottle(ctx, ox + x, y, w, h, c, seed + 5, 0.07);
    // second highlight row for a chunkier bevel
    rect(ctx, ox + x + 1, y + 1, w - 2, 1, shade(c, 0.08));
    rect(ctx, ox + x + 1, y + h - 2, w - 2, 1, shade(c, -0.1));
  };
  // one large flagstone per tile, sometimes split in two
  if (v === 4) {
    slab(1, 1, 30, 14, col(0), v * 7 + 1);
    slab(1, 16, 30, 15, col(1), v * 7 + 2);
  } else if (v === 6) {
    slab(1, 1, 13, 30, col(0), v * 7 + 1);
    slab(15, 1, 16, 30, col(2), v * 7 + 2);
    crack(ctx, ox, [[18, 4], [21, 10], [20, 15], [24, 21]], shade(mortar, -0.15));
  } else {
    slab(1, 1, 30, 30, col(0), v * 7 + 3);
  }
  if (v === 3) {
    const c = shade(mortar, -0.12);
    crack(ctx, ox, [[6, 5], [11, 12], [10, 18], [15, 24], [14, 28]], c);
    crack(ctx, ox, [[11, 12], [17, 14]], c);
  }
  // moss creeping along the joints (embers / frost in other biomes)
  const joint = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      if (hash(i, seed, 41) < 0.35) continue;
      const x = Math.round(x0 + ((x1 - x0) * i) / n),
        y = Math.round(y0 + ((y1 - y0) * i) / n);
      const spread = hash(seed, i, 42) > 0.6 ? 2 : 1;
      for (let d = -spread; d <= spread; d++) {
        const xx = x0 === x1 ? x + d : x,
          yy = x0 === x1 ? y : y + d;
        if (xx < 0 || yy < 0 || xx > 31 || yy > 31) continue;
        px(ctx, ox + xx, yy, th.moss[Math.floor(hash(xx, yy, seed) * th.moss.length)]);
      }
    }
  };
  if (v === 5) {
    joint(0, 31, 18, 31, 51);
    joint(0, 14, 0, 31, 52);
    moss(ctx, ox, 4, 27, 3, 53, th.moss);
  }
  if (v === 7) {
    joint(12, 0, 31, 0, 71);
    joint(31, 0, 31, 12, 72);
    for (let k = 0; k < 4; k++) {
      const x = 8 + Math.floor(hash(k, 7, 4) * 16),
        y = 12 + Math.floor(hash(7, k, 5) * 14);
      rect(ctx, ox + x, y, 2, 2, shade(mortar, 0.25));
      px(ctx, ox + x, y, shade(mortar, 0.45));
    }
  }
}

// Top face of a stone cube: one big bevelled block (sometimes two) – the dungeon is built from them.
function drawWallTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const STONE = th.stone;
  const S = TILE_RES;
  // mask bits: 1 = floor north, 2 = floor east, 4 = floor west
  rect(ctx, ox, 0, S, S, STONE.edge);
  const cube = (x: number, y: number, w: number, h: number, c: string, seed: number) => {
    rect(ctx, ox + x, y, w, h, c);
    mottle(ctx, ox + x, y, w, h, c, seed, 0.06);
    // thick bevel: bright top/left rim, dark bottom/right rim
    rect(ctx, ox + x, y, w, 2, shade(c, 0.22));
    rect(ctx, ox + x, y + 2, 2, h - 2, shade(c, 0.12));
    rect(ctx, ox + x, y + h - 2, w, 2, shade(c, -0.28));
    rect(ctx, ox + x + w - 2, y + 2, 2, h - 4, shade(c, -0.18));
    px(ctx, ox + x, y, STONE.edge);
    px(ctx, ox + x + w - 1, y, STONE.edge);
    px(ctx, ox + x, y + h - 1, STONE.edge);
    px(ctx, ox + x + w - 1, y + h - 1, STONE.edge);
    if (hash(seed, 9, 61) > 0.6) crack(ctx, ox, [[x + 6, y + 4], [x + 10, y + 9], [x + 9, y + 13]], shade(c, -0.25));
  };
  const n = hash(mask, 7, 62);
  const c1 = n > 0.5 ? STONE.topHi : STONE.top;
  const c2 = n > 0.5 ? STONE.top : STONE.topHi;
  if (mask === 0 && n < 0.35) {
    cube(1, 1, 30, 14, c1, 1);
    cube(1, 16, 30, 15, c2, 2);
  } else cube(1, 1, 30, 30, c1, 3 + mask);
  // where the wall drops down to a floor its rim is in deep shadow
  if (mask & 1) {
    rect(ctx, ox, 0, S, 2, STONE.edge);
  }
  if (mask & 2) {
    rect(ctx, ox + S - 2, 0, 2, S, STONE.edge);
  }
  if (mask & 4) {
    rect(ctx, ox, 0, 2, S, STONE.edge);
  }
}

// Front face of a stone cube seen from the south: light lip, two courses of big dark blocks, shadowed foot.
function drawWallFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const STONE = th.stone;
  const brick = th.brick;
  const mortar = th.brickMortar;
  const S = TILE_RES;
  rect(ctx, ox, 0, S, S, mortar);
  // lip of the top face catching the light
  rect(ctx, ox, 0, S, 5, STONE.topHi);
  rect(ctx, ox, 0, S, 1, shade(STONE.topHi, 0.3));
  rect(ctx, ox, 4, S, 1, shade(STONE.topHi, -0.25));
  rect(ctx, ox, 5, S, 1, STONE.edge);
  // two courses of large blocks
  const course = (y: number, h: number, split: number, ri: number) => {
    const xs = split > 0 ? [0, split] : [0];
    xs.forEach((x0, k) => {
      const x1 = k + 1 < xs.length ? xs[k + 1] : S;
      const c = brick[Math.floor(hash(x0 + ox, y, mask + ri) * brick.length)];
      const bx = ox + x0 + (k === 0 ? 0 : 1),
        bw = x1 - x0 - (k === 0 ? 1 : 1);
      rect(ctx, bx, y, bw, h, c);
      mottle(ctx, bx, y, bw, h, c, x0 * 3 + y + ri, 0.07);
      rect(ctx, bx, y, bw, 1, shade(c, 0.18));
      rect(ctx, bx, y + h - 1, bw, 1, shade(c, -0.25));
      rect(ctx, bx + bw - 1, y, 1, h, shade(c, -0.15));
      if (hash(x0, y, 63 + mask) > 0.55) crack(ctx, bx - ox, [[4, y + 2], [6, y + 6], [5, y + h - 2]].map(([a, b]) => [a + (bw > 20 ? 8 : 2), b]), shade(c, -0.3));
    });
  };
  course(6, 12, hash(mask, 1, 64) > 0.5 ? 14 : 0, 0);
  rect(ctx, ox, 18, S, 1, mortar);
  course(19, 11, hash(mask, 2, 65) > 0.4 ? 20 : 9, 1);
  // the wall foot is in shadow
  rect(ctx, ox, S - 2, S, 2, shade(mortar, -0.45));
  if (mask & 1) rect(ctx, ox + S - 2, 0, 2, S, STONE.edge);
  if (mask & 2) rect(ctx, ox, 0, 2, S, STONE.edge);
  if (cracked) {
    const c = shade(mortar, -0.5);
    crack(ctx, ox, [[10, 6], [15, 12], [14, 18], [18, 25]], c);
    crack(ctx, ox, [[15, 12], [21, 15], [24, 13]], c);
    px(ctx, ox + 11, 7, shade(brick[0], 0.3));
  }
}

// deep rock between rooms: dark, low-contrast blocks so the lit walls stand out
function drawRock(ctx: CanvasRenderingContext2D, ox: number, th: Theme) {
  const STONE = th.stone;
  const S = TILE_RES;
  const base = shade(STONE.topLo, -0.38);
  rect(ctx, ox, 0, S, S, shade(base, -0.25));
  rect(ctx, ox + 1, 1, 30, 30, base);
  mottle(ctx, ox + 1, 1, 30, 30, base, 77, 0.08);
  rect(ctx, ox + 1, 1, 30, 1, shade(base, 0.12));
  rect(ctx, ox + 1, 30, 30, 1, shade(base, -0.2));
}

// ---------------------------------------------------------------------------
// Biome tile painters (caves, ice, lava, abyss) – same tile layout as the brick dungeon
// ---------------------------------------------------------------------------

// hard-edged pixel ellipse (canvas ellipses would be anti-aliased)
function pell(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
}

// per-pixel grain on whatever is already painted (keeps each surface's own colour)
function grainImg(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amt = 0.1, pDark = 0.14, pLight = 0.09) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const n = hash(i % w, Math.floor(i / w), seed);
    const k = n < pDark ? 1 - amt : n > 1 - pLight ? 1 + amt * 0.8 : 1;
    if (k === 1) continue;
    d[i * 4] = Math.min(255, d[i * 4] * k);
    d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * k);
    d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * k);
  }
  ctx.putImageData(img, x, y);
}

function pebble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  pell(ctx, x, y + 0.6, r, r * 0.75, shade(col, -0.35));
  pell(ctx, x, y, r, r * 0.75, col);
  px(ctx, Math.round(x - r * 0.45), Math.round(y - r * 0.4), shade(col, 0.28));
}

function shroom(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean, glow: string[]) {
  const h = big ? 3 : 2,
    w = big ? 2 : 1;
  rect(ctx, x, y - h + 1, 1, h, '#d8d2c2');
  rect(ctx, x - w, y - h, w * 2 + 1, 1, glow[2]);
  rect(ctx, x - w + 1, y - h - 1, Math.max(1, w * 2 - 1), 1, glow[0]);
  px(ctx, x, y - h - 1, glow[1]);
}

// a lumpy boulder lit from the top left
function boulder(ctx: CanvasRenderingContext2D, ox: number, cx: number, cy: number, rx: number, ry: number, col: string, seed: number) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (x < 0 || y < 0 || x > 31 || y > 31) continue;
      const nx = (x + 0.5 - cx) / rx,
        ny = (y + 0.5 - cy) / ry;
      const a = Math.atan2(ny, nx);
      const wob = Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 5 + seed * 2) * 0.05 + (hash(x, y, seed) - 0.5) * 0.06;
      const d = nx * nx + ny * ny;
      if (d > 1 + wob) continue;
      let c = shade(col, Math.max(-0.35, Math.min(0.3, -(nx * 0.55 + ny * 0.75) * 0.22)));
      if (d > 0.82 + wob) c = shade(c, ny > 0.2 || nx > 0.3 ? -0.3 : 0.12);
      px(ctx, ox + x, y, c);
    }
}

function caveFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const S = TILE_RES;
  const base = th.floor[v % th.floor.length];
  rect(ctx, ox, 0, S, S, base);
  mottle(ctx, ox, 0, S, S, base, v * 11 + 3, 0.1);
  const n = 5 + Math.floor(hash(v, 2, 90) * 5);
  for (let k = 0; k < n; k++) {
    const x = ox + 3 + hash(v, k, 91) * 26,
      y = 3 + hash(k, v, 92) * 26;
    const r = 0.9 + hash(k, k + v, 93) * 1.4;
    pebble(ctx, x, y, r, shade(base, hash(v + k, 3, 94) > 0.5 ? 0.2 : -0.16));
  }
  grainImg(ctx, ox, 0, S, S, v * 7 + 1, 0.13);
  if (v === 3) {
    const c = shade(base, -0.5);
    crack(ctx, ox, [[5, 6], [10, 11], [9, 17], [14, 22], [13, 27]], c);
    crack(ctx, ox, [[10, 11], [16, 13], [19, 12]], c);
  }
  if (v === 4) {
    const c = shade(base, 0.14);
    pell(ctx, ox + 16, 17, 9, 6, shade(c, -0.35));
    pell(ctx, ox + 16, 16, 8.5, 5.5, c);
    rect(ctx, ox + 11, 12, 8, 1, shade(c, 0.18));
    crack(ctx, ox, [[14, 14], [17, 17], [16, 20]], shade(c, -0.3));
  }
  if (v === 5) {
    pell(ctx, ox + 15, 18, 8, 4, '#1c262d');
    pell(ctx, ox + 15, 18, 7, 3.2, '#26353e');
    line(ctx, ox + 11, 17, ox + 15, 16, '#61808f');
    px(ctx, ox + 19, 19, '#3d5562');
  }
  if (v === 6) moss(ctx, ox, 14, 15, 5, 61, th.moss);
  if (v === 7) {
    moss(ctx, ox, 15, 20, 4, 71, th.moss);
    shroom(ctx, ox + 11, 21, false, th.glow);
    shroom(ctx, ox + 16, 19, true, th.glow);
    shroom(ctx, ox + 20, 22, false, th.glow);
  }
}

function caveTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  rect(ctx, ox, 0, S, S, st.edge);
  const n = hash(mask, 3, 95);
  const c1 = n > 0.5 ? st.topHi : st.top;
  if (mask === 0 && n < 0.45) {
    boulder(ctx, ox, 10, 10, 9.5, 8.5, c1, 1 + mask);
    boulder(ctx, ox, 23, 11, 8.5, 9.5, st.top, 2 + mask);
    boulder(ctx, ox, 16, 24, 13.5, 7.5, st.topLo, 3 + mask);
  } else {
    boulder(ctx, ox, 16, 16, 15, 14.5, c1, 4 + mask);
    if (n > 0.7) boulder(ctx, ox, 24, 24, 6, 5, st.topLo, 7 + mask);
  }
  grainImg(ctx, ox, 0, S, S, 200 + mask, 0.12);
  if (hash(mask, 11, 96) > 0.5) crack(ctx, ox, [[9, 7], [12, 12], [11, 16]], shade(st.top, -0.4));
  for (let k = 0; k < 6; k++) {
    const x = 4 + Math.floor(hash(k, mask, 97) * 24),
      y = 3 + Math.floor(hash(mask, k, 98) * 8);
    px(ctx, ox + x, y, th.moss[k % th.moss.length]);
  }
  // jagged dark rims where the rock drops to the floor
  const rim = (horizontal: boolean, at: number) => {
    for (let i = 0; i < S; i++) {
      const depth = 2 + (hash(i >> 1, at, 99) > 0.6 ? 1 : 0);
      if (horizontal) rect(ctx, ox + i, at === 0 ? 0 : S - depth, 1, depth, st.edge);
      else rect(ctx, ox + (at === 0 ? 0 : S - depth), i, depth, 1, st.edge);
    }
  };
  if (mask & 1) rim(true, 0);
  if (mask & 2) rim(false, 1);
  if (mask & 4) rim(false, 0);
}

function caveFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  rect(ctx, ox, 0, S, S, th.brickMortar);
  // the rock face: rough chunks of rock stacked in two staggered rows, lit from above
  const shift = Math.floor(hash(mask, 1, 97) * 6);
  const rows = [
    { cy: 11.5, ry: 5.2, xs: [-2 + shift, 9 + shift, 20 + shift, 31 + shift] },
    { cy: 23.5, ry: 6, xs: [3 - shift, 14 - shift + 2, 26 - shift + 2] },
  ];
  rows.forEach((row, ri) =>
    row.xs.forEach((cx, k) => {
      const c = th.brick[Math.floor(hash(mask + ri, k, 98) * th.brick.length)];
      const rx = 6 + hash(k, mask + ri, 99) * 2.5;
      boulder(ctx, ox, cx, row.cy + (hash(ri, k + mask, 100) - 0.5) * 1.5, rx, row.ry, c, k * 7 + ri * 3 + mask);
    }),
  );
  grainImg(ctx, ox, 6, S, S - 8, 300 + mask, 0.12);
  if (hash(mask, 4, 101) > 0.5) crack(ctx, ox, [[18, 9], [20, 13], [19, 16]], shade(th.brick[0], -0.45));
  // lip of the boulders above, lit from above (back to 5 px at the tile edges so neighbours line up)
  for (let i = 0; i < S; i++) {
    const fade = Math.min(1, Math.min(i, S - 1 - i) / 5);
    const j = Math.round(fade * (hash(i >> 1, mask, 96) * 3 - 1));
    const lh = 5 + j;
    rect(ctx, ox + i, 0, 1, lh, st.topHi);
    px(ctx, ox + i, 0, shade(st.topHi, 0.22));
    px(ctx, ox + i, lh - 1, shade(st.topHi, -0.3));
    px(ctx, ox + i, lh, st.edge);
  }
  // little stalactites under the lip
  for (let d = 0; d < 2; d++) {
    if (hash(mask, d, 104) < 0.45) continue;
    const dx = 5 + Math.floor(hash(d, mask, 105) * 22),
      len = 3 + Math.floor(hash(mask + d, 7, 106) * 4);
    for (let i = 0; i < len; i++) rect(ctx, ox + dx - (i < len - 2 ? 1 : 0), 6 + i, i < len - 2 ? 2 : 1, 1, i === 0 ? st.topHi : st.topLo);
  }
  // moss and glowing fungus in the cracks
  for (let i = 0; i < 6; i++) px(ctx, ox + 2 + Math.floor(hash(i, mask, 111) * 28), 6 + Math.floor(hash(mask, i, 112) * 3), th.moss[i % th.moss.length]);
  if (hash(mask, 13, 107) > 0.55) {
    const gx = 6 + Math.floor(hash(mask, 3, 108) * 20);
    for (let i = 0; i < 5; i++) px(ctx, ox + gx + Math.floor(hash(i, mask, 109) * 4), 24 + Math.floor(hash(mask, i, 110) * 4), th.glow[i % 2]);
  }
  rect(ctx, ox, S - 2, S, 2, shade(th.brickMortar, -0.45));
  if (mask & 1) rect(ctx, ox + S - 2, 0, 2, S, st.edge);
  if (mask & 2) rect(ctx, ox, 0, 2, S, st.edge);
  if (cracked) {
    const c = shade(th.brickMortar, -0.5);
    crack(ctx, ox, [[10, 6], [15, 12], [14, 18], [18, 25]], c);
    crack(ctx, ox, [[15, 12], [21, 15], [24, 13]], c);
  }
}

function iceFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const S = TILE_RES;
  const base = th.floor[v % th.floor.length];
  rect(ctx, ox, 0, S, S, base);
  mottle(ctx, ox, 0, S, S, base, v * 13 + 7, 0.05);
  // sheen streaks
  for (let k = 0; k < 2; k++) {
    const y0 = 4 + Math.floor(hash(v, k, 120) * 22);
    line(ctx, ox + 2, y0 + 4, ox + 9, y0, shade(base, 0.22));
  }
  // cracks with a light edge and a dark shadow
  const cracks = v === 3 ? 3 : v % 2 === 0 ? 1 : 0;
  for (let k = 0; k < cracks; k++) {
    const pts: number[][] = [];
    let x = 2 + hash(v, k, 121) * 8,
      y = 2 + hash(k, v, 122) * 28;
    for (let i = 0; i < 5; i++) {
      pts.push([Math.round(x), Math.round(y)]);
      x += 4 + hash(i, k + v, 123) * 4;
      y += (hash(k, i + v, 124) - 0.5) * 9;
    }
    crack(ctx, ox, pts.map(([a, b]) => [a, b + 1]), shade(base, -0.3));
    crack(ctx, ox, pts, '#eef9ff');
  }
  // sparkles
  for (let k = 0; k < 3; k++) {
    const x = 3 + Math.floor(hash(v, k, 125) * 26),
      y = 3 + Math.floor(hash(k, v, 126) * 26);
    px(ctx, ox + x, y, '#ffffff');
    if (k === 0) {
      px(ctx, ox + x - 1, y, '#dff4ff');
      px(ctx, ox + x + 1, y, '#dff4ff');
      px(ctx, ox + x, y - 1, '#dff4ff');
      px(ctx, ox + x, y + 1, '#dff4ff');
    }
  }
  if (v === 5) {
    // snow drift
    for (const [cx, cy, rx, ry] of [[9, 24, 8, 4], [15, 27, 9, 3.5], [5, 18, 4, 3]]) pell(ctx, ox + cx, cy, rx, ry, '#e2f1fa');
    for (const [cx, cy, rx, ry] of [[9, 23, 6.5, 3], [15, 26, 7.5, 2.5]]) pell(ctx, ox + cx, cy, rx, ry, '#f6fcff');
  }
  if (v === 6) {
    // frost flower
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      line(ctx, ox + 16, 16, ox + Math.round(16 + Math.cos(ang) * 6), Math.round(16 + Math.sin(ang) * 6), '#eaf7ff');
    }
    px(ctx, ox + 16, 16, '#ffffff');
  }
  if (v === 7) {
    // blue crystal shards poking out of the ice
    poly(ctx, [ox + 12, 22, ox + 14, 13, ox + 16, 22], '#6fc8ff');
    poly(ctx, [ox + 16, 23, ox + 19, 16, ox + 21, 23], '#8fd8ff');
    line(ctx, ox + 14, 14, ox + 14, 21, '#e8f8ff');
  }
  grainImg(ctx, ox, 0, S, S, v * 5 + 9, 0.05, 0.1, 0.06);
}

function iceTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  const ice = th.brick[Math.floor(hash(mask, 2, 130) * th.brick.length)];
  rect(ctx, ox, 0, S, S, st.edge);
  rect(ctx, ox + 1, 1, 30, 30, ice);
  rect(ctx, ox + 1, 29, 30, 2, shade(ice, -0.3));
  // snow cap with a soft, bumpy lower edge
  for (let x = 1; x < 31; x++) {
    const bot = 22 + Math.round(Math.sin(x * 0.55 + mask) * 1.6 + hash(x >> 1, mask, 131) * 2);
    rect(ctx, ox + x, 1, 1, bot, st.top);
    rect(ctx, ox + x, 1, 1, 3, st.topHi);
    rect(ctx, ox + x, bot - 1, 1, 2, st.topLo);
  }
  mottle(ctx, ox + 1, 1, 30, 20, st.top, mask * 7 + 3, 0.05);
  for (let k = 0; k < 5; k++) px(ctx, ox + 3 + Math.floor(hash(k, mask, 132) * 26), 3 + Math.floor(hash(mask, k, 133) * 16), '#ffffff');
  if (mask & 1) rect(ctx, ox, 0, S, 2, st.edge);
  if (mask & 2) rect(ctx, ox + S - 2, 0, 2, S, st.edge);
  if (mask & 4) rect(ctx, ox, 0, 2, S, st.edge);
}

function iceFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  rect(ctx, ox, 0, S, S, th.brickMortar);
  // columns of clear blue ice, lighter at the top
  let x = 0,
    k = 0;
  while (x < S) {
    const w = 5 + Math.floor(hash(k, mask, 134) * 5);
    const c = th.brick[Math.floor(hash(mask, k, 135) * th.brick.length)];
    const x1 = Math.min(S, x + w);
    for (let y = 6; y < S - 2; y++) {
      const t = (y - 6) / (S - 8);
      rect(ctx, ox + x, y, x1 - x, 1, shade(c, 0.18 - t * 0.38));
    }
    const hx = x + Math.max(1, Math.floor((x1 - x) / 3));
    if (hx < x1) rect(ctx, ox + hx, 8, 1, S - 14, shade(c, 0.35));
    if (x1 - 1 > x) rect(ctx, ox + x1 - 1, 6, 1, S - 8, shade(c, -0.3));
    if (hash(k, mask, 136) > 0.5) px(ctx, ox + x + 2, 14 + Math.floor(hash(mask, k, 137) * 10), '#e8f8ff');
    x = x1 + 1;
    k++;
  }
  // snow lip with icicles hanging from it
  for (let i = 0; i < S; i++) {
    const fade = Math.min(1, Math.min(i, S - 1 - i) / 5);
    const lh = 5 + Math.round(fade * (hash(i >> 1, mask, 138) * 2));
    rect(ctx, ox + i, 0, 1, lh, st.top);
    px(ctx, ox + i, 0, st.topHi);
    px(ctx, ox + i, lh - 1, st.topLo);
  }
  for (let d = 0; d < 4; d++) {
    if (hash(mask, d, 139) < 0.35) continue;
    const dx = 2 + Math.floor(hash(d, mask, 140) * 27),
      len = 3 + Math.floor(hash(mask + d, 9, 141) * 6);
    for (let i = 0; i < len; i++) {
      const wd = i < len * 0.45 ? 2 : 1;
      rect(ctx, ox + dx, 5 + i, wd, 1, i < 2 ? '#f4fbff' : '#bfe6fb');
    }
  }
  // frost at the foot
  for (let i = 0; i < 10; i++) px(ctx, ox + Math.floor(hash(i, mask, 142) * 32), S - 4 + Math.floor(hash(mask, i, 143) * 2), '#dff2fb');
  rect(ctx, ox, S - 2, S, 2, shade(th.brickMortar, -0.4));
  if (mask & 1) rect(ctx, ox + S - 2, 0, 2, S, st.edge);
  if (mask & 2) rect(ctx, ox, 0, 2, S, st.edge);
  if (cracked) {
    const c = '#18324a';
    crack(ctx, ox, [[10, 7], [15, 12], [14, 18], [18, 25]], c);
    crack(ctx, ox, [[15, 12], [21, 15], [24, 13]], c);
  }
}

function lavaFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const S = TILE_RES;
  const base = th.floor[v % th.floor.length];
  // basalt hexagons on a 32 px period, so the pattern runs seamlessly across tiles
  const centers = [
    [8, 8],
    [24, 8],
    [0, 24],
    [16, 24],
    [32, 24],
    [8, 40],
    [24, 40],
    [8, -8],
    [24, -8],
    [-8, 8],
    [40, 8],
  ];
  const glowSeam = v === 3 || v === 5 || v === 7;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let b1 = 1e9,
        b2 = 1e9,
        bi = 0;
      centers.forEach(([cx, cy], i) => {
        const d = (x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 1.15) ** 2;
        if (d < b1) {
          b2 = b1;
          b1 = d;
          bi = i;
        } else if (d < b2) b2 = d;
      });
      const seam = Math.sqrt(b2) - Math.sqrt(b1) < 1.6;
      const [cx, cy] = centers[bi];
      const cellShade = (hash(((cx + 32) % 32) + v * 3, ((cy + 32) % 32) + 7, 150) - 0.5) * 0.16;
      let c = shade(base, cellShade - ((x - cx) + (y - cy)) * 0.006);
      if (seam) c = glowSeam && hash(x >> 2, y >> 2, v + 151) > 0.35 ? th.glow[0] : th.mortar;
      px(ctx, ox + x, y, c);
    }
  grainImg(ctx, ox, 0, S, S, v * 9 + 4, 0.14);
  if (glowSeam) {
    // hot cores inside the glowing seams
    const img = ctx.getImageData(ox, 0, S, S);
    const d = img.data;
    const g0 = parseInt(th.glow[0].slice(1), 16);
    for (let i = 0; i < S * S; i++) {
      const r = d[i * 4],
        gg = d[i * 4 + 1],
        b = d[i * 4 + 2];
      if (((r << 16) | (gg << 8) | b) === g0 && hash(i, v, 152) > 0.6) {
        d[i * 4] = 255;
        d[i * 4 + 1] = 200;
        d[i * 4 + 2] = 90;
      }
    }
    ctx.putImageData(img, ox, 0);
  }
  if (v === 5) {
    for (let k = 0; k < 18; k++) px(ctx, ox + 6 + Math.floor(hash(k, 5, 153) * 20), 8 + Math.floor(hash(5, k, 154) * 16), k % 3 ? '#5a4c46' : '#6e5f58');
  }
  for (let k = 0; k < 3; k++) if (hash(v, k, 155) > 0.5) px(ctx, ox + 3 + Math.floor(hash(k, v, 156) * 26), 3 + Math.floor(hash(v + k, 1, 157) * 26), th.glow[1]);
}

function lavaTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  rect(ctx, ox, 0, S, S, st.edge);
  const c = hash(mask, 1, 160) > 0.5 ? st.topHi : st.top;
  rect(ctx, ox + 1, 1, 30, 30, c);
  mottle(ctx, ox + 1, 1, 30, 30, c, mask + 40, 0.08);
  rect(ctx, ox + 1, 1, 30, 2, shade(c, 0.18));
  rect(ctx, ox + 1, 3, 2, 26, shade(c, 0.08));
  rect(ctx, ox + 1, 29, 30, 2, shade(c, -0.3));
  rect(ctx, ox + 29, 3, 2, 26, shade(c, -0.2));
  grainImg(ctx, ox + 1, 1, 30, 30, 400 + mask, 0.15);
  // a glowing magma seam across the rock
  let x = 3 + Math.floor(hash(mask, 3, 161) * 6),
    y = 4 + Math.floor(hash(mask, 4, 162) * 8);
  for (let i = 0; i < 14; i++) {
    px(ctx, ox + x, y, i % 4 === 1 ? th.glow[1] : th.glow[0]);
    x += hash(i, mask, 163) > 0.3 ? 2 : 1;
    y += hash(mask, i, 164) > 0.5 ? 1 : 0;
    if (x > 28 || y > 28) break;
  }
  if (mask & 1) rect(ctx, ox, 0, S, 2, st.edge);
  if (mask & 2) rect(ctx, ox + S - 2, 0, 2, S, st.edge);
  if (mask & 4) rect(ctx, ox, 0, 2, S, st.edge);
}

function lavaFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  rect(ctx, ox, 0, S, S, th.brickMortar);
  // basalt columns
  for (let col = 0; col < 5; col++) {
    const x0 = col * 6 + (col > 0 ? 1 : 0) + Math.floor(mask / 2) % 2,
      w = 5;
    if (x0 >= S) break;
    const c = th.brick[Math.floor(hash(col, mask, 165) * th.brick.length)];
    const top = 6 + Math.floor(hash(mask, col, 166) * 3);
    rect(ctx, ox + x0, top, w, S - 2 - top, c);
    rect(ctx, ox + x0, top, 1, S - 2 - top, shade(c, 0.16));
    rect(ctx, ox + x0 + w - 1, top, 1, S - 2 - top, shade(c, -0.3));
    rect(ctx, ox + x0, top, w, 1, shade(c, 0.28));
    if (hash(col, mask, 167) > 0.5) rect(ctx, ox + x0 + 1, top + 8 + Math.floor(hash(mask, col, 168) * 10), w - 2, 1, shade(c, -0.4));
  }
  grainImg(ctx, ox, 6, S, S - 8, 500 + mask, 0.14);
  // dark rock lip
  rect(ctx, ox, 0, S, 5, st.topHi);
  rect(ctx, ox, 0, S, 1, shade(st.topHi, 0.2));
  rect(ctx, ox, 4, S, 1, shade(st.topHi, -0.3));
  rect(ctx, ox, 5, S, 1, st.edge);
  // heat glow at the foot of the wall
  const glow = parseInt(th.glow[0].slice(1), 16);
  for (let y = S - 7; y < S - 2; y++) {
    const a = ((y - (S - 7)) / 5) * 0.55;
    ctx.fillStyle = `rgba(${(glow >> 16) & 255},${(glow >> 8) & 255},${glow & 255},${a})`;
    ctx.fillRect(ox, y, S, 1);
  }
  for (let i = 0; i < 4; i++) px(ctx, ox + Math.floor(hash(i, mask, 169) * 32), S - 4 - Math.floor(hash(mask, i, 170) * 6), th.glow[1]);
  // dripping magma on some walls
  if (hash(mask, 9, 171) > 0.55) {
    const dx = 6 + Math.floor(hash(mask, 2, 172) * 20);
    rect(ctx, ox + dx, 6, 1, 8 + Math.floor(hash(mask, 5, 173) * 10), th.glow[0]);
    px(ctx, ox + dx, 7, th.glow[2]);
  }
  rect(ctx, ox, S - 2, S, 2, shade(th.brickMortar, -0.4));
  if (mask & 1) rect(ctx, ox + S - 2, 0, 2, S, st.edge);
  if (mask & 2) rect(ctx, ox, 0, 2, S, st.edge);
  if (cracked) {
    const c = '#050303';
    crack(ctx, ox, [[10, 7], [15, 12], [14, 18], [18, 25]], c);
    crack(ctx, ox, [[15, 12], [21, 15], [24, 13]], c);
    px(ctx, ox + 15, 12, th.glow[0]);
  }
}

// small glowing rune (one of a few glyphs)
function rune(ctx: CanvasRenderingContext2D, x: number, y: number, kind: number, col: string, core: string) {
  const G = [
    [[0, 0], [0, 6], [0, 3], [3, 0], [0, 3], [3, 6]],
    [[0, 0], [4, 0], [2, 0], [2, 6], [0, 6], [4, 6]],
    [[2, 0], [0, 3], [2, 6], [4, 3], [2, 0]],
    [[0, 6], [2, 0], [4, 6], [1, 3], [3, 3]],
  ][kind % 4];
  for (let i = 0; i < G.length - 1; i += kind % 4 === 2 ? 1 : 2) line(ctx, x + G[i][0], y + G[i][1], x + G[i + 1][0], y + G[i + 1][1], col);
  px(ctx, x + 2, y + 3, core);
}

function abyssFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const S = TILE_RES;
  const base = th.floor[v % th.floor.length];
  rect(ctx, ox, 0, S, S, th.mortar);
  const slab = (x: number, y: number, w: number, h: number, c: string, seed: number) => {
    stoneBlock(ctx, ox + x, y, w, h, c, seed, th.mortar, 0.05);
    mottle(ctx, ox + x, y, w, h, c, seed + 5, 0.06);
  };
  if (v === 4) {
    slab(1, 1, 14, 30, base, 31);
    slab(16, 1, 15, 30, shade(base, 0.04), 32);
  } else slab(1, 1, 30, 30, base, v * 7 + 33);
  grainImg(ctx, ox, 0, S, S, v * 3 + 11, 0.1);
  if (v === 3 || v === 6) {
    const pts = v === 3 ? [[4, 9], [10, 13], [14, 12], [19, 18], [26, 21]] : [[16, 3], [14, 10], [17, 16], [15, 23], [18, 29]];
    crack(ctx, ox, pts.map(([a, b]) => [a, b + 1]), th.glow[2]);
    crack(ctx, ox, pts, th.glow[0]);
    px(ctx, ox + pts[2][0], pts[2][1], th.glow[1]);
  }
  if (v === 7) rune(ctx, ox + 14, 12, v + 1, th.glow[0], th.glow[1]);
  if (v === 5) {
    // faint circle of a ward
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      if (a % 3 === 0) continue;
      px(ctx, ox + Math.round(16 + Math.cos(ang) * 9), Math.round(16 + Math.sin(ang) * 6), th.glow[2]);
    }
  }
  for (let k = 0; k < 4; k++) px(ctx, ox + 2 + Math.floor(hash(k, v, 180) * 28), 2 + Math.floor(hash(v, k, 181) * 28), hash(k, v + 2, 182) > 0.5 ? th.glow[2] : '#5a4a70');
}

function abyssTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  drawWallTop(ctx, ox, mask, { ...th, style: 'bricks' });
  // glassy obsidian: a diagonal sheen and violet glints along the bevel
  const n = hash(mask, 3, 183);
  for (let i = 0; i < 9; i++) px(ctx, ox + 5 + i, 4 + Math.floor(i * 0.6), shade(st.topHi, 0.12));
  line(ctx, ox + 2, 2, ox + 12, 2, th.glow[2]);
  line(ctx, ox + 2, 2, ox + 2, 9, th.glow[2]);
  if (n > 0.55) {
    // a small cluster of violet crystals growing out of the rock
    const cx = 16 + Math.floor(hash(mask, 5, 184) * 8),
      cy = 18 + Math.floor(hash(mask, 6, 185) * 6);
    poly(ctx, [ox + cx - 3, cy + 3, ox + cx - 2, cy - 4, ox + cx, cy + 3], th.glow[2]);
    poly(ctx, [ox + cx - 1, cy + 3, ox + cx + 1, cy - 7, ox + cx + 3, cy + 3], th.glow[0]);
    line(ctx, ox + cx + 1, cy - 6, ox + cx + 1, cy + 1, th.glow[1]);
    poly(ctx, [ox + cx + 2, cy + 3, ox + cx + 4, cy - 2, ox + cx + 5, cy + 3], th.glow[2]);
  }
}

function abyssFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  drawWallFront(ctx, ox, mask, false, { ...th, style: 'bricks' });
  // carved runes glowing in some blocks, a seam of violet light in others
  const r = hash(mask, 5, 185);
  if (r > 0.45) rune(ctx, ox + 12 + Math.floor(hash(mask, 6, 186) * 8), 9, mask, th.glow[0], th.glow[1]);
  else if (r > 0.2) {
    const sx = 6 + Math.floor(hash(mask, 7, 187) * 20);
    rect(ctx, ox + sx, 7, 1, 21, th.glow[2]);
    px(ctx, ox + sx, 12, th.glow[0]);
    px(ctx, ox + sx, 20, th.glow[0]);
  }
  rect(ctx, ox, 0, S, 1, shade(st.topHi, 0.15));
  if (cracked) {
    const c = '#08050c';
    crack(ctx, ox, [[10, 6], [15, 12], [14, 18], [18, 25]], c);
    crack(ctx, ox, [[15, 12], [21, 15], [24, 13]], c);
    px(ctx, ox + 15, 12, th.glow[0]);
  }
}

function biomeRock(ctx: CanvasRenderingContext2D, ox: number, th: Theme) {
  const S = TILE_RES;
  const st = th.stone;
  const base = shade(st.topLo, th.style === 'ice' ? -0.55 : -0.4);
  rect(ctx, ox, 0, S, S, shade(base, -0.25));
  if (th.style === 'cave') {
    boulder(ctx, ox, 16, 16, 15, 14.5, base, 77);
    grainImg(ctx, ox, 0, S, S, 701, 0.1);
  } else {
    rect(ctx, ox + 1, 1, 30, 30, base);
    mottle(ctx, ox + 1, 1, 30, 30, base, 77, 0.08);
    rect(ctx, ox + 1, 1, 30, 1, shade(base, 0.12));
    rect(ctx, ox + 1, 30, 30, 1, shade(base, -0.2));
  }
  if (th.style === 'lava') px(ctx, ox + 21, 9, shade(th.glow[0], -0.4));
  if (th.style === 'abyss') {
    px(ctx, ox + 9, 11, '#4a3a66');
    px(ctx, ox + 23, 21, '#4a3a66');
  }
}

type FloorPainter = (ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) => void;
type FrontPainter = (ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) => void;
const BIOME_PAINTERS: Record<BiomeStyle, { floor: FloorPainter; top: FloorPainter; front: FrontPainter; rock: (ctx: CanvasRenderingContext2D, ox: number, th: Theme) => void }> = {
  bricks: { floor: drawFloor, top: drawWallTop, front: drawWallFront, rock: drawRock },
  cave: { floor: caveFloor, top: caveTop, front: caveFront, rock: biomeRock },
  ice: { floor: iceFloor, top: iceTop, front: iceFront, rock: biomeRock },
  lava: { floor: lavaFloor, top: lavaTop, front: lavaFront, rock: biomeRock },
  abyss: { floor: abyssFloor, top: abyssTop, front: abyssFront, rock: biomeRock },
};

function buildTileset() {
  const S = TILE_RES;
  THEMES.forEach((th, ti) => {
    const [c, ctx] = canvas(S * TILE.count, S);
    const P = BIOME_PAINTERS[th.style];
    for (let v = 0; v < 8; v++) P.floor(ctx, S * (1 + v), v, th);
    for (let m = 0; m < 8; m++) P.top(ctx, S * (TILE.top + m), m, th);
    for (let m = 0; m < 4; m++) P.front(ctx, S * (TILE.front + m), m, false, th);
    P.front(ctx, S * TILE.frontCrack, 0, true, th);
    P.front(ctx, S * (TILE.frontCrack + 1), 0, true, th);
    P.floor(ctx, S * 23, 0, th);
    rect(ctx, S * TILE.fog, 0, S, S, '#07060a');
    P.rock(ctx, S * TILE.rock, th);
    addCanvas('tiles_' + ti, c);
    if (ti === 0) addCanvas('tiles', c);
  });
}

// ---------------------------------------------------------------------------
// HUMANOIDS (16x20, 6 frames: idle0, idle1, walk0..3)
// ---------------------------------------------------------------------------
const HEADS: Record<string, string[]> = {
  helm: [
    '................',
    '....oooooooo....',
    '...ojiiiihhjo...',
    '...ojiihhhhjo...',
    '...ojhhhhhhjo...',
    '...ojoooooojo...',
    '...ojsessesjo...',
    '...ojssddssjo...',
    '....ojjjjjjo....',
  ],
  hood: [
    '......oooo......',
    '.....ohhhho.....',
    '....ohhhhhho....',
    '...ohhhjjhhho...',
    '...ohjoooojho...',
    '...ohjddddjho...',
    '...ohjessejho...',
    '...ohjsddsjho...',
    '....ohhhhhho....',
  ],
  hoodMask: [
    '......oooo......',
    '.....ohhhho.....',
    '....ohhhhhho....',
    '...ohhhjjhhho...',
    '...ohjoooojho...',
    '...ohjddddjho...',
    '...ohjessejho...',
    '...ohjmmmmjho...',
    '....ohhhhhho....',
  ],
  wizard: [
    '........oo......',
    '.......ohho.....',
    '......ohhiho....',
    '.....ohhhhho....',
    '..oooaaaaaaooo..',
    '.ohhhhhhhhhhhho.',
    '....osesseso....',
    '....oyyddyyo....',
    '.....oyyyyo.....',
  ],
  paladin: [
    '.......rr.......',
    '....ooorrooo....',
    '...ojiiaaiijo...',
    '...ojiiaaiijo...',
    '...ojhhaahhjo...',
    '...ojaaaaaajo...',
    '...ojsessesjo...',
    '...ojssddssjo...',
    '....oaaaaaao....',
  ],
  horned: [
    '.oo..........oo.',
    '.oyo.oooooo.oyo.',
    '..oyojhhhhjoyo..',
    '...oojhhhhjoo...',
    '...ojhhhhhhjo...',
    '...osssssssso...',
    '...ossessesso...',
    '...ofssddssfo...',
    '....offffffo....',
  ],
  antlers: [
    '..y.y......y.y..',
    '..yyy.oooo.yyy..',
    '...yohhhhhhoy...',
    '...ohhhjjhhho...',
    '...ohjoooojho...',
    '...ohjddddjho...',
    '...ohjessejho...',
    '...ohjsddsjho...',
    '....ohhhhhho....',
  ],
  bald: [
    '................',
    '.....oooooo.....',
    '....osssssso....',
    '...osisssssso...',
    '...oaaaaaaaao...',
    '...osssssssso...',
    '...ossessesso...',
    '...osssddssso...',
    '....osssssso....',
  ],
  feathers: [
    '....f.f..f.f....',
    '...ofofoofofo...',
    '...ohhhhhhhho...',
    '...ohaahhaaho...',
    '...ohhhhhhhho...',
    '...osssssssso...',
    '...ossessesso...',
    '...osrsddsrso...',
    '....osssssso....',
  ],
  goblin: [
    '................',
    '................',
    '.....oooooo.....',
    '....osssssso....',
    '..ooossssssooo..',
    '.ossosessesosso.',
    '.oo.osssssso.oo.',
    '....osddddso....',
    '.....oooooo.....',
  ],
  orc: [
    '................',
    '.....oooooo.....',
    '....osssssso....',
    '...osssssssso...',
    '...ojjjjjjjjo...',
    '...osesssseso...',
    '...osssddssso...',
    '...osyssssyso...',
    '....osssssso....',
  ],
  zombie: [
    '................',
    '.....oooooo.....',
    '....ohhhhhho....',
    '...ohhhhhhhho...',
    '...ohsshhssho...',
    '...osssssssso...',
    '...osessdesso...',
    '...ossddddsso...',
    '....osssssso....',
  ],
  vampire: [
    '................',
    '.....oooooo.....',
    '....ohhhhhho....',
    '...ohhhhhhhho...',
    '...ohhhsshhho...',
    '...ohsssssssho..',
    '...oosessesoo...',
    '..aoossddssooa..',
    '..aaaooooooaaa..',
  ],
  lich: [
    '....a.a..a.a....',
    '....aaaaaaaa....',
    '...oaaiaaiaao...',
    '...osssssssso...',
    '...osssssssso...',
    '...oeesssseeo...',
    '...osssoossso...',
    '....osososso....',
    '.....oooooo.....',
  ],
  demon: [
    '.oo..........oo.',
    '.oyo........oyo.',
    '..oyooooooooyo..',
    '...osssssssso...',
    '...ojjssssjjo...',
    '...osesssseso...',
    '...osssssssso...',
    '...osyddddyso...',
    '....osssssso....',
  ],
  merchant: [
    '................',
    '.....oooooo.....',
    '....ohhhhhho....',
    '...ohhhhhhhho...',
    '..oaaaaaaaaaao..',
    '...osssssssso...',
    '...ossessesso...',
    '...oyyyddyyyo...',
    '....oyyyyyyo....',
  ],
};

const TORSO = ['...ouuccccuuo...', '...ouvcaacvuo...', '...ovvcaacvvo...', '...ogvccccvgo...', '....ollalllo....'];
const LEGS_STAND = ['....occcccco....', '....ovccccvo....', '....oppooppo....', '....oqpooqpo....', '....obboobbo....', '....oooooooo....'];
const LEGS_A = ['....occcccco....', '....ovccccvo....', '....oppooppo....', '....obbooqpo....', '....ooooobbo....', '........oooo....'];
const LEGS_B = ['....occcccco....', '....ovccccvo....', '....oppooppo....', '....oqpoobbo....', '....obbooooo....', '....oooo........'];
const ROBE = ['....occcccco....', '...ocvccccvco...', '...ocvccccvco...', '...ovccccccvo...', '...ovvvvvvvvo...'];
const ROBE_STAND = '....obboobbo....';
const ROBE_A = '...obbo...oo....';
const ROBE_B = '....oo...obbo...';

function drawHumanoid(ctx: CanvasRenderingContext2D, ox: number, head: string, body: 'armor' | 'robe', pal: Record<string, string>, frame: number) {
  const p = { ...pal, o: OUT };
  const bob = frame === 1 || frame === 3 || frame === 5 ? 1 : 0;
  const legSet = frame === 2 ? 'A' : frame === 4 ? 'B' : 'S';
  // head rows 0..8, torso rows 9..13
  tpl(ctx, HEADS[head] ?? HEADS.helm, p, ox, 0 + bob);
  tpl(ctx, TORSO, p, ox, 9 + bob);
  if (body === 'armor') {
    const legs = legSet === 'A' ? LEGS_A : legSet === 'B' ? LEGS_B : LEGS_STAND;
    // first two rows (skirt) bob with body
    tpl(ctx, legs.slice(0, 2), p, ox, 14 + bob);
    tpl(ctx, legs.slice(2), p, ox, 16);
    if (bob) tpl(ctx, ['....oppooppo....'], p, ox, 16);
  } else {
    tpl(ctx, ROBE.slice(0, bob ? 4 : 5), p, ox, 14 + bob);
    tpl(ctx, [legSet === 'A' ? ROBE_A : legSet === 'B' ? ROBE_B : ROBE_STAND], p, ox, 19);
  }
}

function humanoidStrip(key: string, head: string, body: 'armor' | 'robe', pal: Record<string, string>, extra?: (ctx: CanvasRenderingContext2D, ox: number, f: number) => void) {
  const [c, ctx] = canvas(16 * 6, 20);
  for (let f = 0; f < 6; f++) {
    drawHumanoid(ctx, f * 16, head, body, pal, f);
    extra?.(ctx, f * 16, f);
  }
  addStrip(key, c, 16, 20, 6);
}

function buildClassSprites() {
  // heroes are drawn natively at double detail (no smoothing upscale needed)
  for (const cl of CLASSES) addStrip('pl_' + cl.id, buildHeroStrip(cl), HERO_W, HERO_H, HERO_FRAMES.count, false);
}

// ---------------------------------------------------------------------------
// ENEMIES
// ---------------------------------------------------------------------------
const SKULL = ['.....oooooo.....', '....osssssso....', '...osssssssso...', '...osssssssso...', '...oeesssseeo...', '...oeesooseeo...', '....osososso....', '.....oooooo.....'];
const SKEL_BODY_A = [
  '......osso......',
  '...ssosssssoss..',
  '...s.osdsdso.s..',
  '...s..osdso..s..',
  '...s..ossso..s..',
  '.....osssso.....',
  '......os.so.....',
  '......os.so.....',
  '......os.so.....',
  '.....oss.sso....',
];
const SKEL_BODY_B = [
  '......osso......',
  '...ssosssssoss..',
  '...s.osdsdso.s..',
  '...s..osdso..s..',
  '...s..ossso..s..',
  '.....osssso.....',
  '.....os..so.....',
  '.....os...so....',
  '....oss...so....',
  '..........sso...',
];
const SKEL_BODY_C = [
  '......osso......',
  '...ssosssssoss..',
  '...s.osdsdso.s..',
  '...s..osdso..s..',
  '...s..ossso..s..',
  '.....osssso.....',
  '......os..so....',
  '.....os...so....',
  '.....os...oss...',
  '....sso.........',
];

function skeletonStrip(key: string, pal: Record<string, string>, opts: { shield?: boolean; sword?: boolean; bow?: boolean; crown?: boolean; hood?: string; cape?: string } = {}) {
  const [c, ctx] = canvas(16 * 6, 20);
  const p = { o: OUT, ...pal };
  for (let f = 0; f < 6; f++) {
    const ox = f * 16;
    const bob = f === 1 || f === 3 || f === 5 ? 1 : 0;
    if (opts.cape) {
      rect(ctx, ox + 5, 9 + bob, 6, 7, opts.cape);
      rect(ctx, ox + 5, 15 + bob, 6, 1, shade(opts.cape, -0.3));
    }
    tpl(ctx, SKULL, p, ox, 0 + bob);
    const body = f === 2 ? SKEL_BODY_B : f === 4 ? SKEL_BODY_C : SKEL_BODY_A;
    tpl(ctx, body.slice(0, 6), p, ox, 8 + bob);
    tpl(ctx, body.slice(6), p, ox, 14);
    if (opts.crown) {
      rect(ctx, ox + 4, 0 + bob, 8, 2, '#e9b949');
      px(ctx, ox + 4, -1 + bob + 0, '#e9b949');
      px(ctx, ox + 7, 0 + bob, '#d1342f');
      px(ctx, ox + 5, -0 + bob, '#ffe17a');
    }
    if (opts.hood) {
      rect(ctx, ox + 4, 0 + bob, 8, 3, opts.hood);
      rect(ctx, ox + 3, 2 + bob, 1, 5, opts.hood);
      rect(ctx, ox + 12, 2 + bob, 1, 5, opts.hood);
    }
    if (opts.shield) {
      circle(ctx, ox + 3, 13 + bob, 3, '#6b4423');
      circle(ctx, ox + 3, 13 + bob, 2, '#8a5a2b');
      px(ctx, ox + 3, 13 + bob, '#c0c0c0');
      // rim
      px(ctx, ox + 0, 13 + bob, '#9aa3ad');
      px(ctx, ox + 3, 10 + bob, '#9aa3ad');
    }
    if (opts.sword) {
      line(ctx, ox + 14, 5 + bob, ox + 14, 12 + bob, '#d5dbe0');
      px(ctx, ox + 15, 6 + bob, '#9aa3ad');
      rect(ctx, ox + 12, 12 + bob, 4, 1, '#8a6a2b');
      px(ctx, ox + 14, 13 + bob, '#5a3a1b');
    }
    if (opts.bow) {
      line(ctx, ox + 14, 5 + bob, ox + 15, 8 + bob, '#8a5a2b');
      line(ctx, ox + 15, 9 + bob, ox + 15, 12 + bob, '#8a5a2b');
      line(ctx, ox + 14, 15 + bob, ox + 15, 13 + bob, '#8a5a2b');
      line(ctx, ox + 13, 6 + bob, ox + 13, 14 + bob, '#d8d0c0');
    }
  }
  outline(c, OUT);
  addStrip(key, c, 16, 20, 6);
}

function creatureStrip(key: string, w: number, h: number, frames: number, draw: (ctx: CanvasRenderingContext2D, f: number) => void, doOutline = true) {
  const [c, ctx] = canvas(w * frames, h);
  for (let f = 0; f < frames; f++) {
    const [fc, fctx] = canvas(w, h);
    draw(fctx, f);
    crisp(fc);
    if (doOutline) outline(fc, OUT);
    ctx.drawImage(fc, f * w, 0);
  }
  addStrip(key, c, w, h, frames);
}

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx: CanvasRenderingContext2D, pts: number[], col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function buildEnemies() {
  const bone = { s: '#e8e2cf', d: '#b9b29c', e: '#1a1420' };
  skeletonStrip('en_skeleton', bone, { shield: true, sword: true });
  skeletonStrip('en_skelArcher', { ...bone, s: '#ddd6c0' }, { bow: true, hood: '#4a3a2a' });
  skeletonStrip('en_skelKing', { ...bone, e: '#ff3b3b' }, { crown: true, sword: true, cape: '#6a1b9a' });
  skeletonStrip('al_skeleton', { s: '#cfe8d0', d: '#8fb894', e: '#3bff7a' }, { shield: true, sword: true });
  skeletonStrip('al_skelMage', { s: '#d9d0f0', d: '#a89cc8', e: '#c77dff' }, { hood: '#4a2a7a' });

  // bat
  creatureStrip('en_bat', 16, 12, 2, (ctx, f) => {
    const wy = f === 0 ? 2 : 7;
    poly(ctx, [8, 6, 1, wy, 3, 9, 5, 7, 8, 9], '#5b3a72');
    poly(ctx, [8, 6, 15, wy, 13, 9, 11, 7, 8, 9], '#5b3a72');
    ell(ctx, 8, 7, 3, 3, '#3e2752');
    px(ctx, 7, 6, '#ff4d4d');
    px(ctx, 9, 6, '#ff4d4d');
    px(ctx, 6, 4, '#3e2752');
    px(ctx, 10, 4, '#3e2752');
  });
  // slime
  const slimeFrame = (col: string, hi: string, dk: string) => (ctx: CanvasRenderingContext2D, f: number) => {
    const sq = f === 0 ? 0 : 1;
    ell(ctx, 8, 9 + sq * 0.5, 6.5 + sq, 4.5 - sq * 0.5, col);
    ell(ctx, 8, 7 + sq, 5 + sq * 0.5, 4 - sq * 0.5, col);
    ell(ctx, 8, 11, 6 + sq, 1.5, dk);
    ell(ctx, 6, 5 + sq, 1.5, 1, hi);
    px(ctx, 6, 8, '#122012');
    px(ctx, 10, 8, '#122012');
  };
  creatureStrip('en_slime', 16, 14, 2, slimeFrame('#5fcf4a', '#c8ffb8', '#3f9a32'));
  // spider
  creatureStrip('en_spider', 18, 13, 2, (ctx, f) => {
    const lc = '#2a1f2e';
    const o = f === 0 ? 0 : 1;
    for (let i = 0; i < 4; i++) {
      const yy = 4 + i * 2;
      line(ctx, 8, 7, 1 + (i % 2 ? o : -o) + 1, yy + (i < 2 ? -2 : 2), lc);
      line(ctx, 10, 7, 16 - (i % 2 ? o : -o) - 1, yy + (i < 2 ? -2 : 2), lc);
    }
    ell(ctx, 9, 8, 4, 3.5, '#3b2c42');
    ell(ctx, 9, 4.5, 3, 2.5, '#4a3854');
    px(ctx, 8, 4, '#ff3b3b');
    px(ctx, 10, 4, '#ff3b3b');
    px(ctx, 9, 9, '#a34fd6');
  });
  // ghost
  const ghost = (body: string, dark: string, eye: string) => (ctx: CanvasRenderingContext2D, f: number) => {
    ell(ctx, 8, 7, 5.5, 5.5, body);
    rect(ctx, 2.5, 7, 11, 6, body);
    for (let i = 0; i < 4; i++) {
      const xx = 3 + i * 3 + (f ? 1 : 0);
      ell(ctx, xx, 13, 1.4, 1.6, body);
    }
    ell(ctx, 6, 7, 1.2, 1.6, eye);
    ell(ctx, 10, 7, 1.2, 1.6, eye);
    ell(ctx, 8, 11, 1.4, 1, dark);
  };
  creatureStrip('en_ghost', 16, 16, 2, ghost('#e6ecf5', '#8792a8', '#1a1a2a'));
  creatureStrip('en_wraith', 16, 16, 2, ghost('#9fd8ff', '#3e7fb0', '#0a2a4a'));
  creatureStrip('al_ancestor', 16, 16, 2, ghost('#b8ffee', '#5bbfa8', '#1b5a4a'));
  // golem
  const golem = (a: string, b: string, c: string, eye: string) => (ctx: CanvasRenderingContext2D, f: number) => {
    const o = f === 0 ? 0 : 1;
    rect(ctx, 5, 13, 3, 5 - o, b);
    rect(ctx, 11, 13, 3, 4 + o, b);
    rect(ctx, 4, 5, 11, 9, a);
    rect(ctx, 1, 6 + o, 3, 8, b);
    rect(ctx, 15, 6 - o + 1, 3, 8, b);
    rect(ctx, 6, 1, 7, 5, a);
    rect(ctx, 4, 5, 11, 1, c);
    rect(ctx, 6, 1, 7, 1, c);
    px(ctx, 8, 3, eye);
    px(ctx, 11, 3, eye);
    line(ctx, 6, 8, 9, 11, b);
    line(ctx, 12, 7, 13, 10, b);
  };
  creatureStrip('en_golem', 19, 19, 2, golem('#7d7a72', '#5e5b55', '#9d9a92', '#ffb33b'));
  creatureStrip('al_boneGolem', 19, 19, 2, golem('#e8e2cf', '#b9b29c', '#fffaf0', '#3bff7a'));
  // mimic
  creatureStrip('en_mimic', 16, 16, 2, (ctx, f) => {
    const open = f === 0 ? 2 : 4;
    rect(ctx, 1, 8, 14, 7, '#7a4a22');
    rect(ctx, 1, 8, 14, 1, '#e9b949');
    rect(ctx, 1, 8 - open - 4, 14, 4, '#8a5a2b');
    rect(ctx, 1, 8 - open - 4, 14, 1, '#e9b949');
    rect(ctx, 2, 8 - open, 12, open, '#4a0d14');
    for (let i = 0; i < 6; i++) {
      px(ctx, 2 + i * 2, 8 - open, '#f5f0e0');
      px(ctx, 3 + i * 2, 7, '#f5f0e0');
    }
    rect(ctx, 6, 9, 4, 2, '#d64d6d');
    px(ctx, 4, 8 - open - 2, '#ffde3b');
    px(ctx, 11, 8 - open - 2, '#ffde3b');
  });

  // humanoid enemies
  humanoidStrip('en_goblin', 'goblin', 'armor', { s: '#7fbf4a', d: '#5a8f32', e: '#ff3b3b', u: '#6b4a2b', c: '#7a5a3a', v: '#5a3f27', w: '#9a7a4a', a: '#a0a0a0', l: '#3b2a1a', p: '#5a4a32', q: '#3e3222', b: '#2e2216', g: '#7fbf4a' });
  // treasure goblin: golden skin, purple rags and a sack of coins on its back
  humanoidStrip('en_thief', 'goblin', 'armor', { s: '#ffd23a', d: '#c8961a', e: '#ff3b3b', u: '#5a2a6a', c: '#6a2f7a', v: '#45204f', w: '#8a4a9a', a: '#ffe45c', l: '#3b2a1a', p: '#4a2a5a', q: '#33203e', b: '#2e2216', g: '#ffd23a' }, (ctx, ox, f) => {
    const y = 8 + (f === 1 || f === 3 || f === 5 ? 1 : 0);
    rect(ctx, ox, y + 1, 5, 5, OUT);
    rect(ctx, ox + 1, y, 3, 1, OUT);
    rect(ctx, ox + 1, y + 2, 3, 3, '#9a6a32');
    px(ctx, ox + 2, y + 1, '#6a4020');
    px(ctx, ox + 1, y + 2, '#c08a44');
    px(ctx, ox + 2, y + 3, '#ffe45c');
  });
  humanoidStrip('en_orc', 'orc', 'armor', { s: '#5f8f3a', j: '#3f6a24', d: '#4a7a2c', e: '#ffde3b', y: '#f5f0e0', u: '#6b6f78', c: '#5a4030', v: '#3e2b20', w: '#7a5a42', a: '#9aa3ad', l: '#2e2216', p: '#4a3a2a', q: '#33281c', b: '#222', g: '#5f8f3a' });
  humanoidStrip('en_zombie', 'zombie', 'armor', { s: '#8fa88a', d: '#6a8064', e: '#ffde3b', h: '#3a3226', u: '#4a5a6a', c: '#5a6a7a', v: '#3e4a56', w: '#6a7a8a', a: '#5a6a7a', l: '#3b2a1a', p: '#3a3a4a', q: '#2a2a36', b: '#222', g: '#8fa88a' });
  humanoidStrip('en_cultist', 'hood', 'robe', { h: '#8a1c1c', j: '#5a1010', i: '#b02a2a', s: '#d9a07a', d: '#4a1a1a', e: '#ffcf3b', c: '#7a1818', v: '#4f0f0f', w: '#a02424', u: '#7a1818', a: '#e9b949', l: '#2a1a1a', b: '#1a1010', g: '#d9a07a' });
  humanoidStrip('en_darkMage', 'hood', 'robe', { h: '#3a1f5a', j: '#24123a', i: '#55307f', s: '#c8b8d8', d: '#24123a', e: '#c77dff', c: '#3a1f5a', v: '#24123a', w: '#55307f', u: '#3a1f5a', a: '#c77dff', l: '#1a1020', b: '#120a18', g: '#c8b8d8' });
  humanoidStrip('en_imp', 'horned', 'armor', { h: '#c43a2a', j: '#8a2418', i: '#e65a42', y: '#2a1a1a', s: '#d6452f', d: '#9a2a1c', e: '#ffde3b', f: '#9a2a1c', u: '#d6452f', c: '#d6452f', v: '#9a2a1c', w: '#ef6a4a', a: '#2a1a1a', l: '#2a1a1a', p: '#9a2a1c', q: '#6a1a10', b: '#2a1a1a', g: '#d6452f' });
  humanoidStrip('en_vampire', 'vampire', 'robe', { h: '#1a1420', s: '#e8e0e8', d: '#b8a8b8', e: '#ff2a4a', a: '#8a0f2a', c: '#2a1430', v: '#1a0c20', w: '#3e2048', u: '#8a0f2a', l: '#8a0f2a', b: '#111', g: '#e8e0e8' });
  humanoidStrip('en_shadowKnight', 'helm', 'armor', { h: '#2a2a36', j: '#16161e', i: '#44445a', s: '#0a0a10', d: '#0a0a10', e: '#ff2a2a', u: '#3a1a4a', c: '#2a2a36', v: '#16161e', w: '#44445a', a: '#a01a1a', l: '#111', p: '#1e1e28', q: '#111118', b: '#0a0a10', g: '#2a2a36' });
  humanoidStrip('al_deathKnight', 'helm', 'armor', { h: '#3a4a3e', j: '#222e26', i: '#5a6e5e', s: '#0a100c', d: '#0a100c', e: '#3bff7a', u: '#1f3a2a', c: '#3a4a3e', v: '#222e26', w: '#5a6e5e', a: '#7bd88f', l: '#111', p: '#222e26', q: '#141c17', b: '#0a100c', g: '#3a4a3e' });
  humanoidStrip('en_lich', 'lich', 'robe', { a: '#e9b949', i: '#c77dff', s: '#e8e2cf', e: '#c77dff', c: '#3a1f5a', v: '#24123a', w: '#55307f', u: '#3a1f5a', l: '#e9b949', b: '#120a18', g: '#e8e2cf', d: '#b9b29c' });
  humanoidStrip('en_demon', 'demon', 'armor', { y: '#2a1a1a', s: '#b8281c', j: '#7a1810', d: '#7a1810', e: '#ffde3b', u: '#2a1a1a', c: '#3a2020', v: '#221010', w: '#5a3030', a: '#ff7a2a', l: '#111', p: '#3a2020', q: '#221010', b: '#111', g: '#b8281c' });
  humanoidStrip('npc_merchant', 'merchant', 'robe', { h: '#6a2c8a', a: '#e9b949', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a', y: '#d8d8e0', c: '#6a2c8a', v: '#4a1c62', w: '#8a44aa', u: '#6a2c8a', l: '#e9b949', b: '#3b2716', g: '#f1c39b' });
  humanoidStrip('npc_alchemist', 'merchant', 'robe', { h: '#1f6a5a', a: '#7dffcf', s: '#f1c39b', d: '#c98f6b', e: '#1b1b2a', y: '#eceaf4', c: '#1f5a5a', v: '#123c3c', w: '#2f7a7a', u: '#1f5a5a', l: '#7dffcf', b: '#2a1e14', g: '#f1c39b' });
  // the alchemist's cauldron: black iron, green brew
  {
    const [c, ctx] = canvas(16, 14);
    ctx.fillStyle = '#1a1a20';
    ctx.beginPath();
    ctx.ellipse(8, 8, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(3, 12, 2, 2);
    ctx.fillRect(11, 12, 2, 2);
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(1, 4, 14, 2);
    ctx.fillStyle = '#5dff9a';
    ctx.fillRect(3, 3, 10, 2);
    ctx.fillStyle = '#b8ffd4';
    ctx.fillRect(5, 2, 2, 1);
    ctx.fillRect(10, 3, 1, 1);
    ctx.fillStyle = '#2a2a34';
    ctx.fillRect(4, 9, 3, 1);
    addCanvas('cauldron', c);
  }
  humanoidStrip('al_treant', 'antlers', 'robe', { h: '#4f7f3a', j: '#365a27', i: '#6fa356', y: '#6b4423', s: '#8b5a2b', d: '#6b4423', e: '#ffde3b', c: '#7a4a22', v: '#5a3416', w: '#8b5a2b', u: '#4f7f3a', a: '#4f7f3a', l: '#4f7f3a', b: '#3b2716', g: '#8b5a2b' });
  humanoidStrip('al_fireElemental', 'demon', 'robe', { y: '#ffde3b', s: '#ff7a2a', j: '#d63a1a', d: '#d63a1a', e: '#fff7b0', u: '#ff9a3a', c: '#ff7a2a', v: '#d63a1a', w: '#ffb84a', a: '#ffde3b', l: '#ffde3b', b: '#d63a1a', g: '#ff7a2a' });

  // dragon (boss)
  creatureStrip('en_dragon', 28, 22, 2, (ctx, f) => {
    const wy = f === 0 ? 0 : 3;
    const body = '#b8281c',
      dark = '#7a1810',
      belly = '#e9b949';
    poly(ctx, [10, 9, 1, 2 + wy, 3, 12, 8, 13], '#8a1c14');
    poly(ctx, [18, 9, 27, 2 + wy, 25, 12, 20, 13], '#8a1c14');
    line(ctx, 10, 9, 2, 3 + wy, dark);
    line(ctx, 18, 9, 26, 3 + wy, dark);
    poly(ctx, [14, 19, 20, 21, 26, 18, 22, 17], dark);
    ell(ctx, 14, 13, 6, 6, body);
    ell(ctx, 14, 14, 3.5, 4.5, belly);
    ell(ctx, 14, 5, 4, 3.5, body);
    poly(ctx, [11, 3, 9, 0, 12, 2], '#f5f0e0');
    poly(ctx, [17, 3, 19, 0, 16, 2], '#f5f0e0');
    rect(ctx, 12, 7, 5, 2, dark);
    px(ctx, 12, 4, '#ffde3b');
    px(ctx, 16, 4, '#ffde3b');
    rect(ctx, 9, 18, 3, 3, dark);
    rect(ctx, 16, 18, 3, 3, dark);
  });

  // allied animals
  const quad = (col: string, dark: string, eye: string, w = 16, big = false) => (ctx: CanvasRenderingContext2D, f: number) => {
    const o = f === 0 ? 0 : 1;
    const s = big ? 1.25 : 1;
    rect(ctx, 3 * s, 8 * s, 2, 4 - o, dark);
    rect(ctx, 6 * s, 8 * s, 2, 3 + o, dark);
    rect(ctx, 10 * s, 8 * s, 2, 4 - o, dark);
    rect(ctx, 12.5 * s, 8 * s, 2, 3 + o, dark);
    ell(ctx, 8 * s, 7 * s, 6 * s, 3 * s, col);
    ell(ctx, 13.5 * s, 4.5 * s, 2.6 * s, 2.3 * s, col);
    poly(ctx, [12 * s, 3 * s, 12.5 * s, 0.5, 13.5 * s, 2.5 * s], col);
    poly(ctx, [14.5 * s, 2.5 * s, 15 * s, 0.5, 15.5 * s, 3 * s], col);
    rect(ctx, 15 * s, 5 * s, 1.5, 1.5, dark);
    line(ctx, 2, Math.round(6 * s), 0, Math.round(4 * s) - o, col);
    px(ctx, Math.round(14 * s), Math.round(4 * s), eye);
    void w;
  };
  creatureStrip('al_wolf', 17, 13, 2, quad('#9a9aa6', '#62626e', '#ffde3b'));
  creatureStrip('al_spiritWolf', 17, 13, 2, quad('#8fe0ff', '#3e9ac8', '#ffffff'));
  creatureStrip('al_tiger', 17, 13, 2, quad('#ff9f1c', '#8a4a08', '#3bff7a'));
  creatureStrip('al_bear', 22, 16, 2, quad('#7a4a22', '#4a2c12', '#ffde3b', 22, true));
  creatureStrip('al_hawk', 14, 10, 2, (ctx, f) => {
    const wy = f === 0 ? 1 : 6;
    poly(ctx, [7, 5, 0, wy, 4, 7], '#8a5a2b');
    poly(ctx, [7, 5, 14, wy, 10, 7], '#8a5a2b');
    ell(ctx, 7, 5.5, 2.5, 2, '#a87a4a');
    ell(ctx, 7, 3, 1.6, 1.6, '#f5f0e0');
    px(ctx, 7, 4, '#ffb33b');
  });
  creatureStrip('al_shadow', 16, 20, 1, (ctx) => {
    ell(ctx, 8, 5, 4, 4, '#1a1020');
    rect(ctx, 4, 8, 8, 9, '#1a1020');
    rect(ctx, 5, 17, 2, 3, '#1a1020');
    rect(ctx, 9, 17, 2, 3, '#1a1020');
    px(ctx, 6, 5, '#c77dff');
    px(ctx, 9, 5, '#c77dff');
  });
  // ---- monsters of the deeper biomes
  creatureStrip('en_mushroom', 16, 17, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    rect(ctx, 5, 14, 2, 3 - b, '#b8a888');
    rect(ctx, 9, 14, 2, 2 + b, '#b8a888');
    ell(ctx, 8, 11, 3.6, 4, '#e8dcc0');
    ell(ctx, 7, 10, 1.6, 2.4, '#f6eedc');
    px(ctx, 6, 10, '#1a1420');
    px(ctx, 10, 10, '#1a1420');
    rect(ctx, 7, 12, 3, 1, '#7a5a4a');
    ell(ctx, 8, 6 + b * 0.5, 7.5, 4.2, '#3a7a6e');
    ell(ctx, 8, 5 + b * 0.5, 6.5, 3.2, '#4a8f82');
    rect(ctx, 2, 8 + b, 12, 1, '#d8c8a8');
    px(ctx, 5, 4 + b, '#4ff0d0');
    px(ctx, 10, 5 + b, '#4ff0d0');
    px(ctx, 8, 3 + b, '#b0fff0');
    px(ctx, 12, 6 + b, '#4ff0d0');
  });
  humanoidStrip('en_troll', 'orc', 'armor', { s: '#7a8a8f', j: '#56656a', d: '#5f6e73', e: '#ffde3b', y: '#f5f0e0', u: '#5a4a3a', c: '#6b5a44', v: '#4a3e2e', w: '#8a765a', a: '#8a8a7a', l: '#3b2a1a', p: '#5a4a32', q: '#3e3222', b: '#2a2018', g: '#7a8a8f' });
  creatureStrip('en_iceGolem', 19, 19, 2, (ctx, f) => {
    golem('#a8d8f0', '#7ab0d0', '#e0f4ff', '#3bd0ff')(ctx, f);
    poly(ctx, [6, 1, 7, -2, 8, 1], '#e0f4ff');
    poly(ctx, [11, 1, 12, -3, 13, 1], '#e0f4ff');
    line(ctx, 5, 7, 7, 12, '#e8f8ff');
  });
  creatureStrip('en_frostWolf', 17, 13, 2, (ctx, f) => {
    quad('#e8f4ff', '#9ab8d0', '#3bd0ff')(ctx, f);
    px(ctx, 6, 4, '#ffffff');
    px(ctx, 9, 4, '#ffffff');
  });
  creatureStrip('en_hellhound', 17, 13, 2, (ctx, f) => {
    quad('#4a2a24', '#2a1410', '#ffb33b')(ctx, f);
    const o = f === 0 ? 0 : 1;
    for (let i = 0; i < 5; i++) px(ctx, 5 + i * 2, 3 - (i % 2) - o, i % 2 ? '#ffb33b' : '#ff6a1a');
    px(ctx, 1, 3 - o, '#ff6a1a');
  });
  creatureStrip('en_magmaGolem', 19, 19, 2, (ctx, f) => {
    golem('#4a3430', '#2e1e1a', '#6a4a42', '#ffde3b')(ctx, f);
    line(ctx, 6, 7, 9, 12, '#ff6a1a');
    line(ctx, 9, 12, 12, 9, '#ff6a1a');
    line(ctx, 8, 2, 10, 4, '#ff9a3a');
    px(ctx, 9, 12, '#ffd060');
  });
  creatureStrip('en_voidEye', 16, 16, 2, (ctx, f) => {
    const o = f === 0 ? 0 : 1;
    for (let i = 0; i < 3; i++) {
      const x = 5 + i * 3;
      line(ctx, x, 11, x + (i - 1) - o, 15, '#5a2a8a');
      px(ctx, x + (i - 1) - o, 15, '#8a4aff');
    }
    ell(ctx, 8, 7, 5.8, 5.8, '#2a1a3a');
    ell(ctx, 8, 7, 5, 5, '#e8dcf0');
    line(ctx, 4, 5, 6, 6, '#c86a8a');
    line(ctx, 12, 9, 10, 8, '#c86a8a');
    ell(ctx, 8 + o * 0.5, 7, 2.8, 2.8, '#8a3aff');
    ell(ctx, 8 + o * 0.5, 7, 1.3, 1.6, '#12081c');
    px(ctx, 7, 6, '#f6e6ff');
  });
  creatureStrip('en_shade', 16, 16, 2, ghost('#3a2a5a', '#1a1030', '#ff4dff'));

  // ---- story guardians (bigger, more detailed sprites)
  creatureStrip('en_morgrim', 30, 32, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    const rust = '#7a4a2a',
      rustD = '#5a3418',
      rustL = '#a86a3a',
      iron = '#4a4048';
    // legs and boots
    rect(ctx, 9, 23, 5, 7 - b, iron);
    rect(ctx, 16, 23, 5, 6 + b, iron);
    rect(ctx, 8, 29 - b, 7, 3, '#2a2228');
    rect(ctx, 15, 28 + b, 7, 3, '#2a2228');
    // chain skirt
    rect(ctx, 8, 21, 14, 3, '#6a6a76');
    for (let x = 8; x < 22; x += 2) px(ctx, x, 23, '#3a3a44');
    // breastplate
    rect(ctx, 7, 11 + b, 16, 11, rust);
    rect(ctx, 8, 12 + b, 14, 2, rustL);
    rect(ctx, 14, 12 + b, 2, 9, rustD);
    px(ctx, 9, 15 + b, '#d8c8a8');
    px(ctx, 20, 15 + b, '#d8c8a8');
    rect(ctx, 7, 20 + b, 16, 2, '#3a2a1e');
    // pauldrons and arms
    ell(ctx, 6, 12 + b, 4, 3, rustL);
    ell(ctx, 24, 12 + b, 4, 3, rustL);
    rect(ctx, 3, 13 + b, 4, 8, rustD);
    rect(ctx, 23, 13 + b, 4, 8, rustD);
    // chains on the wrists
    for (let i = 0; i < 4; i++) px(ctx, 2 + (i % 2), 21 + i + b, '#9a9aa6');
    // the great axe
    line(ctx, 26, 4 + b * 2, 26, 26, '#5a3a22');
    poly(ctx, [26, 4 + b * 2, 30, 1 + b * 2, 30, 13 + b * 2, 26, 10 + b * 2], '#9aa0a8');
    line(ctx, 30, 2 + b * 2, 30, 12 + b * 2, '#e0e4ea');
    // horned helm with a glowing slit
    poly(ctx, [9, 4 + b, 5, -1 + b, 8, 6 + b], '#d8c8a8');
    poly(ctx, [21, 4 + b, 25, -1 + b, 22, 6 + b], '#d8c8a8');
    ell(ctx, 15, 6 + b, 6, 6, rust);
    rect(ctx, 10, 6 + b, 11, 5, rust);
    rect(ctx, 11, 3 + b, 8, 1, rustL);
    rect(ctx, 11, 7 + b, 9, 2, '#0a0606');
    rect(ctx, 14, 7 + b, 2, 4, '#0a0606');
    px(ctx, 12, 7 + b, '#ff8a2a');
    px(ctx, 18, 7 + b, '#ff8a2a');
  });
  creatureStrip('en_sporeMother', 34, 30, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    // root legs
    for (const [x, d] of [[9, -3], [13, -1], [21, 1], [25, 3]]) line(ctx, x, 22, x + d + (b ? 1 : 0), 29, '#8a7a5a');
    // bulbous body with a face
    ell(ctx, 17, 20, 9, 7, '#e0d4b8');
    ell(ctx, 15, 19, 5, 4, '#f0e6cc');
    ell(ctx, 13, 19, 1.6, 2, '#12201a');
    ell(ctx, 21, 19, 1.6, 2, '#12201a');
    px(ctx, 13, 19, '#b0fff0');
    px(ctx, 21, 19, '#b0fff0');
    rect(ctx, 15, 23, 5, 1, '#5a4a3a');
    // the great cap
    ell(ctx, 17, 10 + b * 0.5, 16, 8.5, '#3a7a6e');
    ell(ctx, 17, 8.5 + b * 0.5, 14, 6.5, '#4a8f82');
    rect(ctx, 2, 13 + b, 30, 2, '#d8c8a8');
    for (let x = 3; x < 31; x += 2) px(ctx, x, 14 + b, '#a8987a');
    for (const [x, y, r] of [[8, 8, 1.8], [17, 4, 2.2], [26, 8, 1.8], [12, 11, 1.2], [22, 11, 1.2]]) {
      ell(ctx, x, y + b * 0.5, r, r * 0.8, '#4ff0d0');
      px(ctx, Math.round(x - 0.5), Math.round(y - 0.5 + b * 0.5), '#d8fff6');
    }
    // little mushrooms sprouting from the cap
    for (const [x, y] of [[4, 9], [30, 9]]) {
      rect(ctx, x, y + b, 1, 2, '#d8d2c2');
      rect(ctx, x - 1, y - 1 + b, 3, 1, '#2a9a88');
    }
  });
  creatureStrip('en_isolda', 22, 34, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    // long dress
    poly(ctx, [7, 14, 15, 14, 19, 32, 3, 32], '#6aa8d8');
    poly(ctx, [9, 14, 12, 14, 12, 32, 7, 32], '#8ac2e6');
    rect(ctx, 3, 31, 16, 2, '#e8f8ff');
    for (let x = 4; x < 19; x += 3) px(ctx, x + b, 30, '#cfeefe');
    rect(ctx, 7, 14, 8, 2, '#e8f8ff');
    // ice staff
    line(ctx, 19, 6, 19, 31, '#cfeefe');
    poly(ctx, [19, 1 - b, 21, 5, 19, 8, 17, 5], '#6fc8ff');
    px(ctx, 19, 4, '#ffffff');
    rect(ctx, 16, 15, 3, 2, '#d4ecf8');
    // flowing white hair, pale face and neck, ice crown
    poly(ctx, [5, 7, 11, 2, 17, 7, 17, 18 + b, 14, 12, 8, 12, 5, 18 - b], '#eef8ff');
    rect(ctx, 9, 10, 5, 5, '#c4e0f2');
    rect(ctx, 8, 13, 7, 1, '#e8f8ff');
    ell(ctx, 11, 8, 3.5, 4, '#d4ecf8');
    px(ctx, 10, 8, '#3a8ad8');
    px(ctx, 12, 8, '#3a8ad8');
    px(ctx, 10, 10, '#bfe6fb');
    for (const [x, h] of [[8, 3], [11, 5], [14, 3]]) poly(ctx, [x - 1, 4, x, 4 - h, x + 1, 4], '#a8e0ff');
  });
  const elara = (wings: boolean) => (ctx: CanvasRenderingContext2D, f: number) => {
    const b = f === 0 ? 0 : 1;
    const ox = wings ? 6 : 0;
    if (wings) {
      // great wings of shadow
      poly(ctx, [ox + 6, 10, 0, 2 + b * 2, 1, 14, 3, 12, 2, 20, 5, 17, ox + 6, 18], '#1a0c26');
      poly(ctx, [ox + 12, 10, 30, 2 + b * 2, 29, 14, 27, 12, 28, 20, 25, 17, ox + 12, 18], '#1a0c26');
      line(ctx, ox + 6, 10, 1, 3 + b * 2, '#8a3aff');
      line(ctx, ox + 12, 10, 29, 3 + b * 2, '#8a3aff');
    }
    // robe
    poly(ctx, [ox + 5, 12, ox + 13, 12, ox + 16, 27, ox + 2, 27], '#24122e');
    line(ctx, ox + 9, 13, ox + 9, 27, '#8a3aff');
    rect(ctx, ox + 2, 26, 14, 1, '#8a3aff');
    // dark orb in her hand
    ell(ctx, ox + 15, 15 - b, 2.2, 2.2, '#c77dff');
    px(ctx, ox + 15, 14 - b, '#f6e6ff');
    // hair and face
    poly(ctx, [ox + 4, 6, ox + 9, 1, ox + 14, 6, ox + 14, 16 + b, ox + 12, 10, ox + 6, 10, ox + 4, 16 - b], '#3a2a4a');
    ell(ctx, ox + 9, 7, 3.2, 3.8, '#d8c4d4');
    px(ctx, ox + 8, 7, '#e080ff');
    px(ctx, ox + 10, 7, '#e080ff');
    rect(ctx, ox + 6, 3, 7, 1, '#5a3a6a');
    px(ctx, ox + 9, 3, '#c77dff');
  };
  creatureStrip('en_elaraDark', 18, 28, 2, elara(false));
  creatureStrip('en_elaraWings', 30, 28, 2, elara(true));
  creatureStrip('en_nyxShadow', 24, 32, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    // smoky lower body
    for (const [x, d] of [[7, -2], [10, 0], [14, 1], [17, 3]]) line(ctx, x, 20, x + d + b, 31, '#2a1438');
    poly(ctx, [5, 12, 19, 12, 17, 24, 7, 24], '#14081e');
    // shoulders, long arms with claws
    ell(ctx, 6, 12, 3.5, 2.5, '#1e0e2a');
    ell(ctx, 18, 12, 3.5, 2.5, '#1e0e2a');
    poly(ctx, [3, 13, 5, 13, 3, 24 - b, 1, 24 - b], '#14081e');
    poly(ctx, [19, 13, 21, 13, 23, 24 + b, 21, 24 + b], '#14081e');
    for (const x of [0, 2]) line(ctx, x + 1, 24 - b, x, 27 - b, '#c77dff');
    for (const x of [21, 23]) line(ctx, x, 24 + b, x + 1, 27 + b, '#c77dff');
    // horned head with burning eyes
    poly(ctx, [8, 5, 4, 0, 9, 3], '#24142e');
    poly(ctx, [16, 5, 20, 0, 15, 3], '#24142e');
    ell(ctx, 12, 7, 4.5, 5, '#14081e');
    px(ctx, 10, 7, '#ff4dff');
    px(ctx, 14, 7, '#ff4dff');
    line(ctx, 5, 13, 19, 13, '#5a2a8a');
  });
  creatureStrip('en_nyxTrue', 36, 32, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    // tentacles all around
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + b * 0.15;
      const x1 = 18 + Math.cos(a) * 17,
        y1 = 16 + Math.sin(a) * 15;
      line(ctx, 18, 16, Math.round(x1), Math.round(y1), '#3a1448');
      line(ctx, 18, 17, Math.round(x1), Math.round(y1) + 1, '#2a0e36');
      px(ctx, Math.round(x1), Math.round(y1), '#8a3aff');
    }
    // flesh around the eye and smaller eyes
    ell(ctx, 18, 16, 12, 10, '#2a0a2a');
    for (const [x, y] of [[8, 8], [28, 9], [9, 24], [27, 24]]) {
      ell(ctx, x, y, 2, 1.6, '#e8dcf0');
      px(ctx, x, y, '#8a3aff');
    }
    // the great eye
    ell(ctx, 18, 16, 9.5, 7.5, '#e8dcf0');
    line(ctx, 10, 13, 13, 15, '#c86a8a');
    line(ctx, 26, 19, 23, 17, '#c86a8a');
    ell(ctx, 18 + b * 0.6, 16, 5, 5, '#c77dff');
    ell(ctx, 18 + b * 0.6, 16, 3, 3, '#8a3aff');
    rect(ctx, 18 + b, 11, 1, 10, '#05020a');
    px(ctx, 16, 14, '#ffffff');
  });

  // totems
  for (const [k, col] of [
    ['heal', '#52ff8f'],
    ['storm', '#ffe45c'],
    ['fire', '#ff7a2a'],
    ['ice', '#6fd3ff'],
  ] as const) {
    creatureStrip('totem_' + k, 12, 22, 2, (ctx, f) => {
      rect(ctx, 3, 4, 6, 18, '#6b4423');
      rect(ctx, 3, 4, 2, 18, '#8a5a2b');
      rect(ctx, 1, 7, 10, 3, '#5a3416');
      rect(ctx, 2, 0, 8, 5, '#8a5a2b');
      px(ctx, 4, 2, f ? col : '#fff');
      px(ctx, 7, 2, f ? col : '#fff');
      rect(ctx, 4, 12, 4, 2, col);
      rect(ctx, 4, 16, 4, 1, col);
    });
  }
}

// ---------------------------------------------------------------------------
// WEAPONS (held, vertical, handle at bottom) and ICONS
// ---------------------------------------------------------------------------
const STEEL = '#cfd6dc',
  STEEL_D = '#8a939c',
  STEEL_H = '#ffffff',
  GOLD = '#e9b949',
  GOLD_D = '#a8802a',
  WOOD = '#8a5a2b',
  WOOD_D = '#5a3416';

type Drawer = (ctx: CanvasRenderingContext2D) => void;

const WEAPON_DRAW: Record<string, [number, number, Drawer]> = {
  sword: [
    7,
    16,
    (c) => {
      rect(c, 2, 1, 3, 10, STEEL);
      rect(c, 3, 1, 1, 10, STEEL_H);
      rect(c, 4, 2, 1, 9, STEEL_D);
      px(c, 3, 0, STEEL);
      rect(c, 0, 11, 7, 1, GOLD);
      rect(c, 1, 12, 5, 1, GOLD_D);
      rect(c, 3, 12, 1, 3, WOOD);
      px(c, 3, 15, GOLD);
    },
  ],
  greatsword: [
    9,
    22,
    (c) => {
      rect(c, 3, 1, 3, 14, STEEL);
      rect(c, 4, 1, 1, 14, STEEL_H);
      rect(c, 5, 2, 1, 13, STEEL_D);
      px(c, 4, 0, STEEL);
      rect(c, 0, 15, 9, 2, GOLD);
      rect(c, 1, 16, 7, 1, GOLD_D);
      rect(c, 4, 17, 1, 4, WOOD);
      rect(c, 3, 21, 3, 1, GOLD);
    },
  ],
  dagger: [
    5,
    10,
    (c) => {
      rect(c, 1, 1, 3, 5, STEEL);
      rect(c, 2, 0, 1, 6, STEEL_H);
      rect(c, 0, 6, 5, 1, GOLD);
      rect(c, 2, 7, 1, 2, '#3b2a20');
      px(c, 2, 9, GOLD);
    },
  ],
  knuckle: [
    6,
    6,
    (c) => {
      rect(c, 0, 0, 6, 3, STEEL);
      rect(c, 0, 0, 6, 1, STEEL_H);
      px(c, 0, 3, STEEL_D);
      px(c, 5, 3, STEEL_D);
      rect(c, 1, 3, 4, 2, '#5a3416');
    },
  ],
  axe: [
    9,
    15,
    (c) => {
      rect(c, 4, 1, 1, 14, WOOD);
      px(c, 4, 14, WOOD_D);
      poly(c, [5, 1, 9, 0, 9, 7, 5, 5], STEEL);
      rect(c, 8, 0, 1, 7, STEEL_H);
      rect(c, 5, 2, 1, 3, STEEL_D);
    },
  ],
  greataxe: [
    13,
    22,
    (c) => {
      rect(c, 6, 0, 1, 22, WOOD);
      poly(c, [7, 2, 13, 0, 13, 10, 7, 8], STEEL);
      poly(c, [6, 2, 0, 0, 0, 10, 6, 8], STEEL);
      rect(c, 12, 0, 1, 10, STEEL_H);
      rect(c, 0, 0, 1, 10, STEEL_D);
    },
  ],
  mace: [
    7,
    14,
    (c) => {
      rect(c, 3, 5, 1, 9, WOOD);
      rect(c, 1, 1, 5, 5, STEEL_D);
      rect(c, 2, 1, 3, 4, STEEL);
      px(c, 3, 0, STEEL);
      px(c, 0, 3, STEEL);
      px(c, 6, 3, STEEL);
      px(c, 2, 2, STEEL_H);
    },
  ],
  hammer: [
    11,
    19,
    (c) => {
      rect(c, 5, 5, 1, 14, WOOD);
      rect(c, 0, 0, 11, 6, STEEL_D);
      rect(c, 1, 1, 9, 4, STEEL);
      rect(c, 1, 1, 9, 1, STEEL_H);
      rect(c, 4, 0, 3, 6, GOLD);
    },
  ],
  spear: [
    5,
    26,
    (c) => {
      rect(c, 2, 5, 1, 21, WOOD);
      poly(c, [2.5, 0, 5, 5, 2.5, 7, 0, 5], STEEL);
      px(c, 2, 1, STEEL_H);
      rect(c, 1, 7, 3, 1, GOLD);
    },
  ],
  bow: [
    8,
    18,
    (c) => {
      c.strokeStyle = WOOD;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(-4, 9, 11, -0.95, 0.95);
      c.stroke();
      line(c, 2, 1, 2, 17, '#e8e2cf');
      rect(c, 5, 8, 2, 3, '#3b2a20');
    },
  ],
  crossbow: [
    13,
    13,
    (c) => {
      rect(c, 5, 2, 3, 11, WOOD);
      rect(c, 6, 2, 1, 11, '#a87a4a');
      c.strokeStyle = STEEL_D;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(6.5, 9, 6, -2.6, -0.5);
      c.stroke();
      line(c, 1, 6, 12, 6, '#e8e2cf');
      rect(c, 6, 0, 1, 3, STEEL);
    },
  ],
  staff: [
    7,
    22,
    (c) => {
      rect(c, 3, 5, 1, 17, WOOD);
      rect(c, 2, 5, 1, 2, WOOD_D);
      rect(c, 4, 5, 1, 2, WOOD_D);
      circle(c, 3, 3, 2, '#8a5cff');
      px(c, 2, 2, '#e3d4ff');
      px(c, 3, 0, '#c9b3ff');
    },
  ],
  wand: [
    5,
    11,
    (c) => {
      rect(c, 2, 3, 1, 8, '#3a2618');
      rect(c, 1, 3, 3, 1, GOLD);
      rect(c, 1, 0, 3, 3, '#3bdc8a');
      px(c, 1, 0, '#c8ffe0');
    },
  ],
  shield: [
    11,
    13,
    (c) => {
      poly(c, [0, 0, 11, 0, 11, 7, 5.5, 13, 0, 7], STEEL_D);
      poly(c, [1, 1, 10, 1, 10, 7, 5.5, 12, 1, 7], '#2f5fa8');
      rect(c, 5, 2, 1, 8, GOLD);
      rect(c, 3, 4, 5, 1, GOLD);
      rect(c, 1, 1, 9, 1, '#4f80cf');
    },
  ],
  orb: [
    8,
    8,
    (c) => {
      circle(c, 4, 4, 3, '#5a2c9a');
      circle(c, 4, 4, 2, '#9a5cff');
      px(c, 3, 2, '#ffffff');
      px(c, 2, 3, '#e3d4ff');
    },
  ],
};

/** a stairwell seen from above: a stone rim, steps narrowing into the depth (down) or rising to the light (up) */
function stairwell(up: boolean): HTMLCanvasElement {
  const [c, x] = canvas(32, 32);
  // stone rim with joints
  rect(x, 0, 0, 32, 32, '#4c4a58');
  rect(x, 0, 0, 32, 1, '#6e6c7c');
  rect(x, 0, 31, 32, 1, '#2a2832');
  for (const [jx, jy, w, h] of [
    [9, 0, 1, 2],
    [22, 0, 1, 2],
    [0, 11, 2, 1],
    [30, 19, 2, 1],
    [13, 30, 1, 2],
    [25, 30, 1, 2],
  ])
    rect(x, jx, jy, w, h, '#34323e');
  // the well
  rect(x, 2, 2, 28, 28, '#0d0b10');
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const y = 3 + i * 4;
    // how far from the light: down = deeper with every step, up = the top step is nearest the floor above
    const t = up ? ((steps - 1 - i) / (steps - 1)) * 0.15 + (i / (steps - 1)) * 0.55 : i / (steps - 1);
    const inset = up ? 3 : 3 + i;
    const w = 32 - inset * 2;
    const k = -t * (up ? 1 : 0.8);
    // side walls of the well beside the step
    rect(x, 2, y, inset - 2, 4, shade('#24222c', k));
    rect(x, 32 - inset, y, inset - 2, 4, shade('#1a1820', k));
    rect(x, inset, y, w, 1, shade('#c4c2ce', k));
    rect(x, inset, y + 1, w, 2, shade('#8e8c9a', k));
    rect(x, inset, y + 3, w, 1, shade('#4e4c5a', k));
    // worn middle of the steps
    rect(x, 13, y + 1, 6, 1, shade('#a2a0ae', k));
  }
  if (up) {
    // daylight falling in at the top
    rect(x, 3, 2, 26, 1, '#fff0c0');
    rect(x, 5, 3, 22, 1, 'rgba(255,232,170,0.55)');
    rect(x, 8, 4, 16, 1, 'rgba(255,232,170,0.25)');
  } else {
    // the dark below
    rect(x, 9, 27, 14, 3, '#050407');
    rect(x, 10, 26, 12, 1, 'rgba(0,0,0,0.6)');
  }
  return c;
}

function buildWeapons() {
  for (const [k, [w, h, d]] of Object.entries(WEAPON_DRAW)) {
    const [c, ctx] = canvas(w, h);
    d(ctx);
    crisp(c);
    outline(c, OUT);
    // add 1px padding by re-drawing on bigger canvas (outline may be clipped)
    const [c2, ctx2] = canvas(w + 2, h + 2);
    ctx2.drawImage(c, 1, 1);
    outline(c2, OUT);
    addCanvas('wp_' + k, c2);
  }
}

// 24x24 item icons
function iconCanvas(draw: Drawer, doOutline = true) {
  const [c, ctx] = canvas(24, 24);
  draw(ctx);
  crisp(c);
  if (doOutline) outline(c, OUT);
  return c;
}

function buildIcons() {
  // weapons as icons: centred & rotated 45° for long ones
  const mk = (key: string, wkey: string, rot = true) => {
    const src = canvases.get('wp_' + wkey)!;
    const [c, ctx] = canvas(24, 24);
    ctx.save();
    ctx.translate(12, 12);
    if (rot && src.height > 14) ctx.rotate(Math.PI / 4);
    ctx.drawImage(src, -Math.floor(src.width / 2), -Math.floor(src.height / 2));
    ctx.restore();
    crisp(c, 100);
    addCanvas(key, c);
  };
  mk('ic_sword', 'sword');
  mk('ic_greatsword', 'greatsword');
  mk('ic_dagger', 'dagger', false);
  mk('ic_knuckle', 'knuckle', false);
  mk('ic_axe', 'axe');
  mk('ic_greataxe', 'greataxe');
  mk('ic_mace', 'mace');
  mk('ic_hammer', 'hammer');
  mk('ic_spear', 'spear');
  mk('ic_bow', 'bow');
  mk('ic_crossbow', 'crossbow', false);
  mk('ic_staff', 'staff');
  mk('ic_wand', 'wand', false);
  mk('ic_shield', 'shield', false);
  mk('ic_orb', 'orb', false);

  addCanvas(
    'ic_helmet',
    iconCanvas((c) => {
      poly(c, [5, 13, 6, 6, 12, 3, 18, 6, 19, 13, 19, 19, 15, 19, 15, 14, 9, 14, 9, 19, 5, 19], STEEL_D);
      poly(c, [6, 12, 7, 7, 12, 4, 17, 7, 18, 12], STEEL);
      rect(c, 11, 4, 2, 11, GOLD);
      rect(c, 8, 7, 3, 1, STEEL_H);
      rect(c, 9, 15, 6, 1, '#222');
    }),
  );
  addCanvas(
    'ic_chest',
    iconCanvas((c) => {
      poly(c, [3, 6, 8, 3, 16, 3, 21, 6, 19, 11, 18, 21, 6, 21, 5, 11], STEEL_D);
      poly(c, [5, 7, 9, 5, 15, 5, 19, 7, 17, 11, 16, 20, 8, 20, 7, 11], STEEL);
      rect(c, 11, 5, 2, 15, GOLD);
      rect(c, 7, 13, 10, 1, STEEL_D);
      rect(c, 9, 6, 2, 2, STEEL_H);
    }),
  );
  addCanvas(
    'ic_pants',
    iconCanvas((c) => {
      poly(c, [6, 4, 18, 4, 19, 21, 14, 21, 12, 10, 10, 21, 5, 21], '#5a4a3a');
      poly(c, [7, 5, 17, 5, 17, 20, 15, 20, 12, 9, 9, 20, 7, 20], '#7a6a52');
      rect(c, 6, 4, 12, 2, '#3b2a20');
      rect(c, 11, 4, 2, 2, GOLD);
    }),
  );
  addCanvas(
    'ic_belt',
    iconCanvas((c) => {
      rect(c, 2, 9, 20, 6, '#6b4423');
      rect(c, 2, 9, 20, 1, '#8a5a2b');
      rect(c, 9, 8, 6, 8, GOLD);
      rect(c, 10, 9, 4, 6, '#6b4423');
      rect(c, 11, 11, 3, 1, GOLD_D);
      px(c, 5, 12, '#3b2a20');
      px(c, 18, 12, '#3b2a20');
    }),
  );
  addCanvas(
    'ic_boots',
    iconCanvas((c) => {
      poly(c, [4, 4, 10, 4, 10, 16, 13, 18, 13, 21, 3, 21, 4, 16], '#6b4423');
      poly(c, [13, 4, 19, 4, 19, 16, 22, 18, 22, 21, 12, 21, 13, 16], '#5a3416');
      rect(c, 4, 4, 6, 2, '#a87a4a');
      rect(c, 13, 4, 6, 2, '#8a5a2b');
      rect(c, 3, 20, 10, 1, '#2a1a10');
      rect(c, 12, 20, 10, 1, '#2a1a10');
    }),
  );
  addCanvas(
    'ic_ring',
    iconCanvas((c) => {
      c.strokeStyle = GOLD;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(12, 14, 5.5, 0, Math.PI * 2);
      c.stroke();
      poly(c, [9, 7, 12, 3, 15, 7, 12, 10], '#d1342f');
      px(c, 11, 5, '#ffb0b0');
    }),
  );
  addCanvas(
    'ic_amulet',
    iconCanvas((c) => {
      c.strokeStyle = GOLD_D;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(12, 8, 7, 0.2, Math.PI - 0.2);
      c.stroke();
      c.beginPath();
      c.moveTo(5, 8);
      c.lineTo(12, 15);
      c.lineTo(19, 8);
      c.stroke();
      circle(c, 12, 16, 4, GOLD);
      circle(c, 12, 16, 2, '#3bb0ff');
      px(c, 11, 15, '#d0f0ff');
    }),
  );
  addCanvas(
    'ic_bracer',
    iconCanvas((c) => {
      poly(c, [6, 6, 18, 5, 19, 19, 5, 18], '#8a5a2b');
      poly(c, [7, 7, 17, 6, 18, 18, 6, 17], '#a87a4a');
      rect(c, 6, 9, 13, 2, GOLD);
      rect(c, 6, 14, 13, 2, GOLD);
      px(c, 12, 12, '#3bdc8a');
    }),
  );
  const potion = (col: string, hi: string) => (c: CanvasRenderingContext2D) => {
    rect(c, 10, 3, 4, 2, '#8a5a2b');
    rect(c, 10, 5, 4, 4, '#cfe8ff');
    circle(c, 12, 15, 6, '#cfe8ff');
    circle(c, 12, 15, 5, col);
    rect(c, 7, 13, 10, 1, shade(col, 0.2));
    px(c, 9, 12, hi);
    px(c, 9, 13, hi);
    px(c, 10, 12, hi);
  };
  addCanvas('ic_hpPotion', iconCanvas(potion('#e0242c', '#ffb0b0')));
  addCanvas('ic_mpPotion', iconCanvas(potion('#2c6be0', '#b0d0ff')));
  addCanvas(
    'ic_lockpick',
    iconCanvas((c) => {
      line(c, 5, 19, 16, 8, STEEL);
      line(c, 6, 19, 17, 8, STEEL_D);
      line(c, 16, 8, 19, 8, STEEL);
      line(c, 19, 8, 19, 6, STEEL);
      circle(c, 6, 18, 3, GOLD);
      circle(c, 6, 18, 1, '#5a3416');
    }),
  );
  addCanvas(
    'ic_stone',
    iconCanvas((c) => {
      poly(c, [12, 3, 20, 9, 17, 20, 7, 20, 4, 9], '#3a8fd0');
      poly(c, [12, 3, 20, 9, 12, 11, 4, 9], '#7cc8ff');
      poly(c, [12, 11, 17, 20, 7, 20], '#2a6fa8');
      px(c, 10, 6, '#ffffff');
      px(c, 9, 7, '#d0f0ff');
    }),
  );
  addCanvas(
    'ic_dust',
    iconCanvas((c) => {
      ell(c, 12, 17, 8, 4, '#7a3fc0');
      ell(c, 12, 15, 6, 4, '#a96bf0');
      ell(c, 11, 13, 3, 2, '#d8b8ff');
      px(c, 6, 6, '#e8d8ff');
      px(c, 17, 5, '#e8d8ff');
      px(c, 14, 8, '#ffffff');
      px(c, 8, 9, '#c8a8ff');
    }),
  );
  addCanvas(
    'ic_gold',
    iconCanvas((c) => {
      for (const [x, y] of [
        [7, 15],
        [15, 16],
        [11, 11],
        [11, 17],
      ]) {
        ell(c, x, y, 4.5, 3, GOLD_D);
        ell(c, x, y - 1, 4.5, 3, GOLD);
        px(c, x - 2, y - 2, '#fff2b0');
      }
    }),
  );
  addCanvas(
    'ic_scroll',
    iconCanvas((c) => {
      rect(c, 5, 5, 14, 14, '#e8d8b0');
      rect(c, 4, 4, 16, 2, '#c8b080');
      rect(c, 4, 18, 16, 2, '#c8b080');
      for (let i = 0; i < 4; i++) rect(c, 7, 8 + i * 2, 10 - (i % 2) * 3, 1, '#8a7050');
    }),
  );
}

// ---------------------------------------------------------------------------
// OBJECTS / DECO
// ---------------------------------------------------------------------------
function buildObjects() {
  // torch (wall mounted) 3 frames 10x14
  creatureStrip(
    'torch',
    10,
    16,
    3,
    (ctx, f) => {
      rect(ctx, 4, 8, 2, 6, '#5a3416');
      rect(ctx, 3, 7, 4, 2, '#7a7a86');
      rect(ctx, 3, 13, 4, 1, '#7a7a86');
      const fl = [
        [5, 4, 2.5, 3.5],
        [4.6, 3.6, 2.2, 4],
        [5.3, 4.2, 2.6, 3.2],
      ][f];
      ell(ctx, fl[0], fl[1], fl[2], fl[3], '#ff7a1a');
      ell(ctx, fl[0], fl[1] + 1, fl[2] * 0.6, fl[3] * 0.6, '#ffd23a');
      ell(ctx, fl[0], fl[1] + 1.5, 0.8, 1.2, '#fff7d0');
    },
    false,
  );
  // wall lights of the other biomes (same size and frame count as the torch)
  creatureStrip(
    'torch_cave',
    10,
    16,
    3,
    (ctx, f) => {
      const hi = ['#b0fff0', '#e0fffa', '#8ff5e0'][f];
      rect(ctx, 2, 11, 6, 3, '#4a443e');
      rect(ctx, 2, 11, 6, 1, '#6e665d');
      poly(ctx, [2, 12, 3, 5, 5, 12], '#2a9a88');
      poly(ctx, [4, 12, 5.5, 2, 7, 12], '#4ff0d0');
      poly(ctx, [6, 12, 7.5, 6, 9, 12], '#2a9a88');
      line(ctx, 5, 4, 5, 10, hi);
      px(ctx, 3, 7, hi);
      px(ctx, 7, 8, f === 1 ? '#ffffff' : hi);
    },
    false,
  );
  creatureStrip(
    'torch_ice',
    10,
    16,
    3,
    (ctx, f) => {
      rect(ctx, 4, 8, 2, 6, '#3e4a5a');
      rect(ctx, 3, 7, 4, 2, '#9ab8d0');
      rect(ctx, 3, 13, 4, 1, '#9ab8d0');
      const fl = [
        [5, 4, 2.5, 3.5],
        [4.6, 3.6, 2.2, 4],
        [5.3, 4.2, 2.6, 3.2],
      ][f];
      ell(ctx, fl[0], fl[1], fl[2], fl[3], '#3aa8ff');
      ell(ctx, fl[0], fl[1] + 1, fl[2] * 0.6, fl[3] * 0.6, '#8fdcff');
      ell(ctx, fl[0], fl[1] + 1.5, 0.8, 1.2, '#f0fbff');
    },
    false,
  );
  creatureStrip(
    'torch_lava',
    10,
    16,
    3,
    (ctx, f) => {
      // iron fire basket
      rect(ctx, 1, 9, 8, 4, '#3a3133');
      rect(ctx, 1, 9, 8, 1, '#5a4c4e');
      rect(ctx, 4, 13, 2, 3, '#2a2224');
      px(ctx, 3, 11, '#ff7a1a');
      px(ctx, 6, 11, '#ff7a1a');
      const fl = [
        [5, 5, 3.6, 4.4],
        [4.6, 4.4, 3.2, 5],
        [5.4, 5.2, 3.8, 4],
      ][f];
      ell(ctx, fl[0], fl[1], fl[2], fl[3], '#ff4a10');
      ell(ctx, fl[0], fl[1] + 1, fl[2] * 0.65, fl[3] * 0.65, '#ffa83a');
      ell(ctx, fl[0], fl[1] + 2, 1, 1.4, '#fff0a0');
    },
    false,
  );
  creatureStrip(
    'torch_abyss',
    10,
    16,
    3,
    (ctx, f) => {
      rect(ctx, 4, 8, 2, 6, '#241c30');
      rect(ctx, 3, 7, 4, 2, '#5a4a70');
      rect(ctx, 3, 13, 4, 1, '#5a4a70');
      const fl = [
        [5, 4, 2.5, 3.5],
        [4.6, 3.6, 2.2, 4],
        [5.3, 4.2, 2.6, 3.2],
      ][f];
      ell(ctx, fl[0], fl[1], fl[2], fl[3], '#8a3aff');
      ell(ctx, fl[0], fl[1] + 1, fl[2] * 0.6, fl[3] * 0.6, '#c77dff');
      ell(ctx, fl[0], fl[1] + 1.5, 0.8, 1.2, '#f6e6ff');
    },
    false,
  );
  // wall decorations of the other biomes (instead of banners and bookshelves)
  addCanvas(
    'deco_wall_cave',
    iconCanvasSized(12, 18, (c) => {
      for (const [x, len, col] of [
        [2, 12, '#4f6e33'],
        [5, 16, '#3d5a2a'],
        [8, 10, '#4f6e33'],
        [10, 14, '#6b4a2b'],
      ] as [number, number, string][]) {
        for (let y = 0; y < len; y++) px(c, x + (y % 5 === 4 ? 1 : 0), y, col);
        px(c, x + 1, len - 1, col);
      }
      px(c, 5, 8, '#4ff0d0');
      px(c, 9, 5, '#4ff0d0');
    }),
  );
  addCanvas(
    'deco_wall_ice',
    iconCanvasSized(14, 14, (c) => {
      rect(c, 0, 0, 14, 2, '#eef8ff');
      for (const [x, len] of [
        [1, 7],
        [4, 12],
        [7, 9],
        [10, 13],
        [12, 6],
      ]) {
        for (let y = 2; y < len; y++) rect(c, x, y, y < len * 0.55 ? 2 : 1, 1, y < 4 ? '#f6fcff' : '#a8d8f0');
      }
    }),
  );
  addCanvas(
    'deco_wall_lava',
    iconCanvasSized(10, 18, (c) => {
      for (const x of [2, 7]) {
        for (let y = 0; y < 16; y += 3) {
          rect(c, x - 1, y, 3, 2, '#5a4c4e');
          px(c, x, y + 2, '#3a3133');
        }
      }
      rect(c, 1, 15, 8, 2, '#3a3133');
      px(c, 4, 16, '#ff7a1a');
    }),
  );
  addCanvas(
    'deco_wall_abyss',
    iconCanvasSized(12, 16, (c) => {
      rect(c, 0, 0, 12, 16, '#241c30');
      rect(c, 1, 1, 10, 14, '#30273d');
      ell(c, 6, 7, 4, 2.6, '#c77dff');
      ell(c, 6, 7, 2.6, 1.8, '#1a0f28');
      ell(c, 6, 7, 1, 1.4, '#f0d0ff');
      line(c, 2, 12, 9, 12, '#8a4aff');
    }),
  );
  // floor decorations of the other biomes
  addCanvas(
    'deco_cave_a',
    iconCanvasSized(13, 10, (c) => {
      const caps: [number, number, number][] = [
        [3, 6, 2],
        [7, 4, 3],
        [10, 7, 2],
      ];
      for (const [x, y, w] of caps) {
        rect(c, x, y, 1, 9 - y, '#d8d2c2');
        rect(c, x - w, y, w * 2 + 1, 1, '#2a9a88');
        rect(c, x - w + 1, y - 1, w * 2 - 1, 1, '#4ff0d0');
        px(c, x, y - 1, '#c8fff4');
      }
    }),
  );
  addCanvas(
    'deco_cave_b',
    iconCanvasSized(10, 15, (c) => {
      poly(c, [0, 15, 4, 0, 9, 15], '#5d564e');
      poly(c, [2, 15, 4, 3, 5, 15], '#6e665d');
      poly(c, [6, 15, 8, 8, 10, 15], '#4b453f');
      px(c, 4, 1, '#7d756b');
    }),
  );
  addCanvas(
    'deco_ice_a',
    iconCanvasSized(12, 14, (c) => {
      poly(c, [1, 14, 3, 5, 5, 14], '#6fc8ff');
      poly(c, [4, 14, 6.5, 0, 9, 14], '#8fd8ff');
      poly(c, [8, 14, 10, 6, 12, 14], '#6fc8ff');
      line(c, 6, 2, 6, 12, '#e8f8ff');
      line(c, 3, 7, 3, 12, '#c8ecff');
    }),
  );
  addCanvas(
    'deco_ice_b',
    iconCanvasSized(14, 7, (c) => {
      ell(c, 7, 4.5, 7, 2.6, '#cfe6f3');
      ell(c, 6, 3.5, 5, 2, '#eef8ff');
      px(c, 4, 2, '#ffffff');
    }),
  );
  addCanvas(
    'deco_lava_a',
    iconCanvasSized(12, 9, (c) => {
      ell(c, 6, 5, 6, 4, '#2d2527');
      ell(c, 5, 4, 4, 2.6, '#3b3032');
      line(c, 2, 6, 5, 4, '#ff6a1a');
      line(c, 5, 4, 9, 6, '#ff6a1a');
      px(c, 5, 4, '#ffd060');
    }),
  );
  addCanvas(
    'deco_lava_b',
    iconCanvasSized(8, 11, (c) => {
      rect(c, 1, 2, 6, 9, '#3d3335');
      rect(c, 1, 2, 2, 9, '#4f4446');
      rect(c, 0, 0, 8, 3, '#2d2527');
      px(c, 3, 6, '#ff6a1a');
    }),
  );
  addCanvas(
    'deco_abyss_a',
    iconCanvasSized(10, 14, (c) => {
      poly(c, [0, 14, 2, 6, 4, 14], '#8a4aff');
      poly(c, [3, 14, 5, 0, 7, 14], '#c77dff');
      poly(c, [6, 14, 8, 5, 10, 14], '#8a4aff');
      line(c, 5, 2, 5, 11, '#f0d0ff');
    }),
  );
  addCanvas(
    'deco_abyss_b',
    iconCanvasSized(10, 16, (c) => {
      rect(c, 1, 4, 8, 12, '#30273d');
      rect(c, 1, 4, 2, 12, '#3d3250');
      poly(c, [1, 4, 4, 0, 6, 3, 9, 1, 9, 4], '#2a2136');
      line(c, 4, 7, 6, 7, '#c77dff');
      line(c, 5, 7, 5, 12, '#c77dff');
      px(c, 5, 9, '#f0d0ff');
    }),
  );
  // a page of Elara's diary lying on the floor
  addCanvas(
    'page',
    iconCanvasSized(11, 12, (c) => {
      poly(c, [1, 1, 9, 0, 10, 10, 2, 11], '#efe2c0');
      poly(c, [1, 1, 3, 1, 4, 11, 2, 11], '#d8c8a0');
      for (let i = 0; i < 4; i++) line(c, 4, 3 + i * 2, 8, 2 + i * 2, '#8a7050');
      px(c, 8, 9, '#b02a3a');
    }),
  );
  // banner 12x16
  for (const [name, col, dk] of [
    ['blue', '#2a4a8a', '#1a2f5a'],
    ['red', '#8a1c1c', '#5a1010'],
    ['green', '#2a6a3a', '#1a4a26'],
  ]) {
    const c = iconCanvasSized(12, 18, (c) => {
      rect(c, 0, 0, 12, 2, '#6b4423');
      poly(c, [1, 2, 11, 2, 11, 16, 6, 13, 1, 16], col);
      rect(c, 1, 2, 2, 13, dk);
      rect(c, 5, 4, 2, 8, '#e9b949');
      rect(c, 3, 6, 6, 2, '#e9b949');
    });
    addCanvas('banner_' + name, c);
  }
  // bookshelf 16x16 (on wall front)
  addCanvas(
    'bookshelf',
    iconCanvasSized(16, 18, (c) => {
      rect(c, 0, 0, 16, 18, '#5a3416');
      rect(c, 1, 1, 14, 16, '#3a2210');
      const cols = ['#8a1c1c', '#2a4a8a', '#2a6a3a', '#a8802a', '#5a2c7a', '#7a4a22'];
      for (let row = 0; row < 3; row++) {
        let x = 1;
        while (x < 15) {
          const w = 1 + Math.floor(hash(x, row, 3) * 2);
          const h = 3 + Math.floor(hash(row, x, 5) * 2);
          rect(c, x, 1 + row * 6 + (5 - h), w, h, cols[Math.floor(hash(x, row, 9) * cols.length)]);
          x += w;
        }
        rect(c, 0, 6 + row * 6, 16, 1, '#7a4a22');
      }
    }),
  );
  addCanvas(
    'crate',
    iconCanvasSized(14, 14, (c) => {
      rect(c, 0, 0, 14, 14, '#8a5a2b');
      rect(c, 1, 1, 12, 12, '#a87a4a');
      line(c, 1, 1, 12, 12, '#7a4a22');
      line(c, 1, 2, 11, 12, '#7a4a22');
      rect(c, 0, 0, 14, 2, '#6b4423');
      rect(c, 0, 12, 14, 2, '#6b4423');
    }),
  );
  addCanvas(
    'barrel',
    iconCanvasSized(12, 15, (c) => {
      ell(c, 6, 8, 6, 7, '#8a5a2b');
      rect(c, 1, 4, 10, 8, '#a8703a');
      rect(c, 0, 4, 12, 1, '#5a5a66');
      rect(c, 0, 11, 12, 1, '#5a5a66');
      ell(c, 6, 2.5, 5, 2, '#6b4423');
      rect(c, 3, 5, 1, 6, '#c8905a');
    }),
  );
  addCanvas(
    'pot',
    iconCanvasSized(10, 12, (c) => {
      ell(c, 5, 7, 4.5, 4.5, '#9a5a32');
      rect(c, 3, 1, 4, 3, '#9a5a32');
      rect(c, 2, 1, 6, 1, '#7a4222');
      ell(c, 3.5, 6, 1, 2, '#c87a4a');
    }),
  );
  addCanvas(
    'table',
    iconCanvasSized(18, 16, (c) => {
      rect(c, 0, 3, 18, 8, '#7a4a22');
      rect(c, 0, 3, 18, 2, '#9a6a3a');
      rect(c, 1, 11, 2, 5, '#5a3416');
      rect(c, 15, 11, 2, 5, '#5a3416');
      rect(c, 6, 5, 6, 4, '#e8d8b0');
      line(c, 7, 6, 10, 7, '#a8906a');
      rect(c, 14, 1, 2, 4, '#f0e8d0');
      px(c, 14, 0, '#ffd23a');
      rect(c, 2, 2, 2, 3, '#3a7a5a');
    }),
  );
  addCanvas(
    'chair',
    iconCanvasSized(9, 13, (c) => {
      rect(c, 0, 0, 2, 13, '#6b4423');
      rect(c, 0, 6, 9, 2, '#8a5a2b');
      rect(c, 7, 7, 2, 6, '#6b4423');
      rect(c, 0, 1, 2, 5, '#8a5a2b');
    }),
  );
  addCanvas(
    'bones',
    iconCanvasSized(12, 8, (c) => {
      line(c, 1, 6, 9, 2, '#d8d0bc');
      px(c, 0, 6, '#d8d0bc');
      px(c, 10, 1, '#d8d0bc');
      line(c, 3, 1, 9, 6, '#c8c0aa');
    }),
  );
  addCanvas(
    'skull',
    iconCanvasSized(8, 7, (c) => {
      ell(c, 4, 3, 3.5, 3, '#e0d8c4');
      rect(c, 2, 5, 4, 2, '#e0d8c4');
      px(c, 2, 3, '#1a1420');
      px(c, 5, 3, '#1a1420');
    }),
  );
  {
    const [c, ctx] = canvas(16, 16);
    ctx.strokeStyle = 'rgba(230,230,240,0.55)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, i * 3.5, 0, Math.PI / 2);
      ctx.stroke();
    }
    for (let a = 0; a <= 4; a++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos((a / 4) * (Math.PI / 2)) * 15, Math.sin((a / 4) * (Math.PI / 2)) * 15);
      ctx.stroke();
    }
    addCanvas('web', c);
  }
  {
    const [c, ctx] = canvas(16, 16);
    const mc = ['#3f5a24', '#4d6b2b', '#5d7f33'];
    for (let k = 0; k < 22; k++) px(ctx, Math.floor(hash(k, 1, 2) * 16), Math.floor(hash(1, k, 3) * 16), mc[k % 3]);
    addCanvas('moss', c);
  }
  {
    const [c, ctx] = canvas(16, 10);
    ell(ctx, 8, 5, 7, 3.5, 'rgba(40,60,90,0.6)');
    ell(ctx, 6, 4, 2, 1, 'rgba(160,200,255,0.35)');
    addCanvas('puddle', c);
  }
  {
    // wall crack overlay
    const [c, ctx] = canvas(16, 16);
    line(ctx, 3, 5, 6, 9, '#22212a');
    line(ctx, 6, 9, 5, 13, '#22212a');
    addCanvas('wallcrack', c);
  }
  // stairwells (drawn natively at 32x32): down into the dark, and the way back up with light from above
  addCanvas('stairs', stairwell(false), false);
  addCanvas('stairs_up', stairwell(true), false);
  // locked door 16x16 and open
  addCanvas(
    'door',
    iconCanvasSized(16, 16, (c) => {
      rect(c, 0, 0, 16, 16, '#3a3943');
      rect(c, 1, 1, 14, 15, '#6b4423');
      for (let i = 0; i < 4; i++) rect(c, 1 + i * 4, 1, 1, 15, '#4a2c12');
      rect(c, 1, 4, 14, 2, '#5a5a66');
      rect(c, 1, 11, 14, 2, '#5a5a66');
      rect(c, 6, 6, 4, 5, '#e9b949');
      rect(c, 7, 5, 2, 2, '#a8802a');
      px(c, 7, 8, '#1a1420');
    }, false),
  );
  addCanvas(
    'door_open',
    iconCanvasSized(16, 16, (c) => {
      rect(c, 0, 0, 16, 3, '#3a3943');
      rect(c, 0, 0, 2, 16, '#6b4423');
      rect(c, 14, 0, 2, 16, '#6b4423');
    }, false),
  );
  // chests 16x14 closed/open
  const chest = (body: string, dark: string, trim: string, open: boolean, glow: string | null) => (c: CanvasRenderingContext2D) => {
    rect(c, 1, 6, 14, 8, body);
    rect(c, 1, 12, 14, 2, dark);
    rect(c, 1, 6, 14, 1, trim);
    rect(c, 1, 6, 1, 8, trim);
    rect(c, 14, 6, 1, 8, trim);
    if (!open) {
      rect(c, 1, 1, 14, 5, shade(body, 0.12));
      rect(c, 1, 1, 14, 1, trim);
      rect(c, 1, 5, 14, 1, dark);
      rect(c, 7, 4, 2, 4, trim);
      px(c, 7, 6, '#1a1420');
    } else {
      rect(c, 1, 0, 14, 3, shade(body, -0.1));
      rect(c, 1, 0, 14, 1, trim);
      rect(c, 2, 3, 12, 4, '#1a0f0a');
      if (glow) {
        rect(c, 3, 4, 10, 2, glow);
      }
    }
  };
  const tiers: [string, string, string, string][] = [
    ['wood', '#8a5a2b', '#5a3416', '#c0a060'],
    ['iron', '#5a6a7a', '#3a4450', '#c8d0d8'],
    ['gold', '#7a2a1a', '#4a1a0f', '#e9b949'],
    ['boss', '#3a1f5a', '#24123a', '#e9b949'],
  ];
  for (const [n, b, d, t] of tiers) {
    addCanvas('chest_' + n, iconCanvasSized(16, 14, chest(b, d, t, false, null)));
    addCanvas('chest_' + n + '_open', iconCanvasSized(16, 14, chest(b, d, t, true, null)));
  }
  // the cursed chest: black wood, bone trim, glowing green runes and a skull lock
  const cursed = (open: boolean) => (c: CanvasRenderingContext2D) => {
    chest('#2e1a3a', '#170c1e', '#d8d0c0', open, open ? '#7dff9a' : null)(c);
    const R = '#7dff9a';
    for (const [x, y] of [
      [3, 9],
      [4, 10],
      [3, 11],
      [12, 9],
      [11, 10],
      [12, 11],
    ])
      px(c, x, y, R);
    if (!open) {
      for (const [x, y] of [
        [3, 3],
        [12, 3],
      ])
        px(c, x, y, R);
      rect(c, 6, 3, 4, 3, '#e8e2cf');
      px(c, 7, 4, '#1a1420');
      px(c, 9, 4, '#1a1420');
      rect(c, 7, 6, 2, 1, '#e8e2cf');
    }
  };
  addCanvas('chest_cursed', iconCanvasSized(16, 14, cursed(false)));
  addCanvas('chest_cursed_open', iconCanvasSized(16, 14, cursed(true)));
  // spike trap 16x16, 2 frames (retracted / extended)
  {
    const [c, ctx] = canvas(32, 16);
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      rect(ctx, ox + 1, 1, 14, 14, '#3a3530');
      rect(ctx, ox + 1, 1, 14, 1, '#4f4943');
      rect(ctx, ox + 1, 14, 14, 1, '#24201c');
      for (let yy = 0; yy < 3; yy++)
        for (let xx = 0; xx < 3; xx++) {
          const hx = ox + 3 + xx * 4,
            hy = 3 + yy * 4;
          if (f === 0) {
            rect(ctx, hx, hy + 1, 2, 2, '#14110e');
          } else {
            rect(ctx, hx, hy + 2, 2, 1, '#14110e');
            px(ctx, hx, hy, '#e8eef2');
            px(ctx, hx + 1, hy, '#9aa3ad');
            rect(ctx, hx, hy + 1, 2, 1, '#cfd6dc');
          }
        }
    }
    addStrip('spikes', c, 16, 16, 2);
  }
  // gold pile
  addCanvas(
    'goldpile',
    iconCanvasSized(12, 8, (c) => {
      ell(c, 6, 5, 5.5, 3, '#a8802a');
      ell(c, 6, 4, 4, 2.5, '#e9b949');
      px(c, 4, 3, '#fff2b0');
      px(c, 8, 4, '#fff2b0');
    }),
  );
  // coin anim 6x6 x4
  creatureStrip(
    'coin',
    6,
    6,
    4,
    (ctx, f) => {
      const w = [2.8, 2, 1, 2][f];
      ell(ctx, 3, 3, w, 2.8, '#e9b949');
      if (w > 1.5) px(ctx, 2, 2, '#fff2b0');
    },
    true,
  );
  // shrine 14x22 (rune pillar)
  for (const [n, col] of [
    ['power', '#ff4d4d'],
    ['speed', '#ffe45c'],
    ['armor', '#7fb2ff'],
    ['fortune', '#52ff8f'],
    ['wisdom', '#c77dff'],
    ['life', '#ff6aa0'],
    ['storm', '#7ae0ff'],
    ['gems', '#ff9ab0'],
    ['used', '#555'],
  ]) {
    addCanvas(
      'shrine_' + n,
      iconCanvasSized(14, 22, (c) => {
        rect(c, 1, 18, 12, 4, '#4a4955');
        rect(c, 3, 3, 8, 15, '#6a6976');
        rect(c, 3, 3, 2, 15, '#8a8996');
        rect(c, 2, 1, 10, 3, '#5a5966');
        rect(c, 6, 7, 2, 7, col);
        rect(c, 5, 9, 4, 1, col);
        px(c, 6, 5, col);
      }),
    );
  }
  // fountain 22x20, 2 frames
  creatureStrip('fountain', 22, 20, 2, (ctx, f) => {
    ell(ctx, 11, 14, 10.5, 5.5, '#6a6976');
    ell(ctx, 11, 13.5, 8.5, 4, '#2c6be0');
    ell(ctx, 11 + (f ? 1 : -1), 13, 3, 1.4, '#7cc8ff');
    rect(ctx, 9, 3, 4, 11, '#7a7986');
    rect(ctx, 9, 3, 1, 11, '#9a99a6');
    ell(ctx, 11, 3, 3.5, 1.6, '#7a7986');
    px(ctx, 11, 1 + f, '#9cd8ff');
    px(ctx, 10, 2, '#9cd8ff');
    px(ctx, 12, 2 - f, '#9cd8ff');
  });
  addCanvas(
    'fountain_used',
    iconCanvasSized(22, 20, (c) => {
      ell(c, 11, 14, 10.5, 5.5, '#6a6976');
      ell(c, 11, 13.5, 8.5, 4, '#2a2a36');
      rect(c, 9, 3, 4, 11, '#7a7986');
      ell(c, 11, 3, 3.5, 1.6, '#7a7986');
    }),
  );
  // anvil 16x12
  addCanvas(
    'anvil',
    iconCanvasSized(18, 14, (c) => {
      rect(c, 5, 9, 8, 5, '#5a3416');
      rect(c, 2, 2, 14, 4, '#4a4a56');
      poly(c, [16, 2, 18, 3, 16, 5], '#4a4a56');
      rect(c, 2, 2, 14, 1, '#8a8a96');
      rect(c, 6, 6, 6, 3, '#3a3a44');
      px(c, 1, 0, '#ff9a3a');
      px(c, 3, 0, '#ffd23a');
    }),
  );
  // carpet tile pieces 16x16 : red / blue  (center + border drawn by scene)
  for (const [n, col, trim] of [
    ['red', '#7a1c1c', '#c9a04a'],
    ['blue', '#1c3a7a', '#c9a04a'],
  ]) {
    const [c, ctx] = canvas(16, 16);
    rect(ctx, 0, 0, 16, 16, col);
    for (let k = 0; k < 10; k++) px(ctx, Math.floor(hash(k, 3, 1) * 16), Math.floor(hash(3, k, 2) * 16), shade(col, -0.15));
    addCanvas('carpet_' + n, c);
    const [c2, ctx2] = canvas(16, 16);
    rect(ctx2, 0, 0, 16, 16, trim);
    rect(ctx2, 1, 1, 14, 14, shade(col, -0.2));
    addCanvas('carpettrim_' + n, c2);
  }
  // floor shadow under front walls
  {
    const [c, ctx] = canvas(16, 8);
    const g = ctx.createLinearGradient(0, 0, 0, 8);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 8);
    addCanvas('wallshadow', c);
  }
}

function iconCanvasSized(w: number, h: number, draw: Drawer, doOutline = true) {
  const [c, ctx] = canvas(w + 2, h + 2);
  ctx.translate(1, 1);
  draw(ctx);
  crisp(c);
  if (doOutline) outline(c, OUT);
  return c;
}

// ---------------------------------------------------------------------------
// PROJECTILES & FX
// ---------------------------------------------------------------------------
function glowBall(key: string, r: number, inner: string, outer: string, frames = 2) {
  const s = r * 2 + 4;
  const [c, ctx] = canvas(s * frames, s);
  for (let f = 0; f < frames; f++) {
    const cx = f * s + s / 2,
      cy = s / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + (f ? 1 : 0));
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, inner);
    g.addColorStop(0.75, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  addStrip(key, c, s, s, frames);
}

function buildProjectiles() {
  const simple = (key: string, w: number, h: number, d: Drawer, doOutline = false) => addCanvas(key, iconCanvasSized(w, h, d, doOutline));
  simple('pr_arrow', 12, 3, (c) => {
    rect(c, 0, 1, 10, 1, '#c8a878');
    rect(c, 9, 0, 3, 3, STEEL);
    px(c, 11, 1, STEEL_H);
    rect(c, 0, 0, 2, 1, '#f0f0f0');
    rect(c, 0, 2, 2, 1, '#f0f0f0');
  });
  simple('pr_knife', 8, 3, (c) => {
    rect(c, 0, 1, 3, 1, '#3b2a20');
    rect(c, 3, 0, 4, 3, STEEL);
    px(c, 7, 1, STEEL_H);
  });
  simple('pr_bone', 11, 4, (c) => {
    rect(c, 1, 1, 9, 2, '#e8e2cf');
    rect(c, 0, 0, 2, 4, '#e8e2cf');
    rect(c, 9, 0, 2, 4, '#e8e2cf');
  });
  simple('pr_thorn', 9, 3, (c) => {
    poly(c, [0, 0, 9, 1.5, 0, 3], '#4fd06b');
    rect(c, 0, 1, 4, 1, '#2a7a3a');
  });
  simple('pr_ice', 11, 5, (c) => {
    poly(c, [0, 2.5, 7, 0, 11, 2.5, 7, 5], '#9fe6ff');
    poly(c, [3, 2.5, 7, 1, 10, 2.5, 7, 3], '#ffffff');
  });
  simple('pr_axe', 9, 9, (c) => {
    rect(c, 4, 0, 1, 9, WOOD);
    poly(c, [5, 0, 9, 1, 9, 5, 5, 4], STEEL);
    poly(c, [4, 0, 0, 1, 0, 5, 4, 4], STEEL_D);
  }, true);
  simple('pr_hammer', 9, 9, (c) => {
    rect(c, 4, 3, 1, 6, '#fff2a8');
    rect(c, 0, 0, 9, 4, '#ffe45c');
    rect(c, 1, 1, 7, 2, '#ffffff');
  }, true);
  simple('pr_rock', 8, 8, (c) => {
    ell(c, 4, 4, 3.8, 3.4, '#7d7a72');
    px(c, 3, 2, '#9d9a92');
  }, true);
  simple('pr_wave', 8, 16, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(-2, 8, 8, -1.1, 1.1);
    c.stroke();
    c.strokeStyle = 'rgba(200,230,255,0.7)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(-5, 8, 8, -1.0, 1.0);
    c.stroke();
  });
  simple('pr_bee', 5, 4, (c) => {
    rect(c, 0, 1, 5, 3, '#ffd23a');
    rect(c, 2, 1, 1, 3, '#1a1420');
    rect(c, 1, 0, 2, 1, '#e8f4ff');
  });
  {
    const [c, ctx] = canvas(12 * 2, 16);
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 5; i++) {
        const y = 14 - i * 3,
          w = 2 + i * 1.2;
        ctx.fillStyle = `rgba(220,235,255,${0.8 - i * 0.08})`;
        ctx.fillRect(f * 12 + 6 - w / 2 + (i % 2 === f ? 1 : -1), y, w, 2);
      }
    }
    addStrip('pr_tornado', c, 12, 16, 2);
  }
  glowBall('pr_fire', 4, '#ffd23a', '#ff5a1a');
  glowBall('pr_bolt', 4, '#fff7a0', '#ffd000');
  glowBall('pr_poison', 3, '#c8ff8a', '#3fae2a');
  glowBall('pr_holy', 4, '#fffbe0', '#ffe45c');
  glowBall('pr_shadow', 4, '#e0b8ff', '#7a2ad6');
  glowBall('pr_magic', 3, '#f0d8ff', '#b05cff');
  glowBall('pr_soul', 4, '#d8fff0', '#4ad6a0');
  glowBall('pr_blood', 3, '#ffb0b0', '#c0101a');
  glowBall('pr_ice_ball', 4, '#e0f8ff', '#3aa8e0');
  glowBall('fx_orbit', 4, '#f0d8ff', '#8a5cff');

  // light gradient (for darkness erase)
  {
    const S = 128;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    addCanvas('light', c);
  }
  {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    addCanvas('glow', c);
  }
  // particle pixel
  {
    const [c, ctx] = canvas(3, 3);
    rect(ctx, 0, 0, 3, 3, '#ffffff');
    addCanvas('spark', c);
    const [c2, ctx2] = canvas(2, 2);
    rect(ctx2, 0, 0, 2, 2, '#ffffff');
    addCanvas('pix', c2);
  }
  // ambient motes (dust, spores, wisps) and a snowflake
  {
    const [c, ctx] = canvas(5, 5);
    rect(ctx, 1, 1, 3, 3, 'rgba(255,255,255,0.55)');
    rect(ctx, 2, 0, 1, 5, 'rgba(255,255,255,0.55)');
    rect(ctx, 0, 2, 5, 1, 'rgba(255,255,255,0.55)');
    rect(ctx, 2, 2, 1, 1, '#ffffff');
    addCanvas('mote', c);
    const [f, fx] = canvas(5, 5);
    rect(fx, 2, 0, 1, 5, '#ffffff');
    rect(fx, 0, 2, 5, 1, '#ffffff');
    for (const [x, y] of [
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
    ])
      rect(fx, x, y, 1, 1, 'rgba(255,255,255,0.6)');
    addCanvas('flake', f);
  }
  // smoke puff
  {
    const [c, ctx] = canvas(10, 10);
    ell(ctx, 5, 5, 4.5, 4.5, 'rgba(200,200,210,0.8)');
    ell(ctx, 4, 4, 2, 2, 'rgba(240,240,250,0.8)');
    addCanvas('puff', c);
  }
  // slash arc (white crescent) 32x32
  {
    const [c, ctx] = canvas(40, 40);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(20, 20, 15, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, 20, 11, -1.0, 1.0);
    ctx.stroke();
    addCanvas('slash', c);
  }
  // ring & circle
  {
    // high resolution so large novas stay smooth (scale = diameter / 256)
    const [c, ctx] = canvas(256, 256);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
    addCanvas('ring', c);
    const [c2, ctx2] = canvas(256, 256);
    const g = ctx2.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.95, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(128, 128, 128, 0, Math.PI * 2);
    ctx2.fill();
    addCanvas('disc', c2);
    // a spider web (slowing hazard of the spider queen)
    const [c3, ctx3] = canvas(128, 128);
    ctx3.strokeStyle = 'rgba(240,240,255,0.9)';
    ctx3.lineWidth = 2;
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + 0.13;
      ctx3.beginPath();
      ctx3.moveTo(64, 64);
      ctx3.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      ctx3.stroke();
    }
    ctx3.lineWidth = 1.5;
    for (let k = 1; k <= 5; k++) {
      const rr = k * 11.5;
      ctx3.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a0 = ((i - 1) / spokes) * Math.PI * 2 + 0.13,
          a1 = (i / spokes) * Math.PI * 2 + 0.13;
        const x1 = 64 + Math.cos(a1) * rr,
          y1 = 64 + Math.sin(a1) * rr;
        if (i === 0) ctx3.moveTo(x1, y1);
        else {
          // the threads sag a little towards the centre between the spokes
          const am = (a0 + a1) / 2;
          ctx3.quadraticCurveTo(64 + Math.cos(am) * rr * 0.86, 64 + Math.sin(am) * rr * 0.86, x1, y1);
        }
      }
      ctx3.stroke();
    }
    addCanvas('webzone', c3);
  }
  // pillar of light 16x48
  {
    const [c, ctx] = canvas(16, 64);
    const g = ctx.createLinearGradient(0, 0, 16, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 64);
    addCanvas('pillar', c);
  }
  // meteor 14x14
  addCanvas(
    'meteor',
    iconCanvasSized(14, 14, (c) => {
      ell(c, 7, 7, 6, 6, '#5a3020');
      ell(c, 6, 6, 4, 4, '#8a4a2a');
      px(c, 5, 5, '#ffb33b');
      px(c, 8, 8, '#ff7a1a');
    }),
  );
  // lightning segment (vertical strip used stretched)
  {
    const [c, ctx] = canvas(6, 32);
    let x = 3;
    for (let y = 0; y < 32; y++) {
      x += Math.round((hash(y, 1, 4) - 0.5) * 2);
      x = Math.max(1, Math.min(4, x));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = 'rgba(255,240,120,0.7)';
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
    }
    addCanvas('bolt', c);
  }
  // shadow ellipse under characters
  {
    const [c, ctx] = canvas(14, 6);
    ell(ctx, 7, 3, 6.5, 2.5, 'rgba(0,0,0,0.45)');
    addCanvas('shadow', c);
  }
  // loot beam
  {
    const [c, ctx] = canvas(10, 40);
    const g = ctx.createLinearGradient(0, 40, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(3, 0, 4, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(1, 10, 8, 30);
    addCanvas('beam', c);
  }
}

// ---------------------------------------------------------------------------
// SPELL ICONS (40x40, drawn as glyphs)
// ---------------------------------------------------------------------------
export function spellIcon(glyph: string, color: string, size = 40): string {
  const key = `sp_${glyph}_${color}_${size}`;
  if (iconCache.has(key)) return iconCache.get(key)!;
  const [c, ctx] = canvas(size, size);
  ctx.imageSmoothingEnabled = true;
  const s = size / 40;
  ctx.scale(s, s);
  // background
  // dark background with a soft halo of the spell colour, the glyph itself glows (like the reference HUD)
  const g = ctx.createRadialGradient(20, 18, 1, 20, 20, 24);
  g.addColorStop(0, shade(color, -0.45));
  g.addColorStop(0.55, shade(color, -0.78));
  g.addColorStop(1, shade(color, -0.93));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 40, 40);
  ctx.shadowColor = shade(color, 0.25);
  ctx.shadowBlur = 5 * s;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  const P = (pts: number[], fill = true) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (fill) {
      ctx.closePath();
      ctx.fill();
    } else ctx.stroke();
  };
  const hi = shade(color, 0.55);
  switch (glyph) {
    case 'sword':
      P([20, 5, 24, 9, 24, 26, 16, 26, 16, 9]);
      ctx.fillStyle = hi;
      P([20, 6, 21, 9, 21, 25, 19, 25, 19, 9]);
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(11, 26, 18, 3);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(18, 29, 4, 7);
      break;
    case 'slash':
    case 'claw':
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10 + i * 7, 6);
        ctx.quadraticCurveTo(14 + i * 7, 22, 8 + i * 7, 34);
        ctx.stroke();
      }
      break;
    case 'shield':
      P([8, 8, 32, 8, 32, 20, 20, 34, 8, 20]);
      ctx.fillStyle = hi;
      P([12, 11, 28, 11, 28, 19, 20, 29, 12, 19]);
      ctx.fillStyle = color;
      ctx.fillRect(18, 12, 4, 15);
      break;
    case 'dash':
    case 'wing':
      for (let i = 0; i < 3; i++) P([6 + i * 9, 10, 16 + i * 9, 20, 6 + i * 9, 30, 10 + i * 9, 20]);
      break;
    case 'burst':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 2 ? 16 : 10;
        ctx.beginPath();
        ctx.moveTo(20, 20);
        ctx.lineTo(20 + Math.cos(a) * r1, 20 + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(20, 20, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'whirl':
    case 'vortex':
    case 'tornado':
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(20, 20, 6 + i * 5, i, i + 4);
        ctx.stroke();
      }
      break;
    case 'shout':
      P([8, 16, 14, 16, 22, 9, 22, 31, 14, 24, 8, 24]);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(22, 20, 6 + i * 4, -0.7, 0.7);
        ctx.stroke();
      }
      break;
    case 'arrow':
      ctx.lineWidth = 3;
      P([8, 32, 30, 10], false);
      P([30, 10, 22, 11, 29, 18]);
      ctx.strokeStyle = hi;
      P([8, 32, 12, 26], false);
      break;
    case 'arrows':
    case 'knives':
    case 'rain':
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const x = 10 + i * 10;
        P([x, 6 + (i % 2) * 4, x, 30 + (i % 2) * 2], false);
        P([x - 4, 26 + (i % 2) * 2, x + 4, 26 + (i % 2) * 2, x, 33 + (i % 2) * 2]);
      }
      break;
    case 'bolt':
      P([22, 4, 10, 22, 19, 22, 15, 36, 30, 16, 21, 16, 26, 4]);
      ctx.fillStyle = hi;
      P([22, 7, 13, 21, 19, 21]);
      break;
    case 'fire':
      ctx.beginPath();
      ctx.moveTo(20, 4);
      ctx.bezierCurveTo(30, 14, 32, 22, 28, 30);
      ctx.bezierCurveTo(24, 36, 14, 36, 11, 29);
      ctx.bezierCurveTo(8, 22, 14, 18, 14, 12);
      ctx.bezierCurveTo(17, 16, 18, 10, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#ffe45c';
      ctx.beginPath();
      ctx.arc(20, 27, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ice':
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        P([20 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, 20 - Math.cos(a) * 14, 20 - Math.sin(a) * 14], false);
      }
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(20, 20, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'skull':
    case 'ghost':
      ctx.beginPath();
      ctx.arc(20, 17, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(13, 22, 14, 9);
      ctx.fillStyle = shade(color, -0.85);
      ctx.beginPath();
      ctx.arc(15.5, 17, 3, 0, Math.PI * 2);
      ctx.arc(24.5, 17, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(16, 27, 2, 4);
      ctx.fillRect(22, 27, 2, 4);
      break;
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(20, 33);
      ctx.bezierCurveTo(4, 22, 6, 8, 14, 8);
      ctx.bezierCurveTo(18, 8, 20, 12, 20, 13);
      ctx.bezierCurveTo(20, 12, 22, 8, 26, 8);
      ctx.bezierCurveTo(34, 8, 36, 22, 20, 33);
      ctx.fill();
      break;
    case 'plus':
    case 'cross':
      ctx.fillRect(16, 6, 8, 28);
      ctx.fillRect(6, 16, 28, 8);
      ctx.fillStyle = hi;
      ctx.fillRect(18, 8, 2, 24);
      break;
    case 'star':
    case 'sun': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r1 = i % 2 ? 7 : 16;
        pts.push(20 + Math.cos(a) * r1, 20 + Math.sin(a) * r1);
      }
      P(pts);
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(20, 20, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'eye':
      ctx.beginPath();
      ctx.moveTo(4, 20);
      ctx.quadraticCurveTo(20, 4, 36, 20);
      ctx.quadraticCurveTo(20, 36, 4, 20);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.85);
      ctx.beginPath();
      ctx.arc(20, 20, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(18, 18, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'fist':
      ctx.fillRect(10, 12, 20, 16);
      ctx.fillRect(10, 28, 14, 6);
      ctx.fillStyle = shade(color, -0.5);
      for (let i = 0; i < 3; i++) ctx.fillRect(15 + i * 5, 12, 1, 9);
      break;
    case 'leaf':
    case 'tree':
      ctx.beginPath();
      ctx.moveTo(8, 32);
      ctx.quadraticCurveTo(8, 8, 32, 6);
      ctx.quadraticCurveTo(32, 30, 8, 32);
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.6);
      ctx.lineWidth = 1.5;
      P([8, 32, 28, 10], false);
      break;
    case 'wolf':
    case 'bear':
      P([8, 30, 10, 12, 15, 6, 17, 14, 23, 14, 25, 6, 30, 12, 32, 30, 20, 34]);
      ctx.fillStyle = shade(color, -0.85);
      ctx.fillRect(14, 19, 3, 3);
      ctx.fillRect(23, 19, 3, 3);
      ctx.fillRect(18, 27, 4, 3);
      break;
    case 'totem':
      ctx.fillRect(14, 6, 12, 30);
      ctx.fillRect(8, 14, 24, 4);
      ctx.fillStyle = shade(color, -0.8);
      ctx.fillRect(16, 9, 3, 3);
      ctx.fillRect(21, 9, 3, 3);
      ctx.fillRect(17, 24, 6, 2);
      break;
    case 'poison':
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(20, 4);
      ctx.bezierCurveTo(30, 18, 32, 24, 28, 30);
      ctx.bezierCurveTo(24, 36, 16, 36, 12, 30);
      ctx.bezierCurveTo(8, 24, 10, 18, 20, 4);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(16, 25, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'dagger':
      P([20, 4, 24, 10, 23, 24, 17, 24, 16, 10]);
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(12, 24, 16, 3);
      ctx.fillStyle = '#5a3416';
      ctx.fillRect(18, 27, 4, 8);
      break;
    case 'trap':
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(20, 22, 12, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i < 6; i++) P([9 + i * 4, 22, 11 + i * 4, 15, 13 + i * 4, 22]);
      ctx.fillRect(6, 24, 28, 4);
      break;
    case 'orb':
      ctx.beginPath();
      ctx.arc(20, 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(16, 16, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hammer':
      ctx.fillRect(9, 7, 22, 11);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(18, 18, 4, 17);
      ctx.fillStyle = hi;
      ctx.fillRect(11, 9, 18, 3);
      break;
    case 'axe':
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(18, 6, 4, 30);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(22, 8);
      ctx.quadraticCurveTo(36, 14, 32, 26);
      ctx.lineTo(22, 20);
      ctx.fill();
      break;
    case 'wave':
      ctx.lineWidth = 4;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(8 + i * 8, 20, 12, -1.1, 1.1);
        ctx.stroke();
      }
      break;
    case 'meteor':
      ctx.lineWidth = 4;
      ctx.strokeStyle = shade(color, -0.2);
      P([6, 6, 20, 20], false);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(24, 24, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe45c';
      ctx.beginPath();
      ctx.arc(22, 22, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'moon':
      ctx.beginPath();
      ctx.arc(20, 20, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.8);
      ctx.beginPath();
      ctx.arc(26, 16, 11, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'chain':
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(10 + i * 10, 10 + i * 10, 6, 4, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'clock':
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(20, 20, 13, 0, Math.PI * 2);
      ctx.stroke();
      P([20, 20, 20, 11], false);
      P([20, 20, 27, 23], false);
      break;
    case 'crown':
      P([6, 30, 6, 12, 13, 20, 20, 8, 27, 20, 34, 12, 34, 30]);
      ctx.fillStyle = hi;
      ctx.fillRect(6, 26, 28, 4);
      break;
    default:
      ctx.beginPath();
      ctx.arc(20, 20, 10, 0, Math.PI * 2);
      ctx.fill();
  }
  // frame
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 38, 38);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MATERIAL TIERS: metal parts of weapons/armour are recoloured per item tier
// (rusty, iron, steel, rune, mithril, dragon, demonic, star)
// ---------------------------------------------------------------------------
export const TIER_TINTS = ['#b07a52', '#a7aeb6', '#e2e8ee', '#7fb8ff', '#c8f4ff', '#ff6a4a', '#b47cff', '#ffd86a'];
const TIERED_ICONS = ['ic_sword', 'ic_greatsword', 'ic_dagger', 'ic_knuckle', 'ic_axe', 'ic_greataxe', 'ic_mace', 'ic_hammer', 'ic_spear', 'ic_bow', 'ic_crossbow', 'ic_staff', 'ic_wand', 'ic_shield', 'ic_orb', 'ic_helmet', 'ic_chest', 'ic_pants', 'ic_belt', 'ic_boots', 'ic_ring', 'ic_amulet', 'ic_bracer'];
const TIERED_WEAPONS = ['sword', 'greatsword', 'dagger', 'knuckle', 'axe', 'greataxe', 'mace', 'hammer', 'spear', 'bow', 'crossbow', 'staff', 'wand', 'shield', 'orb'];

function recolorMetal(src: HTMLCanvasElement, tint: string): HTMLCanvasElement {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const t = parseInt(tint.slice(1), 16);
  const tr = (t >> 16) & 255,
    tg = (t >> 8) & 255,
    tb = t & 255;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    // only greyish, reasonably bright pixels are metal (wood, gold and outline stay)
    if (mx - mn > 28 || mx < 70) continue;
    const l = (r + g + b) / 3 / 210;
    d[i] = Math.min(255, tr * l);
    d[i + 1] = Math.min(255, tg * l);
    d[i + 2] = Math.min(255, tb * l);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildTierVariants() {
  TIER_TINTS.forEach((tint, t) => {
    for (const k of TIERED_ICONS) {
      const src = canvases.get(k);
      if (src) addCanvas(`${k}_t${t}`, recolorMetal(src, tint));
    }
    for (const w of TIERED_WEAPONS) {
      const src = canvases.get('wp_' + w);
      // (the source is already smoothed to double resolution)
      if (src) addCanvas(`wp_${w}_t${t}`, recolorMetal(src, tint), false);
    }
  });
}

// cut gems, one shape per kind (cushion, oval, emerald cut, pear, crystal, brilliant); higher grades are
// bigger and the royal ones sparkle
function buildGems() {
  const inside: Record<string, (dx: number, dy: number, r: number) => boolean> = {
    ruby: (dx, dy, r) => Math.abs(dx) <= r && Math.abs(dy) <= r * 0.9 && Math.abs(dx) + Math.abs(dy) <= r * 1.45,
    sapphire: (dx, dy, r) => (dx * dx) / (r * r) + (dy * dy) / (r * r * 0.72) <= 1.05,
    emerald: (dx, dy, r) => Math.abs(dx) <= r * 0.78 && Math.abs(dy) <= r && Math.abs(dx) + Math.abs(dy) <= r * 1.5,
    topaz: (dx, dy, r) => (dy >= 0 ? dx * dx + dy * dy <= r * r : Math.abs(dx) <= r * (1 + dy / (r * 1.35))),
    amethyst: (dx, dy, r) => Math.abs(dx) <= r * 0.72 && Math.abs(dy) <= r * 1.15 - Math.abs(dx) * 0.55,
    diamond: (dx, dy, r) => (dy <= 0 ? dy >= -r * 0.62 && Math.abs(dx) <= r - -dy * 0.45 : Math.abs(dx) <= r * (1 - dy / (r * 1.15))),
  };
  for (const g of GEMS)
    for (let t = 1; t <= GEM_MAX_TIER; t++) {
      const S = 15;
      const [c, ctx] = canvas(S, S);
      const r = 2.5 + t * 0.7;
      const cx = 7.5,
        cy = 7.5;
      const inG = (x: number, y: number) => inside[g.id](x + 0.5 - cx, y + 0.5 - cy, r);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          if (!inG(x, y)) continue;
          const dx = x + 0.5 - cx,
            dy = y + 0.5 - cy;
          const d = (dx + dy) / r;
          let col = d < -0.55 ? g.light : d > 0.55 ? g.dark : g.color;
          // the flat top facet in the middle is a touch lighter
          if (Math.abs(dx) <= r * 0.32 && Math.abs(dy) <= r * 0.32 && col === g.color) col = shade(g.color, 0.22);
          px(ctx, x, y, col);
        }
      // shine
      const sx = Math.round(cx - r * 0.45 - 0.5),
        sy = Math.round(cy - r * 0.45 - 0.5);
      if (inG(sx, sy)) px(ctx, sx, sy, '#ffffff');
      if (t >= 4 && inG(sx + 1, sy)) px(ctx, sx + 1, sy, '#ffffff');
      outline(c, OUT);
      // a royal gem twinkles
      if (t === GEM_MAX_TIER) {
        const k = Math.round(cx + r + 0.5);
        for (const [x, y] of [
          [k, 2],
          [k, 4],
          [k - 1, 3],
          [k + 1, 3],
          [2, S - 4],
        ])
          if (x >= 0 && x < S && y >= 0 && y < S) px(ctx, x, y, '#fff6c0');
      }
      addCanvas(`gem_${g.id}_${t}`, c);
    }
  // an empty socket (for the item detail)
  const [c, ctx] = canvas(15, 15);
  circle(ctx, 7, 7, 5, '#2a2430');
  circle(ctx, 7, 7, 3, '#120e16');
  px(ctx, 5, 5, '#4a4250');
  outline(c, OUT);
  addCanvas('socket_empty', c);
}

// rune stones: a rounded tablet (darker and finer with the grade) with a glowing glyph of the rune
function buildRunes() {
  const GLYPHS: Record<string, string[]> = {
    fire: ['..x..', '.x.x.', '.x.x.', 'x...x', '.xxx.'],
    poison: ['.xxx.', 'x...x', '.xxx.', '..x..', '.x.x.'],
    frost: ['x.x.x', '.xxx.', 'xx.xx', '.xxx.', 'x.x.x'],
    storm: ['..xx.', '.xx..', 'xxxx.', '..xx.', '.xx..'],
    blood: ['..x..', '.xxx.', 'xxxxx', 'xxxxx', '.xxx.'],
    weak: ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'],
    leech: ['x.x.x', 'x.x.x', '.xxx.', '..x..', '..x..'],
  };
  const STONE = [
    ['#8a8478', '#5e5a52', '#b0aa9e'],
    ['#9a7a52', '#6a5034', '#c49e70'],
    ['#9aa4b0', '#626c78', '#cad4de'],
    ['#c8a44a', '#8a6a24', '#f0d47a'],
    ['#2e2838', '#16121e', '#5a4e6a'],
  ];
  for (const r of RUNES)
    for (let t = 1; t <= RUNE_MAX_TIER; t++) {
      const S = 15;
      const [c, ctx] = canvas(S, S);
      const [base, dark, light] = STONE[t - 1];
      for (let y = 1; y < 14; y++)
        for (let x = 2; x < 13; x++) {
          // rounded corners
          if ((x === 2 || x === 12) && (y === 1 || y === 13)) continue;
          const col = x === 2 || y === 1 ? light : x === 12 || y === 13 ? dark : base;
          px(ctx, x, y, col);
        }
      const g = GLYPHS[r.id];
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) if (g[y][x] === 'x') px(ctx, 5 + x, 5 + y, t >= 3 ? shade(r.color, 0.25) : r.color);
      outline(c, OUT);
      if (t === RUNE_MAX_TIER) {
        px(ctx, 13, 2, '#fff6c0');
        px(ctx, 1, 12, '#fff6c0');
      }
      addCanvas(`rune_${r.id}_${t}`, c);
    }
  // spell runes: a six-sided crystal plate of the rune's colour with a white glyph
  const SG: Record<string, string[]> = {
    echo: ['x...x', 'x.x.x', 'x.x.x', 'x.x.x', 'x...x'],
    split: ['x.x.x', '.xxx.', '..x..', '..x..', '..x..'],
    fire: GLYPHS.fire,
    frost: GLYPHS.frost,
    storm: GLYPHS.storm,
    venom: GLYPHS.poison,
    power: ['..x..', '.xxx.', 'xxxxx', '..x..', '..x..'],
    haste: ['xx.xx', '.xx.x', '..xx.', '.xx.x', 'xx.xx'],
    vamp: GLYPHS.leech,
    pierce: ['x....', '.x...', '..xxx', '.x...', 'x....'],
    seek: ['.xxx.', 'x...x', 'x.x.x', 'x...x', '.xxx.'],
    blast: ['x.x.x', '.x.x.', 'x.x.x', '.x.x.', 'x.x.x'],
  };
  for (const r of SPELL_RUNES) {
    const S = 15;
    const [c, ctx] = canvas(S, S);
    const dark = shade(r.color, -0.45),
      light = shade(r.color, 0.35);
    for (let y = 1; y < 14; y++)
      for (let x = 1; x < 14; x++) {
        // a hexagon: cut corners
        const dy = Math.abs(y - 7);
        if (Math.abs(x - 7) > 6 - Math.max(0, dy - 3)) continue;
        px(ctx, x, y, y < 5 ? light : y > 10 ? dark : r.color);
      }
    const g = SG[r.id] ?? GLYPHS.fire;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (g[y][x] === 'x') px(ctx, 5 + x, 5 + y, '#ffffff');
    outline(c, OUT);
    addCanvas(`srune_${r.id}`, c);
  }
  // an empty rune socket
  const [c, ctx] = canvas(15, 15);
  for (let y = 2; y < 13; y++) for (let x = 3; x < 12; x++) px(ctx, x, y, x === 3 || y === 2 ? '#1a1620' : '#2a2430');
  outline(c, OUT);
  addCanvas('rune_empty', c);
}

// pets are drawn at double detail already (like the heroes); cages are furniture
function buildPets() {
  for (const [id, a] of Object.entries(PET_ART)) {
    const n = 6;
    const [c, ctx] = canvas(a.w * n, a.h);
    for (let f = 0; f < n; f++) {
      const [fc, fctx] = canvas(a.w, a.h);
      a.draw(fctx, f);
      crisp(fc);
      outline(fc, OUT);
      ctx.drawImage(fc, f * a.w, 0);
    }
    addStrip('pet_' + id, c, a.w, a.h, n, false);
  }
  // a cage: the plank and the roof get an outline, the bars stay thin so the animal inside shows
  const cage = (open: boolean) => (ctx: CanvasRenderingContext2D) => {
    const W = '#7a5230',
      WD = '#4e321c',
      WL = '#a07040',
      I = '#9aa0aa',
      IL = '#d4dae2',
      ID = '#4a4e56';
    rect(ctx, 1, 17, 19, 4, W);
    rect(ctx, 1, 20, 19, 1, WD);
    rect(ctx, 1, 17, 19, 1, WL);
    rect(ctx, 2, 3, 17, 3, W);
    rect(ctx, 2, 3, 17, 1, WL);
    rect(ctx, 2, 5, 17, 1, WD);
    rect(ctx, 9, 1, 3, 1, I);
    px(ctx, 8, 2, I);
    px(ctx, 12, 2, I);
    outline(ctx.canvas, OUT);
    // bars with a dark edge (the door in the middle is open on the freed cage)
    for (const x of [2, 6, 10, 14, 18]) {
      if (open && x >= 6 && x <= 14) continue;
      rect(ctx, x, 6, 1, 11, I);
      px(ctx, x, 6, IL);
      rect(ctx, x + 1, 7, 1, 10, ID);
    }
    if (!open) {
      rect(ctx, 2, 11, 17, 1, ID);
      // padlock
      rect(ctx, 9, 10, 3, 3, '#e9b949');
      px(ctx, 10, 11, '#7a5a1a');
    } else {
      // the door swung out to the right
      rect(ctx, 20, 6, 1, 11, I);
      for (const y of [8, 12, 16]) px(ctx, 19, y, ID);
    }
  };
  creatureStrip('cage', 22, 22, 1, cage(false), false);
  creatureStrip('cage_open', 22, 22, 1, cage(true), false);
}

export function buildAllTextures(scene: Phaser.Scene) {
  SCENE = scene;
  buildTileset();
  buildClassSprites();
  buildEnemies();
  buildPets();
  buildGems();
  buildRunes();
  buildWeapons();
  buildIcons();
  buildTierVariants();
  buildObjects();
  buildProjectiles();
}
