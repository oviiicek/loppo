// Hero sprites: drawn natively at double detail (32x40 per frame, shown at half size like the tiles),
// with a breathing idle, a blink, a walk cycle and idle fidgets (scratching the head, looking around,
// stretching). Every class shares the body rig and gets its own palette, headgear and details.
import type { ClassDef } from '../data/classes';
import { canvas, rect, px, shade, outline } from './pixel';

export const HERO_W = 32;
export const HERO_H = 40;
const OUT = '#16121c';

type Ctx = CanvasRenderingContext2D;
type Pal = Record<string, string>;
type Pt = [number, number];

interface Pose {
  /** upper body offset (+ = down) */
  bob: number;
  /** back / front leg: x offset and lift */
  legB: Pt;
  legF: Pt;
  /** hand positions (absolute) and optional elbows for raised arms */
  handB: Pt;
  handF: Pt;
  elbowB?: Pt;
  elbowF?: Pt;
  eyes: 'open' | 'closed' | 'left' | 'up' | 'squint';
  mouth: 'line' | 'open' | 'smile';
  head: Pt;
  /** robe hem sway */
  hem: number;
  /** the back arm reaches in front of the body (both hands on a two-handed weapon) */
  over?: boolean;
}

// hands hang relaxed while the weapon is put away; in combat the weapon hand is held forward (where the
// weapon sprite is drawn) and the back hand holds the shield or the second weapon
const HB: Pt = [8, 27];
const HF: Pt = [24, 27];
const HBA: Pt = [6, 26];
const HFA: Pt = [26, 26];
// both hands on the shaft of a two-handed weapon: the weapon hand higher, the back hand just below it
const HB2: Pt = [22, 28];
const HF2: Pt = [25, 24];

function pose(p: Partial<Pose>): Pose {
  return { bob: 0, legB: [0, 0], legF: [0, 0], handB: HB, handF: HF, eyes: 'open', mouth: 'line', head: [0, 0], hem: 0, ...p };
}

// breathing: the upper body sinks by a pixel and rises again
const idleSet = (hb: Pt, hf: Pt, over = false) => [0, 1, 1, 0].map((b) => pose({ bob: b, handB: [hb[0], hb[1] + b], handF: [hf[0], hf[1] + b], over }));
const WALK_LEG: [Pt, Pt, number][] = [
  [[-2, 0], [2, 0], 1],
  [[-1, -1], [1, 0], 0],
  [[0, -2], [0, 0], 0],
  [[2, 0], [-2, 0], 1],
  [[1, 0], [-1, -1], 0],
  [[0, 0], [0, -2], 0],
];
// arms swing while walking; the weapon hand stays steady when it holds the weapon
const walkSet = (hb: Pt, hf: Pt, armed: boolean, both = false) =>
  WALK_LEG.map(([b, f, bob], i) => {
    const swing = [2, 1, 0, -2, -1, 0][i];
    // (both hands on a two-handed weapon: they move together, the back hand does not swing)
    return pose({ bob, legB: b, legF: f, handF: [hf[0] + (armed ? 0 : swing), hf[1] + bob], handB: [hb[0] - (both ? 0 : swing), hb[1] + bob], hem: i < 3 ? 1 : -1, over: both });
  });

