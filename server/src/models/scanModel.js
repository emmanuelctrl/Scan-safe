// Data access for the scan/checkout ledger and sales reporting.
// All queries are scoped to a single store (user_id). Async (libSQL).
import { get, all, run } from '../config/database.js';

export const ScanModel = {
  /** Record an immutable scan/checkout entry for a store. */
  async create({ userId, item, workerEmail, action = 'checkout', quantity = 1 }) {
    const info = await run(
      `INSERT INTO scans (user_id, item_id, worker_email, barcode, item_name, unit_price, quantity, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, item.id, workerEmail || null, item.barcode, item.name, item.price, quantity, action]
    );
    return get('SELECT * FROM scans WHERE id = ?', [info.lastInsertRowid]);
  },

  /** Sales made today for this store (checkouts only), with totals. */
  async salesToday(userId) {
    const rows = await all(
      `SELECT * FROM scans
       WHERE user_id = ?
         AND action = 'checkout'
         AND date(created_at) = date('now')
       ORDER BY created_at DESC`,
      [userId]
    );

    const totals = rows.reduce(
      (acc, r) => {
        acc.count += 1;
        acc.units += r.quantity;
        acc.revenue += r.unit_price * r.quantity;
        return acc;
      },
      { count: 0, units: 0, revenue: 0 }
    );

    return { rows, ...totals };
  },

  /** Most recent activity for this store, for an activity feed. */
  recent(userId, limit = 20) {
    return all(
      `SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
  },
};
