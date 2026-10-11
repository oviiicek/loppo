// Art of the village of Loppo under the open sky: trees and bushes, lamps, fences and benches, the
// graveyard, market stalls, the houses of the villagers (the hero's own grows with its level), the
// castle ruins with the way down into the dungeon, the king's palace, the king and his guards, and the
// little life of the place (ducks, butterflies, chickens).
// Everything is drawn in art pixels (= world pixels); keys starting with 'vh_' get the double detail
// smoothing like the rest of the furniture and are shown at half scale.
import { rect, px, shade, hash, canvas } from './pixel';
import { addCanvas, iconCanvasSized, humanoidStrip, creatureStrip, ell, poly, HEADS } from './textures';

type C = CanvasRenderingContext2D;

/** windows of each building picture (x, y, w, h in art pixels from its top left) – they glow at night */
export const VILLAGE_WINDOWS: Record<string, [number, number, number, number][]> = {};
/** where smoke leaves a chimney (art pixels from the top left) */
export const VILLAGE_CHIMNEYS: Record<string, [number, number][]> = {};

const OUTLINE = '#16121c';
const W = {
  dark: '#3e2716',
  mid: '#5f3c22',
  light: '#7d5332',
  hi: '#9c6b40',
};
const STONE = { dark: '#5a554d', mid: '#7c766b', light: '#9a9488', hi: '#b8b2a4' };
const GLASS = '#3a4a6a';
const GLASS_HI = '#6a86b0';
const LIT = '#ffd98a';

const sprite = (key: string, w: number, h: number, draw: (c: C) => void, out = true) => addCanvas(key, iconCanvasSized(w, h, draw, out));

// ------------------------------------------------------------------ nature
/** a leafy crown made of clusters, lit from the top left */
function crown(c: C, cx: number, cy: number, rx: number, ry: number, pal: string[], seed: number, n = 9) {
  const [dark, mid, light, hi] = pal;
  const blobs: [number, number, number][] = [];
  blobs.push([cx, cy, Math.min(rx, ry) * 0.75]);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + hash(k, seed, 1) * 0.6;
    const d = 0.55 + hash(seed, k, 2) * 0.25;
    const r = Math.min(rx, ry) * (0.38 + hash(k, k, seed) * 0.16);
    blobs.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r]);
  }
  for (const [x, y, r] of blobs) ell(c, x, y, r, r * 0.92, dark);
  for (const [x, y, r] of blobs) ell(c, x - 1, y - 1.5, r - 1.4, (r - 1.4) * 0.9, mid);
  // the light catches the upper left of the upper clusters
  for (const [x, y, r] of blobs) if (y <= cy + ry * 0.1) ell(c, x - r * 0.3, y - r * 0.35, r * 0.48, r * 0.4, light);
  for (let k = 0; k < (rx * ry) / 6; k++) {
    const a = hash(k, seed, 5) * Math.PI * 2,
      d = Math.sqrt(hash(seed, k, 6));
    const x = Math.round(cx + Math.cos(a) * rx * d * 0.92),
      y = Math.round(cy + Math.sin(a) * ry * d * 0.92);
    const upper = x - cx + (y - cy) < 0;
    px(c, x, y, upper ? (hash(k, 7, seed) < 0.5 ? hi : light) : dark);
  }
}

function trunk(c: C, x: number, y0: number, w: number, h: number, col = W.mid) {
  rect(c, x, y0, w, h, col);
  rect(c, x, y0, 1, h, shade(col, 0.22));
  rect(c, x + w - 1, y0, 1, h, shade(col, -0.3));
  for (let k = 0; k < h / 3; k++) px(c, x + 1 + Math.floor(hash(k, x, 3) * (w - 2)), y0 + Math.floor(hash(x, k, 4) * h), shade(col, -0.25));
  // roots
  px(c, x - 1, y0 + h - 1, col);
  px(c, x + w, y0 + h - 1, shade(col, -0.2));
  px(c, x - 2, y0 + h - 1, shade(col, -0.1));
}

const LEAF = {
  oak: ['#2f5a28', '#3e7032', '#53893d', '#78ad52'],
  apple: ['#33602a', '#447a34', '#5a9240', '#80b858'],
  birch: ['#4c7e34', '#5f9640', '#7aae4e', '#a2cc6c'],
  willow: ['#3a6a30', '#4c823a', '#64984a', '#86b462'],
  pine: ['#1d4430', '#275840', '#33694c', '#4c8460'],
  bush: ['#2e5a2a', '#3d7034', '#548a42', '#76aa58'],
};

function buildNature() {
  // an oak: a broad crown on a stout trunk
  sprite('vh_tree_oak', 48, 56, (c) => {
    trunk(c, 21, 34, 7, 21);
    crown(c, 24, 21, 21, 18, LEAF.oak, 11, 10);
  });
  // an apple tree: smaller, with red apples
  sprite('vh_tree_apple', 42, 48, (c) => {
    trunk(c, 18, 31, 6, 16);
    crown(c, 21, 19, 18, 15, LEAF.apple, 21, 9);
    for (let k = 0; k < 11; k++) {
      const x = 8 + Math.floor(hash(k, 1, 23) * 27),
        y = 9 + Math.floor(hash(1, k, 23) * 19);
      if (Math.hypot((x - 21) / 17, (y - 19) / 14) > 0.95) continue;
      rect(c, x, y, 2, 2, '#c8302a');
      px(c, x, y, '#f07a5a');
    }
  });
  // a pine: tiers of needles, darker at their lower edge
  sprite('vh_tree_pine', 34, 60, (c) => {
    trunk(c, 15, 48, 4, 11, W.dark);
    const [dark, mid, light, hi] = LEAF.pine;
    for (let i = 0; i < 6; i++) {
      const top = 2 + i * 8,
        bot = top + 14;
      const half = 4 + i * 2.6;
      poly(c, [17, top, 17 + half, bot, 17 - half, bot], dark);
      poly(c, [17, top + 1, 17 + half - 2, bot - 2, 17 - half + 1, bot - 2], mid);
      poly(c, [17, top + 2, 17 - 1, bot - 3, 17 - half + 3, bot - 3], light);
      for (let x = Math.ceil(17 - half); x < 17 + half; x += 2) px(c, x, bot - 1 + (x % 4 === 0 ? 1 : 0), dark);
      for (let k = 0; k < 3 + i; k++) px(c, Math.round(17 - half * 0.6 + hash(k, i, 31) * half * 0.8), Math.round(top + 5 + hash(i, k, 32) * 7), hi);
    }
  });
  // a birch: a white trunk with black marks, light airy leaves
  sprite('vh_tree_birch', 32, 54, (c) => {
    rect(c, 14, 26, 4, 27, '#e6e2d8');
    rect(c, 17, 26, 1, 27, '#b8b2a6');
    for (let k = 0; k < 9; k++) rect(c, 14 + (k % 2), 28 + k * 3 + Math.floor(hash(k, 2, 41) * 2), 2 + (k % 2), 1, '#2a2826');
    px(c, 13, 52, '#b8b2a6');
    px(c, 18, 52, '#b8b2a6');
    crown(c, 16, 15, 13, 13, LEAF.birch, 41, 8);
    crown(c, 12, 25, 6, 5, LEAF.birch, 42, 4);
    crown(c, 21, 27, 6, 4, LEAF.birch, 43, 4);
  });
  // a weeping willow by the water
  sprite('vh_tree_willow', 58, 58, (c) => {
    trunk(c, 25, 36, 8, 21, '#5a4632');
    const [dark, mid, light] = LEAF.willow;
    crown(c, 29, 20, 24, 15, LEAF.willow, 51, 10);
    // hanging strands
    for (let k = 0; k < 34; k++) {
      const x = 6 + Math.floor(hash(k, 1, 52) * 46);
      const top = 18 + Math.floor(hash(1, k, 53) * 10);
      const len = 12 + Math.floor(hash(k, 2, 54) * 16);
      const col = k % 3 === 0 ? dark : k % 3 === 1 ? mid : light;
      for (let i = 0; i < len; i++) px(c, x + (i > len * 0.6 ? 1 : 0), top + i, col);
    }
  });
  // a dead tree in the graveyard
  sprite('vh_tree_dead', 36, 48, (c) => {
    const col = '#5a4a3e',
      hi = '#7a6a5a';
    rect(c, 16, 22, 5, 25, col);
    rect(c, 16, 22, 1, 25, hi);
    const branch = (x0: number, y0: number, x1: number, y1: number, w: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n),
          y = Math.round(y0 + ((y1 - y0) * i) / n);
        rect(c, x, y, w, w, col);
        px(c, x, y, hi);
      }
    };
    branch(18, 24, 7, 10, 2);
    branch(9, 13, 3, 9, 1);
    branch(18, 22, 29, 7, 2);
    branch(26, 11, 32, 11, 1);
    branch(18, 16, 17, 2, 2);
    branch(17, 6, 12, 1, 1);
    branch(12, 18, 8, 22, 1);
    px(c, 15, 46, col);
    px(c, 21, 46, col);
  });
  // a dark cypress
  sprite('vh_tree_cypress', 18, 46, (c) => {
    trunk(c, 8, 38, 3, 7, W.dark);
    ell(c, 9, 22, 7, 18, '#1f4026');
    ell(c, 8, 21, 5.5, 16, '#2c5432');
    ell(c, 7, 17, 3, 10, '#3d6a40');
    for (let k = 0; k < 18; k++) px(c, 4 + Math.floor(hash(k, 1, 61) * 10), 6 + Math.floor(hash(1, k, 61) * 32), k % 2 ? '#1a3620' : '#4f7c4a');
  });
  // bushes
  const bush = (key: string, dots?: string[]) =>
    sprite(key, 22, 16, (c) => {
      crown(c, 11, 9, 10, 6.5, LEAF.bush, key.length * 7, 6);
      if (dots)
        for (let k = 0; k < 9; k++) {
          const x = 3 + Math.floor(hash(k, key.length, 71) * 16),
            y = 4 + Math.floor(hash(key.length, k, 72) * 9);
          px(c, x, y, dots[k % dots.length]);
          if (k % 3 === 0) px(c, x + 1, y, dots[(k + 1) % dots.length]);
        }
    });
  bush('vh_bush_green');
  bush('vh_bush_flower', ['#f2a0c8', '#fff0f6', '#f07ab0']);
  bush('vh_bush_berry', ['#c82a3a', '#3a3a9a', '#e84a5a']);
  // rocks and a stump
  sprite('vh_rock_a', 16, 11, (c) => {
    ell(c, 8, 6, 7.5, 5, STONE.dark);
    ell(c, 7, 5, 6, 4, STONE.mid);
    ell(c, 6, 4, 3.5, 2.2, STONE.light);
    px(c, 5, 3, STONE.hi);
    rect(c, 5, 1, 4, 1, '#4f7a38');
    px(c, 9, 2, '#5f8a42');
  });
  sprite('vh_rock_b', 22, 13, (c) => {
    ell(c, 8, 7, 7.5, 5.5, STONE.dark);
    ell(c, 7, 6, 6, 4.5, STONE.mid);
    ell(c, 6, 5, 3, 2.4, STONE.light);
    ell(c, 16, 9, 5, 3.5, STONE.dark);
    ell(c, 15.5, 8.5, 3.8, 2.6, STONE.mid);
    px(c, 14, 7, STONE.hi);
    rect(c, 4, 2, 4, 1, '#4f7a38');
  });
  sprite('vh_stump', 14, 10, (c) => {
    rect(c, 2, 4, 10, 5, W.mid);
    rect(c, 2, 4, 1, 5, W.hi);
    ell(c, 7, 4, 5, 2.4, '#c8a070');
    ell(c, 7, 4, 3, 1.4, '#a88050');
    px(c, 7, 4, '#7a5432');
    px(c, 1, 8, W.mid);
    px(c, 12, 8, W.dark);
  });
  // the pond: reeds, lily pads, a little boat
  sprite('vh_reeds', 12, 18, (c) => {
    for (const [x, h, col] of [
      [2, 12, '#4a7a30'],
      [4, 16, '#5a8e38'],
      [6, 13, '#3f6e2a'],
      [8, 15, '#5a8e38'],
      [10, 11, '#4a7a30'],
    ] as [number, number, string][]) {
      rect(c, x, 17 - h, 1, h, col);
      px(c, x - 1, 17 - Math.floor(h / 2), col);
    }
    rect(c, 4, 2, 2, 4, '#6a4026');
    px(c, 4, 2, '#8a5a36');
    rect(c, 8, 4, 2, 4, '#6a4026');
    px(c, 8, 4, '#8a5a36');
  });
  sprite('vh_lily', 10, 6, (c) => {
    ell(c, 5, 3, 4.5, 2.6, '#3f7a34');
    ell(c, 4.5, 2.6, 3.2, 1.6, '#5a9a44');
    poly(c, [5, 3, 9, 1, 9, 3], '#2f5a7a');
  });
  sprite('vh_lily_f', 10, 7, (c) => {
    ell(c, 5, 4, 4.5, 2.6, '#3f7a34');
    ell(c, 4.5, 3.6, 3.2, 1.6, '#5a9a44');
    ell(c, 5, 2.5, 2.2, 1.8, '#f6b8d4');
    px(c, 5, 2, '#fff0f6');
    px(c, 4, 3, '#e888b0');
    px(c, 6, 3, '#e888b0');
  });
  sprite('vh_boat', 30, 13, (c) => {
    ell(c, 15, 7, 14, 5.5, W.dark);
    ell(c, 15, 6.5, 12.5, 4.5, W.light);
    ell(c, 15, 6.8, 10.5, 3.2, W.mid);
    rect(c, 14, 3, 3, 8, W.hi);
    rect(c, 6, 6, 18, 1, shade(W.mid, -0.2));
    // the oars
    rect(c, 4, 2, 8, 1, '#c8a070');
    rect(c, 2, 1, 3, 3, '#a88050');
    rect(c, 18, 10, 9, 1, '#c8a070');
    rect(c, 26, 9, 3, 3, '#a88050');
  });
  // crops in the gardens
  sprite('vh_crop_cabbage', 10, 8, (c) => {
    ell(c, 5, 4.5, 4.5, 3.4, '#5a9a44');
    ell(c, 4.6, 4, 3, 2.3, '#8cc46a');
    ell(c, 4.4, 3.6, 1.6, 1.2, '#b8e090');
    px(c, 2, 6, '#3f7a34');
    px(c, 8, 6, '#3f7a34');
  });
  sprite('vh_crop_carrot', 8, 9, (c) => {
    for (let k = 0; k < 5; k++) rect(c, 1 + k * 1.5, 1 + (k % 2), 1, 5, k % 2 ? '#3f8a34' : '#5aa844');
    rect(c, 2, 6, 4, 2, '#e8782a');
    px(c, 3, 6, '#ffa860');
  });
  sprite('vh_crop_herb', 9, 9, (c) => {
    ell(c, 4.5, 5.5, 4, 3, '#6a8a6a');
    for (let k = 0; k < 5; k++) {
      const x = 1 + k * 1.8;
      rect(c, x, 1 + (k % 2), 1, 3, '#9a6ad8');
      px(c, x, 1 + (k % 2), '#c8a8f8');
    }
  });
}

