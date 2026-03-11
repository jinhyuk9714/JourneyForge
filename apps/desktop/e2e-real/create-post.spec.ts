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
    await expect(page.getByText('여정')).toBeVisible();
    await expect(page.getByText('Create post')).toBeVisible();
    await expect(createStep).toContainText('분류 근거');
    await expect(createStep).toContainText('API 근거');
    await expect(page.getByTestId('journey-k6-evidence')).toBeVisible();

    await page.getByTestId('artifact-tab-k6').click();
    await expect(page.getByText('http.post')).toBeVisible();
    await page.getByRole('button', { name: '번들 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('번들을');
  } finally {
    await runtime.close();
  }
}, 120_000);
