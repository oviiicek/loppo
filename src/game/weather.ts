// Ambient particles of each area, drifting through the part of the floor on screen: dust in the
// dungeons, glowing spores in the caves, snow in the ice, embers and ash in the forge, wisps in the
// abyss, drops in the drowned places, sand, leaves, glitter. The power-saving graphics leave them out.
import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { D } from './fx';
import { settings, sfx } from '../systems/audio';

type Cfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** fades in and out over the particle's life (t goes 0..1) */
const fade = (peak: number) => ({ onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * peak });
/** a glow that flickers while it fades */
const flicker = (peak: number) => ({ onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * peak * (0.75 + Math.random() * 0.25) });

// [texture, config, above the darkness (glows) or under it (only seen in light)]
const LAYERS: Record<string, [string, Cfg, boolean][]> = {
  bricks: [['mote', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -4, max: 4 }, speedY: { min: -3, max: 3 }, scale: { min: 0.5, max: 0.9 }, alpha: fade(0.85), tint: [0xffe8c0, 0xfff4dc], frequency: 200 }, false]],
  cave: [['mote', { lifespan: { min: 4000, max: 7000 }, speedX: { min: -3, max: 3 }, speedY: { min: -9, max: -3 }, scale: { min: 0.45, max: 0.9 }, alpha: fade(0.95), tint: [0x7dffb0, 0x9ae6ff, 0xd0ff7a], blendMode: 'ADD', frequency: 180 }, true]],
  ice: [['flake', { lifespan: { min: 5000, max: 7000 }, speedX: { min: 4, max: 11 }, speedY: { min: 11, max: 20 }, rotate: { min: 0, max: 360 }, scale: { min: 0.5, max: 1 }, alpha: fade(0.95), tint: [0xffffff, 0xdff4ff], frequency: 75 }, false]],
  lava: [
    ['pix', { lifespan: { min: 2500, max: 4500 }, speedX: { min: -6, max: 6 }, speedY: { min: -26, max: -12 }, scale: { min: 0.7, max: 1.25 }, alpha: flicker(1), tint: [0xffa040, 0xff6a20, 0xffd060], blendMode: 'ADD', frequency: 110 }, true],
    ['mote', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -3, max: 3 }, speedY: { min: 3, max: 8 }, scale: { min: 0.4, max: 0.75 }, alpha: fade(0.5), tint: 0x9a9aa0, frequency: 380 }, false],
  ],
  abyss: [['mote', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 4 }, scale: { min: 0.6, max: 1.25 }, alpha: flicker(0.9), tint: [0xb07dff, 0x7a4aff, 0xff7ad8], blendMode: 'ADD', frequency: 200 }, true]],
  // the areas: drops falling from the ceilings of the drowned places, sand blowing over the tombs, leaves and
  // pollen under the roots of the world, glitter of the crystals and mirrors, ash falling on the burnt plains
  drip: [
    ['drop', { lifespan: { min: 1400, max: 2000 }, speedX: 0, speedY: { min: 60, max: 80 }, scale: { min: 0.8, max: 1.2 }, alpha: fade(0.7), tint: [0xbfe8ff, 0xe0f8ff], frequency: 140 }, false],
    ['mote', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -3, max: 3 }, speedY: { min: -4, max: 1 }, scale: { min: 0.4, max: 0.7 }, alpha: fade(0.6), tint: [0x9affd8, 0xc8fff0], blendMode: 'ADD', frequency: 420 }, true],
  ],
  sand: [['pix', { lifespan: { min: 3000, max: 5000 }, speedX: { min: 18, max: 34 }, speedY: { min: -2, max: 5 }, scale: { min: 0.4, max: 0.8 }, alpha: fade(0.75), tint: [0xe8c98a, 0xd4b070, 0xf4dca8], frequency: 70 }, false]],
  leaves: [
    ['leaf', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -6, max: 8 }, speedY: { min: 8, max: 16 }, rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1 }, alpha: fade(0.9), tint: [0x8ac850, 0xc8b040, 0xd88a3a], frequency: 260 }, false],
    ['mote', { lifespan: { min: 4000, max: 7000 }, speedX: { min: -3, max: 3 }, speedY: { min: -7, max: -2 }, scale: { min: 0.4, max: 0.8 }, alpha: fade(0.9), tint: [0xd0ff7a, 0xfff2a0], blendMode: 'ADD', frequency: 300 }, true],
  ],
  sparkle: [['mote', { lifespan: { min: 1600, max: 3200 }, speedX: { min: -2, max: 2 }, speedY: { min: -3, max: 2 }, scale: { min: 0.35, max: 0.9 }, alpha: flicker(1), tint: [0xffffff, 0xc8f4ff, 0xffd0f4, 0xd0c8ff], blendMode: 'ADD', frequency: 120 }, true]],
  ash: [
    ['pix', { lifespan: { min: 5000, max: 8000 }, speedX: { min: -5, max: 5 }, speedY: { min: 6, max: 13 }, scale: { min: 0.5, max: 1 }, alpha: fade(0.7), tint: [0x8a8a90, 0xb0aca8, 0x5e5a5a], frequency: 90 }, false],
    ['pix', { lifespan: { min: 2000, max: 3600 }, speedX: { min: -5, max: 5 }, speedY: { min: -18, max: -8 }, scale: { min: 0.5, max: 0.9 }, alpha: flicker(1), tint: [0xff8a3a, 0xffc060], blendMode: 'ADD', frequency: 420 }, true],
  ],
  // Loppo by day: pollen and petals on the wind; by night: fireflies
  meadow: [['pix', { lifespan: { min: 6000, max: 9000 }, speedX: { min: 3, max: 9 }, speedY: { min: -3, max: 3 }, scale: { min: 0.4, max: 0.8 }, alpha: fade(0.75), tint: [0xffffff, 0xfff4b0, 0xf8d0f0], frequency: 240 }, false]],
  night: [['mote', { lifespan: { min: 3000, max: 6000 }, speedX: { min: -5, max: 5 }, speedY: { min: -5, max: 4 }, scale: { min: 0.35, max: 0.7 }, alpha: flicker(1), tint: [0xd8ff7a, 0xfff27a, 0xa8ff9a], blendMode: 'ADD', frequency: 260 }, true]],
};

