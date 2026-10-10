import Phaser from 'phaser';
import { HERO_FRAMES as H } from './heroes';

// Hero strips (see heroes.ts): breathing idle and walk with and without the weapon in hand, blinks and
// one-shot idle fidgets. Drawing / putting away the weapon sets its frames directly (Player).
function createHeroAnims(a: Phaser.Animations.AnimationManager, key: string) {
  if (a.exists(key + '_idle2')) return;
  const mk = (name: string, frames: number[], frameRate: number, repeat = -1) => {
    if (a.exists(key + '_' + name)) a.remove(key + '_' + name);
    a.create({ key: key + '_' + name, frames: a.generateFrameNumbers(key, { frames }), frameRate, repeat });
  };
  const run = (s: number, n: number) => Array.from({ length: n }, (_, i) => s + i);
  mk('idle', run(H.idle, 4), 3);
  mk('walk', run(H.walk, 6), 11);
  mk('idleA', run(H.idleA, 4), 3.5);
  mk('walkA', run(H.walkA, 6), 11);
  mk('blink', [H.blink], 7, 0);
  mk('blinkA', [H.blinkA], 7, 0);
  // both hands on a two-handed weapon
  mk('idle2', run(H.idle2, 4), 3.5);
  mk('walk2', run(H.walk2, 6), 11);
  mk('blink2', [H.blink2], 7, 0);
  const s = H.scratch;
  mk('scratch', [s, s + 1, s + 2, s + 3, s + 4, s + 3, s + 4, s + 3, s + 4, s + 5], 8, 0);
  const l = H.look;
  mk('look', [l, l + 1, l + 1, l + 1, l, l + 2, l + 2, l + 2, l + 3, l + 3, l], 5, 0);
  const t = H.stretch;
  mk('stretch', [t, t + 1, t + 2, t + 3, t + 3, t + 2, t + 3, t + 4, t + 5], 6, 0);
}

// Creates looping animations for every generated sprite strip (idempotent).
export function createAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  for (const key of scene.textures.getTextureKeys()) {
    const tex = scene.textures.get(key);
    const n = tex.frameTotal - 1;
    if (n < 2) continue;
    if (key.startsWith('pl_') && n >= H.count) {
      createHeroAnims(a, key);
      continue;
    }
    if (n >= 6) {
      if (!a.exists(key + '_idle')) a.create({ key: key + '_idle', frames: a.generateFrameNumbers(key, { frames: [0, 1] }), frameRate: 2.5, repeat: -1 });
      if (!a.exists(key + '_walk')) a.create({ key: key + '_walk', frames: a.generateFrameNumbers(key, { frames: [2, 3, 4, 5] }), frameRate: 9, repeat: -1 });
    } else if (!a.exists(key + '_loop')) {
      a.create({ key: key + '_loop', frames: a.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: key.startsWith('torch') ? 9 : key === 'coin' ? 10 : 6, repeat: -1 });
    }
  }
}
