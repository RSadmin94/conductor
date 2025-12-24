const { Pool } = require('pg');
require('dotenv').config();

// CRITICAL: DATABASE_URL is REQUIRED - app must crash on startup if missing
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Initialize database connection with DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
  process.exit(1);
});

console.log('✓ PostgreSQL database connection initialized');

async function query(sql, params = []) {
  // All queries go directly to PostgreSQL
  // No in-memory fallback - this ensures data persistence
  return pool.query(sql, params);
}

// Export pool and query function
module.exports = {
  pool,
  query,
};

// Also export as default for backward compatibility
module.exports.default = module.exports;
