const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const si = require('systeminformation');

// ── Config persistence ──────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.config', 'linux-widgets');
const CONFIG_FILE = path.join(CONFIG_DIR, 'widgets.json');

function loadConfig() {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {}
  return { widgets: [], managerBounds: null };
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) { console.error('Save config error:', e); }
}

let config = loadConfig();
let tray = null;
let managerWindow = null;
const widgetWindows = new Map(); // id -> BrowserWindow

// ── Tray icon (generated programmatically) ──────────────────
function createTrayIcon() {
  const size = 22;
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 22 22">
    <rect x="1" y="1" width="9" height="9" rx="2" fill="#60a5fa" opacity="0.9"/>
    <rect x="12" y="1" width="9" height="9" rx="2" fill="#a78bfa" opacity="0.9"/>
    <rect x="1" y="12" width="9" height="9" rx="2" fill="#34d399" opacity="0.9"/>
    <rect x="12" y="12" width="9" height="9" rx="2" fill="#fbbf24" opacity="0.9"/>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(canvas));
}

// ── Manager window ──────────────────────────────────────────
function createManagerWindow() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.show();
    managerWindow.focus();
    return;
  }

  const bounds = config.managerBounds || { width: 820, height: 620 };
  managerWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 600,
    minHeight: 480,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  managerWindow.loadFile('manager.html');

  managerWindow.on('moved', () => saveManagerBounds());
  managerWindow.on('resized', () => saveManagerBounds());
  managerWindow.on('close', (e) => {
    e.preventDefault();
    managerWindow.hide();
  });
}

function saveManagerBounds() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    config.managerBounds = managerWindow.getBounds();
    saveConfig(config);
  }
}

// ── Widget windows ──────────────────────────────────────────
function createWidgetWindow(widgetConfig) {
  const win = new BrowserWindow({
    width: widgetConfig.width || 320,
    height: widgetConfig.height || 280,
    x: widgetConfig.x,
    y: widgetConfig.y,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // On Linux, set window below others if user wants "desktop" mode
  if (widgetConfig.desktopMode) {
    win.setAlwaysOnTop(true, 'pop-up-menu', -1);
  }

  win.loadFile('widget.html', { query: { id: widgetConfig.id, type: widgetConfig.type } });

  // Forward mouse events for transparent click-through
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('widget-config', widgetConfig);
  });

  win.on('moved', () => {
    if (win.isDestroyed()) return;
    const b = win.getBounds();
    const wc = config.widgets.find(w => w.id === widgetConfig.id);
    if (wc) { wc.x = b.x; wc.y = b.y; saveConfig(config); }
  });

  win.on('resized', () => {
    if (win.isDestroyed()) return;
    const b = win.getBounds();
    const wc = config.widgets.find(w => w.id === widgetConfig.id);
    if (wc) { wc.width = b.width; wc.height = b.height; saveConfig(config); }
  });

  widgetWindows.set(widgetConfig.id, win);
  return win;
}

function spawnWidget(type) {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;

  const defaults = {
    weather:  { width: 320, height: 380 },
    system:   { width: 320, height: 420 },
    network:  { width: 320, height: 260 },
    sticky:   { width: 280, height: 280 },
    calendar: { width: 340, height: 380 },
    clock:    { width: 280, height: 160 },
  };

  const size = defaults[type] || { width: 300, height: 300 };
  const id = type + '-' + Date.now();

  // Stagger position
  const existing = config.widgets.filter(w => w.type === type).length;
  const offsetX = (existing % 5) * 40;
  const offsetY = (existing % 5) * 40;

  const wc = {
    id,
    type,
    x: Math.min(sw - size.width - 40 + offsetX, sw - 60),
    y: 40 + offsetY,
    width: size.width,
    height: size.height,
    desktopMode: false,
    settings: getDefaultSettings(type),
  };

  config.widgets.push(wc);
  saveConfig(config);
  createWidgetWindow(wc);

  // Notify manager
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.webContents.send('widgets-updated', config.widgets);
  }
  return wc;
}

function getDefaultSettings(type) {
  const shared = { accentColor: '#60a5fa', opacity: 0.7, blur: 20 };
  switch (type) {
    case 'weather':
      return { ...shared, accentColor: '#60a5fa', unit: 'C', location: 'auto', updateInterval: 600 };
    case 'system':
      return { ...shared, accentColor: '#a78bfa', showCpu: true, showRam: true, showDisk: true, showTemp: true, updateInterval: 2 };
    case 'network':
      return { ...shared, accentColor: '#34d399', iface: 'auto', showIp: true, updateInterval: 1 };
    case 'sticky':
      return { ...shared, accentColor: '#fbbf24', noteColor: '#fbbf24', text: '', fontSize: 14 };
    case 'calendar':
      return { ...shared, accentColor: '#f472b6', weekStart: 'mon', showWeekNumbers: false };
    case 'clock':
      return { ...shared, accentColor: '#fb923c', format24: true, showSeconds: true, showDate: true };
    default:
      return shared;
  }
}

// ── IPC Handlers ────────────────────────────────────────────

