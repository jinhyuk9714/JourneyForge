// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeDesktopRuntime } from './fakeDesktopRuntime';

const waitFor = async (assertion: () => void | Promise<void>) => {
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  await assertion();
};

describe('createFakeDesktopRuntime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records the default scenario, exports files, and emits successful execution updates', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-desktop-fake-'));
    const runtime = createFakeDesktopRuntime({
      dataDir,
      scenario: 'default',
    });
    const executionStates: string[] = [];
    const unsubscribe = runtime.onExecutionUpdate((snapshot) => {
      executionStates.push(snapshot.state);
    });

    expect(await runtime.listSessions()).toEqual([]);

    const started = await runtime.startRecording({ baseUrl: 'http://localhost:3000/login' });
    expect((await runtime.getRecorderStatus()).state).toBe('recording');

    const bundle = await runtime.stopRecording(started.sessionId);
    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(bundle.session.id);
    expect(bundle.journey.steps[0]?.explanation.length).toBeGreaterThan(0);

    const exportedPaths = await runtime.exportArtifacts(bundle.session.id, ['playwright']);
    expect(exportedPaths).toHaveLength(1);
    expect(existsSync(exportedPaths[0]!)).toBe(true);

    const bundleExport = await runtime.exportBundle(bundle.session.id);
    expect(bundleExport.bundlePath).toContain(`${bundle.session.id}-bundle`);
    expect(existsSync(join(bundleExport.bundlePath!, 'README.md'))).toBe(true);
    expect(JSON.parse(readFileSync(join(bundleExport.bundlePath!, 'manifest.json'), 'utf8'))).toMatchObject({
      sessionId: bundle.session.id,
    });

    await runtime.startExecution({ sessionId: bundle.session.id, target: 'playwright' });

    await waitFor(async () => {
      expect((await runtime.getExecutionStatus()).state).toBe('succeeded');
    });

    expect(executionStates).toContain('preparing');
    expect(executionStates).toContain('running');
    expect(executionStates).toContain('succeeded');

    unsubscribe();
    await runtime.dispose();
  });

  it('supports cancelling a pending execution in the cancel-execution scenario', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-desktop-fake-cancel-'));
    const runtime = createFakeDesktopRuntime({
      dataDir,
      scenario: 'cancel-execution',
    });
    const sessionId = (await runtime.listSessions())[0]?.id;

    expect(sessionId).toBeTruthy();

    const started = await runtime.startExecution({ sessionId: sessionId!, target: 'playwright' });

    await waitFor(async () => {
      expect((await runtime.getExecutionStatus()).state).toBe('running');
    });

    await runtime.cancelExecution({ runId: started.runId });

    await waitFor(async () => {
      expect((await runtime.getExecutionStatus()).state).toBe('cancelled');
    });

    const snapshot = await runtime.getExecutionStatus();
    expect(snapshot.logs.map((entry) => entry.message).join('\n')).toContain('Execution cancelled by user.');

    await runtime.dispose();
  });
});
