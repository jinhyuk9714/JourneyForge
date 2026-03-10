import type { ArtifactKind, ExecutionSnapshot, ExecutionTarget, SessionBundle } from '@journeyforge/shared';

import { ExecutionPanel } from '../components/ExecutionPanel';
import { FilePreviewTabs } from '../components/FilePreviewTabs';
import { JourneyPreview } from '../components/JourneyPreview';

type SessionDetailPageProps = {
  bundle: SessionBundle | null;
  executionSnapshot: ExecutionSnapshot;
  onExport(artifactKinds: ArtifactKind[]): void;
  onExportBundle(): void;
  onRun(target: ExecutionTarget): void;
  onCancel(runId: string): void;
};

export const SessionDetailPage = ({
  bundle,
  executionSnapshot,
  onExport,
  onExportBundle,
  onRun,
  onCancel,
}: SessionDetailPageProps) => (
  <div className="space-y-6">
    <JourneyPreview bundle={bundle} />
    {bundle ? (
      <>
        <FilePreviewTabs
          artifacts={bundle.artifacts}
          onExport={onExport}
          onExportBundle={onExportBundle}
          onRun={onRun}
        />
        <ExecutionPanel sessionId={bundle.session.id} snapshot={executionSnapshot} onCancel={onCancel} />
      </>
    ) : null}
  </div>
);
