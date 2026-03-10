import { ipcMain } from 'electron';

import type { ExportResult, ExportWriteInput } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerExportIpc = () => {
  ipcMain.handle(IPC_CHANNELS.exportsWrite, async (_event, input: ExportWriteInput): Promise<ExportResult> => {
    if (input.mode === 'bundle') {
      return desktopApp.exportBundle(input.sessionId, input.artifactKinds);
    }

    return {
      exportedPaths: await desktopApp.exportArtifacts(input.sessionId, input.artifactKinds ?? []),
    };
  });
};
