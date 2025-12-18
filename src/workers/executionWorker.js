const { Worker } = require('bullmq');
const { getRedisConnection } = require('../redis');
const { processExecutionJob } = require('../jobs/executionJob');

let worker = null;

async function startExecutionWorker() {
  const connection = getRedisConnection();
  
  worker = new Worker(
    'execution',
    async (job) => {
      console.log(`Processing execution job ${job.id} for project ${job.data.projectId}`);
      return await processExecutionJob(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );
  
  worker.on('completed', (job) => {
    console.log(`Execution job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`Execution job ${job?.id} failed:`, err);
  });
  
  console.log('Execution worker started');
  return worker;
}

async function stopExecutionWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = { startExecutionWorker, stopExecutionWorker };

