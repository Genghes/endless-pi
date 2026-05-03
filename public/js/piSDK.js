// ============================================================
//  Pi Network SDK Wrapper
//  Handles auth, payments and backend communication
// ============================================================

class PiSDKWrapper {
  constructor() {
    this.isInitialized = false;
    this.piSdkInitialized = false;
    this.piInitPromise = null;
    this.currentUser    = null;   // { uid, username, unlockedCharacters, highScore }
    this.isDemoMode     = false;  // true when Pi SDK is not available
  }

  // ----------------------------------------------------------
  //  Init
  // ----------------------------------------------------------
  init() {
    if (typeof window.Pi === 'undefined') {
      console.warn('[PiSDK] Pi SDK not loaded – running in demo mode.');
      if (window.__piLog) window.__piLog('init: window.Pi is undefined → demo mode');
      this.isDemoMode    = true;
      this.piSdkInitialized = false;
      this.isInitialized = false;
      return false;
    }

    // Fire-and-forget bootstrap; authenticate() awaits concrete init completion.
    this._ensurePiInitialized().catch((err) => {
      const msg = this._extractErrorMessage(err);
      console.error('[PiSDK] Pi.init() failed:', msg);
      if (window.__piLog) window.__piLog('init: window.Pi.init() ERROR: ' + msg);
    });

    this.isInitialized = true;
    if (window.__piLog) window.__piLog('init: window.Pi found. sandbox=' + window.__piSandbox);
    console.log('[PiSDK] Pi SDK found. Sandbox:', window.__piSandbox);
    return true;
  }

  _extractErrorMessage(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.message) return String(err.message);
    if (err.error && err.error.message) return String(err.error.message);
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  _extractErrorDetails(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;

    const parts = [];
    if (err.message) parts.push(String(err.message));
    if (err.code) parts.push(`code=${String(err.code)}`);
    if (err.type) parts.push(`type=${String(err.type)}`);
    if (err.error) {
      if (typeof err.error === 'string') parts.push(`error=${err.error}`);
      else if (err.error.message) parts.push(`error=${err.error.message}`);
    }

    const keys = Object.keys(err);
    if (keys.length) parts.push(`keys=${keys.join(',')}`);

    return parts.length ? parts.join(' | ') : this._extractErrorMessage(err);
  }

  async _ensurePiInitialized(force = false) {
    if (typeof window.Pi === 'undefined') {
      this.isDemoMode = true;
      this.piSdkInitialized = false;
      throw new Error('Pi SDK not available in this context');
    }

    if (this.piSdkInitialized && !force) return true;
    if (this.piInitPromise && !force) return this.piInitPromise;

    this.piInitPromise = (async () => {
      try {
        const initResult = window.Pi.init({ version: '2.0', sandbox: !!window.__piSandbox });
        if (initResult && typeof initResult.then === 'function') {
          await initResult;
        }
        this.piSdkInitialized = true;
        if (window.__piLog) window.__piLog('ensureInit: window.Pi.init() OK');
        return true;
      } catch (err) {
        this.piSdkInitialized = false;
        const msg = this._extractErrorMessage(err);
        if (window.__piLog) window.__piLog('ensureInit: ERROR: ' + msg);
        throw new Error(msg);
      } finally {
        this.piInitPromise = null;
      }
    })();

    return this.piInitPromise;
  }

