import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';

import { startDemoTargetServer } from '../../../packages/core/src/test-support/demoTargetServer';
import { REAL_SMOKE_STATUS_FILE, type RealSmokeStatus } from '../src/main/services/realSmokeDesktopRuntime';

type RealDesktopScenario = 'login-search-detail' | 'create-post';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appEntry = resolve(__dirname, '../out/main/index.js');

const readSmokeStatus = async (dataDir: string): Promise<RealSmokeStatus | null> => {
  try {
    const raw = await readFile(join(dataDir, REAL_SMOKE_STATUS_FILE), 'utf8');
    return JSON.parse(raw) as RealSmokeStatus;
  } catch {
    return null;
  }
};

export const waitForRealSmokeCompletion = async (dataDir: string) => {
  await expect
    .poll(
      async () => {
        const status = await readSmokeStatus(dataDir);
        if (!status) {
          return 'missing';
        }

        if (status.status === 'failed') {
          return `failed:${status.error ?? 'unknown'}`;
        }

        return status.status;
      },
      {
        timeout: 90_000,
      },
    )
    .toBe('completed');
};

export const launchRealDesktopScenario = async (scenario: RealDesktopScenario): Promise<{
  app: ElectronApplication;
  page: Page;
  dataDir: string;
  baseUrl: string;
  close(): Promise<void>;
}> => {
  const dataDir = await mkdtemp(join(tmpdir(), `journeyforge-desktop-real-smoke-${scenario}-`));
  const server = await startDemoTargetServer();
  const app = await electron.launch({
    args: [appEntry],
    env: {
      ...process.env,
      JOURNEYFORGE_DESKTOP_REAL_SMOKE: '1',
      JOURNEYFORGE_DESKTOP_REAL_SMOKE_SCENARIO: scenario,
      JOURNEYFORGE_DESKTOP_REAL_SMOKE_DATA_DIR: dataDir,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /Record once\. Generate engineering assets instantly\./i })).toBeVisible();

  return {
    app,
    page,
    dataDir,
    baseUrl: server.baseUrl,
    async close() {
      await app.close();
      await server.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
};
