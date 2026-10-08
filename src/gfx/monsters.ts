// The monster families: skeleton knights and necromancers, spiders, ghouls, golems, witches and mages,
// vampires and the aberrations of the void. Drawn like the older monsters: humanoids on the shared
// 16×20 body, creatures by hand, two frames each.
import { rect, px, line, circle, shade, canvas } from './pixel';
import { skeletonStrip, humanoidStrip, creatureStrip, ell, poly, addCanvas } from './textures';

type Ctx = CanvasRenderingContext2D;
const R = Math.round;

// ---------------------------------------------------------------------------
// shared drawers
// ---------------------------------------------------------------------------

/** a spider seen from above, k = size (1 = 18×13) */
function spiderArt(k: number, c: { body: string; head: string; legs: string; eye: string; belly?: number; extra?: (ctx: Ctx, f: number) => void }) {
  return (ctx: Ctx, f: number) => {
    const o = f === 0 ? 0 : 1;
    const cx = 9 * k;
    for (let i = 0; i < 4; i++) {
      const yy = (4 + i * 2 + (i < 2 ? -2 : 2)) * k;
      const sw = i % 2 ? o : -o;
      line(ctx, R(cx - k), R(7 * k), R((2 + sw) * k), R(yy), c.legs);
      line(ctx, R(cx + k), R(7 * k), R((16 - sw) * k), R(yy), c.legs);
    }
    const bb = c.belly ?? 1;
    ell(ctx, cx, 8 * k + (bb - 1) * 2 * k, 4 * k * bb, 3.5 * k * bb, c.body);
    ell(ctx, cx, 4.5 * k, 3 * k, 2.5 * k, c.head);
    px(ctx, R(cx - k), R(4 * k), c.eye);
    px(ctx, R(cx + k), R(4 * k), c.eye);
    c.extra?.(ctx, f);
  };
}

/** a blocky golem (19×19) */
function golemArt(a: string, b: string, c: string, eye: string) {
  return (ctx: Ctx, f: number) => {
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
  };
}

/** a four-legged beast facing right (w ≈ 20) */
function beastArt(col: string, dark: string, eye: string, extra?: (ctx: Ctx, f: number) => void) {
  return (ctx: Ctx, f: number) => {
    const o = f === 0 ? 0 : 1;
    rect(ctx, 4, 10, 2, 5 - o, dark);
    rect(ctx, 7, 10, 2, 4 + o, dark);
    rect(ctx, 12, 10, 2, 5 - o, dark);
    rect(ctx, 15, 10, 2, 4 + o, dark);
    ell(ctx, 10, 8, 7.5, 4, col);
    ell(ctx, 16.5, 5.5, 3.2, 2.8, col);
    poly(ctx, [15, 3.5, 15.5, 1, 17, 3], col);
    rect(ctx, 18.5, 6, 1.5, 1.5, dark);
    line(ctx, 3, 7, 0, 5 - o, col);
    px(ctx, 17, 5, eye);
    extra?.(ctx, f);
  };
}

