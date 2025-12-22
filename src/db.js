const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// In-memory storage for development/testing
const memory = {
  projects: new Map(), // id -> { id, state, stage, created_at }
  ideas: new Map(),    // id -> { id, project_id, content, created_at }
};

// Initialize database connection if DATABASE_URL is provided
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  pool.on('error', (err) => {
    console.error('Database connection error:', err);
  });
  
  console.log('Using PostgreSQL database');
} else {
  console.warn('WARNING: DATABASE_URL not set, using in-memory storage for development');
}

function normalizeSql(sql) {
  return String(sql)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function result(rows = [], rowCount = rows.length) {
  return { rows, rowCount };
}

async function query(sql, params = []) {
  // If using real database, delegate to pool
  if (pool) {
    return pool.query(sql, params);
  }

  // In-memory query handler
  const s = normalizeSql(sql);

  // INSERT INTO projects (id, state, stage) VALUES ($1, $2, $3)
  if (/^INSERT INTO PROJECTS\s*\(ID,\s*STATE,\s*STAGE\)\s*VALUES\s*\(\$1,\s*\$2,\s*\$3\)/.test(s)) {
    const [id, state, stage] = params;

    if (!id) throw new Error("projects.id is required");
    // Optional: enforce unique
    if (memory.projects.has(id)) {
      // mimic PG unique violation-ish behavior
      const err = new Error("duplicate key value violates unique constraint \"projects_pkey\"");
      err.code = "23505";
      throw err;
    }

    const row = { id, state, stage, created_at: new Date().toISOString() };
    memory.projects.set(id, row);

    // If caller expects RETURNING *, support it:
    if (/\sRETURNING\s+\*/.test(s)) return result([row], 1);
    return result([], 1);
  }

  // INSERT INTO ideas (id, project_id, content) VALUES ($1, $2, $3)
  if (/^INSERT INTO IDEAS\s*\(ID,\s*PROJECT_ID,\s*CONTENT\)\s*VALUES\s*\(\$1,\s*\$2,\s*\$3\)/.test(s)) {
    const [id, projectId, content] = params;

    if (!id) throw new Error("ideas.id is required");
    if (!projectId) throw new Error("ideas.project_id is required");
    if (!memory.projects.has(projectId)) {
      const err = new Error("insert or update on table \"ideas\" violates foreign key constraint");
      err.code = "23503";
      throw err;
    }

    if (memory.ideas.has(id)) {
      const err = new Error("duplicate key value violates unique constraint \"ideas_pkey\"");
      err.code = "23505";
      throw err;
    }

    const row = { id, project_id: projectId, content, created_at: new Date().toISOString() };
    memory.ideas.set(id, row);

    if (/\sRETURNING\s+\*/.test(s)) return result([row], 1);
    return result([], 1);
  }

  // SELECT helpers (optional but useful)
  if (/^SELECT\s+\*\s+FROM\s+PROJECTS\b/.test(s)) {
    return result([...memory.projects.values()]);
  }

  if (/^SELECT\s+\*\s+FROM\s+IDEAS\b/.test(s)) {
    return result([...memory.ideas.values()]);
  }

  // Fail loud instead of silently returning empty rows (this prevents "mystery 500s")
  const err = new Error(`Unsupported SQL in in-memory db.query(): ${sql}`);
  err.code = "INMEM_UNSUPPORTED_SQL";
  throw err;
}

// Export both pool and query function
module.exports = {
  pool,
  query,
  memory,
};

// Also export as default for backward compatibility
module.exports.default = module.exports;
