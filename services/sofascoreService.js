const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const { loadData, saveData } = require('./data');

const API_BASE = 'https://api.sofascore.com/api/v1';
const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://www.sofascore.com/'
};

function getWeekKey() {
  return moment().tz('America/Bogota').format('GGGG-[W]WW');
}
function getTodayDate() {
  return moment().tz('America/Bogota').format('MM-DD');
}

async function getMatchData(eventId) {
  try {
    const matchResponse = await axios.get(`${API_BASE}/event/${eventId}`, { headers });
    const event = matchResponse.data.event;

    return {
      matchName: `${event.homeTeam.name} vs ${event.awayTeam.name}`,
      homeTeam: {
        id: event.homeTeam.id,
        name: event.homeTeam.name,
        logoUrl: `/api/team-logo/${event.homeTeam.id}`
      },
      awayTeam: {
        id: event.awayTeam.id,
        name: event.awayTeam.name,
        logoUrl: `/api/team-logo/${event.awayTeam.id}`
      },
      status: event.status?.type
    };
  } catch (error) {
    console.error('Error fetching match data:', error);
    throw error;
  }
}

async function getHalfTimeScores(flashscoreId) {
  const url = `https://www.flashscore.mobi/match/${flashscoreId}`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.flashscore.mobi/'
    }
  });

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

async function updateResult() {
  const storedData = await loadData();
  const weekKey = getWeekKey();
  const dayKey = getTodayDate();

  if (!storedData[weekKey] || !storedData[weekKey][dayKey]) {
    return;
  }

  const weekMatches = storedData[weekKey][dayKey].matches || [];
  const optionalMatch = storedData[weekKey][dayKey].optional;
  
  let modified = false;

  for (let match of weekMatches) {
    const matchResponse = await axios.get(`${API_BASE}/event/${match.eventId}`, { headers });
    const event = matchResponse.data.event;

    if (event.status.type === "finished" && !match.finished) {
      match.finished = true;

      const { firstHalf, secondHalf } = await getHalfTimeScores(match.eventIdFl);

      if (firstHalf && secondHalf) {
        const [fhHome, fhAway] = firstHalf.split(':').map(Number);
        const [shHome, shAway] = secondHalf.split(':').map(Number);

        const totalHome = fhHome + shHome;
        const totalAway = fhAway + shAway;

        match.winner = 'X';
        if (totalHome > totalAway) match.winner = '1';
        else if (totalAway > totalHome) match.winner = '2';

        match.score = `${totalHome}-${totalAway}`;
        modified = true;
      }
    }
  }

  if (optionalMatch && !optionalMatch.finished) {
    const matchResponse = await axios.get(`${API_BASE}/event/${optionalMatch.eventId}`, { headers });
    const event = matchResponse.data.event;

    if (event.status.type === "finished") {
      optionalMatch.finished = true;

      const { firstHalf, secondHalf } = await getHalfTimeScores(optionalMatch.eventIdFl);

      if (firstHalf && secondHalf) {
        const [fhHome, fhAway] = firstHalf.split(':').map(Number);
        const [shHome, shAway] = secondHalf.split(':').map(Number);

        const totalHome = fhHome + shHome;
        const totalAway = fhAway + shAway;
        const totalFh = fhHome + fhAway;

        optionalMatch.winner = 'X';
        if (totalHome > totalAway) optionalMatch.winner = '1';
        else if (totalAway > totalHome) optionalMatch.winner = '2';

        optionalMatch.score = `${totalHome}-${totalAway}`;
        optionalMatch.firstHalf = totalFh;

        const optionType = Object.keys(optionalMatch.options)[0]; // "over" o "under"
        const option = optionalMatch.options[optionType];
        
        if (optionType === "over") {
          optionalMatch.result = totalFh > 0.5 ? "Ganada" : "Perdida";
        } else if (optionType === "under") {
          optionalMatch.result = totalFh < 1.5 ? "Ganada" : "Perdida";
        }

        modified = true;
      }
    }
  }

  if (modified) {
    await saveData(storedData);
  }
}

