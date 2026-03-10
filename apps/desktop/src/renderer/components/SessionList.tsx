import type { SessionSummary } from '@journeyforge/shared';

import { artifactLabel } from '../lib/artifacts';

type SessionListProps = {
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  onSelect(sessionId: string): void;
};

export const SessionList = ({ sessions, selectedSessionId, onSelect }: SessionListProps) => (
  <aside className="rounded-[28px] border border-ink/10 bg-white/85 p-4 shadow-panel">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">세션</p>
        <h3 className="font-display text-2xl text-ink">최근 녹화</h3>
      </div>
      <span className="rounded-full bg-ink px-3 py-1 font-mono text-xs text-sand">{sessions.length}</span>
    </div>

    <div className="space-y-3">
      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink/15 px-4 py-5 text-sm text-ink/60">
          아직 세션이 없습니다. 녹화를 시작하면 타임라인이 채워집니다.
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
                {session.stepCount}단계 ·{' '}
                {session.artifactKinds.length > 0
                  ? session.artifactKinds.map(artifactLabel).join(', ')
                  : '산출물 없음'}
              </span>
            </button>
          );
        })
      )}
    </div>
  </aside>
);
