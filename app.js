require('./services/dbConnect');
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const ejs = require('ejs');
const app = express();

const { PORT, SECRET, info } = require('./config');
const User = require('./services/User');
const scraperModule = require('./services/updateRedis');
const { getWeekKey, getTodayDate, generarCombinaciones, generarResumenSemanal } = require('./services/sofascoreService');
const { fetchPronosticosFromSportyTrader } = require('./services/sportyTrader');
const { loadData } = require('./services/data')
const { todayDate, principal, pronosticos } = require('./services/leerMatchDay');
const { filtrarPartidosPorMercados } = require('./services/verificador')
const { filtrarPartidosPorMercadosB, obtenerPartidosDestacados } = require('./services/verificadorB')

scraperModule.iniciarCronJob()

app.use(cors());
app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: true
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(require('./controllers/setCurrentPage'));
app.use((req, res, next) => {
  res.locals.sesionIniciada = req.session.sesionIniciada || false;
  res.locals.isAdmin = req.session.isAdmin || false;
  next();
});

const checkMobile = (req, res, next) => {
  const ua = req.headers['user-agent']?.toLowerCase() || '';
  const esMovil = /mobile|android|iphone|ipad|phone|ios|ipod|webos|blackberry|windows phone/i.test(ua);
  const esBot = /facebookexternalhit|twitterbot|whatsapp|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|pinterestbot/i.test(ua);
  
  if (esBot || esMovil) {
    return next();
  }
  
  res.render("errores", { 
    info, 
    errorMessage: "Esta página solo está disponible en dispositivos móviles." 
  });
};
//app.use(checkMobile);

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

