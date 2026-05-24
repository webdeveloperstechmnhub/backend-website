const fetch = require('node-fetch');

const SESSION_MANAGER_URL = process.env.SESSION_MANAGER_URL || process.env.SESSION_MANAGER_API_URL;
const INTERNAL_SECRET = process.env.SESSION_MANAGER_SECRET || process.env.INTERNAL_API_SECRET;

async function postInternal(path, body = {}) {
  if (!SESSION_MANAGER_URL) {
    return null;
  }
  try {
    const url = new URL(path, SESSION_MANAGER_URL).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify(body),
      timeout: 5000,
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }
    if (!res.ok) {
      console.warn('[sessionManagerClient] non-ok response', res.status, json);
    }
    return json;
  } catch (err) {
    console.error('[sessionManagerClient] request failed', err);
    return null;
  }
}

async function createSession(payload) {
  return postInternal('/internal/session/create', payload);
}

async function revokeSession(sessionId, opts = {}) {
  return postInternal('/internal/session/revoke', { session_id: sessionId, ...opts });
}

module.exports = {
  createSession,
  revokeSession,
};
