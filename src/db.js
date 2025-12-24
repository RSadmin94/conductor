const { Pool } = require('pg');
require('dotenv').config();

// CRITICAL: DATABASE_URL is REQUIRED - app must crash on startup if missing
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Parse DATABASE_URL manually to avoid pg-connection-string parsing issues
// Format: postgresql://user:password@host:port/database
const parseConnectionUrl = (url) => {
  try {
    // Remove the protocol
    const withoutProtocol = url.replace(/^postgresql:\/\//, '');
    
    // Split user:password from host:port/database
    const [credentials, hostAndDb] = withoutProtocol.split('@');
    const [user, password] = credentials.split(':');
    
    // Split host:port from database
    const [hostPort, database] = hostAndDb.split('/');
    const [host, port] = hostPort.split(':');
    
    return {
      host: host || 'localhost',
      port: parseInt(port) || 5432,
      database: database || 'postgres',
      user: user || 'postgres',
      password: password || '',
    };
  } catch (err) {
    console.error('Failed to parse DATABASE_URL:', err.message);
    console.error('Expected format: postgresql://user:password@host:port/database');
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
