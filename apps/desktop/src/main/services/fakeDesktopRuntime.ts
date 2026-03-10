import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type {
  ApiCall,
  ArtifactKind,
  ClickEvent,
  ExecutionLogEntry,
  ExecutionSnapshot,
  ExecutionTarget,
  ExportBundleManifest,
  ExportResult,
  GeneratedArtifact,
  InputEvent,
  JourneyForgeSettings,
  NavigationEvent,
  RawEvent,
  RecordedSession,
  RecorderStatus,
  SessionBundle,
  SessionSummary,
  SettingsPayload,
} from '@journeyforge/shared';

import type { DesktopRuntime } from './journeyForgeDesktopService';

export type DesktopE2EScenario = 'default' | 'legacy' | 'cancel-execution';

type CreateFakeDesktopRuntimeOptions = {
  dataDir: string;
  scenario: DesktopE2EScenario;
};

type ExecutionFlowMode = 'auto-success' | 'manual-cancel';

const baseUrl = 'http://localhost:3000/login';
const baseOrigin = 'http://localhost:3000';

const createInput = (
  id: string,
  value: string,
  fieldName: string,
  locatorValue: string,
  timestamp: number,
  masked = false,
): InputEvent => ({
  id,
  type: 'input',
  timestamp,
  pageUrl: baseUrl,
  locator: {
    strategy: 'label',
    value: locatorValue,
  },
  value,
  masked,
  fieldName,
});

const createClick = (id: string, text: string, pageUrl: string, timestamp: number): ClickEvent => ({
  id,
  type: 'click',
  timestamp,
  pageUrl,
  locator: {
    strategy: 'role',
    value: `button:${text}`,
  },
  text,
});

const createNavigation = (
  id: string,
  pageUrl: string,
  targetUrl: string,
  timestamp: number,
  trigger: NavigationEvent['trigger'],
): NavigationEvent => ({
  id,
  type: 'navigation',
  timestamp,
  pageUrl,
  targetUrl,
  trigger,
});

const createApi = (
  id: string,
  requestId: string,
  method: ApiCall['method'],
  path: string,
  status: number,
  timestamp: number,
  pageUrl: string,
  overrides: Partial<ApiCall> = {},
): ApiCall => ({
  id,
  requestId,
  method,
  url: `${baseOrigin}${path}`,
  path,
  status,
  durationMs: 180,
  pageUrl,
  timestamp,
  query: {},
  contentType: 'application/json',
  scenarioSlug: `${method.toLowerCase()}-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`,
  isWrite: method !== 'GET',
  candidateForLoadTest: true,
  expectedStatuses: [status],
  explanation: [
    'Captured as fetch/xhr.',
    'Excluded static and analytics filters before attaching to the journey.',
    'Attached to this step because the request completed before the next step started.',
  ],
  ...overrides,
});

const buildGeneratedArtifacts = (journeySlug: string): GeneratedArtifact[] => [
  {
    kind: 'playwright',
    fileName: `${journeySlug}.spec.ts`,
    relativePath: `generated/playwright/${journeySlug}.spec.ts`,
    generatedAt: 1_710_000_000_900,
    status: 'generated',
    content: `import { expect, test } from '@playwright/test';

test('${journeySlug}', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? 'qa@example.com');
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD ?? 'secret');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/products|posts/);
});`,
  },
  {
    kind: 'flow-doc',
    fileName: `${journeySlug}.flow.md`,
    relativePath: `generated/docs/${journeySlug}.flow.md`,
    generatedAt: 1_710_000_000_900,
    status: 'generated',
    content: `# Journey: ${journeySlug}

## Step 1. Login
- Why:
  - Classified as auth because POST /api/auth/login matched login heuristics.

## Load test candidates
- get-products
  - Why selected: Read API attached to the core search journey.`,
  },
  {
    kind: 'k6',
    fileName: `${journeySlug}.js`,
    relativePath: `generated/k6/${journeySlug}.js`,
    generatedAt: 1_710_000_000_900,
    status: 'generated',
    content: `import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const response = http.get(\`\${__ENV.BASE_URL}/api/products?keyword=macbook\`);
  check(response, {
    'status is 2xx': (res) => res.status >= 200 && res.status < 300,
  });
}`,
  },
];

