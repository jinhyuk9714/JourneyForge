import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';

type DesktopScenario = 'default' | 'legacy' | 'cancel-execution';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appEntry = resolve(__dirname, '../out/main/index.js');

export const launchDesktopScenario = async (scenario: DesktopScenario): Promise<{
  app: ElectronApplication;
  page: Page;
  dataDir: string;
  close(): Promise<void>;
}> => {
  const dataDir = await mkdtemp(join(tmpdir(), `journeyforge-desktop-e2e-${scenario}-`));
  const app = await electron.launch({
    args: [appEntry],
    env: {
      ...process.env,
      JOURNEYFORGE_DESKTOP_E2E: '1',
      JOURNEYFORGE_DESKTOP_SCENARIO: scenario,
      JOURNEYFORGE_DESKTOP_DATA_DIR: dataDir,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /한 번 기록하고, 개발 자산을 바로 생성하세요\./i })).toBeVisible();

  return {
    app,
    page,
    dataDir,
    async close() {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
};