// ------------------------------------------------------------------ things of the village
function buildProps() {
  // a street lantern on an iron post
  sprite('vh_lamp', 12, 34, (c) => {
    const iron = '#2a2a34',
      ironHi = '#4a4a5a';
    rect(c, 5, 11, 2, 21, iron);
    px(c, 5, 12, ironHi);
    rect(c, 3, 31, 6, 2, iron);
    rect(c, 4, 30, 4, 1, ironHi);
    // the lantern
    rect(c, 2, 2, 8, 9, iron);
    rect(c, 3, 3, 6, 7, '#ffd36a');
    rect(c, 3, 3, 2, 2, '#fff2c0');
    rect(c, 6, 3, 1, 7, '#c8902a');
    poly(c, [1, 2, 6, -1, 11, 2], iron);
    px(c, 6, 0, ironHi);
    rect(c, 4, 11, 4, 1, iron);
  });
  // a wooden bench
  sprite('vh_bench', 28, 15, (c) => {
    rect(c, 2, 1, 24, 3, W.light);
    rect(c, 2, 1, 24, 1, W.hi);
    rect(c, 2, 5, 24, 2, W.mid);
    rect(c, 1, 8, 26, 3, W.light);
    rect(c, 1, 8, 26, 1, W.hi);
    rect(c, 1, 11, 26, 1, W.dark);
    for (const x of [3, 23]) rect(c, x, 12, 2, 3, W.dark);
    for (const x of [3, 23]) rect(c, x, 4, 2, 4, W.dark);
  });
  // a wooden picket fence (a piece along the row, a piece down the column, a post)
  const FW = '#b39a74',
    FWD = '#7d6a4e',
    FWH = '#d2bc94';
  sprite('vh_fence_h', 16, 13, (c) => {
    rect(c, 0, 5, 16, 2, FWD);
    rect(c, 0, 9, 16, 2, FWD);
    rect(c, 0, 5, 16, 1, FW);
    for (const x of [1, 6, 11]) {
      rect(c, x, 2, 4, 10, FW);
      rect(c, x, 2, 1, 10, FWH);
      rect(c, x + 3, 2, 1, 10, FWD);
      px(c, x + 1, 1, FW);
      px(c, x + 2, 1, FW);
      px(c, x + 1, 0, FWH);
    }
  });
  sprite('vh_fence_v', 6, 20, (c) => {
    rect(c, 2, 2, 2, 18, FWD);
    for (const y of [0, 5, 10, 15]) {
      rect(c, 1, y, 4, 4, FW);
      rect(c, 1, y, 4, 1, FWH);
      rect(c, 1, y + 3, 4, 1, FWD);
    }
  });
  // the iron fence of the graveyard on a low stone base
  const IR = '#26262e',
    IRH = '#55556a';
  sprite('vh_ifence_h', 16, 18, (c) => {
    rect(c, 0, 14, 16, 4, STONE.mid);
    rect(c, 0, 14, 16, 1, STONE.hi);
    rect(c, 0, 17, 16, 1, STONE.dark);
    rect(c, 0, 5, 16, 1, IR);
    rect(c, 0, 11, 16, 1, IR);
    for (let x = 1; x < 16; x += 4) {
      rect(c, x, 2, 1, 12, IR);
      px(c, x, 3, IRH);
      poly(c, [x - 1, 3, x + 0.5, 0, x + 2, 3], IR);
    }
  });
  sprite('vh_ifence_v', 6, 22, (c) => {
    rect(c, 1, 2, 4, 20, STONE.mid);
    rect(c, 1, 2, 1, 20, STONE.hi);
    for (let y = 0; y < 20; y += 5) {
      rect(c, 2, y, 2, 4, IR);
      px(c, 2, y, IRH);
    }
  });
  // the graveyard gate: two stone pillars and an iron arch
  sprite('vh_igate', 40, 34, (c) => {
    for (const x of [1, 33]) {
      rect(c, x, 8, 6, 26, STONE.mid);
      rect(c, x, 8, 1, 26, STONE.hi);
      rect(c, x + 5, 8, 1, 26, STONE.dark);
      rect(c, x - 1, 5, 8, 3, STONE.light);
      rect(c, x - 1, 7, 8, 1, STONE.dark);
      ell(c, x + 3, 4, 2.5, 2.5, STONE.light);
      px(c, x + 2, 3, STONE.hi);
    }
    // the arch
    for (let i = 0; i <= 26; i++) {
      const x = 7 + i,
        y = 12 - Math.round(Math.sin((i / 26) * Math.PI) * 7);
      rect(c, x, y, 1, 2, IR);
      if (i % 3 === 0) rect(c, x, y + 2, 1, 4, IR);
    }
    ell(c, 20, 6, 2.5, 2.5, IR);
    px(c, 20, 6, '#c8a040');
  });
  // graves: a rounded stone, a stone cross, a wooden cross, an obelisk, a ringed cross
  const mound = (c: C) => {
    ell(c, 8, 17, 6.5, 2.5, '#5a4632');
    ell(c, 8, 16.5, 5, 1.6, '#6e5640');
  };
  sprite('vh_grave_0', 16, 20, (c) => {
    mound(c);
    rect(c, 3, 5, 10, 11, STONE.mid);
    ell(c, 8, 5, 5, 3.5, STONE.mid);
    rect(c, 3, 5, 1, 11, STONE.hi);
    rect(c, 12, 5, 1, 11, STONE.dark);
    ell(c, 7, 3.5, 2.5, 1.5, STONE.light);
    rect(c, 7, 6, 2, 6, STONE.dark);
    rect(c, 5, 8, 6, 2, STONE.dark);
    rect(c, 3, 14, 10, 2, '#5d7a3e');
  });
  sprite('vh_grave_1', 16, 22, (c) => {
    mound(c);
    rect(c, 6, 2, 4, 15, STONE.mid);
    rect(c, 2, 5, 12, 4, STONE.mid);
    rect(c, 6, 2, 1, 15, STONE.hi);
    rect(c, 2, 5, 12, 1, STONE.hi);
    rect(c, 9, 9, 1, 8, STONE.dark);
    rect(c, 2, 8, 12, 1, STONE.dark);
    px(c, 4, 16, '#5d7a3e');
    px(c, 11, 16, '#5d7a3e');
  });
  sprite('vh_grave_2', 16, 20, (c) => {
    mound(c);
    rect(c, 7, 3, 3, 14, W.light);
    rect(c, 3, 6, 11, 3, W.light);
    rect(c, 7, 3, 1, 14, W.hi);
    rect(c, 9, 9, 1, 8, W.dark);
    rect(c, 3, 8, 11, 1, W.dark);
    // a little wreath
    ell(c, 8.5, 12, 2.6, 2.6, '#3f7a34');
    ell(c, 8.5, 12, 1.3, 1.3, W.light);
    px(c, 7, 11, '#d83a3a');
    px(c, 10, 13, '#f0d040');
  });
  sprite('vh_grave_3', 14, 24, (c) => {
    ell(c, 7, 21, 6, 2.2, '#5a4632');
    rect(c, 2, 18, 10, 3, STONE.mid);
    rect(c, 2, 18, 10, 1, STONE.hi);
    poly(c, [4, 18, 10, 18, 9, 5, 5, 5], STONE.mid);
    poly(c, [5, 5, 9, 5, 7, 1], STONE.light);
    rect(c, 4, 6, 1, 12, STONE.hi);
    rect(c, 9, 6, 1, 12, STONE.dark);
    px(c, 7, 9, '#c8a040');
  });
  sprite('vh_grave_4', 16, 22, (c) => {
    mound(c);
    rect(c, 6, 3, 4, 14, STONE.mid);
    rect(c, 2, 6, 12, 3, STONE.mid);
    ell(c, 8, 7.5, 4, 4, STONE.dark);
    ell(c, 8, 7.5, 2.6, 2.6, STONE.mid);
    rect(c, 6, 3, 1, 14, STONE.hi);
    rect(c, 2, 6, 12, 1, STONE.hi);
    px(c, 8, 7, STONE.hi);
    rect(c, 5, 15, 6, 2, '#5d7a3e');
  });
  // the crypt of the founders of Loppo
  sprite('vh_crypt', 40, 44, (c) => {
    // steps
    rect(c, 6, 39, 28, 4, STONE.mid);
    rect(c, 6, 39, 28, 1, STONE.hi);
    rect(c, 8, 37, 24, 2, STONE.light);
    // walls and columns
    rect(c, 5, 16, 30, 21, STONE.mid);
    for (let y = 18; y < 37; y += 4) rect(c, 5, y, 30, 1, STONE.dark);
    for (const x of [5, 30]) {
      rect(c, x, 14, 5, 23, STONE.light);
      rect(c, x, 14, 1, 23, STONE.hi);
      rect(c, x + 4, 14, 1, 23, STONE.dark);
    }
    // the pediment
    poly(c, [2, 15, 20, 3, 38, 15], STONE.light);
    poly(c, [6, 14, 20, 6, 34, 14], STONE.mid);
    rect(c, 2, 14, 36, 2, STONE.dark);
    rect(c, 2, 13, 36, 1, STONE.hi);
    ell(c, 20, 10, 2.5, 2, '#c8a040');
    // the iron door
    rect(c, 14, 21, 12, 16, '#141018');
    ell(c, 20, 21, 6, 4, '#141018');
    for (let x = 15; x < 26; x += 3) rect(c, x, 19, 1, 18, '#3a3a48');
    rect(c, 14, 28, 12, 1, '#3a3a48');
    // moss
    for (let k = 0; k < 16; k++) px(c, 5 + Math.floor(hash(k, 1, 81) * 30), 30 + Math.floor(hash(1, k, 81) * 7), k % 2 ? '#4f7a38' : '#6a9a48');
  });
  // a market stall with an awning
  const stall = (key: string, cloth: [string, string], goods: (c: C) => void) =>
    sprite(key, 44, 36, (c) => {
      for (const x of [3, 39]) rect(c, x, 8, 2, 26, W.dark);
      // the counter
      rect(c, 2, 22, 40, 10, W.light);
      rect(c, 2, 22, 40, 2, W.hi);
      rect(c, 2, 31, 40, 1, W.dark);
      for (let x = 6; x < 40; x += 6) rect(c, x, 24, 1, 7, W.mid);
      goods(c);
      // the awning with a scalloped edge
      for (let x = 0; x < 44; x++)
        for (let y = 2; y < 11; y++) {
          const stripe = Math.floor(x / 4) % 2;
          px(c, x, y, y < 4 ? shade(stripe ? cloth[0] : cloth[1], 0.15) : stripe ? cloth[0] : cloth[1]);
        }
      for (let x = 0; x < 44; x++) if (x % 4 !== 3) px(c, x, 11, Math.floor(x / 4) % 2 ? cloth[0] : cloth[1]);
      rect(c, 0, 1, 44, 1, shade(cloth[1], -0.3));
    });
  stall('vh_stall_veg', ['#3f8a4a', '#eeeadc'], (c) => {
    for (const [x, col, dot] of [
      [5, '#7a5a34', '#e8782a'],
      [15, '#7a5a34', '#5aa844'],
      [25, '#7a5a34', '#d8383a'],
      [33, '#7a5a34', '#f0d040'],
    ] as [number, string, string][]) {
      rect(c, x, 16, 8, 6, col);
      rect(c, x, 16, 8, 1, shade(col, 0.2));
      for (let k = 0; k < 6; k++) rect(c, x + 1 + (k % 3) * 2, 14 + Math.floor(k / 3) * 2, 2, 2, dot);
    }
  });
  stall('vh_stall_cloth', ['#b8323a', '#eeeadc'], (c) => {
    for (const [x, col] of [
      [5, '#4a6ab8'],
      [12, '#d8a83a'],
      [19, '#8a3ab8'],
      [26, '#3a9a6a'],
      [33, '#d85a8a'],
    ] as [number, string][]) {
      rect(c, x, 14, 6, 8, col);
      rect(c, x, 14, 6, 2, shade(col, 0.25));
      rect(c, x + 5, 14, 1, 8, shade(col, -0.3));
    }
  });
  // a woodpile, hay, a cart
  sprite('vh_woodpile', 30, 17, (c) => {
    const log = (x: number, y: number) => {
      ell(c, x, y, 3.2, 3.2, W.dark);
      ell(c, x, y, 2.4, 2.4, '#c89a64');
      px(c, x, y, '#9a6a3a');
      px(c, x - 1, y - 1, '#e0b884');
    };
    rect(c, 2, 8, 26, 8, W.mid);
    for (let i = 0; i < 5; i++) log(5 + i * 5, 13);
    for (let i = 0; i < 4; i++) log(7.5 + i * 5, 8);
    for (let i = 0; i < 2; i++) log(12.5 + i * 5, 3.5);
  });
  sprite('vh_hay', 24, 17, (c) => {
    ell(c, 12, 10, 11, 7, '#a8822e');
    ell(c, 11, 9, 9.5, 6, '#d2aa48');
    ell(c, 10, 7, 6, 3.5, '#ead070');
    for (let k = 0; k < 26; k++) {
      const x = 3 + Math.floor(hash(k, 1, 91) * 18),
        y = 4 + Math.floor(hash(1, k, 91) * 11);
      rect(c, x, y, 2, 1, k % 2 ? '#b89038' : '#f4dc84');
    }
  });
  sprite('vh_cart', 34, 22, (c) => {
    rect(c, 4, 6, 24, 9, W.light);
    rect(c, 4, 6, 24, 2, W.hi);
    rect(c, 4, 14, 24, 1, W.dark);
    for (let x = 8; x < 28; x += 6) rect(c, x, 8, 1, 6, W.mid);
    rect(c, 26, 11, 8, 2, W.mid);
    // a load of sacks
    ell(c, 11, 5, 5, 3.5, '#d8c8a0');
    ell(c, 19, 4.5, 4.5, 3, '#c8b890');
    px(c, 10, 3, '#f0e4c4');
    for (const x of [9, 23]) {
      ell(c, x, 16, 5, 5, W.dark);
      ell(c, x, 16, 3.6, 3.6, W.mid);
      ell(c, x, 16, 1.2, 1.2, '#3a3a44');
      for (const [dx, dy] of [
        [0, -3],
        [3, 0],
        [0, 3],
        [-3, 0],
      ])
        px(c, x + dx, 16 + dy, W.dark);
    }
  });
  // an archery target and a training dummy
  sprite('vh_target', 16, 24, (c) => {
    for (const [x0, x1] of [
      [3, 1],
      [12, 14],
    ])
      for (let i = 0; i < 12; i++) px(c, Math.round(x0 + ((x1 - x0) * i) / 12), 11 + i, W.dark);
    rect(c, 7, 12, 2, 11, W.mid);
    ell(c, 8, 9, 7, 7, '#d2aa48');
    ell(c, 8, 9, 5.5, 5.5, '#eeeadc');
    ell(c, 8, 9, 4, 4, '#c8323a');
    ell(c, 8, 9, 2.4, 2.4, '#eeeadc');
    ell(c, 8, 9, 1.2, 1.2, '#f0c030');
    // an arrow in it
    rect(c, 9, 7, 5, 1, '#c8a070');
    px(c, 14, 6, '#eeeadc');
    px(c, 14, 8, '#eeeadc');
  });
  sprite('vh_dummy', 14, 24, (c) => {
    rect(c, 6, 8, 2, 16, W.mid);
    rect(c, 1, 11, 12, 2, W.mid);
    ell(c, 7, 15, 4, 5, '#d8b860');
    ell(c, 6.5, 14, 2.6, 3.4, '#ead080');
    rect(c, 3, 17, 8, 1, '#8a6a30');
    ell(c, 7, 6, 3.4, 3.4, '#c8a878');
    px(c, 6, 6, '#2a1e14');
    px(c, 8, 6, '#2a1e14');
    rect(c, 6, 2, 3, 1, '#8a6a30');
  });
  // signposts
  const board = (c: C, x: number, y: number, dir: 1 | -1) => {
    const w = 12;
    const x0 = dir > 0 ? x : x - w;
    rect(c, x0, y, w, 5, W.light);
    rect(c, x0, y, w, 1, W.hi);
    rect(c, x0, y + 4, w, 1, W.dark);
    poly(c, dir > 0 ? [x0 + w, y, x0 + w + 3, y + 2.5, x0 + w, y + 5] : [x0, y, x0 - 3, y + 2.5, x0, y + 5], W.light);
    for (let i = 2; i < w - 2; i += 2) px(c, x0 + i, y + 2, '#3a2416');
  };
  sprite('vh_sign_cross', 32, 28, (c) => {
    rect(c, 15, 4, 2, 23, W.mid);
    rect(c, 15, 4, 1, 23, W.hi);
    board(c, 17, 5, 1);
    board(c, 15, 12, -1);
  });
  sprite('vh_sign_road', 22, 26, (c) => {
    rect(c, 9, 4, 2, 21, W.mid);
    rect(c, 9, 4, 1, 21, W.hi);
    board(c, 11, 6, 1);
  });
  // the closed gate in the palisade on the south road
  sprite('vh_gate', 58, 36, (c) => {
    const logW = (x: number, top: number) => {
      rect(c, x, top, 5, 36 - top, W.mid);
      rect(c, x, top, 1, 36 - top, W.hi);
      rect(c, x + 4, top, 1, 36 - top, W.dark);
      poly(c, [x, top, x + 2.5, top - 4, x + 5, top], W.light);
    };
    logW(0, 5);
    logW(53, 5);
    for (let x = 6; x < 52; x += 5) logW(x, 9 + (Math.floor(x / 5) % 2));
    rect(c, 6, 14, 46, 3, W.dark);
    rect(c, 6, 27, 46, 3, W.dark);
    for (let i = 0; i < 13; i++) {
      rect(c, 8 + i * 1.6, 28 - i, 3, 2, W.dark);
      rect(c, 48 - i * 1.6, 28 - i, 3, 2, W.dark);
    }
    rect(c, 28, 10, 2, 26, '#26262e');
  });
  // the fountain in the courtyard (the water jets move)
  creatureStrip(
    'vh_fountain',
    48,
    40,
    2,
    (c, f) => {
      ell(c, 24, 30, 22, 9, STONE.dark);
      ell(c, 24, 29, 21, 8, STONE.light);
      ell(c, 24, 29.5, 18, 6.2, '#3f7a9a');
      ell(c, 22, 28.5, 14, 4.2, '#5a9ab8');
      rect(c, 21, 14, 6, 15, STONE.mid);
      rect(c, 21, 14, 1, 15, STONE.hi);
      ell(c, 24, 14, 8, 3, STONE.light);
      ell(c, 24, 13.6, 6.5, 2, '#5a9ab8');
      rect(c, 23, 5, 2, 9, STONE.mid);
      ell(c, 24, 5, 2.6, 2.6, STONE.hi);
      // jets and drops
      const jet = '#cfefff';
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const dy = Math.round(-4 + t * t * 14) + (f ? 1 : 0);
        px(c, 24 - 3 - i * 1.4, 10 + dy, jet);
        px(c, 24 + 3 + i * 1.4, 10 + dy + (f ? -1 : 0), jet);
      }
      px(c, 24, 2 + f, jet);
      px(c, 24, 1, jet);
      for (const x of [12, 18, 30, 36]) px(c, x + f, 27 + ((x + f) % 3), '#e8f8ff');
    },
    true,
  );
  // the well of the square
  sprite('vh_well', 28, 32, (c) => {
    rect(c, 4, 3, 2, 18, W.dark);
    rect(c, 22, 3, 2, 18, W.dark);
    // a little shingled roof
    for (let y = 0; y < 6; y++) for (let x = 1 + Math.floor(y / 2); x < 27 - Math.floor(y / 2); x++) px(c, x, 5 - y, y === 5 ? '#c4553a' : (x + y) % 4 === 0 ? '#7e2e22' : '#a8402e');
    rect(c, 6, 9, 16, 1, W.light);
    rect(c, 13, 10, 1, 6, '#c8a070');
    rect(c, 11, 15, 4, 3, W.mid);
    rect(c, 11, 15, 4, 1, W.hi);
    ell(c, 14, 24, 13, 6.5, STONE.dark);
    ell(c, 14, 23, 13, 5.5, STONE.light);
    ell(c, 14, 23, 10, 3.6, '#1a2a4a');
    ell(c, 12, 22.5, 3.2, 1.2, '#3a5a8a');
    for (let x = 2; x < 27; x += 4) px(c, x, 26, STONE.mid);
  });
  // the notice board by the hunters' lodge
  sprite('vh_board', 20, 24, (c) => {
    rect(c, 2, 5, 2, 19, W.dark);
    rect(c, 16, 5, 2, 19, W.dark);
    rect(c, 0, 3, 20, 13, W.mid);
    rect(c, 1, 4, 18, 11, '#a07040');
    poly(c, [-1, 3, 10, -1, 21, 3], W.dark);
    for (const [x, y, w, h] of [
      [2, 5, 5, 6],
      [8, 5, 4, 4],
      [13, 6, 4, 7],
      [8, 10, 4, 4],
    ])
      rect(c, x, y, w, h, '#eee0b8');
    for (const [x, y] of [
      [3, 7],
      [3, 9],
      [9, 7],
      [14, 9],
      [9, 12],
    ])
      rect(c, x, y, 3, 1, '#8a7a5a');
    px(c, 4, 5, '#c83a3a');
    px(c, 10, 5, '#c83a3a');
    px(c, 15, 6, '#3a6ac8');
  });
  // what the prosperity of Loppo adds to the village (see data/fountain.ts): flower beds, banners on poles, the
  // pedestal of the hero's statue
  sprite('vh_flowers', 22, 12, (c) => {
    ell(c, 11, 7, 10, 4.5, '#3e2818');
    ell(c, 11, 6.6, 9, 3.8, '#5a3a24');
    for (const [x, y] of [
      [3, 6],
      [6, 4],
      [9, 7],
      [12, 4],
      [15, 6],
      [17, 8],
      [5, 8],
      [13, 8],
      [10, 3],
      [18, 5],
    ]) {
      rect(c, x, y, 2, 1, '#3a7a2a');
      px(c, x, y - 1, '#5aa83a');
    }
    const cols = ['#ff5a6a', '#ffd23a', '#c86aff', '#fff6e8', '#ff9a3a', '#6ac8ff'];
    [
      [4, 5],
      [7, 3],
      [10, 6],
      [13, 3],
      [16, 5],
      [6, 7],
      [14, 7],
      [11, 2],
      [18, 6],
      [9, 4],
    ].forEach(([x, y], i) => {
      px(c, x, y, cols[i % cols.length]);
      px(c, x + 1, y, cols[i % cols.length]);
      px(c, x, y + 1, cols[(i + 3) % cols.length]);
    });
  });
  for (const [k, col, light, dark] of [
    ['red', '#c83a3a', '#e86a5a', '#8a2424'],
    ['blue', '#3a6ac8', '#6a9ae8', '#24448a'],
    ['gold', '#e8b030', '#ffd870', '#a87a18'],
  ] as const)
    sprite('vh_flag_' + k, 13, 32, (c) => {
      rect(c, 2, 3, 2, 29, W.mid);
      rect(c, 2, 3, 1, 29, W.hi);
      rect(c, 1, 0, 4, 3, '#ffd23a');
      px(c, 1, 0, '#fff2b0');
      rect(c, 1, 30, 4, 2, W.dark);
      // the banner and its swallowtail
      rect(c, 4, 4, 8, 12, col);
      rect(c, 4, 4, 8, 1, light);
      rect(c, 11, 4, 1, 12, dark);
      for (let i = 0; i < 3; i++) {
        px(c, 4 + i, 16 + i, col);
        px(c, 11 - i, 16 + i, i === 0 ? dark : col);
      }
      // Loppo's tower on it
      rect(c, 7, 7, 2, 5, '#f4ead0');
      px(c, 6, 7, '#f4ead0');
      px(c, 9, 7, '#f4ead0');
      px(c, 7, 9, dark);
    });
  sprite('vh_pedestal', 24, 16, (c) => {
    rect(c, 1, 11, 22, 5, STONE.mid);
    rect(c, 1, 11, 22, 1, STONE.hi);
    rect(c, 3, 3, 18, 9, STONE.light);
    rect(c, 3, 3, 18, 1, STONE.hi);
    rect(c, 20, 3, 1, 9, STONE.dark);
    rect(c, 1, 15, 22, 1, STONE.dark);
    // the golden plaque
    rect(c, 8, 6, 8, 4, '#c8961e');
    rect(c, 8, 6, 8, 1, '#ffd870');
    rect(c, 9, 8, 6, 1, '#8a6a14');
  });
  // crates and barrels of the village
  sprite('vh_barrel', 12, 15, (c) => {
    ell(c, 6, 12, 5.5, 2.5, W.dark);
    rect(c, 1, 3, 10, 9, W.light);
    rect(c, 1, 3, 2, 9, W.hi);
    rect(c, 9, 3, 2, 9, W.mid);
    rect(c, 1, 5, 10, 1, '#3a3a44');
    rect(c, 1, 10, 10, 1, '#3a3a44');
    ell(c, 6, 3, 5, 2, '#c89a64');
    ell(c, 6, 3, 3.5, 1.2, '#a87a48');
  });
  sprite('vh_crate', 14, 14, (c) => {
    rect(c, 1, 3, 12, 10, W.light);
    rect(c, 1, 1, 12, 3, W.hi);
    rect(c, 1, 3, 12, 1, W.dark);
    rect(c, 1, 12, 12, 1, W.dark);
    for (let i = 0; i < 9; i++) px(c, 2 + i, 4 + i, W.mid);
    rect(c, 1, 3, 1, 10, W.dark);
    rect(c, 12, 3, 1, 10, W.dark);
  });
}

