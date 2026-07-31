// Telegram Mini App initData verification.
//
// The client sends the raw `initData` query string that Telegram embedded in
// the WebApp. We MUST cryptographically verify it before trusting any field
// (especially user.id) — an attacker could otherwise post an arbitrary user.
// Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
import crypto from 'node:crypto';

const MAX_AGE_SECONDS = 24 * 60 * 60; // Reject initData older than 24 hours.

/**
 * Verify a Telegram WebApp initData string against the bot token.
 * @param {string} initData  The raw initData query string from the client.
 * @param {string} botToken  The bot token (from the environment only).
 * @returns {object|null}     The verified Telegram `user` object, or null.
 */
export function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  // Data-check-string: remaining params sorted by key, "key=value" joined by \n.
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // secret = HMAC_SHA256(key='WebAppData', message=botToken)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  // computed = HMAC_SHA256(key=secret, message=dataCheckString), hex
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // Constant-time compare, but only after confirming the buffers are the same
  // length — crypto.timingSafeEqual throws on a length mismatch.
  const computedBuf = Buffer.from(computed, 'hex');
  const hashBuf = Buffer.from(hash, 'hex');
  if (computedBuf.length !== hashBuf.length) return null;
  if (!crypto.timingSafeEqual(computedBuf, hashBuf)) return null;

  // Reject stale initData.
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AGE_SECONDS) return null;

  // Parse and return the user object.
  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}
