import { expect, test } from '@playwright/test';

import { launchDesktopScenario } from './helpers';

test('desktop shell covers the default fake runtime journey end-to-end', async () => {
  const runtime = await launchDesktopScenario('default');

  try {
    const { page } = runtime;

    await page.getByRole('button', { name: '설정' }).click();
    await expect(page.getByRole('heading', { name: '실행 입력값, 노이즈 필터, 기본값을 조정하세요.' })).toBeVisible();
    await page.getByRole('button', { name: '홈' }).click();

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
    await expect(page.getByTestId('export-message')).toContainText('1개 파일을 내보냈습니다');
    await page.getByRole('button', { name: '실행 번들 내보내기' }).click();
    await expect(page.getByTestId('export-message')).toContainText('번들을');

    await page.getByTestId('artifact-tab-playwright').click();
    await page.getByRole('button', { name: 'Playwright 실행' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('Playwright');
    await expect(page.getByTestId('execution-status')).toContainText('성공');
    await expect(page.getByTestId('execution-log-panel')).toContainText('playwright 번들을 준비하는 중입니다');
    await expect(page.getByTestId('execution-log-panel')).toContainText('playwright 번들을 실행하는 중입니다');
    await expect(page.getByTestId('execution-log-panel')).toContainText('성공적으로 완료되었습니다');
  } finally {
    await runtime.close();
  }
});
