import { ipcMain } from 'electron';

import type { JourneyForgeSettings, SettingsPayload } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import type { DesktopRuntime } from '../services/journeyForgeDesktopService';

export const registerSettingsIpc = (desktopApp: DesktopRuntime) => {
  ipcMain.handle(IPC_CHANNELS.settingsGet, (): Promise<SettingsPayload> => desktopApp.getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, input: JourneyForgeSettings) =>
    desktopApp.updateSettings(input),
  );
};
