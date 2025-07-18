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

// --- Helper: مهاجرت به ساختار چند ادمین ---
function ensureAdminsArray(config) {
  if (!config.admins) {
    config.admins = [];
    if (config.panel && config.panel.username && config.panel.password) {
      config.admins.push({
        username: config.panel.username,
        password: config.panel.password,
        role: 'superadmin',
        lastLogin: null
      });
      // حذف فیلدهای قدیمی (اختیاری)
      // delete config.panel.username;
      // delete config.panel.password;
    }
  }
}

// --- Endpoint تغییر رمز ادمین ---
app.post('/api/admins/:username/password', authenticateToken, (req, res) => {
  const { username } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'رمز عبور معتبر نیست' });
  const config = loadConfig();
  ensureAdminsArray(config);
  const admin = config.admins.find(a => a.username === username);
  if (!admin) return res.status(404).json({ error: 'ادمین یافت نشد' });
  admin.password = newPassword; // (در صورت نیاز hash)
  saveConfig(config);
  res.json({ success: true });
});

// افزودن ادمین جدید
app.post('/api/admins', authenticateToken, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'اطلاعات ناقص' });
  const config = loadConfig();
  ensureAdminsArray(config);
  if (config.admins.find(a => a.username === username)) {
    return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
  }
  config.admins.push({
    username,
    password, // (در صورت نیاز hash)
    role,
    lastLogin: null
  });
  saveConfig(config);
  res.json({ success: true });
});

// ویرایش نقش ادمین
app.post('/api/admins/:username/role', authenticateToken, (req, res) => {
  const { username } = req.params;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'نقش معتبر نیست' });
  const config = loadConfig();
  ensureAdminsArray(config);
  const admin = config.admins.find(a => a.username === username);
  if (!admin) return res.status(404).json({ error: 'ادمین یافت نشد' });
  admin.role = role;
  saveConfig(config);
  res.json({ success: true });
});

// --- بروزرسانی login برای ذخیره loginHistory ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const config = loadConfig();
  ensureAdminsArray(config);
  const admin = config.admins.find(a => a.username === username && a.password === password);
  if (admin) {
    const now = new Date().toISOString();
    admin.lastLogin = now;
    admin.loginHistory = admin.loginHistory || [];
    admin.loginHistory.unshift(now);
    if (admin.loginHistory.length > 10) admin.loginHistory = admin.loginHistory.slice(0, 10);
    saveConfig(config);
    const token = jwt.sign({ username, role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: { username, role: admin.role }, config: { language: config.panel.language, theme: config.panel.theme } });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// endpoint دریافت تاریخچه ورود ادمین
app.get('/api/admins/:username/login-history', authenticateToken, (req, res) => {
  const { username } = req.params;
  const config = loadConfig();
  ensureAdminsArray(config);
  const admin = config.admins.find(a => a.username === username);
  if (!admin) return res.status(404).json({ error: 'ادمین یافت نشد' });
  res.json({ loginHistory: admin.loginHistory || [] });
});

// --- endpoint لیست ادمین‌ها ---
app.get('/api/admins', authenticateToken, (req, res) => {
  const config = loadConfig();
  ensureAdminsArray(config);
  res.json({ admins: config.admins });
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

// افزودن inbound جدید
app.post('/api/inbounds', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const inb = req.body;
    // ساختار پایه inbound جدید
    const newInbound = {
      remark: inb.remark || '',
      protocol: inb.protocol,
      listen: inb.listenIP,
      port: Number(inb.port),
      streamSettings: { network: inb.transmission },
      trafficLimit: inb.traffic,
      duration: inb.duration,
      settings: { clients: [] }
    };
    xrayConfig.inbounds = xrayConfig.inbounds || [];
    xrayConfig.inbounds.push(newInbound);
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add inbound' });
  }
});

// حذف inbound با پورت
app.delete('/api/inbounds/:port', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const before = xrayConfig.inbounds.length;
    xrayConfig.inbounds = xrayConfig.inbounds.filter(inb => Number(inb.port) !== port);
    if (xrayConfig.inbounds.length === before) return res.status(404).json({ error: 'Inbound not found' });
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete inbound' });
  }
});

