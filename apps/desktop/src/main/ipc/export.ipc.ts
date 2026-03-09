import { ipcMain } from 'electron';

import type { ArtifactKind } from '@journeyforge/shared';

import { IPC_CHANNELS } from './channels';
import { desktopApp } from '../services/journeyForgeDesktopService';

export const registerExportIpc = () => {
  ipcMain.handle(
    IPC_CHANNELS.exportsWrite,
    async (_event, input: { sessionId: string; artifactKinds: ArtifactKind[] }) => ({
      exportedPaths: await desktopApp.exportArtifacts(input.sessionId, input.artifactKinds),
    }),
  );
};
