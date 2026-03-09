import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildJourneyArtifacts, createStorageRepository, normalizeSession, persistSessionBundle } from './index';
import { loginSearchDetailSession } from './__fixtures__/loginSearchDetailSession';

describe('session pipeline', () => {
  it('persists session, journey, artifacts, and exports selected files', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-'));
    const repository = createStorageRepository({ dataDir });
    const journey = normalizeSession(loginSearchDetailSession);
    const artifacts = buildJourneyArtifacts(journey);

    await persistSessionBundle({
      repository,
      session: loginSearchDetailSession,
      journey,
      artifacts,
    });

    const stored = await repository.getSessionBundle(loginSearchDetailSession.id);

    expect(stored.session.id).toBe(loginSearchDetailSession.id);
    expect(stored.journey.title).toBe('Login Search Detail');
    expect(stored.artifacts).toHaveLength(3);

    const exportedPaths = await repository.exportArtifacts(loginSearchDetailSession.id, ['playwright', 'flow-doc']);

    expect(exportedPaths).toHaveLength(2);
    const [firstExportedPath] = exportedPaths;
    expect(firstExportedPath).toBeDefined();
    expect(readFileSync(firstExportedPath!, 'utf8')).toContain("test('login-search-detail'");
  });
});
