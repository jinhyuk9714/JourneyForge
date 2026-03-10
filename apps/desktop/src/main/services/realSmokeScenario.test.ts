// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { runRealSmokeScenario } from './realSmokeScenario';

type Operation =
  | ['waitForURL', string]
  | ['fillByLabel', string, string]
  | ['fillByPlaceholder', string, string]
  | ['clickByRole', string, string];

const createFakePage = (operations: Operation[]) => ({
  waitForURL: async (url: string) => {
    operations.push(['waitForURL', url]);
  },
  getByLabel: (label: string) => ({
    click: async () => undefined,
    fill: async (value: string) => {
      operations.push(['fillByLabel', label, value]);
    },
  }),
  getByPlaceholder: (placeholder: string) => ({
    click: async () => undefined,
    fill: async (value: string) => {
      operations.push(['fillByPlaceholder', placeholder, value]);
    },
  }),
  getByRole: (role: 'button' | 'link', options: { name: string }) => ({
    click: async () => {
      operations.push(['clickByRole', role, options.name]);
    },
    fill: async () => undefined,
  }),
});

describe('runRealSmokeScenario', () => {
  it('runs the login-search-detail autopilot in the expected order', async () => {
    const operations: Operation[] = [];

    await runRealSmokeScenario({
      page: createFakePage(operations),
      baseUrl: 'http://127.0.0.1:4173/login',
      scenario: 'login-search-detail',
    });

    expect(operations).toEqual([
      ['waitForURL', 'http://127.0.0.1:4173/login'],
      ['fillByLabel', 'Email', 'qa@example.com'],
      ['fillByLabel', 'Password', 'super-secret'],
      ['clickByRole', 'button', '로그인'],
      ['waitForURL', 'http://127.0.0.1:4173/products'],
      ['fillByPlaceholder', '검색어', '맥북'],
      ['clickByRole', 'button', '검색'],
      ['clickByRole', 'link', 'MacBook Pro 14'],
      ['waitForURL', 'http://127.0.0.1:4173/products/42'],
    ]);
  });

  it('runs the create-post autopilot in the expected order', async () => {
    const operations: Operation[] = [];

    await runRealSmokeScenario({
      page: createFakePage(operations),
      baseUrl: 'http://127.0.0.1:4173/login',
      scenario: 'create-post',
    });

    expect(operations).toEqual([
      ['waitForURL', 'http://127.0.0.1:4173/login'],
      ['fillByLabel', 'Email', 'qa@example.com'],
      ['fillByLabel', 'Password', 'super-secret'],
      ['clickByRole', 'button', '로그인'],
      ['waitForURL', 'http://127.0.0.1:4173/products'],
      ['clickByRole', 'link', '게시글 작성'],
      ['waitForURL', 'http://127.0.0.1:4173/posts/new'],
      ['fillByLabel', 'Title', 'Launch checklist'],
      ['fillByLabel', 'Content', 'Write flow support is ready for review.'],
      ['clickByRole', 'button', '등록'],
      ['waitForURL', 'http://127.0.0.1:4173/posts/101'],
    ]);
  });
});
