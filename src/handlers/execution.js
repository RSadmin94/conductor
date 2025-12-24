'''
import { Queue } from "bullmq";
import { getRedisConnection } from "../redis.js";
import { pool } from "../db.js";

let executionQueue = null;

function getExecutionQueue() {
  if (!executionQueue) {
    const connection = getRedisConnection();
    executionQueue = new Queue("execution", {
      connection,
    });
  }
  return executionQueue;
}

export async function startExecution(req, res) {
  try {
    const { projectId } = req.params;

    // Verify project exists and is in correct stage
    const projectResult = await pool.query(
      "SELECT id, state, stage FROM projects WHERE id = $1",
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = projectResult.rows[0];

    // Only allow execution if stage is PlanningComplete
    if (project.stage !== "PlanningComplete") {
      return res.status(409).json({
        error: "Project must be in PlanningComplete stage",
        currentStage: project.stage,
      });
    }

    const queue = getExecutionQueue();

    // Idempotency: use project_id-execution as job ID (no colons allowed)
    const jobId = `${projectId}-execution`;

    // Add job with idempotency (BullMQ will handle duplicate jobId)
    const job = await queue.add(
      "execution",
      { projectId },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );

    res.json({
      jobId: job.id,
      status: "enqueued",
    });
  } catch (error) {
    console.error("Error starting execution:", error);
    console.error("Stack:", error.stack);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
}
'''