const IDLE = idleSet(HB, HF);
const BLINK = [pose({ eyes: 'closed' })];
const WALK = walkSet(HB, HF, false);
const IDLE_A = idleSet(HBA, HFA);
const BLINK_A = [pose({ eyes: 'closed', handB: HBA, handF: HFA })];
const WALK_A = walkSet(HBA, HFA, true);
const IDLE_2 = idleSet(HB2, HF2, true);
const BLINK_2 = [pose({ eyes: 'closed', handB: HB2, handF: HF2, over: true })];
const WALK_2 = walkSet(HB2, HF2, true, true);
// idle fidgets (only without a weapon in hand)
const SCRATCH = [
  pose({ handF: [26, 18], elbowF: [26, 21] }),
  pose({ handF: [23, 9], elbowF: [28, 15] }),
  pose({ handF: [20, 4], elbowF: [27, 12], eyes: 'squint', head: [1, 0] }),
  pose({ handF: [18, 4], elbowF: [27, 12], eyes: 'squint', head: [1, 0], mouth: 'smile' }),
  pose({ handF: [21, 3], elbowF: [27, 11], eyes: 'squint', head: [1, 0], mouth: 'smile' }),
  pose({ handF: [26, 18], elbowF: [27, 21] }),
];
const LOOK = [pose({ eyes: 'left' }), pose({ eyes: 'left', head: [-1, 0] }), pose({ eyes: 'open', head: [1, 0] }), pose({ eyes: 'up', head: [0, -1] })];
const STRETCH = [
  pose({ handB: [5, 18], handF: [27, 18], elbowB: [5, 22], elbowF: [27, 22] }),
  pose({ bob: -1, handB: [8, 4], handF: [24, 4], elbowB: [5, 12], elbowF: [27, 12] }),
  pose({ bob: -1, handB: [10, 1], handF: [22, 1], elbowB: [6, 9], elbowF: [26, 9], eyes: 'closed', mouth: 'open' }),
  pose({ bob: -1, handB: [10, 1], handF: [22, 1], elbowB: [6, 9], elbowF: [26, 9], eyes: 'closed', mouth: 'open', head: [0, -1] }),
  pose({ handB: [5, 17], handF: [27, 17], elbowB: [5, 21], elbowF: [27, 21] }),
  pose({}),
];
// reaching over the shoulder to draw or put away the weapon
const REACH = [pose({ handB: HBA, handF: [25, 17], elbowF: [27, 21] }), pose({ handB: HBA, handF: [21, 10], elbowF: [27, 15], head: [1, 0] })];

const SETS = { idle: IDLE, blink: BLINK, walk: WALK, idleA: IDLE_A, blinkA: BLINK_A, walkA: WALK_A, scratch: SCRATCH, look: LOOK, stretch: STRETCH, reach: REACH, idle2: IDLE_2, blink2: BLINK_2, walk2: WALK_2 };
type SetName = keyof typeof SETS;
/** first frame of every animation in the strip (and the frame count) */
export const HERO_FRAMES = {} as Record<SetName | 'count', number>;
const POSES: Pose[] = [];
for (const [name, poses] of Object.entries(SETS) as [SetName, Pose[]][]) {
  HERO_FRAMES[name] = POSES.length;
  POSES.push(...poses);
}
HERO_FRAMES.count = POSES.length;

/** weapon hand / back hand of a frame in source pixels, relative to the bottom centre of the frame */
export function heroHand(frame: number): Pt {
  const p = POSES[frame] ?? POSES[0];
  return [p.handF[0] - HERO_W / 2, p.handF[1] - HERO_H];
}
export function heroHandB(frame: number): Pt {
  const p = POSES[frame] ?? POSES[0];
  return [p.handB[0] - HERO_W / 2, p.handB[1] - HERO_H];
}

// ------------------------------------------------------------------ hard-edged primitives
function poly(ctx: Ctx, pts: number[][], col: string) {
  ctx.fillStyle = col;
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys))),
    y1 = Math.min(HERO_H - 1, Math.ceil(Math.max(...ys)));
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

function oval(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string, maxY = 999) {
  ctx.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.min(maxY, Math.ceil(cy + ry)); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
}

/** a thick limb segment (round brush) */
function seg(ctx: Ctx, a: Pt, b: Pt, w: number, col: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    oval(ctx, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, w / 2, w / 2, col);
  }
}

// ------------------------------------------------------------------ body parts
interface Look {
  pal: Pal;
  head: string;
  robe: boolean;
  id: string;
}

