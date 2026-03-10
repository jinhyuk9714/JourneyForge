import { expect, test } from '@playwright/test';

import { completeRecordedJourney, launchRealExecutionScenario } from './helpers';

test('desktop shell runs the generated Playwright bundle against the real local toolchain', async () => {
  const runtime = await launchRealExecutionScenario('playwright');

  try {
    const { page, baseUrl, dataDir } = runtime;

    await completeRecordedJourney(page, baseUrl, dataDir);
    await page.getByTestId('artifact-tab-playwright').click();
    await page.getByRole('button', { name: 'Playwright 실행' }).click();

    await expect(page.getByTestId('execution-status')).toContainText('Playwright');
    await expect(page.getByTestId('execution-status')).toContainText('succeeded', {
      timeout: 300_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running: npm install', {
      timeout: 300_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running: npx playwright install chromium', {
      timeout: 300_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running: npx playwright test', {
      timeout: 300_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('1 passed', {
      timeout: 300_000,
    });
  } finally {
    await runtime.close();
  }
}, 360_000);
