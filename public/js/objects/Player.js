// ============================================================
//  Player – Physics-enabled character with state machine
// ============================================================

import {
  PLAYER_X, GROUND_Y,
  PLAYER_W, PLAYER_H,
  BODY_RUN, BODY_SLIDE,
  WORLD_GRAVITY,
  JUMP_VELOCITY, DOUBLE_JUMP_VEL,
  SLIDE_DURATION,
} from '../config.js';

export const PlayerState = Object.freeze({
  RUNNING:     'running',
  JUMPING:     'jumping',
  DOUBLE_JUMP: 'doubleJump',
  SLIDING:     'sliding',
  DEAD:        'dead',
});

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {string} characterId
   */
  constructor(scene, characterId) {
    super(scene, PLAYER_X, GROUND_Y, `player_${characterId}_run1`);

    this.characterId = characterId;
    this.state       = PlayerState.RUNNING;
    this.jumpCount   = 0;
    this._animFrame  = 0;
    this._animTimer  = 0;
    this._slideTimer = null;
    this.hasShield   = false;   // set true for cyber_runner ability

    // Register with scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Anchor: bottom-center so y = ground surface
    this.setOrigin(0.5, 1);
    this.setDepth(10);

    // Physics
    this.body.setGravityY(WORLD_GRAVITY);
    this.body.setCollideWorldBounds(false);
    this._setRunBody();
  }

  // ─── Public controls ──────────────────────────────────────

  jump() {
    if (this.state === PlayerState.DEAD) return;

    const onGround = this.body.blocked.down;

    if (onGround || this.state === PlayerState.RUNNING) {
      this.body.setVelocityY(JUMP_VELOCITY);
      this.state     = PlayerState.JUMPING;
      this.jumpCount = 1;
      if (this.state === PlayerState.SLIDING) this._cancelSlide();
      this._setRunBody();
    } else if (this.jumpCount === 1) {
      this.body.setVelocityY(DOUBLE_JUMP_VEL);
      this.state     = PlayerState.DOUBLE_JUMP;
      this.jumpCount = 2;
    }
  }

  slide() {
    if (
      this.state === PlayerState.DEAD ||
      this.state === PlayerState.JUMPING ||
      this.state === PlayerState.DOUBLE_JUMP
    ) return;

    if (this.state === PlayerState.SLIDING) {
      // Extend slide
      this._cancelSlide();
    }

    this.state = PlayerState.SLIDING;
    this._setSlideBody();

    this._slideTimer = this.scene.time.delayedCall(SLIDE_DURATION, () => {
      if (this.state === PlayerState.SLIDING) {
        this.state = PlayerState.RUNNING;
        this._setRunBody();
      }
    });
  }

  die() {
    if (this.state === PlayerState.DEAD) return;

    this.state = PlayerState.DEAD;
    this._cancelSlide();
    this.body.setVelocityY(-300);
    this.body.setGravityY(WORLD_GRAVITY * 0.5);

    this.scene.tweens.add({
      targets:  this,
      angle:    -90,
      duration: 500,
      ease:     'Power2',
    });
  }

  activateShield() {
    this.hasShield = true;
    // Visual effect: tinted cyan halo
    this.setTint(0x00E5FF);
  }

  consumeShield() {
    this.hasShield = false;
    this.clearTint();
  }

  // ─── Update loop ──────────────────────────────────────────

  /** @param {number} delta  ms since last frame */
  update(delta) {
    if (this.state === PlayerState.DEAD) return;

    // Land detection
    if (
      this.body.blocked.down &&
      (this.state === PlayerState.JUMPING || this.state === PlayerState.DOUBLE_JUMP)
    ) {
      this.state     = PlayerState.RUNNING;
      this.jumpCount = 0;
    }

    // Run animation cycle (150ms per frame)
    this._animTimer += delta;
    if (this._animTimer >= 150) {
      this._animTimer = 0;
      this._animFrame = 1 - this._animFrame;
    }

    // Pick texture
    let pose;
    switch (this.state) {
      case PlayerState.SLIDING:     pose = 'slide'; break;
      case PlayerState.JUMPING:
      case PlayerState.DOUBLE_JUMP: pose = 'jump';  break;
      default:                      pose = `run${this._animFrame + 1}`; break;
    }
    this.setTexture(`player_${this.characterId}_${pose}`);
  }

  // ─── Private helpers ──────────────────────────────────────

  _setRunBody() {
    this.body.setSize(BODY_RUN.w, BODY_RUN.h);
    this.body.setOffset(BODY_RUN.ox, BODY_RUN.oy);
  }

  _setSlideBody() {
    this.body.setSize(BODY_SLIDE.w, BODY_SLIDE.h);
    this.body.setOffset(BODY_SLIDE.ox, BODY_SLIDE.oy);
  }

  _cancelSlide() {
    if (this._slideTimer) {
      this._slideTimer.remove(false);
      this._slideTimer = null;
    }
  }
}
