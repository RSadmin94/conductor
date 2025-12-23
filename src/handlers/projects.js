const { query } = require('../db');

async function getProject(req, res) {
  try {
    const { projectId } = req.params;
    
    // Get project
    const projectResult = await query(
      'SELECT id, state, stage, created_at, updated_at FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectResult.rows[0];
    
    // Get latest decision
    const decisionResult = await query(
      'SELECT outcome, rationale, created_at FROM decisions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    const response = {
      projectId: project.id,
      state: project.state,
      stage: project.stage,
    };
    
    if (decisionResult.rows.length > 0) {
      response.decision = {
        outcome: decisionResult.rows[0].outcome,
        rationale: decisionResult.rows[0].rationale,
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getProject };

