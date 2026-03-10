import { ipcMain } from 'electron';

import type { JourneyForgeSettings } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerSettingsIpc = () => {
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => desktopApp.getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, input: JourneyForgeSettings) =>
    desktopApp.updateSettings(input),
  );
};
