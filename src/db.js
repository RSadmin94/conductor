const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// In-memory storage for development/testing
const memory = {
  projects: new Map(), // id -> { id, state, stage, created_at, updated_at }
  ideas: new Map(),    // id -> { id, project_id, content, created_at }
  artifacts: new Map(), // id -> { id, project_id, type, name, content, uri, created_at }
  decisions: new Map(), // id -> { id, project_id, outcome, rationale, created_at }
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

  // ============================================
  // INSERT OPERATIONS
  // ============================================

  // INSERT INTO projects (id, state, stage) VALUES ($1, $2, $3)
  if (s.startsWith("INSERT INTO PROJECTS") && s.includes("VALUES")) {
    const [id, state, stage] = params;

    if (!id) throw new Error("projects.id is required");
    if (memory.projects.has(id)) {
      const err = new Error("duplicate key value violates unique constraint \"projects_pkey\"");
      err.code = "23505";
      throw err;
    }

    const row = { id, state, stage, created_at: new Date().toISOString() };
    memory.projects.set(id, row);

    if (s.includes("RETURNING")) return result([row], 1);
    return result([], 1);
  }

  // INSERT INTO ideas (id, project_id, content) VALUES ($1, $2, $3)
  if (s.startsWith("INSERT INTO IDEAS") && s.includes("VALUES")) {
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

    if (s.includes("RETURNING")) return result([row], 1);
    return result([], 1);
  }

  // INSERT INTO decisions (...) VALUES (...) ON CONFLICT (...) DO NOTHING
  if (s.startsWith("INSERT INTO DECISIONS") && s.includes("ON CONFLICT")) {
    // For MVP, we don't store decisions in memory
    // Just return success
    return result([], 1);
  }

  // INSERT INTO artifacts (...) VALUES (...) ON CONFLICT (...) DO NOTHING
  if (s.startsWith("INSERT INTO ARTIFACTS") && s.includes("ON CONFLICT")) {
    // For MVP, we don't store artifacts in memory
    // Just return success
    return result([], 1);
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  // UPDATE projects SET ... WHERE id = $X
  if (s.startsWith("UPDATE PROJECTS SET") && s.includes("WHERE ID")) {
    // Extract projectId from params (it's always the last param in WHERE clause)
    const projectId = params[params.length - 1];
    const project = memory.projects.get(projectId);

    if (!project) {
      // Make UPDATE failures loud - log when project not found
      console.warn(`[DB] UPDATE projects: project not found for id=${projectId}`);
      return result([], 0);
    }

    // Update fields based on what's in the SET clause
    // This is resilient to column order and additional columns
    let updated = false;
    
    if (s.includes("STAGE")) {
      const newStage = params[0];
      if (newStage && newStage !== project.stage) {
        console.log(`[DB] UPDATE projects: stage ${project.stage} → ${newStage} for id=${projectId}`);
        project.stage = newStage;
        updated = true;
      }
    }
    
    if (s.includes("STATE")) {
      // STATE might be params[0] or params[1] depending on order
      // Look for it in the SET clause position
      const stateIndex = s.indexOf("STATE");
      const stageIndex = s.indexOf("STAGE");
      const newState = stateIndex > stageIndex ? params[1] : params[0];
      if (newState && newState !== project.state) {
        console.log(`[DB] UPDATE projects: state ${project.state} → ${newState} for id=${projectId}`);
        project.state = newState;
        updated = true;
      }
    }

    project.updated_at = new Date().toISOString();
    memory.projects.set(projectId, project);

    if (!updated) {
      console.warn(`[DB] UPDATE projects: no fields changed for id=${projectId}. SQL: ${sql}`);
    }

    return result([], 1);
  }

  // ============================================
  // SELECT OPERATIONS
  // ============================================

  // SELECT ... FROM projects WHERE id = $1
  if (s.includes("SELECT") && s.includes("FROM PROJECTS") && s.includes("WHERE ID")) {
    const [id] = params;
    const project = memory.projects.get(id);

    if (!project) {
      return result([]);
    }

    // Return all project fields - let the caller pick what they need
    return result([project]);
  }

  // SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1
  if (s.includes("SELECT") && s.includes("FROM IDEAS") && s.includes("WHERE PROJECT_ID")) {
    const [projectId] = params;
    let latestIdea = null;

    for (const idea of memory.ideas.values()) {
      if (idea.project_id === projectId) {
        if (!latestIdea || new Date(idea.created_at) > new Date(latestIdea.created_at)) {
          latestIdea = idea;
        }
      }
    }

    if (!latestIdea) {
      return result([]);
    }

    return result([{ content: latestIdea.content }]);
  }

  // SELECT outcome, rationale, created_at FROM decisions WHERE project_id = $1 ...
  if (s.includes("SELECT") && s.includes("FROM DECISIONS") && s.includes("WHERE PROJECT_ID")) {
    // For MVP, we don't store decisions in memory, so return empty
    // This is fine because the GET endpoint handles empty results gracefully
    return result([]);
  }

  // SELECT ... FROM artifacts WHERE project_id = $1 ...
  if (s.includes("SELECT") && s.includes("FROM ARTIFACTS") && s.includes("WHERE PROJECT_ID")) {
    const [projectId] = params;
    const artifacts = [];

    for (const artifact of memory.artifacts.values()) {
      if (artifact.project_id === projectId) {
        artifacts.push(artifact);
      }
    }

    if (s.includes("ORDER BY")) {
      artifacts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (s.includes("LIMIT")) {
      const limitMatch = s.match(/LIMIT\s+(\d+)/);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        return result(artifacts.slice(0, limit));
      }
    }

    return result(artifacts);
  }

  // SELECT * FROM projects (all projects)
  if (s === "SELECT * FROM PROJECTS") {
    return result([...memory.projects.values()]);
  }

  // SELECT * FROM ideas (all ideas)
  if (s === "SELECT * FROM IDEAS") {
    return result([...memory.ideas.values()]);
  }

  // ============================================
  // TRANSACTION CONTROL (no-op for in-memory)
  // ============================================

  if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
    return result([], 0);
  }

  // ============================================
  // FALLBACK: Unsupported SQL
  // ============================================

  // Fail loud instead of silently returning empty rows
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
