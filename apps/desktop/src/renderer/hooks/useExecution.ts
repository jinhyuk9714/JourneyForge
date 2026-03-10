import { useEffect, useState } from 'react';

import type { ExecutionSnapshot, ExecutionTarget } from '@journeyforge/shared';

const defaultSnapshot: ExecutionSnapshot = {
  state: 'idle',
  logs: [],
  updatedAt: 0,
};

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Execution failed.');

export const useExecution = () => {
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot>(defaultSnapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.journeyforge.execution.subscribe((next) => {
      if (!mounted) {
        return;
      }
      setSnapshot(next);
    });

    void window.journeyforge.execution
      .status()
      .then((next) => {
        if (!mounted) {
          return;
        }
        setSnapshot(next);
      })
      .catch((cause) => {
        if (!mounted) {
          return;
        }
        setError(toErrorMessage(cause));
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    snapshot,
    error,
    async start(sessionId: string, target: ExecutionTarget) {
      setError(null);
      return window.journeyforge.execution.start({ sessionId, target }).catch((cause) => {
        const message = toErrorMessage(cause);
        setError(message);
        throw cause;
      });
    },
    async cancel(runId: string) {
      setError(null);
      return window.journeyforge.execution.cancel({ runId }).catch((cause) => {
        const message = toErrorMessage(cause);
        setError(message);
        throw cause;
      });
    },
  };
};
