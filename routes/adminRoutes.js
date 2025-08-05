// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios');

const DATA_PATH = path.join(__dirname, '../data/principales.json');

const API_BASE = 'https://api.sofascore.com/api/v1';
const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://www.sofascore.com/'
};

function getWeekKey() {
  const fecha = moment().tz('America/Bogota');
  return `${fecha.year()}-W${fecha.isoWeek().toString().padStart(2, '0')}`;
}

function getTodayDate() {
  return moment().tz('America/Bogota').format('MM-DD');
}

router.post('/add-matches', async (req, res) => {
  const { partidos } = req.body;
  if (!partidos) return res.status(400).send('No se recibieron partidos.');

  let data = {};
  if (fs.existsSync(DATA_PATH)) {
    data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  }

  const semana = getWeekKey();

  for (const p of partidos) {
    try {
      const matchResponse = await axios.get(`${API_BASE}/event/${p.eventId}`, { headers });
      const event = matchResponse.data.event;

      const match = {
        eventId: p.eventId,
        eventIdFl: p.eventIdFl,
        local: event.homeTeam.name,
        visitante: event.awayTeam.name,
        logoLocal: `/api/team-logo/${event.homeTeam.id}`,
        logoVisitante: `/api/team-logo/${event.awayTeam.id}`,
        finalizado: false,
        golesLocal: null,
        golesVisitante: null,
        mercados: []
      };

      for (const tipo in p.mercados) {
        if (p.mercados[tipo].activo && p.mercados[tipo].cuota) {
          match.mercados.push({
            tipo,
            cuota: p.mercados[tipo].cuota
          });
        }
      }

      if (!data[semana]) data[semana] = {};
      if (!data[semana][p.fecha]) data[semana][p.fecha] = { matches: [] };

      data[semana][p.fecha].matches.push(match);
    } catch (err) {
      console.error(`Error al agregar partido ${p.eventId}:`, err.message);
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  res.redirect('/admin2');
});

module.exports = router;