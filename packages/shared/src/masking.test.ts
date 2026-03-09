import { describe, expect, it } from 'vitest';

import { maskInputValue, sanitizeHeaders, slugify } from './index';

describe('shared masking utilities', () => {
  it('masks password fields completely', () => {
    expect(
      maskInputValue({
        value: 'super-secret',
        fieldName: 'password',
        inputType: 'password',
      }),
    ).toEqual({
      value: '******',
      masked: true,
      reason: 'password',
    });
  });

  it('masks email values when configured', () => {
    expect(
      maskInputValue({
        value: 'hello@example.com',
        fieldName: 'email',
        inputType: 'email',
        maskEmails: true,
      }),
    ).toEqual({
      value: 'h***@example.com',
      masked: true,
      reason: 'email',
    });
  });

  it('drops auth and cookie headers', () => {
    expect(
      sanitizeHeaders({
        authorization: 'Bearer secret',
        cookie: 'session=abc',
        'content-type': 'application/json',
      }),
    ).toEqual({
      'content-type': 'application/json',
    });
  });

  it('builds deterministic slugs', () => {
    expect(slugify('Login -> Search -> Detail')).toBe('login-search-detail');
  });
});