// ---------------------------------------------------------------------------
// the undead
// ---------------------------------------------------------------------------
function buildUndead() {
  const bone = { s: '#e8e2cf', d: '#b9b29c', e: '#1a1420' };
  skeletonStrip('en_skelKnight', { ...bone, e: '#7fb2ff' }, { sword: true, helm: '#6a7480', plate: '#7a8490', kite: '#2f5a9a' });
  skeletonStrip('en_skelMage', { ...bone, e: '#c77dff' }, { hood: '#3a2a5a', staff: '#c77dff', cape: '#2a1e40' });
  skeletonStrip('en_boneSniper', { s: '#d8d0b8', d: '#a8a088', e: '#ff3b3b' }, { hood: '#2e3a2a', cape: '#3a4a32', crossbow: true });
  // the necromancer: black robe, a pale face and a staff crowned with a skull
  humanoidStrip('en_necromancer', 'hood', 'robe', { h: '#1a1a1a', j: '#0a0a0a', i: '#2e2e2e', s: '#a8b8a0', d: '#1a221a', e: '#5aff8a', c: '#1e241e', v: '#101410', w: '#2e3a2e', u: '#1e241e', a: '#5aff8a', l: '#3a5a3a', b: '#0a0a0a', g: '#a8b8a0' }, (ctx, ox, f) => {
    const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
    line(ctx, ox + 14, 5 + b, ox + 14, 19, '#4a3a2a');
    rect(ctx, ox + 13, 1 + b, 3, 3, '#e8e2cf');
    px(ctx, ox + 13, 2 + b, '#1a1420');
    px(ctx, ox + 15, 2 + b, '#1a1420');
    px(ctx, ox + 14, 4 + b, '#e8e2cf');
    px(ctx, ox + 14, 0 + b, '#5aff8a');
  });
  // the bone giant: a hulking skeleton with a club
  creatureStrip('en_boneGiant', 26, 28, 2, (ctx, f) => {
    const b = f === 0 ? 0 : 1;
    const bn = '#e8e2cf',
      bd = '#b9b29c',
      dk = '#1a1420';
    rect(ctx, 8, 20, 3, 7 - b, bd);
    rect(ctx, 15, 20, 3, 6 + b, bd);
    rect(ctx, 7, 26 - b, 5, 2, bn);
    rect(ctx, 14, 25 + b, 5, 2, bn);
    rect(ctx, 7, 18, 12, 3, bn);
    rect(ctx, 12, 19, 2, 1, dk);
    rect(ctx, 12, 9 + b, 2, 10 - b, bd);
    for (let i = 0; i < 4; i++) rect(ctx, 6 + i, 10 + i * 2 + b, 14 - i * 2, 1, bn);
    rect(ctx, 3, 8 + b, 20, 2, bn);
    rect(ctx, 2, 9 + b, 3, 10, bd);
    rect(ctx, 21, 9 + b, 3, 8, bd);
    rect(ctx, 1, 18 + b, 4, 2, bn);
    // the club
    line(ctx, 22, 17 + b, 24, 5 + b, '#6a4a2a');
    ell(ctx, 24, 5 + b, 2.2, 3.2, '#8a6a4a');
    px(ctx, 25, 3 + b, '#e8e2cf');
    px(ctx, 22, 5 + b, '#e8e2cf');
    // the skull
    ell(ctx, 13, 4 + b, 5, 4.2, bn);
    rect(ctx, 10, 6 + b, 7, 3, bn);
    rect(ctx, 10, 4 + b, 2, 2, dk);
    rect(ctx, 14, 4 + b, 2, 2, dk);
    px(ctx, 10, 4 + b, '#ff4a2a');
    px(ctx, 15, 4 + b, '#ff4a2a');
    rect(ctx, 11, 8 + b, 5, 1, dk);
    px(ctx, 12, 8 + b, bn);
    px(ctx, 14, 8 + b, bn);
  });
}

