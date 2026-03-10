// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';

import { createJourneyForgeDesktopRuntime } from './journeyForgeDesktopService';
import type { CreateJourneyForgeDesktopRuntimeOptions } from './journeyForgeDesktopService';

const createExecutionServiceStub = () => ({
  start: vi.fn(),
  getStatus: vi.fn(() => ({ state: 'idle' as const, logs: [], updatedAt: Date.now() })),
  cancel: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
  dispose: vi.fn(),
});

describe('createJourneyForgeDesktopRuntime', () => {
  it('passes the injected credential store to the execution service and surfaces its status', async () => {
    const executionService = createExecutionServiceStub();
    const createExecutionServiceImpl = vi.fn(() => executionService);
    const createCoreApp = vi.fn(() => ({
      startRecording: vi.fn(),
      getRecorderStatus: vi.fn(),
      stopRecording: vi.fn(),
      listSessions: vi.fn(),
      getSession: vi.fn(),
      exportArtifacts: vi.fn(),
      exportBundle: vi.fn(),
      getSettings: vi.fn(async () => DEFAULT_SETTINGS),
      updateSettings: vi.fn(async () => DEFAULT_SETTINGS),
      dispose: vi.fn(),
    }));
    const credentialStore = {
      hasPlaywrightPassword: vi.fn(async () => true),
      getPlaywrightPassword: vi.fn(async () => 'super-secret'),
      setPlaywrightPassword: vi.fn(async () => undefined),
      clearPlaywrightPassword: vi.fn(async () => undefined),
      getStatus: vi.fn(async () => ({ hasPlaywrightPassword: true })),
    };

    const runtime = createJourneyForgeDesktopRuntime({
      dataDir: '/tmp/journeyforge-runtime',
      credentialStore,
      createCoreApp: createCoreApp as unknown as CreateJourneyForgeDesktopRuntimeOptions['createCoreApp'],
      createExecutionServiceImpl:
        createExecutionServiceImpl as unknown as CreateJourneyForgeDesktopRuntimeOptions['createExecutionServiceImpl'],
    });

    const settingsPayload = await runtime.getSettings();

    expect(createExecutionServiceImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialStore,
      }),
    );
    expect(settingsPayload.credentialStatus).toEqual({ hasPlaywrightPassword: true });
  });

  it('surfaces injected credential-store failures during settings reads and password mutations', async () => {
    const executionService = createExecutionServiceStub();
    const createExecutionServiceImpl = vi.fn(() => executionService);
    const createCoreApp = vi.fn(() => ({
      startRecording: vi.fn(),
      getRecorderStatus: vi.fn(),
      stopRecording: vi.fn(),
      listSessions: vi.fn(),
      getSession: vi.fn(),
      exportArtifacts: vi.fn(),
      exportBundle: vi.fn(),
      getSettings: vi.fn(async () => DEFAULT_SETTINGS),
      updateSettings: vi.fn(async () => DEFAULT_SETTINGS),
      dispose: vi.fn(),
    }));
    const credentialStore = {
      hasPlaywrightPassword: vi.fn(async () => false),
      getPlaywrightPassword: vi.fn(async () => null),
      setPlaywrightPassword: vi.fn(async () => {
        throw new Error('Save failed.');
      }),
      clearPlaywrightPassword: vi.fn(async () => {
        throw new Error('Delete failed.');
      }),
      getStatus: vi.fn(async () => {
        throw new Error('Status failed.');
      }),
    };

    const runtime = createJourneyForgeDesktopRuntime({
      dataDir: '/tmp/journeyforge-runtime',
      credentialStore,
      createCoreApp: createCoreApp as unknown as CreateJourneyForgeDesktopRuntimeOptions['createCoreApp'],
      createExecutionServiceImpl:
        createExecutionServiceImpl as unknown as CreateJourneyForgeDesktopRuntimeOptions['createExecutionServiceImpl'],
    });

    await expect(runtime.getSettings()).rejects.toThrow('Status failed.');
    await expect(runtime.setPlaywrightPassword('next-secret')).rejects.toThrow('Save failed.');
    await expect(runtime.clearPlaywrightPassword()).rejects.toThrow('Delete failed.');
  });
});
