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
  buildMacReleaseNotarizationSteps,
  buildMacReleaseVerificationSteps,
  findMacReleaseArtifacts,
  resolveMacReleaseTag,
  validateMacReleaseTagVersion,
  validateMacReleaseEnvironment,
} = (await import(macosReleaseSupportModulePath)) as Awaited<
  Promise<{
    buildMacReleaseNotarizationSteps: (input: {
      dmgPath: string;
      env?: NodeJS.ProcessEnv;
    }) => MacReleaseVerificationStep[];
    buildMacReleaseVerificationSteps: (artifacts: Pick<MacReleaseArtifacts, 'appPath' | 'dmgPath'>) => MacReleaseVerificationStep[];
    findMacReleaseArtifacts: (input: {
      releaseDir: string;
      productName: string;
    }) => Promise<MacReleaseArtifacts>;
    resolveMacReleaseTag: (input: {
      inputTag?: string | null;
      githubRefName?: string | null;
      githubRefType?: string | null;
    }) => string;
    validateMacReleaseTagVersion: (input: {
      releaseTag: string;
      packageVersion: string;
    }) => {
      releaseVersion: string;
    };
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

  it('resolves the explicit workflow_dispatch tag ahead of the current ref', () => {
    expect(
      resolveMacReleaseTag({
        inputTag: 'v0.1.1',
        githubRefName: 'main',
        githubRefType: 'branch',
      }),
    ).toBe('v0.1.1');
  });

  it('resolves the current git tag when the workflow runs from a tag ref', () => {
    expect(
      resolveMacReleaseTag({
        githubRefName: 'v0.1.1',
        githubRefType: 'tag',
      }),
    ).toBe('v0.1.1');
  });

  it('requires a release tag for manual workflow runs from a branch ref', () => {
    expect(() =>
      resolveMacReleaseTag({
        githubRefName: 'main',
        githubRefType: 'branch',
      }),
    ).toThrow('Set workflow_dispatch input tag or run the workflow from a v* git tag.');
  });

  it('validates the release tag against the desktop package version', () => {
    expect(
      validateMacReleaseTagVersion({
        releaseTag: 'v0.1.1',
        packageVersion: '0.1.1',
      }),
    ).toEqual({
      releaseVersion: '0.1.1',
    });
  });

  it('rejects non-v release tags and version mismatches', () => {
    expect(() =>
      validateMacReleaseTagVersion({
        releaseTag: 'release-0.1.1',
        packageVersion: '0.1.1',
      }),
    ).toThrow('Release tag must start with v and include a semantic version, for example v0.1.1.');

    expect(() =>
      validateMacReleaseTagVersion({
        releaseTag: 'v0.1.2',
        packageVersion: '0.1.1',
      }),
    ).toThrow('Release tag v0.1.2 does not match desktop package version 0.1.1.');
  });

  it('builds DMG notarization steps for a keychain profile', () => {
    expect(
      buildMacReleaseNotarizationSteps({
        dmgPath: '/tmp/JourneyForge.dmg',
        env: {
          CSC_NAME: 'JINHYUK SUNG (9VRNY5PMG3)',
          APPLE_KEYCHAIN_PROFILE: 'JourneyForge',
          APPLE_KEYCHAIN: '/tmp/login.keychain-db',
        },
      }),
    ).toEqual([
      {
        label: 'codesign-dmg',
        command: 'codesign',
        args: [
          '--force',
          '--sign',
          'Developer ID Application: JINHYUK SUNG (9VRNY5PMG3)',
          '--timestamp',
          '/tmp/JourneyForge.dmg',
        ],
      },
      {
        label: 'notarytool-submit-dmg',
        command: 'xcrun',
        args: [
          'notarytool',
          'submit',
          '/tmp/JourneyForge.dmg',
          '--keychain-profile',
          'JourneyForge',
          '--keychain',
          '/tmp/login.keychain-db',
          '--wait',
        ],
      },
      {
        label: 'stapler-staple-dmg',
        command: 'xcrun',
        args: ['stapler', 'staple', '/tmp/JourneyForge.dmg'],
      },
    ]);
  });

  it('builds DMG notarization steps for App Store Connect API credentials', () => {
    expect(
      buildMacReleaseNotarizationSteps({
        dmgPath: '/tmp/JourneyForge.dmg',
        env: {
          CSC_NAME: 'JINHYUK SUNG (9VRNY5PMG3)',
          APPLE_API_KEY: '/tmp/AuthKey_ABCD1234.p8',
          APPLE_API_KEY_ID: 'ABCD1234',
          APPLE_API_ISSUER: 'issuer-id',
        },
      }),
    ).toEqual([
      {
        label: 'codesign-dmg',
        command: 'codesign',
        args: [
          '--force',
          '--sign',
          'Developer ID Application: JINHYUK SUNG (9VRNY5PMG3)',
          '--timestamp',
          '/tmp/JourneyForge.dmg',
        ],
      },
      {
        label: 'notarytool-submit-dmg',
        command: 'xcrun',
        args: [
          'notarytool',
          'submit',
          '/tmp/JourneyForge.dmg',
          '--key',
          '/tmp/AuthKey_ABCD1234.p8',
          '--key-id',
          'ABCD1234',
          '--issuer',
          'issuer-id',
          '--wait',
        ],
      },
      {
        label: 'stapler-staple-dmg',
        command: 'xcrun',
        args: ['stapler', 'staple', '/tmp/JourneyForge.dmg'],
      },
    ]);
  });

  it('builds DMG notarization steps for Apple ID credentials', () => {
    expect(
      buildMacReleaseNotarizationSteps({
        dmgPath: '/tmp/JourneyForge.dmg',
        env: {
          CSC_NAME: 'JINHYUK SUNG (9VRNY5PMG3)',
          APPLE_ID: 'qa@example.com',
          APPLE_APP_SPECIFIC_PASSWORD: 'app-password',
          APPLE_TEAM_ID: 'TEAM123456',
        },
      }),
    ).toEqual([
      {
        label: 'codesign-dmg',
        command: 'codesign',
        args: [
          '--force',
          '--sign',
          'Developer ID Application: JINHYUK SUNG (9VRNY5PMG3)',
          '--timestamp',
          '/tmp/JourneyForge.dmg',
        ],
      },
      {
        label: 'notarytool-submit-dmg',
        command: 'xcrun',
        args: [
          'notarytool',
          'submit',
          '/tmp/JourneyForge.dmg',
          '--apple-id',
          'qa@example.com',
          '--password',
          'app-password',
          '--team-id',
          'TEAM123456',
          '--wait',
        ],
      },
      {
        label: 'stapler-staple-dmg',
        command: 'xcrun',
        args: ['stapler', 'staple', '/tmp/JourneyForge.dmg'],
      },
    ]);
  });

  it('requires CSC_NAME so the DMG can be signed before notarization', () => {
    expect(() =>
      buildMacReleaseNotarizationSteps({
        dmgPath: '/tmp/JourneyForge.dmg',
        env: {
          APPLE_KEYCHAIN_PROFILE: 'JourneyForge',
        },
      }),
    ).toThrow('Set CSC_NAME so the signed macOS release flow can codesign the DMG before notarization.');
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
