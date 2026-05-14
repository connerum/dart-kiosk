const { BrowserWindow, app, globalShortcut, Menu } = require('electron');
const path = require('node:path');

const apiUrl = process.env.KIOSK_API_URL || 'http://localhost:4173';

function createWindow() {
  Menu.setApplicationMenu(null);

  const window = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  process.env.KIOSK_API_URL = apiUrl;
  createWindow();

  globalShortcut.register('CommandOrControl+Q', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

