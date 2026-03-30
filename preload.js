const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Manager
  getWidgets: () => ipcRenderer.invoke('get-widgets'),
  spawnWidget: (type) => ipcRenderer.invoke('spawn-widget', type),
  removeWidget: (id) => ipcRenderer.invoke('remove-widget', id),
  closeWidget: (id) => ipcRenderer.invoke('close-widget', id),
  updateSettings: (id, settings) => ipcRenderer.invoke('update-widget-settings', id, settings),
  minimizeManager: () => ipcRenderer.invoke('minimize-manager'),
  closeManager: () => ipcRenderer.invoke('close-manager'),

  // Data
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getWeather: (lat, lon) => ipcRenderer.invoke('get-weather', lat, lon),

  // Events
  onWidgetConfig: (cb) => ipcRenderer.on('widget-config', (_, cfg) => cb(cfg)),
  onSettingsUpdated: (cb) => ipcRenderer.on('settings-updated', (_, s) => cb(s)),
  onWidgetsUpdated: (cb) => ipcRenderer.on('widgets-updated', (_, w) => cb(w)),
});
