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

describe('write-flow coverage', () => {
  it('classifies create flows and derives safe payload templates', () => {
    const journey = normalizeSession(createPostSession);
    const createApi = journey.coreApis.find((api) => api.method === 'POST' && api.path === '/api/posts');

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
  });

  it('classifies update flows and derives safe payload templates', () => {
    const journey = normalizeSession(updatePostSession);
    const updateApi = journey.coreApis.find((api) => api.method === 'PATCH' && api.path === '/api/posts/99');

    expect(journey.steps.map(intentOf)).toEqual(['navigation', 'auth', 'navigation', 'navigation', 'update']);
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
  });

  it('renders create-flow artifacts with write payload placeholders and 2xx checks', () => {
    const journey = normalizeSession(createPostSession);

    expect(generatePlaywright(journey)).toMatchInlineSnapshot(`
      "import { expect, test } from '@playwright/test';
      
      test('create-post', async ({ page }) => {
        await page.goto('http://localhost:3000/login');
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
      
      ## Step 2. Login
      - Action: click "로그인"
      - API:
        - POST /api/auth/login (200, 140ms)
      
      ## Step 3. Open new post page
      - Action: click "게시글 작성"
      
      ## Step 4. Create post
      - Action: click "등록"
      - Payload fields: title, content
      - API:
        - POST /api/posts (201, 180ms)
        - GET /api/posts/101 (200, 80ms)
      
      ## Load test candidates
      - POST /api/posts
      - GET /api/posts/101
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
        await page.goto('http://localhost:3000/login');
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
      
      ## Step 2. Login
      - Action: click "로그인"
      - API:
        - POST /api/auth/login (200, 140ms)
      
      ## Step 3. Open post detail
      - Action: click "JourneyForge roadmap"
      
      ## Step 4. Open edit post page
      - Action: click "수정하기"
      
      ## Step 5. Update post
      - Action: click "저장"
      - Payload fields: title, content
      - API:
        - PATCH /api/posts/99 (200, 180ms)
        - GET /api/posts/99 (200, 80ms)
      
      ## Load test candidates
      - PATCH /api/posts/99
      - GET /api/posts/99
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
