// The ground of the village is painted once per session. A worker paints it in the background right
// after the game starts, so the first walk home does not wait for it; if the hero is home before the
// worker is done (or workers are not allowed), it is painted on the spot.
import type Phaser from 'phaser';
import { paintGround, GroundChunk, GROUND_CHUNK } from './ground';
import GroundWorker from './groundWorker?worker&inline';

const KEY = 'vground_';
let ready: GroundChunk[] | null = null;
let worker: Worker | null = null;

/** starts painting the ground in the background (once, at boot) */
export function prepaintVillageGround() {
  if (ready || worker) return;
  try {
    const w = new GroundWorker();
    worker = w;
    w.onmessage = (e: MessageEvent<GroundChunk[]>) => {
      ready = e.data;
      w.terminate();
      if (worker === w) worker = null;
    };
    w.onerror = () => {
      w.terminate();
      if (worker === w) worker = null;
    };
    w.postMessage('paint');
  } catch {
    worker = null;
  }
}

/** lays the painted ground under the village (painting it now if it is not ready yet) */
export function placeVillageGround(scene: Phaser.Scene, depth = 0) {
  let chunks: GroundChunk[] | null = null;
  if (!scene.textures.exists(KEY + '0')) {
    if (!ready) {
      worker?.terminate();
      worker = null;
    }
    chunks = ready ?? paintGround();
    ready = null;
    chunks.forEach((ch, i) => {
      const c = document.createElement('canvas');
      c.width = ch.w;
      c.height = ch.h;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(ch.data.buffer as ArrayBuffer), ch.w, ch.h), 0, 0);
      scene.textures.addCanvas(KEY + i, c);
    });
  }
  for (let i = 0; scene.textures.exists(KEY + i); i++) {
    const tx = (i % Math.ceil(64 / GROUND_CHUNK.w)) * GROUND_CHUNK.w,
      ty = Math.floor(i / Math.ceil(64 / GROUND_CHUNK.w)) * GROUND_CHUNK.h;
    scene.add.image(tx * 16, ty * 16, KEY + i).setOrigin(0).setScale(0.5).setDepth(depth);
  }
}
