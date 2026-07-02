// Database connection and schema bootstrap (Turso / libSQL).
//
// We use @libsql/client, which speaks SQLite. In production it connects to a
// hosted Turso database (durable, survives restarts/redeploys); locally it
// falls back to an on-disk SQLite file so the app runs with zero setup.
//
// All queries use bound parameters (`?` placeholders), which prevents SQL
// injection by construction. The client API is asynchronous, so every data
// access helper below returns a Promise.
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import config from './env.js';

// When using a local file URL, make sure its directory exists.
if (config.databaseUrl.startsWith('file:')) {
  const filePath = config.databaseUrl.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({
  url: config.databaseUrl,
  authToken: config.databaseAuthToken,
});

/**
 * Wrap a client (or a transaction) with convenient get/all/run helpers so the
 * model layer reads cleanly and works identically inside or outside a
 * transaction.
 */
function wrap(executor) {
  return {
    /** Return the first row, or null. */
    async get(sql, args = []) {
      const result = await executor.execute({ sql, args });
      return result.rows[0] ?? null;
    },
    /** Return all rows. */
    async all(sql, args = []) {
      const result = await executor.execute({ sql, args });
      return result.rows;
    },
    /** Execute a write; normalise the BigInt insert id to a Number. */
    async run(sql, args = []) {
      const result = await executor.execute({ sql, args });
      return {
        lastInsertRowid:
          result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
        rowsAffected: Number(result.rowsAffected || 0),
      };
    },
  };
}

const base = wrap(client);
export const get = (sql, args) => base.get(sql, args);
export const all = (sql, args) => base.all(sql, args);
export const run = (sql, args) => base.run(sql, args);

/**
 * Run a function inside a write transaction. The callback receives the same
 * get/all/run helpers, bound to the transaction, and the transaction is
 * committed if it resolves or rolled back if it throws.
 */
export async function withTransaction(fn) {
  const tx = await client.transaction('write');
  try {
    const result = await fn(wrap(tx));
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  }
}

// Schema — identical to standard SQLite (libSQL is SQLite-compatible).
const SCHEMA_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name          TEXT,
    role          TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('worker','owner')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    owner_pin_hash     TEXT NOT NULL,
    notification_email TEXT NOT NULL,
    theme              TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    barcode        TEXT NOT NULL,
    name           TEXT NOT NULL,
    price          REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
    quantity       INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_at   INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_at >= 0),
    sku            TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, barcode)
  );

  CREATE INDEX IF NOT EXISTS idx_items_user ON items (user_id);
  CREATE INDEX IF NOT EXISTS idx_items_user_barcode ON items (user_id, barcode);

  CREATE TABLE IF NOT EXISTS scans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id      INTEGER REFERENCES items(id) ON DELETE SET NULL,
    worker_email TEXT,
    barcode      TEXT NOT NULL,
    item_name    TEXT NOT NULL,
    unit_price   REAL NOT NULL DEFAULT 0,
    quantity     INTEGER NOT NULL DEFAULT 1,
    action       TEXT NOT NULL DEFAULT 'checkout' CHECK (action IN ('scan','checkout')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans (user_id, created_at);

  CREATE TABLE IF NOT EXISTS stock_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id         INTEGER REFERENCES items(id) ON DELETE SET NULL,
    barcode         TEXT NOT NULL,
    item_name       TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_stock_movements_user_created ON stock_movements (user_id, created_at);
`;

/**
 * Create tables/indexes if they don't exist. Call once on startup, before the
 * server begins accepting requests.
 */
export async function initDatabase() {
  await client.executeMultiple(SCHEMA_SQL);
}

export { client };
