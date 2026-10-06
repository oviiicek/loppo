import Phaser from 'phaser';
import { canvas, rect, px, tpl, outline, shade, hash, line, circle } from './pixel';
import { CLASSES, ClassDef } from '../data/classes';

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
let SCENE: Phaser.Scene;
const iconCache = new Map<string, string>();
const canvases = new Map<string, HTMLCanvasElement>();

function addCanvas(key: string, c: HTMLCanvasElement) {
  canvases.set(key, c);
  if (SCENE.textures.exists(key)) SCENE.textures.remove(key);
  SCENE.textures.addCanvas(key, c);
}

function addStrip(key: string, c: HTMLCanvasElement, fw: number, fh: number, n: number) {
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
  count: 25,
};

// Dungeon themes (biomes) – they change every 10 floors and end with a boss floor.
export interface Theme {
  name: string;
  floor: string[];
  mortar: string;
  moss: string[];
  stone: { top: string; topHi: string; topLo: string; line: string; edge: string };
  brick: string[];
  brickMortar: string;
  torch: number;
  dark: number;
}

export const THEMES: Theme[] = [
  {
    name: 'Kobky',
    floor: ['#6e5038', '#6a4c35', '#735439', '#684a33'],
    mortar: '#3a291d',
    moss: ['#3f5a24', '#4d6b2b', '#5d7f33'],
    stone: { top: '#4a4955', topHi: '#5d5c6a', topLo: '#3a3943', line: '#24232b', edge: '#17161c' },
    brick: ['#5b5a66', '#55545f', '#62616e', '#4f4e59'],
    brickMortar: '#2a2930',
    torch: 0xff9a3a,
    dark: 0x05040a,
  },
  {
    name: 'Krypta',
    floor: ['#4c5260', '#484e5b', '#515866', '#454a56'],
    mortar: '#262a33',
    moss: ['#3a4a5a', '#44586a', '#2f3d4a'],
    stone: { top: '#3c4250', topHi: '#4d5466', topLo: '#2f3440', line: '#1c2028', edge: '#12141a' },
    brick: ['#4a5163', '#454b5c', '#525a6e', '#40465a'],
    brickMortar: '#20232c',
    torch: 0x9ab8ff,
    dark: 0x04050c,
  },
  {
    name: 'Jeskyně',
    floor: ['#5a5a3a', '#545436', '#606040', '#4e4e32'],
    mortar: '#2e2e1c',
    moss: ['#3f6a24', '#4d7b2b', '#5d8f33'],
    stone: { top: '#3e4a3a', topHi: '#4e5c49', topLo: '#323d2f', line: '#1e261c', edge: '#121810' },
    brick: ['#4b5a46', '#46543f', '#53634d', '#404d3b'],
    brickMortar: '#222a1f',
    torch: 0xc8ff7a,
    dark: 0x040805,
  },
  {
    name: 'Výheň',
    floor: ['#5a3028', '#552c24', '#62352c', '#4f2a22'],
    mortar: '#2a1210',
    moss: ['#ff6a1a', '#ff8a2a', '#c84a10'],
    stone: { top: '#2e2a2c', topHi: '#3e3638', topLo: '#241f21', line: '#141012', edge: '#0c0809' },
    brick: ['#3a3032', '#352b2d', '#42373a', '#302729'],
    brickMortar: '#1a1213',
    torch: 0xff5a1a,
    dark: 0x0a0403,
  },
  {
    name: 'Ledové hlubiny',
    floor: ['#7d97ab', '#7690a4', '#849fb3', '#718a9e'],
    mortar: '#435869',
    moss: ['#cfefff', '#b8e0ff', '#e8f8ff'],
    stone: { top: '#5f7689', topHi: '#7b94a8', topLo: '#4f6272', line: '#33434f', edge: '#222c35' },
    brick: ['#7089a0', '#6a8399', '#7891a8', '#637c92'],
    brickMortar: '#3a4b5a',
    torch: 0x8fe0ff,
    dark: 0x03060a,
  },
];

export function themeForFloor(floor: number) {
  return Math.floor((Math.max(1, floor) - 1) / 10) % THEMES.length;
}

