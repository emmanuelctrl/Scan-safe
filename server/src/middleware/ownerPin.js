// Middleware that gates the Owner Portal behind the 6-digit PIN.
//
// After a logged-in user verifies their PIN (POST /api/owner/unlock) they
// receive a short-lived "owner session" JWT bound to their own account id.
// That token is required as an 'x-owner-token' header on all owner-only
// endpoints. Binding it to the user id means a token from one account can
// never unlock another account's owner portal.
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export const OWNER_SCOPE = 'owner-portal';

/** Issue an owner-scoped token after a successful PIN check. */
export function issueOwnerToken(userId) {
  return jwt.sign({ scope: OWNER_SCOPE, uid: userId }, config.jwtSecret, {
    expiresIn: '2h',
  });
}

/**
 * Require a valid owner-scoped token that belongs to the authenticated user.
 * Must run after `requireAuth` so req.user is populated.
 */
export function requireOwner(req, _res, next) {
  const token = req.headers['x-owner-token'];
  if (!token) {
    return next(ApiError.forbidden('Owner PIN verification required.'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.scope !== OWNER_SCOPE || payload.uid !== req.user.id) {
      throw new Error('invalid owner token');
    }
    next();
  } catch {
    next(ApiError.forbidden('Owner session invalid or expired. Re-enter your PIN.'));
  }
}
