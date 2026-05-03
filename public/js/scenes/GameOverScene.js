// ============================================================
//  GameOverScene – Score summary, Pi earnings, revive option
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, SHOP_ITEMS } from '../config.js';
import piSDK from '../piSDK.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) {
    this.score          = data?.score          || 0;
    this.coinsCollected = data?.coinsCollected  || 0;
    this.character      = data?.character       || 'blue_runner';
    this.reviveUsed     = data?.reviveUsed      || false;
  }

  async create() {
    this._buildBackground();
    this._buildScorePanel();
    this._buildButtons();
    this._buildLeaderboardArea();

    // Submit score to backend
    const result = await piSDK.submitScore(this.score, this.coinsCollected);
    if (result?.rank) {
      this._showRank(result.rank);
    }
  }

  // ─── Background ───────────────────────────────────────────

  _buildBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Player death animation in background
    const charSprite = this.add.image(GAME_WIDTH / 2, 300, `player_${this.character}_jump`)
      .setScale(3)
      .setAlpha(0.18)
      .setTint(0xff0000);
  }

  // ─── Score panel ──────────────────────────────────────────

  _buildScorePanel() {
    // Title
    this.add.text(GAME_WIDTH / 2, 80, 'GAME OVER', {
      font: 'bold 52px Arial',
      color: '#ff4444',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    // Score card
    const cardX = GAME_WIDTH / 2;
    const cardY = 230;
    const cardW = 380, cardH = 200;
    this.add.rectangle(cardX, cardY, cardW, cardH, 0x000000, 0.7)
      .setStrokeStyle(2, 0xFFD700, 0.8);

    this.add.text(cardX, cardY - 70, 'SCORE', {
      font: '18px Arial', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Animated score counter
    this.scoreTxt = this.add.text(cardX, cardY - 34, '0', {
      font: 'bold 54px Arial', color: '#FFFFFF',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Coin count
    this.add.image(cardX - 70, cardY + 42, 'coin_hud').setScale(1.3);
    this.add.text(cardX - 48, cardY + 42, `x ${this.coinsCollected}  Coins collected`, {
      font: '20px Arial', color: '#FFD700',
    }).setOrigin(0, 0.5);

    // Hi-score comparison
    const hi = piSDK.currentUser?.highScore || 0;
    const isNewHi = this.score > hi;
    const hiColor = isNewHi ? '#FFD700' : '#888888';
    const hiLabel = isNewHi ? '🏆 NEW BEST!' : `Best: ${hi.toLocaleString()}`;
    this.add.text(cardX, cardY + 80, hiLabel, {
      font: 'bold 20px Arial', color: hiColor,
    }).setOrigin(0.5);

    // Animate score count-up
    this.tweens.addCounter({
      from: 0, to: this.score,
      duration: 1200, ease: 'Power2',
      onUpdate: (tween) => {
        this.scoreTxt.setText(Math.floor(tween.getValue()).toLocaleString());
      },
    });
  }

  // ─── Buttons ──────────────────────────────────────────────

  _buildButtons() {
    const btnY = [380, 460, 540, 620];

    // REVIVE (only offered if Pi SDK available and not already used)
    if (!this.reviveUsed && !piSDK.isDemoMode && piSDK.currentUser) {
      this._makeBtn(
        GAME_WIDTH / 2, btnY[0],
        `Continue Run – 0.5 π`, 0x8B4513, '#FFD700',
        () => this._purchaseRevive()
      );
    } else {
      // Play Again occupies top slot
      this._makeBtn(GAME_WIDTH / 2, btnY[0], '▶  Play Again', 0x27ae60, '#ffffff', () => this._playAgain());
    }

    if (!this.reviveUsed && !piSDK.isDemoMode && piSDK.currentUser) {
      this._makeBtn(GAME_WIDTH / 2, btnY[1], '▶  Play Again', 0x27ae60, '#ffffff', () => this._playAgain());
      this._makeBtn(GAME_WIDTH / 2, btnY[2], '🏠  Main Menu',  0x2d2d2d, '#aaaaaa', () => this._goMenu());
      this._makeBtn(GAME_WIDTH / 2, btnY[3], '🛒  Shop',        0x2d5a9e, '#ffffff', () => this._goShop());
    } else {
      this._makeBtn(GAME_WIDTH / 2, btnY[1], '🏠  Main Menu',  0x2d2d2d, '#aaaaaa', () => this._goMenu());
      this._makeBtn(GAME_WIDTH / 2, btnY[2], '🛒  Shop',        0x2d5a9e, '#ffffff', () => this._goShop());
    }
  }

  _makeBtn(x, y, label, bg, color, onClick) {
    const w = 320, h = 52;
    const bg_ = this.add.rectangle(x, y, w, h, bg)
      .setStrokeStyle(2, 0xffffff, 0.2)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      font: 'bold 20px Arial', color,
    }).setOrigin(0.5);

    bg_.on('pointerover',  () => bg_.setAlpha(0.85));
    bg_.on('pointerout',   () => bg_.setAlpha(1));
    bg_.on('pointerdown',  () => bg_.setScale(0.97));
    bg_.on('pointerup',    () => { bg_.setScale(1); onClick(); });
  }

  // ─── Rank display ─────────────────────────────────────────

  _showRank(rank) {
    const suffix = ['st', 'nd', 'rd'][rank - 1] || 'th';
    const rankTxt = this.add.text(GAME_WIDTH / 2, 650, `Leaderboard rank: #${rank}${suffix}`, {
      font: '18px Arial', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(10);
  }

  // ─── Leaderboard area ─────────────────────────────────────

  _buildLeaderboardArea() {
    // Shown at bottom if space allows; skip if cramped
  }

  // ─── Actions ──────────────────────────────────────────────

  _playAgain() {
    this.scene.start('GameScene', { character: this.character });
  }

  _goMenu() {
    this.scene.start('MenuScene');
  }

  _goShop() {
    this.scene.start('ShopScene', { character: this.character });
  }

  _purchaseRevive() {
    const item = SHOP_ITEMS.revive;

    // Disable button visually while payment proceeds
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setDepth(30);
    const waitTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '⏳ Processing payment…', {
      font: '22px Arial', color: '#FFD700',
    }).setOrigin(0.5).setDepth(31);

    piSDK.createPayment(item, {
      onCompleted: (_paymentId, _txid, _data) => {
        overlay.destroy();
        waitTxt.destroy();
        // Restart game scene with revive flag
        this.scene.start('GameScene', { character: this.character, reviveUsed: true });
      },
      onCancel: () => {
        overlay.destroy();
        waitTxt.destroy();
      },
      onError: (err) => {
        overlay.destroy();
        waitTxt.destroy();
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Payment failed:\n${err.message}`, {
          font: '18px Arial', color: '#ff4444', align: 'center',
        }).setOrigin(0.5).setDepth(30);
      },
    });
  }
}
