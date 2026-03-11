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
    relativePath: 'generated/k6/login-search-detail.js',
    content: "export default function () {}",
    generatedAt: 1,
    status: 'generated',
  },
];

describe('FilePreviewTabs', () => {
  it('switches tabs and only exposes run actions for generated playwright and k6 artifacts', () => {
    const onExport = vi.fn();
    const onExportBundle = vi.fn();
    const onRun = vi.fn();
    const props = { artifacts, onExport, onExportBundle, onRun } as any;

    render(<FilePreviewTabs {...props} />);

    expect(screen.getByText("test('login-search-detail', async () => {})")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Playwright 실행' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Playwright 실행' }));
    expect(onRun).toHaveBeenCalledWith('playwright');

    fireEvent.click(screen.getByRole('button', { name: '플로우 문서' }));
    expect(screen.getByText('# Journey: Login Search Detail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /실행$/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'k6' }));
    expect(screen.getByText('export default function () {}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'k6 실행' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'k6 실행' }));
    expect(onRun).toHaveBeenCalledWith('k6');

    fireEvent.click(screen.getByRole('button', { name: '이 탭 내보내기' }));
    expect(onExport).toHaveBeenCalledWith(['k6']);

    fireEvent.click(screen.getByRole('button', { name: '번들 내보내기' }));
    expect(onExportBundle).toHaveBeenCalledTimes(1);
  });
});
