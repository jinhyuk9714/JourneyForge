import { ipcMain } from 'electron';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerSessionIpc = () => {
  ipcMain.handle(IPC_CHANNELS.sessionsList, () => desktopApp.listSessions());
  ipcMain.handle(IPC_CHANNELS.sessionsGet, async (_event, input: { sessionId: string }) =>
    desktopApp.getSession(input.sessionId),
  );
};
