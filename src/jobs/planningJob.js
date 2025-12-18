const pool = require('../db');
const { randomUUID } = require('crypto');

async function processPlanningJob(job) {
  const { projectId } = job.data;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get project to verify it exists and is in correct stage
    const projectResult = await client.query(
      'SELECT stage FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    // Mock planning - in production, call AI model
    const outcome = 'Approved';
    const rationale = 'Planning completed successfully';
    
    // Create decision record (idempotent via UNIQUE constraint)
    // stage='planning' for idempotency
    await client.query(
      'INSERT INTO decisions (id, project_id, stage, outcome, rationale) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (project_id, stage) DO NOTHING',
      [randomUUID(), projectId, 'planning', outcome, rationale]
    );
    
    // Create planning_plan artifact (idempotent via UNIQUE constraint)
    // stage='planning', type='planning_plan' for idempotency
    const artifactContent = JSON.stringify({
      plan: 'Planning plan stub content',
      steps: ['Step 1', 'Step 2', 'Step 3'],
      timestamp: new Date().toISOString()
    });
    
    await client.query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'planning', 'planning_plan', 'planning_plan', artifactContent]
    );
    
    // Update project stage
    // T11: Set stage='PlanningComplete', keep state='Active'
    await client.query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['PlanningComplete', projectId]
    );
    
    await client.query('COMMIT');
    
    return { projectId, outcome, rationale };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { processPlanningJob };

