const moment = require('moment-timezone');
const axios = require('axios');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

// Detectar si estamos en Render
const IS_RENDER = process.env.RENDER === 'true';

let puppeteer;
let StealthPlugin;

if (IS_RENDER) {
  // Solo cargar Puppeteer en Render
  puppeteer = require('puppeteer-extra');
  StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
}

const getRealisticHeaders = () => {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Origin': 'https://www.betmines.com',
    'Referer': 'https://www.betmines.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  };
};

// Función con axios (para local)
const fetchWithAxios = async (matchId) => {
  try {
    const response = await axios.get(
      `https://api.betmines.com/betmines/v1/fixtures/${matchId}`,
      {
        headers: getRealisticHeaders(),
        timeout: 10000
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Axios failed: ${error.message}`);
  }
};

// Función con Puppeteer (solo para Render)
const fetchWithPuppeteer = async (matchId) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Configurar headers
    await page.setExtraHTTPHeaders(getRealisticHeaders());

    const apiUrl = `https://api.betmines.com/betmines/v1/fixtures/${matchId}`;
    
    await page.goto(apiUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Obtener el contenido JSON
    const content = await page.content();
    const jsonText = await page.evaluate(() => {
      return document.body.textContent;
    });

    return JSON.parse(jsonText);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const detalle = async (id) => {
  const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");
  const matchId = decodeId(id);
  const cacheKey = `detalle:${matchId}`;
  
  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) {
    console.log(`✅ Cache hit para detalle: ${matchId}`);
    return desdeCache;
  }

  console.log(`🌐 Fetching detalle desde ${IS_RENDER ? 'Puppeteer' : 'Axios'}: ${matchId}`);
  
  try {
    let data;
    
    if (IS_RENDER) {
      // Usar Puppeteer en Render
      data = await fetchWithPuppeteer(matchId);
    } else {
      // Usar Axios en local
      data = await fetchWithAxios(matchId);
    }
    
    await saveCache(cacheKey, data, 600);
    console.log(`✅ Detalle guardado en cache: ${matchId}`);
    return data;
    
  } catch (error) {
    console.error('❌ Error descargando detalle:', {
      matchId,
      environment: IS_RENDER ? 'Render' : 'Local',
      error: error.message
    });
    
    // Fallback a mock data o cache antiguo
    const fallbackCache = await loadCache(cacheKey, true);
    if (fallbackCache) {
      console.log(`🔄 Usando cache fallback para: ${matchId}`);
      return fallbackCache;
    }
    
    return { 
      error: 'No se pudo obtener los datos',
      matchId: matchId,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = { detalle };