// ------------------------------------------------------------------ houses
const PLASTER = '#ece0c4',
  PLASTER_D = '#cfbf9c',
  TIMBER = '#4e3220';

/** a shingled roof over a front wall: rows of tiles, a lit ridge, slanted sides, a dark eave */
function roof(c: C, x0: number, y0: number, w: number, h: number, col: string, kind: 'tile' | 'slate' | 'thatch' | 'moss' = 'tile') {
  for (let y = 0; y < h; y++) {
    const inset = Math.max(0, Math.floor((h - 1 - y) / 4));
    for (let x = inset; x < w - inset; x++) {
      const row = Math.floor(y / 3);
      let k = 0;
      if (kind === 'thatch') {
        k = (hash(x, Math.floor(y / 2), 5) - 0.5) * 0.3 + (y % 4 === 3 ? -0.18 : 0);
      } else {
        const seam = y % 3 === 2 || (x + (row % 2) * (kind === 'slate' ? 3 : 2)) % (kind === 'slate' ? 6 : 4) === 0;
        k = seam ? -0.22 : (hash(x, y, 7) - 0.5) * 0.06;
        if (kind === 'moss' && hash(x >> 1, y >> 1, 9) < 0.18) k += 0.2;
      }
      if (y < 2) k = 0.2;
      if (y >= h - 2) k = -0.36;
      if (x === inset || x === w - inset - 1) k -= 0.2;
      px(c, x0 + x, y0 + y, shade(col, k));
    }
  }
  if (kind === 'moss') for (let k = 0; k < (w * h) / 40; k++) px(c, x0 + 2 + Math.floor(hash(k, w, 3) * (w - 4)), y0 + 2 + Math.floor(hash(h, k, 4) * (h - 5)), '#7aaa3c');
}

