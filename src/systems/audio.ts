// Tiny procedural sound effects with WebAudio (no assets needed).
import { TRACKS, MODES, type Track, type Voice } from '../data/music';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const last: Record<string, number> = {};

try {
  muted = localStorage.getItem('loppo-muted') === '1';
} catch {
  /* ignore */
}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) stopMusic();
  else startMusic();
  try {
    localStorage.setItem('loppo-muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.3, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, filterF = 1200, delay = 0, type: BiquadFilterType = 'lowpass') {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterF;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export function sfx(name: string) {
  if (muted) return;
  const now = performance.now();
  const gap = name === 'hit' || name === 'coin' ? 45 : 30;
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  switch (name) {
    case 'swing':
      noise(0.12, 0.12, 2400, 0, 'bandpass');
      break;
    case 'hit':
      noise(0.08, 0.22, 900);
      tone('square', 180, 90, 0.07, 0.06);
      break;
    case 'crit':
      noise(0.1, 0.3, 1500);
      tone('square', 400, 120, 0.12, 0.1);
      break;
    case 'bow':
      tone('triangle', 500, 200, 0.12, 0.15);
      noise(0.06, 0.08, 3000, 0, 'highpass');
      break;
    case 'magic':
      tone('sine', 700, 1200, 0.15, 0.1);
      break;
    case 'spell':
      tone('sawtooth', 300, 900, 0.25, 0.08);
      tone('sine', 600, 1400, 0.25, 0.08);
      break;
    case 'explosion':
      noise(0.45, 0.4, 500);
      tone('sine', 120, 40, 0.4, 0.25);
      break;
    case 'coin':
      tone('square', 1400, 1400, 0.05, 0.06);
      tone('square', 2000, 2000, 0.08, 0.05, 0.05);
      break;
    case 'pickup':
      tone('triangle', 600, 900, 0.1, 0.12);
      break;
    case 'chest':
      tone('triangle', 300, 300, 0.08, 0.15);
      tone('triangle', 450, 450, 0.08, 0.15, 0.08);
      tone('triangle', 700, 700, 0.15, 0.15, 0.16);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.18, 0.08, i * 0.09));
      break;
    case 'hurt':
      tone('sawtooth', 220, 80, 0.15, 0.12);
      break;
    case 'death':
      tone('sawtooth', 300, 40, 0.9, 0.2);
      break;
    case 'enemyDie':
      noise(0.15, 0.15, 700);
      tone('square', 200, 60, 0.15, 0.05);
      break;
    case 'heal':
      tone('sine', 500, 1000, 0.3, 0.1);
      break;
    case 'door':
      noise(0.3, 0.2, 400);
      tone('square', 90, 60, 0.3, 0.08);
      break;
    case 'ui':
      tone('square', 800, 800, 0.03, 0.05);
      break;
    case 'type': {
      // a soft tick while a cutscene line is being written
      const f = 520 + Math.random() * 140;
      tone('triangle', f, f, 0.025, 0.035);
      break;
    }
    case 'stairs':
      [400, 300, 200].forEach((f, i) => tone('triangle', f, f * 0.8, 0.15, 0.12, i * 0.12));
      break;
    case 'thunder':
      noise(1.1, 0.16, 260);
      tone('sine', 70, 38, 1, 0.12);
      break;
    case 'rumble':
      noise(0.8, 0.1, 160);
      break;
    case 'summon':
      noise(0.35, 0.12, 900, 0, 'bandpass');
      tone('sine', 220, 520, 0.3, 0.06);
      break;
    case 'shout':
      // the tank's battle cry
      tone('sawtooth', 160, 110, 0.28, 0.09);
      tone('square', 240, 170, 0.22, 0.05, 0.02);
      noise(0.2, 0.06, 700);
      break;
    case 'pet':
      // a happy little chirp
      tone('sine', 880, 1320, 0.08, 0.07);
      tone('sine', 1320, 1760, 0.1, 0.06, 0.09);
      break;
    case 'boss':
      tone('sawtooth', 80, 60, 1.2, 0.2);
      tone('sawtooth', 120, 90, 1.2, 0.15);
      break;
    case 'lockOk':
      tone('square', 900, 900, 0.05, 0.08);
      tone('square', 1300, 1300, 0.08, 0.08, 0.06);
      break;
    case 'lockFail':
      tone('square', 200, 100, 0.2, 0.1);
      break;
    case 'upgrade':
      tone('square', 600, 1200, 0.2, 0.08);
      noise(0.1, 0.15, 3000, 0, 'highpass');
      break;
    case 'step':
      noise(0.07, 0.12, 380);
      break;
    case 'unsheathe':
      // steel sliding out of the scabbard with a short ring
      noise(0.16, 0.07, 5200, 0, 'highpass');
      tone('triangle', 1700, 2500, 0.14, 0.03, 0.03);
      break;
    case 'sheathe':
      noise(0.15, 0.06, 2600, 0, 'bandpass');
      tone('square', 300, 200, 0.05, 0.035, 0.13);
      break;
  }
}

