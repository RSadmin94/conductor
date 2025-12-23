const IORedis = require('ioredis');
require('dotenv').config();

// Shared Redis connection for BullMQ
let redisConnection = null;

// Build Redis connection with proper TLS handling
function buildRedisConnection() {
  const url = process.env.REDIS_URL;
  
  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const isTls = url.startsWith('rediss://');

  // Create ioredis connection with proper TLS support
  // For Redis Cloud, pass the full URL directly to ioredis
  // ioredis handles rediss:// URLs automatically
  const connection = new IORedis(url, {
    // BullMQ stability settings
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    
    // TLS configuration for Redis Cloud
    // If isTls is true, enable TLS with standard settings
    // If you get cert errors, change to: { rejectUnauthorized: false }
    tls: isTls ? {} : undefined,
    
    // Retry strategy
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  return connection;
}

// Get or create Redis connection
function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = buildRedisConnection();
  }
  return redisConnection;
}

// Health check function - call this at startup
function checkRedisConnection() {
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
    
    // Timeout after 10 seconds if no response
    setTimeout(() => {
      reject(new Error('Redis connection timeout'));
    }, 10000);
  });
}

module.exports = { 
  buildRedisConnection, 
  getRedisConnection,
  checkRedisConnection 
};
