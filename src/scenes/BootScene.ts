import Phaser from 'phaser';
import { buildAllTextures } from '../gfx/textures';
import { UI } from '../ui/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    buildAllTextures(this);
    if (location.search.includes('gallery')) {
      this.scene.start('Gallery');
      return;
    }
    UI.init(this.game);
    // make sure the pixel font is ready before any text is drawn
    const go = () => UI.showMainMenu();
    if (document.fonts?.load) document.fonts.load('16px "Jersey 10"').then(go, go);
    else go();
  }
}
