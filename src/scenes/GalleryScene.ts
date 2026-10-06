import Phaser from 'phaser';

// Debug scene: shows all generated textures enlarged (open with ?gallery).
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }
  create() {
    this.cameras.main.setBackgroundColor('#202028');
    const keys = this.textures.getTextureKeys().filter((k) => !k.startsWith('__'));
    let x = 4,
      y = 4,
      rowH = 0;
    const scale = 3;
    for (const k of keys) {
      const tex = this.textures.get(k);
      const f = tex.frameTotal > 2 ? tex.get(0) : tex.get();
      const w = Math.min(f.width, 140) * scale,
        h = Math.min(f.height, 70) * scale;
      if (x + w > this.scale.width - 4) {
        x = 4;
        y += rowH + 14;
        rowH = 0;
      }
      if (tex.frameTotal > 2) {
        // show all frames
        const n = tex.frameTotal - 1;
        for (let i = 0; i < n; i++) {
          const fr = tex.get(i);
          this.add.image(x + i * (fr.width * scale + 2), y, k, i).setOrigin(0).setScale(scale);
        }
        const tw = n * (f.width * scale + 2);
        this.add.text(x, y + h, k, { fontSize: '9px', color: '#aaa' });
        x += Math.max(tw, 60) + 8;
      } else {
        this.add.image(x, y, k).setOrigin(0).setScale(Math.min(scale, 420 / Math.max(f.width, 1)));
        this.add.text(x, y + h, k, { fontSize: '9px', color: '#aaa' });
        x += Math.max(w, 60) + 8;
      }
      rowH = Math.max(rowH, h);
    }
  }
}
