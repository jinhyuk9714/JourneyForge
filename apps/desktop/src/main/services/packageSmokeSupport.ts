import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const executableSuffix = (productName: string) => join(`${productName}.app`, 'Contents', 'MacOS', productName);

export const findPackagedAppExecutable = async (releaseDir: string, productName: string): Promise<string> => {
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const macDirectory = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => join(releaseDir, entry.name, executableSuffix(productName)))
    .at(0);

  if (!macDirectory) {
    throw new Error(`Could not find a packaged ${productName}.app under ${releaseDir}.`);
  }

  return macDirectory;
};

export const resolvePackagedDataDir = (userDataDir: string): string => join(userDataDir, 'data');
