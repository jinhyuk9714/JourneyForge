import { describe, expect, it } from 'vitest';

import {
  generateFlowDoc,
  generateK6,
  generatePlaywright,
  normalizeSession,
} from './index';
import { loginSearchDetailSession } from './__fixtures__/loginSearchDetailSession';

describe('artifact generators', () => {
  const journey = normalizeSession(loginSearchDetailSession);

  it('renders a readable Playwright draft', () => {
    expect(generatePlaywright(journey)).toMatchInlineSnapshot(`
      "import { expect, test } from '@playwright/test';

      test('login-search-detail', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '');
        await page.getByLabel('Password').fill(process.env.TEST_PASSWORD ?? '');
        await page.getByRole('button', { name: '로그인' }).click();
        await page.getByPlaceholder('검색어').fill('맥북');
        await page.getByRole('button', { name: '검색' }).click();
        await page.getByText('MacBook Pro 14').click();
        await expect(page).toHaveURL(/products\\/42/);
      });
      "
    `);
  });

  it('renders flow markdown with step and api summaries', () => {
    expect(generateFlowDoc(journey)).toMatchInlineSnapshot(`
      "# Journey: Login Search Detail

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
        - POST /api/auth/login (200, 160ms)
          - Why: Captured as xhr.
          - Why: Attached to this step because the request started before the next step.
          - Why: Excluded from load-test candidates because auth APIs are not selected for k6 output.

      ## Step 3. Search products
      - Action: click "검색"
      - Why:
        - Grouped 1 input event with the triggering click before the next step started.
        - Classified as read because search input heuristics matched the attached read API.
      - API:
        - GET /api/products?keyword=맥북&page=0 (200, 140ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.

      ## Step 4. Open product detail
      - Action: click "MacBook Pro 14"
      - Why:
        - Grouped the triggering click with the following detail navigation event.
        - Classified as read because the resulting navigation path matched a detail view pattern.
      - API:
        - GET /api/products/42 (200, 160ms)
          - Why: Captured as fetch.
          - Why: Attached to this step because the request started before the next step.
          - Why: Remained a load-test candidate because it is a non-auth business API with a successful response.

      ## Load test candidates
      - GET /api/products
        - Why selected: Selected as an early non-auth load-test candidate after filtering static and analytics traffic.
      - GET /api/products/42
        - Why selected: Selected as the next non-auth load-test candidate based on request order.
      "
    `);
  });

  it('renders k6 only when load test candidates exist', () => {
    expect(generateK6(journey)).toMatchInlineSnapshot(`
      "import http from 'k6/http';
      import { check } from 'k6';

      export const options = {
        scenarios: {
          get_products: {
            executor: 'constant-arrival-rate',
            rate: 20,
            timeUnit: '1s',
            duration: '1m',
            preAllocatedVUs: 10,
            maxVUs: 50
          },
          get_product_42: {
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
          http.get(\`\${__ENV.BASE_URL}/api/products?keyword=%EB%A7%A5%EB%B6%81&page=0\`),
          http.get(\`\${__ENV.BASE_URL}/api/products/42\`)
        ];

        responses.forEach((res) => {
          check(res, {
            'status is 200': (response) => response.status === 200
          });
        });
      }
      "
    `);
  });
});
