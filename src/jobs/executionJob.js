const { query } = require('../db');
const { randomUUID } = require('crypto');

async function processExecutionJob(job) {
  const { projectId } = job.data;
  
  try {
    // Begin transaction (no-op for in-memory)
    await query('BEGIN');
    
    // Check if already ExecutionComplete (idempotency)
    const projectResult = await query(
      'SELECT stage FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    const currentStage = projectResult.rows[0].stage;
    
    // If already ExecutionComplete, exit safely (idempotency)
    if (currentStage === 'ExecutionComplete') {
      await query('COMMIT');
      console.log(`[ExecutionJob] Project ${projectId} already ExecutionComplete (idempotent)`);
      return { projectId, message: 'Already ExecutionComplete', skipped: true };
    }
    
    // Update stage to ExecutionInProgress
    console.log(`[ExecutionJob] Updating project ${projectId}: stage → ExecutionInProgress`);
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['ExecutionInProgress', projectId]
    );
    
    // Step 1: Validate
    const validateRunId = randomUUID();
    await query(
      'INSERT INTO runs (id, project_id, state, started_at) VALUES ($1, $2, $3, NOW())',
      [validateRunId, projectId, 'success']
    );
    
    // Step 2: Process
    const processRunId = randomUUID();
    await query(
      'INSERT INTO runs (id, project_id, state, started_at) VALUES ($1, $2, $3, NOW())',
      [processRunId, projectId, 'success']
    );
    
    // Step 3: Finalize
    const finalizeRunId = randomUUID();
    await query(
      'INSERT INTO runs (id, project_id, state, started_at, ended_at) VALUES ($1, $2, $3, NOW(), NOW())',
      [finalizeRunId, projectId, 'success']
    );
    
    // Create execution_log artifact (TEXT markdown)
    const executionLog = `# Execution Log

## Step 1: Validate
- Run ID: ${validateRunId}
- Status: success
- Timestamp: ${new Date().toISOString()}

## Step 2: Process
- Run ID: ${processRunId}
- Status: success
- Timestamp: ${new Date().toISOString()}

## Step 3: Finalize
- Run ID: ${finalizeRunId}
- Status: success
- Timestamp: ${new Date().toISOString()}

Execution completed successfully.
`;
    
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'execution', 'execution_log', 'execution_log', executionLog]
    );
    
    // Create execution_result artifact (JSON)
    const executionResult = JSON.stringify({
      status: 'success',
      runs: [
        { id: validateRunId, step: 'validate', status: 'success' },
        { id: processRunId, step: 'process', status: 'success' },
        { id: finalizeRunId, step: 'finalize', status: 'success' }
      ],
      completedAt: new Date().toISOString()
    });
    
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'execution', 'execution_result', 'execution_result', executionResult]
    );
    
    // Update stage to ExecutionComplete
    console.log(`[ExecutionJob] Updating project ${projectId}: stage → ExecutionComplete`);
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['ExecutionComplete', projectId]
    );
    
    // Commit transaction (no-op for in-memory)
    await query('COMMIT');
    
    console.log(`[ExecutionJob] Completed for project ${projectId}`);
    return { 
      projectId, 
      runsCreated: 3,
      artifactsCreated: 2,
      finalStage: 'ExecutionComplete'
    };
  } catch (error) {
    // Rollback transaction (no-op for in-memory)
    await query('ROLLBACK');
    console.error(`[ExecutionJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}

module.exports = { processExecutionJob };
