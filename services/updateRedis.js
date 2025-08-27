require('dotenv').config();
const moment = require('moment-timezone');
const axios = require('axios');
const { createClient } = require('@redis/client');
const { encodeId } = require('./encodeId');

const redisClient = createClient({ url: process.env.REDIS_URL });
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

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


async function main() {
  try {
    const { from, to } = getTodayRangeUTC();
    const fecha = moment().tz("America/Bogota").format("YYYY-MM-DD");

    await redisClient.connect();

    const targetUrl = `https://api.betmines.com/betmines/v1/fixtures/web?dateFormat=extended&platform=website&from=${from}&to=${to}`;
    const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&render=true&country_code=us&url=${encodeURIComponent(targetUrl)}`;

    const response = await axios.get(scraperUrl, {
      timeout: 25000,
      headers: { Accept: "application/json" }
    });

    const fixtures = response.data;

    const partidosFiltrados = fixtures.filter(
      (f) => f.predictionOddValue && parseFloat(f.predictionOddValue) >= 1.16
    );

    const partidos = partidosFiltrados.map((f) => ({
      apiId: encodeId(f.id),
      dateTime: copTime(f.dateTime),
      local: {
        nombre: f.localTeam.name,
        logo: f.localTeam.logoPath,
        golesLocal: `${f.localTeamScore || "0"}`,
      },
      visitante: {
        nombre: f.visitorTeam.name,
        logo: f.visitorTeam.logoPath,
        golesVisitante: `${f.visitorTeamScore || "0"}`,
      },
      estado: f.timeStatus,
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
    await redisClient.disconnect();

    console.log(`✅ Partidos guardados en Redis: ${redisKey}`);
  } catch (err) {
    console.error("❌ Error general:", err.message);
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
  }
}

module.exports = { main };