function plaster(c: C, x0: number, y0: number, w: number, h: number, col = PLASTER) {
  rect(c, x0, y0, w, h, col);
  for (let k = 0; k < (w * h) / 16; k++) px(c, x0 + Math.floor(hash(k, x0, 3) * w), y0 + Math.floor(hash(y0, k, 4) * h), shade(col, -0.07));
}

function timber(c: C, x0: number, y0: number, w: number, h: number, posts: number[]) {
  rect(c, x0, y0, w, 2, TIMBER);
  rect(c, x0, y0 + h - 2, w, 2, TIMBER);
  for (const x of posts) rect(c, x0 + x, y0, 2, h, TIMBER);
}

function stones(c: C, x0: number, y0: number, w: number, h: number, pal = STONE) {
  rect(c, x0, y0, w, h, pal.dark);
  for (let r = 0; r * 5 < h; r++)
    for (let k = -1; k * 8 < w + 8; k++) {
      const sw = 6 + Math.floor(hash(k, r, x0) * 3);
      const x = x0 + k * 8 + (r % 2 ? 4 : 0),
        y = y0 + r * 5;
      for (let yy = 0; yy < 4 && y + yy < y0 + h; yy++)
        for (let xx = 0; xx < sw; xx++) {
          const X = x + xx;
          if (X < x0 || X >= x0 + w) continue;
          px(c, X, y + yy, yy === 0 ? pal.hi : xx === sw - 1 || yy === 3 ? shade(pal.mid, -0.12) : shade(pal.mid, (hash(X, y + yy, 9) - 0.5) * 0.1));
        }
    }
}

