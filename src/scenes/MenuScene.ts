import Phaser from 'phaser';
import { generateDungeon } from '../systems/dungeon';
import { WorldMap, TS } from '../game/map';
import { D } from '../game/fx';
import { ENEMY_BY_ID } from '../data/enemies';

// Atmospheric background for the main menu: a real generated dungeon with
// flickering torches and idle monsters, explored by a slowly drifting camera.
export class MenuScene extends Phaser.Scene {
  map!: WorldMap;
  dark!: Phaser.GameObjects.RenderTexture;
  lightImg!: Phaser.GameObjects.Image;
  lamps: { x: number; y: number; r: number; f: number }[] = [];
  targets: { x: number; y: number }[] = [];
  focus = { x: 0, y: 0 };

  constructor() {
    super('Menu');
  }

  create() {
    this.lamps = [];
    const d = generateDungeon(4 + Math.floor(Math.random() * 6), (Math.random() * 1e9) | 0);
    this.map = new WorldMap(d);
    this.map.build(this);
    this.map.fog.setVisible(false);
    for (const o of d.objects) {
      const px = o.x * TS + 8,
        py = o.y * TS + 8;
      const bottom = (key: string) => this.add.image(px, o.y * TS + 16, key).setOrigin(0.5, 1).setDepth(D.entityBase + py);
      switch (o.kind) {
        case 'torch':
          this.add.sprite(px, o.y * TS + 9, 'torch').play('torch_loop').setDepth(D.wallDeco);
          this.add.image(px, o.y * TS + 6, 'glow').setTint(0xff9a3a).setAlpha(0.22).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
          this.lamps.push({ x: px, y: o.y * TS + 12, r: 70, f: Math.random() * 10 });
          break;
        case 'banner':
          this.add.image(px, o.y * TS + 1, 'banner_' + (o.data?.color ?? 'blue')).setOrigin(0.5, 0).setDepth(D.wallDeco);
          break;
        case 'bookshelf':
          this.add.image(px, o.y * TS - 2, 'bookshelf').setOrigin(0.5, 0).setDepth(D.wallDeco);
          break;
        case 'crate':
        case 'barrel':
        case 'pot':
        case 'table':
        case 'skull':
        case 'anvil':
          bottom(o.kind);
          break;
        case 'chest':
          bottom('chest_' + (o.data?.tier ?? 'wood'));
          break;
        case 'bones':
          this.add.image(px, py, 'bones').setDepth(D.floorDeco);
          break;
        case 'stairs':
          this.add.image(px, py, 'stairs').setDepth(D.floorDeco);
          break;
        case 'carpet': {
          const { w, h, color } = o.data;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
              this.add.image((o.x + x) * TS, (o.y + y) * TS, edge ? 'carpettrim_' + color : 'carpet_' + color).setOrigin(0).setDepth(D.floorDeco - 1);
            }
          break;
        }
        case 'merchant':
          this.add.sprite(px, py + 6, 'npc_merchant').setOrigin(0.5, 1).play('npc_merchant_idle').setDepth(D.entityBase + py);
          this.lamps.push({ x: px, y: py, r: 70, f: 0 });
          break;
        case 'fountain':
          this.add.sprite(px, py + 8, 'fountain').setOrigin(0.5, 1).play('fountain_loop').setDepth(D.entityBase + py + 8);
          break;
      }
    }
    // idle monsters
    for (const sp of d.spawns.slice(0, 60)) {
      const def = ENEMY_BY_ID[sp.id];
      if (!def) continue;
      const x = sp.x * TS + 8,
        y = sp.y * TS + 13;
      this.add.image(x, y, 'shadow').setDepth(D.floorDeco + 2);
      const s = this.add.sprite(x, y, def.sprite, 0).setOrigin(0.5, 1).setDepth(D.entityBase + y).setFlipX(Math.random() < 0.5);
      const anim = this.anims.exists(def.sprite + '_idle') ? def.sprite + '_idle' : def.sprite + '_loop';
      if (this.anims.exists(anim)) s.play({ key: anim, startFrame: Math.floor(Math.random() * 2) });
    }
    this.targets = d.rooms.map((r) => ({ x: r.cx * TS + 8, y: r.cy * TS + 8 }));
    const first = this.targets[Math.floor(Math.random() * this.targets.length)];
    this.focus = { ...first };
    const cam = this.cameras.main;
    const z = Math.max(2, Math.min(Math.floor(this.scale.height / 215), Math.floor(this.scale.width / 380)));
    cam.setZoom(z - (z % 2));
    cam.centerOn(first.x, first.y);
    this.dark = this.add.renderTexture(0, 0, 64, 64).setOrigin(0).setDepth(D.dark);
    this.lightImg = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
    this.nextTarget();
  }

  nextTarget() {
    const t = this.targets[Math.floor(Math.random() * this.targets.length)];
    this.tweens.add({
      targets: this.focus,
      x: t.x,
      y: t.y,
      duration: Math.max(6000, Math.hypot(t.x - this.focus.x, t.y - this.focus.y) * 25),
      ease: 'Sine.easeInOut',
      onComplete: () => this.time.delayedCall(1500, () => this.nextTarget()),
    });
  }

  update() {
    const cam = this.cameras.main;
    cam.centerOn(this.focus.x, this.focus.y);
    const v = cam.worldView;
    let w = Math.ceil(v.width) + 4,
      h = Math.ceil(v.height) + 4;
    w += w % 2;
    h += h % 2;
    const rt = this.dark;
    if (rt.width !== w || rt.height !== h) rt.resize(w, h);
    const ox = Math.floor(v.x) - 2,
      oy = Math.floor(v.y) - 2;
    rt.setPosition(ox, oy);
    rt.clear();
    rt.fill(0x05040a, 0.8);
    const L = this.lightImg;
    const t = this.time.now / 1000;
    rt.beginDraw();
    for (const l of this.lamps) {
      const x = l.x - ox,
        y = l.y - oy;
      if (x < -l.r || y < -l.r || x > w + l.r || y > h + l.r) continue;
      const fl = l.f ? 1 + Math.sin(t * 9 + l.f) * 0.05 + Math.sin(t * 23 + l.f * 3) * 0.03 : 1;
      L.setScale((l.r * 2 * fl) / 128);
      rt.batchDraw(L, x, y);
    }
    rt.endDraw(true);
  }
}
