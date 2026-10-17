// Chests 16x14, closed and open: the six plain ones by the rarity they hold, the guardian's hoard and the themed
// chest of every area (its colours and a decoration of its own: icicles, webs, crystals, lava …).
import { rect, px, shade } from './pixel';
import { PLAIN_CHESTS, THEMED_CHESTS } from '../data/chests';
import { RARITIES } from '../data/items';

type Ctx = CanvasRenderingContext2D;

export interface ChestLook {
  body: string;
  dark: string;
  trim: string;
  accent: string;
  /** iron bands across the lid and the body */
  bands?: boolean;
  /** wooden planks */
  plank?: boolean;
  deco?: string;
  /** what gleams inside when it is open */
  glow: string;
}

const W = '#f4f0e4';
const K = '#1a1420';

/** the decorations of the themed chests (and of the best plain ones) */
const DECO: Record<string, (c: Ctx, k: ChestLook, open: boolean) => void> = {
  candles(c, k, open) {
    // wax dripping over the lid, a monk's cross on the front
    if (!open) {
      for (const [x, y] of [[3, 2], [3, 3], [12, 2], [12, 3], [12, 4]]) px(c, x, y, '#efe6cf');
      px(c, 3, 1, k.accent);
      px(c, 12, 1, k.accent);
    }
    rect(c, 7, 9, 2, 4, shade(k.trim, -0.1));
    rect(c, 6, 10, 4, 1, shade(k.trim, -0.1));
  },
  teeth(c, k, open) {
    // a row of fangs along the lid and stripes of red paint
    if (!open) for (let x = 2; x < 14; x += 2) px(c, x, 7, W);
    for (const x of [2, 13]) rect(c, x, 9, 1, 3, k.accent);
    for (let x = 5; x < 11; x += 2) px(c, x, 11, k.accent);
  },
  bones(c, k, open) {
    // crossed bones on the front and a skull for a lock
    for (let i = 0; i < 4; i++) {
      px(c, 3 + i, 9 + (i % 2), k.trim);
      px(c, 12 - i, 9 + (i % 2), k.trim);
    }
    if (!open) {
      rect(c, 6, 4, 4, 4, W);
      px(c, 7, 5, K);
      px(c, 8, 5, K);
      rect(c, 7, 7, 2, 1, shade(W, -0.2));
    }
  },
  barnacles(c, k, open) {
    // shells and dripping seaweed
    for (const [x, y] of [[2, 12], [3, 11], [12, 12], [13, 10], [10, 12]]) px(c, x, y, '#d8d8c8');
    if (!open) for (const [x, y] of [[2, 3], [13, 2], [5, 2]]) px(c, x, y, '#d8d8c8');
    for (const x of [3, 9, 12]) rect(c, x, open ? 3 : 7, 1, 3, k.accent);
  },
  frost(c, k, open) {
    // snow on the lid and icicles under its lip
    if (!open) {
      rect(c, 2, 1, 12, 1, W);
      for (const x of [1, 4, 9, 13]) px(c, x, 2, W);
    }
    for (const [x, h] of [[2, 2], [5, 1], [8, 2], [11, 1], [13, 2]]) rect(c, x, 7, 1, h, '#e8f8ff');
    for (const [x, y] of [[4, 11], [10, 10], [12, 12]]) px(c, x, y, W);
  },
  horns(c, k, open) {
    // two horns and red runes
    if (!open) {
      rect(c, 1, 0, 1, 2, '#e8dcc0');
      rect(c, 14, 0, 1, 2, '#e8dcc0');
      px(c, 0, 0, '#e8dcc0');
      px(c, 15, 0, '#e8dcc0');
    }
    for (const [x, y] of [[3, 9], [3, 11], [12, 9], [12, 11], [5, 10], [10, 10]]) px(c, x, y, k.accent);
  },
  mushroom(c, k, open) {
    // little mushrooms grow on it
    const cap = (x: number, y: number) => {
      rect(c, x - 1, y, 3, 1, k.accent);
      px(c, x, y - 1, k.accent);
      px(c, x - 1, y, W);
      px(c, x, y + 1, '#efe6cf');
    };
    cap(2, 11);
    cap(13, 10);
    if (!open) cap(11, 1);
  },
  web(c, k, open) {
    // cobwebs over the corners
    for (let i = 0; i < 4; i++) {
      px(c, 1 + i, 13 - i, W);
      px(c, 14 - i, 13 - i, W);
    }
    px(c, 1, 11, W);
    px(c, 3, 13, W);
    px(c, 14, 11, W);
    px(c, 12, 13, W);
    if (!open) for (let i = 0; i < 3; i++) px(c, 2 + i, 2 + i, W);
  },
  stripes(c, k, open) {
    // blue stripes like a pharaoh's headdress
    for (const y of [9, 11]) for (let x = 2; x < 14; x++) if (x < 6 || x > 9) px(c, x, y, k.accent);
    if (!open) for (let x = 2; x < 14; x += 2) px(c, x, 3, k.accent);
  },
  roots(c, k, open) {
    // roots creep over it, with a leaf here and there
    for (const [x, y] of [[1, 8], [2, 9], [2, 10], [3, 11], [14, 9], [13, 10], [13, 11], [12, 12]]) px(c, x, y, k.dark);
    for (const [x, y] of [[3, 10], [12, 11], [4, 12]]) px(c, x, y, k.accent);
    if (!open) for (const [x, y] of [[3, 2], [4, 3], [12, 2], [11, 3]]) px(c, x, y, k.accent);
  },
  crystals(c, k, open) {
    // crystals grow from the lid and gleam on the front
    if (!open) {
      rect(c, 3, 0, 1, 2, k.trim);
      rect(c, 12, 0, 1, 2, k.accent);
      px(c, 4, 1, k.accent);
    }
    for (const [x, y] of [[3, 10], [12, 10], [5, 12], [10, 12]]) px(c, x, y, k.trim);
    px(c, 3, 9, W);
    px(c, 12, 9, W);
  },
  runes(c, k, open) {
    // glowing dwarven runes on the bands
    for (const y of [9, 11]) {
      px(c, 4, y, k.accent);
      px(c, 11, y, k.accent);
    }
    if (!open) {
      px(c, 4, 3, k.accent);
      px(c, 11, 3, k.accent);
    }
  },
  skulls(c, k, open) {
    // a skull on the front with red eyes
    rect(c, 6, 9, 4, 3, W);
    px(c, 7, 10, k.accent);
    px(c, 8, 10, k.accent);
    rect(c, 7, 12, 2, 1, shade(W, -0.2));
    if (!open) for (const x of [2, 13]) px(c, x, 3, W);
  },
  bell(c, k, open) {
    // a little bell and the drowned water line
    rect(c, 7, 9, 2, 2, k.trim);
    rect(c, 6, 11, 4, 1, k.trim);
    px(c, 7, 12, k.trim);
    for (let x = 2; x < 14; x++) if (x % 3) px(c, x, 13, k.accent);
  },
  chains(c, k, open) {
    // chains across the front and a padlock
    for (let i = 0; i < 6; i++) {
      px(c, 2 + i * 2, 8 + (i % 2), k.trim);
      px(c, 3 + i * 2, 12 - (i % 2), k.trim);
    }
    if (!open) {
      rect(c, 6, 8, 4, 3, k.trim);
      px(c, 7, 9, K);
    }
  },
  embers(c, k, open) {
    // glowing embers in the charred wood
    for (const [x, y] of [[3, 9], [5, 12], [10, 9], [12, 11], [8, 12]]) px(c, x, y, k.accent);
    if (!open) for (const [x, y] of [[3, 3], [10, 2], [12, 4]]) px(c, x, y, k.accent);
  },
  glow(c, k, open) {
    // the bands still glow from the forge
    for (const x of [1, 4, 11, 14]) rect(c, x, 8, 1, 4, k.accent);
    if (!open) for (const x of [4, 11]) rect(c, x, 2, 1, 3, k.accent);
  },
  slime(c, k, open) {
    // green slime drips over the edge
    for (const [x, h] of [[2, 3], [5, 2], [9, 4], [12, 2]]) rect(c, x, 7, 1, h, k.accent);
    if (!open) rect(c, 2, 1, 4, 1, k.accent);
  },
  lava(c, k, open) {
    // cracks of lava in black glass
    for (const [x, y] of [[2, 9], [3, 10], [4, 10], [5, 11], [10, 8], [11, 9], [11, 10], [12, 11], [7, 12], [8, 12]]) px(c, x, y, k.accent);
    if (!open) for (const [x, y] of [[3, 3], [4, 4], [11, 2], [12, 3]]) px(c, x, y, k.accent);
  },
  gems(c, k, open) {
    // gems set in the bands
    for (const y of [9, 12]) {
      px(c, 4, y, k.accent);
      px(c, 11, y, k.accent);
    }
    if (!open) {
      px(c, 4, 3, k.accent);
      px(c, 11, 3, k.accent);
    }
  },
  stars(c, k, open) {
    // tiny stars in its darkness
    for (const [x, y] of [[3, 9], [6, 12], [10, 10], [12, 12], [13, 9]]) px(c, x, y, k.accent);
    px(c, 2, 11, W);
    if (!open) for (const [x, y] of [[3, 3], [9, 2], [12, 4]]) px(c, x, y, k.accent);
  },
  clouds(c, k, open) {
    // little clouds float round its foot
    rect(c, 1, 12, 4, 2, W);
    rect(c, 2, 11, 2, 1, W);
    rect(c, 11, 12, 4, 2, W);
    rect(c, 12, 11, 2, 1, W);
  },
  mirror(c, k, open) {
    // mirror panes with glints
    for (const x0 of [2, 10]) {
      rect(c, x0, 9, 4, 3, shade(k.body, 0.25));
      px(c, x0 + 1, 9, W);
      px(c, x0 + 2, 10, W);
    }
  },
  nebula(c, k, open) {
    // swirls of a dream
    for (const [x, y] of [[2, 9], [3, 10], [4, 10], [11, 11], [12, 10], [13, 10], [6, 12], [9, 12]]) px(c, x, y, k.accent);
    for (const [x, y] of [[3, 11], [12, 9]]) px(c, x, y, k.trim);
    if (!open) for (const [x, y] of [[3, 3], [4, 3], [11, 2], [12, 3]]) px(c, x, y, k.trim);
  },
  eye(c, k, open) {
    // an eye at the bottom of the world looks back
    rect(c, 5, 9, 6, 3, '#f0d8d0');
    rect(c, 7, 9, 2, 3, k.accent);
    px(c, 7, 10, K);
    px(c, 8, 10, K);
    rect(c, 5, 9, 6, 1, k.dark);
  },
};

