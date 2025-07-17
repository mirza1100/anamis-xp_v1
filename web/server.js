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

// Helper: Load config
function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// Helper: Save config
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// JWT middleware
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

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const config = loadConfig();
  if (username === config.panel.username && password === config.panel.password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: { username }, config: { language: config.panel.language, theme: config.panel.theme } });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// Dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const os = require('os');
  const uptime = os.uptime();
  const cpu = os.loadavg()[0];
  const mem = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
  res.json({
    system: {
      cpu: { usage: Math.round(cpu * 100), cores: os.cpus().length },
      memory: { usage: Math.round(mem), total: Math.round(os.totalmem() / 1024 / 1024 / 1024) },
      network: { ipv4: '127.0.0.1' }
    },
    vpn: {
      status: {
        xray: fs.existsSync('/usr/local/bin/xray'),
        openvpn: fs.existsSync('/usr/sbin/openvpn'),
        wireguard: fs.existsSync('/usr/bin/wg'),
        ssh: fs.existsSync('/usr/sbin/sshd') || fs.existsSync('/usr/bin/sshd')
      },
      users: { connected: 1, total: 1 }
    },
    uptime
  });
});

// Settings
app.get('/api/settings', authenticateToken, (req, res) => {
  const config = loadConfig();
  res.json(config);
});
app.post('/api/settings', authenticateToken, (req, res) => {
  const config = loadConfig();
  Object.assign(config.panel, req.body.panel || {});
  saveConfig(config);
  res.json({ success: true, message: 'Settings updated' });
});

// Logs
app.get('/api/logs', authenticateToken, (req, res) => {
  try {
    const logs = fs.readFileSync('/var/log/anamis-xp/panel.log', 'utf8').split('\n').slice(-100);
    res.json({ logs });
  } catch {
    res.json({ logs: [] });
  }
});

// Inbounds API
app.get('/api/inbounds', authenticateToken, (req, res) => {
  try {
    // فرض: لیست inbounds از Xray خوانده می‌شود
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.json({ inbounds: [] });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const inbounds = (xrayConfig.inbounds || []).map(inb => ({
      remark: inb.remark || '',
      protocol: inb.protocol,
      listenIP: inb.listen || '',
      port: inb.port,
      transmission: inb.streamSettings ? inb.streamSettings.network : '',
      traffic: inb.trafficLimit || '',
      duration: inb.duration || ''
    }));
    res.json({ inbounds });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load inbounds' });
  }
});

// --- User Management API ---
const SUPPORTED_CORES = ['xray', 'openvpn', 'wireguard', 'ssh'];

// Helper: List users (real logic for Xray)
function listUsers(core) {
  if (core === 'xray') {
    try {
      const xrayConfig = JSON.parse(fs.readFileSync('/usr/local/etc/xray/config.json', 'utf8'));
      const vmessInbound = xrayConfig.inbounds.find(i => i.protocol === 'vmess');
      if (!vmessInbound) return [];
      return (vmessInbound.settings.clients || []).map(u => ({ username: u.id, ...u }));
    } catch { return []; }
  }
  if (core === 'openvpn') {
    // List users: parse /var/log/openvpn/status.log for connected clients
    try {
      const statusPath = '/var/log/openvpn/status.log';
      if (!fs.existsSync(statusPath)) return [];
      const lines = fs.readFileSync(statusPath, 'utf8').split('\n');
      const users = [];
      let inClientList = false;
      for (const line of lines) {
        if (line.startsWith('Common Name,')) { inClientList = true; continue; }
        if (inClientList && line.trim() === '') break;
        if (inClientList) {
          const parts = line.split(',');
          if (parts[0]) users.push({ username: parts[0] });
        }
      }
      return users;
    } catch { return []; }
  }
  if (core === 'wireguard') {
    // List users: parse [Peer] sections
    try {
      const wgConf = fs.readFileSync('/etc/wireguard/wg0.conf', 'utf8');
      const peers = [];
      const peerBlocks = wgConf.split(/\[Peer\]/g).slice(1);
      for (const block of peerBlocks) {
        const pubMatch = block.match(/PublicKey\s*=\s*(.+)/);
        const allowedMatch = block.match(/AllowedIPs\s*=\s*(.+)/);
        if (pubMatch) {
          peers.push({ username: pubMatch[1].trim(), publicKey: pubMatch[1].trim(), allowedIPs: allowedMatch ? allowedMatch[1].trim() : '' });
        }
      }
      return peers;
    } catch { return []; }
  }
  if (core === 'ssh') {
    // List users: users in /etc/passwd with shell access and prefix 'vpn_'
    try {
      const passwd = fs.readFileSync('/etc/passwd', 'utf8').split('\n');
      return passwd
        .map(line => line.split(':'))
        .filter(parts => parts[0] && parts[0].startsWith('vpn_') && parts[6] && parts[6].includes('sh'))
        .map(parts => ({ username: parts[0] }));
    } catch { return []; }
  }
  return [];
}

