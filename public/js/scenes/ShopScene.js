// ============================================================
//  ShopScene – Character shop with Pi payments
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, CHARACTERS, SHOP_ITEMS } from '../config.js';
import piSDK from '../piSDK.js';

const CHAR_ORDER = ['blue_runner', 'red_runner', 'gold_runner', 'cyber_runner'];

export default class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  init(data) {
    this.selectedChar = data?.character || piSDK.currentUser?.selectedChar || 'blue_runner';
    this._buyInProgress = false;
  }

  create() {
    this._buildBackground();
    this._buildHeader();
    this._buildCharacterCards();
    this._buildBackButton();
  }

  // ─── Background ───────────────────────────────────────────

  _buildBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d1117);

    // Subtle grid lines
    const g = this.add.graphics();
    g.lineStyle(1, 0x4A90D9, 0.08);
    for (let x = 0; x < GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y < GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  // ─── Header ───────────────────────────────────────────────

  _buildHeader() {
    this.add.text(GAME_WIDTH / 2, 52, 'CHARACTER SHOP', {
      font: 'bold 30px Arial', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 90, 'Unlock premium characters with Pi', {
      font: '17px Arial', color: '#88ccff',
    }).setOrigin(0.5);

    // Player username / Pi balance hint
    if (piSDK.currentUser) {
      this.add.text(GAME_WIDTH / 2, 120, `Pioneer: ${piSDK.currentUser.username}`, {
        font: '16px Arial', color: '#aaaaaa',
      }).setOrigin(0.5);
    } else {
      this.add.text(GAME_WIDTH / 2, 120, 'Login with Pi to unlock characters', {
        font: '16px Arial', color: '#ff9900',
      }).setOrigin(0.5);
    }
  }

  // ─── Character cards ──────────────────────────────────────

  _buildCharacterCards() {
    this.cardContainers = [];

    CHAR_ORDER.forEach((charId, idx) => {
      const char  = CHARACTERS[charId];
      const row   = Math.floor(idx / 2);
      const col   = idx % 2;
      const cx    = col === 0 ? GAME_WIDTH * 0.27 : GAME_WIDTH * 0.73;
      const cy    = 230 + row * 220;

      this._buildCard(charId, char, cx, cy);
    });
  }

  _buildCard(charId, char, cx, cy) {
    const isOwned    = piSDK.isCharacterUnlocked(charId);
    const isSelected = this.selectedChar === charId;
    const cardKey    = isSelected ? 'char_card_selected' : 'char_card';

    const container = this.add.container(cx, cy);
    this.cardContainers.push({ charId, container });

    // Card background
    const bg = this.add.image(0, 0, cardKey);
    container.add(bg);

    // Character sprite
    const sprite = this.add.image(0, -42, `player_${charId}_run1`).setScale(2.0);
    container.add(sprite);
    // Bounce the sprite
    this.tweens.add({
      targets: sprite, y: -47, duration: 700 + Math.random() * 300,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Character name
    container.add(
      this.add.text(0, 28, char.name, {
        font: 'bold 14px Arial', color: '#FFD700',
      }).setOrigin(0.5)
    );

    // Ability badge
    if (char.ability) {
      container.add(
        this.add.text(0, 46, `✦ ${char.description}`, {
          font: '10px Arial', color: '#88ccff',
          wordWrap: { width: 110 }, align: 'center',
        }).setOrigin(0.5)
      );
    } else {
      container.add(
        this.add.text(0, 46, char.description, {
          font: '10px Arial', color: '#888888',
          wordWrap: { width: 110 }, align: 'center',
        }).setOrigin(0.5)
      );
    }

    // Action button
    if (isSelected) {
      // "Playing" indicator
      const playingBadge = this.add.rectangle(0, 70, 100, 26, 0x27ae60)
        .setStrokeStyle(1, 0x2ecc71);
      container.add(playingBadge);
      container.add(
        this.add.text(0, 70, '▶ PLAYING', { font: 'bold 13px Arial', color: '#ffffff' }).setOrigin(0.5)
      );
    } else if (isOwned) {
      // "Select" button
      const selBtn = this.add.rectangle(0, 70, 100, 26, 0x2d5a9e)
        .setStrokeStyle(1, 0x4A90D9)
        .setInteractive({ useHandCursor: true });
      const selTxt = this.add.text(0, 70, 'SELECT', { font: 'bold 13px Arial', color: '#ffffff' }).setOrigin(0.5);
      container.add([selBtn, selTxt]);

      selBtn.on('pointerup', () => {
        this.selectedChar = charId;
        this._rebuildCards();
      });
    } else if (!char.free) {
      // "Buy" button with Pi price
      const canBuy = !!piSDK.currentUser && !piSDK.isDemoMode;
      const btnColor = canBuy ? 0xB7791F : 0x444444;
      const buyBtn = this.add.rectangle(0, 70, 100, 26, btnColor)
        .setStrokeStyle(1, 0xFFD700)
        .setInteractive({ useHandCursor: canBuy });
      const priceLabel = `${char.piCost} π`;
      const buyTxt = this.add.text(0, 70, canBuy ? priceLabel : '🔒 Login', {
        font: 'bold 13px Arial', color: canBuy ? '#FFD700' : '#888888',
      }).setOrigin(0.5);
      container.add([buyBtn, buyTxt]);

      if (canBuy) {
        buyBtn.on('pointerup', () => this._purchaseCharacter(charId, char));
      }

      // Lock overlay if not logged in
      if (!canBuy) {
        container.add(
          this.add.image(0, -20, 'icon_shield').setAlpha(0.3).setScale(1.5).setTint(0x888888)
        );
      }
    }
  }

  _rebuildCards() {
    this.cardContainers.forEach(({ container }) => container.destroy());
    this.cardContainers = [];
    this._buildCharacterCards();
  }

  // ─── Back button ──────────────────────────────────────────

  _buildBackButton() {
    const btn = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 52, 300, 52, 0x1a1a2e)
      .setStrokeStyle(2, 0x4A90D9)
      .setInteractive({ useHandCursor: true });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '← Back to Menu', {
      font: 'bold 20px Arial', color: '#4A90D9',
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x162032));
    btn.on('pointerout',  () => btn.setFillStyle(0x1a1a2e));
    btn.on('pointerup',   () => {
      this.scene.start('MenuScene');
    });

    // Play button (use selected character)
    const playBtn = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 112, 300, 52, 0x27ae60)
      .setStrokeStyle(2, 0x2ecc71)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 112, `▶ Play as ${CHARACTERS[this.selectedChar]?.name || 'Character'}`, {
      font: 'bold 20px Arial', color: '#ffffff',
    }).setOrigin(0.5);

    playBtn.on('pointerup', () => {
      this.scene.start('GameScene', { character: this.selectedChar });
    });
  }

  // ─── Purchase ─────────────────────────────────────────────

  _purchaseCharacter(charId, char) {
    if (this._buyInProgress) return;
    const shopItem = SHOP_ITEMS[charId];
    if (!shopItem) return;

    this._buyInProgress = true;

    // Payment overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(50);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'UNLOCK CHARACTER', {
      font: 'bold 26px Arial', color: '#FFD700',
    }).setOrigin(0.5).setDepth(51);
    const detail = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${char.name}\n${char.piCost} Pi`, {
      font: '22px Arial', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(51);
    const waitTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, '⏳ Awaiting Pi Browser…', {
      font: '18px Arial', color: '#88ccff',
    }).setOrigin(0.5).setDepth(51);

    const cleanup = () => {
      overlay.destroy(); title.destroy(); detail.destroy(); waitTxt.destroy();
      this._buyInProgress = false;
    };

    piSDK.createPayment(shopItem, {
      onApproved: () => {
        waitTxt.setText('✅ Approved! Confirming on blockchain…');
      },
      onCompleted: (_paymentId, _txid, data) => {
        cleanup();
        this._showPurchaseSuccess(char.name);
        // Refresh card display
        this._rebuildCards();
      },
      onCancel: () => {
        cleanup();
        this._showToast('Purchase cancelled.');
      },
      onError: (err) => {
        cleanup();
        this._showToast(`Error: ${err?.message || 'Payment failed'}`);
      },
    });
  }

  _showPurchaseSuccess(name) {
    const toast = this.add.container(GAME_WIDTH / 2, 200).setDepth(60);
    toast.add(this.add.rectangle(0, 0, 360, 80, 0x27ae60, 1).setStrokeStyle(2, 0x2ecc71));
    toast.add(this.add.text(0, -10, `🎉 ${name} Unlocked!`, { font: 'bold 22px Arial', color: '#fff' }).setOrigin(0.5));
    toast.add(this.add.text(0, 18, 'Character added to your collection', { font: '15px Arial', color: '#ccffcc' }).setOrigin(0.5));
    this.tweens.add({
      targets: toast, y: 160, alpha: 0, delay: 2000, duration: 600,
      onComplete: () => toast.destroy(),
    });
  }

  _showToast(message) {
    const toast = this.add.text(GAME_WIDTH / 2, 200, message, {
      font: '18px Arial', color: '#ff8800',
      backgroundColor: '#1a1a2e',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: toast, alpha: 0, delay: 2500, duration: 500,
      onComplete: () => toast.destroy(),
    });
  }
}