/** draws a chest (16x14) */
export const drawChest = (k: ChestLook, open: boolean) => (c: Ctx) => {
  const { body, dark, trim } = k;
  rect(c, 1, 7, 14, 7, body);
  rect(c, 1, 12, 14, 2, dark);
  rect(c, 1, 7, 14, 1, shade(body, 0.15));
  if (k.plank) for (const y of [9, 11]) rect(c, 2, y, 12, 1, shade(body, -0.18));
  rect(c, 1, 7, 1, 7, trim);
  rect(c, 14, 7, 1, 7, trim);
  if (k.bands) {
    rect(c, 4, 7, 1, 7, trim);
    rect(c, 11, 7, 1, 7, trim);
  }
  if (!open) {
    rect(c, 1, 2, 14, 4, shade(body, 0.1));
    rect(c, 2, 1, 12, 1, trim);
    rect(c, 1, 2, 1, 4, trim);
    rect(c, 14, 2, 1, 4, trim);
    rect(c, 1, 6, 14, 1, dark);
    if (k.plank) rect(c, 2, 4, 12, 1, shade(body, -0.12));
    if (k.bands) {
      rect(c, 4, 1, 1, 5, trim);
      rect(c, 11, 1, 1, 5, trim);
    }
    rect(c, 6, 5, 4, 4, trim);
    rect(c, 7, 6, 2, 2, k.accent);
    px(c, 7, 7, K);
    px(c, 8, 7, K);
  } else {
    // the lid thrown back, the inside dark with a gleam of what lies in it
    rect(c, 1, 0, 14, 3, shade(body, -0.12));
    rect(c, 1, 0, 14, 1, trim);
    rect(c, 2, 3, 12, 4, '#140c08');
    rect(c, 3, 4, 10, 2, k.glow);
    px(c, 5, 4, W);
    rect(c, 6, 7, 4, 2, trim);
  }
  if (k.deco) DECO[k.deco]?.(c, k, open);
};