  // ----------------------------------------------------------
  //  Authenticate
  //  Returns the current user object or throws on failure.
  // ----------------------------------------------------------
  async authenticate() {
    if (this.isDemoMode) {
      return this._mockAuth();
    }

    // Do not await before authenticate() to preserve iOS user-gesture context
    // for Pi popup flows. We pre-init during app boot and retry init on error.
    if (!this.piSdkInitialized) {
      this.init();
    }

    // Keep initial login minimal and user-gesture friendly.
    // Requesting payments scope here can cause duplicate prompts/failures
    // in some Pi Browser + app-state combinations.
    const primaryScopes = ['username'];

    // In Pi Browser, Pi.authenticate() resolves within a second or two.
    // In a regular browser it hangs forever → we time out and use demo mode.
    if (window.__piLog) window.__piLog('authenticate: calling Pi.authenticate() ...');
    let auth;
    try {
      auth = await Promise.race([
        window.Pi.authenticate(primaryScopes, (incompletePayment) => {
          this._resolveIncompletePayment(incompletePayment);
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('NOT_PI_BROWSER')), 30000)
        ),
      ]);
      if (window.__piLog) window.__piLog('authenticate: Pi.authenticate() resolved! user=' + (auth && auth.user && auth.user.username));
    } catch (piErr) {
      const msg = this._extractErrorMessage(piErr);
      const details = this._extractErrorDetails(piErr);

      if (/not initialized/i.test(msg)) {
        if (window.__piLog) window.__piLog('authenticate: SDK not initialized, re-init and retry once');
        try {
          await this._ensurePiInitialized(true);
          auth = await Promise.race([
            window.Pi.authenticate(primaryScopes, (incompletePayment) => {
              this._resolveIncompletePayment(incompletePayment);
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('NOT_PI_BROWSER')), 30000)
            ),
          ]);
        } catch (retryErr) {
          console.error('[PiSDK] Retry authenticate failed:', retryErr);
          if (window.__piLog) window.__piLog('authenticate: retry ERROR: ' + this._extractErrorMessage(retryErr));
          throw retryErr;
        }
      } else if (msg === 'NOT_PI_BROWSER') {
        console.warn('[PiSDK] Not in Pi Browser – switching to demo mode.');
        if (window.__piLog) window.__piLog('authenticate: 30s TIMEOUT → demo mode');
        this.isDemoMode = true;
        return this._mockAuth();
      } else {
      // Real Pi auth error (app not registered, URL mismatch etc.) – rethrow
      // so MenuScene can show a retry button instead of silently going to demo.
      console.error('[PiSDK] Pi.authenticate() error:', piErr);
      if (window.__piLog) window.__piLog('authenticate: ERROR: ' + details);
      throw new Error(details);
      }
    }

    const authUser = auth?.user || auth?.userData || null;
    const accessToken = auth?.accessToken || auth?.token || null;
    if (window.__piLog) {
      const keys = auth && typeof auth === 'object' ? Object.keys(auth).join(',') : 'non-object';
      window.__piLog(`authenticate: auth keys = ${keys}`);
    }

    if (!authUser && !accessToken) {
      throw new Error('Pi auth returned unexpected payload');
    }

    // Backend verify – 15s timeout (handles Render cold-start).
    // Falls back to Pi-provided data only on failure.
    try {
      if (!accessToken) {
        throw new Error('No access token from Pi auth');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) throw new Error(`Backend returned ${resp.status}`);
      const data = await resp.json();
      if (!data.verified) throw new Error('Not verified');

      this.currentUser = {
        uid:                data.uid,
        username:           data.username,
        unlockedCharacters: data.unlockedCharacters || [],
        highScore:          data.highScore || 0,
      };
    } catch (backendErr) {
      console.warn('[PiSDK] Backend verify unavailable, using Pi auth only:', backendErr.message);
      this.currentUser = {
        uid:                authUser?.uid || 'pi_unknown_uid',
        username:           authUser?.username || 'Pioneer',
        unlockedCharacters: [],
        highScore:          0,
      };
      if (window.__piLog) {
        window.__piLog(`authenticate: backend fallback user=${this.currentUser.username} uid=${this.currentUser.uid}`);
      }
    }

    return this.currentUser;
  }

  // ----------------------------------------------------------
  //  Create Payment  (user → app)
  // ----------------------------------------------------------
  async createPayment(shopItem, callbacks) {
    if (this.isDemoMode) {
      alert('Pi payments require the Pi Browser.\nRunning in demo mode.');
      callbacks.onError?.(new Error('Demo mode'), null);
      return;
    }
    if (!this.currentUser) {
      callbacks.onError?.(new Error('Not authenticated'), null);
      return;
    }

    try {
      await this._ensurePiInitialized();
    } catch (err) {
      callbacks.onError?.(err, null);
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
