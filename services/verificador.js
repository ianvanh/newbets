const fs = require('fs');
const path = require('path')
const { getWeekKey, getTodayDate } = require('./sofascoreService');

const verificarMercado = ({ tipo, golesLocal, golesVisitante }) => {
  golesLocal = Number(golesLocal);
  golesVisitante = Number(golesVisitante);
  const totalGoles = golesLocal + golesVisitante;

  switch (tipo) {
    case '1': return golesLocal > golesVisitante ? 'ganado' : 'perdido';
    case 'X': return golesLocal === golesVisitante ? 'ganado' : 'perdido';
    case '2': return golesVisitante > golesLocal ? 'ganado' : 'perdido';
    case '12': return golesLocal !== golesVisitante ? 'ganado' : 'perdido';
    case '1X': return golesLocal >= golesVisitante ? 'ganado' : 'perdido';
    case 'X2': return golesVisitante >= golesLocal ? 'ganado' : 'perdido';
    case 'GG': return golesLocal > 0 && golesVisitante > 0 ? 'ganado' : 'perdido';
    case 'NG': return golesLocal === 0 || golesVisitante === 0 ? 'ganado' : 'perdido';
    case 'Over': return totalGoles > 2.5 ? 'ganado' : 'perdido';
    case 'Under': return totalGoles < 2.5 ? 'ganado' : 'perdido';
    default: return 'pendiente';
  }
};

const filtrarPartidosPorMercados = (mercadosDeseados) => {
  const today = getTodayDate();
  const week = getWeekKey();
  const DATA_PATH = path.join(__dirname, '../data/principales.json');

  let partidosFiltrados = [];

  if (fs.existsSync(DATA_PATH)) {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const partidos = data[week]?.[today]?.matches || [];

    partidos.forEach(p => {
      const tipos = p.mercados.map(m => m.tipo);
      const disponibles = tipos.filter(t => mercadosDeseados.includes(t));

      disponibles.forEach(tipo => {
        const mercado = p.mercados.find(m => m.tipo === tipo);
        let resultado = 'pendiente';

        if (p.finalizado && p.golesLocal != null && p.golesVisitante != null) {
          resultado = verificarMercado({
            tipo,
            golesLocal: p.golesLocal,
            golesVisitante: p.golesVisitante
          });
        }

        partidosFiltrados.push({
          ...p,
          mercado: tipo,
          cuota: mercado.cuota,
          resultado
        });
      });
    });
  }

  return partidosFiltrados;
};


module.exports = { filtrarPartidosPorMercados }