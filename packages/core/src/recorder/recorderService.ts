import { randomUUID } from 'node:crypto';

import { DEFAULT_SETTINGS, maskInputValue, sanitizeHeaders } from '@journeyforge/shared';
import type {
  RawEvent,
  RecorderStatus,
  RecordedSession,
  JourneyForgeSettings,
} from '@journeyforge/shared';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page, Request } from 'playwright';

import { injectedRecorderSource } from './injectedRecorder';

type StartRecordingInput = {
  baseUrl: string;
  name?: string;
};

type ActiveSession = {
  sessionId: string;
  baseUrl: string;
  name: string;
  startedAt: number;
  rawEvents: RawEvent[];
};

type RecorderServiceOptions = {
  settings?: JourneyForgeSettings;
};

export type RecorderService = ReturnType<typeof createRecorderService>;

export const createRecorderService = (options: RecorderServiceOptions = {}) => {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let activeSession: ActiveSession | null = null;
  let status: RecorderStatus = {
    state: 'idle',
    eventCount: 0,
  };
  const requestIds = new Map<Request, string>();
  const requestStartedAt = new Map<string, number>();

  const pushEvent = (event: RawEvent) => {
    if (!activeSession) {
      return;
    }
    activeSession.rawEvents.push(event);
    status = {
      ...status,
      eventCount: activeSession.rawEvents.length,
    };
  };

  const attachPageListeners = async (nextPage: Page) => {
    nextPage.on('request', (request) => {
      const requestId = randomUUID();
      requestIds.set(request, requestId);
      requestStartedAt.set(requestId, Date.now());
      pushEvent({
        id: randomUUID(),
        type: 'network-request',
        timestamp: Date.now(),
        requestId,
        method: request.method(),
        url: request.url(),
        pageUrl: request.frame()?.url() || nextPage.url(),
        resourceType: request.resourceType(),
        headers: sanitizeHeaders(request.headers()),
      });
    });

    nextPage.on('response', async (response) => {
      const request = response.request();
      const requestId = requestIds.get(request);
      if (!requestId) {
        return;
      }
      const startedAt = requestStartedAt.get(requestId) ?? Date.now();
      pushEvent({
        id: randomUUID(),
        type: 'network-response',
        timestamp: Date.now(),
        requestId,
        status: response.status(),
        durationMs: Date.now() - startedAt,
        contentType: response.headers()['content-type'],
      });
      requestStartedAt.delete(requestId);
      requestIds.delete(request);
    });

    nextPage.on('framenavigated', (frame) => {
      if (frame !== nextPage.mainFrame()) {
        return;
      }
      pushEvent({
        id: randomUUID(),
        type: 'navigation',
        timestamp: Date.now(),
        pageUrl: frame.url(),
        targetUrl: frame.url(),
        trigger: 'unknown',
      });
    });
  };

  return {
    async startRecording(input: StartRecordingInput) {
      if (activeSession) {
        throw new Error('A recording session is already active.');
      }

      const sessionId = randomUUID();
      browser = await chromium.launch({ headless: false });
      context = await browser.newContext();
      await context.exposeBinding('__journeyforgeRecord', async (_source, event: RawEvent & { inputType?: string }) => {
        if (event.type === 'input') {
          const decision = maskInputValue({
            value: event.value,
            fieldName: event.fieldName,
            inputType: event.inputType,
            maskEmails: settings.maskEmailInputs,
          });

          pushEvent({
            ...event,
            value: decision.value,
            masked: decision.masked,
            fieldName: event.fieldName,
          });
          return;
        }

        pushEvent(event);
      });
      await context.addInitScript({ content: injectedRecorderSource });

      page = await context.newPage();
      await attachPageListeners(page);

      activeSession = {
        sessionId,
        baseUrl: input.baseUrl,
        name: input.name ?? 'Recorded Journey',
        startedAt: Date.now(),
        rawEvents: [],
      };
      status = {
        state: 'recording',
        eventCount: 0,
        sessionId,
        baseUrl: input.baseUrl,
      };

      await page.goto(input.baseUrl);

      return {
        sessionId,
      };
    },
    getStatus() {
      return status;
    },
    async stopRecording(sessionId: string): Promise<RecordedSession> {
      if (!activeSession || activeSession.sessionId !== sessionId) {
        throw new Error('No active recording matches the provided session id.');
      }

      status = {
        ...status,
        state: 'analyzing',
      };

      const finishedSession: RecordedSession = {
        id: activeSession.sessionId,
        name: activeSession.name,
        baseUrl: activeSession.baseUrl,
        startedAt: activeSession.startedAt,
        endedAt: Date.now(),
        rawEvents: [...activeSession.rawEvents].sort((left, right) => left.timestamp - right.timestamp),
      };

      await page?.close();
      await context?.close();
      await browser?.close();

      browser = null;
      context = null;
      page = null;
      activeSession = null;
      status = {
        state: 'ready',
        eventCount: finishedSession.rawEvents.length,
        sessionId: finishedSession.id,
        baseUrl: finishedSession.baseUrl,
      };

      return finishedSession;
    },
    async dispose() {
      await page?.close();
      await context?.close();
      await browser?.close();
      browser = null;
      context = null;
      page = null;
      activeSession = null;
      status = {
        state: 'idle',
        eventCount: 0,
      };
    },
  };
};