// ---------------------------------------------------------------------------
// Settings shared with the UI (persisted)
// ---------------------------------------------------------------------------
export type LootRule = 'keep' | 'sell' | 'salvage';
export const settings = {
  music: true,
  vibrate: true,
  uiScale: 1,
  autoSalvage: 0,
  lowFx: false,
  /** graphics level: 0 very low (very weak phones), 1 low, 2 medium, 3 high (-1: not chosen yet, guessed from the
   *  device); lowFx follows it (true on the two lowest levels) */
  gfx: -1,
  /** what happens to a picked-up item of each rarity: kept, sold at once or salvaged at once */
  lootRules: [] as LootRule[],
  /** items better than the equipped ones are always kept */
  keepUpgrades: true,
  /** the qualities ticked last time in "sell by quality" */
  sellPick: [0, 1] as number[],
};
try {
  const raw = localStorage.getItem('loppo-settings');
  if (raw) Object.assign(settings, JSON.parse(raw));
} catch {
  /* ignore */
}
// the old single setting ("salvage commons", "salvage commons and uncommons") becomes per-rarity rules
if (!Array.isArray(settings.lootRules) || !settings.lootRules.length) {
  settings.lootRules = [];
  for (let r = 0; r < settings.autoSalvage; r++) settings.lootRules[r] = 'salvage';
}
/** a first guess of the graphics level from the device (a phone with little memory or few cores gets less) */
function guessGfx(): number {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
    const mem = nav.deviceMemory ?? 4;
    const cores = nav.hardwareConcurrency ?? 4;
    if (!mobile) return 3;
    if (mem <= 2 || cores <= 2) return 0;
    if (mem <= 3 || cores <= 4) return 1;
    return 2;
  } catch {
    return 2;
  }
}
if (typeof settings.gfx !== 'number' || settings.gfx < 0 || settings.gfx > 3) settings.gfx = settings.lowFx ? 1 : guessGfx();
settings.lowFx = settings.gfx <= 1;

export const GFX_NAMES = ['velmi nízká', 'nízká', 'střední', 'vysoká'];
export const GFX_HINTS = ['pro velmi slabé telefony: bez světel, počasí a záře, málo částic', 'pro slabší telefony: bez dynamických světel a počasí, méně částic', 'pro běžné telefony: světla a počasí, šetrné záře', 'pro výkonné telefony a počítače: všechno včetně zářících obrysů'];
/** the graphics level (see settings.gfx) */
export const gfxLevel = () => settings.gfx;
/** how many particles an effect gets on this graphics level */
export const gfxParticles = (n: number) => (settings.gfx <= 0 ? Math.max(1, Math.ceil(n / 4)) : settings.gfx === 1 ? Math.ceil(n / 2) : settings.gfx >= 3 ? Math.round(n * 1.25) : n);
export function setGfx(level: number) {
  settings.gfx = Math.max(0, Math.min(3, level));
  settings.lowFx = settings.gfx <= 1;
  saveSettings();
}

