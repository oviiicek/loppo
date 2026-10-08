// The village of Loppo under the open sky: a meadow at the foot of the Grey Mountains with the ruins
// of the old castle (the way down into the dungeon), the king's palace and its courtyard, the
// graveyard by the chapel, the square with the well, the villagers' houses, gardens and a pond, all
// ringed by the forest.
//
// The ground is described by shapes (paths are lines with a width, the pond an ellipse, the square
// a circle …). The same function tells what lies under any point, so the walkable grid made here and
// the ground painted in gfx/ground.ts always agree.
import type { Dungeon, DObject, Room } from './dungeon';
import type { BuildingId } from '../data/village';

const T_FLOOR = 1;
const T_WALL = 2;

export const VW = 64;
export const VH = 48;

/** what covers the ground */
export const G = {
  grass: 0,
  forest: 1,
  path: 2,
  dirt: 3,
  plaza: 4,
  water: 5,
  sand: 6,
  court: 7,
  soil: 8,
  grave: 9,
  ruin: 10,
  pier: 11,
} as const;
export type GroundCode = (typeof G)[keyof typeof G];

// ------------------------------------------------------------------ smooth noise
function h2(x: number, y: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** value noise in -1..1, smooth between whole coordinates */
export function vnoise(x: number, y: number, s = 0) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s),
    b = h2(ix + 1, iy, s),
    c = h2(ix, iy + 1, s),
    d = h2(ix + 1, iy + 1, s);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

/** two octaves: big bends and small wiggles (x, y in tiles) */
export function edgeNoise(x: number, y: number, s = 0) {
  return vnoise(x * 0.45, y * 0.45, s) * 0.65 + vnoise(x * 1.7, y * 1.7, s + 7) * 0.35;
}

// ------------------------------------------------------------------ the plan of the village (tiles)
type Pt = [number, number];
export interface PathDef {
  pts: Pt[];
  /** width in tiles */
  w: number;
  kind: 'path' | 'dirt';
}
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** the castle ruins: the gate down into the dungeon (the tile in front of the arch) */
export const RUINS = { x: 24, y: 10, artW: 176, artH: 128 };
/** the king's palace: the tile before its door */
export const PALACE = { x: 48, y: 12, artW: 208, artH: 144 };
/** where the king and his guards stand */
export const KING = { x: 48.5, y: 14.3 };
export const GUARDS: Pt[] = [
  [45.3, 13.9],
  [51.7, 13.9],
];
export const PLAZA = { x: 32, y: 25, r: 5.3 };
export const WELL = { x: 32, y: 25 };
export const ILDA = { x: 35.3, y: 26.9 };
export const POND = { x: 49.5, y: 40.2, rx: 6.9, ry: 3.9 };
export const PIER: Rect = { x0: 41.2, y0: 40, x1: 46.4, y1: 41 };
export const COURT: Rect = { x0: 41, y0: 12, x1: 56, y1: 19.6 };
export const FOUNTAIN = { x: 48.5, y: 17.2 };
export const GRAVEYARD: Rect = { x0: 3, y0: 4, x1: 17, y1: 18 };
/** the gap in the graveyard fence */
export const GRAVE_GATE = { x0: 9, x1: 10 };
/** the beds behind the fences: the hero's vegetable garden and Vanda's herbs (gate = the gap in the fence) */
export const GARDENS: (Rect & { gate: Pt })[] = [
  { x0: 18.6, y0: 37.6, x1: 22.4, y1: 42.4, gate: [20, 43] },
  { x0: 47.6, y0: 27.6, x1: 51.4, y1: 30.4, gate: [46, 29] },
];
const RUIN_AREA = { x: 24.5, y: 6.5, rx: 8.6, ry: 5.6 };
/** the training ground (packed earth) */
const YARD: Rect = { x0: 6.5, y0: 29.5, x1: 17.5, y1: 38.5 };
/** the south road leaves the village through a closed gate in the palisade */
export const SOUTH_GATE = { x: 32.5, y: 45.6 };

