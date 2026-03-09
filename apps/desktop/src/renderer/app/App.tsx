import { useState } from 'react';

import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';
import { useRecording } from '../hooks/useRecording';
import { useSessions } from '../hooks/useSessions';

type View = 'home' | 'settings';

export const App = () => {
  const [view, setView] = useState<View>('home');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000/login');
  const { status, error, start, stop } = useRecording();
  const {
    sessions,
    selectedBundle,
    selectedSessionId,
    exportMessage,
    selectSession,
    upsertBundle,
    exportArtifacts,
    dismissExportMessage,
  } = useSessions();

  const handleStart = async () => {
    await start(baseUrl);
  };

  const handleStop = async (sessionId: string) => {
    const bundle = await stop(sessionId);
    await upsertBundle(bundle);
  };

  return (
    <div className="min-h-screen bg-app px-6 py-6 font-body text-ink">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[32px] bg-white/70 px-6 py-5 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/45">JourneyForge MVP</p>
            <h1 className="font-display text-4xl text-ink">Record once. Generate engineering assets instantly.</h1>
          </div>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${view === 'home' ? 'bg-ink text-sand' : 'bg-sand text-ink'}`}
              onClick={() => setView('home')}
            >
              Home
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${view === 'settings' ? 'bg-ink text-sand' : 'bg-sand text-ink'}`}
              onClick={() => setView('settings')}
            >
              Settings
            </button>
          </nav>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">{error}</div>
        ) : null}

        {exportMessage ? (
          <button
            type="button"
            className="mb-4 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-ink"
            onClick={dismissExportMessage}
          >
            {exportMessage}
          </button>
        ) : null}

        {view === 'home' ? (
          <HomePage
            baseUrl={baseUrl}
            status={status}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            selectedBundle={selectedBundle}
            onBaseUrlChange={setBaseUrl}
            onStart={() => {
              void handleStart();
            }}
            onStop={(sessionId) => {
              void handleStop(sessionId);
            }}
            onSelectSession={(sessionId) => {
              void selectSession(sessionId);
            }}
            onExport={(artifactKinds) => {
              if (!selectedSessionId) {
                return;
              }
              void exportArtifacts(selectedSessionId, artifactKinds);
            }}
          />
        ) : (
          <SettingsPage />
        )}
      </div>
    </div>
  );
};