const requiredDirs = [
  path.join(__dirname, 'public', 'team-logos'),
  path.join(__dirname, 'data')
];
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.get('/', async (req, res) => {
  const totalUsers = await User.count();
  res.render('home', {
    info,
    name_page: 'Inicio',
    totalUsers
  })
})
app.get('/best-play', requireLogin, async (req, res) => {
  try {
    const db = await principal();
    const weekKey = req.query.semana || getWeekKey();
    const dayMonth = req.query.fecha || getTodayDate();
    
    const weekData = db[weekKey]?.[dayMonth] || null;
    
    let query = null;
    if (req.query.semana) {
      query = `?semana=${req.query.semana}&fecha=${req.query.fecha}`
    }
    res.render('best_play', {
      info,
      name_page: "Principal",
      //fondo: !weekData ? "rgb(152, 203, 100)" : "#0a0a0a",
      today: dayMonth,
      bets: weekData,
      query
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error interno');
  }
});
app.get('/combinations', requireLogin, async (req, res) => {
  try {
    const db = await principal();
    
    const weekKey = req.query.semana || getWeekKey();
    const dayMonth = req.query.fecha || getTodayDate();
    
    const bets = db[weekKey]?.[dayMonth] || null;
    
    if (!bets || !bets.matches || bets.matches.length !== 3) {
      return res.redirect('/');
    }
    
    const { partidos, combinaciones, todosFinalizados } = generarCombinaciones(bets.matches, bets.optional);
    combinaciones.sort((a, b) => b.cuota - a.cuota);
    
    const indiceGanador = combinaciones.findIndex(c => c.esGanadora);
    
    res.render('combinations', {
      info,
      name_page: "Combinaciones",
      //fondo: '#0a0a0a',
      today: dayMonth,
      partidos,
      combinaciones,
      todosFinalizados,
      indiceGanador,
      cuotaGanadora: indiceGanador !== -1 ? combinaciones[indiceGanador].cuota : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error interno');
  }
});
app.get('/matches', requireLogin, async (req, res) => {
  try {
    const db = await principal();
    
    const semanas = Object.keys(db).sort((a, b) => {
      return moment(b, "GGGG-[W]WW").diff(moment(a, "GGGG-[W]WW"));
    });
    
    const semanasConResumen = semanas.map(semana => {
      const base = moment(semana, "GGGG-[W]WW"); // Año y semana ISO
      const fechaInicio = base.clone().startOf('isoWeek'); // lunes
      const fechaFin = base.clone().endOf('isoWeek');     // domingo
    
      return {
        codigoSemana: semana,
        fechaInicio: fechaInicio.format('DD/MM/YYYY'),
        fechaFin: fechaFin.format('DD/MM/YYYY'),
        resumen: generarResumenSemanal(db[semana])
      };
    });
    
    res.render('matches', {
      info,
      name_page: "Historial",
      semanas: semanasConResumen
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error interno');
  }
});
app.get('/detalle', requireLogin, (req, res) => {
  const semana = req.query.semana || '';
  res.redirect(`${semana}`);
});
app.get('/semana/:semana', requireLogin, async (req, res) => {
  try {
    const db = await principal();
    const semana = req.params.semana;
    const partidos = db[semana];
    
    if (!partidos) {
      return res.status(404).render("errores", {
        errorMessage: `No se encontraron partidos para la semana ${semana}`
      });
    }
    
    const processData = (dbData) => {
      const agrupadosPorDia = {};
      const cuotasDiarias = {};
      const resultadosDias = {};
      let cuotaTotalSemana = 0;
    
      Object.keys(dbData).forEach(fecha => {
        const dia = dbData[fecha];
        const partidosDelDia = [...dia.matches];
        let huboOpcional = false;
        let resultadoOpcional = null;
    
        if (dia.optional) {
          partidosDelDia.push(dia.optional);
          huboOpcional = true;
        }
    
        // Mostrar el día si hay al menos 3 partidos
        if (partidosDelDia.length >= 3) {
          const fechaFormateada = moment(fecha, "MM-DD").format("YYYY-MM-DD");
          agrupadosPorDia[fechaFormateada] = partidosDelDia;
    
          const partidosFinalizados = partidosDelDia.filter(p => p.finished);
          const totalRequerido = huboOpcional ? 4 : 3;
    
          if (partidosFinalizados.length >= totalRequerido) {
            let cuotaGanadoraDia = 1;
            let resultadoDia = 'Ganadora';
    
            partidosFinalizados.forEach(partido => {
              if (partido.odds) {
                cuotaGanadoraDia *= parseFloat(partido.odds[partido.winner]) || 1;
              } else if (partido.options) {
                const optionKey = Object.keys(partido.options)[0];
                cuotaGanadoraDia *= parseFloat(partido.options[optionKey].odd) || 1;
    
                // Evaluar resultado del opcional
                if (partido.options.over) {
                  resultadoOpcional = partido.firstHalf > 0.5 ? 'Ganadora' : 'Perdida';
                } else if (partido.options.under) {
                  resultadoOpcional = partido.firstHalf < 1.5 ? 'Ganadora' : 'Perdida';
                }
              }
            });
    
            if (huboOpcional && resultadoOpcional) {
              resultadoDia = resultadoOpcional;
            }
    
            cuotasDiarias[fechaFormateada] = cuotaGanadoraDia.toFixed(2);
            resultadosDias[fechaFormateada] = resultadoDia;
    
            // Solo sumar a la cuota semanal si el opcional no existe o fue ganador
            if (!huboOpcional || resultadoOpcional === 'Ganadora') {
              cuotaTotalSemana += cuotaGanadoraDia;
            }
          } else {
            // Aún no se puede calcular la cuota
            resultadosDias[fechaFormateada] = 'Pendiente';
          }
        }
      });
    
      return {
        agrupadosPorDia,
        cuotasDiarias,
        resultadosDias,
        cuotaTotalSemana: cuotaTotalSemana.toFixed(2)
      };
    };;
    
    const { agrupadosPorDia, cuotasDiarias, resultadosDias, cuotaTotalSemana } = processData(partidos);
    
    res.render('detalle', {
      info,
      name_page: semana,
      semana: semana,
      fechaInicio: moment(semana, "YYYY-[W]WW").startOf('week').format('DD/MM/YYYY'),
      fechaFin: moment(semana, "YYYY-[W]WW").endOf('week').format('DD/MM/YYYY'),
      agrupadosPorDia,
      cuotasDiarias,
      resultadosDias,
      cuotaTotalSemana,
      moment: moment,
      dbData: partidos
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error interno');
  }
});

const { detalle } = require('./services/idApi');
const { encodeId } = require('./services/encodeId');
app.get("/encuentro/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    if (/^\d+$/.test(id)) {
      const encoded = encodeId(parseInt(id, 10));
      return res.redirect(301, `/encuentro/${encoded}`);
    }
    const detalles = await detalle(id);

    // Identificar stats correctos según teamId
    const statsLocal = detalles.stats_list?.find(s => s.teamId === detalles.localTeam?.id) || {};
    const statsVisitante = detalles.stats_list?.find(s => s.teamId === detalles.visitorTeam?.id) || {};

    // Procesar eventos con lado correspondiente
    const eventos = detalles.events_list?.map(ev => ({
      minuto: ev.minute || 0,
      extraMinute: ev.extraMinute || null,
      tipo: ev.type, // goal, yellowcard, redcard, substitution, etc...
      jugador: ev.playerName,
      jugadorSale: ev.relatedPlayerName || null,
      result: ev.result || null,
      varResult: ev.varResult || null,
      equipo:
        String(ev.teamId) === String(detalles.localTeam?.id)
          ? 'local'
          : String(ev.teamId) === String(detalles.visitorTeam?.id)
          ? 'visitante'
          : 'desconocido'
    }))
    .sort((a, b) =>
      (a.minuto + (a.extraMinute || 0)) - (b.minuto + (b.extraMinute || 0))
    ) || [];

    const datosDetallados = {
      local: {
        nombre: detalles.localTeam?.name,
        logo: detalles.localTeam?.logoPath,
        goles: detalles.localTeamScore ?? 0
      },
      visitante: {
        nombre: detalles.visitorTeam?.name,
        logo: detalles.visitorTeam?.logoPath,
        goles: detalles.visitorTeamScore ?? 0
      },
      htScore: detalles.htScore ?? '0-0',
      ftScore: detalles.ftScore ?? `${detalles.localTeamScore ?? 0}-${detalles.visitorTeamScore ?? 0}`,
      estadisticas: {
        posesion: {
          local: statsLocal.possessiontime ?? 0,
          visitante: statsVisitante.possessiontime ?? 0
        },
        rematesTotales: {
          local: statsLocal.shots?.total ?? 0,
          visitante: statsVisitante.shots?.total ?? 0
        },
        rematesPuerta: {
          local: statsLocal.shots?.ongoal ?? 0,
          visitante: statsVisitante.shots?.ongoal ?? 0
        },
        corners: {
          local: statsLocal.corners ?? 0,
          visitante: statsVisitante.corners ?? 0
        },
        faltas: {
          local: statsLocal.fouls ?? 0,
          visitante: statsVisitante.fouls ?? 0
        },
        sustituciones: {
          local: statsLocal.substitutions ?? 0,
          visitante: statsVisitante.substitutions ?? 0
        },
        amarillas: {
          local: statsLocal.yellowcards ?? 0,
          visitante: statsVisitante.yellowcards ?? 0
        },
        rojas: {
          local: statsLocal.redcards ?? 0,
          visitante: statsVisitante.redcards ?? 0
        }
      },
      eventos
    };

    res.render('encuentro', {
      info,
      name_page: "Detalle del Partido",
      partido: datosDetallados
    });

  } catch (e) {
    console.error('Error obteniendo detalles:', e.message);
    res.status(500).send('Error obteniendo detalles del partido');
  }
});
app.get('/pronosticos/destacados', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await obtenerPartidosDestacados(dia)
  res.render('destacados', {
    info,
    name_page: "Lo Más Seguro",
    partidos
  });
});
app.get('/pronosticos/1x2', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['1', 'X', '2']);
  res.render('principales', {
    info,
    name_page: "1x2",
    partidos
  });
});
app.get('/pronosticos/doble_oportunidad', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['1X', '12', 'X2']);
  res.render('principales', {
    info,
    name_page: "Doble Oportunidad",
    partidos
  });
});
app.get('/pronosticos/ambos_marcan', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['GG', 'NG']);
  res.render('principales', {
    info,
    name_page: "Ambos Marcan",
    partidos
  });
});
app.get('/pronosticos/menos_mas_0-5_primer_tiempo', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['O05HT', 'U05HT']);
  res.render('principales', {
    info,
    name_page: "más menos 0.5 primer tiempo",
    partidos
  });
});
app.get('/pronosticos/menos_mas_1-5', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['O15', 'U15']);
  res.render('principales', {
    info,
    name_page: "más menos 1.5",
    partidos
  });
});
app.get('/pronosticos/menos_mas_2-5', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['O25', 'U25']);
  res.render('principales', {
    info,
    name_page: "más menos 2.5",
    partidos
  });
});
app.get('/pronosticos/menos_mas_3-5', requireLogin, async (req, res) => {
  const dia = req.query.fecha;
  const partidos = await filtrarPartidosPorMercadosB(dia, ['O35', 'U35']);
  res.render('principales', {
    info,
    name_page: "más menos 3.5",
    partidos
  });
});
/*
app.get('/pronosticos', async (req, res) => {
  try {
    const page = 1;
    const { matches, hasMore } = await fetchPronosticosFromSportyTrader(page);
    
    res.render('match_day', {
      info,
      pronosticos: matches,
      currentPage: page,
      hasMore,
      title: 'Pronósticos de Fútbol'
    });
    
  } catch (error) {
    console.error('Error al renderizar pronósticos:', error);
    res.status(500).render('error', { 
      message: 'Error al cargar pronósticos',
      title: 'Error'
    });
  }
});
*/

