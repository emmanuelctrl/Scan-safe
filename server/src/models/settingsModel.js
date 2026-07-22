// Data access for per-account store settings (owner PIN, notification email,
// theme). The PIN is stored only as a bcrypt hash. Every method is scoped by
// userId so accounts can only ever read/modify their own settings. Async.
import bcrypt from 'bcryptjs';
import { get, run } from '../config/database.js';

const SALT_ROUNDS = 10;

export const SettingsModel = {
  get(userId) {
    return get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  },

  /** Public view: never expose the PIN hash. */
  toPublic(settings) {
    if (!settings) return null;
    const { owner_pin_hash, smtp_user, smtp_pass_enc, ...safe } = settings;
    return safe;
  },

  async verifyPin(userId, pin) {
    const s = await this.get(userId);
    if (!s) return false;
    return bcrypt.compareSync(pin, s.owner_pin_hash);
  },

  async setPin(userId, newPin) {
    const hash = bcrypt.hashSync(newPin, SALT_ROUNDS);
    await run(
      `UPDATE settings SET owner_pin_hash = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [hash, userId]
    );
    return this.get(userId);
  },

  async setNotificationEmail(userId, email) {
    await run(
      `UPDATE settings SET notification_email = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [email, userId]
    );
    return this.get(userId);
  },

  async setTheme(userId, theme) {
    await run(
      `UPDATE settings SET theme = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [theme, userId]
    );
    return this.get(userId);
  },
};
