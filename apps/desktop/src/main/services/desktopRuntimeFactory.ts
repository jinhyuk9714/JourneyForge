import { resolve } from 'node:path';

import { createFakeDesktopRuntime } from './fakeDesktopRuntime';
import type { DesktopE2EScenario } from './fakeDesktopRuntime';
import { createJourneyForgeDesktopRuntime } from './journeyForgeDesktopService';
import type { DesktopRuntime } from './journeyForgeDesktopService';

export const DESKTOP_E2E_ENV = 'JOURNEYFORGE_DESKTOP_E2E';
export const DESKTOP_E2E_SCENARIO_ENV = 'JOURNEYFORGE_DESKTOP_SCENARIO';
export const DESKTOP_E2E_DATA_DIR_ENV = 'JOURNEYFORGE_DESKTOP_DATA_DIR';

type CreateDesktopRuntimeOptions = {
  env?: NodeJS.ProcessEnv;
  createRealRuntime?: (input: { dataDir: string }) => DesktopRuntime;
  createFakeRuntime?: (input: { dataDir: string; scenario: DesktopE2EScenario }) => DesktopRuntime;
};

const toScenario = (value: string | undefined): DesktopE2EScenario => {
  if (value === 'legacy' || value === 'cancel-execution') {
    return value;
  }

  return 'default';
};

export const createDesktopRuntime = ({
  env = process.env,
  createRealRuntime = ({ dataDir }) => createJourneyForgeDesktopRuntime({ dataDir }),
  createFakeRuntime = ({ dataDir, scenario }) => createFakeDesktopRuntime({ dataDir, scenario }),
}: CreateDesktopRuntimeOptions = {}): DesktopRuntime => {
  const dataDir = env[DESKTOP_E2E_DATA_DIR_ENV] ?? resolve(process.cwd(), 'data');

  if (env[DESKTOP_E2E_ENV] === '1') {
    return createFakeRuntime({
      dataDir,
      scenario: toScenario(env[DESKTOP_E2E_SCENARIO_ENV]),
    });
  }

  return createRealRuntime({
    dataDir,
  });
};
