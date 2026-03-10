import { randomUUID } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

import type {
  ExecutionLogEntry,
  ExecutionSnapshot,
  ExecutionTarget,
  JourneyForgeSettings,
  SessionBundle,
} from '@journeyforge/shared';

import { buildK6ExecutionPlan, buildPlaywrightExecutionPlan } from './executionBuilders';

type ProcessOutput = {
  stream: 'stdout' | 'stderr';
  text: string;
};

type ProcessStartInput = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  onOutput(data: ProcessOutput): void;
};

type ProcessHandle = {
  completed: Promise<{ exitCode: number }>;
  kill(): void;
};

type ProcessRunner = {
  start(input: ProcessStartInput): ProcessHandle;
};

type ExecutionServiceOptions = {
  dataDir: string;
  desktopApp: {
    exportBundle(sessionId: string): Promise<{ bundlePath?: string }>;
    getSession(sessionId: string): Promise<SessionBundle>;
    getSettings(): Promise<JourneyForgeSettings>;
  };
  credentialStore: {
    hasPlaywrightPassword(): Promise<boolean>;
    getPlaywrightPassword(): Promise<string | null>;
  };
  processRunner?: ProcessRunner;
};

type ActiveExecution = {
  runId: string;
  cancelRequested: boolean;
  handle: ProcessHandle | null;
};

class ExecutionFailure extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
  }
}

class ExecutionCancelled extends Error {
  constructor(readonly exitCode = 130) {
    super('Execution cancelled.');
  }
}

const splitLines = (value: string) =>
  value
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter(Boolean);

const createProcessRunner = (): ProcessRunner => ({
  start(input) {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk) => {
      for (const line of splitLines(String(chunk))) {
        input.onOutput({ stream: 'stdout', text: line });
      }
    });
    child.stderr?.on('data', (chunk) => {
      for (const line of splitLines(String(chunk))) {
        input.onOutput({ stream: 'stderr', text: line });
      }
    });

    const completed = new Promise<{ exitCode: number }>((resolve) => {
      child.once('error', (error) => {
        input.onOutput({ stream: 'stderr', text: error.message });
        resolve({ exitCode: 1 });
      });
      child.once('close', (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });

    return {
      completed,
      kill() {
        child.kill('SIGTERM');
      },
    };
  },
});

const createIdleSnapshot = (): ExecutionSnapshot => ({
  state: 'idle',
  logs: [],
  updatedAt: Date.now(),
});

const cloneSnapshot = (snapshot: ExecutionSnapshot): ExecutionSnapshot => ({
  ...snapshot,
  logs: [...snapshot.logs],
});

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const browserInstallMarkerPath = (dataDir: string) => join(dataDir, 'execution', 'playwright-chromium-ready');