export function saveSettings() {
  try {
    localStorage.setItem('loppo-settings', JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** set by the controller support: shakes the gamepad together with the phone */
export const rumbleHook: { fn: ((ms: number) => void) | null } = { fn: null };

export function vibrate(ms = 25) {
  if (!settings.vibrate) return;
  rumbleHook.fn?.(ms);
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Procedural music: a small sequencer plays the track of the place (data/music.ts). Every area, the village,
// the menu and the guardians have their own; a new track fades in while the old one fades out. The notes are
// scheduled a quarter of a second ahead on the audio clock, so a busy frame does not make the music stumble.
// ---------------------------------------------------------------------------
interface MNote {
  d: number;
  len: number;
}
type Phrase = (MNote | undefined)[];

interface Song {
  id: string;
  tr: Track;
  scale: readonly number[];
  /** steps in a bar and the length of one step (a sixteenth) in seconds */
  per: number;
  dur: number;
  base: number;
  out: GainNode;
  /** the chords go through a lowpass (the colour of the track); the melody and the bells also into the echo */
  padF: BiquadFilterNode;
  send: GainNode;
  nodes: AudioNode[];
  hold: AudioScheduledSourceNode[];
  step: number;
  t: number;
  rnd: () => number;
  /** the four phrases of a section: the theme asked, answered, a second idea, the answer again */
  phr: Phrase[];
}

const MUSIC_VOL = 0.17;
let musicBus: GainNode | null = null;
let song: Song | null = null;
let wantTrack = 'menu';
let clock: ReturnType<typeof setInterval> | null = null;
let noiseBuf: AudioBuffer | null = null;
const waves = new WeakMap<BaseAudioContext, Record<string, PeriodicWave>>();

/** the track that should play now (it starts as soon as the music may); `fade` seconds of crossfade */
export function setMusicTrack(id: string, fade = 1.8) {
  if (!TRACKS[id]) return;
  wantTrack = id;
  if (!song || song.id === id) return;
  const c = ac();
  if (!c) return;
  fadeOut(song, c, fade);
  song = makeSong(c, id, fade);
}

/** the track that plays (or would play) */
export const musicTrack = () => song?.id ?? wantTrack;

/** a fight in its last phase: the music hurries (0 normal, 1 faster, 2 much faster) */
export function musicUrgency(level: number) {
  if (song) song.dur = song.base / (1 + 0.07 * Math.max(0, Math.min(2, level)));
}

export function startMusic() {
  if (song || muted || !settings.music) return;
  const c = ac();
  if (!c || !master) return;
  song = makeSong(c, wantTrack, 3);
  clock ??= setInterval(tick, 50);
}

export function stopMusic() {
  if (clock) clearInterval(clock);
  clock = null;
  if (!song) return;
  const c = ac();
  if (c) fadeOut(song, c, 0.5);
  song = null;
}

/** for tests: the first `sec` seconds of a track rendered offline (to measure how loud it is) */
export async function renderMusic(id: string, sec = 16, rate = 22050) {
  const oc = new OfflineAudioContext(1, Math.ceil(rate * sec), rate);
  const s = makeSong(oc, id, 0.6, oc.destination);
  while (s.t < sec) {
    playStep(oc, s, s.t);
    s.t += s.dur;
    s.step++;
  }
  return oc.startRendering();
}

// a phone puts the game away: the sound sleeps with it
try {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (!muted) void ctx.resume();
  });
} catch {
  /* no document */
}

function bus(c: BaseAudioContext) {
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.gain.value = MUSIC_VOL;
    musicBus.connect(master!);
  }
  return musicBus;
}

function makeSong(c: BaseAudioContext, id: string, fade: number, dest: AudioNode = bus(c)): Song {
  const tr = TRACKS[id];
  const t0 = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.linearRampToValueAtTime(tr.vol ?? 1, t0 + Math.max(0.6, fade));
  out.connect(dest);
  const padF = c.createBiquadFilter();
  padF.type = 'lowpass';
  padF.frequency.value = tr.cutoff;
  padF.Q.value = 0.5;
  padF.connect(out);
  const per = (tr.meter ?? 4) * 4;
  const dur = 60 / tr.bpm / 4;
  // the echo: a dotted eighth, darker with every repeat
  const echo = c.createDelay(2);
  echo.delayTime.value = Math.min(1.9, dur * 3);
  const fb = c.createGain();
  fb.gain.value = tr.echo;
  const dark = c.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 2400;
  const send = c.createGain();
  send.gain.value = 0.32;
  send.connect(echo);
  echo.connect(dark);
  dark.connect(fb);
  fb.connect(echo);
  dark.connect(out);
  const s: Song = { id, tr, scale: MODES[tr.mode], per, dur, base: dur, out, padF, send, nodes: [out, padF, echo, fb, dark, send], hold: [], step: 0, t: t0 + 0.1, rnd: seeded(hash(id) + (tr.seed ?? 0)), phr: [] };
  const a = motif(s, 4);
  s.phr = [a, answer(s, a), motif(s, 2), answer(s, a)];
  if (tr.drone) drone(c, s);
  if (tr.extra === 'wind') wind(c, s);
  return s;
}

function fadeOut(s: Song, c: BaseAudioContext, sec: number) {
  const t = c.currentTime;
  const g = s.out.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(0.0001, t + sec);
  for (const h of s.hold) {
    try {
      h.stop(t + sec + 0.1);
    } catch {
      /* stopped already */
    }
  }
  setTimeout(() => s.nodes.forEach((n) => n.disconnect()), (sec + 0.5) * 1000);
}

function tick() {
  const s = song;
  if (!s || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  // after a pause (a hidden tab, a busy phone) jump ahead instead of hurrying through the missed notes
  if (s.t < now - 0.2) s.t = now + 0.05;
  while (s.t < now + 0.25) {
    try {
      playStep(ctx, s, s.t);
    } catch {
      /* a note that cannot play is not worth a crash */
    }
    s.t += s.dur;
    s.step++;
  }
}

/** broken chords (degrees above the chord's root): up and down, one round in a bar of three */
const ARP4 = [0, 2, 4, 7, 9, 7, 4, 2];
const ARP3 = [0, 2, 4, 7, 4, 2];

function playStep(c: BaseAudioContext, s: Song, t: number) {
  const tr = s.tr;
  const per = s.per;
  const meter = per / 4;
  const st = s.step % per;
  const bar = Math.floor(s.step / per);
  const cb = tr.chordBars ?? 1;
  const chord = tr.prog[Math.floor(bar / cb) % tr.prog.length];
  const sec = Math.floor(bar / 8);
  const inSec = bar % 8;
  const beat = s.dur * 4;
  // the weakest phones get the broken chords in eighths only
  const lite = settings.gfx <= 0;
  // the first two bars only set the scene; every fourth section of eight bars the melody rests (not in a fight)
  const intro = bar < 2;
  const calm = !tr.battle && sec % 4 === 3;
  // a new second idea every 32 bars, so a long stay does not wear the tune out
  if (st === 0 && inSec === 0 && sec > 0 && sec % 4 === 0) s.phr[2] = motif(s, s.rnd() < 0.5 ? 2 : 4);

  // the chords
  if (st === 0 && bar % cb === 0 && tr.pad) {
    const len = beat * meter * cb;
    const root = pitch(s, chord);
    const tones = tr.fifths ? [root, root + 7, root + 12] : [0, 2, 4].map((k) => pitch(s, chord + k));
    for (const m of tones) play(c, tr.pad, m, t, len * 0.98, 0.3, s.padF);
  }

  // the bass
  const bv = tr.bassVoice ?? 'tri';
  const root = pitch(s, chord, -1);
  const fifth = pitch(s, chord + 4, -1);
  switch (tr.bass) {
    case 'long':
      if (st === 0 && bar % cb === 0) play(c, bv, root, t, beat * meter * cb * 0.95, 0.42, s.out);
      break;
    case 'beat':
      if (st % 4 === 0) play(c, bv, meter === 4 && st === 8 ? fifth : root, t, beat * 0.8, st === 0 ? 0.48 : 0.36, s.out);
      break;
    case 'pulse':
      if (st % 2 === 0) play(c, bv, st % 8 === 6 ? root + 12 : root, t, s.dur * 1.6, st % 4 === 0 ? 0.4 : 0.28, s.out);
      break;
    case 'gallop':
      if (st % 4 !== 1) play(c, bv, st >= per - 4 ? fifth : root, t, s.dur * 0.9, st % 4 === 0 ? 0.42 : 0.28, s.out);
      break;
    case 'march':
      if (st === 0) play(c, bv, root, t, beat * 1.4, 0.46, s.out);
      else if (st === per / 2) play(c, bv, fifth, t, beat * 1.2, 0.38, s.out);
      else if (st === per - 2) play(c, bv, root, t, s.dur * 1.5, 0.26, s.out);
      break;
    case 'waltz':
      if (st === 0) play(c, bv, root, t, beat * 0.9, 0.46, s.out);
      else if (st % 4 === 0) for (const k of [0, 2, 4]) play(c, tr.arpVoice ?? 'pluck', pitch(s, chord + k), t, beat * 0.45, 0.12, s.out);
      break;
  }

  // the broken chords
  const fast = tr.arp === 2 && !lite;
  if (tr.arp && st % (fast ? 1 : 2) === 0) {
    const pat = meter === 3 ? ARP3 : ARP4;
    const i = (fast ? st : st / 2) % pat.length;
    play(c, tr.arpVoice ?? 'pluck', pitch(s, chord + pat[i], 1), t, s.dur * 1.8, (st % 4 === 0 ? 0.2 : 0.14) * human(s), s.out, s.send);
  }

  // the melody: the phrase of this pair of bars; on a beat it leans on a tone of the chord
  if (tr.lead && !intro && !calm) {
    const n = s.phr[(inSec >> 1) & 3][(bar % 2) * per + st];
    if (n) {
      const d = st % 4 === 0 ? snap(s, n.d, chord) : n.d;
      play(c, tr.lead, pitch(s, d, tr.lead === 'glass' ? 2 : 1), t + s.rnd() * 0.008, n.len * s.dur * 0.92, (st % 4 === 0 ? 0.3 : 0.24) * human(s), s.out, s.send);
    }
  }

  // the drums (quieter in the resting sections; a fight drums from the start)
  const lv = tr.drums - (calm ? 1 : 0);
  if (lv > 0 && (tr.battle || !intro)) drums(c, s, lv, st, inSec, t, lite);

  if (tr.extra) placeSound(c, s, st, bar, t);
}

const human = (s: Song) => 0.85 + s.rnd() * 0.3;

/** the MIDI note of a degree of the track's mode (0 the tonic, one octave up per `oct`) */
function pitch(s: Song, deg: number, oct = 0) {
  const L = s.scale.length;
  const i = ((deg % L) + L) % L;
  return s.tr.key + s.scale[i] + 12 * (Math.floor(deg / L) + oct);
}

/** the tone of the chord (standing on degree c) nearest to degree d */
function snap(s: Song, d: number, c: number) {
  const L = s.scale.length;
  let best = d;
  let bd = 99;
  for (let x = d - 3; x <= d + 3; x++) {
    const r = (((x - c) % L) + L) % L;
    if ((r === 0 || r === 2 || r === 4) && Math.abs(x - d) < bd) {
      best = x;
      bd = Math.abs(x - d);
    }
  }
  return best;
}

const nearest = (d: number, target: number, L: number) => target + L * Math.round((d - target) / L);

/** a motif of two bars: its notes fall mostly on the beats and move mostly by steps, rising and then falling
 *  like an arch; it ends on `end` (the fifth asks, the tonic answers) */
function motif(s: Song, end: number): Phrase {
  const { per, rnd, tr } = s;
  const n = per * 2;
  const on: number[] = [];
  for (let i = 0; i < n - 2; i++) {
    const w = i % per === 0 ? 1 : i % 4 === 0 ? 0.7 : i % 2 === 0 ? 0.3 : 0.07;
    if (i === 0 || rnd() < w * tr.density * 1.3) on.push(i);
  }
  const ph: Phrase = new Array(n);
  let d = [0, 2, 4][Math.floor(rnd() * 3)];
  on.forEach((i, k) => {
    if (k > 0) {
      const up = k < on.length / 2 ? 0.62 : 0.36;
      const r = rnd();
      const size = tr.steps ? (r < 0.25 ? 0 : 1) : r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 4;
      d += rnd() < up ? size : -size;
      d = Math.max(-2, Math.min(9, d));
    }
    if (k === on.length - 1) d = nearest(d, end, s.scale.length);
    ph[i] = { d, len: Math.min((on[k + 1] ?? n) - i, per) };
  });
  return ph;
}

/** the motif once more, now closing on the tonic (the last note reached from the step above) */
function answer(s: Song, a: Phrase): Phrase {
  const ph = a.map((x) => x && { ...x });
  const idx: number[] = [];
  ph.forEach((x, i) => x && idx.push(i));
  const last = ph[idx[idx.length - 1]]!;
  last.d = nearest(last.d, 0, s.scale.length);
  if (idx.length > 2) ph[idx[idx.length - 2]]!.d = last.d + 1;
  return ph;
}

function drums(c: BaseAudioContext, s: Song, lv: number, st: number, inSec: number, t: number, lite: boolean) {
  const per = s.per;
  const m3 = per === 12;
  if (lv === 1) {
    // a hand drum and a shaker
    if (st === 0) hit(c, s, 'tom', t, 1);
    else if (!m3 && st === 10) hit(c, s, 'tom', t, 0.6);
    if (st % 2 === 0) hit(c, s, 'shaker', t, st % 4 === 0 ? 0.5 : 1);
    return;
  }
  // the last beat of a section: a roll into the next one
  const fill = inSec === 7 && st >= per - 4;
  if (fill) {
    hit(c, s, 'snare', t, 0.35 + 0.15 * (st - per + 4));
    if (lv === 3 && st % 2 === 0) hit(c, s, 'tom', t, 0.7);
    return;
  }
  if (lv === 2) {
    if (st === 0 || (!m3 && st === 8)) hit(c, s, 'kick', t, 1);
    if (m3 ? st === 4 || st === 8 : st === 4 || st === 12) hit(c, s, 'snare', t, 0.8);
    if (st % 2 === 0) hit(c, s, 'hat', t, st % 4 === 0 ? 1 : 0.6);
    return;
  }
  // a battle
  if (st === 0 && inSec === 0) hit(c, s, 'crash', t, 1);
  if (m3 ? st === 0 || st === 6 : st === 0 || st === 6 || st === 8 || st === 11) hit(c, s, 'kick', t, st % 4 === 0 ? 1 : 0.75);
  if (m3 ? st === 4 || st === 8 : st === 4 || st === 12) hit(c, s, 'snare', t, 0.9);
  if (!lite || st % 2 === 0) hit(c, s, 'hat', t, st % 2 === 0 ? 0.9 : 0.45);
}

function hit(c: BaseAudioContext, s: Song, kind: 'kick' | 'tom' | 'snare' | 'hat' | 'shaker' | 'crash', t: number, vel: number) {
  const out = s.out;
  switch (kind) {
    case 'kick':
      thump(c, out, t, 125, 42, 0.26, 0.7 * vel);
      break;
    case 'tom':
      thump(c, out, t, 175, 95, 0.3, 0.42 * vel);
      break;
    case 'snare':
      hiss(c, out, t, 0.15, 0.28 * vel, 'bandpass', 1900, 0.7);
      thump(c, out, t, 210, 160, 0.08, 0.16 * vel);
      break;
    case 'hat':
      hiss(c, out, t, 0.04, 0.07 * vel, 'highpass', 7500, 0.7);
      break;
    case 'shaker':
      hiss(c, out, t, 0.07, 0.05 * vel, 'highpass', 5200, 0.7, 0.02);
      break;
    case 'crash':
      hiss(c, out, t, 1.3, 0.1 * vel, 'highpass', 4200, 0.5);
      break;
  }
}

/** the sound of the place: a bell, an anvil, chains, drops, bubbles, a heartbeat, crickets */
function placeSound(c: BaseAudioContext, s: Song, st: number, bar: number, t: number) {
  const r = Math.random();
  switch (s.tr.extra) {
    case 'bell':
      if (st === 0 && bar % 4 === 0) play(c, 'bell', s.tr.key, t, 1.5, 0.32, s.out, s.send);
      break;
    case 'anvil':
      if ((st === 0 && r < 0.7) || (st === s.per / 2 && r < 0.35)) {
        const f = 1150 + Math.random() * 120;
        blip(c, s, t, f, 0.995, 0.9, 0.06);
        blip(c, s, t, f * 2.76, 0.995, 0.45, 0.04);
        blip(c, s, t, f * 5.4, 0.995, 0.2, 0.025);
        hiss(c, s.out, t, 0.03, 0.05, 'highpass', 3000, 0.7);
      }
      break;
    case 'chains':
      if (r < 0.025) for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) hiss(c, s.out, t + i * (0.04 + Math.random() * 0.05), 0.05, 0.07, 'bandpass', 3600 + Math.random() * 2400, 7);
      break;
    case 'drip':
      if (r < 0.035) blip(c, s, t, mtof(s.tr.key + 36 + Math.floor(Math.random() * 8)), 0.7, 0.22, 0.1);
      break;
    case 'bubbles':
      if (r < 0.04) blip(c, s, t, 160 + Math.random() * 120, 3, 0.12, 0.09);
      break;
    case 'heart':
      if (st === 0 || (s.per === 16 && st === 8)) {
        thump(c, s.out, t, 80, 42, 0.22, 0.3);
        thump(c, s.out, t + 0.2, 70, 40, 0.2, 0.2);
      }
      break;
    case 'crickets':
      if (st % 2 === 0 && r < 0.08) for (let i = 0; i < 3; i++) blip(c, s, t + i * 0.045, 4300 + Math.random() * 400, 1, 0.025, 0.018, false);
      break;
  }
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** one note of an instrument: held `len` seconds at loudness `vel`, into `out` (and into the echo) */
function play(c: BaseAudioContext, v: Voice, m: number, t: number, len: number, vel: number, out: AudioNode, echo?: AudioNode) {
  const f = mtof(m);
  const g = c.createGain();
  g.connect(out);
  if (echo) g.connect(echo);
  const p = g.gain;
  const os: OscillatorNode[] = [];
  const osc = (type: OscillatorType | PeriodicWave, freq: number, to: AudioNode = g, det = 0) => {
    const x = c.createOscillator();
    if (typeof type === 'string') x.type = type as OscillatorType;
    else x.setPeriodicWave(type);
    x.frequency.value = freq;
    if (det) x.detune.value = det;
    x.connect(to);
    os.push(x);
    return x;
  };
  const lowpass = (freq: number, q = 0.7) => {
    const x = c.createBiquadFilter();
    x.type = 'lowpass';
    x.frequency.value = freq;
    x.Q.value = q;
    x.connect(g);
    return x;
  };
  let end = t + len + 0.3;
  switch (v) {
    case 'sine':
    case 'tri':
    case 'flute': {
      adsr(p, t, v === 'flute' ? 0.07 : 0.012, len, 0.25, vel);
      const x = osc(v === 'tri' ? 'triangle' : 'sine', f);
      if (v === 'flute' && len > 0.3) {
        const vg = c.createGain();
        vg.gain.value = f * 0.006;
        vg.connect(x.frequency);
        osc('sine', 5.2, vg);
      }
      break;
    }
    case 'square':
    case 'saw':
      adsr(p, t, 0.01, len, 0.2, vel * (v === 'square' ? 0.4 : 0.45));
      osc(v === 'square' ? 'square' : 'sawtooth', f, lowpass(Math.min(5000, f * 5)));
      break;
    case 'brass': {
      const fl = lowpass(f * 2, 1.5);
      fl.frequency.setValueAtTime(f * 1.5, t);
      fl.frequency.linearRampToValueAtTime(Math.min(7000, f * 7), t + 0.06);
      fl.frequency.setTargetAtTime(Math.min(4000, f * 3), t + 0.06, 0.25);
      adsr(p, t, 0.035, len, 0.18, vel * 0.3);
      osc('sawtooth', f, fl, -6);
      osc('sawtooth', f, fl, 6);
      break;
    }
    case 'strings': {
      const fl = lowpass(Math.min(4500, f * 6));
      adsr(p, t, Math.min(0.35, len * 0.3), len, 0.5, vel * 0.3, 0.85);
      osc('sawtooth', f, fl, -8);
      osc('sawtooth', f, fl, 8);
      end = t + len + 0.6;
      break;
    }
    case 'choir': {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800;
      bp.Q.value = 1.2;
      bp.connect(g);
      adsr(p, t, Math.min(0.45, len * 0.35), len, 0.55, vel * 0.9, 0.85);
      osc('sawtooth', f, bp, -10);
      osc('sawtooth', f, bp, 10);
      end = t + len + 0.7;
      break;
    }
    case 'organ':
      adsr(p, t, 0.02, len, 0.12, vel * 0.8, 0.95);
      osc(wave(c, 'organ', [0, 1, 0.55, 0.33, 0.12, 0, 0.08]), f);
      end = t + len + 0.2;
      break;
    case 'harp':
      perc(p, t, 0.004, 1.6, vel * 0.8);
      osc(wave(c, 'harp', [0, 1, 0.25, 0.08, 0.03]), f);
      end = t + 1.7;
      break;
    case 'bell':
    case 'glass': {
      // frequency modulation: a bright strike that mellows
      const bell = v === 'bell';
      const dec = bell ? 2.2 + len * 0.5 : 1.0;
      perc(p, t, 0.004, dec, vel * (bell ? 0.8 : 0.6));
      const car = osc('sine', f);
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * (bell ? 2.4 : 1.3), t);
      mg.gain.exponentialRampToValueAtTime(f * 0.03, t + (bell ? 1.4 : 0.5));
      mg.connect(car.frequency);
      osc('sine', f * (bell ? 3.5 : 7), mg);
      end = t + dec + 0.05;
      break;
    }
    case 'pluck': {
      const fl = lowpass(Math.min(9000, f * 8), 1.2);
      fl.frequency.setValueAtTime(Math.min(9000, f * 8), t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(180, f * 1.1), t + 0.3);
      perc(p, t, 0.003, 0.7 + Math.min(0.5, len), vel * 0.6);
      osc('sawtooth', f, fl);
      end = t + 1.3;
      break;
    }
    case 'xylo': {
      perc(p, t, 0.002, 0.45, vel * 0.9);
      osc('sine', f);
      const hg = c.createGain();
      perc(hg.gain, t, 0.002, 0.1, 0.35);
      hg.connect(g);
      osc('sine', f * 4, hg);
      end = t + 0.55;
      break;
    }
  }
  for (const x of os) {
    x.start(t);
    x.stop(end);
  }
  os[0].onended = () => g.disconnect();
}

/** a timbre from its harmonics (made once) */
function wave(c: BaseAudioContext, id: string, harm: number[]) {
  let w = waves.get(c);
  if (!w) waves.set(c, (w = {}));
  return (w[id] ??= c.createPeriodicWave(new Float32Array(harm.length), new Float32Array(harm)));
}

/** an envelope: up in `a`, sinking to `sus` while held for `len`, gone within `rel` */
function adsr(p: AudioParam, t: number, a: number, len: number, rel: number, peak: number, sus = 0.75) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * sus, t + a, Math.max(0.05, len * 0.3));
  p.setTargetAtTime(0.0001, t + Math.max(a, len), rel / 4);
}

