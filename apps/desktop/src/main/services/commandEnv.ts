import { execFileSync } from 'node:child_process';
import { delimiter } from 'node:path';

const DEFAULT_MAC_PATHS = [
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/opt/homebrew/opt/node@22/bin',
];

const splitPath = (value?: string) => value?.split(delimiter).filter(Boolean) ?? [];

const mergePaths = (...values: Array<string | undefined>) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of values) {
    for (const entry of splitPath(value)) {
      if (seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      merged.push(entry);
    }
  }

  return merged.join(delimiter);
};

export const parsePathHelperOutput = (output?: string) => {
  if (!output) {
    return undefined;
  }

  const match = output.match(/PATH="([^"]+)"/);
  return match?.[1];
};

const readMacPathHelper = () => {
  try {
    return parsePathHelperOutput(execFileSync('/usr/libexec/path_helper', ['-s'], { encoding: 'utf8' }));
  } catch {
    return undefined;
  }
};

export const buildExecutionEnv = (
  env: Record<string, string>,
  options: {
    platform?: NodeJS.Platform;
    pathHelperOutput?: string;
  } = {},
) => {
  const nextEnv = { ...env };
  const platform = options.platform ?? process.platform;

  if (platform === 'darwin') {
    const helperPath = parsePathHelperOutput(options.pathHelperOutput) ?? readMacPathHelper();
    nextEnv.PATH = mergePaths(nextEnv.PATH, helperPath, DEFAULT_MAC_PATHS.join(delimiter));
  }

  return nextEnv;
};
