const { BrowserWindow, app, globalShortcut, ipcMain, Menu } = require('electron');
const path = require('node:path');

const apiUrl = (process.env.KIOSK_API_URL || 'https://media.safety-linq.com').replace(/\/+$/, '');
const assetCache = new Map();

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAssetDataUrl(rawUrl) {
  const url = new URL(rawUrl, apiUrl).toString();
  const cached = assetCache.get(url);

  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/*' },
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Image HTTP ${response.status}: ${body.slice(0, 160)}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

    assetCache.set(url, dataUrl);

    if (assetCache.size > 50) {
      assetCache.delete(assetCache.keys().next().value);
    }

    return dataUrl;
  } finally {
    clearTimeout(timeout);
  }
}

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

  ipcMain.handle('playlist:fetch', async () => {
    return fetchJson(`${apiUrl}/api/playlist`);
  });

  ipcMain.handle('asset:resolve', async (_event, url) => {
    return fetchAssetDataUrl(url);
  });

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
