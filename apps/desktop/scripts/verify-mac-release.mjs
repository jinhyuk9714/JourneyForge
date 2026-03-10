import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { buildMacReleaseVerificationSteps, findMacReleaseArtifacts } from './macos-release-support.mjs';

const releaseDir = resolve('release');
const productName = 'JourneyForge';

const artifacts = await findMacReleaseArtifacts({
  releaseDir,
  productName,
});

for (const step of buildMacReleaseVerificationSteps(artifacts)) {
  console.log(`Running: ${step.command} ${step.args.join(' ')}`);
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
