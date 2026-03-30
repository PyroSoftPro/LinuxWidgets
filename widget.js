// ═══════════════════════════════════════════════════════════
// Linux Widgets - Widget Renderer (all types)
// ═══════════════════════════════════════════════════════════

const content = document.getElementById('widget-content');
const settingsPanel = document.getElementById('settings-panel');
const settingsBody = document.getElementById('settings-body');
const accentBar = document.getElementById('accent-bar');
const shell = document.getElementById('widget-shell');

// Parse query params
const params = new URLSearchParams(window.location.search);
const WIDGET_ID = params.get('id');
const WIDGET_TYPE = params.get('type');

let settings = {};
let updateTimer = null;

// ── Init ──
window.api.onWidgetConfig((cfg) => {
  settings = cfg.settings || {};
  applyTheme();
  initWidget();
});

window.api.onSettingsUpdated((s) => {
  settings = s;
  applyTheme();
  initWidget();
});

// Controls
document.getElementById('btn-close').addEventListener('click', () => window.api.closeWidget(WIDGET_ID));
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  if (!settingsPanel.classList.contains('hidden')) renderSettings();
});
document.getElementById('settings-close').addEventListener('click', () => settingsPanel.classList.add('hidden'));

function applyTheme() {
  const accent = settings.accentColor || '#60a5fa';
  const opacity = settings.opacity ?? 0.7;
  const blur = settings.blur ?? 20;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--opacity', opacity);
  document.documentElement.style.setProperty('--blur', blur + 'px');
  accentBar.style.background = `linear-gradient(90deg, transparent, ${accent}, transparent)`;
}

// ══════════════════════════════════════════════════════════
// WIDGET RENDERERS
// ══════════════════════════════════════════════════════════

function initWidget() {
  if (updateTimer) clearInterval(updateTimer);
  const renderers = { weather: initWeather, system: initSystem, network: initNetwork, sticky: initSticky, calendar: initCalendar, clock: initClock };
  const init = renderers[WIDGET_TYPE];
  if (init) init();
}

// ── WEATHER ─────────────────────────────────────────────
const WMO_CODES = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Dense drizzle', '🌧️'],
  61: ['Slight rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  71: ['Slight snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '❄️'],
  80: ['Rain showers', '🌦️'], 81: ['Moderate showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Severe thunderstorm', '🌩️'],
};

function initWeather() {
  content.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-dim)">Loading weather...</div>';
  fetchWeather();
  updateTimer = setInterval(fetchWeather, (settings.updateInterval || 600) * 1000);
}

async function fetchWeather() {
  const data = await window.api.getWeather();
  if (data.error) { content.innerHTML = `<div style="padding:20px;color:#ef4444">Error: ${data.error}</div>`; return; }

  const cur = data.current;
  const daily = data.daily;
  const code = WMO_CODES[cur.weather_code] || ['Unknown', '❓'];
  const unit = settings.unit === 'F' ? '°F' : '°C';
  const temp = settings.unit === 'F' ? (cur.temperature_2m * 9/5 + 32).toFixed(0) : cur.temperature_2m.toFixed(0);
  const feelsLike = settings.unit === 'F' ? (cur.apparent_temperature * 9/5 + 32).toFixed(0) : cur.apparent_temperature.toFixed(0);

  let forecastHtml = '';
  if (daily && daily.time) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    forecastHtml = '<div class="weather-forecast">';
    for (let i = 1; i < Math.min(daily.time.length, 6); i++) {
      const d = new Date(daily.time[i]);
      const dayCode = WMO_CODES[daily.weather_code[i]] || ['','❓'];
      const hi = settings.unit === 'F' ? (daily.temperature_2m_max[i]*9/5+32).toFixed(0) : daily.temperature_2m_max[i].toFixed(0);
      const lo = settings.unit === 'F' ? (daily.temperature_2m_min[i]*9/5+32).toFixed(0) : daily.temperature_2m_min[i].toFixed(0);
      forecastHtml += `<div class="forecast-day">
        <div class="day-name">${days[d.getDay()]}</div>
        <div class="day-icon">${dayCode[1]}</div>
        <div class="day-temps"><span class="day-hi">${hi}°</span> <span class="day-lo">${lo}°</span></div>
      </div>`;
    }
    forecastHtml += '</div>';
  }

  content.innerHTML = `
    <div class="weather-wrap">
      <div class="weather-current">
        <div class="weather-city">${data.city || 'Unknown Location'}</div>
        <div class="weather-icon-large">${code[1]}</div>
        <div class="weather-temp">${temp}<span>${unit}</span></div>
        <div class="weather-desc">${code[0]}</div>
        <div class="weather-details">
          <span>🌡️ Feels ${feelsLike}${unit}</span>
          <span>💧 ${cur.relative_humidity_2m}%</span>
          <span>💨 ${cur.wind_speed_10m} km/h</span>
        </div>
      </div>
      ${forecastHtml}
    </div>
  `;
}