function arm(ctx: Ctx, L: Look, shoulder: Pt, hand: Pt, elbow: Pt | undefined, back: boolean) {
  const P = L.pal;
  const sleeve = back ? P.v : P.c;
  const sleeveD = back ? shade(P.v, -0.25) : P.v;
  const bare = L.id === 'berserker';
  const limbCol = bare ? (back ? P.d : P.s) : sleeve;
  if (elbow) {
    seg(ctx, shoulder, elbow, 4, limbCol);
    seg(ctx, elbow, hand, 3, bare ? limbCol : sleeveD);
  } else {
    // upper arm in the sleeve, forearm slightly darker
    const mid: Pt = [(shoulder[0] + hand[0]) / 2, (shoulder[1] + hand[1]) / 2];
    seg(ctx, shoulder, mid, 4, limbCol);
    seg(ctx, mid, hand, 3, bare ? limbCol : sleeveD);
  }
  // pauldron on armoured shoulders
  if (!L.robe && L.id !== 'assassin' && L.id !== 'ranger') {
    oval(ctx, shoulder[0], shoulder[1] - 0.5, 3, 2.5, back ? shade(P.u, -0.2) : P.u);
    px(ctx, Math.round(shoulder[0] - 1), Math.round(shoulder[1] - 2), shade(P.u, 0.35));
  }
  // hand (glove or skin)
  const hc = P.g ?? P.s;
  oval(ctx, hand[0], hand[1], 1.8, 1.8, back ? shade(hc, -0.15) : hc);
  px(ctx, Math.round(hand[0] - 1), Math.round(hand[1] - 1), shade(hc, 0.3));
}

function legs(ctx: Ctx, L: Look, p: Pose) {
  const P = L.pal;
  const hipY = 29;
  const draw = (x: number, dx: number, lift: number, back: boolean) => {
    const pc = back ? P.q : P.p;
    const top = hipY;
    const bottom = 36 - lift;
    rect(ctx, x + dx, top, 4, bottom - top, pc);
    rect(ctx, x + dx, top, 1, bottom - top, shade(pc, 0.15));
    // boot with the toe towards the facing side
    const bc = back ? shade(P.b, -0.2) : P.b;
    rect(ctx, x + dx - 0, bottom - 1, 5, 3, bc);
    rect(ctx, x + dx + 4, bottom, 1, 2, bc);
    rect(ctx, x + dx, bottom - 1, 5, 1, shade(bc, 0.3));
    rect(ctx, x + dx, bottom + 1, 6, 1, shade(bc, -0.35));
  };
  draw(11, p.legB[0], -p.legB[1], true);
  draw(16, p.legF[0], -p.legF[1], false);
}

function torsoArmor(ctx: Ctx, L: Look, b: number) {
  const P = L.pal;
  const y0 = 19 + b;
  // chest and belly
  poly(ctx, [[9, y0], [23, y0], [23, y0 + 7], [22, 30], [10, 30], [9, y0 + 7]], P.c);
  rect(ctx, 10, y0 + 1, 3, 9, P.w);
  rect(ctx, 20, y0 + 1, 3, 9, P.v);
  // collar
  rect(ctx, 12, y0 - 1, 9, 2, P.u);
  rect(ctx, 13, y0 - 1, 7, 1, shade(P.u, 0.3));
  // belt with a buckle
  rect(ctx, 9, 27, 14, 2, P.l);
  rect(ctx, 15, 27, 3, 2, P.a);
  px(ctx, 16, 27, shade(P.a, 0.4));
  // skirt / tassets
  rect(ctx, 10, 29, 12, 2, P.v);
  rect(ctx, 15, 29, 1, 2, shade(P.v, -0.3));
}

