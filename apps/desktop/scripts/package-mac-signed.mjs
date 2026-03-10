import { spawnSync } from 'node:child_process';

import { validateMacReleaseEnvironment } from './macos-release-support.mjs';

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
