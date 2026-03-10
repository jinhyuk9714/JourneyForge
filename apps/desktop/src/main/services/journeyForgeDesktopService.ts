import { resolve } from 'node:path';

import { createJourneyForgeApp } from '@journeyforge/core';
import type {
  ArtifactKind,
  ExecutionSnapshot,
  ExecutionTarget,
  ExportResult,
  JourneyForgeSettings,
  RecorderStatus,
  SessionBundle,
  SessionSummary,
  SettingsPayload,
} from '@journeyforge/shared';
import type { RecorderServiceOptions } from '@journeyforge/core';

import { createCredentialService } from './credentialService';
import { createExecutionService } from './executionService';

export type DesktopRuntime = {
  startRecording(input: { baseUrl: string }): Promise<{ sessionId: string }>;
  getRecorderStatus(): RecorderStatus | Promise<RecorderStatus>;
  stopRecording(sessionId: string): Promise<SessionBundle>;
  listSessions(): Promise<SessionSummary[]>;
  getSession(sessionId: string): Promise<SessionBundle>;
  exportArtifacts(sessionId: string, artifactKinds: ArtifactKind[]): Promise<string[]>;
  exportBundle(sessionId: string, artifactKinds?: ArtifactKind[]): Promise<ExportResult>;
  getSettings(): Promise<SettingsPayload>;
  updateSettings(settings: JourneyForgeSettings): Promise<SettingsPayload>;
  setPlaywrightPassword(value: string): Promise<{ configured: true }>;
  clearPlaywrightPassword(): Promise<{ configured: false }>;
  startExecution(input: { sessionId: string; target: ExecutionTarget }): Promise<{ runId: string }>;
  getExecutionStatus(): ExecutionSnapshot | Promise<ExecutionSnapshot>;
  cancelExecution(input: { runId: string }): Promise<{ cancelled: boolean }>;
  onExecutionUpdate(listener: (snapshot: ExecutionSnapshot) => void): () => void;
  dispose(): Promise<void>;
};

type CreateJourneyForgeDesktopRuntimeOptions = {
  dataDir?: string;
  recorder?: Omit<RecorderServiceOptions, 'settings'>;
};

export const createJourneyForgeDesktopRuntime = ({
  dataDir = resolve(process.cwd(), 'data'),
  recorder,
}: CreateJourneyForgeDesktopRuntimeOptions = {}): DesktopRuntime => {
  const coreApp = createJourneyForgeApp({
    dataDir,
    recorder,
  });
  const credentialService = createCredentialService();
  const executionService = createExecutionService({
    dataDir,
    desktopApp: {
      exportBundle: (sessionId) => coreApp.exportBundle(sessionId),
      getSession: (sessionId) => coreApp.getSession(sessionId),
      getSettings: () => coreApp.getSettings(),
    },
    credentialStore: credentialService,
  });

  const getSettingsPayload = async (): Promise<SettingsPayload> => ({
    settings: await coreApp.getSettings(),
    credentialStatus: await credentialService.getStatus(),
  });

  return {
    startRecording(input: { baseUrl: string }) {
      return coreApp.startRecording(input);
    },
    getRecorderStatus() {
      return coreApp.getRecorderStatus();
    },
    stopRecording(sessionId: string) {
      return coreApp.stopRecording(sessionId);
    },
    listSessions() {
      return coreApp.listSessions();
    },
    getSession(sessionId: string) {
      return coreApp.getSession(sessionId);
    },
    exportArtifacts(sessionId: string, artifactKinds: ArtifactKind[]) {
      return coreApp.exportArtifacts(sessionId, artifactKinds);
    },
    exportBundle(sessionId: string, artifactKinds?: ArtifactKind[]) {
      return coreApp.exportBundle(sessionId, artifactKinds);
    },
    getSettings() {
      return getSettingsPayload();
    },
    async updateSettings(settings: JourneyForgeSettings) {
      await coreApp.updateSettings(settings);
      return getSettingsPayload();
    },
    async setPlaywrightPassword(value: string) {
      await credentialService.setPlaywrightPassword(value);
      return { configured: true as const };
    },
    async clearPlaywrightPassword() {
      await credentialService.clearPlaywrightPassword();
      return { configured: false as const };
    },
    startExecution(input: { sessionId: string; target: ExecutionTarget }) {
      return executionService.start(input);
    },
    getExecutionStatus(): ExecutionSnapshot {
      return executionService.getStatus();
    },
    cancelExecution(input: { runId: string }) {
      return executionService.cancel(input);
    },
    onExecutionUpdate(listener: (snapshot: ExecutionSnapshot) => void) {
      return executionService.subscribe(listener);
    },
    async dispose() {
      await executionService.dispose();
      await coreApp.dispose();
    },
  };
};
