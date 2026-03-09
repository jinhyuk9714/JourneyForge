import type { ArtifactKind, SessionBundle } from '@journeyforge/shared';

import { FilePreviewTabs } from '../components/FilePreviewTabs';
import { JourneyPreview } from '../components/JourneyPreview';

type SessionDetailPageProps = {
  bundle: SessionBundle | null;
  onExport(artifactKinds: ArtifactKind[]): void;
};

export const SessionDetailPage = ({ bundle, onExport }: SessionDetailPageProps) => (
  <div className="space-y-6">
    <JourneyPreview bundle={bundle} />
    {bundle ? <FilePreviewTabs artifacts={bundle.artifacts} onExport={onExport} /> : null}
  </div>
);