// ---------------------------------------------------------------------------
// spiders
// ---------------------------------------------------------------------------
function buildSpiders() {
  creatureStrip('en_spiderling', 12, 9, 2, spiderArt(0.66, { body: '#6a4a32', head: '#7a5a3e', legs: '#3a281c', eye: '#ffde3b' }));
  creatureStrip('en_webSpider', 18, 13, 2, spiderArt(1, {
    body: '#d8d4cc',
    head: '#b8b0a8',
    legs: '#7a746c',
    eye: '#ff3b3b',
    extra: (ctx) => {
      // a web drawn on its back
      line(ctx, 9, 6, 9, 11, '#8a847c');
      line(ctx, 6, 8, 12, 8, '#8a847c');
      px(ctx, 7, 7, '#8a847c');
      px(ctx, 11, 7, '#8a847c');
      px(ctx, 7, 10, '#8a847c');
      px(ctx, 11, 10, '#8a847c');
    },
  }));
  creatureStrip('en_blastSpider', 16, 14, 2, spiderArt(0.9, {
    body: '#ff8a2a',
    head: '#4a2a1a',
    legs: '#3a2014',
    eye: '#ffde3b',
    belly: 1.2,
    extra: (ctx, f) => {
      ell(ctx, 7, 7.5, 1.6, 1.2, f ? '#fff2a8' : '#ffd060');
      px(ctx, 9, 10, '#c83a10');
      px(ctx, 6, 10, '#c83a10');
    },
  }));
  creatureStrip('en_spiderGuard', 22, 16, 2, spiderArt(1.22, {
    body: '#2a2a34',
    head: '#3a3a46',
    legs: '#1a1a22',
    eye: '#ff3b3b',
    extra: (ctx, f) => {
      // armour plates and big mandibles
      rect(ctx, 8, 8, 6, 1, '#6a6a7a');
      rect(ctx, 7, 10, 8, 1, '#6a6a7a');
      rect(ctx, 8, 12, 6, 1, '#6a6a7a');
      px(ctx, 9, 2 - f, '#c8c0b0');
      px(ctx, 13, 2 - f, '#c8c0b0');
      px(ctx, 10, 1, '#c8c0b0');
      px(ctx, 12, 1, '#c8c0b0');
    },
  }));
  creatureStrip('en_spiderMother', 28, 22, 2, spiderArt(1.55, {
    body: '#4a2a52',
    head: '#3a2040',
    legs: '#24142a',
    eye: '#ff4dff',
    belly: 1.25,
    extra: (ctx, f) => {
      // egg sacs on her back and the purple marks
      for (const [x, y] of [[11, 12], [17, 12], [14, 15], [10, 16], [18, 16]]) {
        ell(ctx, x, y + f * 0.5, 1.8, 1.5, '#e8dcc8');
        px(ctx, x, y, '#c8a8a8');
      }
      px(ctx, 14, 11, '#c77dff');
      px(ctx, 13, 13, '#c77dff');
      px(ctx, 15, 13, '#c77dff');
    },
  }));
  creatureStrip('en_spiderEgg', 12, 12, 2, (ctx, f) => {
    const g = f ? 0.4 : 0;
    ell(ctx, 6, 6.5, 4.4 + g, 4.8 + g, '#e8e0d0');
    ell(ctx, 5, 5, 1.6, 2, '#fffaf0');
    line(ctx, 4, 8, 6, 10, '#c8a0a0');
    line(ctx, 8, 4, 9, 7, '#c8a0a0');
    px(ctx, 7, 7, f ? '#6a4a32' : '#8a6a52');
  });
}

// ---------------------------------------------------------------------------
// ghouls
// ---------------------------------------------------------------------------
function ghoulPal(skin: string, dark: string, eye: string, rag: string) {
  return { s: skin, d: dark, e: eye, y: '#f0ead8', u: rag, c: shade(rag, 0.1), v: shade(rag, -0.3), w: shade(rag, 0.25), a: shade(rag, -0.45), l: shade(rag, -0.45), g: skin, p: rag, q: shade(rag, -0.35), b: dark };
}

function claws(ctx: Ctx, ox: number, f: number) {
  const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
  px(ctx, ox + 3, 13 + b, '#e8e2cf');
  px(ctx, ox + 12, 13 + b, '#e8e2cf');
  px(ctx, ox + 3, 14 + b, '#e8e2cf');
  px(ctx, ox + 12, 14 + b, '#e8e2cf');
}

