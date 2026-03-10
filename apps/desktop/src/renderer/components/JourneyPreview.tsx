import type { SessionBundle } from '@journeyforge/shared';

type JourneyPreviewProps = {
  bundle: SessionBundle | null;
};

const toTestSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const JourneyPreview = ({ bundle }: JourneyPreviewProps) => {
  if (!bundle) {
    return (
      <section className="rounded-[28px] border border-dashed border-ink/20 bg-white/65 p-8 text-sm text-ink/60 shadow-panel">
        세션을 선택하면 정규화된 단계, 핵심 API, 생성 산출물을 확인할 수 있습니다.
      </section>
    );
  }

  const k6CandidateReasons = bundle.journey.suggestions.k6CandidateReasons ?? [];

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">기록된 여정</p>
          <h3 className="font-display text-3xl text-ink">{bundle.journey.title}</h3>
          <p className="mt-1 text-sm text-ink/65">
            {bundle.journey.steps.length}단계 · {bundle.journey.coreApis.length}개 핵심 API · 기준 URL{' '}
            {bundle.session.baseUrl}
          </p>
        </div>
        <div className="rounded-3xl bg-mint/15 px-4 py-3 text-sm text-ink">
          k6 후보: {bundle.journey.suggestions.k6Candidates.join(', ') || '없음'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {bundle.journey.steps.map((step, index) => (
            <article
              key={step.id}
              data-testid={`journey-step-${toTestSlug(step.title)}`}
              className="rounded-3xl border border-ink/10 bg-sand/80 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/45">단계 {index + 1}</p>
                  <h4 className="font-display text-xl text-ink">{step.title}</h4>
                </div>
                <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/70">
                  {step.apis.length}개 API
                </span>
              </div>
              <p className="mt-3 text-sm text-ink/70">{step.actionSummary}</p>
              {(step.explanation ?? []).length > 0 ? (
                <div
                  data-testid={`journey-step-evidence-${step.id}`}
                  className="mt-4 rounded-3xl border border-white/70 bg-white/65 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">이 단계로 분류한 이유</p>
                  <div className="mt-3 grid gap-2">
                    {(step.explanation ?? []).map((reason) => (
                      <div
                        key={`${step.id}-${reason}`}
                        className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/75"
                      >
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {step.apis.length > 0 ? (
                  step.apis.map((api) => (
                    <span key={api.id} className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/80">
                      {api.method} {api.path} · {api.status}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/55">연결된 API 없음</span>
                )}
              </div>
              {step.apis.some((api) => (api.explanation ?? []).length > 0) ? (
                <div
                  data-testid={`journey-api-evidence-${step.id}`}
                  className="mt-4 rounded-3xl border border-white/70 bg-white/70 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">API 근거</p>
                  <div className="mt-3 space-y-3">
                    {step.apis.map((api) =>
                      (api.explanation ?? []).length > 0 ? (
                        <div key={`${api.id}-evidence`} className="rounded-2xl border border-ink/10 bg-sand/40 p-3">
                          <p className="font-mono text-xs text-ink/70">
                            {api.method} {api.path}
                          </p>
                          <div className="mt-2 grid gap-2">
                            {(api.explanation ?? []).map((reason) => (
                              <div
                                key={`${api.id}-${reason}`}
                                className="rounded-2xl bg-white px-3 py-2 text-sm text-ink/75"
                              >
                                {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-ink/10 bg-ink px-5 py-5 text-sand">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">원본 세션</p>
            <div className="mt-4 space-y-3 text-sm text-sand/85">
              <div className="flex items-center justify-between gap-3">
                <span>기록 이벤트</span>
                <span className="font-mono">{bundle.session.rawEvents.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>시작</span>
                <span className="font-mono">{new Date(bundle.session.startedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>종료</span>
                <span className="font-mono">{new Date(bundle.session.endedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {k6CandidateReasons.length > 0 ? (
            <div data-testid="journey-k6-evidence" className="rounded-3xl border border-ink/10 bg-mint/20 px-5 py-5 text-ink">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                부하 테스트 후보를 고른 이유
              </p>
              <div className="mt-4 space-y-3">
                {k6CandidateReasons.map((candidate) => (
                  <div key={candidate.scenarioSlug} className="rounded-2xl border border-white/70 bg-white/75 p-4">
                    <p className="font-mono text-xs text-ink/70">{candidate.scenarioSlug}</p>
                    <div className="mt-2 grid gap-2">
                      {candidate.reasons.map((reason) => (
                        <div
                          key={`${candidate.scenarioSlug}-${reason}`}
                          className="rounded-2xl border border-ink/10 bg-sand/50 px-3 py-2 text-sm text-ink/75"
                        >
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
