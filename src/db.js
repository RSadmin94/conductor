const { Pool } = require('pg');
require('dotenv').config();

// CRITICAL: Database configuration is REQUIRED - app must crash on startup if missing
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`  - ${v}`));
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Create connection config from individual environment variables
const connectionConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
};

// Initialize database connection
const pool = new Pool(connectionConfig);

pool.on('error', (err) => {
  console.error('Database connection error:', err);
  process.exit(1);
});

console.log('✓ PostgreSQL database connection initialized');
console.log(`  Host: ${connectionConfig.host}`);
console.log(`  Database: ${connectionConfig.database}`);
console.log(`  User: ${connectionConfig.user}`);

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
