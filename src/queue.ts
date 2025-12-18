import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '56379'),
  maxRetriesPerRequest: null,
});

export const feasibilityQueue = new Queue('feasibility', { connection });
export const planningQueue = new Queue('planning', { connection });
export const executionQueue = new Queue('execution', { connection });
export const reviewQueue = new Queue('review', { connection });

export { connection };

