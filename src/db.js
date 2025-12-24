import pg from "pg";
const { Pool } = pg;

const dbUrl = (process.env.DATABASE_URL || "").trim();
if (!dbUrl) throw new Error("DATABASE_URL missing");

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: true, // Railway/Supabase usually OK
  keepAlive: true,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

await pool.query("SELECT 1");
console.log("✓ Postgres OK");
