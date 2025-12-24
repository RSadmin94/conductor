const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
    const result = await pool.query('SELECT NOW()');
    console.log('✓ PostgreSQL database connection initialized');
    console.log(`  Host: ${connectionConfig.host}`);
    console.log(`  Database: ${connectionConfig.database}`);
    console.log(`  User: ${connectionConfig.user}`);
    
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
