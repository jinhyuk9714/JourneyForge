import type { CredentialStatus } from '@journeyforge/shared';

const SERVICE_NAME = 'JourneyForge';
const PLAYWRIGHT_PASSWORD_ACCOUNT = 'playwright:test-password';

export type CredentialService = ReturnType<typeof createCredentialService>;

const loadKeytar = async () => {
  try {
    return await import('keytar');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown keytar load error.';
    throw new Error(
      `Failed to load the keychain integration. Approve and rebuild native dependencies, then retry. Original error: ${message}`,
    );
  }
};

export const createCredentialService = () => ({
  async getPlaywrightPassword(): Promise<string | null> {
    const keytar = await loadKeytar();
    return keytar.getPassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT);
  },
  async hasPlaywrightPassword(): Promise<boolean> {
    return Boolean(await this.getPlaywrightPassword());
  },
  async setPlaywrightPassword(value: string) {
    const keytar = await loadKeytar();
    await keytar.setPassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT, value);
  },
  async clearPlaywrightPassword() {
    const keytar = await loadKeytar();
    await keytar.deletePassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT);
  },
  async getStatus(): Promise<CredentialStatus> {
    return {
      hasPlaywrightPassword: await this.hasPlaywrightPassword(),
    };
  },
});
