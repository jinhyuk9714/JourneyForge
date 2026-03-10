import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecordPanel } from './RecordPanel';

describe('RecordPanel', () => {
  it('shows recording state and event count while a session is active', () => {
    const onBaseUrlChange = vi.fn();
    const onStart = vi.fn();
    const onStop = vi.fn();

    render(
      <RecordPanel
        baseUrl="http://localhost:3000/login"
        status={{
          state: 'recording',
          eventCount: 12,
          sessionId: 'session-1',
          baseUrl: 'http://localhost:3000/login',
        }}
        onBaseUrlChange={onBaseUrlChange}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByText('녹화 중')).toBeInTheDocument();
    expect(screen.getByText('12개 이벤트')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '기록 종료' }));

    expect(onStop).toHaveBeenCalledWith('session-1');
    expect(onStart).not.toHaveBeenCalled();
  });
});
