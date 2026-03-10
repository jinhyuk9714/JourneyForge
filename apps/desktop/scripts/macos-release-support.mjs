import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;
const releaseTagPattern = /^v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

export const resolveMacReleaseTag = ({ inputTag, githubRefName, githubRefType }) => {
  if (hasValue(inputTag)) {
    return inputTag.trim();
  }

  if (githubRefType === 'tag' && hasValue(githubRefName)) {
    return githubRefName.trim();
  }

  throw new Error('Set workflow_dispatch input tag or run the workflow from a v* git tag.');
};

export const validateMacReleaseTagVersion = ({ releaseTag, packageVersion }) => {
  const match = releaseTagPattern.exec(releaseTag);
  if (!match) {
    throw new Error('Release tag must start with v and include a semantic version, for example v0.1.1.');
  }

  const [, releaseVersion] = match;
  if (releaseVersion !== packageVersion) {
    throw new Error(`Release tag ${releaseTag} does not match desktop package version ${packageVersion}.`);
  }

  return {
    releaseVersion,
  };
};

const resolveDmgSigningIdentity = (env = process.env) => {
  if (!hasValue(env.CSC_NAME)) {
    throw new Error('Set CSC_NAME so the signed macOS release flow can codesign the DMG before notarization.');
  }

  return env.CSC_NAME.startsWith('Developer ID Application:')
    ? env.CSC_NAME
    : `Developer ID Application: ${env.CSC_NAME}`;
};

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

export const buildMacReleaseNotarizationSteps = ({ dmgPath, env = process.env }) => {
  const submitArgs = ['notarytool', 'submit', dmgPath];
  const signingIdentity = resolveDmgSigningIdentity(env);

  if (hasValue(env.APPLE_API_KEY) && hasValue(env.APPLE_API_KEY_ID) && hasValue(env.APPLE_API_ISSUER)) {
    submitArgs.push('--key', env.APPLE_API_KEY, '--key-id', env.APPLE_API_KEY_ID, '--issuer', env.APPLE_API_ISSUER);
  } else if (hasValue(env.APPLE_ID) && hasValue(env.APPLE_APP_SPECIFIC_PASSWORD) && hasValue(env.APPLE_TEAM_ID)) {
    submitArgs.push('--apple-id', env.APPLE_ID, '--password', env.APPLE_APP_SPECIFIC_PASSWORD, '--team-id', env.APPLE_TEAM_ID);
  } else if (hasValue(env.APPLE_KEYCHAIN_PROFILE)) {
    submitArgs.push('--keychain-profile', env.APPLE_KEYCHAIN_PROFILE);
    if (hasValue(env.APPLE_KEYCHAIN)) {
      submitArgs.push('--keychain', env.APPLE_KEYCHAIN);
    }
  } else {
    throw new Error('No notarization credentials are available to submit the DMG.');
  }

  submitArgs.push('--wait');

  return [
    {
      label: 'codesign-dmg',
      command: 'codesign',
      args: ['--force', '--sign', signingIdentity, '--timestamp', dmgPath],
    },
    {
      label: 'notarytool-submit-dmg',
      command: 'xcrun',
      args: submitArgs,
    },
    {
      label: 'stapler-staple-dmg',
      command: 'xcrun',
      args: ['stapler', 'staple', dmgPath],
    },
  ];
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

export const writeGitHubOutput = async ({ outputPath, values }) => {
  if (!hasValue(outputPath)) {
    return;
  }

  const { appendFile } = await import('node:fs/promises');
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
};