function torsoRobe(ctx: Ctx, L: Look, p: Pose) {
  const P = L.pal;
  const y0 = 19 + p.bob;
  const h = p.hem;
  poly(ctx, [[9, y0], [23, y0], [24, 27], [25 + h, 37], [7 + h, 37], [8, 27]], P.c);
  // light and shadow folds
  poly(ctx, [[10, y0 + 1], [12, y0 + 1], [11 + h, 36], [8 + h, 36]], P.w);
  poly(ctx, [[20, y0 + 1], [22, y0 + 1], [24 + h, 36], [21 + h, 36]], P.v);
  // trim down the front and along the hem
  rect(ctx, 16, y0 + 1, 2, 37 - y0 - 1, P.a);
  rect(ctx, 7 + h, 36, 19, 1, P.a);
  // collar and sash
  rect(ctx, 12, y0 - 1, 9, 2, P.u === P.c ? shade(P.c, -0.25) : P.u);
  rect(ctx, 9, 26 + Math.max(0, p.bob), 15, 2, P.l === P.a ? shade(P.v, -0.2) : P.l);
  px(ctx, 13, 27 + Math.max(0, p.bob), P.a);
}

function eyes(ctx: Ctx, P: Pal, cx: number, cy: number, mode: Pose['eyes']) {
  const white = '#f4efe6',
    pupil = P.e,
    lid = shade(P.d, -0.35);
  for (const [ex, w] of [
    [cx - 2, 2],
    [cx + 3, 2],
  ] as [number, number][]) {
    if (mode === 'closed') {
      rect(ctx, ex, cy + 1, w, 1, lid);
      continue;
    }
    if (mode === 'squint') {
      rect(ctx, ex, cy + 1, w, 1, lid);
      px(ctx, ex + 1, cy, lid);
      continue;
    }
    rect(ctx, ex, cy, w, 2, white);
    const pxl = mode === 'left' ? ex : ex + w - 1;
    const pyl = mode === 'up' ? cy : cy;
    rect(ctx, pxl, pyl, 1, mode === 'up' ? 1 : 2, pupil);
    rect(ctx, ex, cy - 1, w, 1, lid);
  }
}

function face(ctx: Ctx, L: Look, p: Pose, cx: number, cy: number) {
  const P = L.pal;
  oval(ctx, cx, cy, 6.5, 6.5, P.s);
  // shadow on the far side and under the chin, a touch of light on the brow (the face is turned towards the
  // weapon hand, so the far side shows more)
  oval(ctx, cx - 4.5, cy + 0.5, 2.8, 5.8, P.d);
  oval(ctx, cx - 3.2, cy, 2.2, 5, P.s);
  rect(ctx, cx - 3, cy + 6, 6, 1, P.d);
  px(ctx, cx + 3, cy - 4, shade(P.s, 0.25));
  // ear on the far side
  oval(ctx, cx - 6, cy + 1, 1.3, 1.8, P.d);
  eyes(ctx, P, Math.round(cx), Math.round(cy - 1), p.eyes);
  // nose and mouth
  px(ctx, Math.round(cx + 5), Math.round(cy + 2), P.d);
  px(ctx, Math.round(cx + 4), Math.round(cy + 2), shade(P.s, -0.08));
  const my = Math.round(cy + 4);
  if (p.mouth === 'open') {
    rect(ctx, Math.round(cx + 2), my - 1, 2, 2, '#5a2a2a');
  } else if (p.mouth === 'smile') {
    rect(ctx, Math.round(cx + 1), my, 3, 1, '#8a4a3a');
    px(ctx, Math.round(cx), my - 1, '#8a4a3a');
  } else rect(ctx, Math.round(cx + 1), my, 3, 1, shade(P.d, -0.2));
}

