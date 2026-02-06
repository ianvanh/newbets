require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('❌ La variable MONGO_URI no está definida en .env');
}

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('🔥 Error crítico de MongoDB:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('¿Está MongoDB corriendo? ¿La URI es correcta?');
  }
});

db.once('open', () => {
  console.log('✅ Conexión exitosa a MongoDB');
  // console.log(`Base de datos: ${db.name}`);
  // console.log(`Host: ${db.host}`);
});

process.on('SIGINT', async () => {
  await db.close();
  console.log('🔌 Conexión a MongoDB cerrada por terminación de la app');
  process.exit(0);
});


module.exports = mongoose;