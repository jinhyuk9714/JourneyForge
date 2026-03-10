import { contextBridge, ipcRenderer } from 'electron';

import type {
  ArtifactKind,
  ExportResult,
  ExportWriteInput,
  JourneyForgeSettings,
  RecorderStatus,
  SessionBundle,
  SessionSummary,
} from '@journeyforge/shared';

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
    write(input: ExportWriteInput): Promise<ExportResult>;
  };
  settings: {
    get(): Promise<JourneyForgeSettings>;
    update(input: JourneyForgeSettings): Promise<JourneyForgeSettings>;
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
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, input),
  },
};

contextBridge.exposeInMainWorld('journeyforge', api);