// ویرایش inbound با پورت
app.put('/api/inbounds/:port', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const idx = xrayConfig.inbounds.findIndex(inb => Number(inb.port) === port);
    if (idx === -1) return res.status(404).json({ error: 'Inbound not found' });
    const inb = req.body;
    // بروزرسانی مقادیر
    xrayConfig.inbounds[idx] = {
      ...xrayConfig.inbounds[idx],
      remark: inb.remark || '',
      protocol: inb.protocol,
      listen: inb.listenIP,
      port: Number(inb.port),
      streamSettings: { network: inb.transmission },
      trafficLimit: inb.traffic,
      duration: inb.duration
    };
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update inbound' });
  }
});

// لیست clients یک inbound (بر اساس پورت)
app.get('/api/inbounds/:port/clients', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.json({ clients: [] });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const inbound = (xrayConfig.inbounds || []).find(inb => Number(inb.port) === port);
    if (!inbound || !inbound.settings || !inbound.settings.clients) return res.json({ clients: [] });
    res.json({ clients: inbound.settings.clients });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load clients' });
  }
});
// افزودن client جدید به inbound (بر اساس پورت)
app.post('/api/inbounds/:port/clients', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const inbound = (xrayConfig.inbounds || []).find(inb => Number(inb.port) === port);
    if (!inbound || !inbound.settings) return res.status(404).json({ error: 'Inbound not found' });
    inbound.settings.clients = inbound.settings.clients || [];
    const client = req.body;
    inbound.settings.clients.push(client);
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add client' });
  }
});

// حذف client از inbound
app.delete('/api/inbounds/:port/clients/:name', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const name = req.params.name;
    const inbound = (xrayConfig.inbounds || []).find(inb => Number(inb.port) === port);
    if (!inbound || !inbound.settings || !inbound.settings.clients) return res.status(404).json({ error: 'Inbound not found' });
    const before = inbound.settings.clients.length;
    inbound.settings.clients = inbound.settings.clients.filter(c => c.name !== name);
    if (inbound.settings.clients.length === before) return res.status(404).json({ error: 'Client not found' });
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});
// ویرایش client در inbound
app.put('/api/inbounds/:port/clients/:name', authenticateToken, (req, res) => {
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.status(500).json({ error: 'Config not found' });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = Number(req.params.port);
    const name = req.params.name;
    const inbound = (xrayConfig.inbounds || []).find(inb => Number(inb.port) === port);
    if (!inbound || !inbound.settings || !inbound.settings.clients) return res.status(404).json({ error: 'Inbound not found' });
    const idx = inbound.settings.clients.findIndex(c => c.name === name);
    if (idx === -1) return res.status(404).json({ error: 'Client not found' });
    inbound.settings.clients[idx] = { ...inbound.settings.clients[idx], ...req.body };
    fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// --- Tunnels in-memory store (نمونه اولیه) ---
global.tunnelsStore = global.tunnelsStore || [
  {type: 'Game', srcIP: '192.168.1.10', srcPort: 4000, dstIP: '10.10.10.2', dstPort: 4000, protocol: 'udp', status: 'active'},
  {type: 'Normal', srcIP: '192.168.1.11', srcPort: 5000, dstIP: '10.10.10.3', dstPort: 5000, protocol: 'tcp', status: 'inactive'}
];

// Tunnels API (نمونه داده)
app.get('/api/tunnels', authenticateToken, (req, res) => {
  res.json({ tunnels: global.tunnelsStore });
});
// افزودن tunnel جدید
app.post('/api/tunnels', authenticateToken, (req, res) => {
  try {
    const tun = req.body;
    tun.status = 'active';
    global.tunnelsStore.push(tun);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add tunnel' });
  }
});

// حذف tunnel با ایندکس
app.delete('/api/tunnels/:idx', authenticateToken, (req, res) => {
  try {
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= global.tunnelsStore.length) return res.status(404).json({ error: 'Tunnel not found' });
    global.tunnelsStore.splice(idx, 1);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete tunnel' });
  }
});

// ویرایش tunnel با ایندکس
app.put('/api/tunnels/:idx', authenticateToken, (req, res) => {
  try {
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= global.tunnelsStore.length) return res.status(404).json({ error: 'Tunnel not found' });
    const tun = req.body;
    global.tunnelsStore[idx] = { ...global.tunnelsStore[idx], ...tun };
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update tunnel' });
  }
});