/**
 * Where each house stands: cx = middle of the front (tiles, may be fractional), by = the last row of
 * the house, art = the size of its picture (art pixels = world pixels), npc = where its keeper stands
 * (relative to the front middle, in tiles).
 */
export interface Plot {
  cx: number;
  by: number;
  w: number;
  h: number;
  npc: Pt;
}
export const PLOTS: Record<BuildingId, Plot> = {
  stash: { cx: 26, by: 38, w: 72, h: 64, npc: [2.6, 1.2] },
  smithy: { cx: 20, by: 28, w: 64, h: 62, npc: [2.6, 1.1] },
  shop: { cx: 23, by: 20, w: 64, h: 60, npc: [2.5, 1.1] },
  board: { cx: 41, by: 20, w: 60, h: 58, npc: [-2.5, 1.1] },
  lab: { cx: 44, by: 28, w: 60, h: 58, npc: [-2.4, 1.1] },
  tower: { cx: 57, by: 22, w: 38, h: 86, npc: [-1.8, 1.1] },
  trainer: { cx: 12, by: 33, w: 70, h: 50, npc: [2.9, 1.1] },
  temple: { cx: 9.5, by: 10, w: 64, h: 84, npc: [2.3, 1.1] },
};

export const PATHS: PathDef[] = [
  // from the ruins down to the square
  { pts: [[24.5, 10.4], [24.7, 13], [26.6, 15.9], [29.6, 18.3], [31.4, 20.5]], w: 2, kind: 'path' },
  // the square – the hunters' lodge – the palace courtyard
  { pts: [[36.8, 23], [40.5, 22.2], [43.2, 20.6], [45.4, 19.2]], w: 1.8, kind: 'path' },
  // the square – the shop – the graveyard gate
  { pts: [[27.3, 23.2], [23, 22.3], [19, 21.3], [14.6, 19.6], [10.2, 18.9], [9.6, 17.6]], w: 1.8, kind: 'path' },
  // the square – the smithy
  { pts: [[28, 28], [24.6, 29.7], [20.4, 29.9]], w: 1.6, kind: 'path' },
  // the square – the laboratory
  { pts: [[36.7, 27.8], [40.6, 29.7], [44, 29.9]], w: 1.6, kind: 'path' },
  // the road south out of the village
  { pts: [[32, 30], [32.3, 35], [31.8, 40.5], [32.5, 47.6]], w: 2.3, kind: 'dirt' },
  // the road – home
  { pts: [[31.9, 39.7], [28.6, 39.9], [26, 39.7]], w: 1.6, kind: 'path' },
  // the smithy – the training ground
  { pts: [[20.4, 30.2], [17.2, 32], [13.4, 34.6]], w: 1.5, kind: 'dirt' },
  // the courtyard – the mage's tower
  { pts: [[52.6, 19.4], [55.2, 21.2], [57, 23.5]], w: 1.5, kind: 'path' },
  // the laboratory – the pond
  { pts: [[44.2, 30.4], [43.6, 33.6], [42.3, 36.5], [41.8, 39.2]], w: 1.4, kind: 'dirt' },
  // the graveyard walk to the chapel
  { pts: [[9.5, 17.8], [9.5, 11.2]], w: 1.5, kind: 'dirt' },
  { pts: [[4.6, 13.6], [14.6, 13.6]], w: 1, kind: 'dirt' },
];

