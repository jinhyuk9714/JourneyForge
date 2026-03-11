import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { launchPackagedApp } from './helpers';

test('launches the packaged app and persists settings under userData', async () => {
  const scenario = await launchPackagedApp();

  try {
    await scenario.page.getByRole('button', { name: '설정' }).click();
    await expect(scenario.page.getByRole('heading', { name: '실행 설정과 필터를 관리하세요.' })).toBeVisible();
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
