import { join } from 'node:path';

import type {
  ArtifactKind,
  ExportBundleManifest,
  GeneratedArtifact,
  NormalizedJourney,
  RecordedSession,
} from '@journeyforge/shared';

type BundleFile = {
  relativePath: string;
  content: string;
};

type BuildExportBundleInput = {
  session: RecordedSession;
  journey: NormalizedJourney;
  artifacts: GeneratedArtifact[];
  artifactKinds?: ArtifactKind[];
};

type BuiltExportBundle = {
  files: BundleFile[];
  manifest: ExportBundleManifest;
};

const findArtifact = (artifacts: GeneratedArtifact[], kind: ArtifactKind) =>
  artifacts.find((artifact) => artifact.kind === kind && artifact.status === 'generated' && artifact.content);

const defaultOrigin = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

const buildPlaywrightPackageJson = () =>
  `${JSON.stringify(
    {
      name: 'journeyforge-playwright-bundle',
      private: true,
      type: 'module',
      scripts: {
        test: 'playwright test',
      },
      devDependencies: {
        '@playwright/test': '^1.52.0',
        dotenv: '^16.4.7',
      },
    },
    null,
    2,
  )}\n`;

const buildPlaywrightConfig = (baseUrl: string) => `import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const defaultBaseURL = '${baseUrl}';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.BASE_URL ?? defaultBaseURL,
  },
});
`;

const buildPlaywrightEnvExample = (baseUrl: string) => `BASE_URL=${baseUrl}
TEST_EMAIL=qa@example.com
TEST_PASSWORD=super-secret
`;

const buildK6EnvExample = (baseUrl: string) => `BASE_URL=${baseUrl}
`;

const buildBundleReadme = ({
  session,
  journey,
  entries,
}: {
  session: RecordedSession;
  journey: NormalizedJourney;
  entries: ExportBundleManifest['entries'];
}) => {
  const sections = [
    `# JourneyForge Bundle: ${journey.title}`,
    '',
    `Session: ${session.id}`,
    `Journey slug: ${journey.slug}`,
    '',
    '## Contents',
    `- Playwright test: ${entries.playwright?.testFile ?? 'not included'}`,
    `- Flow doc: ${entries.docs ?? 'not included'}`,
    `- k6 script: ${entries.k6?.script ?? 'not included'}`,
    '',
    '## Playwright',
    '1. cd playwright',
    '2. npm install',
    '3. cp .env.example .env',
    '4. npx playwright install chromium',
    '5. npx playwright test',
    '',
    '## k6',
    'k6 CLI must be installed separately.',
    'Set BASE_URL from k6/.env.example, then run:',
    entries.k6?.script ? `k6 run ${entries.k6.script}` : 'No k6 script was generated for this session.',
  ];

  return `${sections.join('\n')}\n`;
};

export const buildExportBundle = ({
  session,
  journey,
  artifacts,
  artifactKinds,
}: BuildExportBundleInput): BuiltExportBundle => {
  const includedKinds = new Set(
    (artifactKinds?.length ? artifactKinds : artifacts.map((artifact) => artifact.kind)).filter((kind): kind is ArtifactKind =>
      artifacts.some((artifact) => artifact.kind === kind && artifact.status === 'generated' && artifact.content),
    ),
  );
  const baseUrl = defaultOrigin(session.baseUrl);
  const flowArtifact = includedKinds.has('flow-doc') ? findArtifact(artifacts, 'flow-doc') : undefined;
  const playwrightArtifact = includedKinds.has('playwright') ? findArtifact(artifacts, 'playwright') : undefined;
  const k6Artifact = includedKinds.has('k6') ? findArtifact(artifacts, 'k6') : undefined;

  const entries: ExportBundleManifest['entries'] = {
    readme: 'README.md',
    manifest: 'manifest.json',
    docs: flowArtifact ? join('docs', flowArtifact.fileName) : undefined,
    playwright: playwrightArtifact
      ? {
          packageJson: join('playwright', 'package.json'),
          config: join('playwright', 'playwright.config.ts'),
          envExample: join('playwright', '.env.example'),
          testFile: join('playwright', 'tests', playwrightArtifact.fileName),
        }
      : undefined,
    k6: k6Artifact
      ? {
          envExample: join('k6', '.env.example'),
          script: join('k6', k6Artifact.fileName),
        }
      : undefined,
  };

  const manifest: ExportBundleManifest = {
    sessionId: session.id,
    journeySlug: journey.slug,
    generatedAt: Date.now(),
    artifactKinds: [...includedKinds],
    entries,
  };

  const files: BundleFile[] = [
    {
      relativePath: entries.readme,
      content: buildBundleReadme({ session, journey, entries }),
    },
    {
      relativePath: entries.manifest,
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
  ];

  if (flowArtifact && entries.docs) {
    files.push({
      relativePath: entries.docs,
      content: flowArtifact.content!,
    });
  }

  if (playwrightArtifact && entries.playwright) {
    files.push(
      {
        relativePath: entries.playwright.packageJson,
        content: buildPlaywrightPackageJson(),
      },
      {
        relativePath: entries.playwright.config,
        content: buildPlaywrightConfig(baseUrl),
      },
      {
        relativePath: entries.playwright.envExample,
        content: buildPlaywrightEnvExample(baseUrl),
      },
      {
        relativePath: entries.playwright.testFile,
        content: playwrightArtifact.content!,
      },
    );
  }

  if (k6Artifact && entries.k6) {
    files.push(
      {
        relativePath: entries.k6.envExample,
        content: buildK6EnvExample(baseUrl),
      },
      {
        relativePath: entries.k6.script,
        content: k6Artifact.content!,
      },
    );
  }

  return {
    files,
    manifest,
  };
};