function buildGhouls() {
  humanoidStrip('en_ghoul', 'ghoul', 'armor', ghoulPal('#8a9a84', '#5a6a56', '#ffde3b', '#5a5048'), claws);
  humanoidStrip('en_hungryGhoul', 'ghoul', 'armor', ghoulPal('#b08a7a', '#7a5a4e', '#ff6a3a', '#4a3a32'), (ctx, ox, f) => {
    const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
    claws(ctx, ox, f);
    // a bloated belly and a bloody mouth
    ell(ctx, ox + 7.5, 12 + b, 3.2, 2.2, '#c09a8a');
    px(ctx, ox + 7, 12 + b, '#7a5a4e');
    px(ctx, ox + 6, 7 + b, '#c81a2a');
    px(ctx, ox + 9, 7 + b, '#c81a2a');
  });
  humanoidStrip('en_plagueGhoul', 'ghoul', 'armor', ghoulPal('#8aa860', '#5a7a3a', '#e8ff6a', '#4a5a32'), (ctx, ox, f) => {
    const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
    claws(ctx, ox, f);
    // boils and a wisp of plague
    px(ctx, ox + 5, 4 + b, '#c8e86a');
    px(ctx, ox + 10, 6 + b, '#c8e86a');
    px(ctx, ox + 6, 11 + b, '#c8e86a');
    px(ctx, ox + 1 + (f % 2), 3 + b, '#9dff7a');
    px(ctx, ox + 14 - (f % 2), 9, '#9dff7a');
  });
  humanoidStrip('en_alphaGhoul', 'ghoul', 'armor', ghoulPal('#5a5a66', '#3a3a44', '#ff3b3b', '#3a2a22'), (ctx, ox, f) => {
    const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
    claws(ctx, ox, f);
    // a mane of bone spikes
    for (const x of [4, 6, 9, 11]) px(ctx, ox + x, 1 + b, '#e8e2cf');
    px(ctx, ox + 3, 9 + b, '#e8e2cf');
    px(ctx, ox + 12, 9 + b, '#e8e2cf');
    px(ctx, ox + 2, 10 + b, '#e8e2cf');
    px(ctx, ox + 13, 10 + b, '#e8e2cf');
  });
  humanoidStrip('en_mutantGhoul', 'ghoul', 'armor', ghoulPal('#9a7aa8', '#6a4a7a', '#ffde3b', '#4a3a4a'), (ctx, ox, f) => {
    const b = f === 1 || f === 3 || f === 5 ? 1 : 0;
    claws(ctx, ox, f);
    // a third eye and a swollen arm
    px(ctx, ox + 7, 3 + b, '#ff4a8a');
    px(ctx, ox + 8, 3 + b, '#ff4a8a');
    rect(ctx, ox + 12, 10 + b, 3, 5, '#8a6a98');
    px(ctx, ox + 14, 15 + b, '#e8e2cf');
    px(ctx, ox + 12, 15 + b, '#e8e2cf');
  });
}

// ---------------------------------------------------------------------------
// golems
// ---------------------------------------------------------------------------
function buildGolems() {
  creatureStrip('en_crystalGolem', 19, 19, 2, (ctx, f) => {
    golemArt('#8a7ab8', '#5a4a8a', '#c8b8f0', '#7fffff')(ctx, f);
    poly(ctx, [5, 5, 6, 0, 8, 5], '#7fffff');
    poly(ctx, [10, 5, 12, -1, 13, 5], '#b8f8ff');
    poly(ctx, [1, 7 + f, 0, 3 + f, 3, 6 + f], '#7fffff');
    poly(ctx, [15, 7, 18, 3, 18, 7], '#b8f8ff');
    line(ctx, 6, 8, 8, 11, '#c8b8f0');
    px(ctx, 11, 9, '#ffffff');
  });
  creatureStrip('en_stormGolem', 19, 19, 2, (ctx, f) => {
    golemArt('#4a4e5a', '#2e323c', '#6a6e7a', '#fff27a')(ctx, f);
    const c = f ? '#fff7b0' : '#ffd000';
    line(ctx, 7, 7, 9, 9, c);
    line(ctx, 9, 9, 8, 11, c);
    line(ctx, 8, 11, 11, 13, c);
    px(ctx, 13, 7, c);
    px(ctx, 2, 9 + f, c);
    px(ctx, 16, 10 - f, c);
  });
  creatureStrip('en_brokenGolem', 19, 19, 2, (ctx, f) => {
    golemArt('#7d7a72', '#5e5b55', '#9d9a92', '#ffb33b')(ctx, f);
    // cracks and a missing chunk of the shoulder
    ctx.clearRect(13, 5, 3, 2);
    ctx.clearRect(4, 12, 2, 2);
    line(ctx, 6, 6, 8, 9, '#3a3832');
    line(ctx, 8, 9, 7, 12, '#3a3832');
    line(ctx, 11, 7, 13, 10, '#3a3832');
    px(ctx, 9, 2, '#3a3832');
    px(ctx, 10, 3, '#ff8a2a');
  });
}

// ---------------------------------------------------------------------------
// the cult: witches, priests and mages
// ---------------------------------------------------------------------------
function bob(f: number) {
  return f === 1 || f === 3 || f === 5 ? 1 : 0;
}

