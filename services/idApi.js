const moment = require('moment-timezone');
const axios = require('axios');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

const detalle = async (id) => {
  //const { shortId } = req.params;
  const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");
  const matchId = decodeId(id);
  const cacheKey = `detalle:${matchId}`;
  
  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) return desdeCache;
  
  try {
    const response = await axios.get(`https://api.betmines.com/betmines/v1/fixtures/${matchId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Origin: "https://www.betmines.com",
        Referer: "https://www.betmines.com/",
      }
    });
    const data = response.data;
    await saveCache(cacheKey, data, 600);
    return data;
  } catch (e) {
    console.error('Error descargando partidos:', e.message);
    return [];
  }
}

module.exports = { detalle };