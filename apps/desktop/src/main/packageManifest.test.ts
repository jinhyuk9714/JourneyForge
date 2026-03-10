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
    expect(packageJson.scripts?.['pretest:smoke-execution-real']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs && pnpm --filter @journeyforge/core exec playwright install chromium',
    );
    expect(packageJson.scripts?.['test:smoke-execution-real']).toBe(
      'playwright test -c playwright.real-execution.config.ts',
    );
    expect(packageJson.scripts?.['prepackage:mac']).toBe(
      undefined,
    );
    expect(packageJson.scripts?.['prepackage:mac:signed']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs && pnpm exec electron-builder install-app-deps',
    );
    expect(packageJson.scripts?.['prepackage:mac:unsigned']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs && pnpm exec electron-builder install-app-deps',
    );
    expect(packageJson.scripts?.['prepackage:mac:dir:unsigned']).toBe(
      'pnpm --filter @journeyforge/shared build && pnpm --filter @journeyforge/core build && pnpm build && node scripts/ensure-electron.mjs && pnpm exec electron-builder install-app-deps',
    );
    expect(packageJson.scripts?.['package:mac']).toBe('pnpm package:mac:signed');
    expect(packageJson.scripts?.['package:mac:signed']).toBe('node scripts/package-mac-signed.mjs');
    expect(packageJson.scripts?.['package:mac:unsigned']).toBe(
      'pnpm exec electron-builder --config electron-builder.unsigned.yml --publish never',
    );
    expect(packageJson.scripts?.['package:mac:dir:unsigned']).toBe(
      'pnpm exec electron-builder --config electron-builder.unsigned.yml --dir --publish never',
    );
    expect(packageJson.scripts?.['pretest:package-smoke']).toBe(
      'pnpm package:mac:dir:unsigned',
    );
    expect(packageJson.scripts?.['test:package-smoke']).toBe(
      'playwright test -c playwright.package-smoke.config.ts',
    );
    expect(packageJson.scripts?.['test:package-smoke:signed']).toBe(
      'playwright test -c playwright.package-smoke.config.ts',
    );
    expect(packageJson.scripts?.['notarize:mac:verify']).toBe('node scripts/verify-mac-release.mjs');
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

  it('declares a signed macOS packaging baseline for the desktop app', () => {
    const builderConfig = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8');
    const mainEntitlements = readFileSync(resolve(__dirname, '../../build/entitlements.mac.plist'), 'utf8');
    const inheritedEntitlements = readFileSync(
      resolve(__dirname, '../../build/entitlements.mac.inherit.plist'),
      'utf8',
    );

    expect(builderConfig).toContain('productName: JourneyForge');
    expect(builderConfig).toContain('directories:');
    expect(builderConfig).toContain('output: release');
    expect(builderConfig).toContain('target:');
    expect(builderConfig).toContain('- dmg');
    expect(builderConfig).toContain('- zip');
    expect(builderConfig).toContain('hardenedRuntime: true');
    expect(builderConfig).toContain('gatekeeperAssess: false');
    expect(builderConfig).toContain('entitlements: build/entitlements.mac.plist');
    expect(builderConfig).toContain('entitlementsInherit: build/entitlements.mac.inherit.plist');
    expect(builderConfig).toContain('notarize: true');
    expect(builderConfig).not.toContain('identity: null');

    expect(mainEntitlements).toContain('com.apple.security.cs.allow-jit');
    expect(mainEntitlements).toContain('com.apple.security.cs.disable-library-validation');
    expect(inheritedEntitlements).toContain('com.apple.security.inherit');
    expect(inheritedEntitlements).toContain('com.apple.security.cs.allow-jit');
  });
});
