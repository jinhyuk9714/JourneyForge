import {
  DEFAULT_SETTINGS,
  buildPathWithSafeQuery,
  buildUrlWithSafeQuery,
  inferScenarioSlug,
  isAnalyticsUrl,
  isStaticAssetUrl,
  prettyPathLabel,
  safeQueryFromUrl,
  slugify,
} from '@journeyforge/shared';
import type {
  ApiCall,
  ClickEvent,
  InputEvent,
  JourneyStepIntent,
  NavigationEvent,
  NetworkRequestEvent,
  NetworkResponseEvent,
  NormalizedJourney,
  RawEvent,
  RecordedSession,
  SubmitEvent,
  JourneyForgeSettings,
} from '@journeyforge/shared';

type ActionEvent = ClickEvent | InputEvent | NavigationEvent | SubmitEvent;

type StepDraft = {
  id: string;
  title: string;
  intent: JourneyStepIntent;
  pageUrl: string;
  startedAt: number;
  endedAt: number;
  actionSummary: string;
  actions: ActionEvent[];
};

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const SENSITIVE_FIELD_PATTERN = /(password|secret|token|cookie|authorization|auth|email)/i;
const CONTENT_FIELD_PATTERN = /(content|description|body|message|notes?)/i;
const TITLE_FIELD_PATTERN = /title/i;
const SEARCH_FIELD_PATTERN = /(search|keyword|query|검색)/i;

const sanitizeFieldKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const singularize = (value: string): string => value.replace(/s$/, '');

const prettifyResource = (value: string): string => singularize(value).replace(/[-_]/g, ' ');

const resourceSegmentsFromPath = (path: string): string[] =>
  (path.split('?')[0] ?? '')
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== 'api');

const baseResourceSegment = (path: string): string => {
  const filtered = resourceSegmentsFromPath(path).filter(
    (segment) => !/^\d+$/.test(segment) && segment !== 'new' && segment !== 'edit',
  );
  return filtered.at(-1) ?? 'resource';
};

const resourceLabel = (path: string): string => prettifyResource(baseResourceSegment(path));

const expectedStatusesFor = (status: number): number[] => [status];

const isActionEvent = (event: RawEvent): event is ActionEvent =>
  event.type === 'click' ||
  event.type === 'input' ||
  event.type === 'navigation' ||
  event.type === 'submit';

const isAuthApi = (api: ApiCall): boolean => api.path.includes('/auth/') || api.path.includes('/login');

