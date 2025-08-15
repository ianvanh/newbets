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

function formatHour(input) {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(input)) {
    const date = new Date(input);
    return date.toLocaleTimeString('es-CO', { 
      timeZone: 'America/Bogota',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  let normalized = input
    .trim()
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .toLowerCase();

  if (normalized.includes(',')) {
    normalized = normalized.split(',').pop().trim();
  }

  if (/([ap])\s*m/.test(normalized)) {
    const parts = normalized.split(' ');
    const time = parts[0];
    const period = parts.slice(1).join('').replace(/\s+/g, '');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    let [hour, minute] = normalized.split(':').map(Number);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  throw new Error(`Formato no reconocido: "${input}"`);
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
      dateTime: formatHour(partido.dateTime),
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
        dateTime: formatHour(p.dateTime),
        mercadoDestacado: p.destacado.pr,
        cuotaDestacada: p.destacado.odd,
        resultadoDestacado: resultado
      };
    });
};

module.exports = { filtrarPartidosPorMercadosB, obtenerPartidosDestacados };