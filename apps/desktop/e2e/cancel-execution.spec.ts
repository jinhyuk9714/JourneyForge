import { expect, test } from '@playwright/test';

import { launchDesktopScenario } from './helpers';

test('desktop shell supports cancelling a running fake execution', async () => {
  const runtime = await launchDesktopScenario('cancel-execution');

  try {
    const { page } = runtime;

    await page.getByTestId('session-row-session-cancel').click();
    await page.getByRole('button', { name: 'Playwright 실행' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('running');
    await page.getByRole('button', { name: '실행 취소' }).click();
    await expect(page.getByTestId('execution-status')).toContainText('cancelled');
    await expect(page.getByTestId('execution-log-panel')).toContainText('Execution cancelled by user.');
  } finally {
    await runtime.close();
  }
});
