import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

import { registerCredentialsIpc } from './ipc/credentials.ipc';
import { registerExecutionIpc } from './ipc/execution.ipc';
import { registerExportIpc } from './ipc/export.ipc';
import { registerRecordingIpc } from './ipc/recording.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerSessionIpc } from './ipc/session.ipc';
import { IPC_CHANNELS } from './ipc/channels';
import { createDesktopRuntime } from './services/desktopRuntimeFactory';
import type { DesktopRuntime } from './services/journeyForgeDesktopService';

const __dirname = dirname(fileURLToPath(import.meta.url));
let desktopApp: DesktopRuntime | null = null;

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'JourneyForge',
    backgroundColor: '#f8f3e8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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
  desktopApp = createDesktopRuntime({
    defaultDataDir: app.isPackaged ? join(app.getPath('userData'), 'data') : undefined,
  });

  registerRecordingIpc(desktopApp);
  registerSessionIpc(desktopApp);
  registerExportIpc(desktopApp);
  registerSettingsIpc(desktopApp);
  registerExecutionIpc(desktopApp);
  registerCredentialsIpc(desktopApp);
  desktopApp.onExecutionUpdate((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.executionUpdate, snapshot);
    }
  });
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await desktopApp?.dispose();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
