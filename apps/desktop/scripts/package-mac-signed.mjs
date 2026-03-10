import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  buildMacReleaseNotarizationSteps,
  findMacReleaseArtifacts,
  validateMacReleaseEnvironment,
} from './macos-release-support.mjs';

const validation = validateMacReleaseEnvironment(process.env);

if (!validation.ok) {
  console.error('Signed macOS release prerequisites are missing.');
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Using notarization mode: ${validation.notarizationMode}`);

const result = spawnSync('pnpm', ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--publish', 'never'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const artifacts = await findMacReleaseArtifacts({
  releaseDir: resolve('release'),
  productName: 'JourneyForge',
});

for (const step of buildMacReleaseNotarizationSteps({
  dmgPath: artifacts.dmgPath,
  env: process.env,
})) {
  console.log(`Running: ${step.command} ${step.args.join(' ')}`);
  const stepResult = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (stepResult.status !== 0) {
    process.exit(stepResult.status ?? 1);
  }
}
