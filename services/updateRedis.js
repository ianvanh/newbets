require("dotenv").config();
const moment = require('moment-timezone');
const cron = require('node-cron');
const { createClient } = require('redis');
const { encodeId } = require('./encodeId');

const REDIS_URL = process.env.REDIS_URL;

function getTodayRangeUTC() {
  const now = moment().tz("America/Bogota");
  const todayStr = now.format("DD");
  const tomorrowStr = now.clone().add(1, 'day').format("DD");
  const yyyy = now.format("YYYY");
  const mm = now.format("MM");

  const from = `${yyyy}-${mm}-${todayStr}T05:00:00Z`;
  const to = `${yyyy}-${mm}-${tomorrowStr}T05:00:00Z`;

  return { from, to, fechaStr: now.format("YYYY-MM-DD") };
}

function copTime(utcDateTime) {
  return moment(utcDateTime).tz("America/Bogota").format("HH:mm");
}

async function scraper() {
  console.log(`\n🔄 [Scraper] Iniciando ejecución: ${new Date().toISOString()}`);
  let redisClient = null;

  try {
    const { gotScraping } = await import('got-scraping');
    
    const { from, to, fechaStr } = getTodayRangeUTC();
    
    const response = await gotScraping({
      url: "https://api.betmines.com/betmines/v1/fixtures/web",
      searchParams: { dateFormat: "extended", platform: "website", from, to },
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 120 }],
        devices: ['mobile'],
        operatingSystems: ['android'],
      },
      headers: { 'Origin': 'https://www.betmines.com', 'Referer': 'https://www.betmines.com/' },
      responseType: 'json',
      timeout: { request: 20000 }
    });

    const fixtures = response.body;
    
    const partidosFiltrados = fixtures.filter(
      (f) => f.predictionOddValue && parseFloat(f.predictionOddValue) >= 1.16
    );

    let existingData = [];
    if (REDIS_URL) {
      redisClient = createClient({ url: REDIS_URL });
      await redisClient.connect();
      
      const redisKey = `partidosJSON:${fechaStr}`;
      const cached = await redisClient.get(redisKey);
      if (cached) {
        existingData = JSON.parse(cached);
      }
      
      const partidos = partidosFiltrados.map((f) => {
        const found = existingData.find((p) => p.apiId === encodeId(f.id));
        
        if (found) {
          return {
            ...found,
            estado: f.timeStatus,
            local: {
              ...found.local,
              golesLocal: `${f.localTeamScore || found.local.golesLocal || "0"}`
            },
            visitante: {
              ...found.visitante,
              golesVisitante: `${f.visitorTeamScore || found.visitante.golesVisitante || "0"}`
            },
            resultados: {
              "1": f.fixtureOddResult?.odd1Winning ?? found.resultados?.["1"] ?? null,
              X: f.fixtureOddResult?.oddxWinning ?? found.resultados?.X ?? null,
              "2": f.fixtureOddResult?.odd2Winning ?? found.resultados?.["2"] ?? null,
              "1X": f.fixtureOddResult?.odd1xWinning ?? found.resultados?.["1X"] ?? null,
              X2: f.fixtureOddResult?.oddx2Winning ?? found.resultados?.X2 ?? null,
              "12": f.fixtureOddResult?.odd12Winning ?? found.resultados?.["12"] ?? null,
              GG: f.fixtureOddResult?.oddGoalWinning ?? found.resultados?.GG ?? null,
              NG: f.fixtureOddResult?.oddNoGoalWinning ?? found.resultados?.NG ?? null,
              O05HT: f.fixtureOddResult?.oddOver05HTWinning ?? found.resultados?.O05HT ?? null,
              U05HT: f.fixtureOddResult?.oddUnder05HTWinning ?? found.resultados?.U05HT ?? null,
              O15: f.fixtureOddResult?.oddOver15Winning ?? found.resultados?.O15 ?? null,
              U15: f.fixtureOddResult?.oddUnder15Winning ?? found.resultados?.U15 ?? null,
              O25: f.fixtureOddResult?.oddOver25Winning ?? found.resultados?.O25 ?? null,
              U25: f.fixtureOddResult?.oddUnder25Winning ?? found.resultados?.U25 ?? null,
              O35: f.fixtureOddResult?.oddOver35Winning ?? found.resultados?.O35 ?? null,
              U35: f.fixtureOddResult?.oddUnder35Winning ?? found.resultados?.U35 ?? null,
            }
          };
        }
        
        return {
          apiId: encodeId(f.id),
          dateTime: copTime(f.dateTime),
          fechaCompleta: f.dateTime,
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
          liga: f.leagueName || null,
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
        };
      });

      await redisClient.setEx(redisKey, 60 * 60 + 600, JSON.stringify(partidos));
      console.log(`✅ [Scraper] Guardado en Redis: ${redisKey}`);
      
      return { success: true, count: partidos.length, message: "Datos actualizados" };
    }

    return { success: false, message: "No se configuró Redis URL" };

  } catch (error) {
    console.error("❌ [Scraper] Error:", error.message);
    return { success: false, error: error.message };
  } finally {
    if (redisClient && redisClient.isOpen) {
      await redisClient.disconnect();
    }
  }
}

function iniciarCronJob() {
  cron.schedule('5 * * * *', async () => {
    console.log("⏰ [Cron] Ejecutando tarea programada...");
    await scraper();
  }, {
    timezone: "America/Bogota"
  });
  console.log("🕒 [Cron] Tarea programada: Minuto 5 de cada hora.");
}

module.exports = {
  scraper,
  iniciarCronJob
};

if (require.main === module) {
  scraper().catch(console.error);
}