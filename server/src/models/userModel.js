// Data access for users. All queries use bound parameters (no string
// concatenation) so they are safe against SQL injection.
//
// Each user is the owner of their own "store". When a user is created we also
// create their default settings row (owner PIN + notification email + theme)
// inside a single transaction so an account is never left half-initialised.
import bcrypt from 'bcryptjs';
import { get, run, withTransaction } from '../config/database.js';
import config from '../config/env.js';

const SALT_ROUNDS = 10;

export const UserModel = {
  /** Find a user by email (case-insensitive thanks to COLLATE NOCASE). */
  findByEmail(email) {
    return get('SELECT * FROM users WHERE email = ?', [email]);
  },

  findById(id) {
    return get('SELECT * FROM users WHERE id = ?', [id]);
  },

  /**
   * Create a new user (store) and seed their default settings atomically.
   * New registrations start unverified (emailVerified: false) and must
   * confirm a code emailed to them; the seed script opts out.
   */
  async create({ email, password, name, role = 'worker', emailVerified = false }) {
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const defaultPinHash = bcrypt.hashSync(config.defaultOwnerPin, SALT_ROUNDS);

    const userId = await withTransaction(async (tx) => {
      const info = await tx.run(
        `INSERT INTO users (email, password_hash, name, role, email_verified) VALUES (?, ?, ?, ?, ?)`,
        [email, passwordHash, name || null, role, emailVerified ? 1 : 0]
      );
      const uid = info.lastInsertRowid;

      // Notifications default to the owner's own email until they change it.
      await tx.run(
        `INSERT INTO settings (user_id, owner_pin_hash, notification_email, theme)
         VALUES (?, ?, ?, 'light')`,
        [uid, defaultPinHash, email]
      );
      return uid;
    });

    return this.findById(userId);
  },

  /** Compare a plaintext password against the stored hash. */
  verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password_hash);
  },

  /** Store a bcrypt-hashed email verification code with an expiry. */
  setVerificationCode(userId, code, expiresAt) {
    const codeHash = bcrypt.hashSync(code, SALT_ROUNDS);
    return run(
      `UPDATE users SET verification_code_hash = ?, verification_expires_at = ? WHERE id = ?`,
      [codeHash, expiresAt, userId]
    );
  },

  /** Check a submitted verification code against the stored hash + expiry. */
  checkVerificationCode(user, code) {
    if (!user.verification_code_hash || !user.verification_expires_at) return false;
    if (new Date(user.verification_expires_at).getTime() < Date.now()) return false;
    return bcrypt.compareSync(code, user.verification_code_hash);
  },

  /** Mark the account's email as verified and clear the one-time code. */
  markEmailVerified(userId) {
    return run(
      `UPDATE users SET email_verified = 1, verification_code_hash = NULL,
                        verification_expires_at = NULL
       WHERE id = ?`,
      [userId]
    );
  },

  /** Strip sensitive fields before sending a user to the client. */
  toPublic(user) {
    if (!user) return null;
    const { password_hash, verification_code_hash, verification_expires_at, ...safe } = user;
    return safe;
  },
};
