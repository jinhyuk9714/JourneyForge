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
    expect(journey.suggestions.k6Candidates).toEqual([
      'get-products',
      'get-product-42',
      'post-auth-login',
    ]);
  });
});
