import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: 'line',
});
