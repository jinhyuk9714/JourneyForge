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
    execution: {
      start: vi.fn(),
      status: vi.fn(),
      cancel: vi.fn(),
      subscribe: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        settings: DEFAULT_SETTINGS,
        credentialStatus: {
          hasPlaywrightPassword: false,
        },
      }),
      update: vi.fn().mockImplementation(async (input) => ({
        settings: input,
        credentialStatus: {
          hasPlaywrightPassword: false,
        },
      })),
      ...overrides,
    },
    credentials: {
      setPlaywrightPassword: vi.fn().mockResolvedValue({ configured: true }),
      clearPlaywrightPassword: vi.fn().mockResolvedValue({ configured: false }),
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
      execution: {
        testEmail: 'qa@example.com',
        playwrightBaseUrl: 'http://127.0.0.1:3000',
        k6BaseUrl: 'http://127.0.0.1:4000',
      },
    };
    const api = buildApi({
      get: vi.fn().mockResolvedValue({
        settings,
        credentialStatus: {
          hasPlaywrightPassword: true,
        },
      }),
      update: vi.fn().mockImplementation(async (input) => ({
        settings: input,
        credentialStatus: {
          hasPlaywrightPassword: true,
        },
      })),
    });
    window.journeyforge = api;

    render(<SettingsPage />);

    expect(await screen.findByLabelText('Analytics filters')).toHaveValue('mixpanel\ninternal-metrics');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByDisplayValue('900')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.05')).toBeInTheDocument();
    expect(screen.getByDisplayValue('qa@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://127.0.0.1:3000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://127.0.0.1:4000')).toBeInTheDocument();
    expect(screen.getByText('Playwright password configured')).toBeInTheDocument();

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
    fireEvent.change(screen.getByLabelText('Playwright test email'), {
      target: { value: 'runner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Playwright base URL'), {
      target: { value: 'http://127.0.0.1:3100' },
    });
    fireEvent.change(screen.getByLabelText('k6 base URL'), {
      target: { value: 'http://127.0.0.1:4100' },
    });
    fireEvent.change(screen.getByLabelText('Playwright password'), {
      target: { value: 'next-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 저장/교체' }));
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 삭제' }));

    await waitFor(() => {
      expect(api.settings.update).toHaveBeenLastCalledWith({
        analyticsPatterns: ['segment', 'internal-metrics'],
        maskEmailInputs: true,
        k6Thresholds: {
          httpReqDurationP95: 650,
          httpReqFailedRate: 0.02,
        },
        execution: {
          testEmail: 'runner@example.com',
          playwrightBaseUrl: 'http://127.0.0.1:3100',
          k6BaseUrl: 'http://127.0.0.1:4100',
        },
      });
    });
    expect(api.credentials.setPlaywrightPassword).toHaveBeenCalledWith({ value: 'next-secret' });
    expect(api.credentials.clearPlaywrightPassword).toHaveBeenCalledTimes(1);
  });
});
