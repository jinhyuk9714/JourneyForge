import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { SessionBundle } from '@journeyforge/shared';

import { JourneyPreview } from './JourneyPreview';

afterEach(() => {
  cleanup();
});

const bundle: SessionBundle = {
  session: {
    id: 'session-1',
    name: 'Create Post',
    baseUrl: 'http://localhost:3000',
    startedAt: 1710000000000,
    endedAt: 1710000005000,
    rawEvents: [],
  },
  journey: {
    id: 'session-1',
    title: 'Create Post',
    slug: 'create-post',
    baseUrl: 'http://localhost:3000',
    steps: [
      {
        id: 'step-1',
        title: 'Create post',
        intent: 'create',
        pageUrl: 'http://localhost:3000/posts/new',
        startedAt: 1710000001000,
        endedAt: 1710000002000,
        actionSummary: 'click "등록"',
        actions: [],
        explanation: [
          'Grouped 2 input events with the triggering click before the next step started.',
          'Classified as create because POST /api/posts is a write API attached to this step.',
        ],
        apis: [
          {
            id: 'api-1',
            requestId: 'req-1',
            method: 'POST',
            url: 'http://localhost:3000/api/posts',
            path: '/api/posts',
            status: 201,
            durationMs: 180,
            pageUrl: 'http://localhost:3000/posts/new',
            timestamp: 1710000001500,
            query: {},
            scenarioSlug: 'post-posts',
            isWrite: true,
            candidateForLoadTest: true,
            payloadTemplate: {
              title: 'sample title',
              content: 'sample content',
            },
            expectedStatuses: [201],
            explanation: [
              'Captured as fetch.',
              'Attached to this step because the request started before the next step.',
              'Remained a load-test candidate because it is a non-auth business API with a successful response.',
            ],
          },
        ],
      },
    ],
    coreApis: [],
    suggestions: {
      playwright: true,
      k6Candidates: ['post-posts'],
      k6CandidateReasons: [
        {
          scenarioSlug: 'post-posts',
          reasons: [
            'Selected because it is a write API and write journeys take priority for k6 output.',
            'Auth APIs were excluded from k6 candidate selection.',
          ],
        },
      ],
    },
  },
  artifacts: [],
};

describe('JourneyPreview', () => {
  it('renders evidence cards for step, api, and k6 candidate explanations', () => {
    render(<JourneyPreview bundle={bundle} />);

    expect(screen.getByText('Why this step')).toBeInTheDocument();
    expect(
      screen.getByText('Grouped 2 input events with the triggering click before the next step started.'),
    ).toBeInTheDocument();
    expect(screen.getByText('API evidence')).toBeInTheDocument();
    expect(screen.getByText('Captured as fetch.')).toBeInTheDocument();
    expect(screen.getByText('Why these load-test targets')).toBeInTheDocument();
    expect(
      screen.getByText('Selected because it is a write API and write journeys take priority for k6 output.'),
    ).toBeInTheDocument();
  });

  it('hides explainability sections for legacy bundles that do not have explanation metadata', () => {
    const legacyBundle = {
      ...bundle,
      journey: {
        ...bundle.journey,
        steps: bundle.journey.steps.map((step) => {
          const { explanation: _stepExplanation, apis, ...restStep } = step;
          return {
            ...restStep,
            apis: apis.map((api) => {
              const { explanation: _apiExplanation, ...restApi } = api;
              return restApi;
            }),
          };
        }),
        suggestions: {
          playwright: true,
          k6Candidates: ['post-posts'],
        },
      },
    } as SessionBundle;

    render(<JourneyPreview bundle={legacyBundle} />);

    expect(screen.getByText('Create post')).toBeInTheDocument();
    expect(screen.queryByText('Why this step')).not.toBeInTheDocument();
    expect(screen.queryByText('API evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Why these load-test targets')).not.toBeInTheDocument();
  });
});
