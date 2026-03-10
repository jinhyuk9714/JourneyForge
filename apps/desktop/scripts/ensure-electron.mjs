import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const electronPackagePath = require.resolve('electron/package.json');
const electronRoot = dirname(electronPackagePath);
const electronBinary =
  process.platform === 'darwin'
    ? join(electronRoot, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
    : process.platform === 'win32'
      ? join(electronRoot, 'dist', 'electron.exe')
      : join(electronRoot, 'dist', 'electron');

if (existsSync(electronBinary)) {
  console.log(`Electron binary already present at ${electronBinary}`);
  process.exit(0);
}

const installScript = join(electronRoot, 'install.js');
const result = spawnSync(process.execPath, [installScript], {
  cwd: electronRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