function buildCult() {
  humanoidStrip('en_hexWitch', 'witch', 'robe', { h: '#4a2a6a', j: '#2e1a44', a: '#7be05a', s: '#a8c890', d: '#78966a', e: '#ffde3b', c: '#4a2a6a', v: '#2e1a44', w: '#6a3a8a', u: '#4a2a6a', l: '#7be05a', b: '#1a1020', g: '#a8c890' }, (ctx, ox, f) => {
    const b = bob(f);
    circle(ctx, ox + 13, 12 + b, 1, '#7be05a');
    px(ctx, ox + 13, 12 + b, '#e8ffd0');
    px(ctx, ox + 14, 10 + b, f % 2 ? '#9dff7a' : '#4fae3a');
  });
  humanoidStrip('en_bloodWitch', 'witch', 'robe', { h: '#6a0f1a', j: '#40080f', a: '#c0101a', s: '#f0d8d8', d: '#c8a8a8', e: '#ff2a3a', c: '#6a0f1a', v: '#40080f', w: '#8a1a2a', u: '#6a0f1a', l: '#c0101a', b: '#1a0a0a', g: '#f0d8d8' }, (ctx, ox, f) => {
    const b = bob(f);
    ell(ctx, ox + 13, 12 + b, 1.2, 1.6, '#c0101a');
    px(ctx, ox + 13, 11 + b, '#ff8a8a');
    px(ctx, ox + 13, 15 + (f % 3), '#c0101a');
  });
  humanoidStrip('en_darkPriest', 'hood', 'robe', { h: '#2a1a1a', j: '#140c0c', i: '#4a2a2a', s: '#d8c0b0', d: '#2a1a1a', e: '#ff5a3a', c: '#3a1414', v: '#1e0a0a', w: '#5a2020', u: '#3a1414', a: '#e9b949', l: '#e9b949', b: '#120808', g: '#d8c0b0' }, (ctx, ox, f) => {
    const b = bob(f);
    // an inverted golden sign on the chest and a smoking censer
    rect(ctx, ox + 7, 10 + b, 2, 3, '#e9b949');
    rect(ctx, ox + 6, 12 + b, 4, 1, '#e9b949');
    line(ctx, ox + 13, 11 + b, ox + 13, 14 + b, '#9a8a6a');
    rect(ctx, ox + 12, 15 + b, 3, 2, '#e9b949');
    px(ctx, ox + 13 + (f % 2), 13 + b, '#c8b8b8');
  });
  humanoidStrip('en_portalMage', 'wizard', 'robe', { h: '#1f6a6a', i: '#2f8a8a', a: '#7dffef', s: '#e8c8a8', y: '#d8d8e0', e: '#1b1b2a', d: '#c09878', c: '#1f5a6a', v: '#123c46', w: '#2f7a8a', u: '#1f5a6a', l: '#7dffef', b: '#12242a', g: '#e8c8a8' }, (ctx, ox, f) => {
    const b = bob(f);
    circle(ctx, ox + 13, 11 + b, 2, '#3a1a6a');
    circle(ctx, ox + 13, 11 + b, 1, '#b07dff');
    px(ctx, ox + 13 + (f % 2 ? 1 : -1), 11 + b, '#7dffef');
  });
  humanoidStrip('en_timeMage', 'wizard', 'robe', { h: '#1a2a6a', i: '#2a3a8a', a: '#e9b949', s: '#f1c39b', y: '#e8e8f0', e: '#1b1b2a', d: '#c98f6b', c: '#1a2a6a', v: '#101a46', w: '#2a3a8a', u: '#1a2a6a', l: '#e9b949', b: '#0a1230', g: '#f1c39b' }, (ctx, ox, f) => {
    const b = bob(f);
    // an hourglass on the chest
    rect(ctx, ox + 6, 9 + b, 4, 1, '#e9b949');
    rect(ctx, ox + 6, 13 + b, 4, 1, '#e9b949');
    px(ctx, ox + 7, 10 + b, '#bfefff');
    px(ctx, ox + 8, 10 + b, '#bfefff');
    px(ctx, ox + 7, 11 + b, '#e9b949');
    px(ctx, ox + 8, 12 + b, '#ffe17a');
    px(ctx, ox + 7, 12 + b, '#ffe17a');
  });
  humanoidStrip('en_illusionist', 'hoodMask', 'robe', { h: '#8a2a7a', j: '#5a1a50', i: '#b04aa0', s: '#e8c8d8', d: '#5a1a50', e: '#ffffff', m: '#f0f0f0', c: '#8a2a7a', v: '#5a1a50', w: '#b04aa0', u: '#8a2a7a', a: '#ffffff', l: '#ffd23a', b: '#2a0a26', g: '#e8c8d8' }, (ctx, ox, f) => {
    const b = bob(f);
    px(ctx, ox + 6, 15 + b, '#ffd23a');
    px(ctx, ox + 9, 16, '#ffd23a');
    px(ctx, ox + 1 + (f % 2) * 13, 5 + b, '#ffb8f0');
  });
  humanoidStrip('en_mindMage', 'bald', 'robe', { s: '#c8b0e0', i: '#e0d0f0', a: '#ff6ac8', e: '#ff6ac8', d: '#9a80b8', c: '#5a2a7a', v: '#3a1a52', w: '#7a3a9a', u: '#5a2a7a', l: '#ff6ac8', b: '#1a0a26', g: '#c8b0e0' }, (ctx, ox, f) => {
    const b = bob(f);
    // a third eye and a swirl of thought
    px(ctx, ox + 7, 5 + b, '#ffffff');
    px(ctx, ox + 8, 5 + b, '#ff6ac8');
    px(ctx, ox + 12 + (f % 2), 1 + b, '#ff9ae0');
    px(ctx, ox + 3 - (f % 2), 2 + b, '#ff9ae0');
  });
  humanoidStrip('en_mageHunter', 'hoodMask', 'armor', { h: '#2a2a2a', j: '#141414', i: '#3a3a3a', s: '#d8b090', d: '#1a1a1a', e: '#ff3b3b', m: '#3a3a3a', u: '#3a2e24', c: '#2e241c', v: '#1e1812', w: '#4a3a2a', a: '#9aa3ad', l: '#5a4030', p: '#2a221a', q: '#1a140e', b: '#141010', g: '#d8b090' }, (ctx, ox, f) => {
    const b = bob(f);
    // two blades
    line(ctx, ox + 1, 9 + b, ox + 3, 13 + b, '#d5dbe0');
    line(ctx, ox + 14, 9 + b, ox + 12, 13 + b, '#d5dbe0');
    px(ctx, ox + 7, 10 + b, '#7fd8ff');
  });
  humanoidStrip('en_goblinShaman', 'goblin', 'robe', { s: '#7fbf4a', d: '#5a8f32', e: '#ffde3b', c: '#6a4a2a', v: '#4a3220', w: '#8a6a3a', u: '#6a4a2a', a: '#e8e2cf', l: '#e8e2cf', b: '#2e2216', g: '#7fbf4a' }, (ctx, ox, f) => {
    const b = bob(f);
    // a feather, a bone necklace and a staff glowing with healing
    px(ctx, ox + 8, 1 + b, '#ff5a3a');
    px(ctx, ox + 8, 0 + b, '#ffd23a');
    line(ctx, ox + 14, 6 + b, ox + 14, 19, '#6a4a2a');
    circle(ctx, ox + 14, 4 + b, 1, '#52ff8f');
    px(ctx, ox + 14, 4 + b, '#e8ffe8');
  });
}

