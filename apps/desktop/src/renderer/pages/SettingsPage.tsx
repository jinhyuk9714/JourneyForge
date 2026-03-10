import { useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { JourneyForgeSettings } from '@journeyforge/shared';

const parseAnalyticsPatterns = (value: string) =>
  value
    .split('\n')
    .map((pattern) => pattern.trim())
    .filter(Boolean);

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Failed to update settings.');

export const SettingsPage = () => {
  const [settings, setSettings] = useState<JourneyForgeSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const loaded = await window.journeyforge.settings.get();
        if (cancelled) {
          return;
        }
        setSettings(loaded);
        setStatus('ready');
      } catch (cause) {
        if (cancelled) {
          return;
        }
        setError(toErrorMessage(cause));
        setStatus('error');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistSettings = (nextSettings: JourneyForgeSettings) => {
    setSettings(nextSettings);
    setError(null);
    setStatus('saving');

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void window.journeyforge.settings
      .update(nextSettings)
      .then((saved) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSettings(saved);
        setStatus('ready');
      })
      .catch((cause) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(toErrorMessage(cause));
        setStatus('error');
      });
  };

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Settings</p>
        <h2 className="font-display text-3xl text-ink">Tune local defaults for noisy traffic and load-test thresholds.</h2>
        <p className="mt-2 text-sm text-ink/65">
          Saved to <code>data/settings.json</code>. Changes apply to sessions that start after the save completes.
        </p>
        <p className="mt-2 text-xs text-ink/55">
          {status === 'loading'
            ? 'Loading current settings...'
            : status === 'saving'
              ? 'Saving updates for the next recording...'
              : status === 'error'
                ? error ?? 'Failed to update settings.'
                : 'Current settings are active for the next recording.'}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-ink/10 bg-sand/90 p-5">
          <label htmlFor="analytics-patterns" className="font-display text-xl text-ink">
            Analytics filters
          </label>
          <p className="mt-2 text-sm text-ink/65">One pattern per line. Matching requests are ignored during journey normalization.</p>
          <textarea
            id="analytics-patterns"
            aria-label="Analytics filters"
            className="mt-4 min-h-40 w-full rounded-3xl border border-ink/10 bg-white px-4 py-3 font-mono text-sm text-ink"
            value={settings.analyticsPatterns.join('\n')}
            onChange={(event) =>
              persistSettings({
                ...settings,
                analyticsPatterns: parseAnalyticsPatterns(event.target.value),
              })
            }
          />
        </div>

        <div className="space-y-4 rounded-3xl border border-ink/10 bg-ink p-5 text-sand">
          <label htmlFor="mask-email-inputs" className="flex items-center justify-between gap-4">
            <span className="text-sm">Mask email inputs</span>
            <input
              id="mask-email-inputs"
              type="checkbox"
              checked={settings.maskEmailInputs}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  maskEmailInputs: event.target.checked,
                })
              }
            />
          </label>
          <label htmlFor="k6-duration-threshold" className="flex flex-col gap-2 text-sm">
            <span>k6 p95 threshold (ms)</span>
            <input
              id="k6-duration-threshold"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
              type="number"
              value={settings.k6Thresholds.httpReqDurationP95}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  k6Thresholds: {
                    ...settings.k6Thresholds,
                    httpReqDurationP95: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label htmlFor="k6-failed-threshold" className="flex flex-col gap-2 text-sm">
            <span>k6 error-rate threshold</span>
            <input
              id="k6-failed-threshold"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={settings.k6Thresholds.httpReqFailedRate}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  k6Thresholds: {
                    ...settings.k6Thresholds,
                    httpReqFailedRate: Number(event.target.value),
                  },
                })
              }
            />
          </label>
        </div>
      </div>
    </section>
  );
};
