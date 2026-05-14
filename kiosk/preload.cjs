const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kioskConfig', {
  apiUrl: process.env.KIOSK_API_URL || 'https://media.safety-linq.com'
});

contextBridge.exposeInMainWorld('kioskApi', {
  fetchPlaylist: () => ipcRenderer.invoke('playlist:fetch')
});
