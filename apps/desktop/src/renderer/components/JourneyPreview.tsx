import type { SessionBundle } from '@journeyforge/shared';

type JourneyPreviewProps = {
  bundle: SessionBundle | null;
};

export const JourneyPreview = ({ bundle }: JourneyPreviewProps) => {
  if (!bundle) {
    return (
      <section className="rounded-[28px] border border-dashed border-ink/20 bg-white/65 p-8 text-sm text-ink/60 shadow-panel">
        Select a session to inspect normalized steps, core APIs, and generated artifacts.
      </section>
    );
  }

  const k6CandidateReasons = bundle.journey.suggestions.k6CandidateReasons ?? [];

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Journey</p>
          <h3 className="font-display text-3xl text-ink">{bundle.journey.title}</h3>
          <p className="mt-1 text-sm text-ink/65">
            {bundle.journey.steps.length} steps · {bundle.journey.coreApis.length} core APIs · base URL {bundle.session.baseUrl}
          </p>
        </div>
        <div className="rounded-3xl bg-mint/15 px-4 py-3 text-sm text-ink">
          k6 candidates: {bundle.journey.suggestions.k6Candidates.join(', ') || 'none'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {bundle.journey.steps.map((step, index) => (
            <article key={step.id} className="rounded-3xl border border-ink/10 bg-sand/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Step {index + 1}</p>
                  <h4 className="font-display text-xl text-ink">{step.title}</h4>
                </div>
                <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/70">
                  {step.apis.length} api
                </span>
              </div>
              <p className="mt-3 text-sm text-ink/70">{step.actionSummary}</p>
              {(step.explanation ?? []).length > 0 ? (
                <div className="mt-4 rounded-3xl border border-white/70 bg-white/65 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Why this step</p>
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
                  <span className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/55">No API attached</span>
                )}
              </div>
              {step.apis.some((api) => (api.explanation ?? []).length > 0) ? (
                <div className="mt-4 rounded-3xl border border-white/70 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">API evidence</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">Raw session</p>
            <div className="mt-4 space-y-3 text-sm text-sand/85">
              <div className="flex items-center justify-between gap-3">
                <span>Recorded events</span>
                <span className="font-mono">{bundle.session.rawEvents.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Started</span>
                <span className="font-mono">{new Date(bundle.session.startedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Ended</span>
                <span className="font-mono">{new Date(bundle.session.endedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {k6CandidateReasons.length > 0 ? (
            <div className="rounded-3xl border border-ink/10 bg-mint/20 px-5 py-5 text-ink">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                Why these load-test targets
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
