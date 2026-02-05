require('dotenv').config();
const moment = require('moment-timezone');
const axios = require('axios');
const { createClient } = require('@redis/client');
const { encodeId } = require('./encodeId');

const redisClient = createClient({ url: process.env.REDIS_URL });

function getTodayRangeUTC() {
  const nowBogota = moment().tz('America/Bogota');
  
  const today = nowBogota.format('DD');
  const tomorrow = nowBogota.add(1, 'day').format('DD');
  
  const yyyy = nowBogota.format('YYYY');
  const mm = nowBogota.format('MM');
  
  const from = `${yyyy}-${mm}-${today}T05:00:00Z`; 
  const to = `${yyyy}-${mm}-${tomorrow}T05:00:00Z`; 

  return { from, to, today, tomorrow };
}

function copTime(utcDateTime) {
  const date = new Date(utcDateTime);
  return date.toLocaleTimeString('es-CO', { 
    timeZone: 'America/Bogota',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

// FUNCIÓN MEJORADA CON PROXY GRATUITO
async function fetchWithProxy(url) {
  const proxies = [
    'https://api.allorigins.win/raw?url=',  // Proxy 1
    'https://corsproxy.io/?',                // Proxy 2
    'https://thingproxy.freeboard.io/fetch/', // Proxy 3
    'https://proxy.cors.sh/'                 // Proxy 4 (necesita headers)
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-US,es;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://betmines.com/',
    'Origin': 'https://betmines.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Priority': 'u=0, i'
  };

  // Intentar con cada proxy
  for (const proxy of proxies) {
    try {
      console.log(`Intentando con proxy: ${proxy}`);
      
      let proxyUrl;
      if (proxy.includes('corsproxy.io')) {
        proxyUrl = `${proxy}${encodeURIComponent(url)}`;
      } else if (proxy.includes('cors.sh')) {
        proxyUrl = proxy + url;
        headers['x-cors-api-key'] = 'temp_09a2b4c6d8e0f1a3b5c7d9e1f'; // Clave temporal
      } else {
        proxyUrl = proxy + encodeURIComponent(url);
      }
      
      const response = await axios.get(proxyUrl, {
        headers,
        timeout: 15000
      });
      
      console.log(`✓ Proxy exitoso: ${proxy}`);
      return response.data;
      
    } catch (error) {
      console.log(`✗ Proxy falló (${proxy}): ${error.message}`);
      continue;
    }
  }
  
  throw new Error('Todos los proxies fallaron');
}

// ALTERNATIVA: Usar fetch nativo con headers específicos
async function fetchDirectWithHeaders(url) {
  const headers = {
    'authority': 'api.betmines.com',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'es-US,es;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'referer': 'https://betmines.com/',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    const response = await axios.get(url, { headers, timeout: 20000 });
    return response.data;
  } catch (error) {
    console.log('Direct fetch falló:', error.message);
    throw error;
  }
}

async function main() {
  try {
    const { from, to } = getTodayRangeUTC();
    const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");

    await redisClient.connect();

    const targetUrl = `https://api.betmines.com/betmines/v1/fixtures/web?dateFormat=extended&platform=website&from=${from}&to=${to}`;
    
    console.log(`🔗 URL objetivo: ${targetUrl}`);
    console.log(`📅 Rango: ${from} a ${to}`);

    let fixtures;
    
    // ESTRATEGIA 1: Intentar con proxy primero
    try {
      fixtures = await fetchWithProxy(targetUrl);
      console.log('✅ Datos obtenidos via proxy');
    } catch (proxyError) {
      console.log('Proxy falló, intentando directo...');
      
      // ESTRATEGIA 2: Intentar directo con headers
      try {
        fixtures = await fetchDirectWithHeaders(targetUrl);
        console.log('✅ Datos obtenidos via direct fetch');
      } catch (directError) {
        console.log('Direct fetch falló, intentando última opción...');
        
        // ESTRATEGIA 3: Usar scraperapi si existe la key
        if (process.env.SCRAPER_API_KEY) {
          const scraperUrl = `https://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&render=true&country_code=us&url=${encodeURIComponent(targetUrl)}`;
          const response = await axios.get(scraperUrl, {
            headers: { Accept: "application/json" }
          });
          fixtures = response.data;
          console.log('✅ Datos obtenidos via ScraperAPI');
        } else {
          throw new Error('No hay API key de ScraperAPI configurada');
        }
      }
    }

    // Validar que fixtures sea un array
    if (!Array.isArray(fixtures)) {
      console.log('⚠️  La respuesta no es un array:', typeof fixtures);
      
      // Intentar extraer array si está dentro de objeto
      if (fixtures && typeof fixtures === 'object') {
        // Buscar cualquier propiedad que sea array
        const arrayKeys = Object.keys(fixtures).filter(key => Array.isArray(fixtures[key]));
        
        if (arrayKeys.length > 0) {
          console.log(`Encontrado array en propiedad: ${arrayKeys[0]}`);
          fixtures = fixtures[arrayKeys[0]];
        } else {
          // Guardar respuesta para debugging
          const debugFile = `debug_fixtures_${Date.now()}.json`;
          require('fs').writeFileSync(debugFile, JSON.stringify(fixtures, null, 2));
          console.log(`Respuesta guardada en: ${debugFile}`);
          throw new Error('La respuesta no contiene un array de fixtures');
        }
      }
    }

    console.log(`📊 Total fixtures recibidos: ${fixtures.length}`);

    const partidosFiltrados = fixtures.filter(
      (f) => f.predictionOddValue && parseFloat(f.predictionOddValue) >= 1.16
    );

    console.log(`🎯 Partidos filtrados (odd >= 1.16): ${partidosFiltrados.length}`);

    const partidos = partidosFiltrados.map((f) => ({
      apiId: encodeId(f.id),
      dateTime: copTime(f.dateTime),
      local: {
        nombre: f.localTeam?.name || 'Desconocido',
        logo: f.localTeam?.logoPath || null,
        golesLocal: `${f.localTeamScore || "0"}`,
      },
      visitante: {
        nombre: f.visitorTeam?.name || 'Desconocido',
        logo: f.visitorTeam?.logoPath || null,
        golesVisitante: `${f.visitorTeamScore || "0"}`,
      },
      estado: f.timeStatus || 'No iniciado',
      destacado: {
        pr: f.prediction || null,
        odd: f.predictionOddValue || null,
      },
      cuotas: {
        "1": f.fixtureOdd?.odd1 || null,
        X: f.fixtureOdd?.oddx || null,
        "2": f.fixtureOdd?.odd2 || null,
        "1X": f.fixtureOdd?.odd1x || null,
        X2: f.fixtureOdd?.oddx2 || null,
        "12": f.fixtureOdd?.odd12 || null,
        GG: f.fixtureOdd?.oddGoal || null,
        NG: f.fixtureOdd?.oddNoGoal || null,
        O05HT: f.fixtureOdd?.oddOver05HT || null,
        U05HT: f.fixtureOdd?.oddUnder05HT || null,
        O15: f.fixtureOdd?.oddOver15 || null,
        U15: f.fixtureOdd?.oddUnder15 || null,
        O25: f.fixtureOdd?.oddOver25 || null,
        U25: f.fixtureOdd?.oddUnder25 || null,
        O35: f.fixtureOdd?.oddOver35 || null,
        U35: f.fixtureOdd?.oddUnder35 || null,
      },
      resultados: {
        "1": f.fixtureOddResult?.odd1Winning ?? null,
        X: f.fixtureOddResult?.oddxWinning ?? null,
        "2": f.fixtureOddResult?.odd2Winning ?? null,
        "1X": f.fixtureOddResult?.odd1xWinning ?? null,
        X2: f.fixtureOddResult?.oddx2Winning ?? null,
        "12": f.fixtureOddResult?.odd12Winning ?? null,
        GG: f.fixtureOddResult?.oddGoalWinning ?? null,
        NG: f.fixtureOddResult?.oddNoGoalWinning ?? null,
        O05HT: f.fixtureOddResult?.oddOver05HTWinning ?? null,
        U05HT: f.fixtureOddResult?.oddUnder05HTWinning ?? null,
        O15: f.fixtureOddResult?.oddOver15Winning ?? null,
        U15: f.fixtureOddResult?.oddUnder15Winning ?? null,
        O25: f.fixtureOddResult?.oddOver25Winning ?? null,
        U25: f.fixtureOddResult?.oddUnder25Winning ?? null,
        O35: f.fixtureOddResult?.oddOver35Winning ?? null,
        U35: f.fixtureOddResult?.oddUnder35Winning ?? null,
      },
      probabilidades: {
        "1": f.probability?.home ?? null,
        X: f.probability?.draw ?? null,
        "2": f.probability?.away ?? null,
        "1X": f.probability?.home_draw ?? null,
        X2: f.probability?.draw_away ?? null,
        "12": f.probability?.home_away ?? null,
        GG: f.probability?.btts ?? null,
        NG: f.probability?.btts_no ?? null,
        O05HT: f.probability?.HT_over_0_5 ?? null,
        U05HT: f.probability?.HT_under_0_5 ?? null,
        O15: f.probability?.over_1_5 ?? null,
        U15: f.probability?.under_1_5 ?? null,
        O25: f.probability?.over_2_5 ?? null,
        U25: f.probability?.under_2_5 ?? null,
        O35: f.probability?.over_3_5 ?? null,
        U35: f.probability?.under_3_5 ?? null,
      }
    }));

    const redisKey = `partidosJSON:${fecha}`;
    await redisClient.setEx(redisKey, 3600, JSON.stringify(partidos));
    
    console.log(`✅ ${partidos.length} partidos guardados en Redis: ${redisKey}`);
    console.log('📋 Primer partido:', partidos[0] ? `${partidos[0].local.nombre} vs ${partidos[0].visitante.nombre}` : 'No hay partidos');
    
  } catch (err) {
    console.error("❌ Error general:", err.message);
    console.error("Stack:", err.stack);
  } finally {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
      console.log('🔌 Conexión Redis cerrada');
    }
  }
}

// Para ejecutar pruebas rápidas
async function testProxy() {
  try {
    const { from, to } = getTodayRangeUTC();
    const targetUrl = `https://api.betmines.com/betmines/v1/fixtures/web?dateFormat=extended&platform=website&from=${from}&to=${to}`;
    
    console.log('🧪 Probando proxies...');
    const data = await fetchWithProxy(targetUrl);
    
    console.log('✅ Proxy funcionó!');
    console.log('Tipo de respuesta:', typeof data);
    if (Array.isArray(data)) {
      console.log('Número de fixtures:', data.length);
      if (data.length > 0) {
        console.log('Primer fixture:', {
          id: data[0].id,
          local: data[0].localTeam?.name,
          visitante: data[0].visitorTeam?.name
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Test falló:', error.message);
    return null;
  }
}

// Exportar ambas funciones
module.exports = { 
  main,
  testProxy,
  fetchWithProxy 
};

// Si se ejecuta directamente
if (require.main === module) {
  main().catch(console.error);
}