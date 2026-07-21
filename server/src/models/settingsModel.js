// Data access for per-account store settings (owner PIN, notification email,
// theme). The PIN is stored only as a bcrypt hash. Every method is scoped by
// userId so accounts can only ever read/modify their own settings. Async.
import bcrypt from 'bcryptjs';
import { get, run } from '../config/database.js';
import { encryptSecret, decryptSecret } from '../utils/secretCipher.js';

const SALT_ROUNDS = 10;

export const SettingsModel = {
  get(userId) {
    return get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  },

  /**
   * Public view: never expose the PIN hash or the encrypted app password.
   * The client only learns *whether* Gmail notifications are configured and
   * which sender address is in use.
   */
  toPublic(settings) {
    if (!settings) return null;
    const { owner_pin_hash, smtp_pass_enc, smtp_user, ...safe } = settings;
    return {
      ...safe,
      smtp_user: smtp_user || null,
      smtp_configured: Boolean(smtp_user && smtp_pass_enc),
    };
  },

  /**
   * Store (or replace) the Gmail sender + app password used to send this
   * account's checkout notifications. The password is encrypted at rest.
   */
  async setSmtpCredentials(userId, smtpUser, appPassword) {
    // Gmail app passwords are shown with spaces ("abcd efgh ijkl mnop"); the
    // SMTP server wants them with the spaces stripped.
    const cleaned = String(appPassword).replace(/\s+/g, '');
    await run(
      `UPDATE settings SET smtp_user = ?, smtp_pass_enc = ?, updated_at = datetime('now')
       WHERE user_id = ?`,
      [smtpUser, encryptSecret(cleaned), userId]
    );
    return this.get(userId);
  },

  /** Remove any stored Gmail credentials (turns off per-account notifications). */
  async clearSmtpCredentials(userId) {
    await run(
      `UPDATE settings SET smtp_user = NULL, smtp_pass_enc = NULL, updated_at = datetime('now')
       WHERE user_id = ?`,
      [userId]
    );
    return this.get(userId);
  },

  /**
   * Decrypt this account's Gmail credentials for sending, or null if none are
   * configured. Server-side only — never send the result to the client.
   */
  async getSmtpCredentials(userId) {
    const s = await this.get(userId);
    if (!s?.smtp_user || !s?.smtp_pass_enc) return null;
    const pass = decryptSecret(s.smtp_pass_enc);
    if (!pass) return null;
    return { user: s.smtp_user, pass };
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
