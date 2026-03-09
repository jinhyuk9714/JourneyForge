import { resolve } from 'node:path';

import { createJourneyForgeApp } from '@journeyforge/core';

export const desktopApp = createJourneyForgeApp({
  dataDir: resolve(process.cwd(), 'data'),
});
