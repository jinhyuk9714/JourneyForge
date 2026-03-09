import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type {
  ArtifactKind,
  GeneratedArtifact,
  NormalizedJourney,
  RecordedSession,
  SessionBundle,
  SessionSummary,
} from '@journeyforge/shared';

type StorageRepositoryOptions = {
  dataDir?: string;
};

type PersistSessionBundleInput = {
  repository: StorageRepository;
  session: RecordedSession;
  journey: NormalizedJourney;
  artifacts: GeneratedArtifact[];
};

const defaultDataDir = () => resolve(process.cwd(), 'data');

const ensureParent = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true });
};

const writeJson = async (filePath: string, value: unknown) => {
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, 'utf8')) as T;

const sessionDir = (dataDir: string, sessionId: string) => join(dataDir, 'sessions', sessionId);
const generatedDir = (dataDir: string) => join(dataDir, 'generated');
const exportDir = (dataDir: string) => join(dataDir, 'exports');

export type StorageRepository = ReturnType<typeof createStorageRepository>;

export const createStorageRepository = (options: StorageRepositoryOptions = {}) => {
  const dataDir = options.dataDir ?? defaultDataDir();

  return {
    dataDir,
    async saveSession(session: RecordedSession) {
      await writeJson(join(sessionDir(dataDir, session.id), 'session.json'), session);
    },
    async saveJourney(sessionId: string, journey: NormalizedJourney) {
      await writeJson(join(sessionDir(dataDir, sessionId), 'journey.json'), journey);
    },
    async saveArtifacts(sessionId: string, artifacts: GeneratedArtifact[]) {
      await writeJson(join(sessionDir(dataDir, sessionId), 'artifacts.json'), artifacts);

      for (const artifact of artifacts) {
        if (!artifact.relativePath || !artifact.content) {
          continue;
        }
        const targetPath = join(dataDir, artifact.relativePath);
        await ensureParent(targetPath);
        await writeFile(targetPath, artifact.content, 'utf8');
      }
    },
    async getSessionBundle(sessionId: string): Promise<SessionBundle> {
      const directory = sessionDir(dataDir, sessionId);
      const [session, journey, artifacts] = await Promise.all([
        readJson<RecordedSession>(join(directory, 'session.json')),
        readJson<NormalizedJourney>(join(directory, 'journey.json')),
        readJson<GeneratedArtifact[]>(join(directory, 'artifacts.json')),
      ]);
      return { session, journey, artifacts };
    },
    async listSessions(): Promise<SessionSummary[]> {
      const sessionsRoot = join(dataDir, 'sessions');
      await mkdir(sessionsRoot, { recursive: true });
      const sessionIds = await readdir(sessionsRoot);
      const bundles = await Promise.all(sessionIds.map((sessionId) => this.getSessionBundle(sessionId)));
      return bundles
        .map(({ session, journey, artifacts }) => ({
          id: session.id,
          name: session.name,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          stepCount: journey.steps.length,
          artifactKinds: artifacts.filter((artifact) => artifact.status === 'generated').map((artifact) => artifact.kind),
        }))
        .sort((left, right) => right.startedAt - left.startedAt);
    },
    async exportArtifacts(sessionId: string, kinds: ArtifactKind[]) {
      const { artifacts } = await this.getSessionBundle(sessionId);
      const outputDirectory = exportDir(dataDir);
      await mkdir(outputDirectory, { recursive: true });

      const exportedPaths: string[] = [];
      for (const artifact of artifacts.filter((candidate) => kinds.includes(candidate.kind) && candidate.relativePath)) {
        const sourcePath = join(dataDir, artifact.relativePath!);
        const destinationPath = join(outputDirectory, `${sessionId}-${artifact.fileName}`);
        await copyFile(sourcePath, destinationPath);
        exportedPaths.push(destinationPath);
      }
      return exportedPaths;
    },
  };
};

export const persistSessionBundle = async ({
  repository,
  session,
  journey,
  artifacts,
}: PersistSessionBundleInput) => {
  await repository.saveSession(session);
  await repository.saveJourney(session.id, journey);
  await repository.saveArtifacts(session.id, artifacts);
};
