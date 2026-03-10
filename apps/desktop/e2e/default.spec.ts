import { expect, test } from '@playwright/test';

import { launchDesktopScenario } from './helpers';

test('desktop shell covers the default fake runtime journey end-to-end', async () => {
  const runtime = await launchDesktopScenario('default');

  try {
    const { page } = runtime;

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Tune runtime inputs, noisy traffic filters, and execution defaults.' })).toBeVisible();
    await page.getByRole('button', { name: 'Home' }).click();

    await page.getByRole('button', { name: '기록 시작' }).click();
    await expect(page.getByText('녹화 중')).toBeVisible();
    await page.getByRole('button', { name: '기록 종료' }).click();

    await expect(page.getByRole('heading', { name: 'Login -> Search -> Detail' })).toBeVisible();
    await expect(page.getByTestId('session-row-session-default')).toBeVisible();
    await expect(page.getByTestId('journey-step-evidence-step-login')).toBeVisible();
    await expect(page.getByTestId('journey-api-evidence-step-search')).toBeVisible();
    await expect(page.getByTestId('journey-k6-evidence')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Playwright 실행' })).toBeVisible();
    await page.getByTestId('artifact-tab-flow-doc').click();
    await expect(page.getByRole('button', { name: 'Playwright 실행' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'k6 실행' })).toHaveCount(0);
    await page.getByTestId('artifact-tab-k6').click();
    await expect(page.getByRole('button', { name: 'k6 실행' })).toBeVisible();
    await page.getByRole('button', { name: '현재 탭 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('Exported 1 file(s)');
    await page.getByRole('button', { name: '실행 번들 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('Bundle exported to');

    await page.getByTestId('artifact-tab-playwright').click();
    await page.getByRole('button', { name: 'Playwright 실행' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('Playwright');
    await expect(page.getByTestId('execution-status')).toContainText('succeeded');
    await expect(page.getByTestId('execution-log-panel')).toContainText('Preparing playwright bundle');
    await expect(page.getByTestId('execution-log-panel')).toContainText('Running playwright bundle');
    await expect(page.getByTestId('execution-log-panel')).toContainText('completed successfully');
  } finally {
    await runtime.close();
  }
});
