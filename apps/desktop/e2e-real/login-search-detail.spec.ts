import { expect, test } from '@playwright/test';

import { launchRealDesktopScenario, setTargetUrl, waitForRealSmokeCompletion } from './helpers';

test('desktop shell records and previews the real login-search-detail flow', async () => {
  const runtime = await launchRealDesktopScenario('login-search-detail');

  try {
    const { page, baseUrl, dataDir } = runtime;

    await setTargetUrl(page, `${baseUrl}/login`);
    await page.getByRole('button', { name: '기록 시작' }).click();
    await expect(page.getByText('녹화 중')).toBeVisible();

    await waitForRealSmokeCompletion(dataDir);

    await page.getByRole('button', { name: '기록 종료' }).click();

    const searchStep = page.getByTestId('journey-step-search-products');

    await expect(page.locator('[data-testid^="session-row-"]').first()).toBeVisible();
    await expect(page.getByText('여정')).toBeVisible();
    await expect(page.getByText('Search products')).toBeVisible();
    await expect(page.getByText('Open product detail')).toBeVisible();
    await expect(searchStep).toContainText('분류 근거');
    await expect(searchStep).toContainText('API 근거');
    await expect(page.getByTestId('journey-k6-evidence')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-playwright')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-flow-doc')).toBeVisible();
    await expect(page.getByTestId('artifact-tab-k6')).toBeVisible();

    await page.getByRole('button', { name: '이 탭 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('1개 파일을 저장했습니다');
  } finally {
    await runtime.close();
  }
}, 120_000);
