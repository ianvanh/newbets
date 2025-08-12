const { saveCache, loadCache } = require('./redisLoad');
const axios = require('axios');
const moment = require('moment-timezone');

function todayDate(date = null) {
  return date
  ? moment(date).tz('America/Bogota').format('YYYY-MM-DD')
  : moment().tz('America/Bogota').format('YYYY-MM-DD');
}

const pronosticos = async (fecha = null) => {
  const today = todayDate(fecha);
  const cacheKey = `partidosJSON:${today}`;
  const GITHUB_URL = `https://raw.githubusercontent.com/ianvanh/NB_data/main/${today}.json`;

  // Buscar en cache
  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) return desdeCache;

  // Si no está en cache, descargar y guardar
  try {
    const response = await axios.get(GITHUB_URL);
    const data = response.data;
    await saveCache(cacheKey, data, 60 * 60 * 24); // 24h
    return data;
  } catch (err) {
    console.error('❌ Error descargando partidos:', err.message);
    return [];
  }
};
const principal = async () => {
  const cacheKey = 'principalesJSON:principales';
  const GITHUB_URL = `https://raw.githubusercontent.com/ianvanh/NB_data/main/principales.json`;

  // Buscar en cache
  const desdeCache = await loadCache(cacheKey);
  if (desdeCache) return desdeCache;

  // Si no está en cache, descargar y guardar
  try {
    const response = await axios.get(GITHUB_URL);
    const dataCompleta = response.data;
    // Obtener semana actual y pasada
    const semanaActual = moment().tz('America/Bogota').format('GGGG-[W]WW');
    const semanaPasada = moment().tz('America/Bogota').subtract(1, 'week').format('GGGG-[W]WW');
    // Filtrar solo esas semanas
    const dataFiltrada = {};
    [semanaActual, semanaPasada].forEach(sem => {
      if (dataCompleta[sem]) {
        dataFiltrada[sem] = dataCompleta[sem];
      }
    });

    // Guardar solo las 2 semanas en Redis por 7 días
    await saveCache(cacheKey, dataFiltrada, 60 * 60 * 24 * 7); // 7 días

    return dataFiltrada;
  } catch (err) {
    console.error('❌ Error descargando principales desde GitHub:', err.message);
    return {};
  }
};

module.exports = {
  todayDate,
  pronosticos,
  principal
}