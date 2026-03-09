import { contextBridge, ipcRenderer } from 'electron';

import type { ArtifactKind, RecorderStatus, SessionBundle, SessionSummary } from '@journeyforge/shared';

import { IPC_CHANNELS } from '../main/ipc/channels';

export type JourneyForgeDesktopApi = {
  recording: {
    start(input: { baseUrl: string }): Promise<{ sessionId: string }>;
    status(): Promise<RecorderStatus>;
    stop(input: { sessionId: string }): Promise<SessionBundle>;
  };
  sessions: {
    list(): Promise<SessionSummary[]>;
    get(input: { sessionId: string }): Promise<SessionBundle>;
  };
  exports: {
    write(input: { sessionId: string; artifactKinds: ArtifactKind[] }): Promise<{ exportedPaths: string[] }>;
  };
};

const api: JourneyForgeDesktopApi = {
  recording: {
    start: (input) => ipcRenderer.invoke(IPC_CHANNELS.recordingStart, input),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.recordingStatus),
    stop: (input) => ipcRenderer.invoke(IPC_CHANNELS.recordingStop, input),
  },
  sessions: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.sessionsList),
    get: (input) => ipcRenderer.invoke(IPC_CHANNELS.sessionsGet, input),
  },
  exports: {
    write: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportsWrite, input),
  },
};

contextBridge.exposeInMainWorld('journeyforge', api);
