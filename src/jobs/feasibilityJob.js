const pool = require('../db');
const { randomUUID } = require('crypto');

async function processFeasibilityJob(job) {
  const { projectId } = job.data;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get idea content
    const ideaResult = await client.query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (ideaResult.rows.length === 0) {
      throw new Error('No idea found for project');
    }
    
    const ideaContent = ideaResult.rows[0].content;
    
    // Mock feasibility analysis - in production, call AI model
    const outcome = 'Approved'; // Simplified for MVP
    const rationale = `Feasibility analysis completed for: ${ideaContent.substring(0, 100)}...`;
    
    // Create decision record (idempotent via UNIQUE constraint)
    // stage='feasibility' for idempotency
    await client.query(
      'INSERT INTO decisions (id, project_id, stage, outcome, rationale) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (project_id, stage) DO NOTHING',
      [randomUUID(), projectId, 'feasibility', outcome, rationale]
    );
    
    // Update project stage and state
    // T10: Set stage='FeasibilityComplete', keep state='Active'
    await client.query(
      'UPDATE projects SET stage = $1, state = $2, updated_at = NOW() WHERE id = $3',
      ['FeasibilityComplete', 'Active', projectId]
    );
    
    // Create feasibility_report artifact (idempotent via UNIQUE constraint)
    // stage='feasibility', type='feasibility_report' for idempotency
    const artifactContent = JSON.stringify({
      analysis: 'Feasibility analysis completed',
      outcome,
      rationale,
      timestamp: new Date().toISOString()
    });
    
    await client.query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'feasibility', 'feasibility_report', 'feasibility_report', artifactContent]
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

module.exports = { processFeasibilityJob };

