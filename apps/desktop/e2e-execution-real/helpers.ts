import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';

import { startDemoTargetServer } from '../../../packages/core/src/test-support/demoTargetServer';
import { waitForRealSmokeCompletion } from '../e2e-real/helpers';

type RealExecutionSmokeTarget = 'playwright' | 'k6';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appEntry = resolve(__dirname, '../out/main/index.js');

const assertK6Available = () => {
  const result = spawnSync('k6', ['version'], {
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return;
  }

  const details = result.stderr || result.stdout || 'k6 was not found on PATH.';
  throw new Error(`Real execution smoke requires k6 on PATH. ${details.trim()}`);
};

export const launchRealExecutionScenario = async (target: RealExecutionSmokeTarget): Promise<{
  app: ElectronApplication;
  page: Page;
  dataDir: string;
  baseUrl: string;
  close(): Promise<void>;
}> => {
  if (target === 'k6') {
    assertK6Available();
  }

  const dataDir = await mkdtemp(join(tmpdir(), `journeyforge-desktop-real-execution-${target}-`));
  const server = await startDemoTargetServer();
  const app = await electron.launch({
    args: [appEntry],
    env: {
      ...process.env,
      JOURNEYFORGE_DESKTOP_REAL_EXECUTION_SMOKE: '1',
      JOURNEYFORGE_DESKTOP_REAL_EXECUTION_TARGET: target,
      JOURNEYFORGE_DESKTOP_REAL_EXECUTION_DATA_DIR: dataDir,
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

export const completeRecordedJourney = async (page: Page, baseUrl: string, dataDir: string) => {
  const targetUrlInput = page.getByLabel('Target URL');
  await targetUrlInput.click();
  await targetUrlInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await targetUrlInput.fill(`${baseUrl}/login`);
  await expect(targetUrlInput).toHaveValue(`${baseUrl}/login`);
  await page.getByRole('button', { name: '기록 시작' }).click();
  await expect(page.getByText('녹화 중')).toBeVisible();
  await waitForRealSmokeCompletion(dataDir);
  await page.getByRole('button', { name: '기록 종료' }).click();
  await expect(page.getByRole('heading', { name: 'Recorded Journey' })).toBeVisible();
};
