const { Pool } = require('pg');
require('dotenv').config();

// CRITICAL: DATABASE_URL is REQUIRED - app must crash on startup if missing
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Parse DATABASE_URL using regex with non-greedy matching
// Format: postgresql://user:password@host:port/database
const parseConnectionUrl = (url) => {
  try {
    // Match: postgresql://username:password@host:port/database
    // Use non-greedy match for password to stop at the last @ before :port/
    const match = url.match(/^postgresql:\/\/([^:]+):(.+?)@([^:]+):(\d+)\/(.+)$/);
    
    if (!match) {
      throw new Error('URL does not match expected format');
    }
    
    const [, user, password, host, port, database] = match;
    
    return {
      host: host.trim(),
      port: parseInt(port),
      database: database.trim(),
      user: user.trim(),
      password: password.trim(),
    };
  } catch (err) {
    console.error('Failed to parse DATABASE_URL:', err.message);
    console.error('Expected format: postgresql://user:password@host:port/database');
    console.error('Received:', process.env.DATABASE_URL.substring(0, 80) + '...');
    process.exit(1);
  }
};

const connectionConfig = parseConnectionUrl(process.env.DATABASE_URL);

// Initialize database connection with parsed parameters
const pool = new Pool({
  ...connectionConfig,
  ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
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
