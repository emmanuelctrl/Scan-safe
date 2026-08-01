// Data access for users. All queries use bound parameters (no string
// concatenation) so they are safe against SQL injection.
//
// Each user is the owner of their own "store". When a user is created we also
// create their default settings row (owner PIN + notification email + theme)
// inside a single transaction so an account is never left half-initialised.
import bcrypt from 'bcryptjs';
import { get, all, run, withTransaction } from '../config/database.js';
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

  /** Create a new user (store) and seed their default settings atomically. */
  async create({ email, password, name, role = 'worker' }) {
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const defaultPinHash = bcrypt.hashSync(config.defaultOwnerPin, SALT_ROUNDS);

    const userId = await withTransaction(async (tx) => {
      const info = await tx.run(
        `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
        [email, passwordHash, name || null, role]
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

  /** Update a user's sale-notification preference (mode + threshold). */
  setSaleNotifications(userId, mode, threshold = 0) {
    return run(
      `UPDATE users SET sale_notifications = ?, sale_notification_threshold = ? WHERE id = ?`,
      [mode, Number(threshold) || 0, userId]
    );
  },

  /** Linked owners in 'daily' mode, for the daily digest job. */
  findDailyDigestOwners() {
    return all(
      `SELECT id, telegram_chat_id FROM users
       WHERE sale_notifications = 'daily' AND telegram_chat_id IS NOT NULL`
    );
  },

  /**
   * Link a user's account to their Telegram chat for sale notifications.
   *
   * The link is locked to the FIRST chat that binds to the account (the owner /
   * account creator): once set, a different Telegram user opening the Mini App
   * under the same login can NOT take over the notifications. Re-linking the
   * same chat is allowed (it just refreshes the timestamp). The owner can reset
   * the binding from Settings (unlinkTelegram) to move it to a new device.
   *
   * @returns {Promise<boolean>} true if this chat is now linked; false if the
   *   account is already locked to a different chat.
   */
  async linkTelegram(userId, chatId) {
    const result = await run(
      `UPDATE users SET telegram_chat_id = ?, telegram_linked_at = datetime('now')
       WHERE id = ? AND (telegram_chat_id IS NULL OR telegram_chat_id = ?)`,
      [chatId, userId, chatId]
    );
    return result.rowsAffected > 0;
  },

  /** Clear an account's Telegram link so a new chat may be bound (owner reset). */
  unlinkTelegram(userId) {
    return run('UPDATE users SET telegram_chat_id = NULL WHERE id = ?', [userId]);
  },

  /**
   * Unlink whichever account is bound to a Telegram chat id. Called when
   * Telegram reports the user blocked the bot (HTTP 403).
   */
  unlinkTelegramByChatId(chatId) {
    return run('UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = ?', [chatId]);
  },

  /**
   * Owners of a store who have linked Telegram, for sale-notification fan-out.
   * A store is identified by its user id — each account owns exactly one store —
   * so scoping by that id makes it impossible to notify another store's owner.
   */
  findTelegramOwnersForStore(storeUserId) {
    return all(
      `SELECT id, telegram_chat_id, sale_notifications, sale_notification_threshold
       FROM users
       WHERE id = ? AND telegram_chat_id IS NOT NULL`,
      [storeUserId]
    );
  },

  /** Strip sensitive fields before sending a user to the client. */
  toPublic(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
  },
};
