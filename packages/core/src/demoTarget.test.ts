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

  it('supports create-post flow in a real browser', async () => {
    const server = await startDemoTargetServer();
    cleanup = server.close;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${server.baseUrl}/login`);
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByLabel('Password').fill('super-secret');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(`${server.baseUrl}/products`);

    await page.getByRole('link', { name: '게시글 작성' }).click();
    await page.waitForURL(`${server.baseUrl}/posts/new`);

    await page.getByLabel('Title').fill('Launch checklist');
    await page.getByLabel('Content').fill('Write flow support is ready for review.');
    await page.getByRole('button', { name: '등록' }).click();

    await page.waitForURL(`${server.baseUrl}/posts/101`);
    expect(await page.getByRole('heading', { name: 'Launch checklist' }).isVisible()).toBe(true);
  }, 30_000);

  it('supports edit-post flow in a real browser', async () => {
    const server = await startDemoTargetServer();
    cleanup = server.close;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${server.baseUrl}/login`);
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByLabel('Password').fill('super-secret');
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(`${server.baseUrl}/products`);

    await page.getByRole('link', { name: 'JourneyForge roadmap' }).click();
    await page.waitForURL(`${server.baseUrl}/posts/99`);

    await page.getByRole('link', { name: '수정하기' }).click();
    await page.waitForURL(`${server.baseUrl}/posts/99/edit`);

    await page.getByLabel('Title').fill('JourneyForge roadmap v2');
    await page.getByLabel('Content').fill('Write flow coverage now includes payload templates.');
    await page.getByRole('button', { name: '저장' }).click();

    await page.waitForURL(`${server.baseUrl}/posts/99`);
    expect(await page.getByRole('heading', { name: 'JourneyForge roadmap v2' }).isVisible()).toBe(true);
  }, 30_000);
});
