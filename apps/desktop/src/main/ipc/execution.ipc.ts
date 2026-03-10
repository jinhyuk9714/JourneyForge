import { ipcMain } from 'electron';

import type { ExecutionTarget } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import type { DesktopRuntime } from '../services/journeyForgeDesktopService';

export const registerExecutionIpc = (desktopApp: DesktopRuntime) => {
  ipcMain.handle(IPC_CHANNELS.executionStart, async (_event, input: { sessionId: string; target: ExecutionTarget }) =>
    desktopApp.startExecution(input),
  );
  ipcMain.handle(IPC_CHANNELS.executionStatus, () => desktopApp.getExecutionStatus());
  ipcMain.handle(IPC_CHANNELS.executionCancel, (_event, input: { runId: string }) => desktopApp.cancelExecution(input));
};
