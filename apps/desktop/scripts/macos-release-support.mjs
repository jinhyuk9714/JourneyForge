import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

export const validateMacReleaseEnvironment = (env = process.env) => {
  const hasSigningIdentity = hasValue(env.CSC_NAME) || hasValue(env.CSC_LINK);
  const hasApiKeyNotarization =
    hasValue(env.APPLE_API_KEY) && hasValue(env.APPLE_API_KEY_ID) && hasValue(env.APPLE_API_ISSUER);
  const hasAppleIdNotarization =
    hasValue(env.APPLE_ID) && hasValue(env.APPLE_APP_SPECIFIC_PASSWORD) && hasValue(env.APPLE_TEAM_ID);
  const hasKeychainProfile = hasValue(env.APPLE_KEYCHAIN_PROFILE);

  const errors = [];

  if (!hasSigningIdentity) {
    errors.push('Set CSC_NAME or CSC_LINK before building a signed macOS release.');
  }

  if (!hasApiKeyNotarization && !hasAppleIdNotarization && !hasKeychainProfile) {
    errors.push(
      'Set notarization credentials with either APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID, or APPLE_KEYCHAIN/APPLE_KEYCHAIN_PROFILE.',
    );
  }

  return {
    ok: errors.length === 0,
    notarizationMode: hasApiKeyNotarization
      ? 'api-key'
      : hasAppleIdNotarization
        ? 'apple-id'
        : hasKeychainProfile
          ? 'keychain'
          : null,
    errors,
  };
};

const pickArtifact = async (releaseDir, predicate, missingMessage) => {
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const match = entries
    .filter(predicate)
    .map((entry) => resolve(releaseDir, entry.name))
    .sort((left, right) => right.localeCompare(left))[0];

  if (!match) {
    throw new Error(missingMessage);
  }

  return match;
};

export const findMacReleaseArtifacts = async ({ releaseDir, productName }) => {
  const resolvedReleaseDir = resolve(releaseDir);
  const appContainer = await pickArtifact(
    resolvedReleaseDir,
    (entry) => entry.isDirectory() && entry.name.startsWith('mac'),
    `No macOS release directory found under ${resolvedReleaseDir}. Run package:mac:signed first.`,
  );
  const appPath = resolve(appContainer, `${productName}.app`);
  await access(join(appPath, 'Contents', 'MacOS', productName), constants.F_OK).catch(() => {
    throw new Error(`No packaged app executable found at ${appPath}.`);
  });

  const dmgPath = await pickArtifact(
    resolvedReleaseDir,
    (entry) => entry.isFile() && entry.name.startsWith(`${productName}-`) && entry.name.endsWith('.dmg'),
    `No signed DMG found under ${resolvedReleaseDir}.`,
  );
  const zipPath = await pickArtifact(
    resolvedReleaseDir,
    (entry) => entry.isFile() && entry.name.startsWith(`${productName}-`) && entry.name.endsWith('.zip'),
    `No signed ZIP found under ${resolvedReleaseDir}.`,
  );

  return {
    appPath,
    dmgPath,
    zipPath,
  };
};

export const buildMacReleaseVerificationSteps = ({ appPath, dmgPath }) => [
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
    args: ['stapler', 'validate', dmgPath],
  },
  {
    label: 'spctl-app',
    command: 'spctl',
    args: ['--assess', '--type', 'execute', '-vv', appPath],
  },
  {
    label: 'spctl-dmg',
    command: 'spctl',
    args: ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', dmgPath],
  },
  {
    label: 'package-smoke-signed',
    command: 'pnpm',
    args: ['test:package-smoke:signed'],
  },
];
