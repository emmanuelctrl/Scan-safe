// Data access for the Super Admin panel — read-only, cross-account views.
// Every query is explicit about the columns it selects (never `SELECT *` on
// `users`) so password hashes are never pulled into an admin response.
import { all, get } from '../config/database.js';

export const AdminModel = {
  /** Every store with a quick snapshot of inventory + today's sales. */
  listStores() {
    return all(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.created_at,
        COALESCE(i.item_count, 0)       AS itemCount,
        COALESCE(i.total_units, 0)      AS totalUnits,
        COALESCE(i.inventory_value, 0)  AS inventoryValue,
        COALESCE(s.sales_count, 0)      AS salesTodayCount,
        COALESCE(s.sales_revenue, 0)    AS salesTodayRevenue
      FROM users u
      LEFT JOIN (
        SELECT user_id,
               COUNT(*)             AS item_count,
               SUM(quantity)        AS total_units,
               SUM(quantity * price) AS inventory_value
        FROM items
        GROUP BY user_id
      ) i ON i.user_id = u.id
      LEFT JOIN (
        SELECT user_id,
               COUNT(*)                    AS sales_count,
               SUM(quantity * unit_price)   AS sales_revenue
        FROM scans
        WHERE action = 'checkout' AND date(created_at) = date('now')
        GROUP BY user_id
      ) s ON s.user_id = u.id
      ORDER BY u.created_at DESC
    `);
  },

  /** App-wide totals for the admin dashboard header. */
  async overview() {
    return get(`
      SELECT
        (SELECT COUNT(*) FROM users) AS storeCount,
        (SELECT COUNT(*) FROM items) AS itemCount,
        (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM scans
           WHERE action = 'checkout' AND date(created_at) = date('now')) AS salesTodayRevenue
    `);
  },
};
