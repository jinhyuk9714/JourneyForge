import { useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { CredentialStatus, JourneyForgeSettings } from '@journeyforge/shared';

const parseAnalyticsPatterns = (value: string) =>
  value
    .split('\n')
    .map((pattern) => pattern.trim())
    .filter(Boolean);

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Failed to update settings.');

export const SettingsPage = () => {
  const [settings, setSettings] = useState<JourneyForgeSettings>(DEFAULT_SETTINGS);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>({
    hasPlaywrightPassword: false,
  });
  const [passwordValue, setPasswordValue] = useState('');
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [credentialFeedback, setCredentialFeedback] = useState<{
    tone: 'idle' | 'saving' | 'success' | 'error';
    message: string | null;
  }>({
    tone: 'idle',
    message: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const loaded = await window.journeyforge.settings.get();
        if (cancelled) {
          return;
        }
        setSettings(loaded.settings);
        setCredentialStatus(loaded.credentialStatus);
        setSettingsStatus('ready');
      } catch (cause) {
        if (cancelled) {
          return;
        }
        setSettingsError(toErrorMessage(cause));
        setSettingsStatus('error');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistSettings = (nextSettings: JourneyForgeSettings) => {
    setSettings(nextSettings);
    setSettingsError(null);
    setSettingsStatus('saving');

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void window.journeyforge.settings
      .update(nextSettings)
      .then((saved) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSettings(saved.settings);
        setCredentialStatus(saved.credentialStatus);
        setSettingsStatus('ready');
      })
      .catch((cause) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSettingsError(toErrorMessage(cause));
        setSettingsStatus('error');
      });
  };

  const persistPassword = () => {
    if (!passwordValue) {
      return;
    }
    setCredentialFeedback({
      tone: 'saving',
      message: 'Saving the Playwright password to the OS keychain...',
    });
    void window.journeyforge.credentials
      .setPlaywrightPassword({ value: passwordValue })
      .then(() => {
        setCredentialStatus({ hasPlaywrightPassword: true });
        setPasswordValue('');
        setCredentialFeedback({
          tone: 'success',
          message: 'Playwright password saved to the OS keychain.',
        });
      })
      .catch((cause) => {
        setCredentialFeedback({
          tone: 'error',
          message: toErrorMessage(cause),
        });
      });
  };

  const clearPassword = () => {
    setCredentialFeedback({
      tone: 'saving',
      message: 'Removing the Playwright password from the OS keychain...',
    });
    void window.journeyforge.credentials
      .clearPlaywrightPassword()
      .then(() => {
        setCredentialStatus({ hasPlaywrightPassword: false });
        setPasswordValue('');
        setCredentialFeedback({
          tone: 'success',
          message: 'Playwright password removed from the OS keychain.',
        });
      })
      .catch((cause) => {
        setCredentialFeedback({
          tone: 'error',
          message: toErrorMessage(cause),
        });
      });
  };

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Settings</p>
        <h2 className="font-display text-3xl text-ink">Tune runtime inputs, noisy traffic filters, and execution defaults.</h2>
        <p className="mt-2 text-sm text-ink/65">
          Saved to <code>data/settings.json</code>. Changes apply to sessions that start after the save completes.
        </p>
        <p className="mt-2 text-xs text-ink/55">
          {settingsStatus === 'loading'
            ? 'Loading current settings...'
            : settingsStatus === 'saving'
              ? 'Saving updates for the next recording...'
              : settingsStatus === 'error'
                ? settingsError ?? 'Failed to update settings.'
                : 'Current settings are active for the next recording.'}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
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

          <div className="rounded-3xl border border-ink/10 bg-sand/90 p-5">
            <h3 className="font-display text-xl text-ink">Execution defaults</h3>
            <p className="mt-2 text-sm text-ink/65">
              Use these values when running generated Playwright and k6 bundles from inside the app.
            </p>
            <div className="mt-4 grid gap-4">
              <label htmlFor="playwright-test-email" className="flex flex-col gap-2 text-sm text-ink">
                <span>Playwright test email</span>
                <input
                  id="playwright-test-email"
                  aria-label="Playwright test email"
                  className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-ink"
                  type="email"
                  value={settings.execution.testEmail}
                  onChange={(event) =>
                    persistSettings({
                      ...settings,
                      execution: {
                        ...settings.execution,
                        testEmail: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label htmlFor="playwright-base-url" className="flex flex-col gap-2 text-sm text-ink">
                <span>Playwright base URL</span>
                <input
                  id="playwright-base-url"
                  aria-label="Playwright base URL"
                  className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-ink"
                  type="url"
                  value={settings.execution.playwrightBaseUrl}
                  onChange={(event) =>
                    persistSettings({
                      ...settings,
                      execution: {
                        ...settings.execution,
                        playwrightBaseUrl: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label htmlFor="k6-base-url" className="flex flex-col gap-2 text-sm text-ink">
                <span>k6 base URL</span>
                <input
                  id="k6-base-url"
                  aria-label="k6 base URL"
                  className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-ink"
                  type="url"
                  value={settings.execution.k6BaseUrl}
                  onChange={(event) =>
                    persistSettings({
                      ...settings,
                      execution: {
                        ...settings.execution,
                        k6BaseUrl: event.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
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
              aria-label="k6 p95 threshold (ms)"
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
              aria-label="k6 error-rate threshold"
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">Keychain</p>
            <p className="mt-3 text-sm">{credentialStatus.hasPlaywrightPassword ? 'Playwright password configured' : 'Playwright password not configured'}</p>
            {credentialFeedback.message ? (
              <p
                className={`mt-2 text-xs ${
                  credentialFeedback.tone === 'error'
                    ? 'text-rose-200'
                    : credentialFeedback.tone === 'success'
                      ? 'text-green-200'
                      : 'text-sand/70'
                }`}
              >
                {credentialFeedback.message}
              </p>
            ) : null}
            <label htmlFor="playwright-password" className="mt-4 flex flex-col gap-2 text-sm">
              <span>Playwright password</span>
              <input
                id="playwright-password"
                aria-label="Playwright password"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-ink"
                onClick={persistPassword}
              >
                비밀번호 저장/교체
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-sand"
                onClick={clearPassword}
              >
                비밀번호 삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