// --- TunnelSettings in-memory store (نمونه اولیه) ---
global.tunnelSettingsStore = global.tunnelSettingsStore || [
  {type: 'Game', srcIP: '192.168.1.10', dstIP: '10.10.10.2', status: 'active', ping: '35ms'},
  {type: 'Normal', srcIP: '192.168.1.11', dstIP: '10.10.10.3', status: 'inactive', ping: '120ms'}
];

// Tunnel Settings API (نمونه داده)
app.get('/api/tunnel-settings', authenticateToken, (req, res) => {
  res.json({ tunnelSettings: global.tunnelSettingsStore });
});
// افزودن tunnel setting جدید
app.post('/api/tunnel-settings', authenticateToken, (req, res) => {
  try {
    const tun = req.body;
    global.tunnelSettingsStore.push(tun);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add tunnel setting' });
  }
});

// حذف tunnel setting با ایندکس
app.delete('/api/tunnel-settings/:idx', authenticateToken, (req, res) => {
  try {
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= global.tunnelSettingsStore.length) return res.status(404).json({ error: 'Tunnel setting not found' });
    global.tunnelSettingsStore.splice(idx, 1);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete tunnel setting' });
  }
});

// ویرایش tunnel setting با ایندکس
app.put('/api/tunnel-settings/:idx', authenticateToken, (req, res) => {
  try {
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= global.tunnelSettingsStore.length) return res.status(404).json({ error: 'Tunnel setting not found' });
    const tun = req.body;
    global.tunnelSettingsStore[idx] = { ...global.tunnelSettingsStore[idx], ...tun };
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update tunnel setting' });
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

// Reset user traffic
app.post('/api/users/:core/:username/reset-traffic', authenticateToken, (req, res) => {
  const { core, username } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    if (core === 'xray') {
      // Reset traffic by removing and re-adding the user
      const configPath = '/usr/local/etc/xray/config.json';
      const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const vmessInbound = xrayConfig.inbounds.find(i => i.protocol === 'vmess');
      if (!vmessInbound) return res.status(404).json({ error: 'VMess inbound not found' });
      
      const user = vmessInbound.settings.clients.find(u => u.id === username);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // Remove user
      vmessInbound.settings.clients = vmessInbound.settings.clients.filter(u => u.id !== username);
      // Re-add user (this resets traffic stats)
      vmessInbound.settings.clients.push(user);
      
      fs.writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));
      exec('systemctl restart xray');
      res.json({ success: true, message: 'Traffic reset successfully' });
    } else {
      res.status(400).json({ error: 'Traffic reset not supported for this core' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset traffic' });
  }
});

// Generate QR code for user
app.get('/api/users/:core/:username/qr', authenticateToken, (req, res) => {
  const { core, username } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    if (core === 'xray') {
      const configPath = '/usr/local/etc/xray/config.json';
      const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const vmessInbound = xrayConfig.inbounds.find(i => i.protocol === 'vmess');
      if (!vmessInbound) return res.status(404).json({ error: 'VMess inbound not found' });
      
      const user = vmessInbound.settings.clients.find(u => u.id === username);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // Get server IP and port
      const serverIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
      const port = vmessInbound.port || 443;
      
      // Generate VMess URL
      const vmessUrl = `vmess://${Buffer.from(JSON.stringify({
        v: '2',
        ps: username,
        add: serverIP,
        port: port,
        id: user.id,
        aid: user.alterId || 0,
        net: 'tcp',
        type: 'none',
        host: '',
        path: '',
        tls: 'none'
      })).toString('base64')}`;
      
      res.json({ 
        success: true, 
        qrCode: vmessUrl,
        config: {
          server: serverIP,
          port: port,
          id: user.id,
          alterId: user.alterId || 0
        }
      });
    } else {
      res.status(400).json({ error: 'QR code generation not supported for this core' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Get user traffic statistics
app.get('/api/users/:core/:username/stats', authenticateToken, (req, res) => {
  const { core, username } = req.params;
  if (!SUPPORTED_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    if (core === 'xray') {
      // For Xray, we'll return placeholder stats since real stats require API access
      res.json({
        success: true,
        stats: {
          upload: Math.floor(Math.random() * 1000000000), // Placeholder
          download: Math.floor(Math.random() * 1000000000), // Placeholder
          total: Math.floor(Math.random() * 2000000000), // Placeholder
          lastSeen: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({ error: 'Statistics not supported for this core' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// VPN Core Management APIs
const SUPPORTED_VPN_CORES = ['xray', 'openvpn', 'wireguard', 'ssh', 'nginx', 'cisco'];

// Check core status
app.get('/api/cores/:core/status', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    let installed = false;
    let running = false;
    
    switch (core) {
      case 'xray':
        installed = fs.existsSync('/usr/local/bin/xray');
        if (installed) {
          try {
            const result = exec('systemctl is-active xray', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
      case 'openvpn':
        installed = fs.existsSync('/usr/sbin/openvpn');
        if (installed) {
          try {
            const result = exec('systemctl is-active openvpn@server', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
      case 'wireguard':
        installed = fs.existsSync('/usr/bin/wg');
        if (installed) {
          try {
            const result = exec('systemctl is-active wg-quick@wg0', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
      case 'ssh':
        installed = fs.existsSync('/usr/sbin/sshd');
        if (installed) {
          try {
            const result = exec('systemctl is-active ssh', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
      case 'nginx':
        installed = fs.existsSync('/usr/sbin/nginx');
        if (installed) {
          try {
            const result = exec('systemctl is-active nginx', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
      case 'cisco':
        installed = fs.existsSync('/opt/cisco/anyconnect/bin/vpnagentd');
        if (installed) {
          try {
            const result = exec('systemctl is-active vpnagentd', { encoding: 'utf8' });
            running = result.trim() === 'active';
          } catch { running = false; }
        }
        break;
    }
    
    res.json({ installed, running });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check core status' });
  }
});

// Install core
app.post('/api/cores/:core/install', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    switch (core) {
      case 'xray':
        exec('bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install');
        break;
      case 'openvpn':
        exec('apt-get update && apt-get install -y openvpn');
        break;
      case 'wireguard':
        exec('apt-get update && apt-get install -y wireguard');
        break;
      case 'ssh':
        exec('apt-get update && apt-get install -y openssh-server');
        break;
      case 'nginx':
        exec('apt-get update && apt-get install -y nginx');
        break;
      case 'cisco':
        // Cisco AnyConnect installation would require manual setup
        res.status(400).json({ error: 'Cisco AnyConnect requires manual installation' });
        return;
    }
    res.json({ success: true, message: `${core} installed successfully` });
  } catch (error) {
    res.status(500).json({ error: `Failed to install ${core}` });
  }
});

// Uninstall core
app.post('/api/cores/:core/uninstall', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    switch (core) {
      case 'xray':
        exec('bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ remove');
        break;
      case 'openvpn':
        exec('apt-get remove -y openvpn');
        break;
      case 'wireguard':
        exec('apt-get remove -y wireguard');
        break;
      case 'ssh':
        exec('apt-get remove -y openssh-server');
        break;
      case 'nginx':
        exec('apt-get remove -y nginx');
        break;
      case 'cisco':
        res.status(400).json({ error: 'Cisco AnyConnect requires manual uninstallation' });
        return;
    }
    res.json({ success: true, message: `${core} uninstalled successfully` });
  } catch (error) {
    res.status(500).json({ error: `Failed to uninstall ${core}` });
  }
});

// Start core
app.post('/api/cores/:core/start', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    switch (core) {
      case 'xray':
        exec('systemctl start xray');
        break;
      case 'openvpn':
        exec('systemctl start openvpn@server');
        break;
      case 'wireguard':
        exec('systemctl start wg-quick@wg0');
        break;
      case 'ssh':
        exec('systemctl start ssh');
        break;
      case 'nginx':
        exec('systemctl start nginx');
        break;
      case 'cisco':
        exec('systemctl start vpnagentd');
        break;
    }
    res.json({ success: true, message: `${core} started successfully` });
  } catch (error) {
    res.status(500).json({ error: `Failed to start ${core}` });
  }
});

// Stop core
app.post('/api/cores/:core/stop', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    switch (core) {
      case 'xray':
        exec('systemctl stop xray');
        break;
      case 'openvpn':
        exec('systemctl stop openvpn@server');
        break;
      case 'wireguard':
        exec('systemctl stop wg-quick@wg0');
        break;
      case 'ssh':
        exec('systemctl stop ssh');
        break;
      case 'nginx':
        exec('systemctl stop nginx');
        break;
      case 'cisco':
        exec('systemctl stop vpnagentd');
        break;
    }
    res.json({ success: true, message: `${core} stopped successfully` });
  } catch (error) {
    res.status(500).json({ error: `Failed to stop ${core}` });
  }
});

// Restart core
app.post('/api/cores/:core/restart', authenticateToken, (req, res) => {
  const { core } = req.params;
  if (!SUPPORTED_VPN_CORES.includes(core)) return res.status(400).json({ error: 'Unsupported core' });
  
  try {
    switch (core) {
      case 'xray':
        exec('systemctl restart xray');
        break;
      case 'openvpn':
        exec('systemctl restart openvpn@server');
        break;
      case 'wireguard':
        exec('systemctl restart wg-quick@wg0');
        break;
      case 'ssh':
        exec('systemctl restart ssh');
        break;
      case 'nginx':
        exec('systemctl restart nginx');
        break;
      case 'cisco':
        exec('systemctl restart vpnagentd');
        break;
    }
    res.json({ success: true, message: `${core} restarted successfully` });
  } catch (error) {
    res.status(500).json({ error: `Failed to restart ${core}` });
  }
});

// System Monitoring APIs
const os = require('os');

// Get system statistics
app.get('/api/monitoring/stats', authenticateToken, async (req, res) => {
  try {
    const os = require('os');
    // --- CPU Usage ---
    // نمونه‌گیری کوتاه مدت برای محاسبه درصد استفاده CPU
    function getCPUUsage() {
      return new Promise(resolve => {
        const start = os.cpus();
        setTimeout(() => {
          const end = os.cpus();
          let idleDiff = 0, totalDiff = 0;
          for (let i = 0; i < start.length; i++) {
            const startTotal = Object.values(start[i].times).reduce((a, b) => a + b, 0);
            const endTotal = Object.values(end[i].times).reduce((a, b) => a + b, 0);
            const startIdle = start[i].times.idle;
            const endIdle = end[i].times.idle;
            idleDiff += endIdle - startIdle;
            totalDiff += endTotal - startTotal;
          }
          const cpuUsage = 100 - Math.round((idleDiff / totalDiff) * 100);
          resolve(cpuUsage);
        }, 300);
      });
    }

    // --- Memory Usage ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // --- Disk Usage ---
    function getDiskUsage() {
      return new Promise(resolve => {
        require('child_process').exec('df --output=pcent / | tail -1', (err, stdout) => {
          if (err) return resolve(0);
          const match = stdout.match(/(\d+)%/);
          resolve(match ? parseInt(match[1]) : 0);
        });
      });
    }

    // --- Network Traffic (مجموع ارسال و دریافت از زمان بوت) ---
    function getNetworkTraffic() {
      try {
        const netDev = fs.readFileSync('/proc/net/dev', 'utf8');
        let upload = 0, download = 0;
        netDev.split('\n').forEach(line => {
          if (line.includes(':')) {
            const parts = line.split(':');
            const data = parts[1].trim().split(/\s+/);
            download += parseInt(data[0]); // bytes received
            upload += parseInt(data[8]);   // bytes sent
          }
        });
        // تبدیل به MB
        return { upload: +(upload / 1024 / 1024).toFixed(2), download: +(download / 1024 / 1024).toFixed(2) };
      } catch {
        return { upload: 0, download: 0 };
      }
    }

    // اجرای موازی
    const [cpu, disk] = await Promise.all([
      getCPUUsage(),
      getDiskUsage()
    ]);
    const net = getNetworkTraffic();

    res.json({
      cpu,
      memory: memoryUsage,
      disk,
      upload: net.upload,
      download: net.download
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Get VPN core status
app.get('/api/monitoring/vpn-status', authenticateToken, (req, res) => {
  try {
    const status = {};
    
    // Check each VPN core status
    SUPPORTED_VPN_CORES.forEach(core => {
      let running = false;
      try {
        switch (core) {
          case 'xray':
            const xrayResult = exec('systemctl is-active xray', { encoding: 'utf8' });
            running = xrayResult.trim() === 'active';
            break;
          case 'openvpn':
            const openvpnResult = exec('systemctl is-active openvpn@server', { encoding: 'utf8' });
            running = openvpnResult.trim() === 'active';
            break;
          case 'wireguard':
            const wireguardResult = exec('systemctl is-active wg-quick@wg0', { encoding: 'utf8' });
            running = wireguardResult.trim() === 'active';
            break;
          case 'ssh':
            const sshResult = exec('systemctl is-active ssh', { encoding: 'utf8' });
            running = sshResult.trim() === 'active';
            break;
          case 'nginx':
            const nginxResult = exec('systemctl is-active nginx', { encoding: 'utf8' });
            running = nginxResult.trim() === 'active';
            break;
          case 'cisco':
            const ciscoResult = exec('systemctl is-active vpnagentd', { encoding: 'utf8' });
            running = ciscoResult.trim() === 'active';
            break;
        }
      } catch {
        running = false;
      }
      status[core] = running;
    });
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get VPN status' });
  }
});

// Get system logs
app.get('/api/monitoring/logs/:type', authenticateToken, (req, res) => {
  const { type } = req.params;
  
  try {
    let logPath = '';
    switch (type) {
      case 'system':
        logPath = '/var/log/syslog';
        break;
      case 'xray':
        logPath = '/var/log/xray/access.log';
        break;
      case 'openvpn':
        logPath = '/var/log/openvpn/openvpn.log';
        break;
      case 'wireguard':
        logPath = '/var/log/wireguard.log';
        break;
      case 'nginx':
        logPath = '/var/log/nginx/access.log';
        break;
      default:
        return res.status(400).json({ error: 'Invalid log type' });
    }
    
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [] });
    }
    
    // Read last 100 lines of log file
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n').slice(-100);
    
    const logs = lines.map(line => {
      if (!line.trim()) return null;
      
      // Simple log parsing (in production you'd want more sophisticated parsing)
      const timestamp = new Date().toISOString();
      const level = line.includes('ERROR') ? 'error' : 
                   line.includes('WARN') ? 'warning' : 
                   line.includes('INFO') ? 'info' : 'debug';
      
      return {
        timestamp: timestamp,
        level: level,
        message: line
      };
    }).filter(log => log !== null);
    
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// Clear logs
app.post('/api/monitoring/logs/:type/clear', authenticateToken, (req, res) => {
  const { type } = req.params;
  
  try {
    let logPath = '';
    switch (type) {
      case 'system':
        logPath = '/var/log/syslog';
        break;
      case 'xray':
        logPath = '/var/log/xray/access.log';
        break;
      case 'openvpn':
        logPath = '/var/log/openvpn/openvpn.log';
        break;
      case 'wireguard':
        logPath = '/var/log/wireguard.log';
        break;
      case 'nginx':
        logPath = '/var/log/nginx/access.log';
        break;
      default:
        return res.status(400).json({ error: 'Invalid log type' });
    }
    
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '');
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Get active connections
app.get('/api/monitoring/connections', authenticateToken, (req, res) => {
  try {
    // This is a placeholder implementation
    // In production, you'd parse actual connection data from VPN cores
    const connections = [
      {
        id: 1,
        protocol: 'VMess',
        clientIP: '192.168.1.100',
        port: 443,
        upload: 1024 * 1024 * 50, // 50 MB
        download: 1024 * 1024 * 100, // 100 MB
        connectedSince: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: 2,
        protocol: 'WireGuard',
        clientIP: '10.0.0.50',
        port: 51820,
        upload: 1024 * 1024 * 25, // 25 MB
        download: 1024 * 1024 * 75, // 75 MB
        connectedSince: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
      }
    ];
    
    res.json({ connections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// Disconnect client
app.post('/api/monitoring/connections/:id/disconnect', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  try {
    // This is a placeholder implementation
    // In production, you'd actually disconnect the client from the VPN core
    res.json({ success: true, message: `Client ${id} disconnected` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect client' });
  }
});

// Export connections
app.get('/api/monitoring/connections/export', authenticateToken, (req, res) => {
  try {
    // Same placeholder data as above
    const connections = [
      {
        id: 1,
        protocol: 'VMess',
        clientIP: '192.168.1.100',
        port: 443,
        upload: 1024 * 1024 * 50,
        download: 1024 * 1024 * 100,
        connectedSince: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        protocol: 'WireGuard',
        clientIP: '10.0.0.50',
        port: 51820,
        upload: 1024 * 1024 * 25,
        download: 1024 * 1024 * 75,
        connectedSince: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    
    res.json({ connections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export connections' });
  }
});

// ترافیک مصرفی کلاینت‌های یک inbound (شبیه‌سازی + بررسی محدودیت)
app.get('/api/inbounds/:port/clients/traffic-usage', authenticateToken, (req, res) => {
  const port = Number(req.params.port);
  try {
    const configPath = '/usr/local/etc/xray/config.json';
    if (!fs.existsSync(configPath)) return res.json({ usage: [] });
    const xrayConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const inbound = (xrayConfig.inbounds || []).find(inb => Number(inb.port) === port);
    if (!inbound) return res.json({ usage: [] });
    const clients = (inbound.settings && inbound.settings.clients) || [];
    // شبیه‌سازی ترافیک مصرفی و بررسی محدودیت
    const usage = clients.map(c => {
      const total = parseInt(c.traffic) || 1000;
      const used = Math.floor(Math.random() * (total + 500));
      let warn = false;
      let disabled = false;
      if (used >= total) {
        warn = true;
        disabled = true;
      }
      // بررسی محدودیت زمان (duration)
      let durationWarn = false;
      if (c.duration) {
        // فرض: duration بر حسب روز و تاریخ ایجاد کلاینت موجود نیست (در نسخه واقعی باید تاریخ ایجاد ذخیره شود)
        // اینجا فقط هشدار تستی می‌دهیم
        if (Math.random() > 0.8) durationWarn = true;
      }
      return {
        name: c.id || c.name,
        used,
        warn,
        disabled,
        durationWarn
      };
    });
    res.json({ usage });
  } catch {
    res.json({ usage: [] });
  }
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Anamis-XP Web Panel running on port ${PORT}`);
});