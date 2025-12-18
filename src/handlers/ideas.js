const pool = require('../db');
const { randomUUID } = require('crypto');

async function createIdea(req, res) {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create project with state='Active' and stage='Idea'
      const projectResult = await client.query(
        'INSERT INTO projects (id, state, stage) VALUES ($1, $2, $3) RETURNING id, state, stage',
        [randomUUID(), 'Active', 'Idea']
      );
      const projectId = projectResult.rows[0].id;
      
      // Create idea record
      const ideaResult = await client.query(
        'INSERT INTO ideas (id, project_id, content) VALUES ($1, $2, $3) RETURNING id',
        [randomUUID(), projectId, content.trim()]
      );
      const ideaId = ideaResult.rows[0].id;
      
      await client.query('COMMIT');
      
      res.json({
        projectId,
        ideaId,
        state: 'Active',
        stage: 'Idea'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating idea:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createIdea };

