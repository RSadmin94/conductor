// Combined worker process for Render deployment
// Runs all workers in a single process with Redis health checks
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

const { checkRedisConnection } = require('./redis');
const { startFeasibilityWorker } = require('./workers/feasibilityWorker');
const { startPlanningWorker } = require('./workers/planningWorker');
const { startExecutionWorker } = require('./workers/executionWorker');

async function startAllWorkers() {
  try {
    console.log('=== Starting Conductor Workers ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
    console.log('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'MISSING');
    
    // Check Redis connection first
    console.log('\nVerifying Redis connection...');
    try {
      await checkRedisConnection();
      console.log('Redis connection verified successfully\n');
    } catch (error) {
      console.error('Failed to connect to Redis:', error?.message);
      console.error('Exiting due to Redis connection failure');
      process.exit(1);
    }
    
    // Start all workers
    console.log('Starting workers...');
    await startFeasibilityWorker();
    await startPlanningWorker();
    await startExecutionWorker();
    
    console.log('✅ All workers started successfully');
    console.log('=== Worker system ready ===\n');
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

startAllWorkers();
