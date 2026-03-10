import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { JourneyForgeSettings, RecordedSession } from '@journeyforge/shared';
import { describe, expect, it } from 'vitest';

import { createJourneyForgeApp, createStorageRepository, generateK6, normalizeSession } from './index';
import { loginSearchDetailSession } from './__fixtures__/loginSearchDetailSession';

const expectedExecutionDefaults = {
  testEmail: '',
  playwrightBaseUrl: '',
  k6BaseUrl: '',
};

const buildSettings = (overrides: Partial<JourneyForgeSettings> = {}): JourneyForgeSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
  k6Thresholds: {
    ...DEFAULT_SETTINGS.k6Thresholds,
    ...overrides.k6Thresholds,
  },
  execution: {
    ...DEFAULT_SETTINGS.execution,
    ...overrides.execution,
  },
});

const cloneSession = (overrides: Partial<RecordedSession> = {}): RecordedSession => ({
  ...loginSearchDetailSession,
  ...overrides,
  rawEvents: overrides.rawEvents ?? [...loginSearchDetailSession.rawEvents],
});

describe('settings integration', () => {
  it('creates default settings.json and reloads saved settings', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-settings-'));
    const repository = createStorageRepository({ dataDir });

    const defaults = await repository.getSettings();

    expect(defaults).toEqual({
      ...DEFAULT_SETTINGS,
      execution: expectedExecutionDefaults,
    });
    expect(existsSync(join(dataDir, 'settings.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'))).toEqual({
      ...DEFAULT_SETTINGS,
      execution: expectedExecutionDefaults,
    });

    const updated = buildSettings({
      analyticsPatterns: ['internal-metrics', 'collect'],
      maskEmailInputs: false,
      k6Thresholds: {
        httpReqDurationP95: 900,
        httpReqFailedRate: 0.05,
      },
      execution: {
        testEmail: 'tester@example.com',
        playwrightBaseUrl: 'http://localhost:3000',
        k6BaseUrl: 'http://localhost:3000',
      },
    });

    await repository.saveSettings(updated);

    expect(await repository.getSettings()).toEqual(updated);
  });

  it('merges older settings.json files with new execution defaults', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-settings-legacy-'));
    writeFileSync(
      join(dataDir, 'settings.json'),
      `${JSON.stringify(
        {
          analyticsPatterns: ['legacy-metrics'],
          maskEmailInputs: false,
          k6Thresholds: {
            httpReqDurationP95: 250,
            httpReqFailedRate: 0.2,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    const repository = createStorageRepository({ dataDir });

    expect(await repository.getSettings()).toEqual({
      analyticsPatterns: ['legacy-metrics'],
      maskEmailInputs: false,
      k6Thresholds: {
        httpReqDurationP95: 250,
        httpReqFailedRate: 0.2,
      },
      execution: expectedExecutionDefaults,
    });
  });

  it('filters custom analytics patterns during normalization', () => {
    const session = cloneSession({
      id: 'custom-analytics-session',
      rawEvents: loginSearchDetailSession.rawEvents.map((event) => {
        if (event.type !== 'network-request' || event.requestId !== 'req-4') {
          return event;
        }
        return {
          ...event,
          url: 'https://metrics.acme.test/collect?v=1',
        };
      }),
    });

    const journey = normalizeSession(
      session,
      buildSettings({
        analyticsPatterns: ['metrics.acme.test'],
      }),
    );

    expect(journey.coreApis.map((api) => api.url)).not.toContain('https://metrics.acme.test/collect?v=1');
  });

  it('uses the session settings snapshot when generation happens after later settings changes', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-settings-app-'));
    const app = createJourneyForgeApp({ dataDir });

    const snapshot = buildSettings({
      k6Thresholds: {
        httpReqDurationP95: 900,
        httpReqFailedRate: 0.05,
      },
    });

    await app.updateSettings(snapshot);
    expect(await app.getSettings()).toEqual(snapshot);

    const session = cloneSession({
      id: 'snapshot-session',
      name: 'Snapshot Session',
      settingsSnapshot: snapshot,
    });

    await app.updateSettings(
      buildSettings({
        k6Thresholds: {
          httpReqDurationP95: 120,
          httpReqFailedRate: 0.2,
        },
      }),
    );

    const bundle = await app.analyzeRecordedSession(session);
    const k6Artifact = bundle.artifacts.find((artifact) => artifact.kind === 'k6');

    expect(k6Artifact?.content).toContain("http_req_duration: ['p(95)<900']");
    expect(k6Artifact?.content).toContain("http_req_failed: ['rate<0.05']");

    const stored = await app.getSession(session.id);
    expect(stored.session.settingsSnapshot).toEqual(snapshot);

    await app.dispose();
  });

  it('renders custom k6 thresholds in generated output', () => {
    const journey = normalizeSession(loginSearchDetailSession, DEFAULT_SETTINGS);
    const script = generateK6(
      journey,
      buildSettings({
        k6Thresholds: {
          httpReqDurationP95: 750,
          httpReqFailedRate: 0.03,
        },
      }),
    );

    expect(script).toContain("http_req_duration: ['p(95)<750']");
    expect(script).toContain("http_req_failed: ['rate<0.03']");
  });
});