// headgear drawn over the face; cx, cy = centre of the face
function headgear(ctx: Ctx, L: Look, p: Pose, cx: number, cy: number) {
  const P = L.pal;
  switch (L.head) {
    case 'helm': {
      // open-faced steel helmet: dome, brow band, cheek guards and a nose guard (the eyes stay visible)
      oval(ctx, cx, cy - 3, 7.5, 6.5, P.h, cy - 3);
      oval(ctx, cx - 2, cy - 6, 3, 1.8, P.i);
      px(ctx, cx - 4, cy - 7, '#ffffff');
      rect(ctx, cx - 7, cy - 3, 15, 2, P.j);
      rect(ctx, cx - 6, cy - 3, 13, 1, shade(P.h, 0.1));
      rect(ctx, cx - 7, cy - 2, 2, 7, P.j);
      rect(ctx, cx + 5, cy - 2, 2, 6, P.h);
      px(ctx, cx + 5, cy - 2, P.i);
      rect(ctx, cx, cy - 2, 1, 4, P.j);
      // ridge on top
      rect(ctx, cx - 1, cy - 10, 3, 2, P.j);
      px(ctx, cx, cy - 10, P.i);
      break;
    }
    case 'hood':
    case 'hoodMask': {
      // hood framing the face, falling to the shoulders
      oval(ctx, cx - 0.5, cy - 1.5, 8, 8, P.h);
      poly(ctx, [[cx - 8, cy], [cx - 9, cy + 7], [cx - 4, cy + 7]], P.h);
      poly(ctx, [[cx + 7, cy], [cx + 8, cy + 6], [cx + 4, cy + 7]], P.h);
      oval(ctx, cx + 1, cy + 1, 5, 5.2, P.d);
      oval(ctx, cx + 1.5, cy + 1.5, 4.4, 4.6, P.s);
      eyes(ctx, P, Math.round(cx + 1), Math.round(cy), p.eyes);
      oval(ctx, cx - 3, cy - 5, 3, 2, P.i);
      rect(ctx, cx - 7, cy + 4, 2, 3, P.j);
      if (L.head === 'hoodMask') {
        rect(ctx, cx - 3, cy + 3, 9, 4, P.m ?? P.j);
        rect(ctx, cx - 3, cy + 3, 9, 1, shade(P.m ?? P.j, 0.25));
      } else rect(ctx, Math.round(cx + 1), Math.round(cy + 4), 3, 1, shade(P.d, -0.2));
      break;
    }
    case 'wizard': {
      // wide-brimmed pointed hat and a long beard
      poly(ctx, [[cx - 9, cy - 4], [cx + 10, cy - 4], [cx + 7, cy - 2], [cx - 7, cy - 2]], P.h);
      poly(ctx, [[cx - 6, cy - 4], [cx + 5, cy - 4], [cx + 3, cy - 8], [cx + 7, cy - 10], [cx, cy - 9]], P.h);
      poly(ctx, [[cx - 4, cy - 5], [cx - 1, cy - 9], [cx + 1, cy - 9], [cx - 1, cy - 5]], P.i);
      rect(ctx, cx - 6, cy - 5, 12, 2, P.a);
      px(ctx, cx + 2, cy - 7, P.a);
      // beard
      poly(ctx, [[cx - 4, cy + 2], [cx + 6, cy + 2], [cx + 4, cy + 9], [cx + 1, cy + 11], [cx - 2, cy + 8]], P.y ?? '#e8e8f0');
      rect(ctx, cx - 2, cy + 4, 1, 4, shade(P.y ?? '#e8e8f0', -0.2));
      rect(ctx, cx + 1, cy + 3, 4, 1, shade(P.y ?? '#e8e8f0', -0.15));
      break;
    }
    case 'paladin': {
      // great helm with a gold cross and a red plume
      oval(ctx, cx, cy - 1, 7.5, 7, P.h);
      rect(ctx, cx - 7.5, cy - 1, 15, 6, P.h);
      oval(ctx, cx - 2, cy - 4, 3.5, 2.5, P.i);
      rect(ctx, cx - 6, cy - 1, 13, 2, '#1a1622');
      rect(ctx, cx + 1, cy - 1, 2, 6, '#1a1622');
      rect(ctx, cx, cy - 7, 2, 12, P.a);
      rect(ctx, cx - 3, cy - 4, 8, 2, P.a);
      rect(ctx, cx - 7, cy + 4, 15, 1, P.j);
      poly(ctx, [[cx - 1, cy - 7], [cx + 2, cy - 7], [cx - 4, cy - 10], [cx - 7, cy - 9]], P.r ?? '#d1342f');
      px(ctx, cx - 4, cy - 9, shade(P.r ?? '#d1342f', 0.3));
      break;
    }
    case 'horned': {
      // horned iron helm with a nose guard, a wild red beard and war paint
      poly(ctx, [[cx - 6, cy - 5], [cx - 10, cy - 6], [cx - 11, cy - 11], [cx - 8, cy - 8], [cx - 4, cy - 7]], P.y ?? '#efe6d0');
      poly(ctx, [[cx + 6, cy - 5], [cx + 10, cy - 6], [cx + 11, cy - 11], [cx + 8, cy - 8], [cx + 4, cy - 7]], P.y ?? '#efe6d0');
      px(ctx, cx - 10, cy - 10, shade(P.y ?? '#efe6d0', -0.25));
      px(ctx, cx + 10, cy - 10, shade(P.y ?? '#efe6d0', -0.25));
      oval(ctx, cx, cy - 3, 7, 6, P.h, cy - 3);
      oval(ctx, cx - 2, cy - 6, 3, 1.5, P.i);
      rect(ctx, cx - 7, cy - 3, 14, 2, P.j);
      for (const rx of [-5, -1, 3]) px(ctx, cx + rx, cy - 3, P.i);
      rect(ctx, cx, cy - 2, 1, 3, P.j);
      poly(ctx, [[cx - 5, cy + 3], [cx + 6, cy + 3], [cx + 4, cy + 9], [cx + 1, cy + 7], [cx - 2, cy + 9], [cx - 4, cy + 6]], P.f ?? '#b8461d');
      rect(ctx, cx - 1, cy + 3, 4, 1, shade(P.f ?? '#b8461d', 0.25));
      rect(ctx, cx + 2, cy + 1, 3, 1, '#a8321e');
      break;
    }
    case 'antlers': {
      // long hair, leafy crown and antlers
      poly(ctx, [[cx - 7, cy - 3], [cx + 6, cy - 5], [cx + 7, cy + 2], [cx + 4, cy - 2], [cx - 5, cy - 1], [cx - 8, cy + 8], [cx - 8, cy]], P.y === '#8b5a2b' ? '#6b4423' : P.j);
      for (const s of [-1, 1]) {
        const bx = cx + s * 5;
        rect(ctx, bx, cy - 8, 1, 4, P.y ?? '#8b5a2b');
        rect(ctx, bx + s * 2, cy - 10, 1, 3, P.y ?? '#8b5a2b');
        rect(ctx, Math.min(bx, bx + s * 2), cy - 8, 3, 1, P.y ?? '#8b5a2b');
        rect(ctx, bx - s * 2, cy - 10, 1, 3, P.y ?? '#8b5a2b');
        rect(ctx, Math.min(bx, bx - s * 2), cy - 9, 3, 1, P.y ?? '#8b5a2b');
      }
      rect(ctx, cx - 7, cy - 5, 14, 2, P.h);
      for (let i = 0; i < 5; i++) px(ctx, cx - 6 + i * 3, cy - 6, P.i);
      px(ctx, cx - 3, cy - 5, '#e84a3f');
      break;
    }
    case 'bald': {
      // shaved head with a shine and a headband
      rect(ctx, cx - 6, cy - 4, 13, 2, P.a);
      rect(ctx, cx - 6, cy - 4, 13, 1, shade(P.a, 0.25));
      px(ctx, cx + 2, cy - 6, shade(P.s, 0.45));
      px(ctx, cx + 3, cy - 6, shade(P.s, 0.3));
      // the knot of the band behind the head
      rect(ctx, cx - 8, cy - 3, 2, 3, P.a);
      // two blue dots of the order on the brow
      px(ctx, cx - 1, cy - 6, '#3a6ab8');
      px(ctx, cx + 1, cy - 6, '#3a6ab8');
      break;
    }
    case 'feathers': {
      // black hair, a beaded band and feathers
      poly(ctx, [[cx - 7, cy - 2], [cx - 2, cy - 7], [cx + 6, cy - 5], [cx + 7, cy - 1], [cx + 3, cy - 3], [cx - 4, cy - 2], [cx - 8, cy + 9], [cx - 9, cy + 2]], P.h);
      rect(ctx, cx - 7, cy - 4, 14, 2, P.u === P.c ? '#8a4a2a' : P.u);
      for (let i = 0; i < 4; i++) px(ctx, cx - 5 + i * 3, cy - 4, P.a);
      for (const [fx, h, col] of [
        [cx - 3, 4, P.f ?? '#e84a3f'],
        [cx, 6, P.r ?? '#ffffff'],
        [cx + 3, 3, P.f ?? '#e84a3f'],
      ] as [number, number, string][]) {
        poly(ctx, [[fx, cy - 4], [fx + 2, cy - 4], [fx + 2, cy - 4 - h], [fx + 1, cy - 5 - h]], col);
        px(ctx, fx + 1, cy - 4 - h, shade(col, -0.3));
      }
      // face paint
      rect(ctx, cx + 1, cy + 1, 4, 1, P.r ?? '#ffffff');
      break;
    }
    default:
      break;
  }
}

