import { expect, test } from '@playwright/test';

import { launchRealDesktopScenario, setTargetUrl, waitForRealSmokeCompletion } from './helpers';

test('desktop shell records and previews the real create-post flow', async () => {
  const runtime = await launchRealDesktopScenario('create-post');

  try {
    const { page, baseUrl, dataDir } = runtime;

    await setTargetUrl(page, `${baseUrl}/login`);
    await page.getByRole('button', { name: '기록 시작' }).click();
    await expect(page.getByText('녹화 중')).toBeVisible();

    await waitForRealSmokeCompletion(dataDir);

    await page.getByRole('button', { name: '기록 종료' }).click();

    const createStep = page.getByTestId('journey-step-create-post');

    await expect(page.locator('[data-testid^="session-row-"]').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recorded Journey' })).toBeVisible();
    await expect(page.getByText('Create post')).toBeVisible();
    await expect(createStep).toContainText('Why this step');
    await expect(createStep).toContainText('API evidence');
    await expect(page.getByTestId('journey-k6-evidence')).toBeVisible();

    await page.getByTestId('artifact-tab-k6').click();
    await expect(page.getByText('http.post')).toBeVisible();
    await page.getByRole('button', { name: '실행 번들 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('Bundle exported to');
  } finally {
    await runtime.close();
  }
}, 120_000);
