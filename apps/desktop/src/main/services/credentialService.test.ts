// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createCredentialService } from './credentialService';

const buildKeytar = () => ({
  getPassword: vi.fn(async () => 'super-secret'),
  setPassword: vi.fn(async () => undefined),
  deletePassword: vi.fn(async () => true),
});

describe('createCredentialService', () => {
  it('surfaces keytar load failures with a remediation hint', async () => {
    const service = createCredentialService({
      loadKeytar: vi.fn(async () => {
        throw new Error('native module missing');
      }),
    });

    await expect(service.getStatus()).rejects.toThrow(
      'Failed to load the macOS keychain integration. Approve and rebuild native dependencies, then retry. Original error: native module missing',
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
      'Failed to load the macOS keychain integration. Approve and rebuild native dependencies, then retry. Original error: native module missing',
    );
  });

  it('surfaces keychain read failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.getPassword.mockRejectedValueOnce(new Error('User interaction is not allowed.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.getStatus()).rejects.toThrow(
      'Failed to read the Playwright password from the macOS keychain. Open Keychain Access, verify JourneyForge access, then retry. Original error: User interaction is not allowed.',
    );
  });

  it('surfaces keychain write failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.setPassword.mockRejectedValueOnce(new Error('The keychain is locked.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.setPlaywrightPassword('next-secret')).rejects.toThrow(
      'Failed to save the Playwright password to the macOS keychain. Unlock the login keychain or review keychain access prompts, then retry. Original error: The keychain is locked.',
    );
  });

  it('surfaces keychain delete failures with a remediation hint', async () => {
    const keytar = buildKeytar();
    keytar.deletePassword.mockRejectedValueOnce(new Error('The specified item could not be found in the keychain.'));

    const service = createCredentialService({
      loadKeytar: vi.fn(async () => keytar),
    });

    await expect(service.clearPlaywrightPassword()).rejects.toThrow(
      'Failed to remove the Playwright password from the macOS keychain. Verify the JourneyForge keychain item still exists, then retry. Original error: The specified item could not be found in the keychain.',
    );
  });
});
