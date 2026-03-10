import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { createJourneyForgeApp } from './index';
import { startDemoTargetServer } from './test-support/demoTargetServer';

describe('recording smoke', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await cleanup?.();
    cleanup = null;
  });

  it('records a real browser journey and generates assets end-to-end', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-smoke-'));
    const server = await startDemoTargetServer();
    cleanup = server.close;

    let activePage: Page | null = null;
    const app = createJourneyForgeApp({
      dataDir,
      recorder: {
        launchOptions: {
          headless: true,
        },
        onPageReady(page) {
          activePage = page;
        },
      },
    });

    const { sessionId } = await app.startRecording({
      baseUrl: `${server.baseUrl}/login`,
      name: 'Smoke Journey',
    });

    expect(activePage).not.toBeNull();

    await activePage!.getByLabel('Email').fill('qa@example.com');
    await activePage!.getByLabel('Password').fill('super-secret');
    await activePage!.getByRole('button', { name: '로그인' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/products`);
    await activePage!.getByPlaceholder('검색어').fill('맥북');
    await activePage!.getByRole('button', { name: '검색' }).click();
    await activePage!.getByRole('link', { name: 'MacBook Pro 14' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/products/42`);

    const bundle = await app.stopRecording(sessionId);

    expect(bundle.session.rawEvents.some((event) => event.type === 'click')).toBe(true);
    expect(bundle.session.rawEvents.some((event) => event.type === 'input')).toBe(true);
    expect(bundle.session.rawEvents.some((event) => event.type === 'navigation')).toBe(true);
    expect(bundle.session.rawEvents.some((event) => event.type === 'network-request')).toBe(true);
    expect(bundle.session.rawEvents.some((event) => event.type === 'network-response')).toBe(true);

    expect(bundle.journey.steps.map((step) => step.title)).toEqual([
      'Open login page',
      'Login',
      'Search products',
      'Open product detail',
    ]);
    expect(bundle.journey.steps[1]?.explanation).toContain(
      'Classified as auth because POST /api/auth/login matched login heuristics.',
    );
    expect(bundle.journey.coreApis[1]?.explanation).toContain('Captured as fetch.');
    expect(bundle.journey.suggestions.k6CandidateReasons).toHaveLength(2);

    const playwrightArtifact = bundle.artifacts.find((artifact) => artifact.kind === 'playwright');
    const flowArtifact = bundle.artifacts.find((artifact) => artifact.kind === 'flow-doc');
    const k6Artifact = bundle.artifacts.find((artifact) => artifact.kind === 'k6');

    expect(playwrightArtifact?.content).toContain("getByLabel('Email')");
    expect(flowArtifact?.content).toContain('POST /api/auth/login');
    expect(flowArtifact?.content).toContain('GET /api/products');
    expect(flowArtifact?.content).toContain('GET /api/products/42');
    expect(k6Artifact?.status).toBe('generated');
    expect(k6Artifact?.content).toContain('/api/products/42');

    const exportedPaths = await app.exportArtifacts(bundle.session.id, ['playwright', 'flow-doc']);
    expect(exportedPaths).toHaveLength(2);
    expect(readFileSync(exportedPaths[0]!, 'utf8')).toContain("test('smoke-journey'");

    const bundleExport = await (
      app as unknown as {
        exportBundle(sessionId: string): Promise<{ bundlePath: string; exportedPaths: string[] }>;
      }
    ).exportBundle(bundle.session.id);
    expect(readFileSync(join(bundleExport.bundlePath, 'README.md'), 'utf8')).toContain('k6 CLI');
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'tests', 'smoke-journey.spec.ts'), 'utf8')).toContain(
      "await page.goto('/login');",
    );
    expect(readFileSync(join(bundleExport.bundlePath, 'k6', 'smoke-journey.js'), 'utf8')).toContain('/api/products/42');

    await app.dispose();
  }, 60_000);

  it('applies updated settings only to recordings started after the change', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-smoke-settings-'));
    const server = await startDemoTargetServer();
    cleanup = server.close;

    let activePage: Page | null = null;
    const app = createJourneyForgeApp({
      dataDir,
      recorder: {
        launchOptions: {
          headless: true,
        },
        onPageReady(page) {
          activePage = page;
        },
      },
    });

    await app.updateSettings({
      ...DEFAULT_SETTINGS,
      maskEmailInputs: false,
    });

    const first = await app.startRecording({
      baseUrl: `${server.baseUrl}/login`,
      name: 'Unmasked Journey',
    });

    await activePage!.getByLabel('Email').fill('qa@example.com');
    await activePage!.getByLabel('Password').fill('super-secret');

    const unmaskedBundle = await app.stopRecording(first.sessionId);
    const unmaskedEmail = unmaskedBundle.session.rawEvents.find(
      (event) => event.type === 'input' && event.fieldName === 'email',
    );

    expect(unmaskedBundle.session.settingsSnapshot).toBeDefined();
    expect(unmaskedBundle.session.settingsSnapshot!.maskEmailInputs).toBe(false);
    expect(unmaskedEmail).toMatchObject({
      value: 'qa@example.com',
      masked: false,
    });

    await app.updateSettings(DEFAULT_SETTINGS);

    const second = await app.startRecording({
      baseUrl: `${server.baseUrl}/login`,
      name: 'Masked Journey',
    });

    await activePage!.getByLabel('Email').fill('qa@example.com');
    await activePage!.getByLabel('Password').fill('super-secret');

    const maskedBundle = await app.stopRecording(second.sessionId);
    const maskedEmail = maskedBundle.session.rawEvents.find(
      (event) => event.type === 'input' && event.fieldName === 'email',
    );

    expect(maskedBundle.session.settingsSnapshot).toBeDefined();
    expect(maskedBundle.session.settingsSnapshot!.maskEmailInputs).toBe(true);
    expect(maskedEmail).toMatchObject({
      value: 'q***@example.com',
      masked: true,
    });

    await app.dispose();
  }, 60_000);

  it('records a create-post journey with write payload hints', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-smoke-create-'));
    const server = await startDemoTargetServer();
    cleanup = server.close;

    let activePage: Page | null = null;
    const app = createJourneyForgeApp({
      dataDir,
      recorder: {
        launchOptions: {
          headless: true,
        },
        onPageReady(page) {
          activePage = page;
        },
      },
    });

    const { sessionId } = await app.startRecording({
      baseUrl: `${server.baseUrl}/login`,
      name: 'Create Post Journey',
    });

    await activePage!.getByLabel('Email').fill('qa@example.com');
    await activePage!.getByLabel('Password').fill('super-secret');
    await activePage!.getByRole('button', { name: '로그인' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/products`);
    await activePage!.getByRole('link', { name: '게시글 작성' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/posts/new`);
    await activePage!.getByLabel('Title').fill('Launch checklist');
    await activePage!.getByLabel('Content').fill('Write flow support is ready for review.');
    await activePage!.getByRole('button', { name: '등록' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/posts/101`);

    const bundle = await app.stopRecording(sessionId);
    const createStep = bundle.journey.steps.find((step) => step.title === 'Create post');
    const createApi = bundle.journey.coreApis.find((api) => api.method === 'POST' && api.path === '/api/posts');
    const k6Artifact = bundle.artifacts.find((artifact) => artifact.kind === 'k6');

    expect((createStep as typeof createStep & { intent?: string })?.intent).toBe('create');
    expect((createApi as typeof createApi & { payloadTemplate?: Record<string, string> })?.payloadTemplate).toEqual({
      title: 'sample title',
      content: 'sample content',
    });
    expect(k6Artifact?.content).toContain('http.post');
    expect(k6Artifact?.content).toContain("'status is 2xx'");

    const exportedPaths = await app.exportArtifacts(bundle.session.id, ['flow-doc', 'k6']);
    expect(exportedPaths).toHaveLength(2);
    expect(readFileSync(exportedPaths[1]!, 'utf8')).toContain('http.post');

    const bundleExport = await (
      app as unknown as {
        exportBundle(sessionId: string): Promise<{ bundlePath: string; exportedPaths: string[] }>;
      }
    ).exportBundle(bundle.session.id);
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'tests', 'create-post-journey.spec.ts'), 'utf8')).toContain(
      "await page.goto('/login');",
    );
    expect(readFileSync(join(bundleExport.bundlePath, 'k6', 'create-post-journey.js'), 'utf8')).toContain('http.post');

    await app.dispose();
  }, 60_000);

  it('records an update-post journey with write payload hints', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'journeyforge-smoke-update-'));
    const server = await startDemoTargetServer();
    cleanup = server.close;

    let activePage: Page | null = null;
    const app = createJourneyForgeApp({
      dataDir,
      recorder: {
        launchOptions: {
          headless: true,
        },
        onPageReady(page) {
          activePage = page;
        },
      },
    });

    const { sessionId } = await app.startRecording({
      baseUrl: `${server.baseUrl}/login`,
      name: 'Update Post Journey',
    });

    await activePage!.getByLabel('Email').fill('qa@example.com');
    await activePage!.getByLabel('Password').fill('super-secret');
    await activePage!.getByRole('button', { name: '로그인' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/products`);
    await activePage!.getByRole('link', { name: 'JourneyForge roadmap' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/posts/99`);
    await activePage!.getByRole('link', { name: '수정하기' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/posts/99/edit`);
    await activePage!.getByLabel('Title').fill('JourneyForge roadmap v2');
    await activePage!.getByLabel('Content').fill('Write flow coverage now includes payload templates.');
    await activePage!.getByRole('button', { name: '저장' }).click();
    await activePage!.waitForURL(`${server.baseUrl}/posts/99`);

    const bundle = await app.stopRecording(sessionId);
    const updateStep = bundle.journey.steps.find((step) => step.title === 'Update post');
    const updateApi = bundle.journey.coreApis.find((api) => api.method === 'PATCH' && api.path === '/api/posts/99');
    const k6Artifact = bundle.artifacts.find((artifact) => artifact.kind === 'k6');

    expect((updateStep as typeof updateStep & { intent?: string })?.intent).toBe('update');
    expect((updateApi as typeof updateApi & { payloadTemplate?: Record<string, string> })?.payloadTemplate).toEqual({
      title: 'sample title',
      content: 'sample content',
    });
    expect(k6Artifact?.content).toContain('http.patch');
    expect(k6Artifact?.content).toContain("'status is 2xx'");

    const exportedPaths = await app.exportArtifacts(bundle.session.id, ['flow-doc', 'k6']);
    expect(exportedPaths).toHaveLength(2);
    expect(readFileSync(exportedPaths[1]!, 'utf8')).toContain('http.patch');

    const bundleExport = await (
      app as unknown as {
        exportBundle(sessionId: string): Promise<{ bundlePath: string; exportedPaths: string[] }>;
      }
    ).exportBundle(bundle.session.id);
    expect(readFileSync(join(bundleExport.bundlePath, 'playwright', 'tests', 'update-post-journey.spec.ts'), 'utf8')).toContain(
      "await page.goto('/login');",
    );
    expect(readFileSync(join(bundleExport.bundlePath, 'k6', 'update-post-journey.js'), 'utf8')).toContain('http.patch');

    await app.dispose();
  }, 60_000);
});
