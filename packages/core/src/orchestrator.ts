import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type {
  ArtifactKind,
  JourneyForgeSettings,
  RecordedSession,
  SessionBundle,
  SessionSummary,
} from '@journeyforge/shared';

import { buildJourneyArtifacts } from './generators';
import { normalizeSession } from './normalizeSession';
import { createRecorderService } from './recorder/recorderService';
import { createStorageRepository, persistSessionBundle } from './storage';

type JourneyForgeAppOptions = {
  dataDir?: string;
  settings?: JourneyForgeSettings;
};

export const createJourneyForgeApp = (options: JourneyForgeAppOptions = {}) => {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const repository = createStorageRepository({ dataDir: options.dataDir });
  const recorder = createRecorderService({ settings });

  return {
    repository,
    recorder,
    async startRecording(input: { baseUrl: string; name?: string }) {
      return recorder.startRecording(input);
    },
    getRecorderStatus() {
      return recorder.getStatus();
    },
    async stopRecording(sessionId: string): Promise<SessionBundle> {
      const session = await recorder.stopRecording(sessionId);
      return this.analyzeRecordedSession(session);
    },
    async analyzeRecordedSession(session: RecordedSession): Promise<SessionBundle> {
      const journey = normalizeSession(session);
      const artifacts = buildJourneyArtifacts(journey, settings);
      await persistSessionBundle({
        repository,
        session,
        journey,
        artifacts,
      });

      return {
        session,
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
    async dispose() {
      await recorder.dispose();
    },
  };
};
