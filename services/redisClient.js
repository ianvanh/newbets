require('dotenv').config();
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    pingInterval: 50000,
    keepAlive: 10000,
    reconnectStrategy: retries => Math.min(retries * 100, 2000)
  }
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redisClient.on('connect', () => {
  console.log('✅ Redis conectado');
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('❌ No se pudo conectar a Redis:', err.message);
  }
})();

module.exports = redisClient;