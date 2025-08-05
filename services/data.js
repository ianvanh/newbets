const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, '../data/bets.json');

async function readBetsData() {
  try {
    await fs.promises.access(dataPath);
    const rawData = await fs.promises.readFile(dataPath, 'utf8');
    return JSON.parse(rawData) || {};
  } catch (error) {
    console.error('Error leyendo bets.json:', error);
    return {};
  }
}

function saveBetsData(json) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

module.exports = {
  loadData: async () => readBetsData(),
  saveData: async (json) => saveBetsData(json)
};