import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from './helpers';

test('launches the packaged app and persists settings under userData', async () => {
  const scenario = await launchPackagedApp();

  try {
    await scenario.page.getByRole('button', { name: 'Settings' }).click();
    await expect(scenario.page.getByRole('heading', { name: 'Tune runtime inputs, noisy traffic filters, and execution defaults.' })).toBeVisible();
    await expect
      .poll(async () => {
        try {
          await access(join(scenario.dataDir, 'settings.json'));
          return 'present';
        } catch {
          return 'missing';
        }
      })
      .toBe('present');
  } finally {
    await scenario.close();
  }
});
