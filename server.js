'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const paymentsRouter = require('./server/routes/payments');
const authRouter = require('./server/routes/auth');
const scoresRouter = require('./server/routes/scores');

const app = express();
app.enable('trust proxy');

// Force HTTPS in production (Render/other reverse proxies set x-forwarded-proto)
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const proto = req.headers['x-forwarded-proto'];
  if (isProduction && proto && proto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  return next();
});

// Security headers (relaxed CSP for Phaser + Pi SDK CDN)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://sdk.minepi.com',
          'https://cdn.jsdelivr.net',
        ],
        connectSrc: [
          "'self'",
          'https://api.minepi.com',
          'https://sdk.minepi.com',
          'https://*.minepi.com',
        ],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        // Pi SDK uses frames during authentication/payment flows.
        frameSrc: ["'self'", 'https://sdk.minepi.com', 'https://*.minepi.com'],
        // Allow Pi Browser/Portal to embed the app.
        frameAncestors: ["'self'", 'https://*.minepi.com'],
      },
    },
    // Pi auth uses cross-origin popup/iframe communication.
    // COOP same-origin can break post-auth callback channel.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

// CORS - restrict in production
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for API routes (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// API routes
app.use('/api/payments', paymentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);

// Runtime config injected into the client (controls Pi SDK sandbox flag)
// Set PI_SANDBOX=true on Render when testing, PI_SANDBOX=false for mainnet.
app.get('/js/runtime-config.js', (req, res) => {
  const sandbox = process.env.PI_SANDBOX === 'true';
  res.type('application/javascript').send(
    `window.__piSandbox = ${sandbox};`
  );
});

// Domain verification file for Pi Developer Portal (Step 8 checklist)
// Replace content with the string from your Developer Portal
app.get('/.well-known/pi-domain-verification', (req, res) => {
  res.type('text').send(process.env.PI_DOMAIN_VERIFICATION || 'replace-with-your-verification-string');
});

// Serve game for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Endless π server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
