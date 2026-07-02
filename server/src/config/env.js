// Centralised, validated environment configuration.
// Importing this module guarantees the rest of the app reads a single,
// consistent source of truth for configuration values.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Server root is two levels up from /src/config
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

/** Read a required variable, falling back to a default in non-production. */
function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production' && fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '4000', 10),

  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwtSecret: required('JWT_SECRET', 'dev_insecure_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  defaultOwnerPin: process.env.DEFAULT_OWNER_PIN || '123456',

  // Password for the app-wide Super Admin panel (/admin), separate from any
  // one store's Owner PIN. Override with ADMIN_PASSWORD in production.
  adminPassword: process.env.ADMIN_PASSWORD || '0703',

  // Local file path used when no remote (Turso) database is configured.
  databasePath: path.isAbsolute(process.env.DATABASE_PATH || '')
    ? process.env.DATABASE_PATH
    : path.resolve(SERVER_ROOT, process.env.DATABASE_PATH || './data/inventory.sqlite'),

  // Database connection (Turso / libSQL).
  // - In production, set TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN.
  // - Locally, leaving them blank falls back to an on-disk SQLite file so the
  //   app runs with zero external setup.
  databaseUrl:
    process.env.TURSO_DATABASE_URL ||
    `file:${
      path.isAbsolute(process.env.DATABASE_PATH || '')
        ? process.env.DATABASE_PATH
        : path.resolve(SERVER_ROOT, process.env.DATABASE_PATH || './data/inventory.sqlite')
    }`,
  databaseAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Inventory Tracker <no-reply@example.com>',
  },
};

// Warn loudly if the JWT secret is left at its insecure default in production.
if (config.isProduction && config.jwtSecret === 'dev_insecure_secret_change_me') {
  throw new Error('JWT_SECRET must be set to a strong secret in production.');
}

// The admin password has a well-known default; that's fine for local/dev use
// but worth flagging loudly if it slips into production unchanged.
if (config.isProduction && config.adminPassword === '0703') {
  console.warn(
    '[config] WARNING: ADMIN_PASSWORD is unset and using the default value. ' +
      'Set ADMIN_PASSWORD to a strong secret before exposing this app publicly.'
  );
}

// In production we must use a durable, hosted database — never a local file,
// which would be wiped on every restart/redeploy of an ephemeral host.
if (config.isProduction && !process.env.TURSO_DATABASE_URL) {
  throw new Error(
    'TURSO_DATABASE_URL must be set in production so data persists. ' +
      'Create a free database at https://turso.tech and set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.'
  );
}

export default config;