const buildPayloadTemplate = (actions: ActionEvent[]): Record<string, string> | undefined => {
  const entries = actions
    .filter((action): action is InputEvent => action.type === 'input')
    .filter((input) => !input.masked)
    .filter((input) => !SENSITIVE_FIELD_PATTERN.test(input.fieldName ?? input.locator.value))
    .map((input) => sanitizeFieldKey(input.fieldName ?? input.locator.value))
    .filter(Boolean)
    .map((fieldKey) => [
      fieldKey,
      TITLE_FIELD_PATTERN.test(fieldKey)
        ? 'sample title'
        : CONTENT_FIELD_PATTERN.test(fieldKey)
          ? 'sample content'
          : `sample ${fieldKey.replace(/_/g, ' ')}`,
    ] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const buildApiCalls = (events: RawEvent[], settings: JourneyForgeSettings): ApiCall[] => {
  const requestMap = new Map<string, NetworkRequestEvent>();
  const responseMap = new Map<string, NetworkResponseEvent>();

  for (const event of events) {
    if (event.type === 'network-request') {
      requestMap.set(event.requestId, event);
    }

    if (event.type === 'network-response') {
      responseMap.set(event.requestId, event);
    }
  }

  const rawApis: ApiCall[] = [];
  for (const request of requestMap.values()) {
    if (!['fetch', 'xhr'].includes(request.resourceType)) {
      continue;
    }
    if (isStaticAssetUrl(request.url) || isAnalyticsUrl(request.url, settings.analyticsPatterns)) {
      continue;
    }

    const response = responseMap.get(request.requestId);
    if (!response) {
      continue;
    }

    const pathWithQuery = buildPathWithSafeQuery(request.url);
    rawApis.push({
      id: `${request.requestId}-api`,
      requestId: request.requestId,
      method: request.method.toUpperCase(),
      url: buildUrlWithSafeQuery(request.url),
      path: new URL(request.url).pathname,
      status: response.status,
      durationMs: response.durationMs,
      pageUrl: request.pageUrl,
      timestamp: request.timestamp,
      query: safeQueryFromUrl(request.url),
      contentType: response.contentType,
      scenarioSlug: inferScenarioSlug(request.method, pathWithQuery),
      isWrite: !['GET', 'HEAD'].includes(request.method.toUpperCase()),
      candidateForLoadTest: response.status < 500,
      expectedStatuses: expectedStatusesFor(response.status),
    });
  }

  rawApis.sort((left, right) => left.timestamp - right.timestamp);

  const deduped = new Map<string, ApiCall>();
  for (const api of rawApis) {
    const key = `${api.method}:${api.url}:${api.status}`;
    const existing = deduped.get(key);
    if (!existing || api.timestamp - existing.timestamp > 1000) {
      deduped.set(key, api);
    }
  }

  return [...deduped.values()].sort((left, right) => left.timestamp - right.timestamp);
};

const isNavigationStandalone = (event: NavigationEvent, previous: ActionEvent | undefined): boolean => {
  if (!previous) {
    return true;
  }

  if (previous.type === 'click' || previous.type === 'submit') {
    return event.timestamp - previous.timestamp > 500;
  }

  return true;
};

const buildNavigationTitle = (event: NavigationEvent): string => {
  const targetPath = new URL(event.targetUrl).pathname;
  if (targetPath.endsWith('/new')) {
    return `Open new ${resourceLabel(targetPath)} page`;
  }
  if (targetPath.endsWith('/edit')) {
    return `Open edit ${resourceLabel(targetPath)} page`;
  }
  if (/\/\d+$/.test(targetPath)) {
    return `Open ${resourceLabel(targetPath)} detail`;
  }
  const label = prettyPathLabel(targetPath);
  return `Open ${label} page`;
};

const summarizeAction = (event: ActionEvent): string => {
  if (event.type === 'navigation') {
    return `navigation to ${event.targetUrl}`;
  }

  if (event.type === 'click') {
    return `click "${event.text ?? event.locator.value}"`;
  }

  if (event.type === 'submit') {
    return 'submit form';
  }

  return `fill "${event.locator.value}"`;
};

const buildClickTitle = (event: ClickEvent, pendingInputs: InputEvent[]): string => {
  const label = `${event.text ?? event.locator.value} ${pendingInputs.map((input) => input.fieldName ?? '').join(' ')}`.toLowerCase();
  if (event.pageUrl.includes('/login') || label.includes('로그인') || label.includes('login')) {
    return 'Login';
  }

  if (label.includes('검색') || pendingInputs.some((input) => input.fieldName === 'search')) {
    return 'Search products';
  }

  if (event.pageUrl.includes('/products') && (label.includes('product') || label.includes('macbook'))) {
    return 'Open product detail';
  }

  return `Click ${event.text ?? event.locator.value}`;
};

const classifyStep = (step: StepDraft & { apis: ApiCall[] }): Pick<StepDraft, 'title' | 'intent'> => {
  const clickText = step.actions
    .filter((action): action is ClickEvent => action.type === 'click')
    .map((action) => action.text ?? action.locator.value)
    .join(' ')
    .toLowerCase();
  const inputKeys = step.actions
    .filter((action): action is InputEvent => action.type === 'input')
    .map((action) => (action.fieldName ?? action.locator.value).toLowerCase());
  const navigationPath = step.actions
    .filter((action): action is NavigationEvent => action.type === 'navigation')
    .map((action) => new URL(action.targetUrl).pathname)
    .at(-1);
  const writeApi = step.apis.find((api) => api.isWrite && !isAuthApi(api));
  const authApi = step.apis.find((api) => isAuthApi(api));
  const readApi = step.apis.find((api) => !api.isWrite);

  if (writeApi) {
    return {
      intent: writeApi.method === 'POST' ? 'create' : 'update',
      title: `${writeApi.method === 'POST' ? 'Create' : 'Update'} ${resourceLabel(writeApi.path)}`,
    };
  }

  if (readApi) {
    if (SEARCH_FIELD_PATTERN.test(clickText) || inputKeys.some((key) => SEARCH_FIELD_PATTERN.test(key))) {
      return {
        intent: 'read',
        title: `Search ${baseResourceSegment(readApi.path).replace(/[-_]/g, ' ')}`,
      };
    }

    if (navigationPath && /\/\d+$/.test(navigationPath)) {
      return {
        intent: 'read',
        title: `Open ${resourceLabel(navigationPath)} detail`,
      };
    }

    return {
      intent: 'read',
      title: step.title,
    };
  }

  if (authApi || clickText.includes('로그인') || clickText.includes('login')) {
    return {
      intent: 'auth',
      title: 'Login',
    };
  }

  if (navigationPath?.endsWith('/new')) {
    return {
      intent: 'navigation',
      title: `Open new ${resourceLabel(navigationPath)} page`,
    };
  }

  if (navigationPath?.endsWith('/edit')) {
    return {
      intent: 'navigation',
      title: `Open edit ${resourceLabel(navigationPath)} page`,
    };
  }

  if (step.actions.some((action) => action.type === 'navigation')) {
    return {
      intent: 'navigation',
      title: buildNavigationTitle(step.actions.find((action): action is NavigationEvent => action.type === 'navigation')!),
    };
  }

  return {
    intent: 'read',
    title: step.title,
  };
};

const buildActionSteps = (session: RecordedSession): StepDraft[] => {
  const actionEvents = session.rawEvents
    .filter(isActionEvent)
    .sort((left, right) => left.timestamp - right.timestamp);

  const steps: StepDraft[] = [];
  const pendingInputs: InputEvent[] = [];
  let previousAction: ActionEvent | undefined;

  for (const event of actionEvents) {
    if (
      event.type === 'navigation' &&
      previousAction?.type === 'navigation' &&
      previousAction.targetUrl === event.targetUrl &&
      event.timestamp - previousAction.timestamp < 400
    ) {
      continue;
    }

    if (event.type === 'input') {
      const existingIndex = pendingInputs.findIndex(
        (input) =>
          input.locator.strategy === event.locator.strategy &&
          input.locator.value === event.locator.value,
      );

      if (existingIndex >= 0) {
        pendingInputs.splice(existingIndex, 1, event);
      } else {
        pendingInputs.push(event);
      }
      previousAction = event;
      continue;
    }

    if (event.type === 'navigation') {
      if (isNavigationStandalone(event, previousAction)) {
        steps.push({
          id: event.id,
          title: buildNavigationTitle(event),
          intent: 'navigation',
          pageUrl: event.pageUrl,
          startedAt: event.timestamp,
          endedAt: event.timestamp,
          actionSummary: summarizeAction(event),
          actions: [event],
        });
      } else {
        const lastStep = steps.at(-1);
        if (lastStep) {
          lastStep.actions.push(event);
          lastStep.endedAt = event.timestamp;
        }
      }
      previousAction = event;
      continue;
    }

    const actions: ActionEvent[] = [...pendingInputs, event];
    steps.push({
      id: event.id,
      title: event.type === 'click' ? buildClickTitle(event, pendingInputs) : 'Submit form',
      intent: 'read',
      pageUrl: event.pageUrl,
      startedAt: actions[0]?.timestamp ?? event.timestamp,
      endedAt: event.timestamp,
      actionSummary: summarizeAction(event),
      actions,
    });
    pendingInputs.length = 0;
    previousAction = event;
  }

  if (pendingInputs.length > 0) {
    const firstInput = pendingInputs[0];
    const lastInput = pendingInputs.at(-1);
    if (firstInput && lastInput) {
      steps.push({
        id: firstInput.id,
        title: 'Fill form',
        intent: 'read',
        pageUrl: firstInput.pageUrl,
        startedAt: firstInput.timestamp,
        endedAt: lastInput.timestamp,
        actionSummary: summarizeAction(lastInput),
        actions: [...pendingInputs],
      });
    }
  }

  return steps;
};

const attachApisToSteps = (steps: StepDraft[], apis: ApiCall[]) =>
  steps.map((step, index) => {
    const nextStep = steps[index + 1];
    const upperBound = nextStep ? nextStep.startedAt : Number.POSITIVE_INFINITY;
    const payloadTemplate = buildPayloadTemplate(step.actions);
    const stepApis = apis
      .filter((api) => api.timestamp >= step.startedAt - 50 && api.timestamp < upperBound)
      .map((api) =>
        api.isWrite && payloadTemplate && !isAuthApi(api)
          ? {
              ...api,
              payloadTemplate,
            }
          : api,
      );
    const classified = classifyStep({
      ...step,
      apis: stepApis,
    });

    return {
      ...step,
      ...classified,
      apis: stepApis,
    };
  });

const pickK6Candidates = (apis: ApiCall[]): ApiCall[] => {
  const loadCandidates = apis.filter((api) => api.candidateForLoadTest);
  const preferredWrite = loadCandidates.find(
    (api) => api.isWrite && !isAuthApi(api) && WRITE_METHODS.has(api.method),
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

    return [preferredWrite, relatedRead].filter((api): api is ApiCall => Boolean(api)).slice(0, 2);
  }

  return [...loadCandidates]
    .sort((left, right) => Number(left.isWrite) - Number(right.isWrite) || left.timestamp - right.timestamp)
    .slice(0, 2);
};

export const normalizeSession = (
  session: RecordedSession,
  settings: JourneyForgeSettings = DEFAULT_SETTINGS,
): NormalizedJourney => {
  const rawApis = buildApiCalls(session.rawEvents, settings);
  const steps = attachApisToSteps(buildActionSteps(session), rawApis);
  const normalizedApis = [...new Map(steps.flatMap((step) => step.apis).map((api) => [api.id, api])).values()];
  const journeySlug = slugify(session.name);
  const k6Candidates = pickK6Candidates(normalizedApis).map((api) => api.scenarioSlug);

  return {
    id: session.id,
    title: session.name,
    slug: journeySlug,
    baseUrl: session.baseUrl,
    steps,
    coreApis: normalizedApis,
    suggestions: {
      playwright: true,
      k6Candidates,
    },
  };
};
