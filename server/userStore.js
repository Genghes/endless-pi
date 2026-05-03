'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadUsers() {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load users data:', e.message);
  }
  return {};
}

function saveUsers(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save users data:', e.message);
  }
}

/** @param {string} uid */
function getUserData(uid) {
  if (!uid || typeof uid !== 'string') return null;
  const data = loadUsers();
  return data[uid] || null;
}

/** @param {string} uid @param {object} userData */
function updateUserData(uid, userData) {
  if (!uid || typeof uid !== 'string') return;
  const data = loadUsers();
  data[uid] = userData;
  saveUsers(data);
}

module.exports = { getUserData, updateUserData };