// class details behind the body (capes, quivers) and in front (scarves, pendants)
function behind(ctx: Ctx, L: Look, p: Pose) {
  const P = L.pal;
  const b = p.bob;
  const cape = (col: string, dark: string, len = 35) => {
    poly(ctx, [[10, 19 + b], [22, 19 + b], [24 + p.hem, len], [8 + p.hem, len]], dark);
    poly(ctx, [[11, 20 + b], [14, 20 + b], [11 + p.hem, len - 1], [9 + p.hem, len - 1]], col);
  };
  switch (L.id) {
    case 'warrior':
      cape(P.c, P.v);
      break;
    case 'paladin':
      cape('#c02a2a', '#8a1c1c', 36);
      break;
    case 'ranger':
      // quiver with feathered arrows on the back
      poly(ctx, [[7, 17 + b], [10, 16 + b], [15, 28 + b], [12, 29 + b]], '#6b4423');
      rect(ctx, 6, 14 + b, 2, 3, '#e8e2cf');
      rect(ctx, 8, 13 + b, 2, 3, '#d8463a');
      cape(P.h, P.j, 33);
      break;
    case 'assassin':
      cape(P.h, P.j, 32);
      break;
    case 'necro':
      cape(P.v, '#0b100d', 37);
      break;
    default:
      break;
  }
}

