import { ipcMain } from 'electron';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerCredentialsIpc = () => {
  ipcMain.handle(IPC_CHANNELS.credentialsSetPlaywrightPassword, async (_event, input: { value: string }) =>
    desktopApp.setPlaywrightPassword(input.value),
  );
  ipcMain.handle(IPC_CHANNELS.credentialsClearPlaywrightPassword, () => desktopApp.clearPlaywrightPassword());
};