// Manager actions
ipcMain.handle('get-widgets', () => config.widgets);
ipcMain.handle('spawn-widget', (_, type) => spawnWidget(type));
ipcMain.handle('remove-widget', (_, id) => {
  const win = widgetWindows.get(id);
  if (win && !win.isDestroyed()) win.destroy();
  widgetWindows.delete(id);
  config.widgets = config.widgets.filter(w => w.id !== id);
  saveConfig(config);
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.webContents.send('widgets-updated', config.widgets);
  }
});

ipcMain.handle('update-widget-settings', (_, id, settings) => {
  const wc = config.widgets.find(w => w.id === id);
  if (wc) {
    wc.settings = { ...wc.settings, ...settings };
    saveConfig(config);
    const win = widgetWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings-updated', wc.settings);
    }
  }
});

ipcMain.handle('close-widget', (_, id) => {
  const win = widgetWindows.get(id);
  if (win && !win.isDestroyed()) win.destroy();
  widgetWindows.delete(id);
  config.widgets = config.widgets.filter(w => w.id !== id);
  saveConfig(config);
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.webContents.send('widgets-updated', config.widgets);
  }
});

// Window controls
ipcMain.handle('minimize-manager', () => managerWindow?.minimize());
ipcMain.handle('close-manager', () => managerWindow?.hide());

// System info
ipcMain.handle('get-system-info', async () => {
  try {
    const [cpu, mem, disk, temp, osInfo, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.cpuTemperature(),
      si.osInfo(),
      si.time(),
    ]);
    return {
      cpu: { load: cpu.currentLoad, cores: cpu.cpus.map(c => c.load) },
      mem: { total: mem.total, used: mem.used, free: mem.free, percent: (mem.used / mem.total) * 100 },
      disk: disk.map(d => ({ fs: d.fs, mount: d.mount, size: d.size, used: d.used, use: d.use })),
      temp: { main: temp.main, cores: temp.cores },
      uptime: time.uptime,
      os: { distro: osInfo.distro, release: osInfo.release, kernel: osInfo.kernel, hostname: os.hostname() },
    };
  } catch (e) { return { error: e.message }; }
});

let prevNetStats = null;
ipcMain.handle('get-network-info', async () => {
  try {
    const [ifaces, netStats, defaultIface] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      si.networkInterfaceDefault(),
    ]);
    const stats = netStats.find(n => n.iface === defaultIface) || netStats[0] || {};

    let rxSpeed = 0, txSpeed = 0;
    if (prevNetStats && prevNetStats.iface === stats.iface) {
      const dt = (stats.ms - prevNetStats.ms) / 1000 || 1;
      rxSpeed = Math.max(0, (stats.rx_bytes - prevNetStats.rx_bytes) / dt);
      txSpeed = Math.max(0, (stats.tx_bytes - prevNetStats.tx_bytes) / dt);
    }
    prevNetStats = { iface: stats.iface, rx_bytes: stats.rx_bytes, tx_bytes: stats.tx_bytes, ms: stats.ms };

    const active = ifaces.find(i => i.iface === defaultIface) || ifaces[0] || {};
    return {
      iface: active.iface || 'unknown',
      ip4: active.ip4 || 'N/A',
      ip6: active.ip6 || 'N/A',
      mac: active.mac || 'N/A',
      rxSpeed, txSpeed,
      rx_bytes: stats.rx_bytes || 0,
      tx_bytes: stats.tx_bytes || 0,
      interfaces: ifaces.map(i => i.iface),
    };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('get-weather', async (_, lat, lon) => {
  try {
    // Auto-detect location if not provided
    if (!lat || !lon) {
      const geoRes = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country');
      const geo = await geoRes.json();
      lat = geo.lat; lon = geo.lon;
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    const data = await res.json();

    // Also get city name
    let city = 'Unknown';
    try {
      const geoRes = await fetch(`http://ip-api.com/json/?fields=city,country`);
      const geo = await geoRes.json();
      city = `${geo.city}, ${geo.country}`;
    } catch {}

    return { ...data, city };
  } catch (e) { return { error: e.message }; }
});

// ── App lifecycle ───────────────────────────────────────────
app.on('ready', () => {
  // Create tray
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Linux Widgets');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Widget Manager', click: () => createManagerWindow() },
    { type: 'separator' },
    { label: 'Add Weather Widget', click: () => spawnWidget('weather') },
    { label: 'Add System Widget', click: () => spawnWidget('system') },
    { label: 'Add Network Widget', click: () => spawnWidget('network') },
    { label: 'Add Sticky Note', click: () => spawnWidget('sticky') },
    { label: 'Add Calendar', click: () => spawnWidget('calendar') },
    { label: 'Add Clock', click: () => spawnWidget('clock') },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => createManagerWindow());

  // Restore saved widgets
  for (const wc of config.widgets) {
    createWidgetWindow(wc);
  }

  // Auto-open manager on first launch
  if (config.widgets.length === 0) {
    createManagerWindow();
  }
});

app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', (e) => { /* keep running in tray */ });