// ---------------------------------------------------------------------------
// the rest: greenskins, vampires, aberrations
// ---------------------------------------------------------------------------
function buildOthers() {
  humanoidStrip('en_orcBerserker', 'orc', 'armor', { s: '#6f9a40', j: '#c81a1a', d: '#4a7a2c', e: '#ff3b3b', y: '#f5f0e0', u: '#6a4a2a', c: '#6f9a40', v: '#4a7a2c', w: '#8aba5a', a: '#c81a1a', l: '#3a2a1a', p: '#5a3a22', q: '#3e2816', b: '#222', g: '#6f9a40' }, (ctx, ox, f) => {
    const b = bob(f);
    // two axes
    line(ctx, ox + 1, 8 + b, ox + 2, 14 + b, '#6a4a2a');
    rect(ctx, ox + 0, 7 + b, 2, 3, '#9aa3ad');
    line(ctx, ox + 14, 8 + b, ox + 13, 14 + b, '#6a4a2a');
    rect(ctx, ox + 14, 7 + b, 2, 3, '#9aa3ad');
  });
  humanoidStrip('en_vampireLord', 'vampire', 'robe', { h: '#1a1420', s: '#f0e8f0', d: '#c0b0c0', e: '#ff2a4a', a: '#c0101a', c: '#4a0a14', v: '#2a0408', w: '#6a1420', u: '#c0101a', l: '#e9b949', b: '#111', g: '#f0e8f0' }, (ctx, ox, f) => {
    const b = bob(f);
    // a golden circlet
    rect(ctx, ox + 5, 2 + b, 6, 1, '#e9b949');
    px(ctx, ox + 7, 1 + b, '#e9b949');
    px(ctx, ox + 8, 1 + b, '#ff2a4a');
  });
  creatureStrip('en_swarmBat', 11, 8, 2, (ctx, f) => {
    const wy = f === 0 ? 1 : 5;
    poly(ctx, [5.5, 4, 0, wy, 2, 6, 5.5, 6], '#6a1a2a');
    poly(ctx, [5.5, 4, 11, wy, 9, 6, 5.5, 6], '#6a1a2a');
    ell(ctx, 5.5, 4.5, 2, 2, '#3a0a14');
    px(ctx, 5, 4, '#ff4d4d');
    px(ctx, 6, 4, '#ff4d4d');
  });
  creatureStrip('en_portal', 16, 20, 2, (ctx, f) => {
    ell(ctx, 8, 10, 7, 9.5, '#5a2aa0');
    ell(ctx, 8, 10, 5.5, 8, '#b07dff');
    ell(ctx, 8, 10, 4, 6.5, '#2a0a4a');
    ell(ctx, 8, 10, 2, 3.5, '#12041e');
    const sp = f ? [[3, 4], [13, 14], [8, 1]] : [[13, 5], [3, 15], [8, 19]];
    for (const [x, y] of sp) px(ctx, x, y, '#f0d8ff');
  }, false);
  creatureStrip('en_manaBeast', 21, 16, 2, beastArt('#2a3a6a', '#1a2448', '#bfefff', (ctx, f) => {
    // crystals growing from its back
    poly(ctx, [6, 5, 7, 0 + f, 9, 5], '#7fd8ff');
    poly(ctx, [9, 5, 11, 1 - f, 12, 5], '#bfefff');
    poly(ctx, [12, 5, 13, 2 + f, 14, 5], '#7fd8ff');
  }));
  creatureStrip('en_buffEater', 18, 16, 2, (ctx, f) => {
    const o = f === 0 ? 0 : 1;
    // tendrils
    for (const [x, d] of [[3, -2], [7, -1], [11, 1], [15, 2]]) line(ctx, x, 12, x + d + o, 15, '#3a1a4a');
    ell(ctx, 9, 8, 8, 6.5 - o * 0.5, '#5a2a6a');
    ell(ctx, 9, 6, 6, 3.5, '#7a3a8a');
    // the maw
    ell(ctx, 9, 10, 5, 2.4 + o, '#1a0a1a');
    for (let i = 0; i < 5; i++) {
      px(ctx, 5 + i * 2, 9, '#f5f0e0');
      px(ctx, 6 + i * 2, 11 + o, '#f5f0e0');
    }
    px(ctx, 5, 5, '#ffde3b');
    px(ctx, 9, 4, '#ffde3b');
    px(ctx, 13, 5, '#ffde3b');
  });
  humanoidStrip('en_mirrorDemon', 'demon', 'armor', { y: '#e8f4ff', s: '#b8c8d8', j: '#8898b0', d: '#8898b0', e: '#ffffff', u: '#c8d8e8', c: '#a8b8c8', v: '#7888a0', w: '#e0ecf8', a: '#7fd8ff', l: '#5a6a80', p: '#8898b0', q: '#5a6a80', b: '#3a4a5a', g: '#b8c8d8' }, (ctx, ox, f) => {
    const b = bob(f);
    // a mirror shard in its hand
    poly(ctx, [ox + 13, 9 + b, ox + 16, 8 + b, ox + 15, 14 + b, ox + 13, 13 + b], '#bfefff');
    px(ctx, ox + 14, 10 + b, '#ffffff');
  });
  creatureStrip('en_adaptive', 18, 16, 2, (ctx, f) => {
    const o = f === 0 ? 0 : 1;
    ell(ctx, 9, 10, 8 - o * 0.5, 5.5 + o * 0.5, '#9a9aa6');
    ell(ctx, 7, 6, 4.5, 4, '#b0b0ba');
    ell(ctx, 12, 7, 4, 3.5 + o * 0.5, '#a4a4ae');
    line(ctx, 3, 11, 7, 12, '#6a6a76');
    line(ctx, 11, 13, 15, 11, '#6a6a76');
    px(ctx, 6, 6, '#ffffff');
    px(ctx, 12, 7, '#ffffff');
    px(ctx, 9, 10 - o, '#ffffff');
    px(ctx, 6, 7, '#1a1420');
    px(ctx, 12, 8, '#1a1420');
    px(ctx, 9, 11 - o, '#1a1420');
  });
}

