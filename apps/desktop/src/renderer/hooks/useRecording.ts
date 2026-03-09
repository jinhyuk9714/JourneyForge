import { useEffect, useState } from 'react';

import type { RecorderStatus, SessionBundle } from '@journeyforge/shared';

const defaultStatus: RecorderStatus = {
  state: 'idle',
  eventCount: 0,
};

export const useRecording = () => {
  const [status, setStatus] = useState<RecorderStatus>(defaultStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const refresh = async () => {
      try {
        const nextStatus = await window.journeyforge.recording.status();
        if (!active) {
          return;
        }
        setStatus(nextStatus);
        if (nextStatus.state === 'recording') {
          timer = window.setTimeout(refresh, 1000);
        }
      } catch (caught) {
        if (!active) {
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Failed to refresh recording status.');
      }
    };

    void refresh();

    return () => {
      active = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [status.state]);

  return {
    status,
    error,
    async start(baseUrl: string) {
      setError(null);
      const started = await window.journeyforge.recording.start({ baseUrl });
      setStatus({
        state: 'recording',
        eventCount: 0,
        sessionId: started.sessionId,
        baseUrl,
      });
      return started;
    },
    async stop(sessionId: string): Promise<SessionBundle> {
      setError(null);
      setStatus((current) => ({ ...current, state: 'analyzing' }));
      const bundle = await window.journeyforge.recording.stop({ sessionId });
      setStatus({
        state: 'ready',
        eventCount: bundle.session.rawEvents.length,
        sessionId: bundle.session.id,
        baseUrl: bundle.session.baseUrl,
      });
      return bundle;
    },
  };
};
