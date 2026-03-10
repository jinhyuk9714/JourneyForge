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
  pageUrl: string;
  startedAt: number;
  endedAt: number;
  actionSummary: string;
  actions: ActionEvent[];
};

const isActionEvent = (event: RawEvent): event is ActionEvent =>
  event.type === 'click' ||
  event.type === 'input' ||
  event.type === 'navigation' ||
  event.type === 'submit';

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
  const label = prettyPathLabel(new URL(event.targetUrl).pathname);
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
    return {
      ...step,
      apis: apis.filter((api) => api.timestamp >= step.startedAt - 50 && api.timestamp < upperBound),
    };
  });

export const normalizeSession = (
  session: RecordedSession,
  settings: JourneyForgeSettings = DEFAULT_SETTINGS,
): NormalizedJourney => {
  const coreApis = buildApiCalls(session.rawEvents, settings);
  const steps = attachApisToSteps(buildActionSteps(session), coreApis);
  const journeySlug = slugify(session.name);
  const k6Candidates = [...coreApis]
    .filter((api) => api.candidateForLoadTest)
    .sort((left, right) => Number(left.isWrite) - Number(right.isWrite) || left.timestamp - right.timestamp)
    .map((api) => api.scenarioSlug);

  return {
    id: session.id,
    title: session.name,
    slug: journeySlug,
    baseUrl: session.baseUrl,
    steps,
    coreApis,
    suggestions: {
      playwright: true,
      k6Candidates,
    },
  };
};