function logs(c: C, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y += 4) {
    rect(c, x0, y, w, 4, y % 8 ? '#7a5232' : '#6a4628');
    rect(c, x0, y, w, 1, '#94683e');
    rect(c, x0, y + 3, w, 1, '#3e2816');
    ell(c, x0, y + 2, 1.6, 1.8, '#c8a070');
    ell(c, x0 + w - 1, y + 2, 1.6, 1.8, '#c8a070');
  }
}

function planks(c: C, x0: number, y0: number, w: number, h: number, col: string) {
  rect(c, x0, y0, w, h, col);
  for (let x = x0; x < x0 + w; x += 4) {
    rect(c, x, y0, 1, h, shade(col, -0.25));
    rect(c, x + 1, y0, 1, h, shade(col, 0.1));
  }
}

/** a window with a frame, panes, and maybe shutters and a flower box; remembered for the night glow */
function win(c: C, key: string, x: number, y: number, w: number, h: number, o: { shutter?: string; box?: boolean; arch?: boolean; glass?: string } = {}) {
  if (o.shutter) {
    rect(c, x - 3, y, 3, h, o.shutter);
    rect(c, x + w, y, 3, h, o.shutter);
    rect(c, x - 3, y, 3, 1, shade(o.shutter, 0.25));
    rect(c, x + w, y, 3, 1, shade(o.shutter, 0.25));
    for (let i = 2; i < h; i += 3) {
      rect(c, x - 3, y + i, 3, 1, shade(o.shutter, -0.3));
      rect(c, x + w, y + i, 3, 1, shade(o.shutter, -0.3));
    }
  }
  rect(c, x - 1, y - 1, w + 2, h + 2, TIMBER);
  rect(c, x, y, w, h, o.glass ?? GLASS);
  if (o.arch) ell(c, x + w / 2, y, w / 2 + 1, 3, TIMBER), ell(c, x + w / 2, y, w / 2 - 0.5, 2, o.glass ?? GLASS);
  rect(c, x, y, 2, 2, GLASS_HI);
  rect(c, x + Math.floor(w / 2), y, 1, h, TIMBER);
  rect(c, x, y + Math.floor(h / 2), w, 1, TIMBER);
  if (o.box) {
    rect(c, x - 2, y + h + 1, w + 4, 3, '#6a4426');
    rect(c, x - 2, y + h + 1, w + 4, 1, '#8a5a32');
    for (let i = 0; i < w + 4; i += 2) px(c, x - 2 + i, y + h, i % 4 ? '#e8463a' : '#f2c53a');
    for (let i = 1; i < w + 4; i += 2) px(c, x - 2 + i, y + h, '#4f8a38');
  }
  (VILLAGE_WINDOWS[key] ??= []).push([x + 1, y + 1, w, h]);
}

function door(c: C, x: number, y: number, w: number, h: number, col = '#6a4426', arch = true) {
  rect(c, x - 1, y - 1, w + 2, h + 1, TIMBER);
  if (arch) ell(c, x + w / 2, y, w / 2 + 1, 3, TIMBER);
  rect(c, x, y, w, h, col);
  if (arch) ell(c, x + w / 2, y, w / 2, 2.2, col);
  for (let i = 2; i < w; i += 3) rect(c, x + i, y - 1, 1, h + 1, shade(col, -0.22));
  rect(c, x, y, 1, h, shade(col, 0.18));
  px(c, x + w - 2, y + Math.floor(h / 2), '#e9b949');
  // a step stone
  rect(c, x - 2, y + h, w + 4, 2, STONE.light);
  rect(c, x - 2, y + h + 1, w + 4, 1, STONE.mid);
}

function chimney(c: C, key: string, x: number, y: number, w: number, h: number) {
  rect(c, x, y, w, h, STONE.mid);
  rect(c, x, y, 1, h, STONE.hi);
  rect(c, x + w - 1, y, 1, h, STONE.dark);
  for (let yy = y + 3; yy < y + h; yy += 3) rect(c, x, yy, w, 1, STONE.dark);
  rect(c, x - 1, y, w + 2, 2, STONE.light);
  rect(c, x + 1, y, w - 2, 1, '#1a1418');
  (VILLAGE_CHIMNEYS[key] ??= []).push([x + w / 2, y - 1]);
}

function foundation(c: C, x: number, y: number, w: number) {
  rect(c, x, y, w, 4, STONE.dark);
  for (let k = 0; k < w; k += 5) {
    rect(c, x + k, y, 4, 3, STONE.mid);
    px(c, x + k, y, STONE.hi);
  }
}

/** a hanging sign on a bracket with a little picture */
function hangSign(c: C, x: number, y: number, col: string, mark: (c: C, x: number, y: number) => void) {
  rect(c, x - 2, y - 2, 8, 1, '#2a2a34');
  rect(c, x, y - 1, 1, 2, '#2a2a34');
  rect(c, x + 4, y - 1, 1, 2, '#2a2a34');
  rect(c, x - 2, y + 1, 9, 8, W.dark);
  rect(c, x - 1, y + 2, 7, 6, col);
  mark(c, x - 1, y + 2);
}

function houseKey(c: C, key: string, w: number, h: number) {
  void c;
  VILLAGE_WINDOWS[key] = [];
  VILLAGE_CHIMNEYS[key] = [];
  void w;
  void h;
}

