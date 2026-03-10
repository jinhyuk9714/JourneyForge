// @vitest-environment node

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';

import { REAL_SMOKE_STATUS_FILE } from './realSmokeDesktopRuntime';
import { createRealExecutionSmokeDesktopRuntime } from './realExecutionSmokeDesktopRuntime';
import type { CreateJourneyForgeDesktopRuntimeOptions } from './journeyForgeDesktopService';

const createBaseRuntimeStub = () => ({
  startRecording: vi.fn(async () => ({ sessionId: 'session-1' })),
  getRecorderStatus: vi.fn(),
  stopRecording: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  exportArtifacts: vi.fn(),
  exportBundle: vi.fn(),
  getSettings: vi.fn(async () => ({
    settings: DEFAULT_SETTINGS,
    credentialStatus: { hasPlaywrightPassword: false },
  })),
  updateSettings: vi.fn(async (settings) => ({
    settings,
    credentialStatus: { hasPlaywrightPassword: true },
  })),
  setPlaywrightPassword: vi.fn(),
  clearPlaywrightPassword: vi.fn(),
  startExecution: vi.fn(),
  getExecutionStatus: vi.fn(),
  cancelExecution: vi.fn(),
  onExecutionUpdate: vi.fn(() => () => undefined),
  dispose: vi.fn(),
});

vi.mock('./journeyForgeDesktopService', () => ({
  createJourneyForgeDesktopRuntime: vi.fn(),
}));

const { createJourneyForgeDesktopRuntime } = await import('./journeyForgeDesktopService');

describe('createRealExecutionSmokeDesktopRuntime', () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(
      cleanupPaths.splice(0).map(async (path) => {
        await import('node:fs/promises').then(({ rm }) => rm(path, { recursive: true, force: true }));
      }),
    );
  });

  it('overlays execution settings with base-url origins and injects an in-memory credential store', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'journeyforge-real-execution-runtime-'));
    cleanupPaths.push(dataDir);
    const baseRuntime = createBaseRuntimeStub();
    vi.mocked(createJourneyForgeDesktopRuntime).mockReturnValue(baseRuntime);

    const runtime = createRealExecutionSmokeDesktopRuntime({
      dataDir,
      target: 'playwright',
    });

    await runtime.startRecording({
      baseUrl: 'http://127.0.0.1:4312/login',
    });

    expect(createJourneyForgeDesktopRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir,
        credentialStore: expect.any(Object),
        recorder: expect.objectContaining({
          launchOptions: {
            headless: true,
          },
          onPageReady: expect.any(Function),
        }),
      }),
    );

    const firstCall = vi.mocked(createJourneyForgeDesktopRuntime).mock.calls[0];
    expect(firstCall).toBeDefined();
    const [{ credentialStore }] = firstCall as [CreateJourneyForgeDesktopRuntimeOptions];
    expect(credentialStore).toBeDefined();

    await expect(credentialStore!.hasPlaywrightPassword()).resolves.toBe(true);
    await expect(credentialStore!.getPlaywrightPassword()).resolves.toBe('super-secret');

    expect(baseRuntime.updateSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      execution: {
        testEmail: 'qa@example.com',
        playwrightBaseUrl: 'http://127.0.0.1:4312',
        k6BaseUrl: 'http://127.0.0.1:4312',
      },
    });
    expect(baseRuntime.startRecording).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:4312/login',
    });

    const status = JSON.parse(await readFile(join(dataDir, REAL_SMOKE_STATUS_FILE), 'utf8')) as {
      status: string;
      target: string;
      baseUrl: string;
    };
    expect(status.status).toBe('pending');
    expect(status.target).toBe('playwright');
    expect(status.baseUrl).toBe('http://127.0.0.1:4312/login');
  });
});
