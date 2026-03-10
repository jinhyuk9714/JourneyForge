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

  it('exports a runnable bundle with manifest, docs, playwright, and k6 assets', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-bundle-'));
    const repository = createStorageRepository({ dataDir });
    const journey = normalizeSession(loginSearchDetailSession);
    const artifacts = buildJourneyArtifacts(journey);

    await persistSessionBundle({
      repository,
      session: loginSearchDetailSession,
      journey,
      artifacts,
    });

    const bundleExport = await (
      repository as unknown as {
        exportBundle(sessionId: string): Promise<{ bundlePath: string; exportedPaths: string[] }>;
      }
    ).exportBundle(loginSearchDetailSession.id);

    expect(bundleExport.bundlePath).toContain(`${loginSearchDetailSession.id}-bundle`);
    expect(readFileSync(join(bundleExport.bundlePath, 'README.md'), 'utf8')).toContain('npm install');
    expect(readFileSync(join(bundleExport.bundlePath, 'README.md'), 'utf8')).toContain('k6 CLI');
    expect(readFileSync(join(bundleExport.bundlePath, 'manifest.json'), 'utf8')).toContain('"sessionId": "session-login-search-detail"');
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'package.json'), 'utf8')).toContain('"dotenv"');
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'playwright.config.ts'), 'utf8')).toContain(
      "const defaultBaseURL = 'http://localhost:3000';",
    );
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'playwright.config.ts'), 'utf8')).toContain(
      "import 'dotenv/config';",
    );
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', '.env.example'), 'utf8')).toContain('TEST_EMAIL=');
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'tests', 'login-search-detail.spec.ts'), 'utf8')).toContain("await page.goto('/login');");
    expect(readFileSync(join(bundleExport.bundlePath, 'docs', 'login-search-detail.flow.md'), 'utf8')).toContain('# Journey: Login Search Detail');
    expect(readFileSync(join(bundleExport.bundlePath, 'k6', '.env.example'), 'utf8')).toContain('BASE_URL=');
    expect(readFileSync(join(bundleExport.bundlePath, 'k6', 'login-search-detail.js'), 'utf8')).toContain('import http from \'k6/http\';');
  });
});
