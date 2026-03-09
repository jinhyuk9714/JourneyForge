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
            </article>
          ))}
        </div>

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
      </div>
    </section>
  );
};
