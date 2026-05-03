// ============================================================
//  GameScene – Core gameplay loop
// ============================================================

import {
  GAME_WIDTH, GAME_HEIGHT, GROUND_Y,
  SCROLL_SPEED_INIT, SCROLL_SPEED_MAX, SCROLL_ACCEL,
  SPAWN_INTERVAL_INIT, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_STEP,
  COIN_SCORE, DIST_SCORE_DIV,
  CHARACTERS,
} from '../config.js';

import Player, { PlayerState }  from '../objects/Player.js';
import ObstaclePool             from '../objects/ObstaclePool.js';
import CoinPool                 from '../objects/CoinPool.js';
import piSDK                    from '../piSDK.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // ─── init ─────────────────────────────────────────────────

  init(data) {
    this.selectedChar   = data?.character || 'blue_runner';
    this.hasExtraShield = CHARACTERS[this.selectedChar]?.ability === 'shield';
    this.hasMagnet      = CHARACTERS[this.selectedChar]?.ability === 'magnet';
    this.magnetRange    = this.hasMagnet ? 140 : 90;
  }

  // ─── create ───────────────────────────────────────────────

  create() {
    // Game state
    this.scrollSpeed    = SCROLL_SPEED_INIT;
    this.score          = 0;
    this.coinsCollected = 0;
    this.distancePixels = 0;
    this.isGameOver     = false;
    this.spawnInterval  = SPAWN_INTERVAL_INIT;
    this.obstacleCount  = 0;
    this.reviveUsed     = false;

    this._buildBackground();
    this._buildGround();
    this._buildPlayer();
    this._buildObstacles();
    this._buildCoins();
    this._buildHUD();
    this._buildInput();
    this._scheduleNextSpawn();
  }

  // ─── update ───────────────────────────────────────────────

  update(time, delta) {
    if (this.isGameOver) return;

    const dt = Math.min(delta, 50);  // clamp to avoid huge jumps on tab refocus

    // Ramp up speed
    this.scrollSpeed = Math.min(
      SCROLL_SPEED_MAX,
      this.scrollSpeed + SCROLL_ACCEL * (dt / 1000) * this.scrollSpeed
    );

    // Scroll world
    this._scrollBackground(dt);
    this._scrollGround(dt);
    this.obstaclePool.update(this.scrollSpeed, dt);
    this.coinPool.update(this.scrollSpeed, dt);

    // Update player
    this.player.update(dt);

    // Magnet effect: pull nearby coins
    if (this.hasMagnet) this._applyMagnet(dt);

    // Collision: player vs obstacles
    if (!this.isGameOver) {
      this.obstaclePool.getActive().forEach((obs) => {
        if (this.physics.overlap(this.player, obs)) {
          this._onHitObstacle();
        }
      });
    }

    // Overlap: player vs coins
    this.coinPool.getActive().forEach((coin) => {
      if (this.physics.overlap(this.player, coin)) {
        this._onCollectCoin(coin);
      }
    });

    // Score
    this.distancePixels += this.scrollSpeed * (dt / 1000);
    this.score = Math.floor(this.distancePixels / DIST_SCORE_DIV) + this.coinsCollected * COIN_SCORE;
    this._updateHUD();

    // Keyboard input each frame
    this._handleKeyboard();
  }

  // ─── Background ───────────────────────────────────────────

  _buildBackground() {
    // Sky (static)
    this.add.image(GAME_WIDTH / 2, GROUND_Y / 2, 'sky').setOrigin(0.5, 0.5).setDisplaySize(GAME_WIDTH, GROUND_Y);

    // Scrolling layers (tiled pairs for seamless loop)
    const groundBar = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + (GAME_HEIGHT - GROUND_Y) / 2, GAME_WIDTH, GAME_HEIGHT - GROUND_Y, 0x3d7a3d);
    groundBar.setDepth(0);

    // Mountains (2 sprites for tiling)
    this.mountains = this._createScrollLayer('mountains', GAME_WIDTH, 160, GROUND_Y - 160, 2);

    // City (2 sprites)
    this.cityLayer = this._createScrollLayer('city', GAME_WIDTH, 120, GROUND_Y - 120, 2);

    // Clouds (individual moving objects)
    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(
        Phaser.Math.Between(50, GAME_WIDTH - 50),
        Phaser.Math.Between(60, 220),
        'cloud'
      ).setAlpha(0.8).setDepth(1);
      cloud._speed = Phaser.Math.FloatBetween(18, 38);
      this.clouds.push(cloud);
    }
  }

  _createScrollLayer(key, w, h, y, count) {
    const layers = [];
    for (let i = 0; i < count; i++) {
      const img = this.add.image(i * w + w / 2, y + h / 2, key)
        .setDisplaySize(w, h)
        .setDepth(1);
      layers.push(img);
    }
    return layers;
  }

  _scrollBackground(dt) {
    const mountainSpeed = this.scrollSpeed * 0.15;
    const citySpeed     = this.scrollSpeed * 0.35;
    const cloudSpeed    = this.scrollSpeed * 0.08;

    this._scrollLayer(this.mountains, mountainSpeed, dt, GAME_WIDTH);
    this._scrollLayer(this.cityLayer, citySpeed,     dt, GAME_WIDTH);

    this.clouds.forEach((c) => {
      c.x -= c._speed * (dt / 1000);
      if (c.x < -80) {
        c.x = GAME_WIDTH + 80;
        c.y = Phaser.Math.Between(60, 220);
      }
    });
  }

  _scrollLayer(layers, speed, dt, tileWidth) {
    const dx = speed * (dt / 1000);
    layers.forEach((img) => {
      img.x -= dx;
      if (img.x < -tileWidth / 2) {
        // Find the rightmost layer and place this one after it
        const maxX = Math.max(...layers.map((l) => l.x));
        img.x = maxX + tileWidth;
      }
    });
  }

  // ─── Ground ───────────────────────────────────────────────

  _buildGround() {
    // Invisible static physics platform (player lands on this)
    const groundPhys = this.add.rectangle(GAME_WIDTH * 2, GROUND_Y + 5, GAME_WIDTH * 6, 20, 0, 0);
    this.physics.add.existing(groundPhys, true);
    this.groundBody = groundPhys;

    // Visual ground tiles (scrolling)
    this.groundTiles = [];
    const tileW = 64;
    const tilesNeeded = Math.ceil(GAME_WIDTH / tileW) + 2;
    for (let i = 0; i < tilesNeeded; i++) {
      const tile = this.add.image(i * tileW + tileW / 2, GROUND_Y + 12, 'ground_tile')
        .setDisplaySize(tileW, 32)
        .setDepth(4);
      this.groundTiles.push(tile);
    }
  }

  _scrollGround(dt) {
    const dx = this.scrollSpeed * (dt / 1000);
    const tileW = 64;
    this.groundTiles.forEach((tile) => {
      tile.x -= dx;
      if (tile.x < -tileW / 2) {
        const maxX = Math.max(...this.groundTiles.map((t) => t.x));
        tile.x = maxX + tileW;
      }
    });
  }

  // ─── Player ───────────────────────────────────────────────

  _buildPlayer() {
    this.player = new Player(this, this.selectedChar);

    // Apply cyber_runner ability
    if (this.hasExtraShield) {
      this.player.activateShield();
    }

    // Collide player with ground
    this.physics.add.collider(this.player, this.groundBody);
  }

  // ─── Obstacles & Coins ────────────────────────────────────

  _buildObstacles() {
    this.obstaclePool = new ObstaclePool(this);
  }

  _buildCoins() {
    this.coinPool = new CoinPool(this);
  }

  _scheduleNextSpawn() {
    if (this.isGameOver) return;
    this.time.delayedCall(this.spawnInterval, () => {
      if (this.isGameOver) return;

      this.obstaclePool.spawn();
      this.obstacleCount++;

      // Every 3 obstacles, also spawn a coin pattern
      if (this.obstacleCount % 2 === 0) {
        this.coinPool.spawn();
      }

      // Decrease spawn interval (harder over time)
      this.spawnInterval = Math.max(
        SPAWN_INTERVAL_MIN,
        this.spawnInterval - SPAWN_INTERVAL_STEP
      );
      this._scheduleNextSpawn();
    });
  }

  // ─── Collision handlers ───────────────────────────────────

  _onHitObstacle() {
    if (this.isGameOver) return;

    // Shield absorbs first hit
    if (this.player.hasShield) {
      this.player.consumeShield();
      this._flashRed();
      return;
    }

    this.isGameOver = true;
    this.player.die();

    // Camera shake
    this.cameras.main.shake(400, 0.012);

    // Particle burst at player position
    this._emitDeathParticles();

    // Delay transition to GameOver scene
    this.time.delayedCall(900, () => {
      this.scene.start('GameOverScene', {
        score:          this.score,
        coinsCollected: this.coinsCollected,
        character:      this.selectedChar,
        reviveUsed:     this.reviveUsed,
      });
    });
  }

  _onCollectCoin(coin) {
    this.coinPool.collect(coin);
    this.coinsCollected++;
    this._emitCoinParticle(coin.x, coin.y);
  }

  // ─── Magnet ability ───────────────────────────────────────

  _applyMagnet(dt) {
    const px = this.player.x;
    const py = this.player.y - 35; // approximate center
    const range = this.magnetRange;

    this.coinPool.getActive().forEach((coin) => {
      const dist = Phaser.Math.Distance.Between(coin.x, coin.y, px, py);
      if (dist < range) {
        const angle = Phaser.Math.Angle.Between(coin.x, coin.y, px, py);
        const speed = 300 * (1 - dist / range);
        coin.x += Math.cos(angle) * speed * (dt / 1000);
        coin.y += Math.sin(angle) * speed * (dt / 1000);
      }
    });
  }

  // ─── HUD ──────────────────────────────────────────────────

  _buildHUD() {
    const depth = 20;

    // Semi-transparent top bar
    this.add.rectangle(GAME_WIDTH / 2, 36, GAME_WIDTH, 72, 0x000000, 0.45).setDepth(depth);

    this.scoreTxt = this.add.text(GAME_WIDTH / 2, 22, '0', {
      font:  '28px Arial',
      color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(depth);

    // Coin counter (top-right)
    this.add.image(GAME_WIDTH - 70, 44, 'coin_hud').setDepth(depth);
    this.coinTxt = this.add.text(GAME_WIDTH - 50, 36, 'x0', {
      font:  '22px Arial',
      color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(depth);

    // Speed indicator (optional, top-left)
    this.speedTxt = this.add.text(14, 36, '', {
      font:  '16px Arial',
      color: '#aaaaaa',
    }).setOrigin(0, 0.5).setDepth(depth);

    // Shield icon (visible when shield active)
    this.shieldIcon = this.add.image(26, 44, 'icon_shield').setDepth(depth).setVisible(false);
  }

  _updateHUD() {
    this.scoreTxt.setText(this.score.toLocaleString());
    this.coinTxt.setText(`x${this.coinsCollected}`);
    this.speedTxt.setText(`${Math.floor(this.scrollSpeed)} px/s`);
    this.shieldIcon.setVisible(this.player.hasShield);
  }

  // ─── Input ────────────────────────────────────────────────

  _buildInput() {
    // Touch / pointer
    let touchStartY   = 0;
    let touchStartTime = 0;

    this.input.on('pointerdown', (ptr) => {
      touchStartY    = ptr.y;
      touchStartTime = this.time.now;
    });

    this.input.on('pointerup', (ptr) => {
      if (this.isGameOver) return;
      const dy = ptr.y - touchStartY;
      const dt = this.time.now - touchStartTime;
      if (dy > 55 && dt < 350) {
        this.player.slide();
      } else if (Math.abs(dy) < 55) {
        this.player.jump();
      }
    });

    // Keyboard (desktop testing)
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.slideKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.slideKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    // Pause (P key)
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P).on('down', () => {
      this._togglePause();
    });
  }

  _handleKeyboard() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this.player.jump();
    }
    if (Phaser.Input.Keyboard.JustDown(this.slideKey) ||
        Phaser.Input.Keyboard.JustDown(this.slideKey2)) {
      this.player.slide();
    }
  }

  _togglePause() {
    if (this.physics.world.isPaused) {
      this.physics.world.resume();
      this.time.timeScale = 1;
      this.pauseOverlay?.setVisible(false);
    } else {
      this.physics.world.pause();
      this.time.timeScale = 0;
      if (!this.pauseOverlay) {
        this.pauseOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
          .setDepth(50)
          .setInteractive()
          .on('pointerdown', () => this._togglePause());
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'PAUSED\nTap to resume', {
          font: '32px Arial', color: '#FFD700', align: 'center',
        }).setOrigin(0.5).setDepth(51);
      } else {
        this.pauseOverlay.setVisible(true);
      }
    }
  }

  // ─── Visual effects ───────────────────────────────────────

  _flashRed() {
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.4)
      .setDepth(30);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  _emitDeathParticles() {
    for (let i = 0; i < 16; i++) {
      const p = this.add.image(this.player.x, this.player.y - 35, 'particle').setDepth(25);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(80, 250);
      this.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * speed,
        y: p.y + Math.sin(angle) * speed,
        alpha:    0,
        scaleX:   0,
        scaleY:   0,
        duration: Phaser.Math.Between(400, 700),
        ease:     'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  _emitCoinParticle(x, y) {
    const txt = this.add.text(x, y - 10, `+${COIN_SCORE}`, {
      font: '18px Arial', color: '#FFD700',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(15).setOrigin(0.5);
    this.tweens.add({
      targets: txt, y: y - 60, alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }
}
