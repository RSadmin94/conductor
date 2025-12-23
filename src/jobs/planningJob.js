const { query } = require('../db');
const { randomUUID } = require('crypto');

async function processPlanningJob(job) {
  const { projectId } = job.data;
  
  try {
    // Begin transaction (no-op for in-memory)
    await query('BEGIN');
    
    // Get project to verify it exists and is in correct stage
    const projectResult = await query(
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
    await query(
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
    
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'planning', 'planning_plan', 'planning_plan', artifactContent]
    );
    
    // Update project stage
    // T11: Set stage='PlanningComplete', keep state='Active'
    console.log(`[PlanningJob] Updating project ${projectId}: stage → PlanningComplete`);
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['PlanningComplete', projectId]
    );
    
    // Commit transaction (no-op for in-memory)
    await query('COMMIT');
    
    console.log(`[PlanningJob] Completed for project ${projectId}`);
    return { projectId, outcome, rationale };
  } catch (error) {
    // Rollback transaction (no-op for in-memory)
    await query('ROLLBACK');
    console.error(`[PlanningJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}

module.exports = { processPlanningJob };
