import { afterEach, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';

import { startDemoTargetServer } from './test-support/demoTargetServer';

describe('demo target app', () => {
  let browser: Browser | null = null;
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await browser?.close();
    await cleanup?.();
    browser = null;
    cleanup = null;
  });

  it('supports login, search, and product detail flow in a real browser', async () => {
    const server = await startDemoTargetServer();
    cleanup = server.close;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${server.baseUrl}/login`);
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByLabel('Password').fill('super-secret');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(`${server.baseUrl}/products`);
    expect(page.url()).toBe(`${server.baseUrl}/products`);

    await page.getByPlaceholder('검색어').fill('맥북');
    await page.getByRole('button', { name: '검색' }).click();
    await page.waitForSelector('[data-testid="result-count"]');
    expect(await page.getByTestId('result-count').textContent()).toBe('1 results');

    await page.getByRole('link', { name: 'MacBook Pro 14' }).click();
    await page.waitForURL(`${server.baseUrl}/products/42`);
    expect(page.url()).toBe(`${server.baseUrl}/products/42`);
    expect(await page.getByRole('heading', { name: 'MacBook Pro 14' }).isVisible()).toBe(true);
  }, 30_000);
});