// Helper: Add user (real logic for Xray)
function addUser(core, user) {
  if (core === 'xray') {
    try {
      const configPath = '/usr/local/etc/xray/config.json';
      const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const vmessInbound = xrayConfig.inbounds.find(i => i.protocol === 'vmess');
      if (!vmessInbound) return false;
      if (!user.id) return false;
      if ((vmessInbound.settings.clients || []).find(u => u.id === user.id)) return false; // already exists
      vmessInbound.settings.clients = vmessInbound.settings.clients || [];
      vmessInbound.settings.clients.push({ id: user.id, alterId: user.alterId || 0, security: user.security || 'auto' });
      fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
      exec('systemctl restart xray');
      return true;
    } catch (e) { return false; }
  }
  if (core === 'openvpn') {
    // Add/remove user not implemented yet
    return false;
  }
  if (core === 'wireguard') {
    // Add user: append [Peer] section
    try {
      const confPath = '/etc/wireguard/wg0.conf';
      const wgConf = fs.readFileSync(confPath, 'utf8');
      if (!user.publicKey || !user.allowedIPs) return false;
      if (wgConf.includes(user.publicKey)) return false; // already exists
      const peerBlock = `\n[Peer]\nPublicKey = ${user.publicKey}\nAllowedIPs = ${user.allowedIPs}\n`;
      fs.appendFileSync(confPath, peerBlock);
      exec('systemctl restart wg-quick@wg0');
      return true;
    } catch (e) { return false; }
  }
  if (core === 'ssh') {
    // Add user: useradd with prefix 'vpn_'
    try {
      if (!user.username || !user.password) return false;
      if (!user.username.startsWith('vpn_')) return false;
      require('child_process').execSync(`useradd -m -s /bin/bash ${user.username}`);
      require('child_process').execSync(`echo '${user.username}:${user.password}' | chpasswd`);
      return true;
    } catch (e) { return false; }
  }
  // TODO: Replace with real logic per core
  return true;
}

// Helper: Remove user (real logic for Xray)
function removeUser(core, username) {
  if (core === 'xray') {
    try {
      const configPath = '/usr/local/etc/xray/config.json';
      const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const vmessInbound = xrayConfig.inbounds.find(i => i.protocol === 'vmess');
      if (!vmessInbound) return false;
      const before = vmessInbound.settings.clients.length;
      vmessInbound.settings.clients = (vmessInbound.settings.clients || []).filter(u => u.id !== username);
      if (vmessInbound.settings.clients.length === before) return false; // not found
      fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
      exec('systemctl restart xray');
      return true;
    } catch (e) { return false; }
  }
  if (core === 'openvpn') {
    // Remove user: remove [Peer] section by PublicKey
    try {
      const confPath = '/etc/wireguard/wg0.conf';
      let wgConf = fs.readFileSync(confPath, 'utf8');
      const peerRegex = new RegExp(`\\n\\[Peer\\]\\n(?:[^\\[]*?PublicKey\\s*=\\s*${username}[^\\[]*?)(?=\\n\\[|$)`, 'g');
      if (!wgConf.includes(username)) return false;
      wgConf = wgConf.replace(peerRegex, '');
      fs.writeFileSync(confPath, wgConf);
      exec('systemctl restart wg-quick@wg0');
      return true;
    } catch (e) { return false; }
  }
  if (core === 'ssh') {
    // Remove user: userdel with prefix 'vpn_'
    try {
      if (!username.startsWith('vpn_')) return false;
      require('child_process').execSync(`userdel -r ${username}`);
      return true;
    } catch (e) { return false; }
  }
  // TODO: Replace with real logic per core
  return true;
}

// Helper: Reset user password (placeholder logic)
function resetUserPassword(core, username) {
  // TODO: Replace with real logic per core
  return true;
}

// List users
app.get('/api/users/:core', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  const users = listUsers(core);
  res.json({ users });
});

// Add user
app.post('/api/users/:core', authenticateToken, (req, res) => {
  const { core } = req.params;
  const user = req.body;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  if (!user || !user.username) return res.status(400).json({ error: 'Missing user data' });
  const ok = addUser(core, user);
  if (ok) return res.json({ success: true });
  res.status(500).json({ error: 'Failed to add user' });
});

// Remove user
app.delete('/api/users/:core/:username', authenticateToken, (req, res) => {
  const { core, username } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  const ok = removeUser(core, username);
  if (ok) return res.json({ success: true });
  res.status(500).json({ error: 'Failed to remove user' });
});

// Reset user password
app.post('/api/users/:core/:username/reset', authenticateToken, (req, res) => {
  const { core, username } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  const ok = resetUserPassword(core, username);
  if (ok) return res.json({ success: true });
  res.status(500).json({ error: 'Failed to reset password' });
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Anamis-XP Web Panel running on port ${PORT}`);
});