function buildHouses() {
  const house = (key: string, w: number, h: number, draw: (c: C) => void) =>
    sprite(key, w, h, (c) => {
      houseKey(c, key, w, h);
      draw(c);
    });

  // ---- the hero's own house: a cottage, a house, a farmstead
  house('vh_home_1', 56, 50, (c) => {
    chimney(c, 'vh_home_1', 39, 4, 5, 12);
    roof(c, 1, 8, 54, 18, '#c8a050', 'thatch');
    planks(c, 5, 26, 46, 19, '#8a6038');
    rect(c, 5, 26, 46, 2, '#3e2716');
    door(c, 25, 32, 9, 13);
    win(c, 'vh_home_1', 10, 31, 7, 7, { shutter: '#5a7a3a' });
    win(c, 'vh_home_1', 41, 31, 6, 6);
    foundation(c, 4, 45, 48);
  });
  house('vh_home_2', 64, 56, (c) => {
    chimney(c, 'vh_home_2', 45, 3, 6, 14);
    roof(c, 1, 9, 62, 20, '#b8483a', 'tile');
    plaster(c, 5, 29, 54, 22);
    timber(c, 5, 29, 54, 22, [0, 18, 34, 52]);
    door(c, 26, 35, 10, 16, '#7a3a2a');
    win(c, 'vh_home_2', 10, 35, 7, 7, { box: true, shutter: '#3a6a9a' });
    win(c, 'vh_home_2', 44, 35, 7, 7, { box: true, shutter: '#3a6a9a' });
    // a lantern by the door
    rect(c, 38, 36, 3, 4, '#2a2a34');
    px(c, 39, 37, LIT);
    foundation(c, 4, 51, 56);
  });
  house('vh_home_3', 72, 64, (c) => {
    chimney(c, 'vh_home_3', 54, 2, 6, 16);
    chimney(c, 'vh_home_3', 9, 6, 5, 12);
    roof(c, 1, 9, 70, 22, '#9a3a30', 'tile');
    // dormer windows in the roof
    for (const x of [18, 46]) {
      rect(c, x - 1, 14, 10, 9, '#7e2e22');
      rect(c, x, 15, 8, 8, PLASTER);
      win(c, 'vh_home_3', x + 1, 16, 6, 5);
      poly(c, [x - 2, 15, x + 4, 10, x + 10, 15], '#b8483a');
    }
    // the upper floor in timber, the ground floor in stone
    plaster(c, 5, 31, 62, 12);
    timber(c, 5, 31, 62, 12, [0, 14, 30, 46, 60]);
    stones(c, 5, 43, 62, 16);
    door(c, 30, 45, 12, 14, '#5a2a1a');
    win(c, 'vh_home_3', 11, 34, 7, 6, { box: true });
    win(c, 'vh_home_3', 54, 34, 7, 6, { box: true });
    win(c, 'vh_home_3', 11, 47, 8, 7, { shutter: '#2a5a8a' });
    win(c, 'vh_home_3', 53, 47, 8, 7, { shutter: '#2a5a8a' });
    // the family emblem over the door
    ell(c, 36, 39, 3.5, 3.5, '#e9b949');
    ell(c, 36, 39, 2.2, 2.2, '#3a6a9a');
    foundation(c, 4, 59, 64);
  });

  // ---- the smithy of Bořek: stone, a slate roof, the forge glowing through the wide door
  house('vh_house_smithy', 64, 62, (c) => {
    chimney(c, 'vh_house_smithy', 44, 0, 8, 18);
    roof(c, 1, 12, 62, 20, '#4a4e5e', 'slate');
    stones(c, 5, 32, 54, 26);
    // the open forge
    rect(c, 22, 38, 20, 20, '#1a1214');
    ell(c, 32, 38, 10, 4, '#1a1214');
    rect(c, 24, 46, 16, 12, '#ff7a2a');
    rect(c, 26, 48, 12, 8, '#ffb347');
    rect(c, 29, 50, 6, 5, '#fff0a0');
    rect(c, 22, 38, 1, 20, '#5a4a40');
    win(c, 'vh_house_smithy', 9, 40, 7, 7, { glass: '#ffb060' });
    win(c, 'vh_house_smithy', 48, 40, 7, 7, { glass: '#ffb060' });
    (VILLAGE_WINDOWS.vh_house_smithy ??= []).push([24, 46, 16, 12]);
    hangSign(c, 45, 33, '#c86a2a', (c, x, y) => {
      rect(c, x + 1, y + 1, 5, 2, '#2a2a34');
      rect(c, x + 3, y + 3, 1, 2, '#2a2a34');
    });
    foundation(c, 4, 58, 56);
  });
  // ---- the shop of Šárka: plaster and timber, a blue roof, an awning over the shop window
  house('vh_house_shop', 64, 60, (c) => {
    chimney(c, 'vh_house_shop', 10, 4, 5, 12);
    roof(c, 1, 9, 62, 20, '#3a64a8', 'tile');
    plaster(c, 5, 29, 54, 26);
    timber(c, 5, 29, 54, 26, [0, 20, 52]);
    door(c, 11, 38, 9, 17);
    win(c, 'vh_house_shop', 30, 37, 22, 10, {});
    // goods behind the glass
    for (let i = 0; i < 6; i++) rect(c, 32 + i * 3, 43, 2, 3, ['#e8463a', '#f2c53a', '#4a8ad8', '#5aa844', '#d87ab0', '#e9b949'][i]);
    // the striped awning
    for (let x = 27; x < 57; x++) for (let y = 31; y < 36; y++) px(c, x, y, Math.floor((x - 27) / 3) % 2 ? '#eeeadc' : '#c8323a');
    for (let x = 27; x < 57; x += 3) px(c, x + 1, 36, '#c8323a');
    hangSign(c, 22, 30, '#e9b949', (c, x, y) => {
      ell(c, x + 3.5, y + 3, 2.5, 2.2, '#8a6a2a');
      px(c, x + 3, y + 2, '#fff2b0');
    });
    foundation(c, 4, 55, 56);
  });
  // ---- the hunters' lodge of Jitka: logs, a mossy roof, antlers and pelts
  house('vh_house_board', 60, 58, (c) => {
    roof(c, 1, 8, 58, 20, '#4a6a2a', 'moss');
    logs(c, 5, 28, 50, 25);
    door(c, 25, 36, 10, 17, '#5a3a22');
    win(c, 'vh_house_board', 10, 35, 7, 7, { shutter: '#7a5232' });
    win(c, 'vh_house_board', 43, 35, 7, 7, { shutter: '#7a5232' });
    // antlers over the door
    for (const [x, y] of [
      [24, 30],
      [25, 29],
      [26, 30],
      [33, 30],
      [34, 29],
      [35, 30],
      [27, 31],
      [28, 31],
      [29, 31],
      [30, 31],
      [31, 31],
      [32, 31],
      [23, 28],
      [36, 28],
    ])
      px(c, x, y, '#ece0c4');
    // a pelt drying by the wall
    ell(c, 52, 42, 3, 5, '#8a5a32');
    ell(c, 52, 41, 2, 3, '#a87a48');
    foundation(c, 4, 53, 52);
  });
  // ---- the laboratory of Vanda: a teal roof, green light, a round window, herbs drying
  house('vh_house_lab', 60, 58, (c) => {
    chimney(c, 'vh_house_lab', 40, 1, 6, 15);
    roof(c, 1, 8, 58, 20, '#2a7a72', 'tile');
    plaster(c, 5, 28, 50, 25, '#e4e8d8');
    timber(c, 5, 28, 50, 25, [0, 24, 48]);
    door(c, 25, 35, 10, 18, '#3a5a4a');
    win(c, 'vh_house_lab', 10, 34, 8, 8, { glass: '#3a9a6a', box: true });
    win(c, 'vh_house_lab', 42, 34, 8, 8, { glass: '#3a9a6a', box: true });
    ell(c, 30, 23, 4, 4, TIMBER);
    ell(c, 30, 23, 3, 3, '#9a5ad8');
    px(c, 29, 22, '#e0c8ff');
    (VILLAGE_WINDOWS.vh_house_lab ??= []).push([27, 20, 6, 6]);
    // herbs hanging under the eave
    for (const x of [8, 13, 47, 52]) {
      rect(c, x, 28, 1, 3, '#3a2416');
      ell(c, x, 32, 1.6, 2, x % 2 ? '#6a9a48' : '#9a6ad8');
    }
    foundation(c, 4, 53, 52);
  });
  // ---- the mage's tower of Ignác: round stone, a blue cone with a star
  house('vh_house_tower', 38, 86, (c) => {
    stones(c, 6, 28, 26, 54);
    for (let y = 28; y < 82; y++) {
      px(c, 6, y, shade(STONE.dark, -0.25));
      px(c, 7, y, shade(STONE.mid, -0.2));
      px(c, 31, y, shade(STONE.dark, -0.3));
      px(c, 30, y, shade(STONE.mid, -0.22));
    }
    // a balcony ring
    rect(c, 3, 46, 32, 3, STONE.light);
    rect(c, 3, 48, 32, 1, STONE.dark);
    for (let x = 4; x < 34; x += 3) rect(c, x, 43, 1, 3, '#3a3a48');
    rect(c, 3, 42, 32, 1, '#3a3a48');
    // the cone roof
    for (let y = 0; y < 30; y++) {
      const half = Math.round(1 + (y * 17) / 29);
      for (let x = 19 - half; x <= 18 + half; x++) px(c, x, y, x < 19 ? (y % 4 === 3 ? '#243e86' : '#2c4ca0') : y % 4 === 3 ? '#18306a' : '#203a80');
    }
    rect(c, 1, 29, 36, 2, '#14285a');
    for (const [x, y] of [
      [14, 12],
      [22, 18],
      [16, 22],
      [19, 7],
    ])
      px(c, x, y, '#ffe45c');
    rect(c, 18, -1, 2, 2, '#ffe45c');
    px(c, 18, -2, '#fff6b0');
    win(c, 'vh_house_tower', 16, 34, 6, 8, { arch: true, glass: '#7a4ac8' });
    win(c, 'vh_house_tower', 10, 54, 5, 7, { arch: true, glass: '#7a4ac8' });
    win(c, 'vh_house_tower', 23, 54, 5, 7, { arch: true, glass: '#7a4ac8' });
    door(c, 15, 68, 8, 14, '#3a2a5a');
    foundation(c, 5, 82, 28);
  });
  // ---- the training ground of Radovan: an open shed with weapon racks and shields
  house('vh_house_trainer', 70, 50, (c) => {
    roof(c, 1, 2, 68, 16, '#a8302a', 'tile');
    rect(c, 5, 18, 60, 28, '#5a3a22');
    rect(c, 8, 20, 54, 26, '#2e2018');
    for (const x of [5, 33, 63]) {
      rect(c, x, 18, 3, 28, W.light);
      rect(c, x, 18, 1, 28, W.hi);
    }
    // racks of weapons
    rect(c, 10, 28, 20, 2, W.light);
    rect(c, 38, 28, 22, 2, W.light);
    for (const [x, col] of [
      [12, '#d4dae2'],
      [16, '#d4dae2'],
      [20, '#9aa0aa'],
      [25, '#c8a070'],
      [40, '#d4dae2'],
      [45, '#c8a070'],
      [50, '#d4dae2'],
      [55, '#9aa0aa'],
    ] as [number, string][]) {
      rect(c, x, 22, 1, 16, col);
      px(c, x - 1, 30, '#e9b949');
      px(c, x + 1, 30, '#e9b949');
    }
    // shields on the posts
    for (const [x, col] of [
      [34.5, '#3a64a8'],
      [6.5, '#c8323a'],
      [64.5, '#3a9a6a'],
    ] as [number, string][]) {
      ell(c, x, 34, 4, 5, '#3a3a44');
      ell(c, x, 34, 3, 4, col);
      rect(c, x - 0.5, 31, 1, 6, '#e9b949');
    }
    rect(c, 5, 46, 60, 3, STONE.mid);
    rect(c, 5, 46, 60, 1, STONE.hi);
  });
  // ---- the chapel of Bohdana by the graveyard: white walls, a bell tower, a rose window
  house('vh_house_temple', 64, 84, (c) => {
    // the bell tower
    rect(c, 25, 14, 14, 30, '#eeeadf');
    rect(c, 25, 14, 1, 30, '#ffffff');
    rect(c, 38, 14, 1, 30, '#c8c4b8');
    rect(c, 28, 19, 8, 9, '#2a2a36');
    ell(c, 32, 19, 4, 3, '#2a2a36');
    ell(c, 32, 24, 2.5, 2.5, '#d8a830');
    px(c, 31, 23, '#ffe890');
    for (let y = 0; y < 15; y++) {
      const half = Math.round(1 + (y * 8) / 14);
      for (let x = 32 - half; x < 32 + half; x++) px(c, x, y, x < 32 ? '#6a2a4a' : '#5a2240');
    }
    rect(c, 31, -4, 2, 5, '#e9b949');
    rect(c, 29, -2, 6, 1, '#e9b949');
    // the nave
    roof(c, 1, 36, 62, 18, '#6a2a4a', 'slate');
    plaster(c, 5, 54, 54, 26, '#efebe2');
    ell(c, 32, 59, 5, 5, '#c8a070');
    ell(c, 32, 59, 4, 4, '#d84a7a');
    px(c, 31, 58, '#7dcfff');
    px(c, 33, 60, '#ffe45c');
    px(c, 32, 59, '#ffffff');
    px(c, 30, 60, '#7dff9a');
    (VILLAGE_WINDOWS.vh_house_temple ??= []).push([27, 54, 10, 10]);
    door(c, 27, 66, 10, 14, '#7a4a2a');
    win(c, 'vh_house_temple', 11, 62, 6, 11, { arch: true, glass: '#5a7ac8' });
    win(c, 'vh_house_temple', 47, 62, 6, 11, { arch: true, glass: '#b85a8a' });
    foundation(c, 4, 80, 56);
  });
  // ---- a house the monsters wrecked
  sprite('vh_ruins', 60, 42, (c) => {
    stones(c, 4, 14, 14, 24);
    stones(c, 40, 18, 16, 20);
    stones(c, 18, 26, 22, 12);
    rect(c, 4, 11, 4, 4, STONE.mid);
    rect(c, 50, 13, 6, 6, STONE.mid);
    // charred beams
    for (let i = 0; i < 26; i++) rect(c, 12 + i, 9 + Math.floor(i / 3), 1, 2, i % 4 ? '#2a1e14' : '#4a2e18');
    for (let i = 0; i < 12; i++) rect(c, 36 + i, 30 - Math.floor(i / 2), 1, 2, '#2a1e14');
    // rubble and weeds
    for (let k = 0; k < 40; k++) {
      const x = 2 + Math.floor(hash(k, 3, 8) * 56),
        y = 33 + Math.floor(hash(8, k, 9) * 8);
      rect(c, x, y, 2, 2, hash(k, k, 2) < 0.5 ? STONE.light : STONE.dark);
    }
    for (let k = 0; k < 14; k++) px(c, 3 + Math.floor(hash(k, 5, 10) * 54), 30 + Math.floor(hash(10, k, 11) * 10), k % 2 ? '#4f7a38' : '#6a9a48');
  });
}

