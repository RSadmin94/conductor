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

  // SELECT id, state FROM projects WHERE id = $1
  if (/^SELECT\s+ID,\s*STATE\s+FROM\s+PROJECTS\s+WHERE\s+ID\s*=\s*\$1/.test(s)) {
    const [id] = params;
    const project = memory.projects.get(id);
    if (!project) return result([]);
    return result([{ id: project.id, state: project.state }]);
  }

  // SELECT id, state, stage FROM projects WHERE id = $1
  if (/^SELECT\s+ID,\s*STATE,\s*STAGE\s+FROM\s+PROJECTS\s+WHERE\s+ID\s*=\s*\$1/.test(s)) {
    const [id] = params;
    const project = memory.projects.get(id);
    if (!project) return result([]);
    return result([{ id: project.id, state: project.state, stage: project.stage }]);
  }

  // SELECT id, state, stage, created_at, updated_at FROM projects WHERE id = $1
  if (/^SELECT\s+ID,\s*STATE,\s*STAGE,\s*CREATED_AT,\s*UPDATED_AT\s+FROM\s+PROJECTS\s+WHERE\s+ID\s*=\s*\$1/.test(s)) {
    const [id] = params;
    const project = memory.projects.get(id);
    if (!project) return result([]);
    return result([{
      id: project.id,
      state: project.state,
      stage: project.stage,
      created_at: project.created_at,
      updated_at: project.updated_at || project.created_at
    }]);
  }

  // SELECT * FROM projects WHERE id = $1
  if (/^SELECT\s+\*\s+FROM\s+PROJECTS\s+WHERE\s+ID\s*=\s*\$1/.test(s)) {
    const [id] = params;
    const project = memory.projects.get(id);
    if (!project) return result([]);
    return result([project]);
  }

  // UPDATE projects SET stage = $1, state = $2, updated_at = NOW() WHERE id = $3
  if (/^UPDATE\s+PROJECTS\s+SET\s+STAGE\s*=\s*\$1,\s*STATE\s*=\s*\$2,\s*UPDATED_AT\s*=\s*NOW\(\)\s+WHERE\s+ID\s*=\s*\$3/.test(s)) {
    const [stage, state, id] = params;
    const project = memory.projects.get(id);
    if (!project) return result([], 0);
    project.stage = stage;
    project.state = state;
    project.updated_at = new Date().toISOString();
    memory.projects.set(id, project);
    return result([], 1);
  }

  // SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1
  if (/^SELECT\s+CONTENT\s+FROM\s+IDEAS\s+WHERE\s+PROJECT_ID\s*=\s*\$1\s+ORDER\s+BY\s+CREATED_AT\s+DESC\s+LIMIT\s+1/.test(s)) {
    const [projectId] = params;
    let latestIdea = null;
    for (const idea of memory.ideas.values()) {
      if (idea.project_id === projectId) {
        if (!latestIdea || new Date(idea.created_at) > new Date(latestIdea.created_at)) {
          latestIdea = idea;
        }
      }
    }
    if (!latestIdea) return result([]);
    return result([{ content: latestIdea.content }]);
  }

  // INSERT INTO decisions (id, project_id, stage, outcome, rationale) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (project_id, stage) DO NOTHING
  if (/^INSERT INTO DECISIONS\s*\(ID,\s*PROJECT_ID,\s*STAGE,\s*OUTCOME,\s*RATIONALE\)\s*VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5\)\s+ON\s+CONFLICT\s*\(PROJECT_ID,\s*STAGE\)\s+DO\s+NOTHING/.test(s)) {
    // For MVP, we don't need to store decisions in memory
    // Just return success (1 row affected, even if it was a no-op due to conflict)
    return result([], 1);
  }

  // INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING
  if (/^INSERT INTO ARTIFACTS\s*\(ID,\s*PROJECT_ID,\s*STAGE,\s*TYPE,\s*NAME,\s*CONTENT\)\s*VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6\)\s+ON\s+CONFLICT\s*\(PROJECT_ID,\s*STAGE,\s*TYPE\)\s+DO\s+NOTHING/.test(s)) {
    // For MVP, we don't need to store artifacts in memory
    // Just return success
    return result([], 1);
  }

  // SELECT outcome, rationale, created_at FROM decisions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1
  if (/^SELECT\s+OUTCOME,\s*RATIONALE,\s*CREATED_AT\s+FROM\s+DECISIONS\s+WHERE\s+PROJECT_ID\s*=\s*\$1\s+ORDER\s+BY\s+CREATED_AT\s+DESC\s+LIMIT\s+1/.test(s)) {
    // For MVP, we don't store decisions in memory, so return empty
    // This is fine because the GET endpoint handles empty results gracefully
    return result([]);
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
