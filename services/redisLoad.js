const redisClient = require('./redisClient');

// Asegura conexión antes de usar
async function ensureRedisConnection() {
  if (!redisClient.isOpen) {
    console.log('🔌 Reconectando a Redis...');
    await redisClient.connect();
  }
}

// Guardar datos en cache
async function saveCache(clave, datos, segundos = 86400) { // por defecto 24h
  try {
    await ensureRedisConnection();
    await redisClient.setEx(clave, segundos, JSON.stringify(datos));
    console.log(`✅ Cache guardado: ${clave}`);
  } catch (err) {
    console.error(`❌ Error al guardar cache [${clave}]:`, err.message);
  }
}

// Leer datos desde cache
async function loadCache(clave) {
  try {
    await ensureRedisConnection();
    const cached = await redisClient.get(clave);
    if (cached) {
      console.log(`🟢 Cache HIT: ${clave}`);
      return JSON.parse(cached);
    } else {
      console.log(`🔴 Cache MISS: ${clave}`);
      return null;
    }
  } catch (err) {
    console.error(`❌ Error al leer cache [${clave}]:`, err.message);
    return null;
  }
}

module.exports = {
  saveCache,
  loadCache
};