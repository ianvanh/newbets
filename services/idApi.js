const moment = require('moment-timezone');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

async function fetchFixture(matchId) {
  const { gotScraping } = await import('got-scraping');

  const url = `https://api.betmines.com/betmines/v1/fixtures/${matchId}`;

  try {
    const response = await gotScraping({
      url: url,
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 120 }],
        devices: ['mobile'],
        operatingSystems: ['android'],
      },
      headers: {
        'Origin': 'https://www.betmines.com',
        'Referer': 'https://www.betmines.com/',
        'Accept': 'application/json, text/plain, */*'
      },
      responseType: 'json',
      timeout: { request: 15000 },
      retry: { limit: 2 }
    });

    return response.body;

  } catch (error) {
    if (error.response && error.response.statusCode === 404) {
      console.warn(`⚠️ Partido ${matchId} no encontrado (404).`);
      return null;
    }
    throw error;
  }
}

const detalle = async (id) => {
  let matchId = id;
  if (typeof id === 'string' && isNaN(id)) {
      matchId = decodeId(id);
  }

  const cacheKey = `detalle:${matchId}`;

  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) {
      // console.log(`🚀 Detalle ${matchId} cargado desde caché`);
      return desdeCache;
  }

  try {
    const data = await fetchFixture(matchId);

    if (data && Object.keys(data).length > 0) {
      await saveCache(cacheKey, data, 600);
      return data;
    } else {
      console.warn(`⚠️ Datos vacíos para el partido ${matchId}`);
      return null;
    }

  } catch (e) {
    console.error(`❌ Error obteniendo detalle del partido ${matchId}:`, e.message);
    return null;
  }
};

module.exports = { detalle };