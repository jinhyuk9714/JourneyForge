import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExecutionTarget } from '@journeyforge/shared';

import type { DesktopRuntime } from './journeyForgeDesktopService';
import { createJourneyForgeDesktopRuntime } from './journeyForgeDesktopService';
import type { RealDesktopSmokeScenario } from './realSmokeScenario';
import { runRealSmokeScenario } from './realSmokeScenario';

export const DESKTOP_REAL_SMOKE_ENV = 'JOURNEYFORGE_DESKTOP_REAL_SMOKE';
export const DESKTOP_REAL_SMOKE_SCENARIO_ENV = 'JOURNEYFORGE_DESKTOP_REAL_SMOKE_SCENARIO';
export const DESKTOP_REAL_SMOKE_DATA_DIR_ENV = 'JOURNEYFORGE_DESKTOP_REAL_SMOKE_DATA_DIR';
export const REAL_SMOKE_STATUS_FILE = 'real-smoke-status.json';

export type RealSmokeStatus = {
  scenario: RealDesktopSmokeScenario;
  status: 'pending' | 'running' | 'completed' | 'failed';
  baseUrl: string;
  updatedAt: number;
  error?: string;
  target?: ExecutionTarget;
};

type CreateRealSmokeDesktopRuntimeOptions = {
  dataDir: string;
  scenario: RealDesktopSmokeScenario;
};

export const writeRealSmokeStatus = async (dataDir: string, status: Omit<RealSmokeStatus, 'updatedAt'>) => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, REAL_SMOKE_STATUS_FILE),
    JSON.stringify(
      {
        ...status,
        updatedAt: Date.now(),
      } satisfies RealSmokeStatus,
      null,
      2,
    ),
    'utf8',
  );
};

export const readRealSmokeStatus = async (dataDir: string): Promise<RealSmokeStatus | null> => {
  try {
    const raw = await readFile(join(dataDir, REAL_SMOKE_STATUS_FILE), 'utf8');
    return JSON.parse(raw) as RealSmokeStatus;
  } catch {
    return null;
  }
};

export const createRealSmokeDesktopRuntime = ({
  dataDir,
  scenario,
}: CreateRealSmokeDesktopRuntimeOptions): DesktopRuntime => {
  let currentBaseUrl = '';
  let autopilot: Promise<void> | null = null;

  const runtime = createJourneyForgeDesktopRuntime({
    dataDir,
    recorder: {
      launchOptions: {
        headless: true,
      },
      onPageReady(page) {
        const baseUrl = currentBaseUrl;
        autopilot = (async () => {
          await writeRealSmokeStatus(dataDir, {
            scenario,
            status: 'running',
            baseUrl,
          });

          try {
            await runRealSmokeScenario({
              page,
              baseUrl,
              scenario,
            });
            await writeRealSmokeStatus(dataDir, {
              scenario,
              status: 'completed',
              baseUrl,
            });
          } catch (error) {
            await writeRealSmokeStatus(dataDir, {
              scenario,
              status: 'failed',
              baseUrl,
              error: error instanceof Error ? error.stack ?? error.message : String(error),
            });
            throw error;
          }
        })();
        void autopilot.catch(() => undefined);
      },
    },
  });

  return {
    ...runtime,
    async startRecording(input) {
      currentBaseUrl = input.baseUrl;
      await writeRealSmokeStatus(dataDir, {
        scenario,
        status: 'pending',
        baseUrl: input.baseUrl,
      });
      return runtime.startRecording(input);
    },
    async dispose() {
      await autopilot?.catch(() => undefined);
      await runtime.dispose();
    },
  };
};