// ------------------------------------------------------------------ what lies at a point
function inRect(r: Rect, x: number, y: number) {
  return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px,
    qy = ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

/** distance (tiles) to the middle line of a path */
export function pathDist(p: PathDef, x: number, y: number) {
  let d = 1e9;
  for (let i = 0; i < p.pts.length - 1; i++) {
    const [ax, ay] = p.pts[i],
      [bx, by] = p.pts[i + 1];
    const s = segDist(x, y, ax, ay, bx, by);
    if (s < d) d = s;
  }
  return d;
}

/** the pond: < 1 inside (0 in the middle), with a wobbly shore */
export function pondValue(x: number, y: number) {
  const dx = (x - POND.x) / POND.rx,
    dy = (y - POND.y) / POND.ry;
  return dx * dx + dy * dy - edgeNoise(x, y, 31) * 0.13;
}

/** how far into the forest a point lies (> 0 inside the forest ring) */
export function forestValue(x: number, y: number) {
  const e = Math.min(x, y, VW - x, VH - y);
  if (e > 4.4) return -1;
  // the road leaves through the forest in the south
  if (Math.abs(x - SOUTH_GATE.x) < 1.6 && y > VH - 5) return -1;
  return 2.6 + edgeNoise(x, y, 5) * 1.3 - e;
}

function rectMargin(r: Rect, x: number, y: number) {
  return Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
}

/** a piece of a path: from (ax, ay) to (bx, by), half its width, its kind and which path it belongs to */
export type Seg = [number, number, number, number, number, number, number];
export const SEGS: Seg[] = [];
PATHS.forEach((p, pi) => {
  for (let i = 0; i < p.pts.length - 1; i++) SEGS.push([p.pts[i][0], p.pts[i][1], p.pts[i + 1][0], p.pts[i + 1][1], p.w / 2, p.kind === 'path' ? G.path : G.dirt, pi]);
});

/** the pieces of paths that can reach into a box (tiles) */
export function segsNear(x0: number, y0: number, x1: number, y1: number): Seg[] {
  return SEGS.filter((s) => Math.min(s[0], s[2]) - s[4] - 0.3 < x1 && Math.max(s[0], s[2]) + s[4] + 0.3 > x0 && Math.min(s[1], s[3]) - s[4] - 0.3 < y1 && Math.max(s[1], s[3]) + s[4] + 0.3 > y0);
}

/** what covers a point: its kind, how deep inside it the point lies (tiles) and an extra value */
export interface GInfo {
  g: GroundCode;
  m: number;
  v: number;
}

/**
 * What covers the ground at a point (in tiles). `segs` limits the paths looked at (the painter passes
 * the few near the tile it paints).
 */
export function groundInfo(x: number, y: number, o: GInfo, segs: Seg[] = SEGS): GInfo {
  const f = forestValue(x, y);
  if (f > 0) {
    o.g = G.forest;
    o.m = f;
    o.v = 0;
    return o;
  }
  if (inRect(PIER, x, y)) {
    o.g = G.pier;
    o.m = rectMargin(PIER, x, y);
    o.v = 0;
    return o;
  }
  if (Math.abs(x - POND.x) < POND.rx + 1.6 && Math.abs(y - POND.y) < POND.ry + 1.6) {
    const pv = pondValue(x, y);
    if (pv < 1.24) {
      o.g = pv < 1 ? G.water : G.sand;
      o.m = pv < 1 ? 1 - pv : 1.24 - pv;
      o.v = pv;
      return o;
    }
  }
  const pd = Math.hypot(x - PLAZA.x, y - PLAZA.y);
  if (pd < PLAZA.r) {
    o.g = G.plaza;
    o.m = PLAZA.r - pd;
    o.v = pd;
    return o;
  }
  if (inRect(COURT, x, y)) {
    o.g = G.court;
    o.m = rectMargin(COURT, x, y);
    o.v = 0;
    return o;
  }
  if (segs.length) {
    const n = edgeNoise(x, y, 11) * 0.16;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const m = s[4] + n - segDist(x, y, s[0], s[1], s[2], s[3]);
      if (m > 0) {
        o.g = s[5] as GroundCode;
        o.m = m;
        o.v = s[6];
        return o;
      }
    }
  }
  for (const r of GARDENS)
    if (inRect(r, x, y)) {
      o.g = G.soil;
      o.m = rectMargin(r, x, y);
      o.v = 0;
      return o;
    }
  if (inRect(GRAVEYARD, x, y)) {
    o.g = G.grave;
    o.m = rectMargin(GRAVEYARD, x, y);
    o.v = 0;
    return o;
  }
  if (inRect(YARD, x, y)) {
    const m = 1 - Math.max(Math.abs(x - 12) / 5.3, Math.abs(y - 34) / 4.2) + edgeNoise(x, y, 17) * 0.16;
    if (m > 0) {
      o.g = G.dirt;
      o.m = m * 3;
      o.v = -1;
      return o;
    }
  }
  if (Math.abs(x - RUIN_AREA.x) < RUIN_AREA.rx * 1.25 && Math.abs(y - RUIN_AREA.y) < RUIN_AREA.ry * 1.25) {
    const rx = (x - RUIN_AREA.x) / RUIN_AREA.rx,
      ry = (y - RUIN_AREA.y) / RUIN_AREA.ry;
    const m = 1 + edgeNoise(x, y, 23) * 0.3 - (rx * rx + ry * ry);
    if (m > 0) {
      o.g = G.ruin;
      o.m = m * 4;
      o.v = 0;
      return o;
    }
  }
  o.g = G.grass;
  o.m = 9;
  o.v = 0;
  return o;
}

