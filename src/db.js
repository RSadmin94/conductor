const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Railway
  },
  keepAlive: true,
});

async function testConnection() {
  let retries = 5;
  while (retries) {
    try {
      await pool.query("SELECT 1 as ok");
      console.log("✓ PostgreSQL database connection initialized");
      return;
    } catch (err) {
      console.error("PostgreSQL connection failed, retrying...", err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  console.error("FATAL: Cannot connect to PostgreSQL after multiple retries.");
  process.exit(1);
}

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'Idea',
        stage TEXT NOT NULL DEFAULT 'Idea',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        content TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS runs (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Database schema initialized");
  } catch (err) {
    console.error("Error initializing schema:", err);
  } finally {
    client.release();
  }
}

(async () => {
  await testConnection();
  await initSchema();
})();

module.exports = pool;
