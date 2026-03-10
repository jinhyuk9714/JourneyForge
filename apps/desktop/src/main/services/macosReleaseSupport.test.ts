// @vitest-environment node

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

type MacReleaseArtifacts = {
  appPath: string;
  dmgPath: string;
  zipPath: string;
};

type MacReleaseVerificationStep = {
  label: string;
  command: string;
  args: string[];
};

const macosReleaseSupportModulePath = '../../../scripts/macos-release-support.mjs';
const {
  buildMacReleaseVerificationSteps,
  findMacReleaseArtifacts,
  validateMacReleaseEnvironment,
} = (await import(macosReleaseSupportModulePath)) as Awaited<
  Promise<{
    buildMacReleaseVerificationSteps: (artifacts: Pick<MacReleaseArtifacts, 'appPath' | 'dmgPath'>) => MacReleaseVerificationStep[];
    findMacReleaseArtifacts: (input: {
      releaseDir: string;
      productName: string;
    }) => Promise<MacReleaseArtifacts>;
    validateMacReleaseEnvironment: (
      env?: NodeJS.ProcessEnv,
    ) => {
      ok: boolean;
      notarizationMode: 'api-key' | 'apple-id' | 'keychain' | null;
      errors: string[];
    };
  }>
>;

describe('macosReleaseSupport', () => {
  it('accepts API key based notarization credentials with an explicit signing identity', () => {
    expect(
      validateMacReleaseEnvironment({
        CSC_NAME: 'Developer ID Application: JourneyForge',
        APPLE_API_KEY: '/tmp/AuthKey_ABCD1234.p8',
        APPLE_API_KEY_ID: 'ABCD1234',
        APPLE_API_ISSUER: 'issuer-id',
      }),
    ).toEqual({
      ok: true,
      notarizationMode: 'api-key',
      errors: [],
    });
  });

  it('accepts Apple ID based notarization credentials with a certificate link', () => {
    expect(
      validateMacReleaseEnvironment({
        CSC_LINK: 'file:///tmp/cert.p12',
        APPLE_ID: 'qa@example.com',
        APPLE_APP_SPECIFIC_PASSWORD: 'app-password',
        APPLE_TEAM_ID: 'TEAM123456',
      }),
    ).toEqual({
      ok: true,
      notarizationMode: 'apple-id',
      errors: [],
    });
  });

  it('reports missing signing and notarization environment variables', () => {
    expect(validateMacReleaseEnvironment({})).toEqual({
      ok: false,
      notarizationMode: null,
      errors: [
        'Set CSC_NAME or CSC_LINK before building a signed macOS release.',
        'Set notarization credentials with either APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID, or APPLE_KEYCHAIN/APPLE_KEYCHAIN_PROFILE.',
      ],
    });
  });

  it('finds the signed release artifacts and builds verification commands', async () => {
    const releaseDir = mkdtempSync(join(tmpdir(), 'journeyforge-signed-release-'));
    const appPath = join(releaseDir, 'mac-arm64', 'JourneyForge.app');
    mkdirSync(join(appPath, 'Contents', 'MacOS'), { recursive: true });
    writeFileSync(join(appPath, 'Contents', 'MacOS', 'JourneyForge'), '#!/bin/sh\n', 'utf8');
    writeFileSync(join(releaseDir, 'JourneyForge-0.1.0-arm64.dmg'), 'dmg', 'utf8');
    writeFileSync(join(releaseDir, 'JourneyForge-0.1.0-arm64.zip'), 'zip', 'utf8');

    const artifacts = await findMacReleaseArtifacts({
      releaseDir,
      productName: 'JourneyForge',
    });

    expect(artifacts).toEqual({
      appPath,
      dmgPath: join(releaseDir, 'JourneyForge-0.1.0-arm64.dmg'),
      zipPath: join(releaseDir, 'JourneyForge-0.1.0-arm64.zip'),
    });

    expect(buildMacReleaseVerificationSteps(artifacts)).toEqual([
      {
        label: 'codesign',
        command: 'codesign',
        args: ['--verify', '--deep', '--strict', '--verbose=2', appPath],
      },
      {
        label: 'stapler-app',
        command: 'xcrun',
        args: ['stapler', 'validate', appPath],
      },
      {
        label: 'stapler-dmg',
        command: 'xcrun',
        args: ['stapler', 'validate', join(releaseDir, 'JourneyForge-0.1.0-arm64.dmg')],
      },
      {
        label: 'spctl-app',
        command: 'spctl',
        args: ['--assess', '--type', 'execute', '-vv', appPath],
      },
      {
        label: 'spctl-dmg',
        command: 'spctl',
        args: [
          '--assess',
          '--type',
          'open',
          '--context',
          'context:primary-signature',
          '-vv',
          join(releaseDir, 'JourneyForge-0.1.0-arm64.dmg'),
        ],
      },
      {
        label: 'package-smoke-signed',
        command: 'pnpm',
        args: ['test:package-smoke:signed'],
      },
    ]);
  });
});
