import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type {
  ArtifactKind,
  ExportResult,
  JourneyForgeSettings,
  RecordedSession,
  SessionBundle,
  SessionSummary,
} from '@journeyforge/shared';

import { buildJourneyArtifacts } from './generators';
import { normalizeSession } from './normalizeSession';
import { createRecorderService } from './recorder/recorderService';
import type { RecorderServiceOptions } from './recorder/recorderService';
import { createStorageRepository, persistSessionBundle } from './storage';

type JourneyForgeAppOptions = {
  dataDir?: string;
  settings?: JourneyForgeSettings;
  recorder?: Omit<RecorderServiceOptions, 'settings'>;
};

export const createJourneyForgeApp = (options: JourneyForgeAppOptions = {}) => {
  const repository = createStorageRepository({
    dataDir: options.dataDir,
    defaultSettings: options.settings ?? DEFAULT_SETTINGS,
  });
  const recorder = createRecorderService({
    settings: options.settings ?? DEFAULT_SETTINGS,
    ...options.recorder,
  });

  return {
    repository,
    recorder,
    async getSettings() {
      return repository.getSettings();
    },
    async updateSettings(settings: JourneyForgeSettings) {
      await repository.saveSettings(settings);
      return repository.getSettings();
    },
    async startRecording(input: { baseUrl: string; name?: string }) {
      const settings = await repository.getSettings();
      return recorder.startRecording({
        ...input,
        settingsSnapshot: settings,
      });
    },
    getRecorderStatus() {
      return recorder.getStatus();
    },
    async stopRecording(sessionId: string): Promise<SessionBundle> {
      const session = await recorder.stopRecording(sessionId);
      return this.analyzeRecordedSession(session);
    },
    async analyzeRecordedSession(session: RecordedSession): Promise<SessionBundle> {
      const settings = session.settingsSnapshot ?? (await repository.getSettings());
      const sessionWithSnapshot =
        session.settingsSnapshot
          ? session
          : {
              ...session,
              settingsSnapshot: settings,
            };
      const journey = normalizeSession(sessionWithSnapshot, settings);
      const artifacts = buildJourneyArtifacts(journey, settings);
      await persistSessionBundle({
        repository,
        session: sessionWithSnapshot,
        journey,
        artifacts,
      });

      return {
        session: sessionWithSnapshot,
        journey,
        artifacts,
      };
    },
    async listSessions(): Promise<SessionSummary[]> {
      return repository.listSessions();
    },
    async getSession(sessionId: string): Promise<SessionBundle> {
      return repository.getSessionBundle(sessionId);
    },
    async exportArtifacts(sessionId: string, artifactKinds: ArtifactKind[]) {
      return repository.exportArtifacts(sessionId, artifactKinds);
    },
    async exportBundle(sessionId: string, artifactKinds?: ArtifactKind[]): Promise<ExportResult> {
      return repository.exportBundle(sessionId, artifactKinds);
    },
    async dispose() {
      await recorder.dispose();
    },
  };
};
