const axios = require('axios');
const cheerio = require('cheerio');

// Función para obtener datos de SportyTrader
async function fetchPronosticosFromSportyTrader(page) {
  const response = await axios.get(`https://www.sportytrader.es/ajax/pronostics1x2/futbol/competition-0/${page}/`);
  const $ = cheerio.load(response.data);
  const matches = parseMatches($);
  
  return {
    matches,
    hasMore: matches.length === 10 // Asumiendo 10 partidos por página
  };
}

// Función para parsear los partidos
function parseMatches($) {
  const matches = [];
  
  $('#1x2wrap > div').each((index, element) => {
    const $match = $(element);
    
    // Verificar si es un partido válido
    if ($match.find('span.mx-1.flex.items-center').length >= 2) {
      // Extraer datos
      const hora = $match.find('span.text-xs.dark\\:text-white').first().text().trim();
      const liga = $match.find('p.py-0.my-0.text-sm.dark\\:text-white').text().trim();
      
      // Selección CORREGIDA de nombres de equipos
      const teamNames = $match.find('span.mx-1.flex.items-center:not(:has(img))');
      
      const equipos = {
        local: {
          nombre: $(teamNames[0]).text().trim(),
          logo: $match.find('img').first().attr('src') || '/images/team-default.png'
        },
        visitante: {
          nombre: $(teamNames[1]).text().trim(),
          logo: $match.find('img').last().attr('src') || '/images/team-default.png'
        }
      };
      
      // Determinar pronóstico seleccionado
      let pronostico = '';
      $match.find('span.flex.justify-center.items-center.h-7.w-6').each((i, el) => {
        if ($(el).hasClass('bg-primary-green')) {
          pronostico = i === 0 ? '1' : i === 1 ? 'X' : '2';
        }
      });
      
      // Extraer probabilidad
      const probabilidadText = $match.find('span.text-xs.mt-1.dark\\:text-white').text().trim();
      const probabilidad = parseInt(probabilidadText.replace(/\D/g, '')) || 0;
      
      matches.push({
        index: matches.length,
        hora,
        liga,
        equipos,
        pronostico,
        probabilidad,
        finished: false
      });
    }
  });
  
  return matches;
}

module.exports = {
  fetchPronosticosFromSportyTrader
}