export const createExecutionService = (options: ExecutionServiceOptions) => {
  const processRunner = options.processRunner ?? createProcessRunner();
  let snapshot = createIdleSnapshot();
  let activeExecution: ActiveExecution | null = null;
  const listeners = new Set<(snapshot: ExecutionSnapshot) => void>();

  const emit = () => {
    const next = cloneSnapshot(snapshot);
    for (const listener of listeners) {
      listener(next);
    }
  };

  const updateSnapshot = (next: Partial<ExecutionSnapshot>) => {
    snapshot = {
      ...snapshot,
      ...next,
      updatedAt: Date.now(),
    };
    emit();
  };

  const pushLog = (stream: ExecutionLogEntry['stream'], message: string) => {
    const log: ExecutionLogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      stream,
      message,
    };
    snapshot = {
      ...snapshot,
      logs: [...snapshot.logs, log],
      updatedAt: log.timestamp,
    };
    emit();
  };

  const failRun = (runId: string, message: string, exitCode = 1) => {
    if (snapshot.runId !== runId) {
      return;
    }
    pushLog('system', message);
    snapshot = {
      ...snapshot,
      state: 'failed',
      error: message,
      exitCode,
      updatedAt: Date.now(),
    };
    activeExecution = null;
    emit();
  };

  const succeedRun = (runId: string) => {
    if (snapshot.runId !== runId) {
      return;
    }
    snapshot = {
      ...snapshot,
      state: 'succeeded',
      exitCode: 0,
      error: undefined,
      updatedAt: Date.now(),
    };
    activeExecution = null;
    emit();
  };

  const cancelRun = (runId: string, exitCode = 130) => {
    if (snapshot.runId !== runId) {
      return;
    }
    pushLog('system', 'Execution cancelled.');
    snapshot = {
      ...snapshot,
      state: 'cancelled',
      exitCode,
      error: undefined,
      updatedAt: Date.now(),
    };
    activeExecution = null;
    emit();
  };

  const buildCommands = async (
    target: ExecutionTarget,
    bundlePath: string,
    sessionBundle: SessionBundle,
    settings: JourneyForgeSettings,
  ) => {
    if (target === 'playwright') {
      if (!settings.execution.testEmail) {
        throw new ExecutionFailure('Set a test email in Settings before running Playwright.');
      }

      const password = await options.credentialStore.getPlaywrightPassword();
      if (!password) {
        throw new ExecutionFailure('Save a Playwright password in Settings before running Playwright.');
      }

      const markerPath = browserInstallMarkerPath(options.dataDir);
      return buildPlaywrightExecutionPlan({
        bundlePath,
        sessionBundle,
        settings,
        password,
        hasNodeModules: await pathExists(join(bundlePath, 'playwright', 'node_modules')),
        needsBrowserInstall: !(await pathExists(markerPath)),
        browserInstallMarkerPath: markerPath,
        async writeBrowserInstallMarker(filePath) {
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, `${Date.now()}\n`, 'utf8');
        },
      });
    }

    return buildK6ExecutionPlan({
      bundlePath,
      sessionBundle,
      settings,
    });
  };

  const runCommand = async (
    runId: string,
    command: ReturnType<typeof buildK6ExecutionPlan>[number],
  ) => {
    if (!activeExecution || activeExecution.runId !== runId) {
      throw new ExecutionCancelled();
    }
    if (activeExecution.cancelRequested) {
      throw new ExecutionCancelled();
    }

    updateSnapshot({
      state: command.phase,
    });
    pushLog('system', `Running: ${command.label}`);
    const handle = processRunner.start({
      command: command.command,
      args: command.args,
      cwd: command.cwd,
      env: command.env,
      onOutput: ({ stream, text }) => {
        pushLog(stream, text);
      },
    });
    activeExecution.handle = handle;

    const result = await handle.completed;
    activeExecution.handle = null;

    if (activeExecution.cancelRequested) {
      throw new ExecutionCancelled(result.exitCode);
    }
    if (result.exitCode !== 0) {
      throw new ExecutionFailure(command.failureMessage ?? `${command.label} exited with ${result.exitCode}.`, result.exitCode);
    }

    await command.onSuccess?.();
  };

  const runExecution = async (runId: string, sessionId: string, target: ExecutionTarget) => {
    try {
      const [bundleExport, sessionBundle, settings] = await Promise.all([
        options.desktopApp.exportBundle(sessionId),
        options.desktopApp.getSession(sessionId),
        options.desktopApp.getSettings(),
      ]);

      if (!bundleExport.bundlePath) {
        throw new ExecutionFailure('Failed to export a runnable bundle for this session.');
      }

      updateSnapshot({
        bundlePath: bundleExport.bundlePath,
      });

      const commands = await buildCommands(target, bundleExport.bundlePath, sessionBundle, settings);

      for (const command of commands) {
        await runCommand(runId, command);
      }

      succeedRun(runId);
    } catch (error) {
      if (error instanceof ExecutionCancelled) {
        cancelRun(runId, error.exitCode);
        return;
      }
      if (error instanceof ExecutionFailure) {
        failRun(runId, error.message, error.exitCode);
        return;
      }
      failRun(runId, error instanceof Error ? error.message : 'Execution failed unexpectedly.');
    }
  };

  return {
    async start(input: { sessionId: string; target: ExecutionTarget }) {
      if (activeExecution && (snapshot.state === 'preparing' || snapshot.state === 'running')) {
        throw new Error('Another execution is already in progress.');
      }

      const runId = randomUUID();
      activeExecution = {
        runId,
        cancelRequested: false,
        handle: null,
      };
      snapshot = {
        state: 'preparing',
        logs: [],
        updatedAt: Date.now(),
        runId,
        sessionId: input.sessionId,
        target: input.target,
        startedAt: Date.now(),
        exitCode: undefined,
        error: undefined,
      };
      emit();

      void runExecution(runId, input.sessionId, input.target);

      return { runId };
    },
    getStatus() {
      return cloneSnapshot(snapshot);
    },
    subscribe(listener: (snapshot: ExecutionSnapshot) => void) {
      listeners.add(listener);
      listener(cloneSnapshot(snapshot));
      return () => {
        listeners.delete(listener);
      };
    },
    async cancel(input: { runId: string }) {
      if (!activeExecution || activeExecution.runId !== input.runId) {
        return { cancelled: false };
      }
      if (snapshot.state !== 'preparing' && snapshot.state !== 'running') {
        return { cancelled: false };
      }

      activeExecution.cancelRequested = true;
      activeExecution.handle?.kill();
      return { cancelled: true };
    },
    async dispose() {
      activeExecution?.handle?.kill();
      activeExecution = null;
      listeners.clear();
      snapshot = createIdleSnapshot();
    },
  };
};
