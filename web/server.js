// Anamis-XP Backend (rewritten)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = '/opt/anamis-xp/config/config.json';
const JWT_SECRET = process.env.JWT_SECRET || 'anamis-xp-secret';

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// --- Config Helpers ---
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// --- JWT Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}