function front(ctx: Ctx, L: Look, p: Pose) {
  const P = L.pal;
  const b = p.bob;
  switch (L.id) {
    case 'warrior':
      // teal scarf
      rect(ctx, 11, 18 + b, 11, 2, '#2a9d8f');
      rect(ctx, 11, 20 + b, 2, 4, '#1f776c');
      px(ctx, 12, 24 + b, '#1f776c');
      break;
    case 'assassin':
      // red sash across the chest
      for (let i = 0; i < 9; i++) rect(ctx, 11 + i, 20 + b + Math.floor(i * 0.8), 2, 2, i % 3 === 0 ? '#d63a4a' : '#b0263a');
      break;
    case 'mage':
      px(ctx, 16, 22 + b, '#7ad0ff');
      px(ctx, 17, 22 + b, '#ffffff');
      break;
    case 'necro':
      // skull pendant
      oval(ctx, 17, 23 + b, 1.8, 1.6, '#e8e2cf');
      px(ctx, 16, 23 + b, '#121a16');
      px(ctx, 18, 23 + b, '#121a16');
      break;
    case 'monk':
      // prayer beads
      for (let i = 0; i < 6; i++) px(ctx, 12 + i * 2, 20 + b + (i === 0 || i === 5 ? 0 : 1) + (i === 2 || i === 3 ? 1 : 0), i % 2 ? '#6b4423' : '#8a5a2b');
      break;
    case 'shaman':
      // bone necklace
      for (let i = 0; i < 5; i++) rect(ctx, 12 + i * 2, 20 + b + (i === 2 ? 2 : i === 1 || i === 3 ? 1 : 0), 1, 2, '#efe6d0');
      break;
    case 'druid':
      // leaves on the shoulder
      px(ctx, 12, 19 + b, '#6fa356');
      px(ctx, 13, 20 + b, '#4f7f3a');
      px(ctx, 20, 19 + b, '#6fa356');
      break;
    case 'berserker':
      // fur pauldron and a strap across the bare chest
      oval(ctx, 21, 19 + b, 3.5, 2.5, '#7a6248');
      px(ctx, 20, 18 + b, '#9a8268');
      for (let i = 0; i < 9; i++) rect(ctx, 11 + i, 21 + b + Math.floor(i * 0.7), 2, 1, '#5a3b2a');
      // chest shading
      rect(ctx, 14, 22 + b, 1, 3, P.v);
      rect(ctx, 18, 22 + b, 1, 3, P.v);
      break;
    default:
      break;
  }
}

