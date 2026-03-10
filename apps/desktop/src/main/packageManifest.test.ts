// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('desktop package manifest', () => {
  it('declares the Electron main entry used by electron-vite dev', () => {
    const packageJsonPath = resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      main?: string;
      scripts?: Record<string, string>;
    };

    expect(packageJson.main).toBe('out/main/index.js');
    expect(packageJson.scripts?.predev).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build',
    );
    expect(packageJson.scripts?.['pretest:e2e']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs',
    );
    expect(packageJson.scripts?.['test:e2e']).toBe('playwright test -c playwright.e2e.config.ts');
    expect(packageJson.scripts?.['pretest:smoke-real']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs && pnpm --filter @journeyforge/core exec playwright install chromium',
    );
    expect(packageJson.scripts?.['test:smoke-real']).toBe('playwright test -c playwright.real-smoke.config.ts');
  });

  it('points workspace runtime packages at built dist entries for Electron execution', () => {
    const corePackageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../packages/core/package.json'), 'utf8'),
    ) as {
      main?: string;
      module?: string;
      types?: string;
      exports?: { '.': { types?: string; import?: string; default?: string } };
    };
    const sharedPackageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../packages/shared/package.json'), 'utf8'),
    ) as {
      main?: string;
      module?: string;
      types?: string;
      exports?: { '.': { types?: string; import?: string; default?: string } };
    };

    for (const packageJson of [corePackageJson, sharedPackageJson]) {
      expect(packageJson.main).toBe('./dist/index.js');
      expect(packageJson.module).toBe('./dist/index.js');
      expect(packageJson.types).toBe('./dist/index.d.ts');
      expect(packageJson.exports?.['.']).toEqual({
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      });
    }
  });
});
