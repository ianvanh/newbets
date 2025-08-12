const axios = require('axios');
const moment = require('moment-timezone');
const { pronosticos } = require('./leerMatchDay');

function getTodayDate() {
  return moment().tz('America/Bogota').format('YYYY-MM-DD');
}

function formatToColombiaTime(utcDateTime) {
  if (!utcDateTime) return '...';
  
  try {
    const date = new Date(utcDateTime);
    date.setHours(date.getHours() - 5); // Restamos 5 horas para UTC-5
    return date.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      hour12: true,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace("a. m.", "a.m.").replace("p. m.", "p.m.");
  } catch (e) {
    return 'Hora inválida';
  }
}

function convertHour12To24(hour12Str) {
  const normalized = hour12Str
    .trim() // Elimina espacios al inicio/final
    .replace(/[\u00A0\u202F]/g, ' ') // Reemplaza espacios especiales
    .replace(/\s+/g, ' ') // Reduce múltiples espacios a uno solo
    .replace(/\./g, '') // Elimina todos los puntos
    .toLowerCase()
    .replace(/^(\d{1,2}:\d{2})\s*([ap])[m]*$/, '$1 $2m'); // Patrón final

  const hour24 = moment(normalized, ['hh:mm a', 'h:mm a'], true);
  
  if (!hour24.isValid()) {
    const cleanInput = hour12Str.trim().replace(/\s+/g, ' ');
    throw new Error(`No se pudo convertir "${cleanInput}". Ejemplos válidos: "12:00 a.m.", "1:30 p.m.", "04:45 am"`);
  }

  return hour24.format('HH:mm');
}

const verificarMercado = (tipo, golesLocal, golesVisitante) => {
  golesLocal = Number(golesLocal);
  golesVisitante = Number(golesVisitante);
  const totalGoles = golesLocal + golesVisitante;

  switch (tipo) {
    /*
    case '1': return golesLocal > golesVisitante ? 'ganado' : 'perdido';
    case 'X': return golesLocal === golesVisitante ? 'ganado' : 'perdido';
    case '2': return golesVisitante > golesLocal ? 'ganado' : 'perdido';
    case 'GG': return golesLocal > 0 && golesVisitante > 0 ? 'ganado' : 'perdido';
    case 'NG': return golesLocal === 0 || golesVisitante === 0 ? 'ganado' : 'perdido';
    ----------*/
    case '1X': return golesLocal >= golesVisitante ? 'ganado' : 'perdido';
    case 'X2': return golesVisitante >= golesLocal ? 'ganado' : 'perdido';
    case '12': return golesLocal !== golesVisitante ? 'ganado' : 'perdido';
    case 'O15': return totalGoles > 1.5 ? 'ganado' : 'perdido';
    case 'O25': return totalGoles > 2.5 ? 'ganado' : 'perdido';
    case 'O35': return totalGoles > 3.5 ? 'ganado' : 'perdido';
    case 'U25': return totalGoles < 2.5 ? 'ganado' : 'perdido';
    case 'U35': return totalGoles < 3.5 ? 'ganado' : 'perdido';
    default: return 'pendiente';
  }
};

const filtrarPartidosPorMercadosB = async (fecha, mercadosDeseados = []) => {
  const partidosDelDia = await pronosticos(fecha);
  const mapaProbabilidades = {
    "D": "D", "1": "1", "X": "X", "2": "2", "1X": "1X",
    "X2": "X2", "12": "12", "GG": "GG", "NG": "NG", "O15": "O15",
    "U15": "U15", "O25": "O25", "U25": "U25", "O35": "O35", "U35": "U35"
  };

  const partidosFiltrados = partidosDelDia.map(partido => {
    let mercadoElegido = null;
    let mejorProbabilidad = -1;

    mercadosDeseados.forEach(mercado => {
      const clave = mapaProbabilidades[mercado];
      const prob = partido.probabilidades?.[clave];
      if (typeof prob === 'number' && prob > mejorProbabilidad) {
        mejorProbabilidad = prob;
        mercadoElegido = mercado;
      }
    });

    if (!mercadoElegido || !partido.cuotas?.[mercadoElegido]) return null;

    const cuotasFiltradas = { [mercadoElegido]: partido.cuotas[mercadoElegido] };
    const resultadosFiltrados = {};

    const estadosFinalizados = ['FT', 'AET', 'FT_PEN'];

    if (!estadosFinalizados.includes(partido.estado)) {
      resultadosFiltrados[mercadoElegido] = 'pendiente';
    } else if (typeof partido.resultados?.[mercadoElegido] !== 'undefined') {
      resultadosFiltrados[mercadoElegido] = partido.resultados[mercadoElegido] ? 'ganado' : 'perdido';
    } else if (mercadoElegido.startsWith('O') || mercadoElegido.startsWith('U')) {
      const totalGoles = Number(partido.local.golesLocal) + Number(partido.visitante.golesVisitante);
      const linea = parseFloat(mercadoElegido.substring(1));
      resultadosFiltrados[mercadoElegido] = mercadoElegido.startsWith('O') 
        ? totalGoles > linea ? 'ganado' : 'perdido'
        : totalGoles < linea ? 'ganado' : 'perdido';
    } else {
      resultadosFiltrados[mercadoElegido] = 'pendiente';
    }

    return {
      ...partido,
      dateTime: convertHour12To24(partido.dateTime.split(',')[1].replace("a. m.", "a.m.").replace("p. m.", "p.m.")),
      cuotas: cuotasFiltradas,
      resultados: resultadosFiltrados,
      mercadoUsado: mercadoElegido,
      probabilidad: mejorProbabilidad
    };
  });

  return partidosFiltrados.filter(Boolean);
};

const obtenerPartidosDestacados = async (fecha) => {
  const partidosDelDia = await pronosticos(fecha);
  const estadosFinalizados = ['FT', 'AET', 'FT_PEN'];
  
  return partidosDelDia
    .filter(p => p.destacado?.pr && p.destacado?.odd)
    .map(p => {
      let resultado = 'pendiente';

      if (estadosFinalizados.includes(p.estado)) {
        if (typeof p.resultados?.[p.destacado.pr] !== 'undefined') {
          resultado = p.resultados[p.destacado.pr] ? 'ganado' : 'perdido';
        }
      }

      return {
        ...p,
        dateTime: convertHour12To24(p.dateTime.split(',')[1].replace("a. m.", "a.m.").replace("p. m.", "p.m.")),
        mercadoDestacado: p.destacado.pr,
        cuotaDestacada: p.destacado.odd,
        resultadoDestacado: resultado
      };
    });
};

module.exports = { filtrarPartidosPorMercadosB, obtenerPartidosDestacados };