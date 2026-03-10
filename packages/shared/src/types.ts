export type LocatorStrategy = 'role' | 'label' | 'placeholder' | 'text' | 'css';

export type LocatorDescriptor = {
  strategy: LocatorStrategy;
  value: string;
};

export type ClickEvent = {
  id: string;
  type: 'click';
  timestamp: number;
  pageUrl: string;
  locator: LocatorDescriptor;
  text?: string;
};

export type InputEvent = {
  id: string;
  type: 'input';
  timestamp: number;
  pageUrl: string;
  locator: LocatorDescriptor;
  value: string;
  masked: boolean;
  fieldName?: string;
};

export type SubmitEvent = {
  id: string;
  type: 'submit';
  timestamp: number;
  pageUrl: string;
  locator: LocatorDescriptor;
};

export type NavigationEvent = {
  id: string;
  type: 'navigation';
  timestamp: number;
  pageUrl: string;
  targetUrl: string;
  trigger: 'goto' | 'click' | 'redirect' | 'history' | 'reload' | 'unknown';
};

export type NetworkRequestEvent = {
  id: string;
  type: 'network-request';
  timestamp: number;
  requestId: string;
  method: string;
  url: string;
  pageUrl: string;
  resourceType: string;
  headers: Record<string, string>;
};

export type NetworkResponseEvent = {
  id: string;
  type: 'network-response';
  timestamp: number;
  requestId: string;
  status: number;
  durationMs: number;
  contentType?: string;
};

export type RawEvent =
  | ClickEvent
  | InputEvent
  | SubmitEvent
  | NavigationEvent
  | NetworkRequestEvent
  | NetworkResponseEvent;

export type ApiCall = {
  id: string;
  requestId: string;
  method: string;
  url: string;
  path: string;
  status: number;
  durationMs: number;
  pageUrl: string;
  timestamp: number;
  query: Record<string, string>;
  contentType?: string;
  scenarioSlug: string;
  isWrite: boolean;
  candidateForLoadTest: boolean;
  payloadTemplate?: Record<string, string | number | boolean>;
  expectedStatuses?: number[];
};

export type JourneyStepIntent = 'read' | 'create' | 'update' | 'auth' | 'navigation';

export type JourneyStep = {
  id: string;
  title: string;
  intent: JourneyStepIntent;
  pageUrl: string;
  startedAt: number;
  endedAt: number;
  actionSummary: string;
  actions: Array<ClickEvent | InputEvent | SubmitEvent | NavigationEvent>;
  apis: ApiCall[];
};

export type NormalizedJourney = {
  id: string;
  title: string;
  slug: string;
  baseUrl: string;
  steps: JourneyStep[];
  coreApis: ApiCall[];
  suggestions: {
    playwright: boolean;
    k6Candidates: string[];
  };
};

export type RecordedSession = {
  id: string;
  name: string;
  baseUrl: string;
  startedAt: number;
  endedAt: number;
  settingsSnapshot?: JourneyForgeSettings;
  rawEvents: RawEvent[];
};

export type ArtifactKind = 'playwright' | 'flow-doc' | 'k6';

export type GeneratedArtifact = {
  kind: ArtifactKind;
  fileName: string;
  relativePath: string | null;
  content: string | null;
  generatedAt: number;
  status: 'generated' | 'skipped';
  reason?: string;
};

export type SessionSummary = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  stepCount: number;
  artifactKinds: ArtifactKind[];
};

export type SessionBundle = {
  session: RecordedSession;
  journey: NormalizedJourney;
  artifacts: GeneratedArtifact[];
};

export type MaskingDecision = {
  value: string;
  masked: boolean;
  reason?: 'password' | 'token' | 'email';
};

export type RecorderState = 'idle' | 'recording' | 'analyzing' | 'ready' | 'error';

export type RecorderStatus = {
  state: RecorderState;
  eventCount: number;
  sessionId?: string;
  baseUrl?: string;
  error?: string;
};

export type JourneyForgeSettings = {
  analyticsPatterns: string[];
  maskEmailInputs: boolean;
  k6Thresholds: {
    httpReqDurationP95: number;
    httpReqFailedRate: number;
  };
};
