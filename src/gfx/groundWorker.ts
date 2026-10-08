// Paints the ground of the village away from the game (see gfx/groundLoader.ts).
import { paintGround } from './ground';

self.onmessage = () => {
  const chunks = paintGround();
  (self as unknown as Worker).postMessage(
    chunks,
    chunks.map((c) => c.data.buffer),
  );
};
