// @vitest-environment node

import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { JourneyForgeSettings, SessionBundle } from '@journeyforge/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExecutionService } from './executionService';

type FakePlan = {
  exitCode: number;
  stdout?: string[];
  stderr?: string[];
  pending?: boolean;
};

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

const buildBundle = (sessionId: string): SessionBundle => ({
  session: {
    id: sessionId,
    name: 'Recorded Journey',
    baseUrl: 'http://localhost:3000/login',
    startedAt: 1,
    endedAt: 2,
    settingsSnapshot: DEFAULT_SETTINGS,
    rawEvents: [],
  },
  journey: {
    id: `journey-${sessionId}`,
    title: 'Login Search Detail',
    slug: 'login-search-detail',
    baseUrl: 'http://localhost:3000',
    steps: [],
    coreApis: [],
    suggestions: {
      playwright: true,
      k6Candidates: ['get-products'],
      k6CandidateReasons: [],
    },
  },
  artifacts: [],
});

const createFakeProcessRunner = (plans: FakePlan[]) => {
  const calls: Array<{
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
  }> = [];
  let pendingKill: (() => void) | null = null;

  return {
    calls,
    start(command: { command: string; args: string[]; cwd: string; env: Record<string, string>; onOutput(data: { stream: 'stdout' | 'stderr'; text: string }): void }) {
      const plan = plans.shift();
      if (!plan) {
        throw new Error(`No fake plan available for ${command.command} ${command.args.join(' ')}`);
      }

      calls.push({
        command: command.command,
        args: command.args,
        cwd: command.cwd,
        env: command.env,
      });

      let resolveCompleted: (result: { exitCode: number }) => void = () => undefined;
      const completed = new Promise<{ exitCode: number }>((resolve) => {
        resolveCompleted = resolve;
      });

      const flush = () => {
        for (const line of plan.stdout ?? []) {
          command.onOutput({ stream: 'stdout', text: line });
        }
        for (const line of plan.stderr ?? []) {
          command.onOutput({ stream: 'stderr', text: line });
        }
      };

      if (plan.pending) {
        pendingKill = () => {
          resolveCompleted({ exitCode: 130 });
        };
      } else {
        flush();
        resolveCompleted({ exitCode: plan.exitCode });
      }

      return {
        completed,
        kill() {
          pendingKill?.();
          pendingKill = null;
        },
      };
    },
  };
};

describe('createExecutionService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a bundle and runs playwright with bootstrap commands and execution overrides', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-execution-'));
    const bundlePath = join(dataDir, 'exports', 'session-1-bundle');
    mkdirSync(join(bundlePath, 'playwright'), { recursive: true });
    const runner = createFakeProcessRunner([
      { exitCode: 0, stdout: ['installed deps'] },
      { exitCode: 0, stdout: ['installed chromium'] },
      { exitCode: 0, stdout: ['1 passed'] },
    ]);
    const service = createExecutionService({
      dataDir,
      desktopApp: {
        exportBundle: vi.fn().mockResolvedValue({ bundlePath, exportedPaths: [] }),
        getSession: vi.fn().mockResolvedValue(buildBundle('session-1')),
        getSettings: vi.fn().mockResolvedValue(
          buildSettings({
            execution: {
              testEmail: 'qa@example.com',
              playwrightBaseUrl: 'http://127.0.0.1:4010',
              k6BaseUrl: '',
            },
          }),
        ),
      },
      credentialStore: {
        getPlaywrightPassword: vi.fn().mockResolvedValue('super-secret'),
        hasPlaywrightPassword: vi.fn().mockResolvedValue(true),
      },
      processRunner: runner,
    });

    const started = await service.start({ sessionId: 'session-1', target: 'playwright' });

    expect(started.runId).toBeTruthy();

    await waitFor(() => {
      expect(service.getStatus().state).toBe('succeeded');
    });

    expect(runner.calls.map((call) => `${call.command} ${call.args.join(' ')}`)).toEqual([
      'npm install',
      'npx playwright install chromium',
      'npx playwright test',
    ]);
    expect(runner.calls.every((call) => call.cwd === join(bundlePath, 'playwright'))).toBe(true);
    expect(runner.calls[2]?.env.BASE_URL).toBe('http://127.0.0.1:4010');
    expect(runner.calls[2]?.env.TEST_EMAIL).toBe('qa@example.com');
    expect(runner.calls[2]?.env.TEST_PASSWORD).toBe('super-secret');
    expect(service.getStatus().logs.map((entry) => entry.message)).toContain('1 passed');
  });

  it('fails a k6 run with an installation hint when the CLI is unavailable', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-execution-k6-'));
    const bundlePath = join(dataDir, 'exports', 'session-2-bundle');
    mkdirSync(join(bundlePath, 'k6'), { recursive: true });
    const runner = createFakeProcessRunner([{ exitCode: 127, stderr: ['k6: command not found'] }]);
    const service = createExecutionService({
      dataDir,
      desktopApp: {
        exportBundle: vi.fn().mockResolvedValue({ bundlePath, exportedPaths: [] }),
        getSession: vi.fn().mockResolvedValue(buildBundle('session-2')),
        getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      },
      credentialStore: {
        getPlaywrightPassword: vi.fn(),
        hasPlaywrightPassword: vi.fn().mockResolvedValue(false),
      },
      processRunner: runner,
    });

    await service.start({ sessionId: 'session-2', target: 'k6' });

    await waitFor(() => {
      expect(service.getStatus().state).toBe('failed');
    });

    expect(service.getStatus().error).toContain('k6를 설치');
    expect(service.getStatus().logs.map((entry) => entry.message).join('\n')).toContain('k6 version');
  });

  it('rejects duplicate starts and cancels an active playwright run', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-execution-cancel-'));
    const bundlePath = join(dataDir, 'exports', 'session-3-bundle');
    mkdirSync(join(bundlePath, 'playwright', 'node_modules'), { recursive: true });
    const runner = createFakeProcessRunner([
      { exitCode: 0, stdout: ['installed chromium'] },
      { exitCode: 0, pending: true },
    ]);
    const service = createExecutionService({
      dataDir,
      desktopApp: {
        exportBundle: vi.fn().mockResolvedValue({ bundlePath, exportedPaths: [] }),
        getSession: vi.fn().mockResolvedValue(buildBundle('session-3')),
        getSettings: vi.fn().mockResolvedValue(
          buildSettings({
            execution: {
              testEmail: 'qa@example.com',
              playwrightBaseUrl: '',
              k6BaseUrl: '',
            },
          }),
        ),
      },
      credentialStore: {
        getPlaywrightPassword: vi.fn().mockResolvedValue('super-secret'),
        hasPlaywrightPassword: vi.fn().mockResolvedValue(true),
      },
      processRunner: runner,
    });

    const { runId } = await service.start({ sessionId: 'session-3', target: 'playwright' });

    await waitFor(() => {
      expect(service.getStatus().state).toBe('running');
    });

    await expect(service.start({ sessionId: 'session-3', target: 'k6' })).rejects.toThrow(
      '다른 실행이 이미 진행 중입니다.',
    );

    const cancelled = await service.cancel({ runId });

    expect(cancelled.cancelled).toBe(true);
    await waitFor(() => {
      expect(service.getStatus().state).toBe('cancelled');
    });
  });
});
