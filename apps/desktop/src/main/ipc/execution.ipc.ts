import { ipcMain } from 'electron';

import type { ExecutionSnapshot, ExecutionTarget } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerExecutionIpc = () => {
  ipcMain.handle(IPC_CHANNELS.executionStart, async (_event, input: { sessionId: string; target: ExecutionTarget }) =>
    desktopApp.startExecution(input),
  );
  ipcMain.handle(IPC_CHANNELS.executionStatus, (): ExecutionSnapshot => desktopApp.getExecutionStatus());
  ipcMain.handle(IPC_CHANNELS.executionCancel, (_event, input: { runId: string }) => desktopApp.cancelExecution(input));
};
