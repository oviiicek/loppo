import Phaser from 'phaser';

// Creates looping animations for every generated sprite strip (idempotent).
export function createAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  for (const key of scene.textures.getTextureKeys()) {
    const tex = scene.textures.get(key);
    const n = tex.frameTotal - 1;
    if (n < 2) continue;
    if (n >= 6) {
      if (!a.exists(key + '_idle')) a.create({ key: key + '_idle', frames: a.generateFrameNumbers(key, { frames: [0, 1] }), frameRate: 2.5, repeat: -1 });
      if (!a.exists(key + '_walk')) a.create({ key: key + '_walk', frames: a.generateFrameNumbers(key, { frames: [2, 3, 4, 5] }), frameRate: 9, repeat: -1 });
    } else if (!a.exists(key + '_loop')) {
      a.create({ key: key + '_loop', frames: a.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: key === 'torch' ? 9 : key === 'coin' ? 10 : 6, repeat: -1 });
    }
  }
}