const buildDefaultBundle = (sessionId: string, scenarioName = 'Login Search Detail'): SessionBundle => {
  const session: RecordedSession = {
    id: sessionId,
    name: scenarioName,
    baseUrl,
    startedAt: 1_710_000_000_000,
    endedAt: 1_710_000_005_000,
    settingsSnapshot: DEFAULT_SETTINGS,
    rawEvents: [
      createNavigation('nav-login', baseUrl, baseUrl, 1_710_000_000_000, 'goto'),
      createInput('input-email', 'qa@example.com', 'email', 'Email', 1_710_000_000_400),
      createInput('input-password', '******', 'password', 'Password', 1_710_000_000_700, true),
      createClick('click-login', '로그인', baseUrl, 1_710_000_000_900),
      createNavigation('nav-products', baseUrl, `${baseOrigin}/products`, 1_710_000_001_200, 'redirect'),
      createInput('input-search', 'macbook', 'keyword', '검색어', 1_710_000_001_400),
      createClick('click-search', '검색', `${baseOrigin}/products`, 1_710_000_001_500),
      createClick('click-card', 'MacBook Pro', `${baseOrigin}/products`, 1_710_000_002_000),
      createNavigation(
        'nav-detail',
        `${baseOrigin}/products`,
        `${baseOrigin}/products/42`,
        1_710_000_002_300,
        'click',
      ),
    ],
  };

  const loginApi = createApi('api-login', 'req-login', 'POST', '/api/auth/login', 200, 1_710_000_001_000, baseUrl, {
    candidateForLoadTest: false,
    explanation: [
      'Captured as fetch/xhr.',
      'Attached to this step because the login button triggered the request.',
      'Excluded from k6 candidates because auth APIs stay out of default load-test drafts.',
    ],
  });
  const productsApi = createApi(
    'api-products',
    'req-products',
    'GET',
    '/api/products',
    200,
    1_710_000_001_700,
    `${baseOrigin}/products`,
    {
      query: {
        keyword: 'macbook',
      },
      scenarioSlug: 'get-products',
      explanation: [
        'Captured as fetch/xhr.',
        'Excluded static and analytics noise before attaching to the search step.',
        'Selected as a k6 candidate because it is a business read API tied to a repeated search flow.',
      ],
    },
  );
  const detailApi = createApi(
    'api-detail',
    'req-detail',
    'GET',
    '/api/products/42',
    200,
    1_710_000_002_400,
    `${baseOrigin}/products/42`,
    {
      scenarioSlug: 'get-product-detail',
      explanation: [
        'Captured as fetch/xhr.',
        'Attached to the detail step because the request followed the product card click.',
        'Selected as a paired read target for bundle export and k6 suggestions.',
      ],
    },
  );

  const journey = {
    id: `journey-${sessionId}`,
    title: 'Login -> Search -> Detail',
    slug: 'login-search-detail',
    baseUrl: baseOrigin,
    steps: [
      {
        id: 'step-login',
        title: 'Login',
        intent: 'auth' as const,
        pageUrl: baseUrl,
        startedAt: 1_710_000_000_000,
        endedAt: 1_710_000_001_100,
        actionSummary: 'Enter credentials and submit the login form.',
        actions: session.rawEvents.slice(0, 4) as Array<ClickEvent | InputEvent | NavigationEvent>,
        apis: [loginApi],
        explanation: [
          'Grouped 2 inputs and 1 click before the next navigation began.',
          'Classified as auth because POST /api/auth/login matched login heuristics.',
        ],
      },
      {
        id: 'step-search',
        title: 'Search products',
        intent: 'read' as const,
        pageUrl: `${baseOrigin}/products`,
        startedAt: 1_710_000_001_200,
        endedAt: 1_710_000_001_900,
        actionSummary: 'Search for a product from the listing page.',
        actions: [session.rawEvents[4], session.rawEvents[5], session.rawEvents[6]] as Array<
          ClickEvent | InputEvent | NavigationEvent
        >,
        apis: [productsApi],
        explanation: [
          'Grouped the search input with the triggering click before the next step started.',
          'Classified as read because GET /api/products is the core API for this step.',
        ],
      },
      {
        id: 'step-detail',
        title: 'Open product detail',
        intent: 'read' as const,
        pageUrl: `${baseOrigin}/products/42`,
        startedAt: 1_710_000_002_000,
        endedAt: 1_710_000_002_500,
        actionSummary: 'Open a product card and load its detail page.',
        actions: [session.rawEvents[7], session.rawEvents[8]] as Array<ClickEvent | InputEvent | NavigationEvent>,
        apis: [detailApi],
        explanation: [
          'Started a new step when the product card click was followed by a detail navigation.',
          'Classified as read because the attached API is a GET detail fetch.',
        ],
      },
    ],
    coreApis: [loginApi, productsApi, detailApi],
    suggestions: {
      playwright: true,
      k6Candidates: ['get-products', 'get-product-detail'],
      k6CandidateReasons: [
        {
          scenarioSlug: 'get-products',
          reasons: [
            'Selected because it is a core business API used directly after search input.',
            'Auth APIs were excluded from k6 candidate selection.',
          ],
        },
        {
          scenarioSlug: 'get-product-detail',
          reasons: [
            'Paired with the search API because it validates the follow-up detail load.',
            'Selected as a stable read target with a successful 2xx response.',
          ],
        },
      ],
    },
  };

  return {
    session,
    journey,
    artifacts: buildGeneratedArtifacts(journey.slug),
  };
};

