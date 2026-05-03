// ============================================================
//  Pi Network SDK Wrapper
//  Handles auth, payments and backend communication
// ============================================================

class PiSDKWrapper {
  constructor() {
    this.isInitialized = false;
    this.currentUser    = null;   // { uid, username, unlockedCharacters, highScore }
    this.isDemoMode     = false;  // true when Pi SDK is not available
  }

  // ----------------------------------------------------------
  //  Init
  // ----------------------------------------------------------
  init() {
    if (typeof window.Pi === 'undefined') {
      console.warn('[PiSDK] Pi SDK not loaded – running in demo mode.');
      this.isDemoMode     = true;
      this.isInitialized  = false;
      return false;
    }
    // SDK already initialised in index.html <script> block
    this.isInitialized = true;
    console.log('[PiSDK] Ready. Sandbox:', window.__piSandbox);
    return true;
  }

  // ----------------------------------------------------------
  //  Authenticate
  //  Returns the current user object or throws on failure.
  // ----------------------------------------------------------
  async authenticate() {
    if (this.isDemoMode) {
      return this._mockAuth();
    }

    const scopes = ['username', 'payments'];

    return new Promise((resolve, reject) => {
      window.Pi.authenticate(scopes, (incompletePayment) => {
        // Handle any unresolved payment left from a previous session
        this._resolveIncompletePayment(incompletePayment);
      })
        .then(async (auth) => {
          try {
            const resp = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: auth.accessToken }),
            });
            if (!resp.ok) throw new Error('Backend verify failed');
            const data = await resp.json();
            if (!data.verified) throw new Error('Not verified');

            this.currentUser = {
              uid:                data.uid,
              username:           data.username,
              unlockedCharacters: data.unlockedCharacters || [],
              highScore:          data.highScore || 0,
            };
            resolve(this.currentUser);
          } catch (backendErr) {
            // Fallback: use client-side auth only (no shop/unlock features)
            console.warn('[PiSDK] Backend verify unavailable, using client auth only:', backendErr.message);
            this.currentUser = {
              uid:                auth.user.uid,
              username:           auth.user.username || 'Pioneer',
              unlockedCharacters: [],
              highScore:          0,
            };
            resolve(this.currentUser);
          }
        })
        .catch(reject);
    });
  }

  // ----------------------------------------------------------
  //  Create Payment  (user → app)
  // ----------------------------------------------------------
  createPayment(shopItem, callbacks) {
    if (this.isDemoMode) {
      alert('Pi payments require the Pi Browser.\nRunning in demo mode.');
      callbacks.onError?.(new Error('Demo mode'), null);
      return;
    }
    if (!this.currentUser) {
      callbacks.onError?.(new Error('Not authenticated'), null);
      return;
    }

    const paymentData = {
      amount:   shopItem.amount,
      memo:     shopItem.memo,
      metadata: {
        type:        shopItem.type,
        characterId: shopItem.characterId || null,
      },
    };

    const uid = this.currentUser.uid;

    window.Pi.createPayment(paymentData, {
      onReadyForServerApproval: async (paymentId) => {
        try {
          const resp = await fetch('/api/payments/approve', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ paymentId, uid }),
          });
          if (!resp.ok) throw new Error('Approval failed');
          callbacks.onApproved?.(paymentId);
        } catch (e) {
          console.error('[PiSDK] Server approval error:', e.message);
        }
      },

      onReadyForServerCompletion: async (paymentId, txid) => {
        try {
          const resp = await fetch('/api/payments/complete', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ paymentId, txid, uid }),
          });
          if (!resp.ok) throw new Error('Completion failed');
          const data = await resp.json();

          // Update local user data
          if (data.unlockedCharacters) {
            this.currentUser.unlockedCharacters = data.unlockedCharacters;
          }
          callbacks.onCompleted?.(paymentId, txid, data);
        } catch (e) {
          console.error('[PiSDK] Server completion error:', e.message);
          callbacks.onError?.(e, null);
        }
      },

      onCancel: async (paymentId) => {
        try {
          await fetch('/api/payments/cancel', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ paymentId, uid }),
          });
        } catch { /* ignore cancel errors */ }
        callbacks.onCancel?.(paymentId);
      },

      onError: (error, payment) => {
        console.error('[PiSDK] Payment error:', error);
        callbacks.onError?.(error, payment);
      },
    }).catch((e) => {
      console.error('[PiSDK] createPayment rejected:', e);
      callbacks.onError?.(e, null);
    });
  }

  // ----------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------
  isCharacterUnlocked(characterId) {
    const FREE_CHARS = ['blue_runner', 'red_runner'];
    if (FREE_CHARS.includes(characterId)) return true;
    return (this.currentUser?.unlockedCharacters || []).includes(characterId);
  }

  async submitScore(score, coinsCollected) {
    if (!this.currentUser) return null;
    try {
      const resp = await fetch('/api/scores/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          uid:            this.currentUser.uid,
          username:       this.currentUser.username,
          score,
          coinsCollected,
        }),
      });
      const data = await resp.json();
      if (data.success && score > (this.currentUser.highScore || 0)) {
        this.currentUser.highScore = score;
      }
      return data;
    } catch {
      return null;
    }
  }

  async getLeaderboard() {
    try {
      const resp = await fetch('/api/scores/leaderboard');
      const data = await resp.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }

  // ----------------------------------------------------------
  //  Private helpers
  // ----------------------------------------------------------
  _resolveIncompletePayment(payment) {
    if (!payment) return;
    const paymentId = payment.identifier;
    const txid      = payment.transaction?.txid;
    const uid       = this.currentUser?.uid;

    if (txid) {
      fetch('/api/payments/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentId, txid, uid }),
      }).catch(console.error);
    } else {
      fetch('/api/payments/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentId, uid }),
      }).catch(console.error);
    }
  }

  _mockAuth() {
    this.isDemoMode  = true;
    this.currentUser = {
      uid:                'demo_uid_001',
      username:           'DemoPioneer',
      unlockedCharacters: [],
      highScore:          0,
    };
    return Promise.resolve(this.currentUser);
  }
}

// Singleton instance shared across all scenes
const piSDK = new PiSDKWrapper();
export default piSDK;
