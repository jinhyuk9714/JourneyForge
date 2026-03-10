import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-execution-real',
  fullyParallel: false,
  workers: 1,
  timeout: 360_000,
  reporter: 'line',
});