const buildLegacyBundle = (sessionId: string): SessionBundle => {
  const bundle = buildDefaultBundle(sessionId, 'Legacy Login Search Detail');

  return {
    ...bundle,
    journey: {
      ...bundle.journey,
      steps: bundle.journey.steps.map((step) => ({
        ...step,
        explanation: [],
        apis: step.apis.map((api) => ({
          ...api,
          explanation: [],
        })),
      })),
      suggestions: {
        ...bundle.journey.suggestions,
        k6CandidateReasons: [],
      },
    },
  };
};

const buildBundleForScenario = (scenario: DesktopE2EScenario, sessionId: string) => {
  if (scenario === 'legacy') {
    return buildLegacyBundle(sessionId);
  }

  return buildDefaultBundle(sessionId, scenario === 'cancel-execution' ? 'Cancel Execution Journey' : 'Login Search Detail');
};

const toSummary = (bundle: SessionBundle): SessionSummary => ({
  id: bundle.session.id,
  name: bundle.session.name,
  startedAt: bundle.session.startedAt,
  endedAt: bundle.session.endedAt,
  stepCount: bundle.journey.steps.length,
  artifactKinds: bundle.artifacts.filter((artifact) => artifact.status === 'generated').map((artifact) => artifact.kind),
});

const ensureDir = async (target: string) => {
  await mkdir(target, { recursive: true });
};

const writeArtifactFile = async (rootDir: string, artifact: GeneratedArtifact) => {
  if (artifact.status !== 'generated' || !artifact.content || !artifact.relativePath) {
    return null;
  }

  const target = join(rootDir, artifact.relativePath);
  await ensureDir(join(target, '..'));
  await writeFile(target, artifact.content, 'utf8');
  return target;
};

const createIdleExecutionSnapshot = (): ExecutionSnapshot => ({
  state: 'idle',
  logs: [],
  updatedAt: Date.now(),
});

