import { join } from 'node:path';

import type { JourneyForgeSettings, SessionBundle } from '@journeyforge/shared';

export type ProcessCommand = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  phase: 'preparing' | 'running';
  failureMessage?: string;
  onSuccess?(): Promise<void> | void;
};

const originFromBaseUrl = (baseUrl: string) => new URL(baseUrl).origin;

const buildSharedEnv = (baseUrl: string): Record<string, string> => ({
  BASE_URL: baseUrl,
});

export const buildPlaywrightExecutionPlan = (input: {
  bundlePath: string;
  sessionBundle: SessionBundle;
  settings: JourneyForgeSettings;
  password: string;
  hasNodeModules: boolean;
  needsBrowserInstall: boolean;
  browserInstallMarkerPath: string;
  writeBrowserInstallMarker(filePath: string): Promise<void>;
}): ProcessCommand[] => {
  const cwd = join(input.bundlePath, 'playwright');
  const baseUrl = input.settings.execution.playwrightBaseUrl || originFromBaseUrl(input.sessionBundle.session.baseUrl);
  const env = {
    ...buildSharedEnv(baseUrl),
    TEST_EMAIL: input.settings.execution.testEmail,
    TEST_PASSWORD: input.password,
  };
  const commands: ProcessCommand[] = [];

  if (!input.hasNodeModules) {
    commands.push({
      label: 'npm install',
      command: 'npm',
      args: ['install'],
      cwd,
      env,
      phase: 'preparing',
      failureMessage: 'Failed to install Playwright bundle dependencies.',
    });
  }

  if (input.needsBrowserInstall) {
    commands.push({
      label: 'npx playwright install chromium',
      command: 'npx',
      args: ['playwright', 'install', 'chromium'],
      cwd,
      env,
      phase: 'preparing',
      failureMessage: 'Failed to install the Playwright Chromium runtime.',
      onSuccess: async () => {
        await input.writeBrowserInstallMarker(input.browserInstallMarkerPath);
      },
    });
  }

  commands.push({
    label: 'npx playwright test',
    command: 'npx',
    args: ['playwright', 'test'],
    cwd,
    env,
    phase: 'running',
    failureMessage: 'Playwright execution failed.',
  });

  return commands;
};

export const buildK6ExecutionPlan = (input: {
  bundlePath: string;
  sessionBundle: SessionBundle;
  settings: JourneyForgeSettings;
}): ProcessCommand[] => {
  const cwd = join(input.bundlePath, 'k6');
  const baseUrl = input.settings.execution.k6BaseUrl || originFromBaseUrl(input.sessionBundle.session.baseUrl);
  const env = buildSharedEnv(baseUrl);

  return [
    {
      label: 'k6 version',
      command: 'k6',
      args: ['version'],
      cwd,
      env,
      phase: 'preparing',
      failureMessage: 'Install k6 and make sure it is available on your PATH before running this journey.',
    },
    {
      label: `k6 run ${input.sessionBundle.journey.slug}.js`,
      command: 'k6',
      args: ['run', `${input.sessionBundle.journey.slug}.js`],
      cwd,
      env,
      phase: 'running',
      failureMessage: 'k6 execution failed.',
    },
  ];
};
