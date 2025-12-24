const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function query(sql, params = []) {
  try {
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    return result;
  } catch (err) {
    console.error("Database query error:", err);
    throw err;
  }
}

module.exports = { query };
