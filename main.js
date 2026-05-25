const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Set userData-based paths for storage in packaged apps
const userDataPath = app.getPath('userData');
process.env.PORTABLE_DATA_DIR = userDataPath;
process.env.FREELLM_DB_PATH = path.join(userDataPath, 'freeapi.db');

// Ensure database parent directory exists
const dbDir = path.dirname(process.env.FREELLM_DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Start FreeLLMAPI Server on port 3001
try {
  process.env.PORT = '3001';
  require('./freellmapi/server/dist/index.js');
  console.log('[Electron] FreeLLMAPI started successfully');
} catch (e) {
  console.error('[Electron] Failed to start FreeLLMAPI:', e);
}

// Start Gateway Server on port 3000
try {
  require('./backend/server.js');
  console.log('[Electron] Gateway server started successfully');
} catch (e) {
  console.error('[Electron] Failed to start Gateway server:', e);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'StudyNotebook',
    autoHideMenuBar: true,
    backgroundColor: '#131314',
    show: false
  });

  // Load the backend app (serving the dist frontend on port 3000/fallback)
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
