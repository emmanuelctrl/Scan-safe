// Data access for users. All queries use bound parameters (no string
// concatenation) so they are safe against SQL injection.
//
// Each user is the owner of their own "store". When a user is created we also
// create their default settings row (owner PIN + notification email + theme)
// inside a single transaction so an account is never left half-initialised.
import bcrypt from 'bcryptjs';
import { get, withTransaction } from '../config/database.js';
import config from '../config/env.js';
import { encryptSecret } from '../utils/secretCipher.js';

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
   * Optionally stores a Gmail sender + app password (encrypted) so checkout
   * notifications send from the owner's own Gmail; both must be provided
   * together or neither.
   */
  async create({ email, password, name, role = 'worker', smtpUser, smtpPass }) {
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const defaultPinHash = bcrypt.hashSync(config.defaultOwnerPin, SALT_ROUNDS);

    const hasSmtp = Boolean(smtpUser && smtpPass);
    const smtpPassEnc = hasSmtp ? encryptSecret(String(smtpPass).replace(/\s+/g, '')) : null;

    const userId = await withTransaction(async (tx) => {
      const info = await tx.run(
        `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
        [email, passwordHash, name || null, role]
      );
      const uid = info.lastInsertRowid;

      // Notifications default to the owner's own email until they change it.
      await tx.run(
        `INSERT INTO settings (user_id, owner_pin_hash, notification_email, theme, smtp_user, smtp_pass_enc)
         VALUES (?, ?, ?, 'light', ?, ?)`,
        [uid, defaultPinHash, email, hasSmtp ? smtpUser : null, smtpPassEnc]
      );
      return uid;
    });

    return this.findById(userId);
  },

  /** Compare a plaintext password against the stored hash. */
  verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password_hash);
  },

  /** Strip sensitive fields before sending a user to the client. */
  toPublic(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
  },
};
