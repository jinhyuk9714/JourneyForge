import { ipcMain } from 'electron';

import { IPC_CHANNELS } from './channels';
import type { DesktopRuntime } from '../services/journeyForgeDesktopService';

export const registerCredentialsIpc = (desktopApp: DesktopRuntime) => {
  ipcMain.handle(IPC_CHANNELS.credentialsSetPlaywrightPassword, async (_event, input: { value: string }) =>
    desktopApp.setPlaywrightPassword(input.value),
  );
  ipcMain.handle(IPC_CHANNELS.credentialsClearPlaywrightPassword, () => desktopApp.clearPlaywrightPassword());
};