function drawHero(ctx: Ctx, L: Look, p: Pose) {
  const shoulderB: Pt = [10, 20 + p.bob],
    shoulderF: Pt = [22, 20 + p.bob];
  behind(ctx, L, p);
  if (!p.over) arm(ctx, L, shoulderB, p.handB, p.elbowB, true);
  if (!L.robe) legs(ctx, L, p);
  else {
    // feet peeking out under the robe
    const P = L.pal;
    rect(ctx, 10 + p.legB[0], 36 + p.legB[1], 5, 3, shade(P.b, -0.2));
    rect(ctx, 17 + p.legF[0], 36 + p.legF[1], 6, 3, P.b);
    rect(ctx, 17 + p.legF[0], 36 + p.legF[1], 6, 1, shade(P.b, 0.3));
  }
  if (L.robe) torsoRobe(ctx, L, p);
  else torsoArmor(ctx, L, p.bob);
  // head: face then headgear (hoods draw their own face opening)
  const cx = 16.5 + p.head[0],
    cy = 11.5 + p.bob + p.head[1];
  rect(ctx, 14, 16 + p.bob, 5, 3, L.pal.d);
  if (L.head !== 'hood' && L.head !== 'hoodMask') face(ctx, L, p, cx, cy);
  headgear(ctx, L, p, Math.round(cx), Math.round(cy));
  front(ctx, L, p);
  // a two-handed grip: the back arm crosses in front of the body to the shaft
  if (p.over) arm(ctx, L, shoulderB, p.handB, [shoulderB[0] + 3, shoulderB[1] + 6], true);
  arm(ctx, L, shoulderF, p.handF, p.elbowF, false);
}

/** the full animation strip of a class */
export function buildHeroStrip(cl: ClassDef): HTMLCanvasElement {
  const L: Look = { pal: cl.pal, head: cl.id === 'assassin' ? 'hoodMask' : cl.head, robe: cl.body === 'robe', id: cl.id };
  const [strip, sctx] = canvas(HERO_W * POSES.length, HERO_H);
  POSES.forEach((p, i) => {
    const [c, ctx] = canvas(HERO_W, HERO_H);
    drawHero(ctx, L, p);
    outline(c, OUT);
    sctx.drawImage(c, i * HERO_W, 0);
  });
  return strip;
}
