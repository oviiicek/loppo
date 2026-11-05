import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { D } from './fx';
import { AURA_BY_ID } from '../data/live';
import { gfxLevel } from '../systems/audio';

// An aura under a hero (bought with pearls or earned): a soft glow on the floor that breathes, and sparks that
// rise from it now and then. Only the aura's id goes to the other games; each draws the auras it shows by itself.
export class Aura {
  private glow: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Image | null = null;
  private id: string | null = null;
  private t = Math.random() * 6;
  private sparkT = 0;
  constructor(private sc: GameScene) {}

  /** follows the hero (x, y: the hero's feet); the aura changes with the id, none without one */
  update(x: number, y: number, id: string | null | undefined, dt: number, visible = true) {
    const def = id ? AURA_BY_ID[id] : undefined;
    if ((def?.id ?? null) !== this.id) {
      this.destroy();
      this.id = def?.id ?? null;
      if (def) {
        // a glow on the floor and a ring round its edge (both lighten what is under them)
        this.glow = this.sc.add.image(x, y, 'glow').setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.floorDeco + 1);
        this.ring = this.sc.add.image(x, y, 'ring').setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.floorDeco + 1);
      }
    }
    if (!this.glow || !this.ring || !def) return;
    this.t += dt;
    const k = 0.5 + 0.5 * Math.sin(this.t * 2.2);
    this.glow
      .setPosition(x, y + 1)
      .setVisible(visible)
      .setAlpha(0.5 + 0.3 * k)
      .setScale(0.78 + 0.06 * k, 0.38 + 0.03 * k);
    this.ring
      .setPosition(x, y + 1)
      .setVisible(visible)
      .setAlpha(0.45 + 0.35 * k)
      .setScale((24 + 2 * k) / 256, (12 + k) / 256);
    if (!visible) return;
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      // fewer sparks on the lower graphics levels
      this.sparkT = gfxLevel() >= 2 ? 0.16 : 0.4;
      const a = Math.random() * Math.PI * 2;
      this.sc.fx.auraSpark(x + Math.cos(a) * 7, y + Math.sin(a) * 3, def.spark);
    }
  }

  destroy() {
    this.glow?.destroy();
    this.ring?.destroy();
    this.glow = this.ring = null;
    this.id = null;
  }
}
