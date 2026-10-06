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
    UI.showMainMenu();
  }
}
