const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let useInMemory = false;

// In-memory storage for development/testing
const inMemoryStore = {
  projects: new Map(),
  ideas: new Map(),
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
  useInMemory = true;
  console.warn('WARNING: DATABASE_URL not set, using in-memory storage for development');
}

// Wrapper function to handle both database and in-memory operations
async function query(sql, params = []) {
  if (useInMemory) {
    // Simple in-memory query handler for development
    if (sql.includes('INSERT INTO projects')) {
      const id = params[0];
      const state = params[1];
      const stage = params[2];
      inMemoryStore.projects.set(id, { id, state, stage });
      return { rows: [{ id, state, stage }] };
    }
    if (sql.includes('INSERT INTO ideas')) {
      const id = params[0];
      const projectId = params[1];
      const content = params[2];
      inMemoryStore.ideas.set(id, { id, project_id: projectId, content });
      return { rows: [{ id }] };
    }
    if (sql.includes('SELECT') && sql.includes('projects')) {
      const projectId = params[0];
      const project = inMemoryStore.projects.get(projectId);
      return { rows: project ? [project] : [] };
    }
    return { rows: [] };
  }
  
  if (!pool) {
    throw new Error('Database not available');
  }
  
  return pool.query(sql, params);
}

// Export both pool and query function
module.exports = {
  pool,
  query,
  useInMemory: () => useInMemory,
};

// Also export as default for backward compatibility
module.exports.default = module.exports;
