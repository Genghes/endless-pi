'use strict';
const express = require('express');
const router = express.Router();
const { approvePayment, completePayment, cancelPayment } = require('../piApi');
const { getUserData, updateUserData } = require('../userStore');

// Allowed metadata types to prevent arbitrary data injection
const ALLOWED_PAYMENT_TYPES = ['character_unlock', 'revive'];
const ALLOWED_CHARACTER_IDS = ['gold_runner', 'cyber_runner'];

// POST /api/payments/approve
// Called by frontend onReadyForServerApproval callback
router.post('/approve', async (req, res) => {
  try {
    const { paymentId, uid } = req.body;

    if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
      return res.status(400).json({ error: 'Invalid paymentId' });
    }
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'Invalid uid' });
    }

    const payment = await approvePayment(paymentId);

    // Validate metadata from Pi API (not from client) before trusting it
    const meta = payment.metadata || {};
    if (meta.type && !ALLOWED_PAYMENT_TYPES.includes(meta.type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }
    if (meta.characterId && !ALLOWED_CHARACTER_IDS.includes(meta.characterId)) {
      return res.status(400).json({ error: 'Invalid characterId' });
    }

    // Record pending payment keyed by paymentId
    const user = getUserData(uid) || {
      uid,
      username: '',
      unlockedCharacters: [],
      highScore: 0,
      pendingPayments: [],
    };
    user.pendingPayments = user.pendingPayments || [];

    // Avoid duplicate entries
    if (!user.pendingPayments.find((p) => p.paymentId === paymentId)) {
      user.pendingPayments.push({
        paymentId,
        type: meta.type,
        characterId: meta.characterId || null,
        status: 'approved',
        createdAt: new Date().toISOString(),
      });
    }
    updateUserData(uid, user);

    res.json({ success: true });
  } catch (err) {
    console.error('Payment approval error:', err.message);
    res.status(500).json({ error: 'Payment approval failed' });
  }
});

// POST /api/payments/complete
// Called by frontend onReadyForServerCompletion callback
router.post('/complete', async (req, res) => {
  try {
    const { paymentId, txid, uid } = req.body;

    if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
      return res.status(400).json({ error: 'Invalid paymentId' });
    }
    if (!txid || typeof txid !== 'string' || txid.length > 200) {
      return res.status(400).json({ error: 'Invalid txid' });
    }
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'Invalid uid' });
    }

    await completePayment(paymentId, txid);

    // Fulfill the purchase
    const user = getUserData(uid) || { uid, unlockedCharacters: [], pendingPayments: [] };
    const pending = (user.pendingPayments || []).find((p) => p.paymentId === paymentId);

    if (pending) {
      if (pending.type === 'character_unlock' && pending.characterId) {
        user.unlockedCharacters = user.unlockedCharacters || [];
        if (
          ALLOWED_CHARACTER_IDS.includes(pending.characterId) &&
          !user.unlockedCharacters.includes(pending.characterId)
        ) {
          user.unlockedCharacters.push(pending.characterId);
        }
      }
      // Remove from pending
      user.pendingPayments = user.pendingPayments.filter((p) => p.paymentId !== paymentId);
    }

    updateUserData(uid, user);

    res.json({
      success: true,
      unlockedCharacters: user.unlockedCharacters || [],
      fulfilled: pending?.type || null,
    });
  } catch (err) {
    console.error('Payment completion error:', err.message);
    res.status(500).json({ error: 'Payment completion failed' });
  }
});

// POST /api/payments/cancel
router.post('/cancel', async (req, res) => {
  try {
    const { paymentId, uid } = req.body;
    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Invalid paymentId' });
    }

    try {
      await cancelPayment(paymentId);
    } catch {
      // Pi API cancel may fail if already cancelled; continue cleanup
    }

    if (uid && typeof uid === 'string') {
      const user = getUserData(uid);
      if (user) {
        user.pendingPayments = (user.pendingPayments || []).filter(
          (p) => p.paymentId !== paymentId
        );
        updateUserData(uid, user);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Payment cancel error:', err.message);
    res.status(500).json({ error: 'Cancel failed' });
  }
});

// GET /api/payments/user/:uid - Get user's unlocked characters
router.get('/user/:uid', (req, res) => {
  const { uid } = req.params;
  if (!uid || typeof uid !== 'string' || uid.length > 100) {
    return res.status(400).json({ error: 'Invalid uid' });
  }
  const user = getUserData(uid) || {};
  res.json({ unlockedCharacters: user.unlockedCharacters || [] });
});

module.exports = router;
