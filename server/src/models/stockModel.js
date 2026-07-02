// Data access for stock adjustments (restocks/corrections) and the
// resulting movement ledger, scoped by `userId` like every other model.
import { all, withTransaction } from '../config/database.js';

export const StockModel = {
  /**
   * Adjust an item's quantity by `change` (positive = stock added, negative =
   * a correction/removal), clamped at 0, and log the movement. Returns the
   * updated item, or null if it doesn't exist / belong to this account.
   */
  adjustStock(userId, itemId, change) {
    return withTransaction(async (tx) => {
      const item = await tx.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);
      if (!item) return null;

      const newQty = Math.max(0, item.quantity + change);
      const actualChange = newQty - item.quantity;

      await tx.run(
        `UPDATE items SET quantity = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        [newQty, itemId, userId]
      );

      if (actualChange !== 0) {
        await tx.run(
          `INSERT INTO stock_movements (user_id, item_id, barcode, item_name, quantity_change)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, item.id, item.barcode, item.name, actualChange]
        );
      }

      return tx.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);
    });
  },

  /** Stock added today (positive movements only), for the owner dashboard. */
  async stockInToday(userId) {
    const rows = await all(
      `SELECT * FROM stock_movements
       WHERE user_id = ? AND quantity_change > 0 AND date(created_at) = date('now')
       ORDER BY created_at DESC`,
      [userId]
    );

    const totals = rows.reduce(
      (acc, r) => {
        acc.count += 1;
        acc.units += r.quantity_change;
        return acc;
      },
      { count: 0, units: 0 }
    );

    return { rows, ...totals };
  },
};
