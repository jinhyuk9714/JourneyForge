import type { SessionSummary } from '@journeyforge/shared';

type SessionListProps = {
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  onSelect(sessionId: string): void;
};

export const SessionList = ({ sessions, selectedSessionId, onSelect }: SessionListProps) => (
  <aside className="rounded-[28px] border border-ink/10 bg-white/85 p-4 shadow-panel">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Sessions</p>
        <h3 className="font-display text-2xl text-ink">Recent recordings</h3>
      </div>
      <span className="rounded-full bg-ink px-3 py-1 font-mono text-xs text-sand">{sessions.length}</span>
    </div>

    <div className="space-y-3">
      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink/15 px-4 py-5 text-sm text-ink/60">
          No sessions yet. Start a recording to populate the timeline.
        </div>
      ) : (
        sessions.map((session) => {
          const selected = session.id === selectedSessionId;
          return (
            <button
              key={session.id}
              type="button"
              data-testid={`session-row-${session.id}`}
              className={`flex w-full flex-col rounded-3xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-ink bg-ink text-sand shadow-panel'
                  : 'border-ink/10 bg-sand/80 text-ink hover:border-ink/40'
              }`}
              onClick={() => onSelect(session.id)}
            >
              <span className="font-display text-lg">{session.name}</span>
              <span className={`text-xs ${selected ? 'text-sand/70' : 'text-ink/55'}`}>
                {new Date(session.startedAt).toLocaleString()}
              </span>
              <span className={`mt-2 text-xs ${selected ? 'text-sand/75' : 'text-ink/65'}`}>
                {session.stepCount} steps · {session.artifactKinds.join(', ') || 'no artifacts'}
              </span>
            </button>
          );
        })
      )}
    </div>
  </aside>
);
