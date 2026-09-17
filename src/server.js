const app = require('./app');
const config = require('./config/env');
const { getDb, closeDb } = require('./db/database');
const { runMigrations } = require('./db/migrations');

// Initialize database schema
try {
  const db = getDb();
  runMigrations(db);
  console.log('[Database] SQLite connected and schema migrations verified.');
} catch (err) {
  console.error('[Database Error] Failed to initialize database:', err.message);
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log('\n======================================================');
  console.log(`🚀 Voice AI Patient Registration Server Running`);
  console.log(`📡 Local Server URL   : http://localhost:${config.port}`);
  console.log(`📊 Admin Dashboard    : http://localhost:${config.port}/`);
  console.log(`🩺 Patients API       : http://localhost:${config.port}/patients`);
  console.log(`🎙️  Vapi Webhook       : http://localhost:${config.port}/api/voice/webhook`);
  console.log(`📜 Voice Logs         : http://localhost:${config.port}/api/voice/logs`);
  console.log(`⚙️  Environment        : ${config.nodeEnv}`);
  console.log(`📁 Database Path      : ${config.dbPath}`);
  console.log('======================================================\n');
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    closeDb();
    console.log('[Database] SQLite connection closed cleanly.');
    process.exit(0);
  });

  // Force shutdown after 10s if hanging
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
