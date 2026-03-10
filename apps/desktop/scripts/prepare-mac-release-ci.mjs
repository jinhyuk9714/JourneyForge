import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveMacReleaseTag,
  validateMacReleaseTagVersion,
  writeGitHubOutput,
} from './macos-release-support.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopPackageJsonPath = resolve(__dirname, '..', 'package.json');

const packageJson = JSON.parse(await readFile(desktopPackageJsonPath, 'utf8'));
const releaseTag = resolveMacReleaseTag({
  inputTag: process.env.INPUT_TAG,
  githubRefName: process.env.GITHUB_REF_NAME,
  githubRefType: process.env.GITHUB_REF_TYPE,
});
const { releaseVersion } = validateMacReleaseTagVersion({
  releaseTag,
  packageVersion: packageJson.version,
});

console.log(`Resolved release tag: ${releaseTag}`);
console.log(`Desktop package version: ${releaseVersion}`);

await writeGitHubOutput({
  outputPath: process.env.GITHUB_OUTPUT,
  values: {
    release_tag: releaseTag,
    release_version: releaseVersion,
  },
});
