import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GeneratedArtifact } from '@journeyforge/shared';

import { FilePreviewTabs } from './FilePreviewTabs';

const artifacts: GeneratedArtifact[] = [
  {
    kind: 'playwright',
    fileName: 'login-search-detail.spec.ts',
    relativePath: 'generated/playwright/login-search-detail.spec.ts',
    content: "test('login-search-detail', async () => {})",
    generatedAt: 1,
    status: 'generated',
  },
  {
    kind: 'flow-doc',
    fileName: 'login-search-detail.flow.md',
    relativePath: 'generated/docs/login-search-detail.flow.md',
    content: '# Journey: Login Search Detail',
    generatedAt: 1,
    status: 'generated',
  },
  {
    kind: 'k6',
    fileName: 'login-search-detail.js',
    relativePath: null,
    content: null,
    generatedAt: 1,
    status: 'skipped',
    reason: 'No load-test candidate APIs detected.',
  },
];

describe('FilePreviewTabs', () => {
  it('switches tabs and shows skipped artifact reasons', () => {
    const onExport = vi.fn();

    render(<FilePreviewTabs artifacts={artifacts} onExport={onExport} />);

    expect(screen.getByText("test('login-search-detail', async () => {})")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Flow Markdown' }));
    expect(screen.getByText('# Journey: Login Search Detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'k6' }));
    expect(screen.getByText('No load-test candidate APIs detected.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '현재 탭 내보내기' }));
    expect(onExport).toHaveBeenCalledWith(['k6']);
  });
});
