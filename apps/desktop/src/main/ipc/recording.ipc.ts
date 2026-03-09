import { ipcMain } from 'electron';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerRecordingIpc = () => {
  ipcMain.handle(IPC_CHANNELS.recordingStart, async (_event, input: { baseUrl: string }) =>
    desktopApp.startRecording(input),
  );
  ipcMain.handle(IPC_CHANNELS.recordingStatus, () => desktopApp.getRecorderStatus());
  ipcMain.handle(IPC_CHANNELS.recordingStop, async (_event, input: { sessionId: string }) =>
    desktopApp.stopRecording(input.sessionId),
  );
};
