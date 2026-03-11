import { useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { CredentialStatus, JourneyForgeSettings } from '@journeyforge/shared';

const parseAnalyticsPatterns = (value: string) =>
  value
    .split('\n')
    .map((pattern) => pattern.trim())
    .filter(Boolean);

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : '설정을 업데이트하지 못했습니다.');

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
      message: '비밀번호를 키체인에 저장하는 중입니다.',
    });
    void window.journeyforge.credentials
      .setPlaywrightPassword({ value: passwordValue })
      .then(() => {
        setCredentialStatus({ hasPlaywrightPassword: true });
        setPasswordValue('');
        setCredentialFeedback({
          tone: 'success',
          message: '비밀번호를 키체인에 저장했습니다.',
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
      message: '비밀번호를 키체인에서 삭제하는 중입니다.',
    });
    void window.journeyforge.credentials
      .clearPlaywrightPassword()
      .then(() => {
        setCredentialStatus({ hasPlaywrightPassword: false });
        setPasswordValue('');
        setCredentialFeedback({
          tone: 'success',
          message: '비밀번호를 키체인에서 삭제했습니다.',
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
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">설정</p>
        <h2 className="font-display text-3xl text-ink">실행 설정과 필터를 관리하세요.</h2>
        <p className="mt-2 text-sm text-ink/65">
          <code>data/settings.json</code>에 저장되며, 새로 시작하는 세션부터 반영됩니다.
        </p>
        <p className="mt-2 text-xs text-ink/55">
          {settingsStatus === 'loading'
            ? '설정을 불러오는 중입니다.'
            : settingsStatus === 'saving'
              ? '설정을 저장하는 중입니다.'
              : settingsStatus === 'error'
                ? settingsError ?? '설정을 업데이트하지 못했습니다.'
                : '새 세션부터 이 설정이 적용됩니다.'}
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-ink/10 bg-sand/90 p-5">
            <label htmlFor="analytics-patterns" className="font-display text-xl text-ink">
              추적 필터
            </label>
            <p className="mt-2 text-sm text-ink/65">한 줄에 하나씩 입력하면 해당 요청을 분석에서 제외합니다.</p>
            <textarea
              id="analytics-patterns"
              aria-label="추적 필터"
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
            <h3 className="font-display text-xl text-ink">실행 기본값</h3>
            <p className="mt-2 text-sm text-ink/65">앱 안에서 Playwright와 k6를 실행할 때 기본으로 씁니다.</p>
            <div className="mt-4 grid gap-4">
              <label htmlFor="playwright-test-email" className="flex flex-col gap-2 text-sm text-ink">
                <span>Playwright 테스트 이메일</span>
                <input
                  id="playwright-test-email"
                  aria-label="Playwright 테스트 이메일"
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
                <span>Playwright 기본 URL</span>
                <input
                  id="playwright-base-url"
                  aria-label="Playwright 기본 URL"
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
                <span>k6 기본 URL</span>
                <input
                  id="k6-base-url"
                  aria-label="k6 기본 URL"
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
          <label htmlFor="mask-email-inputs" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm">이메일 마스킹</span>
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
            <span>k6 응답 p95 (ms)</span>
            <input
              id="k6-duration-threshold"
              aria-label="k6 응답 p95 (ms)"
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
            <span>k6 오류율</span>
            <input
              id="k6-failed-threshold"
              aria-label="k6 오류율"
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/60">비밀번호</p>
            <p className="mt-3 text-sm">
              {credentialStatus.hasPlaywrightPassword
                ? 'Playwright 비밀번호가 저장되어 있습니다'
                : 'Playwright 비밀번호가 아직 없습니다'}
            </p>
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
              <span>Playwright 비밀번호</span>
              <input
                id="playwright-password"
                aria-label="Playwright 비밀번호"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sand"
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-ink"
                onClick={persistPassword}
              >
                비밀번호 저장
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
