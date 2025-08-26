const moment = require('moment-timezone');
const axios = require('axios');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const detalle = async (id) => {
  const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");
  const matchId = decodeId(id);
  const cacheKey = `detalle:${matchId}`;

  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) return desdeCache;

  try {
    const urlOriginal = `https://api.betmines.com/betmines/v1/fixtures/${matchId}`;
    const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlOriginal)}`;

    const response = await axios.get(scraperUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      },
      timeout: 10000
    });

    const data = response.data;
    await saveCache(cacheKey, data, 600);

    return data;

  } catch (e) {
    console.error('Error descargando partidos:', e.message);
    return [];
  }
};

module.exports = { detalle };