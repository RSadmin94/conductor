const { Pool } = require('pg');
require('dotenv').config();

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL not set, using local fallback');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://conductor:conductor_pw@localhost:55432/conductor_db',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;

