// Data access for inventory items.
//
// Every method is scoped by `userId` (the store/account) so one account can
// never see or modify another account's inventory — the core of the
// multi-tenant isolation. All calls are asynchronous (libSQL).
import { get, all, run, withTransaction } from '../config/database.js';

// Normalise possibly-undefined values to null so the driver accepts them.
const n = (v) => (v === undefined ? null : v);

export const ItemModel = {
  findAll(userId) {
    return all(
      'SELECT * FROM items WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC',
      [userId]
    );
  },

  findById(userId, id) {
    return get('SELECT * FROM items WHERE id = ? AND user_id = ?', [id, userId]);
  },

  findByBarcode(userId, barcode) {
    return get('SELECT * FROM items WHERE barcode = ? AND user_id = ?', [barcode, userId]);
  },

  async create(userId, { barcode, name, price, quantity, low_stock_at, sku }) {
    const info = await run(
      `INSERT INTO items (user_id, barcode, name, price, quantity, low_stock_at, sku)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, barcode, name, price, quantity, low_stock_at ?? 5, sku || null]
    );
    return this.findById(userId, info.lastInsertRowid);
  },

  /** Update only the provided fields; leaves others untouched. */
  async update(userId, id, fields) {
    const allowed = ['barcode', 'name', 'price', 'quantity', 'low_stock_at', 'sku'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (keys.length === 0) return this.findById(userId, id);

    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const args = keys.map((k) => n(fields[k]));
    args.push(id, userId);

    await run(
      `UPDATE items SET ${setClause}, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      args
    );
    return this.findById(userId, id);
  },

  remove(userId, id) {
    return run('DELETE FROM items WHERE id = ? AND user_id = ?', [id, userId]);
  },

  /** Atomically decrement stock for a checkout. Returns the updated row or null. */
  decrementStock(userId, id, by = 1) {
    return withTransaction(async (tx) => {
      const item = await tx.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [id, userId]);
      if (!item) return null;
      const newQty = Math.max(0, item.quantity - by);
      await tx.run(
        `UPDATE items SET quantity = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        [newQty, id, userId]
      );
      return tx.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [id, userId]);
    });
  },

  /**
   * Bulk import items from a parsed spreadsheet, all within one transaction.
   * Rows are matched on barcode: existing items are updated, new ones inserted.
   * When `replace` is true, the account's existing inventory is cleared first
   * so the spreadsheet becomes the single source of truth.
   *
   * @returns {Promise<{ inserted: number, updated: number, total: number }>}
   */
  bulkUpsert(userId, rows, { replace = false } = {}) {
    return withTransaction(async (tx) => {
      if (replace) {
        await tx.run('DELETE FROM items WHERE user_id = ?', [userId]);
      }

      let inserted = 0;
      let updated = 0;

      for (const r of rows) {
        // Check within the transaction so duplicates inside one file are handled.
        const existing = await tx.get(
          'SELECT id FROM items WHERE user_id = ? AND barcode = ?',
          [userId, r.barcode]
        );
        if (existing) {
          await tx.run(
            `UPDATE items SET name = ?, price = ?, quantity = ?, low_stock_at = ?, sku = ?,
                              updated_at = datetime('now')
             WHERE id = ? AND user_id = ?`,
            [r.name, r.price, r.quantity, r.low_stock_at ?? 5, r.sku || null, existing.id, userId]
          );
          updated += 1;
        } else {
          await tx.run(
            `INSERT INTO items (user_id, barcode, name, price, quantity, low_stock_at, sku)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, r.barcode, r.name, r.price, r.quantity, r.low_stock_at ?? 5, r.sku || null]
          );
          inserted += 1;
        }
      }
      return { inserted, updated, total: rows.length };
    });
  },

  /** Inventory health stats for this account's owner dashboard. */
  async stats(userId) {
    const totals = await get(
      `SELECT
         COUNT(*)                           AS totalItems,
         COALESCE(SUM(quantity), 0)         AS totalUnits,
         COALESCE(SUM(quantity * price), 0) AS inventoryValue
       FROM items WHERE user_id = ?`,
      [userId]
    );

    const outOfStock = await all(
      'SELECT * FROM items WHERE user_id = ? AND quantity = 0 ORDER BY name COLLATE NOCASE',
      [userId]
    );

    const lowStock = await all(
      `SELECT * FROM items
       WHERE user_id = ? AND quantity > 0 AND quantity <= low_stock_at
       ORDER BY quantity ASC`,
      [userId]
    );

    return { ...totals, outOfStock, lowStock };
  },
};
