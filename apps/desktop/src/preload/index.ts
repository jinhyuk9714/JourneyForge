import { contextBridge, ipcRenderer } from 'electron';

import type {
  ArtifactKind,
  ExecutionSnapshot,
  ExecutionTarget,
  ExportResult,
  ExportWriteInput,
  JourneyForgeSettings,
  RecorderStatus,
  SettingsPayload,
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
    get(): Promise<SettingsPayload>;
    update(input: JourneyForgeSettings): Promise<SettingsPayload>;
  };
  execution: {
    start(input: { sessionId: string; target: ExecutionTarget }): Promise<{ runId: string }>;
    status(): Promise<ExecutionSnapshot>;
    cancel(input: { runId: string }): Promise<{ cancelled: boolean }>;
    subscribe(listener: (snapshot: ExecutionSnapshot) => void): () => void;
  };
  credentials: {
    setPlaywrightPassword(input: { value: string }): Promise<{ configured: true }>;
    clearPlaywrightPassword(): Promise<{ configured: false }>;
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
  execution: {
    start: (input) => ipcRenderer.invoke(IPC_CHANNELS.executionStart, input),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.executionStatus),
    cancel: (input) => ipcRenderer.invoke(IPC_CHANNELS.executionCancel, input),
    subscribe: (listener) => {
      const handler = (_event: unknown, snapshot: ExecutionSnapshot) => {
        listener(snapshot);
      };
      ipcRenderer.on(IPC_CHANNELS.executionUpdate, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.executionUpdate, handler);
      };
    },
  },
  credentials: {
    setPlaywrightPassword: (input) => ipcRenderer.invoke(IPC_CHANNELS.credentialsSetPlaywrightPassword, input),
    clearPlaywrightPassword: () => ipcRenderer.invoke(IPC_CHANNELS.credentialsClearPlaywrightPassword),
  },
};

contextBridge.exposeInMainWorld('journeyforge', api);
