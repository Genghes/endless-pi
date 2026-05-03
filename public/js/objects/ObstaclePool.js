// ============================================================
//  ObstaclePool – Manages obstacle spawning and recycling
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../config.js';

// Beam obstacle: physics body covers ONLY the top 24px of the sprite.
// Standing player (top at GROUND_Y-58) overlaps → collision.
// Sliding  player (top at GROUND_Y-34) does not overlap → clear.
const BEAM_BODY_H  = 24;
const BEAM_SPRITE_H = 90;

// Beam is positioned so its sprite TOP sits at GROUND_Y - BEAM_SPRITE_H
// and its physics body (top 24px) spans:
//   y_top    = GROUND_Y - BEAM_SPRITE_H           (e.g. 700 - 90 = 610)
//   y_bottom = GROUND_Y - BEAM_SPRITE_H + 24 = 634
// Standing player top = GROUND_Y - 58 = 642 > 634?  (642 > 634) → no overlap?
// Let me recalculate with correct BODY_RUN values from config (h=58, oy=12):
//   body top = GROUND_Y - (PLAYER_H - BODY_RUN.oy) = 700 - (70 - 12) = 700 - 58 = 642
//   body bottom = GROUND_Y
//
// Beam body top needs to be <= 642 and beam body bottom >= 642 for collision.
// Beam body height = 24, so if beam body TOP = 630:
//   beam body bottom = 654, standing player top = 642 → overlap at [642, 654] ✓
//
// Sliding player body top = GROUND_Y - (PLAYER_H - BODY_SLIDE.oy) = 700 - (70-36) = 666
//   beam body bottom = 654 < 666 → NO overlap ✓
//
// To achieve this: beam sprite origin (0.5, 0), positioned at y = 630.
// Physics body setOffset(0, 0), setSize(200, 24) → body at y=[630, 654]. ✓

const BEAM_Y = 630;   // sprite y (origin top-center) so body spans 630–654

const OBS_TYPES = [
  { key: 'obs_small', w: 48,  h: 55,  originY: 1, bodyH: 55 },
  { key: 'obs_tall',  w: 52,  h: 95,  originY: 1, bodyH: 95 },
  { key: 'obs_beam',  w: 200, h: BEAM_SPRITE_H, originY: 0, bodyH: BEAM_BODY_H },
];

// Spawn patterns: array of {typeIndex, relX} offsets from the first obstacle
const PATTERNS = [
  [{ t: 0, rx: 0 }],                               // single small
  [{ t: 1, rx: 0 }],                               // single tall
  [{ t: 2, rx: 0 }],                               // single beam
  [{ t: 0, rx: 0 }, { t: 0, rx: 260 }],            // two small
  [{ t: 0, rx: 0 }, { t: 2, rx: 500 }],            // small then beam
  [{ t: 2, rx: 0 }, { t: 0, rx: 550 }],            // beam then small
  [{ t: 1, rx: 0 }, { t: 2, rx: 600 }],            // tall then beam
  [{ t: 0, rx: 0 }, { t: 0, rx: 240 }, { t: 0, rx: 480 }],  // triple small
];

export default class ObstaclePool {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group({
      allowGravity: false,
      immovable:    true,
    });
    this._pool = []; // inactive sprites
  }

  /** Spawn the next pattern at the right edge of the screen.
   *  @param {number} patternIndex  If omitted, chosen randomly.
   */
  spawn(patternIndex) {
    const pattern = PATTERNS[
      patternIndex !== undefined ? patternIndex : Phaser.Math.Between(0, PATTERNS.length - 1)
    ];

    pattern.forEach(({ t, rx }) => {
      const def  = OBS_TYPES[t];
      const xPos = GAME_WIDTH + def.w / 2 + rx;
      const yPos = def.originY === 1 ? GROUND_Y : BEAM_Y;

      const sprite = this._acquire(def.key);
      sprite.setPosition(xPos, yPos);
      sprite.setOrigin(0.5, def.originY);
      sprite.setActive(true).setVisible(true);

      // Reset physics body
      sprite.body.reset(xPos, yPos);
      sprite.body.allowGravity = false;
      sprite.body.immovable    = true;
      sprite.body.setSize(def.w, def.bodyH);
      sprite.body.setOffset(0, 0);
    });
  }

  /** Move all active obstacles left by scrollSpeed * dt */
  update(scrollSpeed, delta) {
    const dx = scrollSpeed * (delta / 1000);
    this.group.getChildren().forEach((obs) => {
      if (!obs.active) return;
      obs.x -= dx;
      obs.body.reset(obs.x, obs.y);

      // Recycle when fully off-screen left
      if (obs.x < -200) {
        obs.setActive(false).setVisible(false);
        this._pool.push(obs);
      }
    });
  }

  getActive() {
    return this.group.getChildren().filter((o) => o.active);
  }

  // ─── Private ──────────────────────────────────────────────

  _acquire(textureKey) {
    // Reuse a pooled inactive sprite if available
    const idx = this._pool.findIndex((s) => s.texture.key === textureKey);
    if (idx >= 0) {
      const s = this._pool.splice(idx, 1)[0];
      return s;
    }
    // Create new
    const sprite = this.scene.physics.add.sprite(0, 0, textureKey);
    sprite.body.allowGravity = false;
    sprite.body.immovable    = true;
    this.group.add(sprite);
    return sprite;
  }
}
