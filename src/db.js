const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// CRITICAL: Database credentials are REQUIRED - app must crash on startup if missing
const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('FATAL: Missing required database environment variables:', missingVars.join(', '));
  console.error('PostgreSQL persistence is required for production. Exiting.');
  process.exit(1);
}

// Create Pool using individual environment variables
// This is more reliable than DATABASE_URL for Render internal connections
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Use SSL only for external Render connections
  // Internal connections (dpg-*.render.com without region) don't need SSL
  ssl: process.env.DB_HOST.includes('.render.com') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('[pg] pool error', err);
  // Don't exit - let the app continue running
});

// Initialize schema on startup (non-blocking)
async function initializeSchema() {
  try {
    // Read schema.sql from the project root
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema - this creates tables if they don't exist
    await pool.query(schema);
    console.log('✓ Database schema initialized');
  } catch (err) {
    console.error('Warning: Could not initialize schema:', err.message);
    // Don't exit - schema might already exist or will be created on first use
  }
}

// Test connection (non-blocking)
async function testConnection() {
  try {
    const r = await pool.query('SELECT 1 as ok');
    console.log('✓ PostgreSQL database connection successful');
    console.log('[pg] connectivity ok:', r.rows[0]);
    
    // Initialize schema after successful connection
    await initializeSchema();
  } catch (err) {
    console.error('Warning: PostgreSQL connection test failed:', err.message);
    console.error('The app will continue running but database operations may fail.');
    console.error('This is likely a temporary issue. Retrying in 5 seconds...');
    
    // Retry after 5 seconds
    setTimeout(() => {
      testConnection().catch(err => {
        console.error('Retry failed:', err.message);
      });
    }, 5000);
  }
}

// Run connection test asynchronously (don't block app startup)
testConnection().catch(err => {
  console.error('Connection test error:', err);
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