function generarCombinaciones(partidos, apuestaOpcional) {
  const resultados = ['1', 'X', '2'];
  const combinaciones = [];

  const datosPartidos = partidos.map((partido, index) => ({
    index: index + 1,
    local: partido.homeTeam?.name,
    visitante: partido.awayTeam?.name,
    cuotaLocal: parseFloat(partido.odds?.["1"]) || 1,
    cuotaEmpate: parseFloat(partido.odds?.["X"]) || 1,
    cuotaVisitante: parseFloat(partido.odds?.["2"]) || 1,
    resultadoFinal: partido.winner || null,
    finished: partido.finished,
    equipos: `${partido.homeTeam?.name} vs ${partido.awayTeam?.name}`
  }));

  const cuotaOpcional = apuestaOpcional?.options 
    ? parseFloat(Object.values(apuestaOpcional.options)[0]?.odd) || 1 
    : 1;
  const nombreOpcional = apuestaOpcional?.options 
    ? Object.values(apuestaOpcional.options)[0]?.name 
    : null;

  for (const r1 of resultados) {
    for (const r2 of resultados) {
      for (const r3 of resultados) {
        const combinacion = [r1, r2, r3];
        let cuota = 1;
        let esGanadora = true;
        let todosFinalizados = true;

        combinacion.forEach((res, i) => {
          const partido = datosPartidos[i];
          const cuotaPartido = partido[`cuota${res === '1' ? 'Local' : res === 'X' ? 'Empate' : 'Visitante'}`];
          cuota *= cuotaPartido;
          
          if (partido.finished) {
            if (partido.resultadoFinal && res !== partido.resultadoFinal) {
              esGanadora = false;
            }
          } else {
            todosFinalizados = false;
            esGanadora = false;
          }
        });
        
        if (apuestaOpcional) {
          cuota *= cuotaOpcional;
        }
        
        combinaciones.push({
          combinacion: combinacion.join(''),
          cuota: cuota.toFixed(2),
          esGanadora: esGanadora && todosFinalizados,
          descripcion: datosPartidos.map((p, i) => 
            `Partido ${p.index}: ${combinacion[i]} (${p[`cuota${combinacion[i] === '1' ? 'Local' : combinacion[i] === 'X' ? 'Empate' : 'Visitante'}`].toFixed(2)})`
          ),
          descripcionOpcional: nombreOpcional 
            ? `Extra: ${nombreOpcional} (${cuotaOpcional.toFixed(2)})` 
            : null
        });
      }
    }
  }

  return {
    partidos: datosPartidos,
    combinaciones,
    todosFinalizados: datosPartidos.every(p => p.finished),
    tieneOpcional: !!apuestaOpcional
  };
}

function generarResumenSemanal(semanaData) {
  const todosLosPartidos = [];
  
  Object.values(semanaData).forEach(dia => {
    if (dia.matches && Array.isArray(dia.matches)) {
      todosLosPartidos.push(...dia.matches);
    }
  });
  
  const resumen = {
    totalPartidos: todosLosPartidos.length,
    partidosFinalizados: todosLosPartidos.filter(p => p.finished).length,
    cuotaPromedioGanadora: 0,
    porcentajeAciertos: {
      "1": 0,
      "X": 0,
      "2": 0
    },
    rendimiento: 0,
    optional: {
      total: 0,
      aciertos: 0,
      porcentajeAciertos: 0
    }
  };
  
  const partidosFinalizados = todosLosPartidos.filter(p => p.finished && p.odds);
  if (partidosFinalizados.length > 0) {
    const sumaCuotas = partidosFinalizados.reduce((sum, partido) => {
      return sum + parseFloat(partido.odds[partido.winner]);
    }, 0);
    resumen.cuotaPromedioGanadora = (sumaCuotas / partidosFinalizados.length).toFixed(2);
    
    const counts = partidosFinalizados.reduce((acc, partido) => {
      acc[partido.winner] = (acc[partido.winner] || 0) + 1;
      return acc;
    }, { "1": 0, "X": 0, "2": 0 });
    
    Object.keys(counts).forEach(key => {
      resumen.porcentajeAciertos[key] = ((counts[key] / partidosFinalizados.length) * 100).toFixed(1);
    });
    
    resumen.rendimiento = (sumaCuotas / partidosFinalizados.length - 1).toFixed(2);
  }

  return resumen;
}

module.exports = {
  getWeekKey,
  getTodayDate,
  getMatchData,
  updateResult,
  generarCombinaciones,
  generarResumenSemanal
};