import type { JourneyForgeSettings } from '@journeyforge/shared';

import type { CredentialStore } from './credentialService';
import type { DesktopRuntime } from './journeyForgeDesktopService';
import { createJourneyForgeDesktopRuntime } from './journeyForgeDesktopService';
import { runRealSmokeScenario } from './realSmokeScenario';
import type { RealSmokeStatus } from './realSmokeDesktopRuntime';
import { writeRealSmokeStatus } from './realSmokeDesktopRuntime';

export const DESKTOP_REAL_EXECUTION_SMOKE_ENV = 'JOURNEYFORGE_DESKTOP_REAL_EXECUTION_SMOKE';
export const DESKTOP_REAL_EXECUTION_TARGET_ENV = 'JOURNEYFORGE_DESKTOP_REAL_EXECUTION_TARGET';
export const DESKTOP_REAL_EXECUTION_DATA_DIR_ENV = 'JOURNEYFORGE_DESKTOP_REAL_EXECUTION_DATA_DIR';

export type RealExecutionSmokeTarget = 'playwright' | 'k6';

type CreateRealExecutionSmokeDesktopRuntimeOptions = {
  dataDir: string;
  target: RealExecutionSmokeTarget;
};

const EXECUTION_SMOKE_SCENARIO = 'login-search-detail';
const EXECUTION_SMOKE_EMAIL = 'qa@example.com';
const EXECUTION_SMOKE_PASSWORD = 'super-secret';

const createExecutionSmokeCredentialStore = (): CredentialStore => ({
  async getPlaywrightPassword() {
    return EXECUTION_SMOKE_PASSWORD;
  },
  async hasPlaywrightPassword() {
    return true;
  },
  async setPlaywrightPassword() {
    return undefined;
  },
  async clearPlaywrightPassword() {
    return undefined;
  },
  async getStatus() {
    return {
      hasPlaywrightPassword: true,
    };
  },
});

const applyExecutionSmokeSettings = (settings: JourneyForgeSettings, baseUrl: string): JourneyForgeSettings => {
  const origin = new URL(baseUrl).origin;

  return {
    ...settings,
    execution: {
      ...settings.execution,
      testEmail: EXECUTION_SMOKE_EMAIL,
      playwrightBaseUrl: origin,
      k6BaseUrl: origin,
    },
  };
};

const withExecutionSmokeStatus = (
  target: RealExecutionSmokeTarget,
  data: Omit<RealSmokeStatus, 'updatedAt' | 'scenario' | 'target'>,
): Omit<RealSmokeStatus, 'updatedAt'> => ({
  ...data,
  scenario: EXECUTION_SMOKE_SCENARIO,
  target,
});

export const createRealExecutionSmokeDesktopRuntime = ({
  dataDir,
  target,
}: CreateRealExecutionSmokeDesktopRuntimeOptions): DesktopRuntime => {
  let currentBaseUrl = '';
  let autopilot: Promise<void> | null = null;

  const runtime = createJourneyForgeDesktopRuntime({
    dataDir,
    credentialStore: createExecutionSmokeCredentialStore(),
    recorder: {
      launchOptions: {
        headless: true,
      },
      onPageReady(page) {
        const baseUrl = currentBaseUrl;
        autopilot = (async () => {
          await writeRealSmokeStatus(
            dataDir,
            withExecutionSmokeStatus(target, {
              status: 'running',
              baseUrl,
            }),
          );

          try {
            await runRealSmokeScenario({
              page,
              baseUrl,
              scenario: EXECUTION_SMOKE_SCENARIO,
            });
            await writeRealSmokeStatus(
              dataDir,
              withExecutionSmokeStatus(target, {
                status: 'completed',
                baseUrl,
              }),
            );
          } catch (error) {
            await writeRealSmokeStatus(
              dataDir,
              withExecutionSmokeStatus(target, {
                status: 'failed',
                baseUrl,
                error: error instanceof Error ? error.stack ?? error.message : String(error),
              }),
            );
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
      const settingsPayload = await runtime.getSettings();
      await runtime.updateSettings(applyExecutionSmokeSettings(settingsPayload.settings, input.baseUrl));
      await writeRealSmokeStatus(
        dataDir,
        withExecutionSmokeStatus(target, {
          status: 'pending',
          baseUrl: input.baseUrl,
        }),
      );
      return runtime.startRecording(input);
    },
    async dispose() {
      await autopilot?.catch(() => undefined);
      await runtime.dispose();
    },
  };
};
