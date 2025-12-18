const db = require('../db');
const { randomUUID } = require('crypto');

async function createIdea(req, res) {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    const projectId = randomUUID();
    const ideaId = randomUUID();
    
    // Create project and idea using the db module (handles both DB and in-memory)
    await db.query(
      'INSERT INTO projects (id, state, stage) VALUES ($1, $2, $3)',
      [projectId, 'Active', 'Idea']
    );
    
    await db.query(
      'INSERT INTO ideas (id, project_id, content) VALUES ($1, $2, $3)',
      [ideaId, projectId, content.trim()]
    );
    
    return res.json({
      projectId,
      ideaId,
      state: 'Active',
      stage: 'Idea',
      content: content.trim()
    });
  } catch (error) {
    console.error('Error creating idea:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = { createIdea };
