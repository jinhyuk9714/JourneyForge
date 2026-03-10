import { describe, expect, it } from 'vitest';

import {
  generateFlowDoc,
  generateK6,
  generatePlaywright,
  normalizeSession,
} from './index';
import { createPostSession } from './__fixtures__/createPostSession';
import { updatePostSession } from './__fixtures__/updatePostSession';

const intentOf = (step: unknown) => (step as { intent?: string }).intent;
const payloadOf = (api: unknown) => (api as { payloadTemplate?: Record<string, string | number | boolean> }).payloadTemplate;
const statusesOf = (api: unknown) => (api as { expectedStatuses?: number[] }).expectedStatuses;
const explanationOf = (value: unknown) => (value as { explanation?: string[] }).explanation ?? [];
const k6ReasonsOf = (journey: unknown) =>
  ((journey as { suggestions?: { k6CandidateReasons?: Array<{ scenarioSlug: string; reasons: string[] }> } }).suggestions
    ?.k6CandidateReasons ?? []);

describe('write-flow coverage', () => {
  it('classifies create flows and derives safe payload templates', () => {
    const journey = normalizeSession(createPostSession);
    const createApi = journey.coreApis.find((api) => api.method === 'POST' && api.path === '/api/posts');
    const createStep = journey.steps.find((step) => step.title === 'Create post');

    expect(journey.steps.map(intentOf)).toEqual(['navigation', 'auth', 'navigation', 'create']);
    expect(journey.steps.map((step) => step.title)).toEqual([
      'Open login page',
      'Login',
      'Open new post page',
      'Create post',
    ]);
    expect(payloadOf(createApi)).toEqual({
      title: 'sample title',
      content: 'sample content',
    });
    expect(statusesOf(createApi)).toEqual([201]);
    expect(explanationOf(createStep)).toContain(
      'Classified as create because POST /api/posts is a write API attached to this step.',
    );
    expect(explanationOf(createApi)).toContain(
      'Remained a load-test candidate because it is a non-auth business API with a successful response.',
    );
    expect(k6ReasonsOf(journey)).toContainEqual({
      scenarioSlug: 'post-posts',
      reasons: [
        'Selected because it is a write API and write journeys take priority for k6 output.',
        'Auth APIs were excluded from k6 candidate selection.',
      ],
    });
  });

  it('classifies update flows and derives safe payload templates', () => {
    const journey = normalizeSession(updatePostSession);
    const updateApi = journey.coreApis.find((api) => api.method === 'PATCH' && api.path === '/api/posts/99');
    const updateStep = journey.steps.find((step) => step.title === 'Update post');

    expect(journey.steps.map(intentOf)).toEqual(['navigation', 'auth', 'read', 'navigation', 'update']);
    expect(journey.steps.map((step) => step.title)).toEqual([
      'Open login page',
      'Login',
      'Open post detail',
      'Open edit post page',
      'Update post',
    ]);
    expect(payloadOf(updateApi)).toEqual({
      title: 'sample title',
      content: 'sample content',
    });
    expect(statusesOf(updateApi)).toEqual([200]);
    expect(explanationOf(updateStep)).toContain(
      'Classified as update because PATCH /api/posts/99 is a write API attached to this step.',
    );
    expect(explanationOf(updateApi)).toContain(
      'Attached to this step because the request started before the next step.',
    );
    expect(k6ReasonsOf(journey)).toContainEqual({
      scenarioSlug: 'patch-post-99',
      reasons: [
        'Selected because it is a write API and write journeys take priority for k6 output.',
        'Auth APIs were excluded from k6 candidate selection.',
      ],
    });
  });

  it('renders create-flow artifacts with write payload placeholders and 2xx checks', () => {
    const journey = normalizeSession(createPostSession);

    expect(generatePlaywright(journey)).toMatchInlineSnapshot(`
      "import { expect, test } from '@playwright/test';
      
      test('create-post', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '');
        await page.getByLabel('Password').fill(process.env.TEST_PASSWORD ?? '');
        await page.getByRole('button', { name: '로그인' }).click();
        await page.getByRole('link', { name: '게시글 작성' }).click();
        await page.getByLabel('Title').fill('Launch checklist');
        await page.getByLabel('Content').fill('Write flow support is ready for review.');
        await page.getByRole('button', { name: '등록' }).click();
        await expect(page).toHaveURL(/posts\\/101/);
      });
      "
    `);

    expect(generateFlowDoc(journey)).toMatchInlineSnapshot(`
      "# Journey: Create Post
      
      ## Step 1. Open login page
      - Action: navigation to http://localhost:3000/login
      - Why:
        - Identified as a standalone navigation event.
      
      ## Step 2. Login
      - Action: click "로그인"
      - Why:
        - Grouped 2 input events with the triggering click before the next step started.
        - Classified as auth because POST /api/auth/login matched login heuristics.
      - API:
        - POST /api/auth/login (200, 140ms)
          - Why: Captured as xhr.
          - Why: Attached to this step because the request started before the next step.
          - Why: Excluded from load-test candidates because auth APIs are not selected for k6 output.
      
      ## Step 3. Open new post page
      - Action: click "게시글 작성"
      - Why:
        - Grouped the triggering click with the following navigation event.
        - Classified as navigation because the resulting path opened a new-resource page.
      
      ## Step 4. Create post
      - Action: click "등록"
      - Why:
        - Grouped 2 input events with the triggering click before the next step started.
        - Classified as create because POST /api/posts is a write API attached to this step.
      - Payload fields: title, content
      - API:
        - POST /api/posts (201, 180ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.
        - GET /api/posts/101 (200, 80ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.
      
      ## Load test candidates
      - POST /api/posts
        - Why selected: Selected because it is a write API and write journeys take priority for k6 output.
        - Why selected: Auth APIs were excluded from k6 candidate selection.
      - GET /api/posts/101
        - Why selected: Paired with the related detail read API after selecting the write candidate.
      "
    `);

    expect(generateK6(journey)).toMatchInlineSnapshot(`
      "import http from 'k6/http';
      import { check } from 'k6';
      
      export const options = {
        scenarios: {
          post_posts: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
              { duration: '30s', target: 5 },
              { duration: '30s', target: 10 }
            ]
          },
          get_post_101: {
            executor: 'constant-arrival-rate',
            rate: 10,
            timeUnit: '1s',
            duration: '1m',
            preAllocatedVUs: 5,
            maxVUs: 20
          }
        },
        thresholds: {
          http_req_duration: ['p(95)<500'],
          http_req_failed: ['rate<0.01']
        }
      };
      
      export default function () {
        const responses = [
          http.post(\`\${__ENV.BASE_URL}/api/posts\`, JSON.stringify({ title: 'sample title', content: 'sample content' }), { headers: { 'Content-Type': 'application/json' } }),
          http.get(\`\${__ENV.BASE_URL}/api/posts/101\`)
        ];
      
        responses.forEach((res) => {
          check(res, {
            'status is 2xx': (response) => response.status >= 200 && response.status < 300
          });
        });
      }
      "
    `);
  });

  it('renders update-flow artifacts with write payload placeholders and 2xx checks', () => {
    const journey = normalizeSession(updatePostSession);

    expect(generatePlaywright(journey)).toMatchInlineSnapshot(`
      "import { expect, test } from '@playwright/test';
      
      test('update-post', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '');
        await page.getByLabel('Password').fill(process.env.TEST_PASSWORD ?? '');
        await page.getByRole('button', { name: '로그인' }).click();
        await page.getByRole('link', { name: 'JourneyForge roadmap' }).click();
        await page.getByRole('link', { name: '수정하기' }).click();
        await page.getByLabel('Title').fill('JourneyForge roadmap v2');
        await page.getByLabel('Content').fill('Write flow coverage now includes payload templates.');
        await page.getByRole('button', { name: '저장' }).click();
        await expect(page).toHaveURL(/posts\\/99/);
      });
      "
    `);

    expect(generateFlowDoc(journey)).toMatchInlineSnapshot(`
      "# Journey: Update Post
      
      ## Step 1. Open login page
      - Action: navigation to http://localhost:3000/login
      - Why:
        - Identified as a standalone navigation event.
      
      ## Step 2. Login
      - Action: click "로그인"
      - Why:
        - Grouped 2 input events with the triggering click before the next step started.
        - Classified as auth because POST /api/auth/login matched login heuristics.
      - API:
        - POST /api/auth/login (200, 140ms)
          - Why: Captured as xhr.
          - Why: Attached to this step because the request started before the next step.
          - Why: Excluded from load-test candidates because auth APIs are not selected for k6 output.
      
      ## Step 3. Open post detail
      - Action: click "JourneyForge roadmap"
      - Why:
        - Grouped the triggering click with the following detail navigation event.
        - Classified as read because the resulting navigation path matched a detail view pattern.
      
      ## Step 4. Open edit post page
      - Action: click "수정하기"
      - Why:
        - Grouped the triggering click with the following navigation event.
        - Classified as navigation because the resulting path opened an edit-resource page.
      
      ## Step 5. Update post
      - Action: click "저장"
      - Why:
        - Grouped 2 input events with the triggering click before the next step started.
        - Classified as update because PATCH /api/posts/99 is a write API attached to this step.
      - Payload fields: title, content
      - API:
        - PATCH /api/posts/99 (200, 180ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.
        - GET /api/posts/99 (200, 80ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.
      
      ## Load test candidates
      - PATCH /api/posts/99
        - Why selected: Selected because it is a write API and write journeys take priority for k6 output.
        - Why selected: Auth APIs were excluded from k6 candidate selection.
      - GET /api/posts/99
        - Why selected: Paired with the related detail read API after selecting the write candidate.
      "
    `);

    expect(generateK6(journey)).toMatchInlineSnapshot(`
      "import http from 'k6/http';
      import { check } from 'k6';
      
      export const options = {
        scenarios: {
          patch_post_99: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
              { duration: '30s', target: 5 },
              { duration: '30s', target: 10 }
            ]
          },
          get_post_99: {
            executor: 'constant-arrival-rate',
            rate: 10,
            timeUnit: '1s',
            duration: '1m',
            preAllocatedVUs: 5,
            maxVUs: 20
          }
        },
        thresholds: {
          http_req_duration: ['p(95)<500'],
          http_req_failed: ['rate<0.01']
        }
      };
      
      export default function () {
        const responses = [
          http.patch(\`\${__ENV.BASE_URL}/api/posts/99\`, JSON.stringify({ title: 'sample title', content: 'sample content' }), { headers: { 'Content-Type': 'application/json' } }),
          http.get(\`\${__ENV.BASE_URL}/api/posts/99\`)
        ];
      
        responses.forEach((res) => {
          check(res, {
            'status is 2xx': (response) => response.status >= 200 && response.status < 300
          });
        });
      }
      "
    `);
  });
});
