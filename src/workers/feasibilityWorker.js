'''
import { Worker } from "bullmq";
import { getRedisConnection } from "../redis.js";
import { processFeasibilityJob } from "../jobs/feasibilityJob.js";

let worker = null;

export async function startFeasibilityWorker() {
  const connection = getRedisConnection();

  worker = new Worker(
    "feasibility",
    async (job) => {
      console.log(`Processing feasibility job ${job.id} for project ${job.data.projectId}`);
      return await processFeasibilityJob(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Feasibility job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Feasibility job ${job?.id} failed:`, err);
  });

  console.log("Feasibility worker started");
  return worker;
}

export async function stopFeasibilityWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
'''