function drawFloor(ctx: CanvasRenderingContext2D, ox: number, v: number, th: Theme) {
  const base = th.floor;
  const mortar = th.mortar;
  rect(ctx, ox, 0, 16, 16, mortar);
  // 4 slabs with offset pattern
  const slabs = v % 2 === 0 ? [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]] : [[0, 0, 10, 7], [10, 0, 6, 7], [0, 7, 6, 9], [6, 7, 10, 9]];
  slabs.forEach(([x, y, w, h], i) => {
    const col = base[(v + i) % base.length];
    rect(ctx, ox + x, y, w - 1, h - 1, col);
    // highlight top-left edge, shade bottom-right
    rect(ctx, ox + x, y, w - 1, 1, shade(col, 0.12));
    rect(ctx, ox + x, y, 1, h - 1, shade(col, 0.07));
    rect(ctx, ox + x, y + h - 2, w - 1, 1, shade(col, -0.12));
    // speckle
    for (let k = 0; k < 6; k++) {
      const sx = x + Math.floor(hash(v, i * 13 + k, 7) * (w - 2)),
        sy = y + Math.floor(hash(v, i * 17 + k, 9) * (h - 2));
      px(ctx, ox + sx, sy, shade(col, hash(sx, sy, v) > 0.5 ? 0.08 : -0.1));
    }
  });
  // cracks
  if (v === 3 || v === 6) {
    line(ctx, ox + 3, 4, ox + 7, 9, shade(mortar, 0.05));
    line(ctx, ox + 7, 9, ox + 6, 13, shade(mortar, 0.05));
  }
  // moss / embers / frost depending on the theme
  if (v === 5 || v === 7) {
    const mc = th.moss;
    for (let k = 0; k < 14; k++) {
      const sx = Math.floor(hash(v, k, 3) * 7) + (v === 5 ? 1 : 8),
        sy = Math.floor(hash(k, v, 5) * 6) + (v === 5 ? 8 : 1);
      px(ctx, ox + sx, sy, mc[k % 3]);
    }
  }
}

function drawWallTop(ctx: CanvasRenderingContext2D, ox: number, mask: number, th: Theme) {
  const STONE = th.stone;
  // mask bits: 1 = floor north, 2 = floor east, 4 = floor west
  rect(ctx, ox, 0, 16, 16, STONE.top);
  // big blocks
  const blocks = [
    [0, 0, 8, 6],
    [8, 0, 8, 6],
    [0, 6, 5, 5],
    [5, 6, 11, 5],
    [0, 11, 10, 5],
    [10, 11, 6, 5],
  ];
  for (const [x, y, w, h] of blocks) {
    const n = hash(x + ox, y, mask);
    const col = n > 0.66 ? STONE.topHi : n < 0.33 ? STONE.topLo : STONE.top;
    rect(ctx, ox + x, y, w, h, col);
    rect(ctx, ox + x, y, w, 1, shade(col, 0.1));
    rect(ctx, ox + x, y + h - 1, w, 1, STONE.line);
    rect(ctx, ox + x + w - 1, y, 1, h, STONE.line);
  }
  if (mask & 1) {
    rect(ctx, ox, 0, 16, 2, STONE.edge);
    rect(ctx, ox, 2, 16, 1, shade(STONE.topHi, 0.15));
  }
  if (mask & 2) {
    rect(ctx, ox + 14, 0, 2, 16, STONE.edge);
    rect(ctx, ox + 13, 0, 1, 16, shade(STONE.topLo, -0.1));
  }
  if (mask & 4) {
    rect(ctx, ox, 0, 2, 16, STONE.edge);
    rect(ctx, ox + 2, 0, 1, 16, shade(STONE.topHi, 0.1));
  }
}

