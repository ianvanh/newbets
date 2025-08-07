const fs = require('fs');
const path = require('path');
const imageService = require('../services/imageService');
const {
  getMatchData,
  updateResult,
  getWeekKey,
  getTodayDate
} = require('../services/sofascoreService');
const { loadData } = require('../services/data');
const { fetchPronosticosFromSportyTrader } = require('../services/sportyTrader');

exports.previewMatch = async (req, res) => {
  try {
    const eventId = req.query.id;
    if (!eventId) return res.status(400).json({ error: 'ID requerido' });

    const matchData = await getMatchData(eventId);
    res.json(matchData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.checkMatch = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const matchData = await getMatchData(eventId);
    res.json(matchData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveMatches = async (req, res) => {
  try {
    const matches = [];

    for (let i = 1; i <= 3; i++) {
      if (req.body[`match${i}-id`] && req.body[`match${i}-id-fl`]) {
        matches.push({
          homeTeam: {
            id: req.body[`match${i}-home-id`],
            name: req.body[`match${i}-home`],
            logoUrl: `/api/team-logo/${req.body[`match${i}-home-id`]}`
          },
          awayTeam: {
            id: req.body[`match${i}-away-id`],
            name: req.body[`match${i}-away`],
            logoUrl: `/api/team-logo/${req.body[`match${i}-away-id`]}`
          },
          odds: {
            "1": req.body[`match${i}-1`],
            "X": req.body[`match${i}-X`],
            "2": req.body[`match${i}-2`]
          },
          eventId: req.body[`match${i}-id`],
          eventIdFl: req.body[`match${i}-id-fl`],
          finished: false
        });
      }
    }

    const weekKey = getWeekKey();
    const dayKey = getTodayDate();
    const betsDataPath = path.join(__dirname, '../data/bets.json');

    let betsData = {};
    if (fs.existsSync(betsDataPath)) {
      betsData = JSON.parse(fs.readFileSync(betsDataPath));
    }

    if (!betsData[weekKey]) betsData[weekKey] = {};
    betsData[weekKey][dayKey] = { matches };

    if (req.body['optional-id'] && req.body['optional-id-fl']) {
      const options = {};

      if (req.body['enable-over'] === '1' && req.body['over-odd']) {
        options['over'] = {
          name: '+0.5 goles',
          odd: req.body['over-odd']
        };
      }

      if (req.body['enable-under'] === '1' && req.body['under-odd']) {
        options['under'] = {
          name: '-1.5 goles',
          odd: req.body['under-odd']
        };
      }

      if (Object.keys(options).length > 0) {
        betsData[weekKey][dayKey].optional = {
          homeTeam: {
            id: req.body['optional-home-id'],
            name: req.body['optional-home'],
            logoUrl: `/api/team-logo/${req.body['optional-home-id']}`
          },
          awayTeam: {
            id: req.body['optional-away-id'],
            name: req.body['optional-away'],
            logoUrl: `/api/team-logo/${req.body['optional-away-id']}`
          },
          eventId: req.body['optional-id'],
          eventIdFl: req.body['optional-id-fl'],
          options: options,
          finished: false,
          result: 'Pendiente'
        };
      }
    }

    fs.writeFileSync(betsDataPath, JSON.stringify(betsData, null, 2));
    res.redirect('/admin?success=true');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al guardar los partidos');
  }
};

exports.getTeamLogo = async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const logoPath = path.join(__dirname, '../public/team-logos', `${teamId}.png`);
    
    if (fs.existsSync(logoPath)) {
      return res.sendFile(logoPath);
    }
    
    // Si no existe, obtener de la API
    const logoData = await imageService.downloadTeamLogo(teamId);
    if (logoData) {
      fs.writeFileSync(logoPath, logoData);
      res.set('Content-Type', 'image/png');
      return res.send(logoData);
    }
    
    res.sendFile(path.join(__dirname, `../public/images/${teamId}.png`));
  } catch (error) {
    res.sendFile(path.join(__dirname, '../public/images/default.png'));
  }
};

exports.result = async (req, res) => {
  try {
    const jsonData = await loadData();
    
    if (req.query.format === 'true') {
      res.set('Content-Type', 'application/json');
      res.send(JSON.stringify(jsonData, null, 2));
    } else {
      res.json(jsonData);
    }
  } catch (error) {
    console.error('Error en /result:', error);
    res.status(500).json({ error: "Error al cargar los datos" });
  }
};

exports.update = async (req, res) => {
  try {
    await updateResult();
    res.json({ success: true, message: 'Resultados actualizados correctamente' });
  } catch (error) {
    console.error('Error al actualizar resultados:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar los resultados' });
  }
}
const { updateResult2, cachePronosticos, cachePrincipales } = require('../services/updateResults');
exports.update2 = async (req, res) => {
  try {
    await updateResult2();
    res.json({ success: true, message: 'Resultados actualizados correctamente' });
  } catch (error) {
    console.error('Error al actualizar resultados:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar los resultados' });
  }
}

