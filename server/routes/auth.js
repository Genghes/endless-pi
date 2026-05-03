'use strict';
const express = require('express');
const router = express.Router();
const { verifyUser } = require('../piApi');
const { getUserData, updateUserData } = require('../userStore');

// POST /api/auth/verify
// Verifies a Pioneer by exchanging their access token with the Pi Platform API.
// Security: We always call Pi's /me endpoint - never trust client-provided uid alone.
router.post('/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string' || accessToken.length > 512) {
      return res.status(400).json({ error: 'Invalid accessToken' });
    }

    // Verify with Pi Platform API - this returns the canonical uid
    const piUser = await verifyUser(accessToken);

    if (!piUser || !piUser.uid) {
      return res.status(401).json({ error: 'Pi verification failed', verified: false });
    }

    // Sanitize username (prevent XSS if username is displayed in HTML)
    const safeUsername = String(piUser.username || 'Pioneer')
      .replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
      .slice(0, 50);

    // Upsert user record
    const existing = getUserData(piUser.uid) || {
      uid: piUser.uid,
      username: safeUsername,
      unlockedCharacters: [],
      highScore: 0,
      pendingPayments: [],
    };
    existing.username = safeUsername;
    existing.lastLogin = new Date().toISOString();
    updateUserData(piUser.uid, existing);

    res.json({
      verified: true,
      uid: piUser.uid,
      username: safeUsername,
      unlockedCharacters: existing.unlockedCharacters || [],
      highScore: existing.highScore || 0,
    });
  } catch (err) {
    console.error('Auth verification error:', err.message);
    // Don't leak internal error details to client
    res.status(401).json({ error: 'Authentication failed', verified: false });
  }
});

module.exports = router;
