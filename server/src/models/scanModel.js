// Data access for the scan/checkout ledger and sales reporting.
// All queries are scoped to a single store (user_id). Async (libSQL).
import { get, all, run } from '../config/database.js';

export const ScanModel = {
  /**
   * Record an immutable scan/checkout entry for a store. `unitPrice` overrides
   * the item's stored selling price (worker price adjustment); `unitCost`
   * snapshots the item's cost at sale time so historical profit stays accurate
   * even if the item's cost is edited later.
   */
  async create({ userId, item, workerEmail, action = 'checkout', quantity = 1, unitPrice, unitCost }) {
    const info = await run(
      `INSERT INTO scans (user_id, item_id, worker_email, barcode, item_name, unit_price, unit_cost, quantity, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, item.id, workerEmail || null, item.barcode, item.name,
       unitPrice ?? item.price, unitCost ?? item.cost_price ?? 0, quantity, action]
    );
    return get('SELECT * FROM scans WHERE id = ?', [info.lastInsertRowid]);
  },

  /** Sum revenue / cost / profit / units over a set of checkout rows. */
  _totals(rows) {
    return rows.reduce(
      (acc, r) => {
        const revenue = r.unit_price * r.quantity;
        const cost = (r.unit_cost || 0) * r.quantity;
        acc.count += 1;
        acc.units += r.quantity;
        acc.revenue += revenue;
        acc.cost += cost;
        acc.profit += revenue - cost;
        return acc;
      },
      { count: 0, units: 0, revenue: 0, cost: 0, profit: 0 }
    );
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
    return { rows, ...this._totals(rows) };
  },

  /**
   * Every checkout for this store, optionally filtered to an inclusive date
   * range (from / to are YYYY-MM-DD). Returns the rows plus revenue / cost /
   * profit / unit totals.
   */
  async salesHistory(userId, { from, to } = {}) {
    const where = ["user_id = ?", "action = 'checkout'"];
    const args = [userId];
    if (from) { where.push('date(created_at) >= date(?)'); args.push(from); }
    if (to) { where.push('date(created_at) <= date(?)'); args.push(to); }
    const rows = await all(
      `SELECT * FROM scans WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      args
    );
    return { rows, ...this._totals(rows) };
  },

  /** Most recent activity for this store, for an activity feed. */
  recent(userId, limit = 20) {
    return all(
      `SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
  },
};
