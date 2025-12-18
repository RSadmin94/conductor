const { Queue } = require('bullmq');
const { getRedisConnection } = require('../redis');
const pool = require('../db');

let planningQueue = null;

function getPlanningQueue() {
  if (!planningQueue) {
    const connection = getRedisConnection();
    planningQueue = new Queue('planning', {
      connection,
    });
  }
  return planningQueue;
}

async function triggerPlanning(req, res) {
  try {
    const { projectId } = req.params;
    
    // Verify project exists and is in correct stage
    const projectResult = await pool.query(
      'SELECT id, state, stage FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Only allow planning if stage is FeasibilityComplete
    if (project.stage !== 'FeasibilityComplete') {
      return res.status(409).json({ 
        error: 'Project must be in FeasibilityComplete stage',
        currentStage: project.stage
      });
    }
    
    const queue = getPlanningQueue();
    
    // Idempotency: use project_id-planning as job ID (no colons allowed)
    const jobId = `${projectId}-planning`;
    
    // Add job with idempotency (BullMQ will handle duplicate jobId)
    const job = await queue.add(
      'planning',
      { projectId },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
    
    res.json({
      jobId: job.id,
      status: 'enqueued'
    });
  } catch (error) {
    console.error('Error triggering planning:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = { triggerPlanning };

