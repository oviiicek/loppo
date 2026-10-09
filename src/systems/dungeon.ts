import { RNG } from './rng';
import { isBossFloor, storyBossForFloor } from '../data/enemies';
import { FAMILIES, familiesFor, familyFodder, familyMembers, makePack } from '../data/families';
import { riftTheme } from '../data/biomes';

export const T_VOID = 0;
export const T_FLOOR = 1;
export const T_WALL = 2;

export type RoomType =
  | 'normal'
  | 'start'
  | 'exit'
  | 'boss'
  | 'treasure'
  | 'merchant'
  | 'secret'
  | 'vault'
  | 'shrine'
  | 'fountain'
  | 'forge'
  | 'den'
  | 'library'
  | 'closet'
  | 'camp'
  | 'puzzle'
  | 'prep';

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cells: number[]; // indices
  cx: number;
  cy: number;
  type: RoomType;
  shape: string;
}

export interface DObject {
  kind: string;
  x: number; // tile coords
  y: number;
  data?: any;
}

export interface Spawn {
  id: string;
  x: number;
  y: number;
  elite: boolean;
  room: number;
}

export interface Dungeon {
  floor: number;
  w: number;
  h: number;
  grid: Uint8Array;
  roomId: Int16Array;
  rooms: Room[];
  start: { x: number; y: number };
  exit: { x: number; y: number };
  secretWalls: { x: number; y: number }[];
  lockedDoors: { x: number; y: number }[];
  objects: DObject[];
  spawns: Spawn[];
  bossRoom: Room | null;
  hasMerchant: boolean;
  /** a rift, a dream or the last chance arena: a small floor of its own (see game/encounters.ts) */
  rift?: 'rift' | 'dream' | 'last';
  /** tileset override (index into THEMES) */
  theme?: number;
  /** the two monster families of the floor */
  families: [string, string];
  /** a floor without fighting (a camp, a merchant's crossroads, a treasury, a puzzle, a meeting place) */
  calm?: CalmKind;
  /** a guardian's floor: a short way from the stairs to the preparation room, then the arena */
  guard?: boolean;
}