/** every chest look by its texture name (chest_<id>, chest_t<area>) */
export function chestLooks(): [string, ChestLook][] {
  const rc = (r: number) => RARITIES[r]?.color ?? '#ffffff';
  const plain: Record<string, Omit<ChestLook, 'glow'>> = {
    wood: { body: '#9a6630', dark: '#5a3416', trim: '#b89a5a', accent: '#d8b860', plank: true },
    bound: { body: '#7a4e26', dark: '#4a2c12', trim: '#5e6874', accent: '#a8b0b8', plank: true, bands: true },
    iron: { body: '#66727e', dark: '#3a4450', trim: '#c8d0d8', accent: '#58a6ff', bands: true },
    silver: { body: '#a8b4c4', dark: '#5e6a7c', trim: '#f2f6fa', accent: '#bc6ff1', bands: true },
    gold: { body: '#c8902a', dark: '#8a5a14', trim: '#ffe27a', accent: '#ff4a4a', bands: true, deco: 'gems' },
    mythic: { body: '#6a2462', dark: '#3e1238', trim: '#ffc8f0', accent: '#ff4fb4', bands: true, deco: 'stars' },
  };
  const out: [string, ChestLook][] = PLAIN_CHESTS.map((p) => ['chest_' + p.id, { ...plain[p.id], glow: rc(p.rarity) }]);
  out.push(['chest_boss', { body: '#3a1f5a', dark: '#24123a', trim: '#e9b949', accent: '#ff4a4a', bands: true, glow: '#ffd23a' }]);
  THEMED_CHESTS.forEach((t, i) => out.push(['chest_t' + i, { body: t.body, dark: t.dark, trim: t.trim, accent: t.accent, deco: t.deco, bands: true, glow: t.accent }]));
  return out;
}
