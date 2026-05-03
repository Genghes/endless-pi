// ============================================================
//  Endless π – Game Configuration Constants
// ============================================================

export const GAME_WIDTH  = 480;
export const GAME_HEIGHT = 854;

// Ground surface (y-coordinate of ground top)
export const GROUND_Y = 700;

// Player fixed x-position on screen
export const PLAYER_X = 110;

// Physics
export const WORLD_GRAVITY    = 1400;   // px/s²
export const JUMP_VELOCITY    = -700;   // px/s (negative = upward)
export const DOUBLE_JUMP_VEL  = -540;
export const SLIDE_DURATION   = 720;    // ms

// Player sprite & hitbox sizes
export const PLAYER_W = 48;
export const PLAYER_H = 70;

// Physics body sizes (within the 48×70 sprite, origin bottom-center)
export const BODY_RUN   = { w: 32, h: 58, ox: 8,  oy: 12 };  // offset from sprite top-left
export const BODY_SLIDE = { w: 48, h: 34, ox: 0,  oy: 36 };

// Scroll speed (px/s)
export const SCROLL_SPEED_INIT = 280;
export const SCROLL_SPEED_MAX  = 700;
export const SCROLL_ACCEL      = 0.045;  // per second

// Obstacle spawning
export const SPAWN_INTERVAL_INIT = 2200;  // ms
export const SPAWN_INTERVAL_MIN  = 850;
export const SPAWN_INTERVAL_STEP = 18;    // ms reduction per obstacle spawned

// Scoring
export const COIN_SCORE     = 10;
export const DIST_SCORE_DIV = 14;   // 1 point per N pixels scrolled

// ── Characters ──────────────────────────────────────────────
export const CHARACTERS = {
  blue_runner: {
    id: 'blue_runner',
    name: 'Blue Runner',
    free: true,
    bodyColor:   0x4A90D9,
    detailColor: 0x2C5282,
    skinColor:   0xFFCBA4,
    description: 'Classic starter. Fast and dependable.',
    ability: null,
  },
  red_runner: {
    id: 'red_runner',
    name: 'Red Blazer',
    free: true,
    bodyColor:   0xE53E3E,
    detailColor: 0x9B2C2C,
    skinColor:   0xFFCBA4,
    description: 'Always pushing the limit.',
    ability: null,
  },
  gold_runner: {
    id: 'gold_runner',
    name: 'Gold Runner',
    free: false,
    piCost: 1,
    bodyColor:   0xFFD700,
    detailColor: 0xB7791F,
    skinColor:   0xFFCBA4,
    description: '+20% coin magnet range.',
    ability: 'magnet',
  },
  cyber_runner: {
    id: 'cyber_runner',
    name: 'Cyber Runner',
    free: false,
    piCost: 2,
    bodyColor:   0x00E5FF,
    detailColor: 0x0097A7,
    skinColor:   0xE2E8F0,
    description: 'Starts each run with 1 free shield.',
    ability: 'shield',
  },
};

// ── Shop Items (Pi payment metadata) ────────────────────────
export const SHOP_ITEMS = {
  gold_runner: {
    id: 'gold_runner',
    type: 'character_unlock',
    characterId: 'gold_runner',
    amount: 1,
    memo: 'Endless π – Gold Runner Character Unlock',
  },
  cyber_runner: {
    id: 'cyber_runner',
    type: 'character_unlock',
    characterId: 'cyber_runner',
    amount: 2,
    memo: 'Endless π – Cyber Runner Character Unlock',
  },
  revive: {
    id: 'revive',
    type: 'revive',
    characterId: null,
    amount: 0.5,
    memo: 'Endless π – Continue Run',
  },
};
