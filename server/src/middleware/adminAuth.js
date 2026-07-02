// Middleware that gates the app-wide Super Admin panel.
//
// Unlike the Owner PIN (which is per-account), this is a single password for
// the whole app, used by the operator to see every store. After a correct
// POST /api/admin/login the client receives a short-lived admin token that
// must be sent as an 'x-admin-token' header on all admin endpoints.
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export const ADMIN_SCOPE = 'super-admin';

/** Issue an admin-scoped token after a successful password check. */
export function issueAdminToken() {
  return jwt.sign({ scope: ADMIN_SCOPE }, config.jwtSecret, { expiresIn: '2h' });
}

/** Require a valid admin-scoped token. */
export function requireAdmin(req, _res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) {
    return next(ApiError.unauthorized('Admin authentication required.'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.scope !== ADMIN_SCOPE) throw new Error('invalid admin token');
    next();
  } catch {
    next(ApiError.unauthorized('Admin session invalid or expired. Please log in again.'));
  }
}
