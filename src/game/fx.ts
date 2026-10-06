import Phaser from 'phaser';

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
  res: number;

  constructor(scene: Phaser.Scene, zoom: number) {
    this.scene = scene;
    this.res = Math.min(8, Math.ceil(zoom * (window.devicePixelRatio || 1)));
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
    this.emitter(color, kind).explode(n, x, y);
  }

  number(x: number, y: number, text: string, color: string, big = false) {
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

  label(x: number, y: number, text: string, color: string, size = 7) {
    const t = this.scene.add.text(x, y, text, { fontFamily: '"Jersey 10", monospace', fontSize: Math.round(size * 1.3) + 'px', color, stroke: '#000', strokeThickness: 2 });
    t.setResolution(this.res).setOrigin(0.5, 1).setDepth(D.ui - 1);
    return t;
  }

  ring(x: number, y: number, radius: number, color: number, dur = 350, alpha = 0.9) {
    const r = this.scene.add.image(x, y, 'ring').setDepth(D.bright).setTint(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale(0.1);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 64, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  disc(x: number, y: number, radius: number, color: number, dur = 400) {
    const r = this.scene.add.image(x, y, 'disc').setDepth(D.bright).setTint(color).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale((radius * 2) / 64 * 0.3);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 64, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  telegraph(x: number, y: number, radius: number, dur: number, color = 0xff3030) {
    const r = this.scene.add.image(x, y, 'disc').setDepth(D.floorDeco + 1).setTint(color).setAlpha(0.15).setScale((radius * 2) / 64);
    const inner = this.scene.add.image(x, y, 'disc').setDepth(D.floorDeco + 1).setTint(color).setAlpha(0.35).setScale(0.01);
    this.scene.tweens.add({ targets: inner, scale: (radius * 2) / 64, duration: dur, ease: 'Linear' });
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

  shake(intensity = 0.004, dur = 120) {
    this.scene.cameras.main.shake(dur, intensity);
  }
}
