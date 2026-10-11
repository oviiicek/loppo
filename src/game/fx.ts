import Phaser from 'phaser';
import { gfxParticles } from '../systems/audio';
import { NUM_FONT, ensureNumberFont, fitsNumberFont } from '../gfx/numfont';

export const D = {
  floorDeco: 2,
  wallDeco: 5,
  entityBase: 100,
  dark: 100000,
  glow: 100001,
  bright: 100002,
  ui: 200000,
};

export const EL_COLOR: Record<string, number> = {
  phys: 0xffffff,
  fire: 0xff7a2a,
  ice: 0x7fd8ff,
  lightning: 0xffe45c,
  poison: 0x7be05a,
  holy: 0xfff2a8,
  shadow: 0xb07dff,
  heal: 0x52ff8f,
  blood: 0xff3b3b,
};

// Visual effects helper bound to a scene.
export class FX {
  scene: Phaser.Scene;
  emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  textPool: Phaser.GameObjects.Text[] = [];
  /** floating numbers in the bitmap font (see gfx/numfont.ts) */
  numPool: Phaser.GameObjects.BitmapText[] = [];
  private numFont = false;
  res: number;

  constructor(scene: Phaser.Scene, zoom: number) {
    this.scene = scene;
    this.res = Math.min(8, Math.ceil(zoom * (window.devicePixelRatio || 1)));
    this.numFont = ensureNumberFont(scene);
  }

  private emitter(color: number, kind: 'spark' | 'puff' | 'pix' = 'spark') {
    const key = kind + color;
    let e = this.emitters.get(key);
    if (!e) {
      const cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
        kind === 'puff'
          ? { speed: { min: 8, max: 30 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.7, end: 0 }, lifespan: 600, tint: color, emitting: false }
          : { speed: { min: 30, max: 110 }, scale: { start: kind === 'pix' ? 1 : 0.9, end: 0 }, alpha: { start: 1, end: 0.2 }, lifespan: { min: 200, max: 500 }, tint: color, emitting: false, blendMode: 'ADD' };
      e = this.scene.add.particles(0, 0, kind, cfg);
      e.setDepth(D.bright);
      this.emitters.set(key, e);
    }
    return e;
  }

  burst(x: number, y: number, color: number, n = 8, kind: 'spark' | 'puff' | 'pix' = 'spark') {
    this.emitter(color, kind).explode(gfxParticles(n), x, y);
  }

  /** a step of a hero's trail (bought with pearls): never sent to the other games – each draws the trails of
   *  the heroes it shows by itself */
  trail(x: number, y: number, color: number, kind: 'spark' | 'puff' | 'pix') {
    const key = 'trail' + kind + color;
    let e = this.emitters.get(key);
    if (!e) {
      // slow particles that hang in the air for a while (a burst's would scatter and be gone at once)
      e = this.scene.add.particles(0, 0, kind, {
        speed: { min: 3, max: 14 },
        gravityY: kind === 'pix' ? 14 : -10,
        scale: { start: kind === 'puff' ? 0.9 : 1.05, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 650, max: 1100 },
        tint: color,
        emitting: false,
        blendMode: kind === 'puff' ? 'NORMAL' : 'ADD',
      });
      e.setDepth(D.entityBase - 1);
      this.emitters.set(key, e);
    }
    e.explode(gfxParticles(2), x, y);
  }

