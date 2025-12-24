'''
import { Worker } from "bullmq";
import { getRedisConnection } from "../redis.js";
import { processPlanningJob } from "../jobs/planningJob.js";

let worker = null;

export async function startPlanningWorker() {
  const connection = getRedisConnection();

  worker = new Worker(
    "planning",
    async (job) => {
      console.log(`Processing planning job ${job.id} for project ${job.data.projectId}`);
      return await processPlanningJob(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Planning job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Planning job ${job?.id} failed:`, err);
  });

  console.log("Planning worker started");
  return worker;
}

export async function stopPlanningWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
'''