/** a struck envelope: up in `a`, then dying away within `dec` */
function perc(p: AudioParam, t: number, a: number, dec: number, peak: number) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

/** a falling sine: drums, a heartbeat */
function thump(c: BaseAudioContext, out: AudioNode, t: number, f0: number, f1: number, dec: number, vel: number) {
  const g = c.createGain();
  perc(g.gain, t, 0.002, dec, vel);
  g.connect(out);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
  o.connect(g);
  o.start(t);
  o.stop(t + dec + 0.05);
  o.onended = () => g.disconnect();
}

/** a short sine that slides (drops, bubbles, an anvil's ring, crickets) */
function blip(c: BaseAudioContext, s: Song, t: number, f0: number, ratio: number, dec: number, vel: number, echo = true) {
  const g = c.createGain();
  perc(g.gain, t, 0.003, dec, vel);
  g.connect(s.out);
  if (echo) g.connect(s.send);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * ratio, t + dec * 0.7);
  o.connect(g);
  o.start(t);
  o.stop(t + dec + 0.05);
  o.onended = () => g.disconnect();
}

/** filtered noise: snares, hats, shakers, chains */
function hiss(c: BaseAudioContext, out: AudioNode, t: number, dec: number, vel: number, type: BiquadFilterType, f: number, q: number, att = 0.002) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = c.createGain();
  perc(g.gain, t, att, dec, vel);
  src.connect(fl);
  fl.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 1.2, dec + 0.05);
  src.onended = () => g.disconnect();
}

