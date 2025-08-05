// updateResult.js
const fs = require('fs'); 
const path = require('path'); 
const axios = require('axios'); 
const cheerio = require('cheerio');
const moment = require('moment-timezone'); 

const API_BASE = 'https://api.sofascore.com/api/v1'; const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.sofascore.com/' };

const DATA_PATH = path.join(__dirname, '../data/principales.json');

function getWeekKey() { 
  const fecha = moment().tz('America/Bogota'); 
  return `${fecha.year()}-W${fecha.isoWeek().toString().padStart(2, '0')}`; 
}

function getTodayDate() { 
  return moment().tz('America/Bogota').format('MM-DD');
}

const verificarMercado = ({ tipo, golesLocal, golesVisitante }) => {
  golesLocal = Number(golesLocal);
  golesVisitante = Number(golesVisitante);
  const totalGoles = golesLocal + golesVisitante;

  switch (tipo) {
    case '1': return golesLocal > golesVisitante ? 'ganado' : 'perdido';
    case 'X': return golesLocal === golesVisitante ? 'ganado' : 'perdido';
    case '2': return golesVisitante > golesLocal ? 'ganado' : 'perdido';
    case '12': return golesLocal !== golesVisitante ? 'ganado' : 'perdido';
    case '1X': return golesLocal >= golesVisitante ? 'ganado' : 'perdido';
    case 'X2': return golesVisitante >= golesLocal ? 'ganado' : 'perdido';
    case 'GG': return golesLocal > 0 && golesVisitante > 0 ? 'ganado' : 'perdido';
    default: return 'pendiente';
  }
};

async function getHalfTimeScores(flashscoreId) {
  const url = `https://www.flashscore.mobi/match/${flashscoreId}`;
  const response = await axios.get(url, { headers }); 
  const $ = cheerio.load(response.data); 
  const scoreData = {};

  $('#detail-tab-content h4').each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes('1st Half')) {
      scoreData.firstHalf = $(el).find('b').text();
    }
    if (text.includes('2nd Half')) {
      scoreData.secondHalf = $(el).find('b').text();
    }
  });
  
  return scoreData;
}

async function updateResult2() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const semana = getWeekKey();
  const dia = getTodayDate();

  if (!data[semana] || !data[semana][dia]) return;

  let modified = false; 
  const matches = data[semana][dia].matches || [];

  for (const match of matches) {
    if (match.finalizado) continue;
  
    try {
      const res = await axios.get(`${API_BASE}/event/${match.eventId}`, { headers });
      const event = res.data.event;
    
      if (event.status.type === 'finished') {
        const { firstHalf, secondHalf } = await getHalfTimeScores(match.eventIdFl);
    
        if (firstHalf && secondHalf) {
          const [fhHome, fhAway] = firstHalf.split(':').map(Number);
          const [shHome, shAway] = secondHalf.split(':').map(Number);
    
          const totalHome = fhHome + shHome;
          const totalAway = fhAway + shAway;
    
          match.finalizado = true;
          match.golesLocal = `${totalHome}`;
          match.golesVisitante = `${totalAway}`;
    
          for (let mercado of match.mercados) {
            mercado.resultado = verificarMercado({
              tipo: mercado.tipo,
              golesLocal: totalHome,
              golesVisitante: totalAway
            });
          }
    
          modified = true;
        }
      }
    } catch (err) {
      console.error('Error actualizando partido:', err.message);
    }
  }

  if (modified) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  }
}

const redisClient = require('./redisClient');
const cachePronisticos = async () => {
  function getToday() { 
    return moment().tz('America/Bogota').format('YYYY-MM-DD');
  }
  const today = getToday();
  const GITHUB_URL = `https://raw.githubusercontent.com/ianvanh/NB_data/main/${today}.json`;
  const cacheKey = `partidosJSON:${today}`;

  try {
    const response = await axios.get(GITHUB_URL);
    const data = response.data;

    await redisClient.setEx(cacheKey, 60 * 60 * 24, JSON.stringify(data)); // cache por 24h
    console.log(`✅ Caché actualizada manualmente para ${today}`);
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando caché:`, error.message);
    return false;
  }
};

module.exports = { updateResult2, cachePronisticos }