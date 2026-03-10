import {
  DEFAULT_SETTINGS,
  buildEncodedPathWithSafeQuery,
  buildPathWithSafeQuery,
  locatorToPlaywright,
  quoteForCode,
} from '@journeyforge/shared';
import type {
  ArtifactKind,
  GeneratedArtifact,
  InputEvent,
  JourneyForgeSettings,
  NormalizedJourney,
} from '@journeyforge/shared';

const resolveInputValue = (input: InputEvent): string => {
  const fieldName = (input.fieldName ?? input.locator.value).toLowerCase();
  if (fieldName.includes('password')) {
    return "process.env.TEST_PASSWORD ?? ''";
  }
  if (fieldName.includes('email')) {
    return "process.env.TEST_EMAIL ?? ''";
  }
  return quoteForCode(input.value);
};

const objectLiteralForCode = (value: Record<string, string | number | boolean>): string => {
  const entries = Object.entries(value).map(([key, entry]) => {
    const renderedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : quoteForCode(key);
    const renderedValue = typeof entry === 'string' ? quoteForCode(entry) : String(entry);
    return `${renderedKey}: ${renderedValue}`;
  });

  return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
};

const selectK6Candidates = (journey: NormalizedJourney) => {
  const suggestedCandidates = journey.suggestions.k6Candidates
    .map((scenarioSlug) => journey.coreApis.find((api) => api.scenarioSlug === scenarioSlug))
    .filter((api): api is NonNullable<typeof api> => Boolean(api));

  if (suggestedCandidates.length > 0) {
    return suggestedCandidates;
  }

  const loadCandidates = journey.coreApis.filter((api) => api.candidateForLoadTest);
  const preferredWrite = loadCandidates.find(
    (api) => api.isWrite && !api.path.includes('/auth/') && !api.path.includes('/login'),
  );

  if (preferredWrite) {
    const relatedRead = loadCandidates.find((api) => {
      if (api.isWrite) {
        return false;
      }
      if (api.path === preferredWrite.path) {
        return true;
      }
      if (preferredWrite.method === 'POST') {
        return api.path.startsWith(`${preferredWrite.path}/`);
      }
      return api.path.startsWith(preferredWrite.path);
    });

    return [preferredWrite, relatedRead].filter((api): api is typeof preferredWrite => Boolean(api)).slice(0, 2);
  }

  return loadCandidates
    .sort((left, right) => Number(left.isWrite) - Number(right.isWrite) || left.timestamp - right.timestamp)
    .slice(0, 2);
};

const reasonsForCandidate = (journey: NormalizedJourney, scenarioSlug: string): string[] =>
  journey.suggestions.k6CandidateReasons.find((candidate) => candidate.scenarioSlug === scenarioSlug)?.reasons ?? [];