// ── SYSTEM ──────────────────────────────────────────────
function initSystem() {
  content.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-dim)">Loading...</div>';
  fetchSystem();
  updateTimer = setInterval(fetchSystem, (settings.updateInterval || 2) * 1000);
}

function makeGauge(pct, color, label, sub) {
  const r = 35, c = 2 * Math.PI * r;
  const offset = c - (c * Math.min(pct, 100) / 100);
  return `<div class="gauge-card">
    <div class="gauge-label">${label}</div>
    <div class="gauge-ring">
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="${r}" class="track"/>
        <circle cx="40" cy="40" r="${r}" class="fill" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="gauge-value">${pct.toFixed(0)}%</div>
    </div>
    <div class="gauge-sub">${sub}</div>
  </div>`;
}

async function fetchSystem() {
  const info = await window.api.getSystemInfo();
  if (info.error) { content.innerHTML = `<div style="padding:20px;color:#ef4444">${info.error}</div>`; return; }

  const accent = settings.accentColor || '#a78bfa';
  let gauges = '<div class="sys-wrap"><div class="sys-gauges">';

  if (settings.showCpu !== false) {
    gauges += makeGauge(info.cpu.load, accent, 'CPU', `${info.cpu.cores.length} cores`);
  }
  if (settings.showRam !== false) {
    const used = (info.mem.used / 1073741824).toFixed(1);
    const total = (info.mem.total / 1073741824).toFixed(1);
    gauges += makeGauge(info.mem.percent, '#34d399', 'RAM', `${used} / ${total} GB`);
  }
  if (settings.showDisk !== false && info.disk.length > 0) {
    const d = info.disk[0];
    gauges += makeGauge(d.use, '#fbbf24', 'Disk', `${(d.used/1073741824).toFixed(0)} / ${(d.size/1073741824).toFixed(0)} GB`);
  }
  if (settings.showTemp !== false && info.temp.main > 0) {
    const tempPct = Math.min(info.temp.main / 100 * 100, 100);
    gauges += makeGauge(tempPct, '#ef4444', 'Temp', `${info.temp.main.toFixed(0)}°C`);
  }

  gauges += '</div>';

  const uptimeH = Math.floor(info.uptime / 3600);
  const uptimeM = Math.floor((info.uptime % 3600) / 60);
  gauges += `<div class="sys-info-row">
    <span>${info.os.hostname}</span>
    <span>Up ${uptimeH}h ${uptimeM}m</span>
  </div></div>`;

  content.innerHTML = gauges;
}

// ── NETWORK ─────────────────────────────────────────────
const netHistory = { rx: new Array(60).fill(0), tx: new Array(60).fill(0) };
let netCanvas = null;

