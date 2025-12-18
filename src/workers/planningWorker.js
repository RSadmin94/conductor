const { Worker } = require('bullmq');
const { getRedisConnection } = require('../redis');
const { processPlanningJob } = require('../jobs/planningJob');

let worker = null;

async function startPlanningWorker() {
  const connection = getRedisConnection();
  
  worker = new Worker(
    'planning',
    async (job) => {
      console.log(`Processing planning job ${job.id} for project ${job.data.projectId}`);
      return await processPlanningJob(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );
  
  worker.on('completed', (job) => {
    console.log(`Planning job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`Planning job ${job?.id} failed:`, err);
  });
  
  console.log('Planning worker started');
  return worker;
}

async function stopPlanningWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = { startPlanningWorker, stopPlanningWorker };

