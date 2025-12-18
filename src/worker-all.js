// Combined worker process for Railway deployment
// Runs all workers in a single process
require('dotenv').config();

// Ensure env vars are set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('ERROR: REDIS_URL environment variable is required');
  process.exit(1);
}

const { startFeasibilityWorker } = require('./workers/feasibilityWorker');
const { startPlanningWorker } = require('./workers/planningWorker');
const { startExecutionWorker } = require('./workers/executionWorker');

async function startAllWorkers() {
  try {
    console.log('Starting all workers...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
    console.log('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'MISSING');
    
    await startFeasibilityWorker();
    await startPlanningWorker();
    await startExecutionWorker();
    
    console.log('All workers started successfully');
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

startAllWorkers();

