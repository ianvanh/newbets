const moment = require('moment-timezone');
const axios = require('axios');
const { saveCache, loadCache } = require('./redisLoad');
const { decodeId } = require('./encodeId');

// Lista de User-Agents realistas
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Función para obtener headers más realistas
const getRealisticHeaders = () => {
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    return {
        'User-Agent': randomUserAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.betmines.com',
        'Referer': 'https://www.betmines.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
    };
};

const detalle = async (id) => {
    const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");
    const matchId = decodeId(id);
    const cacheKey = `detalle:${matchId}`;
    
    // Intentar cargar desde cache primero
    const desdeCache = await loadCache(cacheKey);
    if (desdeCache) {
        console.log(`✅ Cache hit para detalle: ${matchId}`);
        return desdeCache;
    }
    
    try {
        console.log(`🌐 Fetching detalle desde API: ${matchId}`);
        
        const response = await axios.get(
            `https://api.betmines.com/betmines/v1/fixtures/${matchId}`, 
            {
                headers: getRealisticHeaders(),
                timeout: 10000, // 10 segundos timeout
                // Opcional: usar proxy si es necesario
                // proxy: {
                //     protocol: 'http',
                //     host: 'tu-proxy.com',
                //     port: 8080
                // }
            }
        );
        
        const data = response.data;
        
        // Guardar en cache con expiración
        await saveCache(cacheKey, data, 600); // 10 minutos
        console.log(`✅ Detalle guardado en cache: ${matchId}`);
        
        return data;
        
    } catch (error) {
        console.error('❌ Error descargando detalle del partido:', {
            matchId: matchId,
            status: error.response?.status,
            message: error.message,
            url: error.config?.url
        });
        
        // Intentar fallback a cache antiguo si existe
        const fallbackCache = await loadCache(cacheKey, true); // Buscar cualquier cache
        if (fallbackCache) {
            console.log(`🔄 Usando cache fallback para: ${matchId}`);
            return fallbackCache;
        }
        
        return { error: 'No se pudo obtener los datos del partido' };
    }
}

module.exports = { detalle, getRealisticHeaders };