exports.updateCache = async (req, res) => {
  const token = req.query.token;
  if (token !== process.env.SECRET) {
    return res.status(403).json({ ok: false, msg: 'No autorizado' });
  }
  try {
    await cachePronosticos();
    res.json({ success: true, message: 'Cache actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar resultados:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar los resultados' });
  }
}
exports.updateCache2 = async (req, res) => {
  const token = req.query.token;
  if (token !== process.env.SECRET) {
    return res.status(403).json({ ok: false, msg: 'No autorizado' });
  }
  try {
    await cachePrincipales();
    res.json({ success: true, message: 'Cache actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar resultados:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar los resultados' });
  }
}

exports.getPronosticosData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { matches, hasMore } = await fetchPronosticosFromSportyTrader(page);
    
    res.json({
      success: true,
      html: generateMatchesHTML(matches),
      currentPage: page,
      hasMore
    });
  } catch (error) {
    console.error('Error al obtener datos de pronósticos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al cargar más partidos' 
    });
  }
};

function generateMatchesHTML(matches) {
  return matches.map((match, displayIndex) => `
    <div class="bg-gray-800 rounded-lg p-4 shadow mb-4">
      <div class="flex justify-between items-center mb-3">
        <span class="text-gray-400 text-sm">Partido ${displayIndex + 1}</span>
        <span class="text-gray-400 text-sm">${match.hora}</span>
      </div>
      
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <img src="${match.equipos.local.logo}" alt="${match.equipos.local.nombre}" 
               class="w-8 h-8 rounded-full bg-white p-0.5 border border-gray-300">
          <span class="text-white font-medium">${match.equipos.local.nombre}</span>
        </div>
        
        <div class="text-white font-bold mx-2">vs</div>
        
        <div class="flex items-center space-x-2">
          <span class="text-white font-medium">${match.equipos.visitante.nombre}</span>
          <img src="${match.equipos.visitante.logo}" alt="${match.equipos.visitante.nombre}" 
               class="w-8 h-8 rounded-full bg-white p-0.5 border border-gray-300">
        </div>
      </div>
      
      <div class="flex justify-between items-center">
        <div class="flex space-x-2">
          <span class="w-8 h-8 flex items-center justify-center rounded font-bold 
                  ${match.pronostico === '1' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}">
            1
          </span>
          <span class="w-8 h-8 flex items-center justify-center rounded font-bold 
                  ${match.pronostico === 'X' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}">
            X
          </span>
          <span class="w-8 h-8 flex items-center justify-center rounded font-bold 
                  ${match.pronostico === '2' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}">
            2
          </span>
        </div>
        
        <span class="${match.probabilidad > 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'} 
              text-xs font-bold px-3 py-1 rounded-full">
          Probabilidad: ${match.probabilidad}%
        </span>
      </div>
      
      <div class="mt-3 text-right">
        <span class="bg-gray-700 text-xs font-bold px-3 py-1 rounded-full">
          Pendiente
        </span>
      </div>
    </div>
  `).join('');
}