// ------------------------------------------------------------------ the castle ruins and the palace
function buildCastles() {
  // the ruins of the old castle; under its gate the stairs lead down into the dungeon
  sprite('vh_castle_ruins', 176, 128, (c) => {
    // the left round tower, broken off at the top
    stones(c, 8, 18, 40, 108);
    for (let y = 18; y < 126; y++) {
      for (let i = 0; i < 4; i++) px(c, 8 + i, y, shade(STONE.dark, -0.3 + i * 0.07));
      for (let i = 0; i < 5; i++) px(c, 47 - i, y, shade(STONE.dark, -0.35 + i * 0.06));
    }
    for (let x = 8; x < 48; x++) {
      const top = 18 + Math.round(Math.abs(Math.sin(x * 0.7)) * 6 + (x > 30 ? (x - 30) * 0.7 : 0));
      rect(c, x, 12, 1, top - 12, '#00000000');
      c.clearRect(x, 0, 1, top);
    }
    for (const [x, y] of [
      [26, 40],
      [26, 70],
      [18, 96],
    ])
      rect(c, x, y, 3, 9, '#141018');
    // the curtain wall with broken battlements
    stones(c, 44, 58, 90, 68);
    for (let x = 44; x < 134; x += 8) {
      const broken = hash(x, 1, 33) < 0.35;
      if (!broken) stones(c, x, 50, 5, 8);
      else rect(c, x + 1, 56, 3, 2, STONE.mid);
    }
    // the gatehouse in the middle, taller
    stones(c, 64, 30, 50, 96);
    for (let x = 64; x < 114; x += 7) if (hash(x, 2, 34) > 0.3) stones(c, x, 22, 5, 8);
    // the arch of the gate and the dark way down
    const ax = 89,
      aTop = 66;
    rect(c, ax - 16, aTop + 12, 32, 48, '#2a2228');
    ell(c, ax, aTop + 12, 16, 14, '#2a2228');
    rect(c, ax - 13, aTop + 13, 26, 47, '#0e0a10');
    ell(c, ax, aTop + 13, 13, 11, '#0e0a10');
    for (let i = 0; i < 7; i++) {
      const y = 126 - i * 5,
        hw = 12 - i;
      rect(c, ax - hw, y - 3, hw * 2, 3, shade('#6a6470', -i * 0.11));
      rect(c, ax - hw, y - 3, hw * 2, 1, shade('#8a8490', -i * 0.11));
    }
    // a portcullis raised and bent
    for (let x = ax - 12; x <= ax + 12; x += 4) rect(c, x, aTop + 3, 1, 14 - Math.abs(x - ax) * 0.4, '#3a3a48');
    rect(c, ax - 12, aTop + 8, 25, 1, '#3a3a48');
    // the arch stones
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const x = ax + Math.cos(a) * 17,
        y = aTop + 12 + Math.sin(a) * 15;
      rect(c, Math.round(x) - 1, Math.round(y) - 1, 3, 3, i % 2 ? STONE.light : STONE.hi);
    }
    // the right tower, only a stump of it is left
    stones(c, 132, 64, 38, 62);
    for (let y = 64; y < 126; y++) for (let i = 0; i < 4; i++) px(c, 169 - i, y, shade(STONE.dark, -0.3 + i * 0.06));
    for (let x = 132; x < 170; x++) c.clearRect(x, 0, 1, 64 + Math.round(Math.abs(Math.sin(x * 0.5)) * 7 + (x < 145 ? 4 : 0)));
    // cracks, ivy and moss
    const crackAt = (x: number, y: number, len: number) => {
      let cx = x,
        cy = y;
      for (let i = 0; i < len; i++) {
        px(c, cx, cy, '#2a2228');
        cx += hash(i, x, 5) < 0.5 ? 1 : -1;
        cy += 1;
      }
    };
    crackAt(70, 40, 18);
    crackAt(120, 70, 14);
    crackAt(30, 60, 20);
    for (let k = 0; k < 260; k++) {
      const x = 8 + Math.floor(hash(k, 1, 35) * 160),
        y = 30 + Math.floor(Math.pow(hash(1, k, 36), 0.6) * 96);
      if (x > ax - 18 && x < ax + 18 && y > aTop) continue;
      const col = ['#3e6a2e', '#4f7c38', '#5f8e42', '#2f5426'][k % 4];
      rect(c, x, y, 2, 2, col);
      if (k % 3 === 0) px(c, x + 1, y - 1, '#6ea04a');
    }
    // fallen stones at the foot of the walls
    for (let k = 0; k < 36; k++) {
      const x = 4 + Math.floor(hash(k, 3, 37) * 168),
        y = 118 + Math.floor(hash(3, k, 38) * 8);
      if (x > ax - 16 && x < ax + 16) continue;
      ell(c, x, y, 3, 2, STONE.mid);
      px(c, x - 1, y - 1, STONE.hi);
    }
  });
  // the king's palace: a central hall with a pediment, two wings, round towers with blue cones
  sprite('vh_palace', 208, 144, (c) => {
    const WALL = '#f1e8d6',
      WALL_D = '#d8ccb2',
      TRIM = '#b4aa98',
      SLATE = '#3e5a8a';
    const wallRect = (x: number, y: number, w: number, h: number) => {
      plaster(c, x, y, w, h, WALL);
      rect(c, x, y, w, 2, TRIM);
      rect(c, x, y + h - 6, w, 6, TRIM);
      rect(c, x, y + h - 6, w, 1, '#d0c6b4');
      for (let yy = y + 2; yy < y + h - 6; yy += 14) rect(c, x, yy, w, 1, WALL_D);
    };
    const tower = (x: number, w: number, top: number) => {
      plaster(c, x, top + 34, w, 144 - top - 34, WALL);
      for (let y = top + 34; y < 144; y++) {
        for (let i = 0; i < 3; i++) px(c, x + i, y, shade(WALL, -0.18 + i * 0.05));
        for (let i = 0; i < 4; i++) px(c, x + w - 1 - i, y, shade(WALL, -0.25 + i * 0.05));
      }
      rect(c, x, 138, w, 6, TRIM);
      // the cone
      for (let y = 0; y < 36; y++) {
        const half = Math.round(1.5 + (y * (w / 2 + 1)) / 35);
        const mid = x + w / 2;
        for (let xx = Math.round(mid - half); xx < Math.round(mid + half); xx++) px(c, xx, top + y, xx < mid ? (y % 4 === 3 ? '#34507e' : SLATE) : y % 4 === 3 ? '#283e66' : '#324c78');
      }
      rect(c, x - 2, top + 34, w + 4, 2, '#22365a');
      rect(c, x + w / 2 - 1, top - 4, 2, 5, '#e9b949');
      ell(c, x + w / 2, top - 5, 1.6, 1.6, '#ffd76a');
      for (const yy of [top + 46, top + 72, top + 96])
        if (yy < 128) win(c, 'vh_palace', x + w / 2 - 3, yy, 6, 10, { arch: true });
    };
    // the wings
    wallRect(26, 64, 50, 80);
    wallRect(132, 64, 50, 80);
    roof(c, 22, 44, 58, 22, SLATE, 'slate');
    roof(c, 128, 44, 58, 22, SLATE, 'slate');
    // the central hall
    wallRect(70, 46, 68, 98);
    roof(c, 66, 22, 76, 26, SLATE, 'slate');
    // the pediment with the crown of Loppo
    poly(c, [70, 48, 104, 24, 138, 48], '#e6dcc6');
    poly(c, [76, 46, 104, 29, 132, 46], WALL);
    rect(c, 68, 46, 72, 3, TRIM);
    rect(c, 98, 34, 12, 7, '#e9b949');
    for (const x of [98, 102, 106, 109]) rect(c, x, 31, 2, 3, '#e9b949');
    px(c, 104, 37, '#c83a4a');
    // towers on the corners
    tower(2, 28, 22);
    tower(178, 28, 22);
    // windows of the wings and the hall
    for (const x of [34, 50, 64 - 4, 140, 156, 170 - 4]) {
      win(c, 'vh_palace', x, 76, 8, 12, { arch: true, shutter: '#2a4a7a' });
      win(c, 'vh_palace', x, 104, 8, 12, { arch: true, shutter: '#2a4a7a' });
    }
    for (const x of [78, 124]) {
      win(c, 'vh_palace', x, 58, 7, 12, { arch: true });
      win(c, 'vh_palace', x, 86, 7, 12, { arch: true });
    }
    // banners of the king between the windows
    for (const x of [90, 113]) {
      rect(c, x, 56, 6, 26, '#a8202e');
      rect(c, x, 56, 6, 1, '#e9b949');
      poly(c, [x, 82, x + 3, 86, x + 6, 82], '#a8202e');
      rect(c, x + 2, 63, 2, 3, '#e9b949');
      px(c, x + 1, 62, '#e9b949');
      px(c, x + 4, 62, '#e9b949');
    }
    // the balcony over the door
    rect(c, 86, 98, 36, 4, TRIM);
    for (let x = 87; x < 121; x += 3) rect(c, x, 92, 2, 6, '#e6dcc6');
    rect(c, 86, 91, 36, 2, TRIM);
    // the great door, the steps and the carpet
    rect(c, 94, 108, 20, 30, '#2a1e1a');
    ell(c, 104, 108, 10, 8, '#2a1e1a');
    rect(c, 96, 109, 16, 29, '#7a3a24');
    ell(c, 104, 109, 8, 6.5, '#7a3a24');
    rect(c, 103, 104, 2, 34, '#5a2a1a');
    for (let y = 112; y < 136; y += 6)
      for (const x of [98, 109]) px(c, x, y, '#e9b949');
    for (let i = 0; i < 3; i++) {
      rect(c, 84 - i * 4, 138 + i * 2, 40 + i * 8, 2, i % 2 ? '#c4bcaa' : '#d8d0be');
    }
    rect(c, 98, 136, 12, 8, '#a8202e');
    rect(c, 98, 136, 1, 8, '#c83a4a');
    rect(c, 109, 136, 1, 8, '#7a1622');
    // flower boxes along the plinth
    for (const x of [30, 46, 140, 156])
      for (let i = 0; i < 12; i += 2) {
        px(c, x + i, 135, '#4f8a38');
        px(c, x + i + 1, 134, i % 4 ? '#e8463a' : '#f2c53a');
      }
  });
  // a red flag with the golden crown (waves on a tower)
  sprite('vh_flag', 14, 10, (c) => {
    rect(c, 0, 0, 1, 10, '#3a3a44');
    rect(c, 1, 1, 12, 7, '#b8202e');
    rect(c, 1, 1, 12, 1, '#d8404a');
    rect(c, 5, 3, 4, 3, '#e9b949');
    px(c, 5, 2, '#e9b949');
    px(c, 8, 2, '#e9b949');
  });
}