function noiseBuffer(c: BaseAudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** a low hum under the whole track: two detuned saws on the tonic and a fifth, through a slowly breathing filter */
function drone(c: BaseAudioContext, s: Song) {
  const t = c.currentTime;
  const fl = c.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = 320;
  const g = c.createGain();
  g.gain.value = 0.16;
  fl.connect(g);
  g.connect(s.out);
  const f = mtof(s.tr.key - 12);
  const lg = c.createGain();
  lg.gain.value = 140;
  lg.connect(fl.frequency);
  const src = (type: OscillatorType, freq: number, det: number, to: AudioNode) => {
    const x = c.createOscillator();
    x.type = type;
    x.frequency.value = freq;
    x.detune.value = det;
    x.connect(to);
    x.start(t);
    s.hold.push(x);
  };
  src('sawtooth', f, -7, fl);
  src('sawtooth', f, 6, fl);
  src('triangle', f * (s.scale[4] === 7 ? 1.5 : 2), 0, fl);
  src('sine', 0.05, 0, lg);
  s.nodes.push(fl, g, lg);
}

/** wind: noise through a slowly wandering band */
function wind(c: BaseAudioContext, s: Song) {
  const t = c.currentTime;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c);
  n.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 1.1;
  const g = c.createGain();
  g.gain.value = 0.07;
  n.connect(bp);
  bp.connect(g);
  g.connect(s.out);
  const sweep = c.createOscillator();
  sweep.frequency.value = 0.07;
  const sg = c.createGain();
  sg.gain.value = 300;
  sweep.connect(sg);
  sg.connect(bp.frequency);
  const gust = c.createOscillator();
  gust.frequency.value = 0.11;
  const gg = c.createGain();
  gg.gain.value = 0.04;
  gust.connect(gg);
  gg.connect(g.gain);
  for (const x of [n, sweep, gust]) {
    x.start(t);
    s.hold.push(x);
  }
  s.nodes.push(bp, g, sg, gg);
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
