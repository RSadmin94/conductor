const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// CRITICAL: DATABASE_URL is REQUIRED - app must crash on startup if missing
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is missing');
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Create Pool using DATABASE_URL with proper SSL configuration for Render PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render SSL handshake compatibility
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('[pg] pool error', err);
  process.exit(1);
});

// Initialize schema on startup
async function initializeSchema() {
  try {
    // Read schema.sql from the project root
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema - this creates tables if they don't exist
    await pool.query(schema);
    console.log('✓ Database schema initialized');
  } catch (err) {
    console.error('Error initializing schema:', err.message);
    // Don't exit - schema might already exist
  }
}

// Test connection and initialize schema
async function testConnection() {
  try {
    const r = await pool.query('SELECT 1 as ok');
    console.log('✓ Using PostgreSQL database via DATABASE_URL (SSL enabled)');
    console.log('[pg] connectivity ok:', r.rows[0]);
    
    // Initialize schema
    await initializeSchema();
  } catch (err) {
    console.error('FATAL: Cannot connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

// Run connection test immediately
testConnection().catch(err => {
  console.error('FATAL: Database initialization failed:', err);
  process.exit(1);
});

async function query(sql, params = []) {
  // All queries go directly to PostgreSQL
  // No in-memory fallback - this ensures data persistence
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.error('Database query error:', {
      sql: sql.substring(0, 100),
      error: err.message,
      code: err.code,
    });
    throw err;
  }
}

// Export pool and query function
module.exports = {
  pool,
  query,
};

// Also export as default for backward compatibility
module.exports.default = module.exports;