const tmp: GInfo = { g: G.grass, m: 0, v: 0 };
/** what covers the ground at a point (tiles) */
export function groundAt(x: number, y: number): GroundCode {
  return groundInfo(x, y, tmp).g;
}

// ------------------------------------------------------------------ the generator
/** a village object: trees, lamps, fences, graves … (drawn by game/village.ts) */
export type VObj = DObject & { kind: `v_${string}` };

/** tiles each kind of object blocks, relative to its tile */
const BLOCKS: Record<string, Pt[]> = {
  v_tree: [[0, 0]],
  v_lamp: [[0, 0]],
  v_bench: [
    [0, 0],
    [1, 0],
  ],
  v_grave: [[0, 0]],
  v_crypt: [
    [0, 0],
    [1, 0],
    [0, -1],
    [1, -1],
  ],
  v_rock: [[0, 0]],
  v_hay: [
    [0, 0],
    [1, 0],
  ],
  v_cart: [
    [0, 0],
    [1, 0],
  ],
  v_stall: [
    [0, 0],
    [1, 0],
    [-1, 0],
  ],
  v_sign: [[0, 0]],
  v_barrel: [[0, 0]],
  v_crate: [[0, 0]],
  v_well: [
    [0, 0],
    [-1, 0],
  ],
  v_fountain: [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
  ],
  v_target: [[0, 0]],
  v_dummy: [[0, 0]],
  v_woodpile: [
    [0, 0],
    [1, 0],
  ],
  v_bush: [[0, 0]],
  v_gate: [
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
};

export interface VillageMap extends Dungeon {
  /** what covers each tile */
  ground: Uint8Array;
}

export function generateVillage(floor: number): VillageMap {
  const W = VW,
    H = VH;
  const grid = new Uint8Array(W * H);
  const ground = new Uint8Array(W * H);
  const roomId = new Int16Array(W * H).fill(-1);
  const idx = (x: number, y: number) => y * W + x;
  const cells: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = groundAt(x + 0.5, y + 0.5);
      ground[idx(x, y)] = g;
      const blocked = g === G.forest || g === G.water;
      grid[idx(x, y)] = blocked ? T_WALL : T_FLOOR;
      if (!blocked) {
        roomId[idx(x, y)] = 0;
        cells.push(idx(x, y));
      }
    }
  // what must stay free: paths, the square, doors, the courtyard, spots of the people
  const busy = new Uint8Array(W * H);
  const solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    grid[idx(x, y)] = T_WALL;
    roomId[idx(x, y)] = -1;
    busy[idx(x, y)] = 1;
  };
  const solidRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) solid(x, y);
  };
  // the big buildings
  const big = (cx: number, by: number, w: number, h: number) => {
    const x0 = Math.floor(cx - w / 32 + 0.25),
      x1 = Math.ceil(cx + w / 32 - 0.25) - 1;
    const y0 = by - Math.floor((h - 10) / 16) + 1;
    solidRect(x0, y0, x1, by);
  };
  big(RUINS.x + 0.5, RUINS.y - 1, RUINS.artW, RUINS.artH);
  big(PALACE.x + 0.5, PALACE.y - 1, PALACE.artW, PALACE.artH);
  for (const p of Object.values(PLOTS)) big(p.cx, p.by, p.w, p.h);

  const mark = (x: number, y: number, r = 0) => {
    for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++)
      for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) busy[idx(xx, yy)] = 1;
  };
  for (let i = 0; i < W * H; i++) {
    const g = ground[i];
    if (g === G.path || g === G.dirt || g === G.plaza || g === G.court || g === G.pier || g === G.soil || g === G.water || g === G.sand) busy[i] = 1;
    if (grid[i] === T_WALL) busy[i] = 1;
  }
  for (const p of Object.values(PLOTS)) {
    mark(p.cx, p.by + 1.5, 1.6);
    mark(p.cx + p.npc[0], p.by + 1 + p.npc[1], 1);
  }
  mark(KING.x, KING.y, 1.5);
  for (const [x, y] of GUARDS) mark(x, y, 0.6);
  mark(ILDA.x, ILDA.y, 0.8);
  mark(RUINS.x, RUINS.y + 1, 2);

  const objects: DObject[] = [];
  const put = (kind: string, x: number, y: number, data?: any) => {
    const tx = Math.floor(x),
      ty = Math.floor(y);
    objects.push({ kind, x, y, data });
    for (const [dx, dy] of BLOCKS[kind] ?? []) solid(tx + dx, ty + dy);
    mark(x, y, 0.6);
  };
  const free = (x: number, y: number, r = 0) => {
    for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++)
      for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
        if (busy[idx(xx, yy)]) return false;
      }
    return true;
  };

  // the well in the middle of the square, a fountain in the courtyard
  put('v_well', WELL.x, WELL.y);
  put('v_fountain', FOUNTAIN.x, FOUNTAIN.y);
  // the graveyard: an iron fence with a gate, the old graves, a crypt and a dead tree
  const gy = GRAVEYARD;
  for (let x = gy.x0; x < gy.x1; x++) {
    objects.push({ kind: 'v_ifence', x, y: gy.y0, data: { dir: 'h' } });
    solid(x, gy.y0);
    if (x >= GRAVE_GATE.x0 && x <= GRAVE_GATE.x1) continue;
    objects.push({ kind: 'v_ifence', x, y: gy.y1 - 1, data: { dir: 'h' } });
    solid(x, gy.y1 - 1);
  }
  for (let y = gy.y0 + 1; y < gy.y1 - 1; y++) {
    objects.push({ kind: 'v_ifence', x: gy.x0, y, data: { dir: 'v' } });
    objects.push({ kind: 'v_ifence', x: gy.x1 - 1, y, data: { dir: 'v' } });
    solid(gy.x0, y);
    solid(gy.x1 - 1, y);
  }
  objects.push({ kind: 'v_igate', x: (GRAVE_GATE.x0 + GRAVE_GATE.x1 + 1) / 2, y: gy.y1 - 1 });
  const graves: Pt[] = [
    [5, 12],
    [7, 12],
    [12, 12],
    [14, 12],
    [5, 15],
    [7, 15],
    [12, 15],
    [14, 15],
    [5, 9.6],
    [14, 10],
  ];
  graves.forEach(([x, y], i) => put('v_grave', x + 0.5, y + 0.5, { i }));
  put('v_crypt', 13.5, 7.5);
  put('v_tree', 4.6, 7.4, { t: 'dead' });
  put('v_tree', 15.2, 16.4, { t: 'cypress' });

  // the gardens: picket fences around the beds and the crops in them
  GARDENS.forEach((r, gi) => {
    const x0 = Math.floor(r.x0) - 1,
      x1 = Math.ceil(r.x1),
      y0 = Math.floor(r.y0) - 1,
      y1 = Math.ceil(r.y1);
    const gate = (x: number, y: number) => x === r.gate[0] && y === r.gate[1];
    for (let x = x0; x <= x1; x++)
      for (const y of [y0, y1]) {
        if (gate(x, y)) continue;
        objects.push({ kind: 'v_fence', x, y, data: { dir: 'h' } });
        solid(x, y);
      }
    for (let y = y0 + 1; y < y1; y++)
      for (const x of [x0, x1]) {
        if (gate(x, y)) continue;
        objects.push({ kind: 'v_fence', x, y, data: { dir: 'v' } });
        solid(x, y);
      }
    for (let y = Math.ceil(r.y0); y < r.y1 - 0.5; y++)
      for (let x = Math.ceil(r.x0); x < r.x1 - 0.5; x++) objects.push({ kind: 'v_crop', x: x + 0.5, y: y + 0.5, data: { t: gi === 0 ? (y % 2 ? 'cabbage' : 'carrot') : 'herb' } });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0) busy[idx(x, y)] = 1;
  });

  // street lamps along the ways
  const lamps: Pt[] = [
    [26.9, 20.9],
    [37.6, 20.9],
    [26.9, 29.5],
    [37.6, 29.5],
    [25.9, 12.6],
    [30.6, 17],
    [33.7, 33.6],
    [30.3, 42.6],
    [42.5, 13.6],
    [54.5, 13.6],
    [8.4, 19.3],
    [11.6, 19.3],
    [29.6, 41],
    [45.6, 35.4],
    [21.4, 23.6],
    [39.4, 31.3],
    [17.6, 30.6],
    [47.2, 21.4],
  ];
  for (const [x, y] of lamps) put('v_lamp', x, y);

  // benches, a market stall, the woodpile, the hay, a cart, the training ground
  put('v_bench', 28.1, 21.6);
  put('v_bench', 46.5, 35.6);
  put('v_bench', 44.2, 18.6);
  put('v_bench', 51.6, 18.6);
  put('v_stall', 28.9, 30.7, { t: 'veg' });
  put('v_stall', 35.2, 20.6, { t: 'cloth' });
  put('v_woodpile', 16.6, 26.6);
  put('v_hay', 28.8, 35.6);
  put('v_cart', 34.6, 36.6);
  put('v_barrel', 25.6, 18.4);
  put('v_barrel', 15.8, 28.4);
  put('v_crate', 24.2, 26.6);
  put('v_crate', 38.5, 26.8);
  put('v_target', 8.6, 36.4);
  put('v_target', 7.6, 33.6);
  put('v_dummy', 15.6, 34.4);
  put('v_dummy', 14.6, 36.6);
  put('v_sign', 34.4, 31.4, { t: 'cross' });
  put('v_sign', 34.2, 44.4, { t: 'road' });
  put('v_gate', SOUTH_GATE.x, SOUTH_GATE.y);

  // the pond: reeds along the shore, lily pads, a little boat at the pier
  for (let k = 0; k < 40; k++) {
    const a = h2(k, 3, 91) * Math.PI * 2;
    const r = 1 + 0.02 + h2(k, 5, 92) * 0.06;
    const x = POND.x + Math.cos(a) * POND.rx * Math.sqrt(r),
      y = POND.y + Math.sin(a) * POND.ry * Math.sqrt(r);
    if (Math.abs(y - (PIER.y0 + PIER.y1) / 2) < 1.2 && x < POND.x) continue;
    if (h2(k, 9, 93) < 0.5) objects.push({ kind: 'v_reeds', x, y });
  }
  for (let k = 0; k < 14; k++) {
    const x = POND.x + (h2(k, 1, 94) - 0.5) * POND.rx * 1.5,
      y = POND.y + (h2(k, 2, 95) - 0.5) * POND.ry * 1.4;
    if (pondValue(x, y) < 0.75 && !(Math.abs(y - 40) < 1.4 && x < 47)) objects.push({ kind: 'v_lily', x, y, data: { f: h2(k, 4, 96) < 0.35 } });
  }
  objects.push({ kind: 'v_boat', x: 47.6, y: 41.5 });

  // trees: a few chosen ones, then the meadow fills up
  const trees: [string, number, number][] = [
    ['willow', 57.2, 37.8],
    ['willow', 41.6, 43.6],
    ['apple', 16.2, 41.8],
    ['apple', 21.8, 44],
    ['apple', 23.6, 44.6],
    ['oak', 37.6, 33.8],
    ['oak', 27.8, 32.6],
    ['birch', 59.6, 26.8],
    ['birch', 60.2, 30.4],
    ['birch', 58.2, 31.8],
    ['pine', 32.6, 9.6],
    ['pine', 34.2, 12.2],
    ['pine', 18.4, 12.6],
    ['oak', 38.4, 15.8],
    ['oak', 20.6, 15.6],
  ];
  for (const [t, x, y] of trees) if (free(x, y, 0.4)) put('v_tree', x, y, { t });
  const kinds = ['oak', 'oak', 'pine', 'birch', 'oak', 'apple', 'pine', 'birch'];
  for (let k = 0; k < 420; k++) {
    const x = 2 + h2(k, 11, 7) * (W - 4),
      y = 2 + h2(k, 12, 7) * (H - 4);
    if (!free(x, y, 1.6) || ground[idx(Math.floor(x), Math.floor(y))] !== G.grass) continue;
    // keep clear of the trees already standing
    if (objects.some((o) => o.kind === 'v_tree' && Math.hypot(o.x - x, o.y - y) < 3.2)) continue;
    put('v_tree', x, y, { t: kinds[Math.floor(h2(k, 13, 7) * kinds.length)] });
  }
  // the forest around: dense trees on the ring (they stand on blocked ground anyway)
  for (let y = 0.6; y < H; y += 1.7)
    for (let x = 0.6; x < W; x += 1.9) {
      const jx = x + (h2(Math.round(x * 10), Math.round(y * 10), 41) - 0.5) * 1.2,
        jy = y + (h2(Math.round(y * 10), Math.round(x * 10), 42) - 0.5) * 1;
      const f = forestValue(jx, jy);
      if (f < 0.2) continue;
      const t = h2(Math.round(jx * 7), Math.round(jy * 7), 43) < 0.55 ? 'pine' : 'oak';
      objects.push({ kind: 'v_tree', x: jx, y: jy, data: { t, forest: true } });
    }
  // bushes and rocks scattered over the meadow, flowers are painted into the grass
  for (let k = 0; k < 160; k++) {
    const x = 2 + h2(k, 21, 8) * (W - 4),
      y = 2 + h2(k, 22, 8) * (H - 4);
    if (!free(x, y, 0.8) || ground[idx(Math.floor(x), Math.floor(y))] !== G.grass) continue;
    const r = h2(k, 23, 8);
    if (r < 0.55) put('v_bush', x, y, { t: r < 0.2 ? 'flower' : r < 0.32 ? 'berry' : 'green' });
    else if (r < 0.75) put('v_rock', x, y, { t: r < 0.65 ? 'a' : 'b' });
    else objects.push({ kind: 'v_stump', x, y });
  }

  const room: Room = { id: 0, x: 0, y: 0, w: W, h: H, cells, cx: PLAZA.x, cy: PLAZA.y, type: 'start', shape: 'rect' };
  return {
    floor,
    w: W,
    h: H,
    grid,
    roomId,
    rooms: [room],
    start: { x: RUINS.x, y: RUINS.y },
    exit: { x: RUINS.x, y: RUINS.y },
    secretWalls: [],
    lockedDoors: [],
    objects,
    spawns: [],
    bossRoom: null,
    hasMerchant: false,
    theme: 5,
    ground,
  };
}
