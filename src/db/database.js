const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

let dbInstance = null;

/**
 * Get or initialize SQLite database connection
 * @param {string} [customPath] Optional path for testing (e.g., ':memory:')
 * @returns {Database.Database} SQLite database instance
 */
function getDb(customPath) {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath = customPath || config.dbPath;

  // If using a file path, ensure the parent directory exists
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(targetPath);

  // Performance and integrity pragmas
  if (targetPath !== ':memory:') {
    dbInstance.pragma('journal_mode = WAL');
  }
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

/**
 * Close database connection
 */
function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  closeDb,
};