export const generatePlaywright = (journey: NormalizedJourney): string => {
  const initialPath = new URL(journey.steps[0]?.pageUrl ?? journey.baseUrl).pathname || '/';
  const lines = [
    "import { expect, test } from '@playwright/test';",
    '',
    `test(${quoteForCode(journey.slug)}, async ({ page }) => {`,
    `  await page.goto(${quoteForCode(initialPath)});`,
  ];

  for (const step of journey.steps) {
    for (const action of step.actions) {
      if (action.type === 'input') {
        lines.push(`  await ${locatorToPlaywright(action.locator)}.fill(${resolveInputValue(action)});`);
      }
      if (action.type === 'click') {
        if (action.locator.strategy === 'css') {
          lines.push('  // TODO: replace CSS locator with a more stable selector.');
        }
        lines.push(`  await ${locatorToPlaywright(action.locator)}.click();`);
      }
      if (action.type === 'submit') {
        lines.push(`  await ${locatorToPlaywright(action.locator)}.press('Enter');`);
      }
    }
  }

  const lastNavigation = [...journey.steps]
    .flatMap((step) => step.actions)
    .filter((action) => action.type === 'navigation')
    .pop();
  const expectedPath = lastNavigation ? new URL(lastNavigation.targetUrl).pathname : '/';

  lines.push(`  await expect(page).toHaveURL(${expectedPath === '/' ? '/' : `/${expectedPath.replace(/^\/+/, '').replace(/\//g, '\\/')}/`});`);
  lines.push('});');

  return `${lines.join('\n')}\n`;
};

export const generateFlowDoc = (journey: NormalizedJourney): string => {
  const lines = [`# Journey: ${journey.title}`, ''];

  for (const [index, step] of journey.steps.entries()) {
    lines.push(`## Step ${index + 1}. ${step.title}`);
    lines.push(`- Action: ${step.actionSummary}`);
    if ((step.explanation ?? []).length > 0) {
      lines.push('- Why:');
      for (const reason of step.explanation ?? []) {
        lines.push(`  - ${reason}`);
      }
    }
    const writeApi = step.apis.find((api) => api.isWrite && api.payloadTemplate);
    if (writeApi?.payloadTemplate) {
      lines.push(`- Payload fields: ${Object.keys(writeApi.payloadTemplate).join(', ')}`);
    }
    if (step.apis.length > 0) {
      lines.push('- API:');
      for (const api of step.apis) {
        lines.push(`  - ${api.method} ${buildPathWithSafeQuery(api.url)} (${api.status}, ${api.durationMs}ms)`);
        for (const reason of api.explanation ?? []) {
          lines.push(`    - Why: ${reason}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('## Load test candidates');
  for (const api of selectK6Candidates(journey)) {
    lines.push(`- ${api.method} ${api.path}`);
    for (const reason of reasonsForCandidate(journey, api.scenarioSlug)) {
      lines.push(`  - Why selected: ${reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

const buildScenarioBlock = (scenarioName: string, isWrite: boolean, index: number): string[] => {
  if (isWrite) {
    return [
      `    ${scenarioName}: {`,
      "      executor: 'ramping-vus',",
      `      startVUs: ${Math.max(1, index + 1)},`,
      "      stages: [",
      "        { duration: '30s', target: 5 },",
      "        { duration: '30s', target: 10 }",
      '      ]',
      '    }',
    ];
  }

  return [
    `    ${scenarioName}: {`,
    "      executor: 'constant-arrival-rate',",
    `      rate: ${index === 0 ? 20 : 10},`,
    "      timeUnit: '1s',",
    "      duration: '1m',",
    `      preAllocatedVUs: ${index === 0 ? 10 : 5},`,
    `      maxVUs: ${index === 0 ? 50 : 20}`,
    '    }',
  ];
};

export const generateK6 = (
  journey: NormalizedJourney,
  settings: JourneyForgeSettings = DEFAULT_SETTINGS,
): string | null => {
  const candidates = selectK6Candidates(journey);

  if (candidates.length === 0) {
    return null;
  }

  const scenarioBlocks = candidates
    .map((candidate, index) => buildScenarioBlock(candidate.scenarioSlug.replace(/-/g, '_'), candidate.isWrite, index))
    .flatMap((lines, index) => (index === candidates.length - 1 ? lines : [...lines.slice(0, -1), `${lines.at(-1)},`]));

  const bodyLines = candidates.map((candidate) =>
    candidate.isWrite
      ? `    http.${candidate.method.toLowerCase()}(\`${'${__ENV.BASE_URL}'}${buildEncodedPathWithSafeQuery(candidate.url)}\`, JSON.stringify(${objectLiteralForCode(candidate.payloadTemplate ?? {})}), { headers: { 'Content-Type': 'application/json' } })${candidate === candidates.at(-1) ? '' : ','}`
      : `    http.get(\`${'${__ENV.BASE_URL}'}${buildEncodedPathWithSafeQuery(candidate.url)}\`)${candidate === candidates.at(-1) ? '' : ','}`,
  );
  const usesWriteScenario = candidates.some((candidate) => candidate.isWrite);
  const statusLabel = usesWriteScenario ? 'status is 2xx' : 'status is 200';
  const statusCheck = usesWriteScenario
    ? '(response) => response.status >= 200 && response.status < 300'
    : '(response) => response.status === 200';

  return `import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
${scenarioBlocks.join('\n')}
  },
  thresholds: {
    http_req_duration: ['p(95)<${settings.k6Thresholds.httpReqDurationP95}'],
    http_req_failed: ['rate<${settings.k6Thresholds.httpReqFailedRate}']
  }
};

export default function () {
  const responses = [
${bodyLines.join('\n')}
  ];

  responses.forEach((res) => {
    check(res, {
      '${statusLabel}': ${statusCheck}
    });
  });
}
`;
};

const artifactDefinitions: Record<
  ArtifactKind,
  (journey: NormalizedJourney, settings?: JourneyForgeSettings) => string | null
> = {
  playwright: (journey) => generatePlaywright(journey),
  'flow-doc': (journey) => generateFlowDoc(journey),
  k6: (journey, settings) => generateK6(journey, settings),
};

const artifactFileName = (kind: ArtifactKind, slug: string): string => {
  if (kind === 'playwright') {
    return `${slug}.spec.ts`;
  }
  if (kind === 'flow-doc') {
    return `${slug}.flow.md`;
  }
  return `${slug}.js`;
};

const artifactRelativePath = (kind: ArtifactKind, fileName: string): string => {
  if (kind === 'playwright') {
    return `generated/playwright/${fileName}`;
  }
  if (kind === 'flow-doc') {
    return `generated/docs/${fileName}`;
  }
  return `generated/k6/${fileName}`;
};

export const buildJourneyArtifacts = (
  journey: NormalizedJourney,
  settings: JourneyForgeSettings = DEFAULT_SETTINGS,
): GeneratedArtifact[] =>
  (Object.keys(artifactDefinitions) as ArtifactKind[]).map((kind) => {
    const content = artifactDefinitions[kind](journey, settings);
    const fileName = artifactFileName(kind, journey.slug);
    return {
      kind,
      fileName,
      relativePath: content ? artifactRelativePath(kind, fileName) : null,
      content,
      generatedAt: Date.now(),
      status: content ? 'generated' : 'skipped',
      reason: content ? undefined : 'No load-test candidate APIs detected.',
    };
  });
