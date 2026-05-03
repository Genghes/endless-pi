'use strict';
const axios = require('axios');

const PI_API_BASE = 'https://api.minepi.com/v2';

// Create authenticated client for Pi Platform API
const piApiClient = axios.create({
  baseURL: PI_API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Verify a Pioneer's identity by exchanging their access token for profile data.
 * @param {string} accessToken - Token from Pi.authenticate() on the frontend
 * @returns {Promise<{uid: string, username: string}>}
 */
async function verifyUser(accessToken) {
  const response = await axios.get(`${PI_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });
  return response.data;
}

/**
 * Approve a payment on the Pi server so the transaction can proceed.
 * Must be called from onReadyForServerApproval callback.
 */
async function approvePayment(paymentId) {
  const response = await piApiClient.post(
    `/payments/${paymentId}/approve`,
    {},
    { headers: { Authorization: `Key ${process.env.PI_API_KEY}` } }
  );
  return response.data;
}

/**
 * Complete a payment after the blockchain transaction has been submitted.
 * Must be called from onReadyForServerCompletion callback.
 */
async function completePayment(paymentId, txid) {
  const response = await piApiClient.post(
    `/payments/${paymentId}/complete`,
    { txid },
    { headers: { Authorization: `Key ${process.env.PI_API_KEY}` } }
  );
  return response.data;
}

/**
 * Cancel a payment (used for incomplete/abandoned payments).
 */
async function cancelPayment(paymentId) {
  const response = await piApiClient.post(
    `/payments/${paymentId}/cancel`,
    {},
    { headers: { Authorization: `Key ${process.env.PI_API_KEY}` } }
  );
  return response.data;
}

module.exports = { verifyUser, approvePayment, completePayment, cancelPayment };
