'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getUserData, updateUserData } = require('../userStore');

const DATA_DIR = path.join(__dirname, '../data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

function loadScores() {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load scores:', e.message);
  }
  return [];
}

function saveScores(scores) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save scores:', e.message);
  }
}

// GET /api/scores/leaderboard
router.get('/leaderboard', (req, res) => {
  const scores = loadScores();
  const top10 = [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s, i) => ({
      rank: i + 1,
      username: s.username,
      score: s.score,
      coinsCollected: s.coinsCollected,
    }));
  res.json({ leaderboard: top10 });
});

// POST /api/scores/submit
router.post('/submit', (req, res) => {
  const { uid, username, score, coinsCollected } = req.body;

  // Validate inputs
  if (!uid || typeof uid !== 'string' || uid.length > 100) {
    return res.status(400).json({ error: 'Invalid uid' });
  }
  if (typeof score !== 'number' || score < 0 || score > 10_000_000 || !isFinite(score)) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  const safeCoins = typeof coinsCollected === 'number' && isFinite(coinsCollected)
    ? Math.max(0, Math.floor(coinsCollected))
    : 0;
  const safeUsername = String(username || 'Pioneer')
    .replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
    .slice(0, 50);

  const scores = loadScores();
  const entry = {
    uid,
    username: safeUsername,
    score: Math.floor(score),
    coinsCollected: safeCoins,
    date: new Date().toISOString(),
  };

  const existingIdx = scores.findIndex((s) => s.uid === uid);
  if (existingIdx >= 0) {
    if (entry.score > scores[existingIdx].score) {
      scores[existingIdx] = entry;
    }
  } else {
    scores.push(entry);
  }

  saveScores(scores);

  // Update user high score
  const user = getUserData(uid);
  if (user && entry.score > (user.highScore || 0)) {
    user.highScore = entry.score;
    updateUserData(uid, user);
  }

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const rank = sortedScores.findIndex((s) => s.uid === uid) + 1;

  res.json({ success: true, rank });
});

module.exports = router;