function initNetwork() {
  content.innerHTML = `
    <div class="net-wrap">
      <div class="net-speeds">
        <div class="net-speed-card download">
          <div class="direction">↓ Down</div>
          <div class="speed-value" id="net-rx">0</div>
          <div class="speed-unit">KB/s</div>
        </div>
        <div class="net-speed-card upload">
          <div class="direction">↑ Up</div>
          <div class="speed-value" id="net-tx">0</div>
          <div class="speed-unit">KB/s</div>
        </div>
      </div>
      <div class="net-graph"><canvas id="net-canvas"></canvas></div>
      <div class="net-info">
        <span class="label">Interface</span><span class="value" id="net-iface">-</span>
        <span class="label">IP Address</span><span class="value" id="net-ip">-</span>
        <span class="label">MAC</span><span class="value" id="net-mac">-</span>
        <span class="label">Total ↓</span><span class="value" id="net-total-rx">-</span>
        <span class="label">Total ↑</span><span class="value" id="net-total-tx">-</span>
      </div>
    </div>`;
  netCanvas = document.getElementById('net-canvas');
  fetchNetwork();
  updateTimer = setInterval(fetchNetwork, (settings.updateInterval || 1) * 1000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes.toFixed(0) + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

async function fetchNetwork() {
  const info = await window.api.getNetworkInfo();
  if (info.error) return;

  const rxKB = (info.rxSpeed / 1024).toFixed(1);
  const txKB = (info.txSpeed / 1024).toFixed(1);

  document.getElementById('net-rx').textContent = rxKB;
  document.getElementById('net-tx').textContent = txKB;
  document.getElementById('net-iface').textContent = info.iface;
  document.getElementById('net-ip').textContent = info.ip4;
  document.getElementById('net-mac').textContent = info.mac;
  document.getElementById('net-total-rx').textContent = formatBytes(info.rx_bytes);
  document.getElementById('net-total-tx').textContent = formatBytes(info.tx_bytes);

  netHistory.rx.push(info.rxSpeed / 1024);
  netHistory.tx.push(info.txSpeed / 1024);
  netHistory.rx.shift();
  netHistory.tx.shift();
  drawNetGraph();
}

function drawNetGraph() {
  if (!netCanvas) return;
  const ctx = netCanvas.getContext('2d');
  const w = netCanvas.parentElement.clientWidth;
  const h = netCanvas.parentElement.clientHeight;
  netCanvas.width = w * 2;
  netCanvas.height = h * 2;
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(10, ...netHistory.rx, ...netHistory.tx);
  const len = netHistory.rx.length;

  function drawLine(data, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = h - (data[i] / maxVal) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color.replace('1)', '0.1)');
    ctx.fill();
  }

  drawLine(netHistory.rx, 'rgba(52, 211, 153, 1)');
  drawLine(netHistory.tx, 'rgba(96, 165, 250, 1)');
}

// ── STICKY NOTE ─────────────────────────────────────────
function initSticky() {
  const noteColor = settings.noteColor || '#fbbf24';
  const fontSize = settings.fontSize || 14;

  content.innerHTML = `
    <div class="sticky-body">
      <textarea class="sticky-textarea" id="sticky-text"
        placeholder="Type your note here..."
        style="font-size:${fontSize}px">${settings.text || ''}</textarea>
      <div class="sticky-footer"><span id="sticky-chars">0</span> characters</div>
    </div>`;

  const textarea = document.getElementById('sticky-text');
  const charCount = document.getElementById('sticky-chars');

  charCount.textContent = textarea.value.length;

  textarea.addEventListener('input', () => {
    charCount.textContent = textarea.value.length;
    settings.text = textarea.value;
    window.api.updateSettings(WIDGET_ID, { text: textarea.value });
  });
}

// ── CALENDAR ────────────────────────────────────────────
let calDate = new Date();

function initCalendar() {
  renderCalendar();
}

function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const today = new Date();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = settings.weekStart === 'sun' ? ['Su','Mo','Tu','We','Th','Fr','Sa'] : ['Mo','Tu','We','Th','Fr','Sa','Su'];

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  if (settings.weekStart !== 'sun') startDay = (startDay + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let cells = '';

  // Day headers
  dayNames.forEach(d => { cells += `<div class="day-header">${d}</div>`; });

  // Previous month fill
  for (let i = startDay - 1; i >= 0; i--) {
    cells += `<div class="day-cell other-month">${daysInPrevMonth - i}</div>`;
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const dow = new Date(year, month, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    let cls = 'day-cell';
    if (isToday) cls += ' today';
    else if (isWeekend) cls += ' weekend';
    cells += `<div class="${cls}">${d}</div>`;
  }

  // Next month fill
  const totalCells = startDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells += `<div class="day-cell other-month">${d}</div>`;
  }

  content.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-header">
        <button id="cal-prev">
          <svg width="14" height="14" viewBox="0 0 20 20"><polyline points="12 4 6 10 12 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <span class="month-name">${monthNames[month]}</span>
        <button id="cal-next">
          <svg width="14" height="14" viewBox="0 0 20 20"><polyline points="8 4 14 10 8 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-year">${year}</div>
    </div>
  `;

  document.getElementById('cal-prev').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });
}

// ── CLOCK ───────────────────────────────────────────────
function initClock() {
  content.innerHTML = '<div class="clock-display"><div class="clock-time" id="clock-time"></div><div class="clock-date" id="clock-date"></div></div>';
  updateClock();
  updateTimer = setInterval(updateClock, 200);
}

function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  let ampm = '';

  if (!settings.format24) {
    ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  h = String(h).padStart(2, '0');

  let timeStr = `${h}:${m}`;
  if (settings.showSeconds !== false) timeStr += `<span class="clock-seconds">${s}</span>`;
  if (!settings.format24) timeStr += `<span class="clock-ampm">${ampm}</span>`;

  document.getElementById('clock-time').innerHTML = timeStr;

  if (settings.showDate !== false) {
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('clock-date').textContent = now.toLocaleDateString(undefined, opts);
  }
}

// ══════════════════════════════════════════════════════════
// SETTINGS PANEL RENDERER
// ══════════════════════════════════════════════════════════

function renderSettings() {
  let rows = '';

  // Shared settings
  rows += settingColor('Accent Color', 'accentColor', settings.accentColor || '#60a5fa');
  rows += settingRange('Opacity', 'opacity', settings.opacity ?? 0.7, 0.1, 1, 0.05);
  rows += settingRange('Blur', 'blur', settings.blur ?? 20, 0, 40, 1);
  rows += '<div class="setting-divider"></div>';

  // Type-specific
  switch (WIDGET_TYPE) {
    case 'weather':
      rows += settingSelect('Unit', 'unit', settings.unit || 'C', { C: 'Celsius', F: 'Fahrenheit' });
      rows += settingNumber('Update (sec)', 'updateInterval', settings.updateInterval || 600, 60, 3600);
      break;

    case 'system':
      rows += settingToggle('Show CPU', 'showCpu', settings.showCpu !== false);
      rows += settingToggle('Show RAM', 'showRam', settings.showRam !== false);
      rows += settingToggle('Show Disk', 'showDisk', settings.showDisk !== false);
      rows += settingToggle('Show Temp', 'showTemp', settings.showTemp !== false);
      rows += settingNumber('Update (sec)', 'updateInterval', settings.updateInterval || 2, 1, 30);
      break;

    case 'network':
      rows += settingToggle('Show IP', 'showIp', settings.showIp !== false);
      rows += settingNumber('Update (sec)', 'updateInterval', settings.updateInterval || 1, 1, 10);
      break;

    case 'sticky':
      rows += settingColor('Note Color', 'noteColor', settings.noteColor || '#fbbf24');
      rows += settingNumber('Font Size', 'fontSize', settings.fontSize || 14, 10, 24);
      break;

    case 'calendar':
      rows += settingSelect('Week Start', 'weekStart', settings.weekStart || 'mon', { mon: 'Monday', sun: 'Sunday' });
      break;

    case 'clock':
      rows += settingToggle('24h Format', 'format24', settings.format24 !== false);
      rows += settingToggle('Show Seconds', 'showSeconds', settings.showSeconds !== false);
      rows += settingToggle('Show Date', 'showDate', settings.showDate !== false);
      break;
  }

  settingsBody.innerHTML = rows;

  // Bind change events
  settingsBody.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    const handler = () => {
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'range' || el.type === 'number') val = parseFloat(el.value);
      else val = el.value;
      settings[key] = val;
      window.api.updateSettings(WIDGET_ID, { [key]: val });
      applyTheme();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
}

function settingColor(label, key, value) {
  return `<div class="setting-row"><label>${label}</label><input type="color" data-key="${key}" value="${value}"></div>`;
}
function settingRange(label, key, value, min, max, step) {
  return `<div class="setting-row"><label>${label}</label><input type="range" data-key="${key}" value="${value}" min="${min}" max="${max}" step="${step}"></div>`;
}
function settingNumber(label, key, value, min, max) {
  return `<div class="setting-row"><label>${label}</label><input type="number" data-key="${key}" value="${value}" min="${min}" max="${max}" style="width:70px"></div>`;
}
function settingToggle(label, key, checked) {
  return `<div class="setting-row"><label>${label}</label><label class="toggle"><input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}><span class="slider"></span></label></div>`;
}
function settingSelect(label, key, value, options) {
  const opts = Object.entries(options).map(([k,v]) => `<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
  return `<div class="setting-row"><label>${label}</label><select data-key="${key}">${opts}</select></div>`;
}
