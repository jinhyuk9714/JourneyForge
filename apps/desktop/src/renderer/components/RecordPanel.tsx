import type { RecorderStatus } from '@journeyforge/shared';

type RecordPanelProps = {
  baseUrl: string;
  status: RecorderStatus;
  onBaseUrlChange(baseUrl: string): void;
  onStart(): void;
  onStop(sessionId: string): void;
};

export const RecordPanel = ({
  baseUrl,
  status,
  onBaseUrlChange,
  onStart,
  onStop,
}: RecordPanelProps) => {
  const busy = status.state === 'recording' || status.state === 'analyzing';

  return (
    <section className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/50">레코더</p>
          <h2 className="font-display text-3xl text-ink">브라우저 흐름을 바로 자산으로 바꾸세요.</h2>
          <p className="max-w-xl text-sm text-ink/70">한 번 기록하면 Playwright, API 흐름 문서, k6 초안을 바로 만듭니다.</p>
        </div>
        <div className="flex w-full flex-col gap-2 rounded-3xl bg-ink px-5 py-4 text-sand sm:max-w-sm">
          <span className="text-xs uppercase tracking-[0.24em] text-sand/70">
            {status.state === 'recording' ? '녹화 중' : status.state === 'analyzing' ? '정리 중' : '대기 중'}
          </span>
          <span className="font-display text-2xl">{status.eventCount}개 이벤트</span>
          <span className="text-xs text-sand/70">{status.baseUrl ?? '대상 URL 없음'}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">대상 URL</span>
          <input
            className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 font-body text-sm text-ink outline-none ring-0 transition focus:border-ember"
            placeholder="http://localhost:3000/login"
            value={baseUrl}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-sand transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/30 md:w-auto"
          onClick={onStart}
          disabled={!baseUrl || busy}
        >
          기록 시작
        </button>
        <button
          type="button"
          className="w-full rounded-2xl bg-ember px-5 py-3 font-semibold text-white transition hover:bg-ember/90 disabled:cursor-not-allowed disabled:bg-ember/30 md:w-auto"
          onClick={() => status.sessionId && onStop(status.sessionId)}
          disabled={!status.sessionId || status.state !== 'recording'}
        >
          기록 종료
        </button>
      </div>
    </section>
  );
};
