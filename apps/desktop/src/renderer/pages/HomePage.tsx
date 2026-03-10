import type { ArtifactKind, RecorderStatus, SessionBundle, SessionSummary } from '@journeyforge/shared';

import { RecordPanel } from '../components/RecordPanel';
import { SessionList } from '../components/SessionList';
import { SessionDetailPage } from './SessionDetailPage';

type HomePageProps = {
  baseUrl: string;
  status: RecorderStatus;
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  selectedBundle: SessionBundle | null;
  onBaseUrlChange(baseUrl: string): void;
  onStart(): void;
  onStop(sessionId: string): void;
  onSelectSession(sessionId: string): void;
  onExport(artifactKinds: ArtifactKind[]): void;
  onExportBundle(): void;
};

export const HomePage = ({
  baseUrl,
  status,
  sessions,
  selectedSessionId,
  selectedBundle,
  onBaseUrlChange,
  onStart,
  onStop,
  onSelectSession,
  onExport,
  onExportBundle,
}: HomePageProps) => (
  <div className="space-y-6">
    <RecordPanel
      baseUrl={baseUrl}
      status={status}
      onBaseUrlChange={onBaseUrlChange}
      onStart={onStart}
      onStop={onStop}
    />

    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <SessionList sessions={sessions} selectedSessionId={selectedSessionId} onSelect={onSelectSession} />
      <SessionDetailPage bundle={selectedBundle} onExport={onExport} onExportBundle={onExportBundle} />
    </div>
  </div>
);
