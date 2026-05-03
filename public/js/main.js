// ============================================================
//  Endless π – Phaser 3 Game Entry Point
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene     from './scenes/BootScene.js';
import MenuScene     from './scenes/MenuScene.js';
import GameScene     from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import ShopScene     from './scenes/ShopScene.js';
import piSDK         from './piSDK.js';

// Initialise Pi SDK before the game starts
piSDK.init();

const config = {
  type:   Phaser.AUTO,
  width:  GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode:            Phaser.Scale.FIT,
    autoCenter:      Phaser.Scale.CENTER_BOTH,
    width:           GAME_WIDTH,
    height:          GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },   // per-body gravity is set in Player.js
      debug:   false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, ShopScene],
};

const game = new Phaser.Game(config);

// Hide the HTML loading screen once Phaser starts
game.events.once('ready', () => {
  const loadingEl = document.getElementById('loading-screen');
  if (loadingEl) loadingEl.classList.add('hidden');
});