function drawWallFront(ctx: CanvasRenderingContext2D, ox: number, mask: number, cracked: boolean, th: Theme) {
  const STONE = th.stone;
  const brick = th.brick;
  const mortar = th.brickMortar;
  rect(ctx, ox, 0, 16, 16, mortar);
  // top cap
  rect(ctx, ox, 0, 16, 3, STONE.topHi);
  rect(ctx, ox, 0, 16, 1, shade(STONE.topHi, 0.2));
  rect(ctx, ox, 3, 16, 1, STONE.edge);
  // brick rows
  const rows = [
    [4, 4],
    [8, 4],
    [12, 3],
  ];
  rows.forEach(([y, h], ri) => {
    const off = ri % 2 === 0 ? 0 : -4;
    for (let x = off; x < 16; x += 8) {
      const col = brick[Math.floor(hash(x + ox * 3, y, mask + ri) * brick.length)];
      const bx = Math.max(0, x),
        bw = Math.min(16, x + 7) - bx;
      if (bw <= 0) continue;
      rect(ctx, ox + bx, y, bw, h - 1, col);
      rect(ctx, ox + bx, y, bw, 1, shade(col, 0.12));
      if (hash(x, y, 77 + ox) > 0.7) px(ctx, ox + bx + 2, y + 1, shade(col, -0.15));
    }
  });
  // bottom shadow
  rect(ctx, ox, 15, 16, 1, shade(mortar, -0.35));
  if (mask & 1) rect(ctx, ox + 15, 0, 1, 16, STONE.edge);
  if (mask & 2) rect(ctx, ox, 0, 1, 16, STONE.edge);
  if (cracked) {
    const c = shade(mortar, -0.4);
    line(ctx, ox + 5, 4, ox + 8, 8, c);
    line(ctx, ox + 8, 8, ox + 7, 12, c);
    line(ctx, ox + 8, 8, ox + 11, 10, c);
    px(ctx, ox + 6, 5, shade(brick[0], 0.25));
  }
}

function buildTileset() {
  THEMES.forEach((th, ti) => {
    const [c, ctx] = canvas(16 * TILE.count, 16);
    for (let v = 0; v < 8; v++) drawFloor(ctx, 16 * (1 + v), v, th);
    for (let m = 0; m < 8; m++) drawWallTop(ctx, 16 * (TILE.top + m), m, th);
    for (let m = 0; m < 4; m++) drawWallFront(ctx, 16 * (TILE.front + m), m, false, th);
    drawWallFront(ctx, 16 * TILE.frontCrack, 0, true, th);
    drawWallFront(ctx, 16 * (TILE.frontCrack + 1), 0, true, th);
    drawFloor(ctx, 16 * 23, 0, th);
    rect(ctx, 16 * TILE.fog, 0, 16, 16, '#07060a');
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
  for (const cl of CLASSES) {
    let head: string = cl.head;
    if (cl.id === 'assassin') head = 'hoodMask';
    humanoidStrip('pl_' + cl.id, head, cl.body, cl.pal, (ctx, ox, f) => classExtras(cl, ctx, ox, f));
  }
}

function classExtras(cl: ClassDef, ctx: CanvasRenderingContext2D, ox: number, f: number) {
  const bob = f % 2 === 1 ? 1 : 0;
  if (cl.id === 'warrior') {
    // teal scarf
    rect(ctx, ox + 4, 9 + bob, 8, 1, '#2a9d8f');
    px(ctx, ox + 3, 10 + bob, '#2a9d8f');
    px(ctx, ox + 3, 11 + bob, '#1f776c');
  }
  if (cl.id === 'mage') {
    px(ctx, ox + 7, 11 + bob, '#f2c94c');
    px(ctx, ox + 10, 16, '#f2c94c');
  }
  if (cl.id === 'necro') {
    px(ctx, ox + 7, 10 + bob, '#cfc9b8');
    px(ctx, ox + 8, 10 + bob, '#cfc9b8');
  }
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
  // stairs down 16x16
  addCanvas(
    'stairs',
    iconCanvasSized(16, 16, (c) => {
      rect(c, 0, 0, 16, 16, '#2a2930');
      for (let i = 0; i < 5; i++) {
        const y = i * 3;
        rect(c, i, y, 16 - i * 2, 3, shade('#7a7886', -i * 0.16));
        rect(c, i, y, 16 - i * 2, 1, shade('#9a98a6', -i * 0.16));
      }
      rect(c, 5, 14, 6, 2, '#0a090c');
    }, false),
  );
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
  const g = ctx.createRadialGradient(20, 16, 2, 20, 20, 24);
  g.addColorStop(0, shade(color, -0.35));
  g.addColorStop(1, shade(color, -0.85));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 40, 40);
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
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 38, 38);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------------------
export function buildAllTextures(scene: Phaser.Scene) {
  SCENE = scene;
  buildTileset();
  buildClassSprites();
  buildEnemies();
  buildWeapons();
  buildIcons();
  buildObjects();
  buildProjectiles();
}
