import Phaser from 'phaser';
import { Dungeon, T_FLOOR, T_WALL } from '../systems/dungeon';
import { TILE, TILE_RES, themeForFloor } from '../gfx/textures';
import { hash } from '../gfx/pixel';

export const TS = 16;

// Wraps the dungeon grid: rendering, collision and path helpers.
export class WorldMap {
  d: Dungeon;
  w: number;
  h: number;
  solid: Uint8Array;
  explored: Uint8Array;
  flow: Int16Array;
  layer!: Phaser.Tilemaps.TilemapLayer;
  fog!: Phaser.Tilemaps.TilemapLayer;
  map!: Phaser.Tilemaps.Tilemap;
  private flowFrom = -1;
  // secret rooms are drawn as solid rock until their cracked wall is broken
  hiddenRooms = new Set<number>();

  constructor(d: Dungeon) {
    this.d = d;
    this.w = d.w;
    this.h = d.h;
    this.solid = new Uint8Array(d.w * d.h);
    for (let i = 0; i < d.w * d.h; i++) this.solid[i] = d.grid[i] === T_FLOOR ? 0 : 1;
    this.explored = new Uint8Array(d.w * d.h);
    this.flow = new Int16Array(d.w * d.h).fill(-1);
    for (const r of d.rooms) if (r.type === 'secret') this.hiddenRooms.add(r.id);
  }

  isHidden(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const r = this.d.roomId[y * this.w + x];
    return r >= 0 && this.hiddenRooms.has(r);
  }

  // floor the player can currently see as floor (hidden secret rooms count as rock)
  private openFloor(x: number, y: number) {
    return this.tileAt(x, y) === T_FLOOR && !this.isHidden(x, y);
  }

  // a secret room was found: draw it for real
  unhideRoom(id: number, cells: number[]) {
    if (!this.hiddenRooms.delete(id)) return;
    for (const c of cells) {
      const x = c % this.w,
        y = (c / this.w) | 0;
      this.refreshTile(x, y);
      this.addWallShadow(x, y - 1);
    }
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }

  tileAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d.grid[y * this.w + x];
  }

  isSolidTile(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.solid[ty * this.w + tx] === 1;
  }

  isSolidPx(x: number, y: number) {
    return this.isSolidTile(Math.floor(x / TS), Math.floor(y / TS));
  }

  tileIndexFor(x: number, y: number): number {
    const g = this.tileAt(x, y);
    if (g === T_FLOOR && this.isHidden(x, y)) return TILE.rock;
    if (g === T_FLOOR) {
      const r = hash(x, y, this.d.floor);
      // mostly plain variants, sometimes moss/cracks
      if (r < 0.06) return TILE.floor[5];
      if (r < 0.1) return TILE.floor[7];
      if (r < 0.16) return TILE.floor[3];
      if (r < 0.2) return TILE.floor[6];
      return TILE.floor[[0, 1, 2, 4][Math.floor(hash(y, x, 3) * 4)]];
    }
    if (g === T_WALL) {
      const below = this.openFloor(x, y + 1);
      const fl = (xx: number, yy: number) => this.openFloor(xx, yy);
      // walls that touch no visible floor are part of the solid rock (this also keeps secret rooms secret)
      let near = false;
      for (let yy = y - 1; yy <= y + 1 && !near; yy++) for (let xx = x - 1; xx <= x + 1 && !near; xx++) near = fl(xx, yy);
      if (!near) return TILE.rock;
      if (below) {
        const secret = this.d.secretWalls.some((s) => s.x === x && s.y === y);
        if (secret) return TILE.frontCrack;
        let m = 0;
        if (!fl(x + 1, y + 1) && this.tileAt(x + 1, y) !== T_WALL) m |= 1;
        if (!fl(x - 1, y + 1) && this.tileAt(x - 1, y) !== T_WALL) m |= 2;
        return TILE.front + m;
      }
      let m = 0;
      if (fl(x, y - 1)) m |= 1;
      if (fl(x + 1, y)) m |= 2;
      if (fl(x - 1, y)) m |= 4;
      return TILE.top + m;
    }
    // everything between rooms is solid rock, like a dungeon carved out of a mountain
    return TILE.rock;
  }

  build(scene: Phaser.Scene) {
    const data: number[][] = [];
    for (let y = 0; y < this.h; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.w; x++) row.push(this.tileIndexFor(x, y));
      data.push(row);
    }
    // tile art has double resolution; layers are scaled down onto the 16px world grid
    const R = TILE_RES;
    this.map = scene.make.tilemap({ data, tileWidth: R, tileHeight: R });
    const ts = this.map.addTilesetImage('tiles', 'tiles_' + themeForFloor(this.d.floor), R, R, 0, 0)!;
    this.layer = this.map.createLayer(0, ts, 0, 0)!;
    this.layer.setDepth(0).setScale(TS / R);
    // fog of war: black tiles removed as the player explores (just below the darkness overlay)
    this.fog = this.map.createBlankLayer('fog', ts, 0, 0)!;
    this.fog.fill(TILE.fog);
    this.fog.setDepth(99990).setScale(TS / R);
    // unexplored parts stay visible but dim (no black void)
    this.fog.setAlpha(0.55);
    // floor shadows under front walls
    this.scene = scene;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) this.addWallShadow(x, y);
  }

  private scene?: Phaser.Scene;

  private addWallShadow(x: number, y: number) {
    if (this.tileAt(x, y) === T_WALL && this.openFloor(x, y + 1)) this.scene?.add.image(x * TS, (y + 1) * TS, 'wallshadow').setOrigin(0).setDepth(3).setAlpha(0.8);
  }

  refreshTile(x: number, y: number) {
    for (let yy = y - 1; yy <= y + 1; yy++)
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
        this.map.putTileAt(this.tileIndexFor(xx, yy), xx, yy, true, this.layer);
      }
  }

  openTile(x: number, y: number) {
    this.d.grid[this.idx(x, y)] = T_FLOOR;
    this.solid[this.idx(x, y)] = 0;
    this.refreshTile(x, y);
  }

  // Circle vs tile collision; moves entity and returns final position.
  move(x: number, y: number, dx: number, dy: number, r: number): [number, number, boolean] {
    let hit = false;
    let nx = x + dx;
    if (this.collides(nx, y, r)) {
      nx = x;
      hit = true;
    }
    let ny = y + dy;
    if (this.collides(nx, ny, r)) {
      ny = y;
      hit = true;
    }
    return [nx, ny, hit];
  }

  collides(x: number, y: number, r: number) {
    // body uses a box slightly lower than the sprite centre (feet)
    const x0 = Math.floor((x - r) / TS),
      x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r * 0.6) / TS),
      y1 = Math.floor((y + r * 0.4) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolidTile(tx, ty)) return true;
    return false;
  }

  // Robust visibility between two entities: adjacent ones always see each other and the
  // ray is tried both from the feet and from slightly above (so wall-hugging monsters count).
  canSee(x0: number, y0: number, x1: number, y1: number) {
    if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 22) return true;
    return this.los(x0, y0, x1, y1) || this.los(x0, y0 - 4, x1, y1 - 4);
  }

  // Bresenham-ish line of sight in pixels
  los(x0: number, y0: number, x1: number, y1: number) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // BFS flow field from a tile (limited radius)
  computeFlow(px: number, py: number, maxDist = 40) {
    const tx = Math.floor(px / TS),
      ty = Math.floor(py / TS);
    const start = this.idx(tx, ty);
    if (start === this.flowFrom) return;
    this.flowFrom = start;
    this.flow.fill(-1);
    const q = new Int32Array(this.w * this.h);
    let qh = 0,
      qt = 0;
    q[qt++] = start;
    this.flow[start] = 0;
    while (qh < qt) {
      const c = q[qh++];
      const d = this.flow[c];
      if (d >= maxDist) continue;
      const cx = c % this.w,
        cy = (c / this.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0),
          ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const ni = ny * this.w + nx;
        if (this.solid[ni] || this.flow[ni] >= 0) continue;
        this.flow[ni] = d + 1;
        q[qt++] = ni;
      }
    }
  }

  // Direction (unit vector) down the flow field from a pixel position.
  flowDir(x: number, y: number): [number, number] | null {
    const tx = Math.floor(x / TS),
      ty = Math.floor(y / TS);
    const cur = this.flow[this.idx(tx, ty)];
    if (cur < 0) return null;
    let best = cur,
      bx = 0,
      by = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = tx + dx,
        ny = ty + dy;
      if (this.isSolidTile(nx, ny)) continue;
      if (dx && dy && (this.isSolidTile(tx + dx, ty) || this.isSolidTile(tx, ty + dy))) continue;
      const v = this.flow[this.idx(nx, ny)];
      if (v >= 0 && v < best) {
        best = v;
        bx = dx;
        by = dy;
      }
    }
    if (bx === 0 && by === 0) return null;
    // aim at the centre of the next tile
    const cx = (tx + bx) * TS + TS / 2,
      cy = (ty + by) * TS + TS / 2;
    const l = Math.hypot(cx - x, cy - y) || 1;
    return [(cx - x) / l, (cy - y) / l];
  }

  // can tile (x, y) be seen from tile (tx, ty)? walls block the view but are themselves visible
  private visible(tx: number, ty: number, x: number, y: number) {
    let x0 = tx,
      y0 = ty;
    const dx = Math.abs(x - x0),
      dy = -Math.abs(y - y0);
    const sx = x0 < x ? 1 : -1,
      sy = y0 < y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 === x && y0 === y) return true;
      if ((x0 !== tx || y0 !== ty) && this.solid[this.idx(x0, y0)]) return false;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  revealAround(px: number, py: number, r = 7) {
    const tx = Math.floor(px / TS),
      ty = Math.floor(py / TS);
    let changed = false;
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        if ((x - tx) ** 2 + (y - ty) ** 2 > r * r) continue;
        const i = this.idx(x, y);
        if (this.explored[i]) continue;
        if (!this.visible(tx, ty, x, y)) continue;
        this.explored[i] = 1;
        changed = true;
        this.clearFog(x, y);
      }
    return changed;
  }

  // reveals a whole room plus the walls around it
  revealRoom(cells: number[]) {
    let changed = false;
    for (const c of cells) {
      const cx = c % this.w,
        cy = (c / this.w) | 0;
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
          const i = this.idx(x, y);
          if (this.explored[i]) continue;
          // only the room floor and the walls touching it, never what lies behind them
          if (x !== cx || y !== cy) {
            if (!this.solid[i]) continue;
          }
          this.explored[i] = 1;
          this.clearFog(x, y);
          changed = true;
        }
    }
    return changed;
  }

  clearFog(x: number, y: number) {
    if (!this.fog) return;
    this.fog.removeTileAt(x, y);
    // soften the edge of the remaining fog
    for (let yy = y - 1; yy <= y + 1; yy++)
      for (let xx = x - 1; xx <= x + 1; xx++) {
        const t = this.fog.getTileAt(xx, yy);
        if (t) t.setAlpha(0.6);
      }
  }

  randomFloorNear(px: number, py: number, radius: number): [number, number] | null {
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * Math.PI * 2,
        r = Math.random() * radius;
      const x = px + Math.cos(a) * r,
        y = py + Math.sin(a) * r;
      if (!this.collides(x, y, 5)) return [x, y];
    }
    return null;
  }
}
