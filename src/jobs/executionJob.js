
import { pool } from "../db.js";
import { randomUUID } from "crypto";

export async function processExecutionJob(job) {
  const { projectId } = job.data;

  try {
    await pool.query("BEGIN");

    const projectResult = await pool.query(
      "SELECT stage FROM projects WHERE id = $1",
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new Error("Project not found");
    }

    const currentStage = projectResult.rows[0].stage;

    if (currentStage === "ExecutionComplete") {
      await pool.query("COMMIT");
      console.log(`[ExecutionJob] Project ${projectId} already ExecutionComplete (idempotent)`);
      return { projectId, message: "Already ExecutionComplete", skipped: true };
    }

    console.log(`[ExecutionJob] Updating project ${projectId}: stage → ExecutionInProgress`);
    await pool.query(
      "UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2",
      ["ExecutionInProgress", projectId]
    );

    const validateRunId = randomUUID();
    await pool.query(
      "INSERT INTO runs (id, project_id, state, started_at) VALUES ($1, $2, $3, NOW())",
      [validateRunId, projectId, "success"]
    );

    const processRunId = randomUUID();
    await pool.query(
      "INSERT INTO runs (id, project_id, state, started_at) VALUES ($1, $2, $3, NOW())",
      [processRunId, projectId, "success"]
    );

    const finalizeRunId = randomUUID();
    await pool.query(
      "INSERT INTO runs (id, project_id, state, started_at, ended_at) VALUES ($1, $2, $3, NOW(), NOW())",
      [finalizeRunId, projectId, "success"]
    );

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

    await pool.query(
      "INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING",
      [randomUUID(), projectId, "execution", "execution_log", "execution_log", executionLog]
    );

    const executionResult = JSON.stringify({
      status: "success",
      runs: [
        { id: validateRunId, step: "validate", status: "success" },
        { id: processRunId, step: "process", status: "success" },
        { id: finalizeRunId, step: "finalize", status: "success" },
      ],
      completedAt: new Date().toISOString(),
    });

    await pool.query(
      "INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING",
      [randomUUID(), projectId, "execution", "execution_result", "execution_result", executionResult]
    );

    console.log(`[ExecutionJob] Updating project ${projectId}: stage → ExecutionComplete`);
    await pool.query(
      "UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2",
      ["ExecutionComplete", projectId]
    );

    await pool.query("COMMIT");

    console.log(`[ExecutionJob] Completed for project ${projectId}`);
    return {
      projectId,
      runsCreated: 3,
      artifactsCreated: 2,
      finalStage: "ExecutionComplete",
    };
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error(`[ExecutionJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}
