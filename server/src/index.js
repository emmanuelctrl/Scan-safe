// Server entry point.
import config from './config/env.js';
import { initDatabase } from './config/database.js';
import app from './app.js';

let server;

async function start() {
  // Ensure the database schema exists before accepting requests.
  await initDatabase();

  server = app.listen(config.port, () => {
    console.log(`\n🛍️  Inventory Tracker API running in ${config.nodeEnv} mode`);
    console.log(`    Listening on http://localhost:${config.port}`);
    console.log(`    Allowed client origins: ${config.clientOrigins.join(', ')}\n`);
  });
}

start().catch((err) => {
  console.error('[startup] Failed to start server:', err);
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (!server) process.exit(0);
  server.close(() => {
    console.log('HTTP server closed. Bye 👋');
    process.exit(0);
  });
  // Force-exit if it hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety nets so a single bad promise doesn't take the app down
// silently.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
