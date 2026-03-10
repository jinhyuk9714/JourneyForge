import { expect, test } from '@playwright/test';

import { launchRealDesktopScenario, waitForRealSmokeCompletion } from './helpers';

test('desktop shell records and previews the real login-search-detail flow', async () => {
  const runtime = await launchRealDesktopScenario('login-search-detail');

  try {
    const { page, baseUrl, dataDir } = runtime;

    await page.getByLabel('Target URL').fill(`${baseUrl}/login`);
    await page.getByRole('button', { name: '기록 시작' }).click();
    await expect(page.getByText('녹화 중')).toBeVisible();

    await waitForRealSmokeCompletion(dataDir);

    await page.getByRole('button', { name: '기록 종료' }).click();

    const searchStep = page.getByTestId('journey-step-search-products');

    await expect(page.locator('[data-testid^="session-row-"]').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recorded Journey' })).toBeVisible();
    await expect(page.getByText('Search products')).toBeVisible();
    await expect(page.getByText('Open product detail')).toBeVisible();
    await expect(searchStep).toContainText('Why this step');
    await expect(searchStep).toContainText('API evidence');
    await expect(page.getByTestId('journey-k6-evidence')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-playwright')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-flow-doc')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-k6')).toBeVisible();

    await page.getByRole('button', { name: '현재 탭 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('Exported 1 file(s)');
  } finally {
    await runtime.close();
  }
}, 120_000);