// ------------------------------------------------------------------ people and animals
function buildPeople() {
  // the king: a golden crown, white hair and beard, a red robe with ermine
  HEADS.crown = [
    '....a.a..a.a....',
    '...oaaaraaaao...',
    '...oaaaaaaaao...',
    '...ohhhhhhhho...',
    '...ohssssssho...',
    '...ohsessesho...',
    '...ohyssssyho...',
    '....oyyddyyo....',
    '.....oyyyyo.....',
  ];
  humanoidStrip(
    'npc_king',
    'crown',
    'robe',
    { a: '#e9b949', r: '#c8304a', h: '#ece8e0', y: '#f4f0e8', s: '#e8c0a0', d: '#b88868', e: '#1b1b2a', u: '#f6f2ea', c: '#a8202e', v: '#7a1622', g: '#e8c0a0', l: '#e9b949', b: '#3a2418' },
    (ctx, ox, f) => {
      const bob = f === 1 || f === 3 || f === 5 ? 1 : 0;
      // ermine spots
      px(ctx, ox + 4, 9 + bob, '#1b1b2a');
      px(ctx, ox + 11, 10 + bob, '#1b1b2a');
      // the sceptre
      rect(ctx, ox + 13, 8 + bob, 1, 10, '#c8962a');
      ell(ctx, ox + 13.5, 7.5 + bob, 1.6, 1.6, '#e9b949');
      px(ctx, ox + 13, 7 + bob, '#fff2b0');
    },
  );
  // the royal guard: a plumed helmet, a blue tabard, a halberd
  humanoidStrip(
    'npc_guard',
    'helm',
    'armor',
    { i: '#e4e8ee', h: '#aab2bc', j: '#6a7280', s: '#e0b898', e: '#1b1b2a', d: '#b08868', u: '#aab2bc', c: '#2a4a8a', v: '#1e3666', a: '#e9b949', l: '#5a3a22', g: '#aab2bc', p: '#2a2a36', q: '#3a3a48', b: '#3a2418' },
    (ctx, ox, f) => {
      const bob = f === 1 || f === 3 || f === 5 ? 1 : 0;
      // the plume
      rect(ctx, ox + 7, 0 + bob, 3, 2, '#c8323a');
      px(ctx, ox + 10, 1 + bob, '#c8323a');
      // the halberd
      rect(ctx, ox + 14, 0, 1, 20, '#7a5232');
      rect(ctx, ox + 12, 1, 3, 4, '#c8ced6');
      px(ctx, ox + 14, 0, '#e8eef4');
      px(ctx, ox + 11, 2, '#c8ced6');
    },
  );
  // villagers walking about
  humanoidStrip('npc_folk_a', 'bald', 'armor', { s: '#e8c0a0', i: '#f0d0b0', a: '#7a5232', e: '#1b1b2a', d: '#b88868', u: '#6a8a4a', c: '#5a7a3a', v: '#46602e', l: '#5a3a22', g: '#e8c0a0', p: '#4a3a2a', q: '#5a4a3a', b: '#2a1e14' });
  humanoidStrip('npc_folk_b', 'hood', 'robe', { h: '#b86a3a', j: '#8a4a28', s: '#ecc8a8', d: '#c09070', e: '#1b1b2a', u: '#d8c8a0', c: '#a85a6a', v: '#7a3a4a', a: '#ece0c4', l: '#ece0c4', g: '#ecc8a8', b: '#3a2418' });
  // ducks on the pond, a chicken, a butterfly, a glint on the water
  creatureStrip('vh_duck', 12, 10, 2, (c, f) => {
    ell(c, 6, 6.5 - f * 0.5, 5, 3, '#8a6a4a');
    ell(c, 5.5, 6 - f * 0.5, 3.6, 2, '#a8865e');
    ell(c, 9.5, 3.5 - f * 0.5, 2.2, 2.2, '#2f7a4a');
    px(c, 10, 3 - f * 0.5, '#0a0a0a');
    rect(c, 11, 4 - f * 0.5, 2, 1, '#f0b030');
    rect(c, 7, 5 - f * 0.5, 2, 1, '#f4f0e8');
    rect(c, 1, 9, 10, 1, '#cfefff');
  });
  creatureStrip('vh_chicken', 10, 10, 2, (c, f) => {
    ell(c, 5, 6, 4, 3, '#f4f0e8');
    ell(c, 4.5, 5.5, 2.8, 1.8, '#ffffff');
    ell(c, 7.5, 3 + f, 2, 2, '#f4f0e8');
    rect(c, 7, 0 + f, 2, 2, '#d8323a');
    px(c, 9, 3 + f, '#f0b030');
    px(c, 8, 2 + f, '#1b1b2a');
    rect(c, 3, 8, 1, 2, '#f0b030');
    rect(c, 6, 8, 1, 2, '#f0b030');
    px(c, 1, 4, '#e8e4dc');
  });
  creatureStrip(
    'vh_butterfly',
    7,
    6,
    2,
    (c, f) => {
      if (f === 0) {
        ell(c, 2, 2, 1.8, 1.8, '#ffffff');
        ell(c, 5, 2, 1.8, 1.8, '#ffffff');
        ell(c, 2, 4, 1.2, 1.2, '#e8e8e8');
        ell(c, 5, 4, 1.2, 1.2, '#e8e8e8');
      } else {
        rect(c, 2, 1, 1, 3, '#ffffff');
        rect(c, 4, 1, 1, 3, '#ffffff');
      }
      rect(c, 3, 1, 1, 4, '#2a2a2a');
    },
    false,
  );
  {
    const [c, ctx] = canvas(7, 7);
    rect(ctx, 3, 0, 1, 7, '#ffffff');
    rect(ctx, 0, 3, 7, 1, '#ffffff');
    rect(ctx, 2, 2, 3, 3, '#ffffff');
    addCanvas('vh_glint', c, false);
  }
  // Ilda, the old keeper of the seal, with her lantern
  humanoidStrip('npc_ilda', 'hood', 'robe', { h: '#8a8a96', j: '#5a5a66', s: '#e8c8a8', d: '#b89878', e: '#1b1b2a', u: '#2a3a5a', c: '#2a3a5a', v: '#1a263e', w: '#3a4e74', a: '#c8a070', l: '#c8a070', b: '#1a1420', g: '#e8c8a8' }, (ctx, ox, f) => {
    const bob = f === 1 || f === 3 || f === 5 ? 1 : 0;
    rect(ctx, ox + 13, 11 + bob, 1, 3, '#3a3a44');
    rect(ctx, ox + 12, 14 + bob, 3, 3, '#3a3a44');
    px(ctx, ox + 13, 15 + bob, '#ffd76a');
  });
}

export function buildVillageArt() {
  buildNature();
  buildProps();
  buildHouses();
  buildCastles();
  buildPeople();
}

void OUTLINE;
void LIT;
