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
    case 'stairs':
      [400, 300, 200].forEach((f, i) => tone('triangle', f, f * 0.8, 0.15, 0.12, i * 0.12));
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
  }
}

// ---------------------------------------------------------------------------
// Settings shared with the UI (persisted)
// ---------------------------------------------------------------------------
export const settings = { music: true, vibrate: true };
try {
  const raw = localStorage.getItem('loppo-settings');
  if (raw) Object.assign(settings, JSON.parse(raw));
} catch {
  /* ignore */
}
export function saveSettings() {
  try {
    localStorage.setItem('loppo-settings', JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function vibrate(ms = 25) {
  if (!settings.vibrate) return;
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
