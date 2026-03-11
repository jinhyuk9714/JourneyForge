import { expect, test } from '@playwright/test';

import { launchDesktopScenario } from './helpers';

test('legacy bundles render without explainability sections', async () => {
  const runtime = await launchDesktopScenario('legacy');

  try {
    const { page } = runtime;

    await page.getByTestId('session-row-session-legacy').click();
    await expect(page.getByRole('heading', { name: 'Login -> Search -> Detail' })).toBeVisible();
    await expect(page.getByText('Search products')).toBeVisible();
    await expect(page.getByTestId('journey-step-evidence-step-login')).toHaveCount(0);
    await expect(page.getByTestId('journey-api-evidence-step-search')).toHaveCount(0);
    await expect(page.getByTestId('journey-k6-evidence')).toHaveCount(0);
    await expect(page.getByText('분류 근거')).toHaveCount(0);
    await expect(page.getByText('API 근거')).toHaveCount(0);
  } finally {
    await runtime.close();
  }
});
