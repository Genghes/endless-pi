# π Runner — Pi Network Endless Runner Game

An HTML5 endless runner game built for the **Pi Network Browser ecosystem**, featuring Pi cryptocurrency integration for authentication, character unlocks, and run revival.

---

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Game Engine | [Phaser 3](https://phaser.io) | Best HTML5 mobile game engine; runs natively in Pi Browser |
| Frontend | Vanilla ES Modules (no bundler) | Simple, fast, Pi Browser-compatible |
| Backend | Node.js + Express | Payment verification, leaderboard, user data |
| Pi SDK | `sdk.minepi.com/pi-sdk.js` | Auth, payments |

> **Why not Unity?** Pi Network apps are **web apps** that run inside the Pi Browser (Chromium-based). Unity WebGL builds are heavy and perform poorly in mobile browsers. Phaser 3 gives native 60fps on mobile.

---

## Project Structure

```
PiNetworkVibeCodeTest/
├── server.js                   ← Express entry point
├── package.json
├── .env.example                ← Copy to .env and fill in your values
│
├── server/
│   ├── piApi.js                ← Pi Platform API client (approve/complete payments)
│   ├── userStore.js            ← Simple JSON file-based user data persistence
│   ├── routes/
│   │   ├── auth.js             ← POST /api/auth/verify
│   │   ├── payments.js         ← POST /api/payments/{approve,complete,cancel}
│   │   └── scores.js           ← GET /api/scores/leaderboard, POST /api/scores/submit
│   └── data/                   ← Runtime data (auto-created, git-ignored)
│
└── public/                     ← Served as static files
    ├── index.html              ← Pi SDK + Phaser CDN + game bootstrap
    └── js/
        ├── config.js           ← Game constants, character definitions
        ├── piSDK.js            ← Pi SDK wrapper singleton
        ├── main.js             ← Phaser game config + scene list
        ├── scenes/
        │   ├── BootScene.js    ← Generates ALL textures programmatically (no assets needed)
        │   ├── MenuScene.js    ← Main menu + Pi auth
        │   ├── GameScene.js    ← Core gameplay loop
        │   ├── GameOverScene.js← Score summary + Pi revive offer
        │   └── ShopScene.js    ← Character shop with Pi payments
        └── objects/
            ├── Player.js       ← Physics character with state machine
            ├── ObstaclePool.js ← Object-pooled obstacle spawning
            └── CoinPool.js     ← π-coin spawning patterns
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Pi Network account
- Pi Browser installed on your phone

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Pi API key from the Developer Portal
```

### 3. Get Your Pi API Key
1. Open **Pi Browser** on your phone
2. Navigate to `pi://develop.pinet.com`
3. Register a new app (or open existing)
4. Copy your **API Key** from the App Dashboard
5. Set `PI_API_KEY=your_key_here` in `.env`

### 4. Run the Development Server
```bash
npm run dev        # uses nodemon for auto-reload
# or
npm start
```

The game runs at `http://localhost:3000`

### 5. Test with Pi Sandbox
1. In the Pi Developer Portal, set **Development URL** to `http://localhost:3000`
2. In Pi Browser on your phone, go to the sandbox URL shown in the portal
3. Authorize the sandbox (Pi App → Utilities → Authorize Sandbox)
4. The game now runs with Pi SDK in sandbox mode (uses Test-Pi, not real Pi)

---

## Gameplay

| Control | Action |
|---------|--------|
| Tap / Space / ↑ | Jump |
| Tap again in air | Double jump |
| Swipe down / S / ↓ | Slide |
| P | Pause |

### Obstacles
- **Red barriers** (small/tall) — jump over
- **Orange beam** — slide/duck under

### Characters

| Character | Cost | Ability |
|-----------|------|---------|
| Blue Runner | Free | — |
| Red Blazer | Free | — |
| Gold Runner | 1 π | +20% coin magnet |
| Cyber Runner | 2 π | Starts with free shield |

---

## Pi Network Integration

### Payment Flow (User → App)
```
1. Player taps "Buy" in ShopScene
2. Pi.createPayment() opens payment dialog in Pi Browser
3. onReadyForServerApproval → POST /api/payments/approve
   (server calls Pi API: /v2/payments/{id}/approve)
4. User confirms in Pi Browser → blockchain transaction
5. onReadyForServerCompletion → POST /api/payments/complete
   (server calls Pi API: /v2/payments/{id}/complete)
6. Server unlocks the character for that user
```

### Incomplete Payment Handling
On every authentication, `onIncompletePaymentFound` fires for any unresolved payment from a previous session. The backend automatically completes or cancels it.

### Authentication
```
Pi.authenticate(['username', 'payments'], onIncompletePayment)
  → frontend sends accessToken to backend
  → backend calls GET /v2/me with accessToken to verify uid
  → uid from Pi API is the canonical, trusted identifier
```

> **Security note**: Never trust the uid sent by the client for fulfillment decisions. Always verify via the Pi API `/me` endpoint using the access token.

---

## Deployment

### Domain Verification (required by Pi)
The server serves `/.well-known/pi-domain-verification` with your verification string.  
Set `PI_DOMAIN_VERIFICATION=your-string` in `.env`.

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGIN=https://your-domain.com`
- [ ] Register Production URL in Pi Developer Portal
- [ ] Complete all 9 steps in the App Checklist
- [ ] Test all payments on Testnet before switching to Mainnet
- [ ] Consider replacing JSON file storage with a proper database (PostgreSQL, MongoDB)

### Hosting Options
- **DigitalOcean** (recommended by Pi docs) — affordable VPS
- **Vercel / Railway** — simple Node.js deployment
- **Pi Core Team Hosting** — apply via Developer Portal

---

## Extending the Game

### Adding New Obstacle Types
Add a new entry to `OBS_TYPES` and `PATTERNS` in [ObstaclePool.js](public/js/objects/ObstaclePool.js), then create the texture in [BootScene.js](public/js/scenes/BootScene.js).

### Adding New Characters
Add to `CHARACTERS` in [config.js](public/js/config.js), add to `SHOP_ITEMS` if it has a Pi price, and add to `ALLOWED_CHARACTER_IDS` in [server/routes/payments.js](server/routes/payments.js).

### Scaling to Production
- Replace `server/userStore.js` JSON storage with a real database
- Add JWT-based sessions instead of passing uid in every request
- Add Redis for rate limiting across multiple server instances
- Implement proper Pi wallet balance checking for play-to-earn features

---

## Pi Network Resources
- [Pi Developer Guide](https://pi-apps.github.io/community-developer-guide/)
- [Pi SDK Reference](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/piAppPlatform/piAppPlatformSDK/)
- [Payment Flow](https://pi-apps.github.io/community-developer-guide/docs/importantTopics/paymentFlow)
- [Pi Platform GitHub Docs](https://github.com/pi-apps/pi-platform-docs)
