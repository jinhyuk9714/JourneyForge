import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

import { registerExportIpc } from './ipc/export.ipc';
import { registerRecordingIpc } from './ipc/recording.ipc';
import { registerSessionIpc } from './ipc/session.ipc';
import { desktopApp } from './services/journeyForgeDesktopService';

const __dirname = dirname(fileURLToPath(import.meta.url));

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 780,
    title: 'JourneyForge',
    backgroundColor: '#f8f3e8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(async () => {
  registerRecordingIpc();
  registerSessionIpc();
  registerExportIpc();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await desktopApp.dispose();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
