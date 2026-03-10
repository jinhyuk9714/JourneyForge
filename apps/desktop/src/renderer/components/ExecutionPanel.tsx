import type { ExecutionSnapshot } from '@journeyforge/shared';

type ExecutionPanelProps = {
  sessionId: string;
  snapshot: ExecutionSnapshot;
  onCancel(runId: string): void;
};

const formatTarget = (target: ExecutionSnapshot['target']) => {
  if (target === 'playwright') {
    return 'Playwright';
  }
  if (target === 'k6') {
    return 'k6';
  }
  return 'No run';
};

export const ExecutionPanel = ({ sessionId, snapshot, onCancel }: ExecutionPanelProps) => {
  const belongsToSession = snapshot.sessionId === sessionId;

  if (!belongsToSession) {
    return (
      <section data-testid="execution-panel" className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Execution</p>
        <h3 className="font-display text-2xl text-ink">Run generated bundles</h3>
        <p className="mt-3 text-sm text-ink/60">Select Playwright or k6 output above to run this session inside the app.</p>
      </section>
    );
  }

  const statusLabel = `${formatTarget(snapshot.target)} · ${snapshot.state}`;

  return (
    <section data-testid="execution-panel" className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Execution</p>
          <h3 data-testid="execution-status" className="font-display text-2xl text-ink">
            {statusLabel}
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            {snapshot.bundlePath ? `Bundle: ${snapshot.bundlePath}` : 'Live stdout, stderr, and system messages stay in memory only.'}
          </p>
        </div>
        {snapshot.runId && (snapshot.state === 'preparing' || snapshot.state === 'running') ? (
          <button
            type="button"
            className="rounded-2xl border border-ember/25 bg-ember/10 px-4 py-2 text-sm font-semibold text-ember"
            onClick={() => onCancel(snapshot.runId!)}
          >
            실행 취소
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink/70">
        <span>State: {snapshot.state}</span>
        {typeof snapshot.exitCode === 'number' ? <span>Exit: {snapshot.exitCode}</span> : null}
        {snapshot.error ? <span className="text-ember">{snapshot.error}</span> : null}
      </div>

      <div data-testid="execution-log-panel" className="mt-5 rounded-3xl border border-ink/10 bg-[#101727] p-5 text-sand">
        {snapshot.logs.length > 0 ? (
          <ul className="space-y-3 font-mono text-xs leading-6 text-sand/90">
            {snapshot.logs.map((entry) => (
              <li key={entry.id}>
                <span className="mr-3 uppercase text-sand/45">{entry.stream}</span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-sand/70">No logs yet.</p>
        )}
      </div>
    </section>
  );
};