/* admin */
/*
const adminRoutes = require('./routes/adminRoutes');
app.use('/newMatch', adminRoutes);
app.get('/admin', requireLogin, (req, res) => {
  res.render('admin', { success: req.query.success });
});
app.get('/admin2', requireLogin, (req, res) => {
  res.render('admin2', { info });
});
*/
/* fin admin */

app.get('/privacidad', (req, res) => {
  res.render('privacidad', { info, name_page: 'Política de Privacidad' });
});
app.get('/terminos', (req, res) => {
  res.render('terminos', { info, name_page: 'Términos y Condiciones' });
});
app.get('/cookies', (req, res) => {
  res.render('cookies', { info, name_page: 'Políticas de Cookies' });
});
app.get('/ping', (req, res) => {
  res.send('Pong');
});
app.get("/sw.js", (req, res) => {
  res.set("Content-Type", "application/javascript");

  const rutas = [
    "/", "/best-play", "/matches",
    "/pronosticos/destacados", "/pronosticos/1x2",
    "/pronosticos/doble_oportunidad", "/pronosticos/ambos_marcan",
    "/menos_mas_1-5", "/menos_mas_2-5", "/menos_mas_3-5"
  ];

  res.send(`
    const CACHE_NAME = "pwa-cache-${global.CACHE_VERSION}";
    const RUTAS_A_CACHEAR = ${JSON.stringify(rutas)};

    self.addEventListener("install", (event) => {
      event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(RUTAS_A_CACHEAR))
      );
    });

    self.addEventListener("activate", (event) => {
      event.waitUntil(
        caches.keys().then((keys) =>
          Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
      );
    });

    self.addEventListener("fetch", (event) => {
      event.respondWith(
        caches.match(event.request).then((resp) => resp || fetch(event.request))
      );
    });
  `);
});

