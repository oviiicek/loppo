import Phaser from 'phaser';
import { buildAllTextures } from '../gfx/textures';
import { UI } from '../ui/ui';
import { createAllAnims } from '../gfx/anims';
import { prepaintVillageGround } from '../gfx/groundLoader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    // let the browser paint the loading screen before the (blocking) texture generation starts
    this.time.delayedCall(60, () => this.boot());
  }
  boot() {
    buildAllTextures(this);
    createAllAnims(this);
    if (location.search.includes('gallery')) {
      document.querySelector('.loading')?.remove();
      this.scene.start('Gallery');
      return;
    }
    UI.init(this.game);
    // the ground of Loppo is painted in the background, ready for the first walk home
    prepaintVillageGround();
    // make sure the pixel font is ready before any text is drawn
    const go = () => UI.showMainMenu();
    if (document.fonts?.load) document.fonts.load('16px "Jersey 10"').then(go, go);
    else go();
  }
}
