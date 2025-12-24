'''
import { Queue } from "bullmq";
import { getRedisConnection } from "../redis.js";
import { pool } from "../db.js";

let feasibilityQueue = null;

function getFeasibilityQueue() {
  if (!feasibilityQueue) {
    const connection = getRedisConnection();
    feasibilityQueue = new Queue("feasibility", {
      connection,
    });
  }
  return feasibilityQueue;
}

export async function triggerFeasibility(req, res) {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const projectResult = await pool.query(
      "SELECT id, state FROM projects WHERE id = $1",
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const queue = getFeasibilityQueue();

    // Idempotency: use project_id-feasibility as job ID (no colons allowed)
    const jobId = `${projectId}-feasibility`;

    // Add job with idempotency (BullMQ will handle duplicate jobId)
    const job = await queue.add(
      "feasibility",
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
    console.error("Error triggering feasibility:", error);
    console.error("Stack:", error.stack);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
}
'''
