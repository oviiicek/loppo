// Tiny procedural sound effects with WebAudio (no assets needed).
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
// Procedural ambient music: a dark drone with sparse echoing notes
// ---------------------------------------------------------------------------
let music: { nodes: AudioNode[]; timer: any; gain: GainNode } | null = null;

export function startMusic() {
  if (music || muted || !settings.music) return;
  const c = ac();
  if (!c || !master) return;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.12, c.currentTime + 4);
  gain.connect(master);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.connect(gain);
  const nodes: AudioNode[] = [gain, filter];
  for (const [f, type, det] of [
    [55, 'sawtooth', -6],
    [55.3, 'sawtooth', 5],
    [82.4, 'triangle', 0],
  ] as [number, OscillatorType, number][]) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    const g = c.createGain();
    g.gain.value = type === 'triangle' ? 0.35 : 0.18;
    o.connect(g);
    g.connect(filter);
    o.start();
    nodes.push(o, g);
  }
  // slow filter sweep
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
  nodes.push(lfo, lfoGain);
  // echo for the sparse notes
  const delay = c.createDelay(2);
  delay.delayTime.value = 0.55;
  const fb = c.createGain();
  fb.gain.value = 0.45;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(gain);
  nodes.push(delay, fb);
  const scale = [220, 246.9, 261.6, 329.6, 349.2, 440, 493.9, 523.3];
  const timer = setInterval(() => {
    if (!ctx || Math.random() < 0.45) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = scale[Math.floor(Math.random() * scale.length)] / (Math.random() < 0.5 ? 2 : 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.5);
    o.connect(g);
    g.connect(delay);
    g.connect(gain);
    o.start(t);
    o.stop(t + 2.6);
  }, 1700);
  music = { nodes, timer, gain };
}

export function stopMusic() {
  if (!music) return;
  clearInterval(music.timer);
  const m = music;
  music = null;
  try {
    const c = ac();
    if (c) m.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
    setTimeout(() => m.nodes.forEach((n) => (n as any).stop?.() ?? n.disconnect()), 600);
  } catch {
    /* ignore */
  }
}
