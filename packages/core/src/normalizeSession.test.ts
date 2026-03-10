import { describe, expect, it } from 'vitest';

import { normalizeSession } from './index';
import { loginSearchDetailSession } from './__fixtures__/loginSearchDetailSession';

describe('normalizeSession', () => {
  it('builds one journey with grouped steps and filtered core apis', () => {
    const journey = normalizeSession(loginSearchDetailSession);

    expect(journey.title).toBe('Login Search Detail');
    expect(journey.steps).toHaveLength(4);
    expect(journey.steps.map((step) => step.title)).toEqual([
      'Open login page',
      'Login',
      'Search products',
      'Open product detail',
    ]);
    expect(journey.coreApis.map((api) => `${api.method} ${api.path}`)).toEqual([
      'POST /api/auth/login',
      'GET /api/products',
      'GET /api/products/42',
    ]);
    expect(journey.steps[0]?.explanation).toEqual([
      'Identified as a standalone navigation event.',
    ]);
    expect(journey.steps[1]?.explanation).toContain(
      'Classified as auth because POST /api/auth/login matched login heuristics.',
    );
    expect(journey.coreApis[0]?.explanation).toContain(
      'Excluded from load-test candidates because auth APIs are not selected for k6 output.',
    );
    expect(journey.suggestions.k6Candidates).toEqual([
      'get-products',
      'get-product-42',
    ]);
    expect(journey.suggestions.k6CandidateReasons[0]?.reasons).toContain(
      'Selected as an early non-auth load-test candidate after filtering static and analytics traffic.',
    );
  });
});