export class Weather {
  private scene: GameScene;
  private zone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private on = true;
  private style: string;
  /** seconds to the next flash of the abyss / rumble of the forge */
  private eventT = 10 + Math.random() * 10;

  constructor(scene: GameScene, style: string) {
    this.scene = scene;
    this.style = style;
    for (const [tex, cfg, glow] of LAYERS[style] ?? []) {
      const e = scene.add.particles(0, 0, tex, { ...cfg, emitZone: { type: 'random', source: this.zone } as Phaser.Types.GameObjects.Particles.EmitZoneData });
      // under the darkness only lit parts show the dust; glowing things shine through it
      e.setDepth(glow ? D.glow : D.dark - 10);
      this.emitters.push(e);
    }
    this.update();
  }

  update(dt = 0) {
    const sc = this.scene;
    // now and then the abyss flashes with purple lightning and the forge rumbles
    this.eventT -= dt;
    if (this.eventT <= 0 && !settings.lowFx) {
      this.eventT = 14 + Math.random() * 14;
      if (this.style === 'abyss') {
        sc.cameras.main.flash(260, 150, 90, 230, true);
        sfx('thunder');
      } else if (this.style === 'lava') {
        sc.fx.shake(0.0025, 600);
        sfx('rumble');
      }
    }
    const v = sc.cameras.main.worldView;
    // a margin around the view so drifting particles come in from the edges too
    this.zone.setTo(v.x - 24, v.y - 24, v.width + 48, v.height + 48);
    const on = !settings.lowFx;
    if (on !== this.on) {
      this.on = on;
      for (const e of this.emitters) {
        e.emitting = on;
        e.setVisible(on);
      }
    }
  }
}
