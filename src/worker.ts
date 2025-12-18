import { Worker } from 'bullmq';
import { connection, feasibilityQueue, planningQueue, executionQueue, reviewQueue } from './queue';
import { query } from './db';
import { getModelForJob } from './models';
import { randomUUID } from 'crypto';

// Feasibility worker
const feasibilityWorker = new Worker(
  'feasibility',
  async (job) => {
    const { projectId } = job.data;
    
    // Get idea content
    const ideaResult = await query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (ideaResult.rows.length === 0) {
      throw new Error('No idea found for project');
    }
    
    // Use GPT for feasibility analysis
    const model = getModelForJob('feasibility');
    const analysis = await model.call({
      prompt: `Analyze the feasibility of this idea: ${ideaResult.rows[0].content}`,
      max_tokens: 500,
      temperature: 0.7,
    });
    
    // For MVP, auto-approve (in production, this would be more sophisticated)
    // The decision.record endpoint should be called separately
    console.log(`Feasibility analysis for project ${projectId}:`, analysis.content);
    
    return { analysis: analysis.content };
  },
  { connection }
);

feasibilityWorker.on('completed', (job) => {
  console.log(`Feasibility job ${job.id} completed`);
});

feasibilityWorker.on('failed', (job, err) => {
  console.error(`Feasibility job ${job?.id} failed:`, err);
  if (job) {
    // Update project state to Error after retries exhausted
    query('UPDATE projects SET current_state = $1 WHERE id = $2', ['Error', job.data.projectId]).catch(console.error);
  }
});

// Planning worker
const planningWorker = new Worker(
  'planning',
  async (job) => {
    const { projectId } = job.data;
    
    // Get project context
    const projectResult = await query(
      'SELECT current_state FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    // Get idea and decision
    const ideaResult = await query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    const decisionResult = await query(
      'SELECT outcome, rationale FROM decisions WHERE project_id = $1 ORDER BY decided_at DESC LIMIT 1',
      [projectId]
    );
    
    // Use GPT for planning
    const model = getModelForJob('planning');
    const plan = await model.call({
      prompt: `Create an execution plan for: ${ideaResult.rows[0].content}. Decision: ${decisionResult.rows[0]?.outcome}`,
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    // Create spec
    const specContent = {
      plan: plan.content,
      tasks: [
        { id: randomUUID(), description: 'Task 1: Initial setup', status: 'pending' },
        { id: randomUUID(), description: 'Task 2: Implementation', status: 'pending' },
        { id: randomUUID(), description: 'Task 3: Testing', status: 'pending' },
      ],
    };
    
    await query(
      'INSERT INTO specs (project_id, content) VALUES ($1, $2)',
      [projectId, JSON.stringify(specContent)]
    );
    
    console.log(`Planning completed for project ${projectId}`);
    
    return { specCreated: true };
  },
  { connection }
);

planningWorker.on('completed', (job) => {
  console.log(`Planning job ${job.id} completed`);
});

planningWorker.on('failed', (job, err) => {
  console.error(`Planning job ${job?.id} failed:`, err);
  if (job) {
    query('UPDATE projects SET current_state = $1 WHERE id = $2', ['Error', job.data.projectId]).catch(console.error);
  }
});

// Execution worker
const executionWorker = new Worker(
  'execution',
  async (job) => {
    const { runId, projectId } = job.data;
    
    // Get spec to create tasks
    const specResult = await query(
      'SELECT content FROM specs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (specResult.rows.length === 0) {
      throw new Error('No spec found for project');
    }
    
    let spec = specResult.rows[0].content;
    // Handle JSONB - it might be a string or already parsed
    if (typeof spec === 'string') {
      spec = JSON.parse(spec);
    }
    const tasks = spec.tasks || [];
    
    console.log(`Creating ${tasks.length} tasks for run ${runId}`);
    
    // Create tasks in database
    for (const task of tasks) {
      await query(
        'INSERT INTO tasks (id, project_id, run_id, description, status) VALUES ($1, $2, $3, $4, $5)',
        [task.id, projectId, runId, task.description, 'pending']
      );
    }
    
    // Create execution plan artifact
    const artifactUri = `artifact://${runId}/execution_plan`;
    await query(
      'INSERT INTO artifacts (project_id, run_id, name, uri) VALUES ($1, $2, $3, $4)',
      [projectId, runId, 'execution_plan', artifactUri]
    );
    
    // Update project state
    await query(
      'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
      ['Execution', projectId]
    );
    
    console.log(`Execution handoff prepared for run ${runId}`);
    
    return { tasksCreated: tasks.length, artifactUri };
  },
  { connection }
);

executionWorker.on('completed', (job) => {
  console.log(`Execution job ${job.id} completed`);
});

executionWorker.on('failed', (job, err) => {
  console.error(`Execution job ${job?.id} failed:`, err);
  if (job) {
    query('UPDATE projects SET current_state = $1 WHERE id = $2', ['Error', job.data.projectId]).catch(console.error);
  }
});

// Review worker
const reviewWorker = new Worker(
  'review',
  async (job) => {
    const { runId } = job.data;
    
    // Check if all tasks are completed
    const tasksResult = await query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as completed FROM tasks WHERE run_id = $2',
      ['completed', runId]
    );
    
    const { total, completed } = tasksResult.rows[0];
    
    if (parseInt(total) === 0) {
      throw new Error('No tasks found for run');
    }
    
    if (parseInt(completed) !== parseInt(total)) {
      throw new Error('Not all tasks are completed');
    }
    
    // Get project_id
    const runResult = await query(
      'SELECT project_id FROM runs WHERE id = $1',
      [runId]
    );
    
    if (runResult.rows.length === 0) {
      throw new Error('Run not found');
    }
    
    const projectId = runResult.rows[0].project_id;
    
    // Use Claude for review
    const model = getModelForJob('review');
    const review = await model.call({
      system: 'You are a review system that evaluates completed work.',
      messages: [{ role: 'user', content: `Review the completed tasks for run ${runId}` }],
      max_tokens: 500,
    });
    
    // Update state to Release
    await query(
      'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
      ['Release', projectId]
    );
    
    await query(
      'UPDATE runs SET ended_at = NOW(), state = $1 WHERE id = $2',
      ['Completed', runId]
    );
    
    console.log(`Review completed for run ${runId}`);
    
    return { review: review.content };
  },
  { connection }
);

reviewWorker.on('completed', (job) => {
  console.log(`Review job ${job.id} completed`);
});

reviewWorker.on('failed', (job, err) => {
  console.error(`Review job ${job?.id} failed:`, err);
  if (job) {
    query('UPDATE runs SET state = $1 WHERE id = $2', ['ReviewFailed', job.data.runId]).catch(console.error);
  }
});

console.log('Workers started');

