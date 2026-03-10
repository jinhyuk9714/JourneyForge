import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';

import { findPackagedAppExecutable, resolvePackagedDataDir } from '../src/main/services/packageSmokeSupport';

const __dirname = dirname(fileURLToPath(import.meta.url));
const releaseDir = resolve(__dirname, '../release');

export const launchPackagedApp = async (): Promise<{
  app: ElectronApplication;
  page: Page;
  homeDir: string;
  dataDir: string;
  close(): Promise<void>;
}> => {
  const executablePath = await findPackagedAppExecutable(releaseDir, 'JourneyForge');
  const homeDir = await mkdtemp(join(tmpdir(), 'journeyforge-packaged-home-'));
  const app = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      HOME: homeDir,
      CFFIXED_USER_HOME: homeDir,
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /한 번 기록하고, 개발 자산을 바로 생성하세요\./i })).toBeVisible();
  const userDataDir = await app.evaluate(async ({ app }) => app.getPath('userData'));

  return {
    app,
    page,
    homeDir,
    dataDir: resolvePackagedDataDir(userDataDir),
    async close() {
      await app.close();
      await rm(homeDir, { recursive: true, force: true });
    },
  };
};