// ---------------------------------------------------------------------------
// role signs above the dangerous ones (healer, reviver, summoner, guardian, sniper, buffer, curser)
// ---------------------------------------------------------------------------
function buildRoleSigns() {
  const sign = (key: string, ring: string, draw: (ctx: Ctx) => void) => {
    const [c, ctx] = canvas(9, 9);
    circle(ctx, 4, 4, 4, '#16121c');
    circle(ctx, 4, 4, 3, shade(ring, -0.6));
    draw(ctx);
    addCanvas('en_role_' + key, c);
  };
  sign('healer', '#52ff8f', (ctx) => {
    rect(ctx, 4, 2, 1, 5, '#52ff8f');
    rect(ctx, 2, 4, 5, 1, '#52ff8f');
  });
  sign('reviver', '#9dffb0', (ctx) => {
    rect(ctx, 2, 2, 5, 3, '#e8e2cf');
    rect(ctx, 3, 5, 3, 2, '#e8e2cf');
    px(ctx, 3, 3, '#16121c');
    px(ctx, 5, 3, '#16121c');
    px(ctx, 4, 6, '#16121c');
  });
  sign('summoner', '#c77dff', (ctx) => {
    px(ctx, 4, 1, '#e0b8ff');
    rect(ctx, 3, 2, 3, 1, '#c77dff');
    rect(ctx, 1, 3, 7, 1, '#c77dff');
    rect(ctx, 2, 4, 5, 2, '#c77dff');
    px(ctx, 2, 6, '#c77dff');
    px(ctx, 6, 6, '#c77dff');
  });
  sign('guardian', '#7fb2ff', (ctx) => {
    rect(ctx, 2, 2, 5, 3, '#7fb2ff');
    rect(ctx, 3, 5, 3, 1, '#7fb2ff');
    px(ctx, 4, 6, '#7fb2ff');
    rect(ctx, 4, 2, 1, 4, '#e8f0ff');
  });
  sign('sniper', '#ff5a4a', (ctx) => {
    rect(ctx, 4, 1, 1, 7, '#ff5a4a');
    rect(ctx, 1, 4, 7, 1, '#ff5a4a');
    px(ctx, 4, 4, '#16121c');
    px(ctx, 4, 4, '#ffd0c8');
  });
  sign('buffer', '#ffb04a', (ctx) => {
    px(ctx, 4, 1, '#ffb04a');
    rect(ctx, 3, 2, 3, 1, '#ffb04a');
    rect(ctx, 2, 3, 5, 1, '#ffb04a');
    rect(ctx, 4, 4, 1, 3, '#ffb04a');
  });
  sign('curser', '#e07dff', (ctx) => {
    rect(ctx, 2, 3, 5, 3, '#e07dff');
    px(ctx, 1, 4, '#e07dff');
    px(ctx, 7, 4, '#e07dff');
    rect(ctx, 4, 3, 1, 3, '#16121c');
    px(ctx, 4, 4, '#ffe0ff');
  });
}

export function buildMonsters() {
  buildUndead();
  buildSpiders();
  buildGhouls();
  buildGolems();
  buildCult();
  buildOthers();
  buildRoleSigns();
}