/** the floors without fighting */
export type CalmKind = 'camp' | 'merchant' | 'vault' | 'puzzle' | 'npc';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** the size of a regular floor: small on the first floor of a band of ten, big on its last ones (the first bands
 *  don't grow quite as big, so new heroes are not lost in them) */
export function floorSize(floor: number) {
  const p = (Math.max(1, floor) - 1) % 10;
  const t = Math.min(1, p / 8);
  const band = Math.floor((Math.max(1, floor) - 1) / 10);
  const k = t * Math.min(1, 0.45 + band * 0.18);
  return { w: Math.round(50 + 76 * k), h: Math.round(36 + 54 * k), rooms: Math.round(8 + 22 * k) };
}

/** chance of a monster to be an elite champion (normal difficulty) */
export function eliteChanceFor(floor: number) {
  // more champions in the last chapter (201–250) and below it
  const cap = 0.16 + Math.min(1, Math.max(0, floor - 200) / 50) * 0.08;
  return Math.min(cap, 0.05 + floor * 0.004);
}

export function generateDungeon(floor: number, seed: number, opts: { forceMerchant?: boolean; rift?: 'rift' | 'dream' | 'last'; calm?: CalmKind } = {}): Dungeon {
  const r = new RNG(seed);
  const rift = opts.rift;
  const boss = !rift && isBossFloor(floor);
  // a guardian's floor is laid out by hand: the stairs, a short corridor, the preparation room, the arena
  const guard = boss;
  const calm = rift || guard ? undefined : opts.calm;
  const story = !!storyBossForFloor(floor);
  // the arena (story guardians get a bigger one) and the rooms before it
  const arenaW = story ? r.int(19, 22) : r.int(15, 19),
    arenaH = story ? r.int(15, 16) : r.int(12, 14);
  const gap1 = r.int(6, 9),
    gap2 = r.int(6, 8);
  const PREP_W = 17,
    PREP_H = 11,
    START_W = 7,
    START_H = 7;
  // a rift is a small, crowded floor; a dream is small and full of treasure; a calm floor is small and quiet
  const small = !!rift || !!calm;
  const size = floorSize(floor);
  const W = guard ? 4 + START_W + gap1 + PREP_W + gap2 + arenaW + 4 : small ? 52 : size.w;
  const H = guard ? Math.max(arenaH, PREP_H) + 14 : small ? 38 : size.h;
  const grid = new Uint8Array(W * H);
  const roomId = new Int16Array(W * H).fill(-1);
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
  const rooms: Room[] = [];

  // ------------------------------------------------------------ room shapes
  function shapeCells(shape: string, w: number, h: number): [number, number][] {
    const out: [number, number][] = [];
    switch (shape) {
      case 'circle': {
        const rx = (w - 1) / 2,
          ry = (h - 1) / 2;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const dx = (x - rx) / (rx + 0.5),
              dy = (y - ry) / (ry + 0.5);
            if (dx * dx + dy * dy <= 1) out.push([x, y]);
          }
        break;
      }
      case 'octagon': {
        const c = Math.max(1, Math.floor(Math.min(w, h) / 4));
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const dx = Math.min(x, w - 1 - x),
              dy = Math.min(y, h - 1 - y);
            if (dx + dy >= c) out.push([x, y]);
          }
        break;
      }
      case 'L': {
        const cw = Math.floor(w / 2) + r.int(-1, 1),
          ch = Math.floor(h / 2) + r.int(-1, 1);
        const corner = r.int(0, 3);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const inCut =
              (corner === 0 && x < cw && y < ch) ||
              (corner === 1 && x >= w - cw && y < ch) ||
              (corner === 2 && x < cw && y >= h - ch) ||
              (corner === 3 && x >= w - cw && y >= h - ch);
            if (!inCut) out.push([x, y]);
          }
        break;
      }
      case 'cross': {
        const tw = Math.max(3, Math.floor(w / 3)),
          th = Math.max(3, Math.floor(h / 3));
        const x0 = Math.floor((w - tw) / 2),
          y0 = Math.floor((h - th) / 2);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if ((x >= x0 && x < x0 + tw) || (y >= y0 && y < y0 + th)) out.push([x, y]);
          }
        break;
      }
      case 'cave': {
        let m: boolean[] = [];
        for (let i = 0; i < w * h; i++) m.push(r.chance(0.58));
        for (let it = 0; it < 4; it++) {
          const n: boolean[] = [];
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              let c = 0;
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const xx = x + dx,
                    yy = y + dy;
                  if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                  if (m[yy * w + xx]) c++;
                }
              n.push(c >= 5);
            }
          m = n;
        }
        // keep largest component
        const seen = new Array(w * h).fill(false);
        let best: number[] = [];
        for (let i = 0; i < w * h; i++) {
          if (!m[i] || seen[i]) continue;
          const comp: number[] = [];
          const st = [i];
          seen[i] = true;
          while (st.length) {
            const c = st.pop()!;
            comp.push(c);
            const cx = c % w,
              cy = Math.floor(c / w);
            for (const [dx, dy] of DIRS) {
              const xx = cx + dx,
                yy = cy + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              const j = yy * w + xx;
              if (m[j] && !seen[j]) {
                seen[j] = true;
                st.push(j);
              }
            }
          }
          if (comp.length > best.length) best = comp;
        }
        for (const c of best) out.push([c % w, Math.floor(c / w)]);
        if (out.length < 10) return shapeCells('rect', w, h);
        break;
      }
      default:
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([x, y]);
    }
    return out;
  }

  function canPlace(x: number, y: number, w: number, h: number, margin = 2) {
    if (x - margin < 2 || y - margin < 2 || x + w + margin >= W - 2 || y + h + margin >= H - 2) return false;
    for (let yy = y - margin; yy < y + h + margin; yy++)
      for (let xx = x - margin; xx < x + w + margin; xx++) if (grid[idx(xx, yy)] !== T_VOID) return false;
    return true;
  }

  function addRoom(x: number, y: number, w: number, h: number, shape: string, type: RoomType = 'normal'): Room {
    const cellsRel = shapeCells(shape, w, h);
    const id = rooms.length;
    const cells: number[] = [];
    let sx = 0,
      sy = 0;
    for (const [cx, cy] of cellsRel) {
      const i = idx(x + cx, y + cy);
      grid[i] = T_FLOOR;
      roomId[i] = id;
      cells.push(i);
      sx += x + cx;
      sy += y + cy;
    }
    // centre = floor cell closest to average
    const ax = sx / cells.length,
      ay = sy / cells.length;
    let best = cells[0],
      bd = 1e9;
    for (const c of cells) {
      const d = (c % W - ax) ** 2 + (Math.floor(c / W) - ay) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    const room: Room = { id, x, y, w, h, cells, cx: best % W, cy: Math.floor(best / W), type, shape };
    rooms.push(room);
    return room;
  }

  // ------------------------------------------------------------ place rooms
  const targetRooms = rift ? 9 : calm ? ({ camp: 5, merchant: 5, vault: 6, puzzle: 5, npc: 6 } as const)[calm] : size.rooms;
  let bossRoom: Room | null = null;
  let prepRoom: Room | null = null;
  if (guard) {
    // left to right (or mirrored): the stairs, the preparation room, the arena
    const flip = r.chance(0.5);
    const mid = Math.floor(H / 2);
    const at = (x: number, w: number) => (flip ? W - x - w : x);
    const sx = 4,
      px = sx + START_W + gap1,
      ax = px + PREP_W + gap2;
    addRoom(at(sx, START_W), mid - Math.floor(START_H / 2) + r.int(-2, 2), START_W, START_H, 'rect');
    prepRoom = addRoom(at(px, PREP_W), mid - Math.floor(PREP_H / 2) + r.int(-1, 1), PREP_W, PREP_H, 'rect', 'prep');
    bossRoom = addRoom(at(ax, arenaW), mid - Math.floor(arenaH / 2), arenaW, arenaH, r.chance(0.5) ? 'octagon' : 'circle', 'boss');
  }
  const shapes = ['rect', 'rect', 'rect', 'L', 'L', 'circle', 'octagon', 'cross', 'cave', 'cave'];
  let attempts = 0;
  while (!guard && rooms.length < targetRooms + (bossRoom ? 1 : 0) && attempts < 3000) {
    attempts++;
    const shape = r.pick(shapes);
    let w = r.int(5, 12),
      h = r.int(5, 10);
    if (shape === 'circle' || shape === 'octagon') {
      w = r.int(7, 12);
      h = r.int(7, 11);
    }
    if (shape === 'cross') {
      w = r.int(8, 13);
      h = r.int(8, 12);
    }
    if (shape === 'cave') {
      w = r.int(8, 15);
      h = r.int(7, 12);
    }
    const x = r.int(3, W - w - 4),
      y = r.int(3, H - h - 4);
    if (canPlace(x, y, w, h, 2)) addRoom(x, y, w, h, shape);
  }

  // ------------------------------------------------------------ connect rooms (MST + loops)
  const n = rooms.length;
  const dist = (a: Room, b: Room) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const edges: [number, number][] = [];
  const inTree = new Set<number>([0]);
  while (inTree.size < n) {
    let best: [number, number] | null = null,
      bd = 1e9;
    for (const a of inTree)
      for (let b = 0; b < n; b++) {
        if (inTree.has(b)) continue;
        const d = dist(rooms[a], rooms[b]);
        if (d < bd) {
          bd = d;
          best = [a, b];
        }
      }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  const adj: number[][] = rooms.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }

  // a calm floor's heart: the camp's yard or the puzzle hall is the roomiest room
  if (calm === 'camp' || calm === 'puzzle') {
    const big = [...rooms].sort((a, b) => b.cells.length - a.cells.length)[0];
    if (big) big.type = calm;
  }

  // choose start & exit
  let startRoom: Room;
  if (bossRoom) {
    // start = farthest from boss room
    const d = treeDist(bossRoom.id);
    startRoom = rooms[d.indexOf(Math.max(...d))];
  } else {
    startRoom = r.pick(rooms.filter((x) => x.cells.length < 90 && x.type === 'normal')) ?? rooms.find((x) => x.type === 'normal') ?? rooms[0];
  }
  startRoom.type = 'start';
  const dStart = treeDist(startRoom.id);
  let exitRoom: Room;
  if (bossRoom) exitRoom = bossRoom;
  else {
    // the stairs never stand in the calm floor's heart
    const far = rooms.map((rm, i) => (rm.type === 'normal' ? dStart[i] : -1));
    exitRoom = rooms[far.indexOf(Math.max(...far))] ?? rooms[dStart.indexOf(Math.max(...dStart))];
    exitRoom.type = 'exit';
  }

  function treeDist(from: number) {
    const d = new Array(n).fill(-1);
    d[from] = 0;
    const q = [from];
    while (q.length) {
      const c = q.shift()!;
      for (const nb of adj[c])
        if (d[nb] < 0) {
          d[nb] = d[c] + 1;
          q.push(nb);
        }
    }
    return d.map((x) => (x < 0 ? 0 : x));
  }

  // vault: a leaf room (only one connection)
  const leaves = rooms.filter((rm) => rm.type === 'normal' && adj[rm.id].length === 1 && rm.cells.length <= 100);
  let vault: Room | null = null;
  if (leaves.length && !rift && !guard && (calm === 'vault' || (!calm && r.chance(0.4)))) {
    vault = r.pick(leaves);
    vault.type = 'vault';
  }

  // extra loop edges
  const protectedRooms = new Set<number>();
  if (vault) protectedRooms.add(vault.id);
  if (bossRoom) protectedRooms.add(bossRoom.id);
  if (prepRoom) protectedRooms.add(prepRoom.id);
  for (let a = 0; a < n; a++) {
    if (protectedRooms.has(a) || !r.chance(0.35)) continue;
    const cands = rooms
      .filter((b) => b.id !== a && !protectedRooms.has(b.id) && !adj[a].includes(b.id))
      .sort((x, y) => dist(rooms[a], x) - dist(rooms[a], y));
    const b = cands[0];
    if (b && dist(rooms[a], b) < 30) {
      edges.push([a, b.id]);
      adj[a].push(b.id);
      adj[b.id].push(a);
    }
  }

  // ------------------------------------------------------------ carve corridors
  const corridor = new Uint8Array(W * H);
  const lockedDoors: { x: number; y: number }[] = [];
  for (const [a, b] of edges) {
    const A = rooms[a],
      B = rooms[b];
    const path = astar(A, B) ?? lPath(A.cx, A.cy, B.cx, B.cy);
    const wide = r.chance(0.2) && !protectedRooms.has(a) && !protectedRooms.has(b);
    for (const i of path) {
      if (grid[i] === T_VOID || roomId[i] < 0) {
        grid[i] = T_FLOOR;
        corridor[i] = 1;
        if (wide) {
          const x = i % W,
            y = Math.floor(i / W);
          const j = idx(x + 1, y + 1);
          if (inb(x + 1, y + 1) && roomId[j] < 0) {
            grid[idx(x + 1, y)] = grid[idx(x + 1, y)] || T_FLOOR;
            grid[idx(x, y + 1)] = grid[idx(x, y + 1)] || T_FLOOR;
            corridor[idx(x + 1, y)] = corridor[idx(x + 1, y)] || (roomId[idx(x + 1, y)] < 0 ? 1 : 0);
            corridor[idx(x, y + 1)] = corridor[idx(x, y + 1)] || (roomId[idx(x, y + 1)] < 0 ? 1 : 0);
          }
        }
      }
    }
    if (vault && (a === vault.id || b === vault.id)) {
      // door = first corridor cell adjacent to vault
      for (const i of path) {
        if (roomId[i] >= 0) continue;
        const x = i % W,
          y = Math.floor(i / W);
        if (DIRS.some(([dx, dy]) => roomId[idx(x + dx, y + dy)] === vault!.id)) {
          lockedDoors.push({ x, y });
          break;
        }
      }
    }
  }

  // simple L-shaped path used when A* gives up
  function lPath(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = [];
    let x = x0,
      y = y0;
    const horizFirst = r.chance(0.5);
    const stepX = () => {
      while (x !== x1) {
        x += Math.sign(x1 - x);
        out.push(idx(x, y));
      }
    };
    const stepY = () => {
      while (y !== y1) {
        y += Math.sign(y1 - y);
        out.push(idx(x, y));
      }
    };
    if (horizFirst) {
      stepX();
      stepY();
    } else {
      stepY();
      stepX();
    }
    return out;
  }

  function astar(A: Room, B: Room): number[] | null {
    // direction-aware A* (state = cell*4+dir) for straight-ish corridors
    const start = idx(A.cx, A.cy),
      goal = idx(B.cx, B.cy);
    const N = W * H * 4;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const open = new Heap();
    for (let d = 0; d < 4; d++) {
      g[start * 4 + d] = 0;
      open.push(start * 4 + d, 0);
    }
    const gx = B.cx,
      gy = B.cy;
    let found = -1;
    let iter = 0;
    while (open.size && iter++ < 600000) {
      const s = open.pop();
      const cell = s >> 2,
        dir = s & 3;
      if (cell === goal) {
        found = s;
        break;
      }
      const cx = cell % W,
        cy = (cell / W) | 0;
      for (let nd = 0; nd < 4; nd++) {
        const nx = cx + DIRS[nd][0],
          ny = cy + DIRS[nd][1];
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        const rid = roomId[ni];
        let cost = 1;
        if (rid >= 0) {
          if (rid === A.id || rid === B.id) cost = 1;
          else if (protectedRooms.has(rid)) continue;
          else cost = 6;
        } else if (corridor[ni]) cost = 0.7;
        else {
          // avoid running right next to other rooms (keeps walls intact)
          let near = false;
          for (const [dx, dy] of DIRS) {
            const rr = roomId[idx(nx + dx, ny + dy)];
            if (rr >= 0 && rr !== A.id && rr !== B.id) near = true;
          }
          cost = near ? 5 : 1.3;
        }
        if (nd !== dir) cost += 2.5;
        const ns = ni * 4 + nd;
        const ng = g[s] + cost;
        if (ng < g[ns]) {
          g[ns] = ng;
          came[ns] = s;
          open.push(ns, ng + (Math.abs(nx - gx) + Math.abs(ny - gy)) * 1.1);
        }
      }
    }
    if (found < 0) return null;
    const path: number[] = [];
    let s = found;
    while (s >= 0) {
      path.push(s >> 2);
      s = came[s];
    }
    return path.reverse();
  }

  // ------------------------------------------------------------ dead ends & closets
  const corridorCells: number[] = [];
  for (let i = 0; i < W * H; i++) if (corridor[i]) corridorCells.push(i);
  const nDead = guard ? 0 : Math.floor(corridorCells.length / 30) + r.int(0, 2);
  const closets: Room[] = [];
  for (let k = 0; k < nDead; k++) {
    const c = r.pick(corridorCells);
    if (c === undefined) break;
    let x = c % W,
      y = Math.floor(c / W);
    let [dx, dy] = r.pick(DIRS);
    const len = r.int(4, 9);
    const carved: number[] = [];
    let ok = true;
    for (let s = 0; s < len; s++) {
      x += dx;
      y += dy;
      if (!inb(x, y) || grid[idx(x, y)] !== T_VOID) {
        ok = s > 2;
        break;
      }
      // keep 1 tile gap from other floors (except where we came from)
      let touching = 0;
      for (const [ax, ay] of DIRS) if (grid[idx(x + ax, y + ay)] === T_FLOOR) touching++;
      if (touching > 1) {
        ok = false;
        break;
      }
      carved.push(idx(x, y));
      grid[idx(x, y)] = T_FLOOR;
      corridor[idx(x, y)] = 1;
      if (s === Math.floor(len / 2) && r.chance(0.5)) {
        [dx, dy] = dx !== 0 ? r.pick([[0, 1], [0, -1]]) : r.pick([[1, 0], [-1, 0]]);
      }
    }
    if (!ok) {
      for (const i of carved) {
        grid[i] = T_VOID;
        corridor[i] = 0;
      }
      continue;
    }
    // closet at the end
    if (r.chance(0.45)) {
      const cx = x + dx,
        cy = y + dy;
      const w = 3,
        h = 3;
      const rx = dx === 0 ? cx - 1 : dx > 0 ? cx : cx - 2;
      const ry = dy === 0 ? cy - 1 : dy > 0 ? cy : cy - 2;
      if (canPlace(rx, ry, w, h, 1) || canPlaceLoose(rx, ry, w, h)) {
        const rm = addRoom(rx, ry, w, h, 'rect', 'closet');
        closets.push(rm);
      }
    }
  }

  function canPlaceLoose(x: number, y: number, w: number, h: number) {
    if (x < 3 || y < 3 || x + w >= W - 3 || y + h >= H - 3) return false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (grid[idx(xx, yy)] !== T_VOID) return false;
    // ring must not touch floors except at one place
    let touches = 0;
    for (let yy = y - 1; yy <= y + h; yy++)
      for (let xx = x - 1; xx <= x + w; xx++) {
        if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
        if (grid[idx(xx, yy)] === T_FLOOR) touches++;
      }
    return touches <= 2;
  }

  // ------------------------------------------------------------ connectivity repair
  // Every room must be reachable from the start (the vault door counts as passable).
  {
    const reach = () => {
      const seen = new Uint8Array(W * H);
      const st = [idx(startRoom.cx, startRoom.cy)];
      seen[st[0]] = 1;
      while (st.length) {
        const c = st.pop()!;
        const x = c % W,
          y = Math.floor(c / W);
        for (const [dx, dy] of DIRS) {
          const n = idx(x + dx, y + dy);
          if (seen[n] || grid[n] !== T_FLOOR) continue;
          seen[n] = 1;
          st.push(n);
        }
      }
      return seen;
    };
    for (let pass = 0; pass < 6; pass++) {
      const seen = reach();
      const cut = rooms.filter((rm) => !seen[idx(rm.cx, rm.cy)]);
      if (!cut.length) break;
      for (const rm of cut) {
        // nearest reachable floor cell
        let best = -1,
          bd = 1e9;
        for (let i = 0; i < W * H; i++) {
          if (!seen[i]) continue;
          const d = Math.abs((i % W) - rm.cx) + Math.abs(Math.floor(i / W) - rm.cy);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best < 0) continue;
        for (const i of lPath(rm.cx, rm.cy, best % W, Math.floor(best / W))) {
          if (grid[i] === T_VOID) {
            grid[i] = T_FLOOR;
            corridor[i] = 1;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ secret rooms
  const secretWalls: { x: number; y: number }[] = [];
  const nSecret = rift || calm || guard ? 0 : r.chance(0.55 + Math.min(0.3, floor * 0.01)) ? (r.chance(0.25) ? 2 : 1) : 0;
  for (let k = 0; k < nSecret; k++) {
    for (let t = 0; t < 300; t++) {
      const host = r.pick(rooms.filter((rm) => ['normal', 'exit', 'library', 'den', 'start'].includes(rm.type)));
      if (!host) break;
      const c = r.pick(host.cells);
      const x = c % W,
        y = Math.floor(c / W);
      const [dx, dy] = r.pick(DIRS);
      if (grid[idx(x + dx, y + dy)] !== T_VOID) continue;
      const w = r.int(4, 6),
        h = r.int(4, 5);
      // room begins 2 tiles away (one wall tile between)
      const ex = x + dx * 2,
        ey = y + dy * 2;
      const rx = dx === 0 ? ex - Math.floor(w / 2) : dx > 0 ? ex : ex - w + 1;
      const ry = dy === 0 ? ey - Math.floor(h / 2) : dy > 0 ? ey : ey - h + 1;
      if (!inb(rx - 1, ry - 1) || !inb(rx + w, ry + h)) continue;
      let free = true;
      for (let yy = ry - 1; yy <= ry + h && free; yy++)
        for (let xx = rx - 1; xx <= rx + w && free; xx++) {
          if (xx === x + dx && yy === y + dy) continue;
          if (grid[idx(xx, yy)] !== T_VOID) free = false;
        }
      if (!free) continue;
      // also make sure the wall tile has void around except host/secret
      const rm = addRoom(rx, ry, w, h, 'rect', 'secret');
      secretWalls.push({ x: x + dx, y: y + dy });
      void rm;
      break;
    }
  }

  // ------------------------------------------------------------ walls
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (grid[idx(x, y)] !== T_VOID) continue;
      let nearFloor = false;
      for (let dy = -1; dy <= 1 && !nearFloor; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[idx(x + dx, y + dy)] === T_FLOOR) nearFloor = true;
      if (nearFloor) grid[idx(x, y)] = T_WALL;
    }
  for (const s of secretWalls) grid[idx(s.x, s.y)] = T_WALL;
  // a wall below the secret wall's floor neighbours so it renders as a solid face
  // pillars in big rectangular rooms
  for (const rm of rooms) {
    if (rm.type !== 'normal' && rm.type !== 'den' && rm.type !== 'library') continue;
    if (rm.shape !== 'rect' || rm.w < 9 || rm.h < 8 || !r.chance(0.45)) continue;
    for (let y = rm.y + 2; y < rm.y + rm.h - 2; y += 3)
      for (let x = rm.x + 2; x < rm.x + rm.w - 2; x += 4) {
        if (Math.abs(x - rm.cx) + Math.abs(y - rm.cy) < 2) continue;
        grid[idx(x, y)] = T_WALL;
      }
  }

  // ------------------------------------------------------------ door sanity
  // A locked vault door must never cut off anything but the vault itself.
  for (let k = lockedDoors.length - 1; k >= 0; k--) {
    const door = lockedDoors[k];
    const seen = new Uint8Array(W * H);
    const st = [idx(startRoom.cx, startRoom.cy)];
    seen[st[0]] = 1;
    const doorI = idx(door.x, door.y);
    while (st.length) {
      const c = st.pop()!;
      const x = c % W,
        y = Math.floor(c / W);
      for (const [dx, dy] of DIRS) {
        const n = idx(x + dx, y + dy);
        if (seen[n] || n === doorI || grid[n] !== T_FLOOR) continue;
        seen[n] = 1;
        st.push(n);
      }
    }
    const cutOff = rooms.some((rm) => rm.type !== 'vault' && rm.type !== 'secret' && !seen[idx(rm.cx, rm.cy)]);
    if (cutOff) lockedDoors.splice(k, 1);
  }

  // ------------------------------------------------------------ assign room roles
  const free = rooms.filter((rm) => rm.type === 'normal');
  r.shuffle(free);
  const take = (t: RoomType) => {
    const rm = free.pop();
    if (rm) rm.type = t;
    return rm;
  };
  let hasMerchant = guard;
  if (calm) {
    // what each calm floor holds
    const want: Record<CalmKind, RoomType[]> = {
      camp: ['merchant', 'forge', 'library'],
      merchant: ['merchant', 'shrine', 'fountain', 'forge'],
      vault: ['treasure', 'treasure', 'treasure', 'library'],
      puzzle: ['library', 'fountain'],
      npc: ['shrine', 'library'],
    };
    for (const t of want[calm]) take(t);
    hasMerchant = rooms.some((rm) => rm.type === 'merchant');
  } else if (!rift) {
    if (opts.forceMerchant || r.chance(0.42)) {
      hasMerchant = !!take('merchant');
    }
    if (r.chance(0.5)) take('treasure');
    if (r.chance(0.35)) take('shrine');
    if (r.chance(0.3)) take('fountain');
    if (r.chance(0.28)) take('forge');
    if (r.chance(0.35)) take('den');
    if (r.chance(0.3)) take('library');
    if (floor > 8 && r.chance(0.3)) take('treasure');
  }

  // ------------------------------------------------------------ objects
  const objects: DObject[] = [];
  const occupied = new Set<number>();
  const put = (kind: string, x: number, y: number, data?: any) => {
    // the last chance arena holds nothing to take
    if (rift === 'last' && (kind === 'chest' || kind === 'mimic' || kind === 'goldpile' || kind === 'door' || kind === 'shrine' || kind === 'fountain')) return;
    objects.push({ kind, x, y, data });
    occupied.add(idx(x, y));
  };
  const isFloor = (x: number, y: number) => grid[idx(x, y)] === T_FLOOR;
  const isFront = (x: number, y: number) => grid[idx(x, y)] === T_WALL && isFloor(x, y + 1);
  const freeFloor = (rm: Room) => rm.cells.filter((c) => grid[c] === T_FLOOR && !occupied.has(c));
  const edgeCells = (rm: Room) =>
    freeFloor(rm).filter((c) => {
      const x = c % W,
        y = Math.floor(c / W);
      return DIRS.some(([dx, dy]) => grid[idx(x + dx, y + dy)] === T_WALL);
    });
  const innerCells = (rm: Room) =>
    freeFloor(rm).filter((c) => {
      const x = c % W,
        y = Math.floor(c / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[idx(x + dx, y + dy)] !== T_FLOOR) return false;
      return true;
    });
  const doorZone = new Set<number>();
  for (let i = 0; i < W * H; i++) {
    if (!corridor[i]) continue;
    const x = i % W,
      y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) doorZone.add(idx(x + dx, y + dy));
  }
  const pickCell = (cells: number[]) => {
    const ok = cells.filter((c) => !occupied.has(c) && !doorZone.has(c));
    const c = ok.length ? r.pick(ok) : cells.length ? r.pick(cells.filter((c2) => !occupied.has(c2))) : undefined;
    return c === undefined ? null : { x: c % W, y: Math.floor(c / W) };
  };

  // start / exit
  const start = { x: startRoom.cx, y: startRoom.cy };
  occupied.add(idx(start.x, start.y));
  let exit = { x: exitRoom.cx, y: exitRoom.cy };
  if (bossRoom) {
    exit = { x: bossRoom.cx, y: bossRoom.cy - 2 >= bossRoom.y ? bossRoom.cy - 2 : bossRoom.cy };
    occupied.add(idx(exit.x, exit.y));
    occupied.add(idx(bossRoom.cx, bossRoom.cy));
  } else if (!rift) put('stairs', exit.x, exit.y);
  else occupied.add(idx(exit.x, exit.y));

  // locked doors
  for (const d of lockedDoors) put('door', d.x, d.y);

  const chestTier = () => (r.chance(0.12 + floor * 0.004) ? 'gold' : r.chance(0.35) ? 'iron' : 'wood');
  const placeChest = (rm: Room, tier: string, locked = false) => {
    const c = pickCell(innerCells(rm).length ? innerCells(rm) : freeFloor(rm));
    if (!c) return;
    const mimic = !locked && tier !== 'gold' && floor >= 2 && r.chance(0.06);
    put(mimic ? 'mimic' : 'chest', c.x, c.y, { tier, locked: locked || tier === 'gold' });
  };

  for (const rm of rooms) {
    switch (rm.type) {
      case 'treasure': {
        const nC = calm === 'vault' ? 3 : r.int(2, 3);
        const cells = innerCells(rm);
        // put chests in a row near centre
        for (let k = 0; k < nC; k++) {
          const x = rm.cx - (nC - 1) + k * 2,
            y = rm.cy;
          if (isFloor(x, y) && !occupied.has(idx(x, y))) put('chest', x, y, { tier: k === 1 ? 'iron' : chestTier(), locked: false });
          else placeChest(rm, chestTier());
        }
        void cells;
        carpetFor(rm);
        break;
      }
      case 'vault': {
        for (let k = 0; k < r.int(2, 3); k++) placeChest(rm, k === 0 ? 'gold' : r.chance(0.5) ? 'gold' : 'iron', true);
        for (let k = 0; k < r.int(2, 4); k++) {
          const c = pickCell(freeFloor(rm));
          if (c) put('goldpile', c.x, c.y);
        }
        break;
      }
      case 'secret': {
        placeChest(rm, r.chance(0.5) ? 'gold' : 'iron', false);
        if (r.chance(0.5)) placeChest(rm, 'iron');
        for (let k = 0; k < r.int(1, 3); k++) {
          const c = pickCell(freeFloor(rm));
          if (c) put('goldpile', c.x, c.y);
        }
        if (r.chance(0.3)) {
          const c = pickCell(innerCells(rm));
          if (c) put('shrine', c.x, c.y, { type: r.pick(['power', 'speed', 'armor', 'fortune', 'life', 'gems']) });
        }
        break;
      }
      case 'closet': {
        if (r.chance(0.6)) placeChest(rm, chestTier());
        else {
          const c = pickCell(freeFloor(rm));
          if (c) put('goldpile', c.x, c.y);
        }
        break;
      }
      case 'merchant': {
        put('merchant', rm.cx, rm.cy);
        carpetFor(rm);
        const c = pickCell(edgeCells(rm));
        if (c) put('crate', c.x, c.y);
        const c2 = pickCell(edgeCells(rm));
        if (c2) put('barrel', c2.x, c2.y);
        break;
      }
      case 'shrine':
        put('shrine', rm.cx, rm.cy, { type: r.pick(['power', 'speed', 'armor', 'fortune', 'wisdom', 'life', 'storm', 'gems']) });
        break;
      case 'fountain':
        put('fountain', rm.cx, rm.cy);
        break;
      case 'forge':
        put('anvil', rm.cx, rm.cy);
        break;
      case 'library': {
        const tx = rm.cx,
          ty = rm.cy;
        put('table', tx, ty);
        if (isFloor(tx - 1, ty)) put('chair', tx - 1, ty);
        if (isFloor(tx + 1, ty)) put('chair', tx + 1, ty, { flip: true });
        carpetFor(rm);
        if (r.chance(0.5)) placeChest(rm, 'wood');
        break;
      }
      case 'den':
        placeChest(rm, r.chance(0.5) ? 'iron' : 'gold', false);
        break;
      case 'camp': {
        // the campfire in the middle, the stash chest and a tent beside it, logs to sit on
        put('campfire', rm.cx, rm.cy);
        const spots: [string, number, number][] = [
          ['stashchest', 2, 0],
          ['tent', -2, -1],
          ['log', 0, 2],
          ['log', -2, 1],
        ];
        for (const [k, dx, dy] of spots) {
          const x = rm.cx + dx,
            y = rm.cy + dy;
          if (isFloor(x, y) && !occupied.has(idx(x, y))) put(k, x, y);
          else {
            const c = pickCell(innerCells(rm));
            if (c) put(k, c.x, c.y);
          }
        }
        break;
      }
      case 'puzzle':
        // the scene lays the rune plates and the tablet (see GameScene.placePuzzle)
        carpetFor(rm);
        break;
      case 'prep': {
        // the last stop before the guardian: a fire to rest at, the merchant, the anvil and the stash (the
        // scene adds the alchemist)
        put('campfire', rm.cx, rm.cy);
        const spots: [string, number, number][] = [
          ['merchant', -5, -2],
          ['anvil', 5, -2],
          ['stashchest', 4, 2],
          ['tent', -4, 2],
          ['log', 0, 2],
          ['log', -2, 1],
        ];
        for (const [k, dx, dy] of spots) {
          const x = rm.cx + dx,
            y = rm.cy + dy;
          if (isFloor(x, y) && !occupied.has(idx(x, y))) put(k, x, y);
          else {
            const c = pickCell(innerCells(rm));
            if (c) put(k, c.x, c.y);
          }
        }
        break;
      }
      case 'normal':
        if (r.chance(0.18)) placeChest(rm, chestTier());
        if (r.chance(0.2)) {
          const c = pickCell(freeFloor(rm));
          if (c) put('goldpile', c.x, c.y);
        }
        if (r.chance(0.15)) {
          const c = pickCell(innerCells(rm));
          if (c) {
            put('table', c.x, c.y);
            if (isFloor(c.x - 1, c.y) && !occupied.has(idx(c.x - 1, c.y))) put('chair', c.x - 1, c.y);
          }
        }
        break;
    }
  }

  function carpetFor(rm: Room) {
    const w = Math.min(rm.w - 4, 7),
      h = Math.min(rm.h - 4, 5);
    if (w < 3 || h < 3) return;
    const x0 = rm.cx - Math.floor(w / 2),
      y0 = rm.cy - Math.floor(h / 2);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!isFloor(x, y)) return;
    objects.push({ kind: 'carpet', x: x0, y: y0, data: { w, h, color: rm.type === 'merchant' ? 'blue' : 'red' } });
  }

  // wall decorations: torches, banners, bookshelves
  const isRoomWall = (x: number, y: number) => roomId[idx(x, y + 1)] >= 0;
  let sinceTorch = 0;
  for (let y = 1; y < H - 1; y++) {
    sinceTorch = r.int(0, 3);
    for (let x = 1; x < W - 1; x++) {
      if (!isFront(x, y) || secretWalls.some((s) => s.x === x && s.y === y)) {
        sinceTorch++;
        continue;
      }
      const inRoom = isRoomWall(x, y);
      const rm = inRoom ? rooms[roomId[idx(x, y + 1)]] : null;
      sinceTorch++;
      if (sinceTorch >= (inRoom ? 4 : 7) && r.chance(0.7)) {
        put('torch', x, y);
        sinceTorch = 0;
      } else if (rm && rm.type === 'library' && r.chance(0.6)) {
        put('bookshelf', x, y);
      } else if (inRoom && r.chance(0.09)) {
        put('banner', x, y, { color: r.pick(['blue', 'red', 'green']) });
      } else if (r.chance(0.04)) {
        put('wallcrack', x, y);
      }
    }
  }

  // floor clutter
  for (const rm of rooms) {
    if (rm.type === 'boss') continue;
    const edges = edgeCells(rm);
    const nClutter = Math.floor(edges.length / 6);
    for (let k = 0; k < nClutter; k++) {
      const c = pickCell(edges);
      if (!c) break;
      put(r.pick(['crate', 'barrel', 'pot', 'pot', 'barrel', 'crate', 'bones', 'skull']), c.x, c.y);
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (grid[i] !== T_FLOOR || occupied.has(i)) continue;
    const x = i % W,
      y = Math.floor(i / W);
    const roll = r.next();
    if (roll < 0.012) objects.push({ kind: 'bones', x, y });
    else if (roll < 0.02) objects.push({ kind: 'moss', x, y });
    else if (roll < 0.024) objects.push({ kind: 'puddle', x, y });
    // cobwebs in corners
    if (isFront(x, y - 1) && (grid[idx(x - 1, y)] === T_WALL || grid[idx(x + 1, y)] === T_WALL) && r.chance(0.25))
      objects.push({ kind: 'web', x, y, data: { flip: grid[idx(x + 1, y)] === T_WALL } });
  }

  // spike traps in corridors and some rooms (never near the start)
  if (floor >= 2 && rift !== 'dream' && !calm && !guard) {
    const trapChance = Math.min(0.025, 0.008 + floor * 0.0008);
    for (const c of corridorCells) {
      const x = c % W,
        y = Math.floor(c / W);
      if (occupied.has(c) || Math.hypot(x - start.x, y - start.y) < 8) continue;
      if (r.chance(trapChance)) put('spikes', x, y);
    }
    for (const rm of rooms) {
      if (rm.type !== 'normal' || !r.chance(0.15)) continue;
      const cells = innerCells(rm);
      for (let k = 0; k < Math.min(6, Math.floor(cells.length / 10)); k++) {
        const c = pickCell(cells);
        if (c && Math.hypot(c.x - start.x, c.y - start.y) > 6) put('spikes', c.x, c.y);
      }
    }
  }

  // ------------------------------------------------------------ enemies
  // every area of ten floors belongs to two monster families; each room holds a pack of one of them
  // (sometimes a guest family from elsewhere in the dungeon for a surprise)
  const spawns: Spawn[] = [];
  const eliteChance = eliteChanceFor(floor) * (rift ? 2 : 1);
  const fams = familiesFor(floor, rift);
  const guests = Object.keys(FAMILIES).filter((id) => !fams.includes(id) && familyFodder(FAMILIES[id], floor).length > 0 && familyMembers(FAMILIES[id], floor).length >= 3);
  const pickFamily = () => FAMILIES[guests.length && r.chance(0.08) ? r.pick(guests) : r.chance(0.65) ? fams[0] : fams[1]];
  for (const rm of rooms) {
    if (calm || guard) break;
    if (['start', 'merchant', 'shrine', 'fountain', 'forge', 'boss', 'closet'].includes(rm.type)) continue;
    const cells = freeFloor(rm).filter((c) => Math.hypot((c % W) - start.x, Math.floor(c / W) - start.y) > 8);
    if (!cells.length) continue;
    let count = Math.round((cells.length / 13) * r.float(0.75, 1.2) * (1 + Math.min(1, floor * 0.03)));
    if (rm.type === 'den') count = Math.round(count * 2 + 3);
    if (rm.type === 'vault') count = r.chance(0.5) ? 1 : 0;
    // secret rooms hold treasure, not monsters (they stay hidden until found)
    if (rm.type === 'secret') count = 0;
    if (rm.type === 'treasure') count = Math.round(count * 0.7);
    if (rift === 'rift') count = Math.round(count * 1.6 + 1);
    if (rift === 'dream' || rift === 'last') count = 0;
    count = Math.min(count, rift ? 14 : 10);
    if (count <= 0) continue;
    for (const slot of makePack(pickFamily(), floor, count, r)) {
      const c = r.pick(cells);
      const x0 = c % W,
        y0 = Math.floor(c / W);
      const elite = slot.n === 1 && r.chance(eliteChance);
      for (let k = 0; k < slot.n; k++) {
        // a crowd stands together
        const near = k === 0 ? c : r.pick(cells.filter((o) => Math.abs((o % W) - x0) <= 2 && Math.abs(Math.floor(o / W) - y0) <= 2)) ?? c;
        spawns.push({ id: slot.id, x: near % W, y: Math.floor(near / W), elite, room: rm.id });
      }
    }
  }
  // corridor wanderers: foot soldiers of the floor's main family
  const wanderers = familyFodder(FAMILIES[fams[0]], floor).filter((d) => !d.group);
  for (const c of corridorCells) {
    if (rift !== 'dream' && rift !== 'last' && !calm && !guard && wanderers.length && r.chance(0.022)) {
      const x = c % W,
        y = Math.floor(c / W);
      if (Math.hypot(x - start.x, y - start.y) < 10) continue;
      spawns.push({ id: r.weighted(wanderers, (d) => d.weight).id, x, y, elite: false, room: -1 });
    }
  }
  // keep the total manageable (performance on phones and pacing)
  const maxEnemies = Math.min(110, 34 + floor * 2);
  if (spawns.length > maxEnemies) {
    r.shuffle(spawns);
    spawns.length = maxEnemies;
  }
  // mimics are objects: handled by the scene

  // a rift lies in a twisted other place: the abyss (or the forge, for those already in the abyss); the dream is made of ice and light
  const theme = rift === 'rift' ? riftTheme(floor) : rift === 'dream' ? 2 : undefined;
  return { floor, w: W, h: H, grid, roomId, rooms, start, exit, secretWalls, lockedDoors, objects, spawns, bossRoom, hasMerchant, rift, theme, families: fams, calm, guard };
}

/** the square of Loppo: one big paved yard inside the old town walls, with room for eight houses */
// Simple binary heap keyed by priority
class Heap {
  private items: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    const a = this.items,
      b = this.pri;
    a.push(item);
    b.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (b[par] <= b[i]) break;
      [a[par], a[i]] = [a[i], a[par]];
      [b[par], b[i]] = [b[i], b[par]];
      i = par;
    }
  }
  pop(): number {
    const a = this.items,
      b = this.pri;
    const top = a[0];
    const lastI = a.pop()!,
      lastP = b.pop()!;
    if (a.length) {
      a[0] = lastI;
      b[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1,
          rr = l + 1;
        let m = i;
        if (l < a.length && b[l] < b[m]) m = l;
        if (rr < a.length && b[rr] < b[m]) m = rr;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [b[m], b[i]] = [b[i], b[m]];
        i = m;
      }
    }
    return top;
  }
}
