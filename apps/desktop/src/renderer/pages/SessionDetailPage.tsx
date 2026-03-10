import type { ArtifactKind, SessionBundle } from '@journeyforge/shared';

import { FilePreviewTabs } from '../components/FilePreviewTabs';
import { JourneyPreview } from '../components/JourneyPreview';

type SessionDetailPageProps = {
  bundle: SessionBundle | null;
  onExport(artifactKinds: ArtifactKind[]): void;
  onExportBundle(): void;
};

export const SessionDetailPage = ({ bundle, onExport, onExportBundle }: SessionDetailPageProps) => (
  <div className="space-y-6">
    <JourneyPreview bundle={bundle} />
    {bundle ? <FilePreviewTabs artifacts={bundle.artifacts} onExport={onExport} onExportBundle={onExportBundle} /> : null}
  </div>
);
