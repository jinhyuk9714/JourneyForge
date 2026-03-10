// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createCredentialService } from './credentialService';

const buildKeytar = () => ({
  getPassword: vi.fn(async () => 'super-secret'),
  setPassword: vi.fn(async () => undefined),
  deletePassword: vi.fn(async () => true),
});

describe('createCredentialService', () => {
  it('supports keytar imports that expose write methods under the default export', async () => {
    const keytar = buildKeytar();
    const service = createCredentialService({
      loadKeytar: vi.fn(async () => ({
        default: keytar,
        getPassword: keytar.getPassword,
      })),
    });

    await expect(service.setPlaywrightPassword('next-secret')).resolves.toBeUndefined();
    await expect(service.clearPlaywrightPassword()).resolves.toBeUndefined();
    await expect(service.getPlaywrightPassword()).resolves.toBe('super-secret');
    expect(keytar.setPassword).toHaveBeenCalledWith('JourneyForge', 'playwright:test-password', 'next-secret');
    expect(keytar.deletePassword).toHaveBeenCalledWith('JourneyForge', 'playwright:test-password');
  });

  it('surfaces keytar load failures with a remediation hint', async () => {
    const service = createCredentialService({
      loadKeytar: vi.fn(async () => {
        throw new Error('native module missing');
      }),
    });

    await expect(service.getStatus()).rejects.toThrow(
      'macOS 키체인 연동을 불러오지 못했습니다. 네이티브 의존성을 승인하고 다시 빌드한 뒤 다시 시도하세요. Original error: native module missing',
    );
  });

  it('does not double-wrap keytar load failures that already include remediation guidance', async () => {
    const service = createCredentialService({
      loadKeytar: vi.fn(async () => {
        throw new Error(
          'Failed to load the macOS keychain integration. Approve and rebuild native dependencies, then retry. Original error: native module missing',
        );
      }),
    });

    await expect(service.getStatus()).rejects.toThrow(
      'macOS 키체인 연동을 불러오지 못했습니다. 네이티브 의존성을 승인하고 다시 빌드한 뒤 다시 시도하세요. Original error: native module missing',
    );
  });

  it('surfaces keychain read failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.getPassword.mockRejectedValueOnce(new Error('User interaction is not allowed.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.getStatus()).rejects.toThrow(
      'macOS 키체인에서 Playwright 비밀번호를 읽지 못했습니다. 키체인 접근 권한과 JourneyForge 항목을 확인한 뒤 다시 시도하세요. Original error: User interaction is not allowed.',
    );
  });

  it('surfaces keychain write failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.setPassword.mockRejectedValueOnce(new Error('The keychain is locked.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.setPlaywrightPassword('next-secret')).rejects.toThrow(
      'macOS 키체인에 Playwright 비밀번호를 저장하지 못했습니다. 로그인 키체인을 잠금 해제하거나 접근 권한 요청을 확인한 뒤 다시 시도하세요. Original error: The keychain is locked.',
    );
  });

  it('surfaces keychain delete failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.deletePassword.mockRejectedValueOnce(new Error('The specified item could not be found in the keychain.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.clearPlaywrightPassword()).rejects.toThrow(
      'macOS 키체인에서 Playwright 비밀번호를 삭제하지 못했습니다. JourneyForge 키체인 항목이 남아 있는지 확인한 뒤 다시 시도하세요. Original error: The specified item could not be found in the keychain.',
    );
  });
});
