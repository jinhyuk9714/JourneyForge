import { resolve } from 'node:path';

import { createJourneyForgeApp } from '@journeyforge/core';
import type {
  ExecutionSnapshot,
  ExecutionTarget,
  JourneyForgeSettings,
  SettingsPayload,
} from '@journeyforge/shared';

import { createCredentialService } from './credentialService';
import { createExecutionService } from './executionService';

const dataDir = resolve(process.cwd(), 'data');
const coreApp = createJourneyForgeApp({
  dataDir,
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

export const desktopApp = {
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
  exportArtifacts(sessionId: string, artifactKinds: Parameters<typeof coreApp.exportArtifacts>[1]) {
    return coreApp.exportArtifacts(sessionId, artifactKinds);
  },
  exportBundle(sessionId: string, artifactKinds?: Parameters<typeof coreApp.exportBundle>[1]) {
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
