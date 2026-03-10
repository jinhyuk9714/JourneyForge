import { ipcMain } from 'electron';

import { IPC_CHANNELS } from './channels';
import type { DesktopRuntime } from '../services/journeyForgeDesktopService';

export const registerSessionIpc = (desktopApp: DesktopRuntime) => {
  ipcMain.handle(IPC_CHANNELS.sessionsList, () => desktopApp.listSessions());
  ipcMain.handle(IPC_CHANNELS.sessionsGet, async (_event, input: { sessionId: string }) =>
    desktopApp.getSession(input.sessionId),
  );
};
