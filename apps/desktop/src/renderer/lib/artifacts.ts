import type { ArtifactKind, GeneratedArtifact } from '@journeyforge/shared';

export const artifactLabel = (kind: ArtifactKind): string => {
  if (kind === 'playwright') {
    return 'Playwright';
  }
  if (kind === 'flow-doc') {
    return 'Flow Markdown';
  }
  return 'k6';
};

export const firstArtifactKind = (artifacts: GeneratedArtifact[]): ArtifactKind =>
  artifacts.find((artifact) => artifact.status === 'generated')?.kind ?? artifacts[0]?.kind ?? 'playwright';
