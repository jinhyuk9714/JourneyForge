import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';

const STORAGE_KEY = 'journeyforge.renderer.settings';

export const SettingsPage = () => {
  const [maskEmails, setMaskEmails] = useState(DEFAULT_SETTINGS.maskEmailInputs);
  const [durationThreshold, setDurationThreshold] = useState(DEFAULT_SETTINGS.k6Thresholds.httpReqDurationP95);
  const [failedRate, setFailedRate] = useState(DEFAULT_SETTINGS.k6Thresholds.httpReqFailedRate);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as {
      maskEmails: boolean;
      durationThreshold: number;
      failedRate: number;
    };
    setMaskEmails(parsed.maskEmails);
    setDurationThreshold(parsed.durationThreshold);
    setFailedRate(parsed.failedRate);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        maskEmails,
        durationThreshold,
        failedRate,
      }),
    );
  }, [durationThreshold, failedRate, maskEmails]);

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Settings</p>
        <h2 className="font-display text-3xl text-ink">Tune local defaults for noisy traffic and load-test thresholds.</h2>
        <p className="mt-2 text-sm text-ink/65">
          These MVP settings are stored locally in the renderer and help you reason about what the desktop app will filter or generate next.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-ink/10 bg-sand/90 p-5">
          <h3 className="font-display text-xl text-ink">Analytics filters</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {DEFAULT_SETTINGS.analyticsPatterns.map((pattern) => (
              <span key={pattern} className="rounded-full bg-white px-3 py-1 font-mono text-xs text-ink/75">
                {pattern}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-ink/10 bg-ink p-5 text-sand">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Mask email inputs</span>
            <input type="checkbox" checked={maskEmails} onChange={(event) => setMaskEmails(event.target.checked)} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>k6 p95 threshold (ms)</span>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
              type="number"
              value={durationThreshold}
              onChange={(event) => setDurationThreshold(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>k6 error-rate threshold</span>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={failedRate}
              onChange={(event) => setFailedRate(Number(event.target.value))}
            />
          </label>
        </div>
      </div>
    </section>
  );
};
