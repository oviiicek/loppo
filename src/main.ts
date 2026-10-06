import Phaser from 'phaser';
import '@fontsource/jersey-10/latin-ext-400.css';
import '@fontsource/jersey-10/latin-400.css';
import './ui/style.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { GalleryScene } from './scenes/GalleryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#07060a',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 4 },
  scene: [BootScene, GameScene, GalleryScene],
};

const game = new Phaser.Game(config);
(window as any).__game = game;

if (import.meta.env.DEV) import('./dev');
