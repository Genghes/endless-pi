// ============================================================
//  BootScene – Creates all game textures programmatically.
//  No external assets required; everything is drawn with
//  Phaser Graphics, keeping the game self-contained.
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, CHARACTERS } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this._createPixelTexture();
    this._createBackgroundTextures();
    this._createGroundTextures();
    this._createCharacterTextures();
    this._createObstacleTextures();
    this._createCoinTexture();
    this._createCloudTexture();
    this._createUITextures();
    this._createParticleTexture();

    this.scene.start('MenuScene');
  }

  // ─── helpers ──────────────────────────────────────────────

  /** Draw on a graphics object, capture as named texture, then clean up */
  _tex(key, w, h, drawFn) {
    const g = this.add.graphics();
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // ─── textures ─────────────────────────────────────────────

  _createPixelTexture() {
    this._tex('pixel', 2, 2, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 2, 2);
    });
  }

  _createBackgroundTextures() {
    // Sky gradient (far background)
    this._tex('sky', GAME_WIDTH, GROUND_Y, (g) => {
      g.fillGradientStyle(0x1a1a6e, 0x1a1a6e, 0x2d6a9f, 0x2d6a9f, 1);
      g.fillRect(0, 0, GAME_WIDTH, GROUND_Y);
    });

    // Far layer: mountain silhouettes
    this._tex('mountains', GAME_WIDTH, 160, (g) => {
      g.fillStyle(0x1e3a5f, 1);
      // Left mountain
      g.fillTriangle(0, 160, 120, 40, 240, 160);
      g.fillTriangle(80, 160, 200, 20, 320, 160);
      g.fillTriangle(220, 160, 340, 55, 460, 160);
      g.fillTriangle(350, 160, 420, 30, GAME_WIDTH, 160);
    });

    // Mid layer: city silhouette
    this._tex('city', GAME_WIDTH, 120, (g) => {
      g.fillStyle(0x162032, 1);
      const buildings = [
        [0,  80, 50,  120], [55,  50, 40, 120], [100, 70, 35, 120],
        [140, 40, 45, 120], [190, 60, 30, 120], [225, 30, 50, 120],
        [280, 55, 40, 120], [325, 45, 35, 120], [365, 65, 50, 120],
        [420, 35, 60, 120],
      ];
      buildings.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
      // Windows
      g.fillStyle(0xFFE066, 0.7);
      buildings.forEach(([x, y, w]) => {
        for (let wy = y + 6; wy < 110; wy += 14) {
          for (let wx = x + 5; wx < x + w - 5; wx += 10) {
            if (Math.random() > 0.4) g.fillRect(wx, wy, 5, 6);
          }
        }
      });
    });
  }

  _createGroundTextures() {
    // Visible ground tile (64×32)
    this._tex('ground_tile', 64, 32, (g) => {
      g.fillStyle(0x3d7a3d, 1);   // grass top
      g.fillRect(0, 0, 64, 10);
      g.fillStyle(0x8B5E3C, 1);   // dirt
      g.fillRect(0, 10, 64, 22);
      // dirt variation lines
      g.fillStyle(0x7a5230, 0.5);
      g.fillRect(0, 15, 64, 2);
      g.fillRect(0, 22, 64, 2);
    });
  }

  _createCharacterTextures() {
    Object.values(CHARACTERS).forEach((char) => {
      ['run1', 'run2', 'jump', 'slide'].forEach((pose) => {
        this._drawCharacter(char.id, pose, char.bodyColor, char.detailColor, char.skinColor);
      });
    });
  }

  _drawCharacter(id, pose, bodyColor, detailColor, skinColor) {
    // All poses share a 48×70 canvas, origin(0.5, 1) → bottom-center
    this._tex(`player_${id}_${pose}`, 48, 70, (g) => {
      if (pose === 'slide') {
        // Crouched figure drawn in LOWER part (y=36–70) to match sliding physics body
        // Head
        g.fillStyle(skinColor, 1);
        g.fillCircle(24, 48, 10);
        // Hair
        g.fillStyle(detailColor, 1);
        g.fillRect(15, 39, 18, 6);
        // Body (horizontal)
        g.fillStyle(bodyColor, 1);
        g.fillRect(6, 55, 36, 14);
        // Legs
        g.fillStyle(detailColor, 1);
        g.fillRect(6, 58, 15, 10);
        g.fillRect(26, 58, 15, 10);
      } else if (pose === 'jump') {
        // Head
        g.fillStyle(skinColor, 1);
        g.fillCircle(24, 10, 11);
        // Hair
        g.fillStyle(detailColor, 1);
        g.fillRect(14, 1, 20, 7);
        // Body
        g.fillStyle(bodyColor, 1);
        g.fillRect(12, 20, 24, 26);
        // Arms up
        g.fillStyle(bodyColor, 1);
        g.fillRect(2, 18, 10, 20);
        g.fillRect(36, 18, 10, 20);
        // Tucked legs
        g.fillStyle(detailColor, 1);
        g.fillRect(12, 46, 10, 18);
        g.fillRect(26, 46, 10, 18);
      } else {
        // run1 / run2 – standing run cycle
        // Head
        g.fillStyle(skinColor, 1);
        g.fillCircle(24, 10, 11);
        // Hair
        g.fillStyle(detailColor, 1);
        g.fillRect(14, 1, 20, 7);
        // Eye
        g.fillStyle(0x2d2d2d, 1);
        g.fillRect(28, 9, 4, 4);
        // Body
        g.fillStyle(bodyColor, 1);
        g.fillRect(12, 20, 24, 26);
        // Arms
        g.fillStyle(skinColor, 1);
        if (pose === 'run1') {
          g.fillRect(2, 22, 10, 18);   // left arm forward
          g.fillRect(36, 26, 10, 18);  // right arm back
        } else {
          g.fillRect(2, 26, 10, 18);
          g.fillRect(36, 22, 10, 18);
        }
        // Legs (alternate stride)
        g.fillStyle(detailColor, 1);
        if (pose === 'run1') {
          g.fillRect(12, 46, 11, 24);  // left leg forward
          g.fillRect(25, 50, 11, 20);  // right leg back
        } else {
          g.fillRect(12, 50, 11, 20);
          g.fillRect(25, 46, 11, 24);
        }
        // Shoes
        g.fillStyle(0x2d2d2d, 1);
        if (pose === 'run1') {
          g.fillRect(10, 68, 14, 4);
          g.fillRect(24, 66, 14, 4);
        } else {
          g.fillRect(10, 66, 14, 4);
          g.fillRect(24, 68, 14, 4);
        }
      }
    });
  }

  _createObstacleTextures() {
    // Small barrier (jump over – easy)
    this._tex('obs_small', 48, 55, (g) => {
      g.fillStyle(0xC0392B, 1);
      g.fillRect(0, 0, 48, 55);
      g.fillStyle(0xE74C3C, 1);
      g.fillRect(4, 4, 40, 6);   // top highlight
      g.fillStyle(0x922B21, 1);
      g.fillRect(4, 44, 40, 7);  // shadow
      // Warning stripes
      g.fillStyle(0xFFD700, 0.6);
      for (let i = 0; i < 3; i++) {
        g.fillRect(4 + i * 14, 14, 8, 24);
      }
    });

    // Tall barrier (jump over – needs good timing / double-jump)
    this._tex('obs_tall', 52, 95, (g) => {
      g.fillStyle(0x922B21, 1);
      g.fillRect(0, 0, 52, 95);
      g.fillStyle(0xE74C3C, 1);
      g.fillRect(4, 4, 44, 8);
      g.fillStyle(0x7B241C, 1);
      g.fillRect(4, 82, 44, 9);
      g.fillStyle(0xFFD700, 0.5);
      for (let i = 0; i < 3; i++) {
        g.fillRect(4 + i * 16, 18, 10, 56);
      }
    });

    // Low beam (slide / duck under)
    // Physics body = top 24px; visual includes posts going down
    this._tex('obs_beam', 200, 90, (g) => {
      // Posts (visual, not part of physics body)
      g.fillStyle(0x7f8c8d, 1);
      g.fillRect(0, 0, 14, 90);
      g.fillRect(186, 0, 14, 90);
      // Beam bar (physics body covers this area)
      g.fillStyle(0xE67E22, 1);
      g.fillRect(0, 0, 200, 24);
      g.fillStyle(0xF39C12, 1);
      g.fillRect(4, 4, 192, 8);   // highlight
      g.fillStyle(0xD35400, 1);
      g.fillRect(4, 18, 192, 4);  // shadow
      // Danger stripes on beam
      g.fillStyle(0xE74C3C, 0.6);
      for (let i = 0; i < 8; i++) {
        g.fillRect(16 + i * 22, 0, 12, 24);
      }
    });
  }

  _createCoinTexture() {
    // Pi-logo coin (26×26)
    this._tex('coin', 26, 26, (g) => {
      // Gold circle
      g.fillStyle(0xFFD700, 1);
      g.fillCircle(13, 13, 12);
      // Inner bevel
      g.fillStyle(0xFFE566, 1);
      g.fillCircle(11, 11, 7);
      // π symbol drawn with lines
      g.lineStyle(2.5, 0x8B6000, 1);
      // top bar of π
      g.lineBetween(7, 10, 19, 10);
      // left leg
      g.lineBetween(10, 10, 10, 19);
      // right leg
      g.lineBetween(16, 10, 16, 19);
      // Shadow rim
      g.lineStyle(2, 0xB8860B, 1);
      g.strokeCircle(13, 13, 12);
    });
  }

  _createCloudTexture() {
    this._tex('cloud', 110, 44, (g) => {
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(25, 28, 18);
      g.fillCircle(45, 22, 22);
      g.fillCircle(68, 26, 18);
      g.fillCircle(88, 30, 14);
      g.fillRect(25, 28, 64, 16);
    });
  }

  _createUITextures() {
    // Button background (200×54)
    this._tex('btn', 200, 54, (g) => {
      g.fillStyle(0xFFD700, 1);
      g.fillRoundedRect(0, 0, 200, 54, 10);
      g.fillStyle(0xFFE566, 1);
      g.fillRoundedRect(4, 4, 192, 22, 8);
    });

    // Button pressed
    this._tex('btn_pressed', 200, 54, (g) => {
      g.fillStyle(0xB8860B, 1);
      g.fillRoundedRect(0, 0, 200, 54, 10);
    });

    // Panel background
    this._tex('panel', 420, 160, (g) => {
      g.fillStyle(0x000000, 0.75);
      g.fillRoundedRect(0, 0, 420, 160, 14);
      g.lineStyle(2, 0xFFD700, 0.6);
      g.strokeRoundedRect(0, 0, 420, 160, 14);
    });

    // Character card background (120×160)
    this._tex('char_card', 120, 160, (g) => {
      g.fillStyle(0x162032, 1);
      g.fillRoundedRect(0, 0, 120, 160, 10);
      g.lineStyle(2, 0x4A90D9, 0.5);
      g.strokeRoundedRect(0, 0, 120, 160, 10);
    });

    this._tex('char_card_selected', 120, 160, (g) => {
      g.fillStyle(0x1a3d5c, 1);
      g.fillRoundedRect(0, 0, 120, 160, 10);
      g.lineStyle(3, 0xFFD700, 1);
      g.strokeRoundedRect(0, 0, 120, 160, 10);
    });

    // Shield icon (for cyber_runner ability)
    this._tex('icon_shield', 28, 28, (g) => {
      g.fillStyle(0x00E5FF, 1);
      g.fillTriangle(14, 0, 28, 8, 28, 20);
      g.fillTriangle(14, 0, 0, 8, 0, 20);
      g.fillRect(0, 8, 28, 14);
      g.fillTriangle(0, 22, 28, 22, 14, 28);
    });

    // Coin HUD icon (small 22×22)
    this._tex('coin_hud', 22, 22, (g) => {
      g.fillStyle(0xFFD700, 1);
      g.fillCircle(11, 11, 10);
      g.fillStyle(0xFFE566, 1);
      g.fillCircle(9, 9, 6);
      g.lineStyle(2, 0xB8860B, 1);
      g.lineBetween(6, 9, 16, 9);
      g.lineBetween(9, 9, 9, 16);
      g.lineBetween(14, 9, 14, 16);
    });
  }

  _createParticleTexture() {
    this._tex('particle', 10, 10, (g) => {
      g.fillStyle(0xFFD700, 1);
      g.fillCircle(5, 5, 5);
    });
  }
}
