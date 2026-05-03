// ============================================================
//  CoinPool – Spawns and recycles π-coin collectibles
// ============================================================

import { GAME_WIDTH, GROUND_Y } from '../config.js';

const COIN_W = 26;
const COIN_H = 26;

// y-positions for coin rows (in screen space)
const ROW_LOW    = GROUND_Y - 50;   // just above ground
const ROW_MID    = GROUND_Y - 130;  // mid height
const ROW_HIGH   = GROUND_Y - 220;  // high (jump required)

// Coin pattern definitions: array of {relX, relY} relative to spawn anchor
const PATTERNS = [
  // Horizontal line (low)
  [0, 1, 2, 3, 4].map((i) => ({ rx: i * 55, ry: ROW_LOW })),
  // Horizontal line (mid)
  [0, 1, 2, 3, 4].map((i) => ({ rx: i * 55, ry: ROW_MID })),
  // Arc going up then down
  [
    { rx: 0,   ry: ROW_LOW  },
    { rx: 55,  ry: ROW_MID  },
    { rx: 110, ry: ROW_HIGH },
    { rx: 165, ry: ROW_MID  },
    { rx: 220, ry: ROW_LOW  },
  ],
  // Zigzag
  [
    { rx: 0,   ry: ROW_LOW  },
    { rx: 60,  ry: ROW_MID  },
    { rx: 120, ry: ROW_LOW  },
    { rx: 180, ry: ROW_MID  },
  ],
  // Single bonus coin (high, worth more visually)
  [{ rx: 0, ry: ROW_HIGH }],
  // Short low line (3 coins)
  [0, 1, 2].map((i) => ({ rx: i * 60, ry: ROW_LOW })),
];

export default class CoinPool {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group({ allowGravity: false });
    this._pool = [];
  }

  /** Spawn a coin pattern. */
  spawn() {
    const pattern = PATTERNS[Phaser.Math.Between(0, PATTERNS.length - 1)];
    const baseX   = GAME_WIDTH + 50;

    pattern.forEach(({ rx, ry }) => {
      const sprite = this._acquire();
      sprite.setPosition(baseX + rx, ry);
      sprite.setActive(true).setVisible(true);
      sprite.body.reset(baseX + rx, ry);
      sprite.body.allowGravity = false;
    });
  }

  /** Move coins left, recycle off-screen ones.
   *  @returns {number} pixels moved (for caller convenience)
   */
  update(scrollSpeed, delta) {
    const dx = scrollSpeed * (delta / 1000);
    this.group.getChildren().forEach((coin) => {
      if (!coin.active) return;
      coin.x -= dx;
      coin.body.reset(coin.x, coin.y);

      // Gentle bob animation
      coin.y += Math.sin(Date.now() * 0.004 + coin.x * 0.1) * 0.5;

      if (coin.x < -COIN_W) {
        coin.setActive(false).setVisible(false);
        this._pool.push(coin);
      }
    });
  }

  /** Called when a coin is overlapped by player */
  collect(coin) {
    coin.setActive(false).setVisible(false);
    this._pool.push(coin);
  }

  getActive() {
    return this.group.getChildren().filter((c) => c.active);
  }

  // ─── Private ──────────────────────────────────────────────

  _acquire() {
    if (this._pool.length > 0) {
      return this._pool.pop();
    }
    const sprite = this.scene.physics.add.sprite(0, 0, 'coin');
    sprite.body.allowGravity = false;
    sprite.body.setSize(COIN_W - 4, COIN_H - 4); // slightly smaller hitbox for fairness
    this.group.add(sprite);
    return sprite;
  }
}
