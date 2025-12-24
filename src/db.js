import pg from "pg";
const { Pool } = pg;

const raw = process.env.DATABASE_URL;
console.log("[DB] DATABASE_URL present?", !!raw);

if (!raw) throw new Error("DATABASE_URL missing");

export const pool = new Pool({
  connectionString: raw.trim(),
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

await pool.query("SELECT 1");
console.log("✓ Postgres OK");
