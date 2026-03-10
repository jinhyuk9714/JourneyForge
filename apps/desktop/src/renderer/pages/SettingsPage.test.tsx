import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@journeyforge/shared';
import type { JourneyForgeDesktopApi } from '../../preload/index';

import { SettingsPage } from './SettingsPage';

const buildApi = (overrides: Partial<JourneyForgeDesktopApi['settings']> = {}): JourneyForgeDesktopApi =>
  ({
    recording: {
      start: vi.fn(),
      status: vi.fn(),
      stop: vi.fn(),
    },
    sessions: {
      list: vi.fn(),
      get: vi.fn(),
    },
    exports: {
      write: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      update: vi.fn().mockImplementation(async (input) => input),
      ...overrides,
    },
  }) as JourneyForgeDesktopApi;

describe('SettingsPage', () => {
  beforeEach(() => {
    window.journeyforge = buildApi();
  });

  it('loads settings from IPC and persists user changes through the desktop bridge', async () => {
    const settings = {
      analyticsPatterns: ['mixpanel', 'internal-metrics'],
      maskEmailInputs: false,
      k6Thresholds: {
        httpReqDurationP95: 900,
        httpReqFailedRate: 0.05,
      },
    };
    const api = buildApi({
      get: vi.fn().mockResolvedValue(settings),
      update: vi.fn().mockImplementation(async (input) => input),
    });
    window.journeyforge = api;

    render(<SettingsPage />);

    expect(await screen.findByLabelText('Analytics filters')).toHaveValue('mixpanel\ninternal-metrics');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByDisplayValue('900')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.05')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Analytics filters'), {
      target: { value: 'segment\ninternal-metrics' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('k6 p95 threshold (ms)'), {
      target: { value: '650' },
    });
    fireEvent.change(screen.getByLabelText('k6 error-rate threshold'), {
      target: { value: '0.02' },
    });

    await waitFor(() => {
      expect(api.settings.update).toHaveBeenLastCalledWith({
        analyticsPatterns: ['segment', 'internal-metrics'],
        maskEmailInputs: true,
        k6Thresholds: {
          httpReqDurationP95: 650,
          httpReqFailedRate: 0.02,
        },
      });
    });
  });
});
