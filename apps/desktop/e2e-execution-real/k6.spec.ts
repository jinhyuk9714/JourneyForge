import { expect, test } from '@playwright/test';

import { completeRecordedJourney, launchRealExecutionScenario } from './helpers';

test('desktop shell runs the generated k6 bundle against the real local toolchain', async () => {
  const runtime = await launchRealExecutionScenario('k6');

  try {
    const { page, baseUrl, dataDir } = runtime;

    await completeRecordedJourney(page, baseUrl, dataDir);
    await page.getByTestId('artifact-tab-k6').click();
    await page.getByRole('button', { name: 'k6 실행' }).click();

    await expect(page.getByTestId('execution-status')).toContainText('k6');
    await expect(page.getByTestId('execution-status')).toContainText('succeeded', {
      timeout: 180_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running: k6 version', {
      timeout: 180_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running: k6 run recorded-journey.js', {
      timeout: 180_000,
    });
    await expect(page.getByTestId('execution-log-panel')).toContainText('k6 v', {
      timeout: 180_000,
    });
  } finally {
    await runtime.close();
  }
}, 240_000);