  number(x: number, y: number, text: string, color: string, big = false) {
    if (this.numFont && fitsNumberFont(text)) return this.bitmapNumber(x, y, text, color, big);
    let t = this.textPool.pop();
    if (!t) {
      t = this.scene.add.text(0, 0, '', { fontFamily: '"Jersey 10", monospace', fontSize: '10px', color: '#fff', stroke: '#000', strokeThickness: 2 });
      t.setResolution(this.res).setOrigin(0.5).setDepth(D.ui);
    }
    t.setText(text).setColor(color).setFontSize(big ? 14 : 10).setPosition(x + (Math.random() - 0.5) * 8, y).setAlpha(1).setScale(big ? 1.2 : 1).setVisible(true).setActive(true);
    this.scene.tweens.add({
      targets: t,
      y: y - 18 - (big ? 6 : 0),
      scale: 1,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            t!.setVisible(false).setActive(false);
            this.textPool.push(t!);
          },
        });
      },
    });
  }

  /** a floating number drawn from the bitmap font: nothing new goes to the graphics card */
  private bitmapNumber(x: number, y: number, text: string, color: string, big: boolean) {
    let t = this.numPool.pop();
    if (!t) t = this.scene.add.bitmapText(0, 0, NUM_FONT, '', 10).setOrigin(0.5).setDepth(D.ui);
    t.setText(text)
      .setFontSize(big ? 14 : 10)
      .setTint(Phaser.Display.Color.HexStringToColor(color).color)
      .setPosition(x + (Math.random() - 0.5) * 8, y)
      .setAlpha(1)
      .setScale(big ? 1.2 : 1)
      .setVisible(true)
      .setActive(true);
    this.scene.tweens.add({
      targets: t,
      y: y - 18 - (big ? 6 : 0),
      scale: 1,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            t!.setVisible(false).setActive(false);
            this.numPool.push(t!);
          },
        });
      },
    });
  }

  label(x: number, y: number, text: string, color: string, size = 7, boxed = false) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = boxed
      ? { fontFamily: '"Jersey 10", monospace', fontSize: Math.round(size * 1.3) + 'px', color, backgroundColor: 'rgba(14,10,22,0.82)', padding: { x: 3, y: 1 } }
      : { fontFamily: '"Jersey 10", monospace', fontSize: Math.round(size * 1.3) + 'px', color, stroke: '#000', strokeThickness: 2 };
    const t = this.scene.add.text(x, y, text, style);
    t.setResolution(this.res).setOrigin(0.5, 1).setDepth(D.ui - 1);
    return t;
  }

  ring(x: number, y: number, radius: number, color: number, dur = 350, alpha = 0.9) {
    const r = this.scene.add.image(x, y, 'ring').setDepth(D.bright).setTint(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale(0.02);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 256, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  disc(x: number, y: number, radius: number, color: number, dur = 400) {
    const r = this.scene.add.image(x, y, 'disc').setDepth(D.bright).setTint(color).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale((radius * 2) / 256 * 0.3);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 256, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  /** the warnings on the ground right now (the test bot steps out of them) */
  warnings: { x: number; y: number; r: number; until: number }[] = [];

  telegraph(x: number, y: number, radius: number, dur: number, color = 0xff3030) {
    const now = this.scene.time.now;
    this.warnings = this.warnings.filter((w) => w.until > now);
    this.warnings.push({ x, y, r: radius, until: now + dur });
    // drawn above the darkness so a warning is never hidden in an unlit corner
    const r = this.scene.add.image(x, y, 'disc').setDepth(D.glow).setTint(color).setAlpha(0.15).setScale((radius * 2) / 256);
    const inner = this.scene.add.image(x, y, 'disc').setDepth(D.glow).setTint(color).setAlpha(0.3).setScale(0.01);
    this.scene.tweens.add({ targets: inner, scale: (radius * 2) / 256, duration: dur, ease: 'Linear' });
    this.scene.time.delayedCall(dur, () => {
      r.destroy();
      inner.destroy();
    });
  }

  flash(obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, color = 0xffffff, dur = 80) {
    obj.setTintFill(color);
    this.scene.time.delayedCall(dur, () => {
      if (obj.active) obj.clearTint();
    });
  }

  slash(x: number, y: number, angle: number, radius: number, color = 0xffffff, arc = 120) {
    const s = this.scene.add.image(x, y, 'slash').setDepth(D.bright).setTint(color).setBlendMode(Phaser.BlendModes.ADD);
    s.setRotation(angle);
    const sc = radius / 18;
    s.setScale(sc * 0.7, sc * (arc / 140));
    s.setAlpha(0.95);
    this.scene.tweens.add({ targets: s, scaleX: sc, alpha: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
  }

  pillar(x: number, y: number, color: number) {
    const p = this.scene.add.image(x, y, 'pillar').setOrigin(0.5, 1).setDepth(D.bright).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2, 1.4);
    this.scene.tweens.add({ targets: p, scaleX: 0, alpha: 0, duration: 450, ease: 'Cubic.easeIn', onComplete: () => p.destroy() });
  }

  lightning(x0: number, y0: number, x1: number, y1: number, color = 0xffe45c) {
    const g = this.scene.add.graphics().setDepth(D.bright).setBlendMode(Phaser.BlendModes.ADD);
    const segs = Math.max(3, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 8));
    const pts: [number, number][] = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * 8, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 8]);
    }
    pts.push([x1, y1]);
    g.lineStyle(2.5, color, 0.6);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.strokePath();
    g.lineStyle(1, 0xffffff, 1);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  /** straight beam (chains, lasers) */
  beam(x0: number, y0: number, x1: number, y1: number, color: number, width = 3, dur = 260) {
    const g = this.scene.add.graphics().setDepth(D.bright).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(width * 2, color, 0.35);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(width, color, 0.85);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(Math.max(1, width / 3), 0xffffff, 0.9);
    g.lineBetween(x0, y0, x1, y1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: dur, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
  }

  shake(intensity = 0.004, dur = 120) {
    this.scene.cameras.main.shake(dur, intensity);
  }
}
