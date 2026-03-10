import { useState } from 'react';

import type { ArtifactKind, GeneratedArtifact } from '@journeyforge/shared';

import { artifactLabel, firstArtifactKind } from '../lib/artifacts';

type FilePreviewTabsProps = {
  artifacts: GeneratedArtifact[];
  onExport(artifactKinds: ArtifactKind[]): void;
  onExportBundle(): void;
};

export const FilePreviewTabs = ({ artifacts, onExport, onExportBundle }: FilePreviewTabsProps) => {
  const [activeKind, setActiveKind] = useState<ArtifactKind>(firstArtifactKind(artifacts));
  const activeArtifact = artifacts.find((artifact) => artifact.kind === activeKind) ?? artifacts[0];

  if (!activeArtifact) {
    return (
      <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
        <p className="text-sm text-ink/60">No generated artifacts available for this session.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white/85 p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Generated output</p>
          <h3 className="font-display text-2xl text-ink">Preview and export</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
            onClick={onExportBundle}
          >
            실행 번들 내보내기
          </button>
          <button
            type="button"
            className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold/85"
            onClick={() => onExport([activeKind])}
          >
            현재 탭 내보내기
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {artifacts.map((artifact) => (
          <button
            key={artifact.kind}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              artifact.kind === activeKind ? 'bg-ink text-sand' : 'bg-sand text-ink hover:bg-ink/10'
            }`}
            onClick={() => setActiveKind(artifact.kind)}
          >
            {artifactLabel(artifact.kind)}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-ink/10 bg-[#101727] text-sand">
        {activeArtifact.status === 'generated' && activeArtifact.content ? (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs uppercase tracking-[0.2em] text-sand/55">
              <span>{activeArtifact.fileName}</span>
              <span>{activeArtifact.relativePath}</span>
            </div>
            <pre className="max-h-[460px] overflow-auto p-5 font-mono text-xs leading-6 text-sand/90">
              <code>{activeArtifact.content}</code>
            </pre>
          </>
        ) : (
          <div className="px-5 py-8 text-sm text-sand/80">{activeArtifact.reason ?? 'No artifact available.'}</div>
        )}
      </div>
    </section>
  );
};