app.get('/login', (req, res) => {
  if (req.session.sesionIniciada) {
    res.redirect('/');
  } else {
    res.render('login', { info });
  }
});
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  const noPlus = usuario.replace(/\+/g, '');

  try {
    const user = await User.findOne({ phone: noPlus });
    
    if (!user) {
      return res.status(401).json({ success: false, msg: 'Usuario no registrado' });
    }

    if (user.pass !== password) {
      return res.status(401).json({ success: false, msg: 'Contraseña incorrecta' });
    }

    // Guardar sesión
    req.session.sesionIniciada = true;
    req.session.usuario = noPlus;

    const destino = req.session.destino || "/";
    delete req.session.destino;

    return res.json({
      success: true,
      ruta: destino,
      usuario: noPlus
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: 'Error interno del servidor' });
  }
});

app.get('/register', async (req, res) => {
  if (req.session.sesionIniciada) {
    res.redirect('/')
  } else {
    res.render('register', { info });
  }
});
app.post('/register', async (req, res) => {
  const { phone, password, name_user } = req.body;
  const noPlus = phone.replace(/\+/g, '');

  try {
    const exists = await User.check(noPlus);
    if (exists) {
      return res.json({ success: false, msg: 'Usuario Existente!' });
    }

    const user = new User({
      phone: noPlus,
      name: name_user,
      pass: password
    });

    await user.save();

    return res.json({ success: true, msg: 'Usuario Registrado!', ruta: '/login' });

  } catch (e) {
    console.error('Error al registrar usuario:', e);
    return res.json({ success: false, msg: 'Error al guardar: ' + e.message });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

function requireLogin(req, res, next) {
  if (req.session && req.session.sesionIniciada) {
    return next();
  } else {
    req.session.destino = req.originalUrl;
    res.redirect("/login");
  }
}
setInterval(() => {
  fetch(`${info.dominio}/ping`)
    .then(res => console.log('Ping interno enviado:', res.status))
    .catch(err => console.error('Error en el ping:', err.message));
}, 14 * 60 * 1000);


app.use((req, res) => {
  res.status(404).render("errores", {
    errorMessage: "La página que buscas no está en juego.",
    info,
    name_page: "Error"
  });
});

const IP = '';
app.listen(PORT, () => {
  console.log(`Online on port: ${PORT}`);
});