export const createFakeDesktopRuntime = ({
  dataDir,
  scenario,
}: CreateFakeDesktopRuntimeOptions): DesktopRuntime => {
  const settings = structuredClone(DEFAULT_SETTINGS) as JourneyForgeSettings;
  let credentialStatus = {
    hasPlaywrightPassword: false,
  };
  let password = '';
  let recorderStatus: RecorderStatus = {
    state: 'idle',
    eventCount: 0,
  };
  let executionSnapshot = createIdleExecutionSnapshot();
  let activeRun:
    | {
        runId: string;
        timerIds: ReturnType<typeof setTimeout>[];
        mode: ExecutionFlowMode;
      }
    | null = null;
  const listeners = new Set<(snapshot: ExecutionSnapshot) => void>();
  const sessionBundles = new Map<string, SessionBundle>();
  const queuedRecordingSessionId = scenario === 'default' ? 'session-default' : `${scenario}-recording`;

  if (scenario === 'legacy') {
    sessionBundles.set('session-legacy', buildLegacyBundle('session-legacy'));
  }
  if (scenario === 'cancel-execution') {
    sessionBundles.set('session-cancel', buildBundleForScenario('cancel-execution', 'session-cancel'));
  }

  const emitExecution = () => {
    const next = {
      ...executionSnapshot,
      logs: [...executionSnapshot.logs],
    };
    for (const listener of listeners) {
      listener(next);
    }
  };

  const setExecutionSnapshot = (next: Partial<ExecutionSnapshot>) => {
    executionSnapshot = {
      ...executionSnapshot,
      ...next,
      updatedAt: Date.now(),
    };
    emitExecution();
  };

  const pushExecutionLog = (stream: ExecutionLogEntry['stream'], message: string) => {
    executionSnapshot = {
      ...executionSnapshot,
      logs: [
        ...executionSnapshot.logs,
        {
          id: randomUUID(),
          timestamp: Date.now(),
          stream,
          message,
        },
      ],
      updatedAt: Date.now(),
    };
    emitExecution();
  };

  const clearActiveRun = () => {
    if (!activeRun) {
      return;
    }
    for (const timerId of activeRun.timerIds) {
      clearTimeout(timerId);
    }
    activeRun = null;
  };

  const scheduleExecution = (runId: string, sessionId: string, target: ExecutionTarget, mode: ExecutionFlowMode) => {
    const timerIds: ReturnType<typeof setTimeout>[] = [];
    const finishRunning = () => {
      if (!activeRun || activeRun.runId !== runId) {
        return;
      }
      setExecutionSnapshot({
        state: 'running',
      });
      pushExecutionLog('system', `Running ${target} bundle for ${sessionId}.`);
      pushExecutionLog('stdout', `${target} line: bundle ready`);

      if (mode === 'auto-success') {
        const succeedTimer = setTimeout(() => {
          if (!activeRun || activeRun.runId !== runId) {
            return;
          }
          pushExecutionLog('stdout', `${target} line: completed successfully`);
          setExecutionSnapshot({
            state: 'succeeded',
            exitCode: 0,
          });
          clearActiveRun();
        }, 90);
        timerIds.push(succeedTimer);
      }
    };

    const prepareTimer = setTimeout(() => {
      if (!activeRun || activeRun.runId !== runId) {
        return;
      }
      setExecutionSnapshot({
        state: 'preparing',
      });
      pushExecutionLog('system', `Preparing ${target} bundle for ${sessionId}.`);
      const runningTimer = setTimeout(finishRunning, 70);
      timerIds.push(runningTimer);
    }, 30);
    timerIds.push(prepareTimer);

    activeRun = {
      runId,
      timerIds,
      mode,
    };
  };

  const getSettingsPayload = async (): Promise<SettingsPayload> => ({
    settings,
    credentialStatus,
  });

  return {
    async startRecording(input: { baseUrl: string }) {
      recorderStatus = {
        state: 'recording',
        eventCount: 1,
        sessionId: queuedRecordingSessionId,
        baseUrl: input.baseUrl,
      };
      return {
        sessionId: queuedRecordingSessionId,
      };
    },
    async getRecorderStatus() {
      if (recorderStatus.state === 'recording') {
        recorderStatus = {
          ...recorderStatus,
          eventCount: Math.min(recorderStatus.eventCount + 2, 9),
        };
      }
      return recorderStatus;
    },
    async stopRecording(sessionId: string) {
      const bundle = buildDefaultBundle(sessionId);
      sessionBundles.set(sessionId, bundle);
      recorderStatus = {
        state: 'ready',
        eventCount: bundle.session.rawEvents.length,
        sessionId,
        baseUrl: bundle.session.baseUrl,
      };
      return bundle;
    },
    async listSessions() {
      return [...sessionBundles.values()].map(toSummary).sort((left, right) => right.startedAt - left.startedAt);
    },
    async getSession(sessionId: string) {
      const bundle = sessionBundles.get(sessionId);
      if (!bundle) {
        throw new Error(`Unknown session ${sessionId}.`);
      }
      return bundle;
    },
    async exportArtifacts(sessionId: string, artifactKinds: ArtifactKind[]) {
      const bundle = await this.getSession(sessionId);
      const rootDir = join(dataDir, 'exports', `${sessionId}-artifacts`);
      await ensureDir(rootDir);
      const selectedKinds = artifactKinds.length > 0 ? new Set(artifactKinds) : null;
      const exportedPaths = (
        await Promise.all(
          bundle.artifacts
            .filter((artifact) => !selectedKinds || selectedKinds.has(artifact.kind))
            .map((artifact) => writeArtifactFile(rootDir, artifact)),
        )
      ).filter((target): target is string => Boolean(target));

      return exportedPaths;
    },
    async exportBundle(sessionId: string, artifactKinds?: ArtifactKind[]): Promise<ExportResult> {
      const bundle = await this.getSession(sessionId);
      const bundlePath = join(dataDir, 'exports', `${sessionId}-bundle`);
      const selectedKinds = artifactKinds && artifactKinds.length > 0 ? new Set(artifactKinds) : null;
      const selectedArtifacts = bundle.artifacts.filter(
        (artifact) => artifact.status === 'generated' && (!selectedKinds || selectedKinds.has(artifact.kind)),
      );

      await ensureDir(bundlePath);
      await ensureDir(join(bundlePath, 'docs'));
      await ensureDir(join(bundlePath, 'playwright', 'tests'));
      await ensureDir(join(bundlePath, 'k6'));

      const docsArtifact = selectedArtifacts.find((artifact) => artifact.kind === 'flow-doc');
      const playwrightArtifact = selectedArtifacts.find((artifact) => artifact.kind === 'playwright');
      const k6Artifact = selectedArtifacts.find((artifact) => artifact.kind === 'k6');

      const readmePath = join(bundlePath, 'README.md');
      const manifestPath = join(bundlePath, 'manifest.json');
      const exportedPaths = [readmePath, manifestPath];

      await writeFile(
        readmePath,
        `# JourneyForge runnable bundle

- Session: ${bundle.session.id}
- Journey: ${bundle.journey.title}
- Scenario: ${scenario}
- Note: This fake bundle exists only for desktop E2E validation.
`,
        'utf8',
      );

      if (docsArtifact?.content) {
        const docsPath = join(bundlePath, 'docs', docsArtifact.fileName);
        await writeFile(docsPath, docsArtifact.content, 'utf8');
        exportedPaths.push(docsPath);
      }

      if (playwrightArtifact?.content) {
        const playwrightRoot = join(bundlePath, 'playwright');
        const packageJsonPath = join(playwrightRoot, 'package.json');
        const configPath = join(playwrightRoot, 'playwright.config.ts');
        const envPath = join(playwrightRoot, '.env.example');
        const testPath = join(playwrightRoot, 'tests', playwrightArtifact.fileName);
        await writeFile(
          packageJsonPath,
          JSON.stringify(
            {
              name: `journeyforge-${bundle.journey.slug}`,
              private: true,
              type: 'module',
              devDependencies: {
                '@playwright/test': '^1.52.0',
              },
            },
            null,
            2,
          ),
          'utf8',
        );
        await writeFile(
          configPath,
          `import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL ?? '${baseOrigin}',
  },
});`,
          'utf8',
        );
        await writeFile(envPath, 'BASE_URL=http://localhost:3000\nTEST_EMAIL=qa@example.com\nTEST_PASSWORD=secret\n', 'utf8');
        await writeFile(testPath, playwrightArtifact.content, 'utf8');
        exportedPaths.push(packageJsonPath, configPath, envPath, testPath);
      }

      if (k6Artifact?.content) {
        const k6Root = join(bundlePath, 'k6');
        const envPath = join(k6Root, '.env.example');
        const scriptPath = join(k6Root, k6Artifact.fileName);
        await writeFile(envPath, 'BASE_URL=http://localhost:3000\n', 'utf8');
        await writeFile(scriptPath, k6Artifact.content, 'utf8');
        exportedPaths.push(envPath, scriptPath);
      }

      const manifest: ExportBundleManifest = {
        sessionId: bundle.session.id,
        journeySlug: bundle.journey.slug,
        generatedAt: Date.now(),
        artifactKinds: selectedArtifacts.map((artifact) => artifact.kind),
        entries: {
          readme: 'README.md',
          manifest: 'manifest.json',
          docs: docsArtifact ? `docs/${docsArtifact.fileName}` : undefined,
          playwright: playwrightArtifact
            ? {
                packageJson: 'playwright/package.json',
                config: 'playwright/playwright.config.ts',
                envExample: 'playwright/.env.example',
                testFile: `playwright/tests/${playwrightArtifact.fileName}`,
              }
            : undefined,
          k6: k6Artifact
            ? {
                envExample: 'k6/.env.example',
                script: `k6/${k6Artifact.fileName}`,
              }
            : undefined,
        },
      };
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      return {
        bundlePath,
        exportedPaths,
      };
    },
    getSettings() {
      return getSettingsPayload();
    },
    async updateSettings(nextSettings: JourneyForgeSettings) {
      Object.assign(settings, nextSettings, {
        k6Thresholds: {
          ...nextSettings.k6Thresholds,
        },
        execution: {
          ...nextSettings.execution,
        },
      });
      return getSettingsPayload();
    },
    async setPlaywrightPassword(value: string) {
      password = value;
      credentialStatus = {
        hasPlaywrightPassword: true,
      };
      return {
        configured: true as const,
      };
    },
    async clearPlaywrightPassword() {
      password = '';
      credentialStatus = {
        hasPlaywrightPassword: false,
      };
      return {
        configured: false as const,
      };
    },
    async startExecution(input: { sessionId: string; target: ExecutionTarget }) {
      if (activeRun && (executionSnapshot.state === 'preparing' || executionSnapshot.state === 'running')) {
        throw new Error('Another execution is already in progress.');
      }

      const bundleExport = await this.exportBundle(input.sessionId);
      const runId = randomUUID();
      executionSnapshot = {
        state: 'preparing',
        logs: [],
        updatedAt: Date.now(),
        runId,
        sessionId: input.sessionId,
        target: input.target,
        startedAt: Date.now(),
        bundlePath: bundleExport.bundlePath,
      };
      emitExecution();
      scheduleExecution(
        runId,
        input.sessionId,
        input.target,
        scenario === 'cancel-execution' ? 'manual-cancel' : 'auto-success',
      );

      return {
        runId,
      };
    },
    getExecutionStatus() {
      return {
        ...executionSnapshot,
        logs: [...executionSnapshot.logs],
      };
    },
    async cancelExecution(input: { runId: string }) {
      if (!activeRun || activeRun.runId !== input.runId) {
        return {
          cancelled: false,
        };
      }

      clearActiveRun();
      pushExecutionLog('system', 'Execution cancelled by user.');
      executionSnapshot = {
        ...executionSnapshot,
        state: 'cancelled',
        exitCode: 130,
        updatedAt: Date.now(),
      };
      emitExecution();
      return {
        cancelled: true,
      };
    },
    onExecutionUpdate(listener: (snapshot: ExecutionSnapshot) => void) {
      listeners.add(listener);
      listener({
        ...executionSnapshot,
        logs: [...executionSnapshot.logs],
      });
      return () => {
        listeners.delete(listener);
      };
    },
    async dispose() {
      clearActiveRun();
      listeners.clear();
      recorderStatus = {
        state: 'idle',
        eventCount: 0,
      };
      executionSnapshot = createIdleExecutionSnapshot();
      password = '';
    },
  };
};
