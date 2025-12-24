
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redisConnection = null;

function buildRedisConnection() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const isTls = url.startsWith('rediss://');

  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    tls: isTls ? {} : undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  return connection;
}

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = buildRedisConnection();
  }
  return redisConnection;
}

export function checkRedisConnection() {
  return new Promise((resolve, reject) => {
    const connection = getRedisConnection();

    connection.on('ready', () => {
      console.log('✅ Redis connection ready');
      resolve(true);
    });

    connection.on('error', (err) => {
      console.error('❌ Redis connection error:', err?.message || err);
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('Redis connection timeout'));
    }, 10000);
  });
}
