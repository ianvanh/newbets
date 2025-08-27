const moment = require('moment-timezone');
const axios = require('axios');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

async function fetchFixture(originalUrl) {
  const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

  try {
    const direct = await axios.get(originalUrl, { headers, timeout: 12000 });
    return direct.data;
  } catch (e) {
    if (e.response && [401, 403].includes(e.response.status)) {
      console.warn("Directo bloqueado, usando ScraperAPI...");
      const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&country_code=us&url=${encodeURIComponent(originalUrl)}`;
      const scraper = await axios.get(scraperUrl, { headers, timeout: 25000 });
      return scraper.data;
    } else {
      throw e;
    }
  }
}

const detalle = async (id) => {
  const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");
  const matchId = decodeId(id);
  const cacheKey = `detalle:${matchId}`;

  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) return desdeCache;

  try {
    const urlOriginal = `https://api.betmines.com/betmines/v1/fixtures/${matchId}`;
    const data = await fetchFixture(urlOriginal);

    if (data && Object.keys(data).length > 0) {
      await saveCache(cacheKey, data, 600);
    }

    return data;
  } catch (e) {
    console.error('Error descargando partidos:', e.message);
    return [];
  }
};

module.exports = { detalle };