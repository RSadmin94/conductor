const IORedis = require('ioredis');
require('dotenv').config();

// Shared Redis connection for BullMQ
let redisConnection = null;

// Create ioredis connection for BullMQ
function getRedisConnection() {
  if (!redisConnection) {
    // Support both REDIS_URL and individual host/port for Railway
    if (process.env.REDIS_URL) {
      const url = process.env.REDIS_URL;
      const urlObj = new URL(url);
      
      redisConnection = new IORedis({
        host: urlObj.hostname || 'localhost',
        port: parseInt(urlObj.port || '6379'),
        password: urlObj.password || undefined,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });
    } else if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
      // Fallback for Railway-style env vars
      redisConnection = new IORedis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: false,
        enableOfflineQueue: false,
      });
    } else {
      // Local development fallback
      redisConnection = new IORedis({
        host: 'localhost',
        port: 56379,
        maxRetriesPerRequest: null,
      });
    }
  }
  return redisConnection;
}

module.exports = { getRedisConnection };
