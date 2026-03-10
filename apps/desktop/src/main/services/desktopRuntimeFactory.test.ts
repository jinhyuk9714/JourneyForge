// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { DesktopRuntime } from './journeyForgeDesktopService';
import { createDesktopRuntime } from './desktopRuntimeFactory';

const createStubRuntime = (): DesktopRuntime => ({
  startRecording: vi.fn(),
  getRecorderStatus: vi.fn(),
  stopRecording: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  exportArtifacts: vi.fn(),
  exportBundle: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  setPlaywrightPassword: vi.fn(),
  clearPlaywrightPassword: vi.fn(),
  startExecution: vi.fn(),
  getExecutionStatus: vi.fn(),
  cancelExecution: vi.fn(),
  onExecutionUpdate: vi.fn(() => () => undefined),
  dispose: vi.fn(),
});

describe('createDesktopRuntime', () => {
  it('creates the real runtime by default', () => {
    const realRuntime = createStubRuntime();
    const fakeRuntime = createStubRuntime();

    const runtime = createDesktopRuntime({
      env: {},
      createRealRuntime: vi.fn(() => realRuntime),
      createFakeRuntime: vi.fn(() => fakeRuntime),
    });

    expect(runtime).toBe(realRuntime);
  });

  it('creates the fake runtime when desktop e2e env is enabled', () => {
    const realRuntime = createStubRuntime();
    const fakeRuntime = createStubRuntime();
    const createFakeRuntime = vi.fn(() => fakeRuntime);

    const runtime = createDesktopRuntime({
      env: {
        JOURNEYFORGE_DESKTOP_E2E: '1',
        JOURNEYFORGE_DESKTOP_SCENARIO: 'legacy',
        JOURNEYFORGE_DESKTOP_DATA_DIR: '/tmp/journeyforge-desktop-e2e',
      },
      createRealRuntime: vi.fn(() => realRuntime),
      createFakeRuntime,
    });

    expect(runtime).toBe(fakeRuntime);
    expect(createFakeRuntime).toHaveBeenCalledWith({
      dataDir: '/tmp/journeyforge-desktop-e2e',
      scenario: 'legacy',
    });
  });
});
