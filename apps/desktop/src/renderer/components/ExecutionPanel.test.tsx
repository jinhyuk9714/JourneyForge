import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ExecutionSnapshot } from '@journeyforge/shared';

import { ExecutionPanel } from './ExecutionPanel';

const runningSnapshot: ExecutionSnapshot = {
  runId: 'run-1',
  sessionId: 'session-1',
  target: 'playwright',
  state: 'running',
  startedAt: 1,
  updatedAt: 2,
  exitCode: undefined,
  logs: [
    {
      id: 'log-1',
      timestamp: 1,
      stream: 'system',
      message: 'Running: npx playwright test',
    },
    {
      id: 'log-2',
      timestamp: 2,
      stream: 'stdout',
      message: '1 passed',
    },
  ],
};

describe('ExecutionPanel', () => {
  it('renders execution status, logs, and a cancel action for the selected session', () => {
    const onCancel = vi.fn();

    render(<ExecutionPanel sessionId="session-1" snapshot={runningSnapshot} onCancel={onCancel} />);

    expect(screen.getByText('Playwright · running')).toBeInTheDocument();
    expect(screen.getByText('Running: npx playwright test')).toBeInTheDocument();
    expect(screen.getByText('1 passed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(onCancel).toHaveBeenCalledWith('run-1');
  });
});
