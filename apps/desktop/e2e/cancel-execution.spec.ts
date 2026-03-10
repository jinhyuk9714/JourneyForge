import { expect, test } from '@playwright/test';

import { launchDesktopScenario } from './helpers';

test('desktop shell supports cancelling a running fake execution', async () => {
  const runtime = await launchDesktopScenario('cancel-execution');

  try {
    const { page } = runtime;

    await page.getByTestId('session-row-session-cancel').click();
    await page.getByRole('button', { name: 'Playwright 실행' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('실행 중');
    await page.getByRole('button', { name: '실행 취소' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('취소됨');
    await expect(page.getByTestId('execution-log-panel')).toContainText('사용자가 실행을 취소했습니다.');
  } finally {
    await runtime.close();
  }
});
