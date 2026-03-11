import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

    expect(await screen.findByLabelText('추적 필터')).toHaveValue('mixpanel\ninternal-metrics');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByDisplayValue('900')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.05')).toBeInTheDocument();
    expect(screen.getByDisplayValue('qa@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://127.0.0.1:3000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://127.0.0.1:4000')).toBeInTheDocument();
    expect(screen.getByText('Playwright 비밀번호가 저장되어 있습니다')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('추적 필터'), {
      target: { value: 'segment\ninternal-metrics' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('k6 응답 p95 (ms)'), {
      target: { value: '650' },
    });
    fireEvent.change(screen.getByLabelText('k6 오류율'), {
      target: { value: '0.02' },
    });
    fireEvent.change(screen.getByLabelText('Playwright 테스트 이메일'), {
      target: { value: 'runner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Playwright 기본 URL'), {
      target: { value: 'http://127.0.0.1:3100' },
    });
    fireEvent.change(screen.getByLabelText('k6 기본 URL'), {
      target: { value: 'http://127.0.0.1:4100' },
    });
    fireEvent.change(screen.getByLabelText('Playwright 비밀번호'), {
      target: { value: 'next-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 저장' }));
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

  it('shows settings update failures without overwriting keychain status text', async () => {
    const api = buildApi({
      update: vi.fn().mockRejectedValue(new Error('Settings write failed.')),
    });
    window.journeyforge = api;

    render(<SettingsPage />);

    await screen.findByLabelText('추적 필터');
    fireEvent.change(screen.getByLabelText('추적 필터'), {
      target: { value: 'segment' },
    });

    await waitFor(() => {
      expect(screen.getByText('Settings write failed.')).toBeInTheDocument();
    });
    expect(screen.getByText('Playwright 비밀번호가 아직 없습니다')).toBeInTheDocument();
  });

  it('keeps the credential status unchanged when saving the Playwright password fails', async () => {
    const api = buildApi();
    api.credentials.setPlaywrightPassword = vi.fn().mockRejectedValue(new Error('The keychain is locked.'));
    window.journeyforge = api;

    render(<SettingsPage />);

    await screen.findByLabelText('Playwright 비밀번호');
    fireEvent.change(screen.getByLabelText('Playwright 비밀번호'), {
      target: { value: 'next-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 저장' }));

    await waitFor(() => {
      expect(screen.getByText('The keychain is locked.')).toBeInTheDocument();
    });
    expect(screen.getByText('Playwright 비밀번호가 아직 없습니다')).toBeInTheDocument();
  });

  it('keeps the credential status unchanged when clearing the Playwright password fails', async () => {
    const api = buildApi({
      get: vi.fn().mockResolvedValue({
        settings: DEFAULT_SETTINGS,
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
    api.credentials.clearPlaywrightPassword = vi
      .fn()
      .mockRejectedValue(new Error('The JourneyForge keychain item could not be removed.'));
    window.journeyforge = api;

    render(<SettingsPage />);

    await screen.findByText('Playwright 비밀번호가 저장되어 있습니다');
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 삭제' }));

    await waitFor(() => {
      expect(screen.getByText('The JourneyForge keychain item could not be removed.')).toBeInTheDocument();
    });
    expect(screen.getByText('Playwright 비밀번호가 저장되어 있습니다')).toBeInTheDocument();
  });
});
