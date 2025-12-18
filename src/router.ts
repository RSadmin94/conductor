import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { query } from './db';
import { validateTransition } from './state-machine';
import { feasibilityQueue, planningQueue, executionQueue, reviewQueue } from './queue';
import { randomUUID } from 'crypto';

const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

export const appRouter = router({
  'project.create': publicProcedure
    .input(z.object({
      userId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const projectId = randomUUID();
      await query(
        'INSERT INTO projects (id, user_id, current_state) VALUES ($1, $2, $3)',
        [projectId, input.userId, 'Idea']
      );
      return { projectId };
    }),
  'idea.intake': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Validate project exists and is in 'Idea' state
      const projectResult = await query(
        'SELECT current_state FROM projects WHERE id = $1',
        [input.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      if (projectResult.rows[0].current_state !== 'Idea') {
        throw new Error('Project not in Idea state');
      }
      
      // Create idea
      const ideaResult = await query(
        'INSERT INTO ideas (project_id, content) VALUES ($1, $2) RETURNING id',
        [input.projectId, input.content]
      );
      
      return { ideaId: ideaResult.rows[0].id };
    }),

  'feasibility.trigger': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const projectResult = await query(
        'SELECT current_state FROM projects WHERE id = $1',
        [input.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      if (projectResult.rows[0].current_state !== 'Idea') {
        throw new Error('Project not in Idea state');
      }
      
      // Update state
      await query(
        'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
        ['Feasibility', input.projectId]
      );
      
      // Enqueue job
      const job = await feasibilityQueue.add('feasibility.process', {
        projectId: input.projectId,
      }, {
        jobId: input.projectId, // Idempotency
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
      
      // Audit log
      await query(
        'INSERT INTO audit_logs (project_id, action, actor_id, metadata) VALUES ($1, $2, $3, $4)',
        [input.projectId, 'feasibility.trigger', randomUUID(), JSON.stringify({ jobId: job.id })]
      );
      
      return { jobId: job.id! };
    }),

  'decision.record': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      outcome: z.enum(['Approved', 'Rejected']),
      rationale: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const projectResult = await query(
        'SELECT current_state FROM projects WHERE id = $1',
        [input.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      if (projectResult.rows[0].current_state !== 'Feasibility') {
        throw new Error('Project not in Feasibility state');
      }
      
      // Record decision
      const decisionResult = await query(
        'INSERT INTO decisions (project_id, outcome, rationale) VALUES ($1, $2, $3) RETURNING id',
        [input.projectId, input.outcome, input.rationale || null]
      );
      
      // Update state
      const newState = input.outcome === 'Approved' ? 'Approved' : 'Rejected';
      await query(
        'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
        [newState, input.projectId]
      );
      
      return { decisionId: decisionResult.rows[0].id };
    }),

  'planning.trigger': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const projectResult = await query(
        'SELECT current_state FROM projects WHERE id = $1',
        [input.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      if (projectResult.rows[0].current_state !== 'Approved') {
        throw new Error('Project not in Approved state');
      }
      
      // Update state
      await query(
        'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
        ['Planning', input.projectId]
      );
      
      // Enqueue job
      const job = await planningQueue.add('planning.generate', {
        projectId: input.projectId,
      }, {
        jobId: input.projectId, // Idempotency
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      });
      
      return { jobId: job.id! };
    }),

  'execution.start': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const projectResult = await query(
        'SELECT current_state FROM projects WHERE id = $1',
        [input.projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      if (projectResult.rows[0].current_state !== 'Planning') {
        throw new Error('Project not in Planning state');
      }
      
      // Create run
      const runId = randomUUID();
      await query(
        'INSERT INTO runs (id, project_id, state, started_at) VALUES ($1, $2, $3, NOW())',
        [runId, input.projectId, 'Active']
      );
      
      // Enqueue execution prepare job
      const job = await executionQueue.add('execution.prepare_handoff', {
        runId,
        projectId: input.projectId,
      }, {
        jobId: runId, // Idempotency
        attempts: 1,
      });
      
      return { runId, executionArtifactUri: `artifact://${runId}/execution_plan` };
    }),

  'execution.report': publicProcedure
    .input(z.object({
      runId: z.string().uuid(),
      taskId: z.string().uuid(),
      status: z.enum(['completed', 'failed']),
      artifacts: z.array(z.object({
        name: z.string(),
        uri: z.string(),
      })).optional(),
      failureReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Verify run and task exist
      const runResult = await query(
        'SELECT project_id FROM runs WHERE id = $1',
        [input.runId]
      );
      
      if (runResult.rows.length === 0) {
        throw new Error('Run not found');
      }
      
      const taskResult = await query(
        'SELECT id FROM tasks WHERE id = $1 AND run_id = $2',
        [input.taskId, input.runId]
      );
      
      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }
      
      // Update task
      await query(
        'UPDATE tasks SET status = $1, completed_at = CASE WHEN $1 = $2 THEN NOW() ELSE NULL END WHERE id = $3',
        [input.status, 'completed', input.taskId]
      );
      
      // Register artifacts if provided
      if (input.artifacts) {
        for (const artifact of input.artifacts) {
          await query(
            'INSERT INTO artifacts (project_id, run_id, name, uri) VALUES ($1, $2, $3, $4)',
            [runResult.rows[0].project_id, input.runId, artifact.name, artifact.uri]
          );
        }
      }
      
      // Check if all tasks are completed and trigger review
      if (input.status === 'completed') {
        const tasksResult = await query(
          'SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as completed FROM tasks WHERE run_id = $2',
          ['completed', input.runId]
        );
        
        const { total, completed } = tasksResult.rows[0];
        if (parseInt(completed) === parseInt(total) && parseInt(total) > 0) {
          // Update project state to Review
          await query(
            'UPDATE projects SET current_state = $1, updated_at = NOW() WHERE id = $2',
            ['Review', runResult.rows[0].project_id]
          );
          
          // Enqueue review job
          await reviewQueue.add('review.gate', {
            runId: input.runId,
          }, {
            jobId: input.runId,
            attempts: 2,
            backoff: {
              type: 'fixed',
              delay: 10000,
            },
          });
        }
      }
      
      return { acknowledged: true };
    }),

  'artifact.register': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      runId: z.string().uuid().optional(),
      name: z.string(),
      uri: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await query(
        'INSERT INTO artifacts (project_id, run_id, name, uri) VALUES ($1, $2, $3, $4) RETURNING id',
        [input.projectId, input.runId || null, input.name, input.uri]
      );
      
      return { artifactId: result.rows[0].id };
    }),

  'run.control': publicProcedure
    .input(z.object({
      runId: z.string().uuid(),
      action: z.enum(['pause', 'cancel']),
    }))
    .mutation(async ({ input }) => {
      const runResult = await query(
        'SELECT state FROM runs WHERE id = $1',
        [input.runId]
      );
      
      if (runResult.rows.length === 0) {
        throw new Error('Run not found');
      }
      
      const currentState = runResult.rows[0].state;
      if (currentState !== 'Active') {
        throw new Error('Run not active');
      }
      
      const newState = input.action === 'pause' ? 'Paused' : 'Cancelled';
      await query(
        'UPDATE runs SET state = $1 WHERE id = $2',
        [newState, input.runId]
      );
      
      return { success: true, state: newState };
    }),

  'run.resume': publicProcedure
    .input(z.object({
      runId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const runResult = await query(
        'SELECT project_id, state FROM runs WHERE id = $1',
        [input.runId]
      );
      
      if (runResult.rows.length === 0) {
        throw new Error('Run not found');
      }
      
      const state = runResult.rows[0].state;
      if (!['Paused', 'Error'].includes(state)) {
        throw new Error('Run not resumable');
      }
      
      await query(
        'UPDATE runs SET state = $1 WHERE id = $2',
        ['Active', input.runId]
      );
      
      // Re-enqueue execution prepare
      await executionQueue.add('execution.prepare_handoff', {
        runId: input.runId,
        projectId: runResult.rows[0].project_id,
      }, {
        jobId: input.runId,
        attempts: 1,
      });
      
      return { resumed: true, executionArtifactUri: `artifact://${input.runId}/execution_plan` };
    }),

  'tasks.list': publicProcedure
    .input(z.object({
      runId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const result = await query(
        'SELECT id, description, status, created_at, completed_at FROM tasks WHERE run_id = $1 ORDER BY created_at',
        [input.runId]
      );
      return { tasks: result.rows };
    }),

  'project.get': publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const result = await query(
        'SELECT id, user_id, current_state, created_at, updated_at FROM projects WHERE id = $1',
        [input.projectId]
      );
      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }
      return { project: result.rows[0] };
    }),
});

export type AppRouter = typeof appRouter;

