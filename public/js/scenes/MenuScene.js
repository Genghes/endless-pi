// ============================================================
//  MenuScene – Main menu with Pi authentication
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, CHARACTERS } from '../config.js';
import piSDK from '../piSDK.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  init() {
    this.selectedChar = 'blue_runner';
    this._loginAttempted = false;
    this._authInFlight = false;
  }

  create() {
    this._buildBackground();
    this._buildLogo();
    this._buildCharPreview();
    this._buildButtons();
    this._prepareLoginPrompt();
  }

  // ─── Background ───────────────────────────────────────────

  _buildBackground() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x1a1a6e);

    // Floating clouds
    for (let i = 0; i < 3; i++) {
      const c = this.add.image(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(80, 300),
        'cloud'
      ).setAlpha(0.5);
      this.tweens.add({
        targets: c, x: `+=${Phaser.Math.Between(-30, 30)}`,
        duration: Phaser.Math.Between(3000, 5000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Ground strip at bottom
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 60, GAME_WIDTH, 120, 0x1e3d1e);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 108, GAME_WIDTH, 14, 0x3d7a3d);
  }

  // ─── Logo ─────────────────────────────────────────────────

  _buildLogo() {
    this.add.text(GAME_WIDTH / 2, 90, 'π', {
      font: 'bold 80px Arial', color: '#FFD700',
      stroke: '#8B6000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 170, 'ENDLESS', {
      font: 'bold 46px Arial', color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 5,
      letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 220, 'Run · Collect · Earn', {
      font: '18px Arial', color: '#88ccff',
    }).setOrigin(0.5);
  }

  // ─── Character preview ────────────────────────────────────

  _buildCharPreview() {
    const char = CHARACTERS[this.selectedChar];

    this.charSprite = this.add.image(GAME_WIDTH / 2, 360, `player_${this.selectedChar}_run1`)
      .setScale(2.5)
      .setDepth(5);

    // Bounce animation
    this.tweens.add({
      targets: this.charSprite, y: 355, duration: 600,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.charNameTxt = this.add.text(GAME_WIDTH / 2, 440, char.name, {
      font: 'bold 22px Arial', color: '#FFD700',
    }).setOrigin(0.5);
  }

  // ─── Buttons ──────────────────────────────────────────────

  _buildButtons() {
    // User info / login
    this.userPanel = this.add.container(GAME_WIDTH / 2, 506);
    this.userBg   = this.add.rectangle(0, 0, 360, 48, 0x000000, 0.5)
      .setStrokeStyle(1, 0x4A90D9);
    this.userTxt  = this.add.text(0, 0, '⏳ Connecting to Pi Browser...', {
      font: '18px Arial', color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: 330, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.userPanel.add([this.userBg, this.userTxt]);

    // PLAY button
    this._makeBtn(GAME_WIDTH / 2, 580, 'PLAY', 0xFFD700, 0x2d2d00, () => {
      this.scene.start('GameScene', { character: this.selectedChar });
    });

    // SHOP button
    this._makeBtn(GAME_WIDTH / 2, 652, 'SHOP  (Unlock Chars)', 0x2d5a9e, 0xffffff, () => {
      this.scene.start('ShopScene', { character: this.selectedChar });
    });

    // Leaderboard
    this._makeBtn(GAME_WIDTH / 2, 720, '🏆 Leaderboard', 0x2d2d2d, 0xaaaaaa, () => {
      this._showLeaderboard();
    });

    // Controls hint
    this.add.text(GAME_WIDTH / 2, 790, 'Tap = Jump  |  Swipe Down = Slide', {
      font: '16px Arial', color: '#666666',
    }).setOrigin(0.5);

    if (piSDK.isDemoMode) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Demo Mode – Open in Pi Browser for full features', {
        font: '13px Arial', color: '#ff9900',
      }).setOrigin(0.5);
    }
  }

  _makeBtn(x, y, label, bg, textColor, onClick) {
    const w = 320, h = 52;
    const container = this.add.container(x, y);

    const rect = this.add.rectangle(0, 0, w, h, bg)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, label, {
      font: `bold 20px Arial`,
      color: Phaser.Display.Color.IntegerToColor(textColor).rgba,
    }).setOrigin(0.5);

    // Colour fix for non-integer colours
    txt.setColor(textColor === 0xffffff ? '#ffffff' : `#${textColor.toString(16).padStart(6, '0')}`);

    container.add([rect, txt]);

    rect.on('pointerover',  () => rect.setFillStyle(Phaser.Display.Color.IntegerToColor(bg).brighten(15).color));
    rect.on('pointerout',   () => rect.setFillStyle(bg));
    rect.on('pointerdown',  () => { rect.setScale(0.97); });
    rect.on('pointerup',    () => { rect.setScale(1); onClick(); });
  }

  // ─── Pi Auth ──────────────────────────────────────────────

  _prepareLoginPrompt() {
    this.userTxt.setText('Tap to connect Pi account');
    this.userTxt.setColor('#88ccff');
    this.userBg.setInteractive({ useHandCursor: true })
      .once('pointerup', () => {
        this.userTxt.setText('⏳ Connecting to Pi Browser...');
        this.userTxt.setColor('#aaaaaa');
        this._tryAutoLogin();
      });
  }

  async _tryAutoLogin() {
    if (this._authInFlight) return;
    this._authInFlight = true;

    try {
      const user = await piSDK.authenticate();
      this._onLogin(user);
    } catch (e) {
      console.error('[Menu] Auth failed:', e.message);
      const reason = e?.message || 'Unknown error';
      if (window.__piLog) window.__piLog('menu: auth failed reason=' + reason);
      this.userBg.setSize(360, 96);
      this.userTxt.setFontSize(14);
      this.userTxt.setText(`⚠️ Pi auth failed – tap to retry\n(${reason})`);
      this.userTxt.setColor('#ff6666');
      this.userBg.removeAllListeners('pointerup');
      this.userBg.setInteractive({ useHandCursor: true })
        .once('pointerup', () => {
          this.userBg.setSize(360, 48);
          this.userTxt.setFontSize(18);
          this.userTxt.setText('⏳ Connecting to Pi Browser...');
          this.userTxt.setColor('#aaaaaa');
          this._tryAutoLogin();
        });
    } finally {
      this._authInFlight = false;
    }
  }

  _onLogin(user) {
    if (piSDK.isDemoMode) {
      this.userTxt.setText('▶ Playing in demo mode  (open in Pi Browser for full features)');
      this.userTxt.setColor('#ff9900');
    } else {
      this.userTxt.setText(`👤 ${user.username}   🏆 Best: ${(user.highScore || 0).toLocaleString()}`);
      this.userTxt.setColor('#FFD700');
    }
  }

  // ─── Leaderboard overlay ──────────────────────────────────

  async _showLeaderboard() {
    const entries = await piSDK.getLeaderboard();

    const overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(50);
    const bg = this.add.rectangle(0, 0, 400, 540, 0x000000, 0.92)
      .setStrokeStyle(2, 0xFFD700);
    overlay.add(bg);

    overlay.add(
      this.add.text(0, -240, '🏆 Leaderboard', {
        font: 'bold 26px Arial', color: '#FFD700',
      }).setOrigin(0.5)
    );

    if (entries.length === 0) {
      overlay.add(
        this.add.text(0, 0, 'No scores yet.\nBe the first!', {
          font: '20px Arial', color: '#aaaaaa', align: 'center',
        }).setOrigin(0.5)
      );
    } else {
      entries.forEach((entry, i) => {
        const y = -190 + i * 44;
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
        overlay.add(
          this.add.text(-170, y, `${medal} ${entry.username}`, {
            font: '18px Arial', color: '#ffffff',
          })
        );
        overlay.add(
          this.add.text(170, y, entry.score.toLocaleString(), {
            font: '18px Arial', color: '#FFD700',
          }).setOrigin(1, 0)
        );
      });
    }

    const closeBtn = this.add.text(0, 240, '✕  Close', {
      font: 'bold 20px Arial', color: '#ff6666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerup', () => overlay.destroy());
    overlay.add(closeBtn);
  }
}
