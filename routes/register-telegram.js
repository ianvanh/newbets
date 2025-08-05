const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN || "tu_token_aqui";
const USERS_JSON = path.join(__dirname, '../data/users.json');

function checkTelegramAuth(data, botToken) {
  const { hash, ...rest } = data;
  const sorted = Object.keys(rest).sort().map(key => `${key}=${rest[key]}`).join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
  return hmac === hash;
}

router.get('/register-telegram', (req, res) => {
  const data = req.query;

  if (!checkTelegramAuth(data, TELEGRAM_BOT_TOKEN)) {
    return res.status(403).send("Datos inválidos de Telegram");
  }

  const newUser = {
    id: data.id,
    name_user: data.username || `${data.first_name} ${data.last_name || ""}`.trim(),
    telegram_id: data.id,
    method: "telegram",
    registered_at: new Date().toISOString()
  };

  let users = [];
  if (fs.existsSync(USERS_JSON)) {
    users = JSON.parse(fs.readFileSync(USERS_JSON, 'utf-8'));
  }

  const exists = users.find(u => u.telegram_id === data.id);
  if (!exists) {
    users.push(newUser);
    fs.writeFileSync(USERS_JSON, JSON.stringify(users, null, 2));
  }

  return res.redirect('/dashboard');
});

module.exports = router;