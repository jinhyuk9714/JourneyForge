// @vitest-environment node

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findPackagedAppExecutable, resolvePackagedDataDir } from './packageSmokeSupport';

describe('packageSmokeSupport', () => {
  it('finds the packaged app executable in the release directory', async () => {
    const releaseDir = mkdtempSync(join(tmpdir(), 'journeyforge-release-'));
    const executablePath = join(releaseDir, 'mac-arm64', 'JourneyForge.app', 'Contents', 'MacOS', 'JourneyForge');
    mkdirSync(join(executablePath, '..'), { recursive: true });
    writeFileSync(executablePath, '#!/bin/sh\n', 'utf8');

    await expect(findPackagedAppExecutable(releaseDir, 'JourneyForge')).resolves.toBe(executablePath);
  });

  it('resolves packaged app data under the macOS userData path', () => {
    expect(resolvePackagedDataDir('/tmp/Library/Application Support/@journeyforge/desktop')).toBe(
      '/tmp/Library/Application Support/@journeyforge/desktop/data',
    );
  });
});
