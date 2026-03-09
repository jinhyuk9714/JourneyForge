import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

    await app.dispose();
  }, 60_000);
});
