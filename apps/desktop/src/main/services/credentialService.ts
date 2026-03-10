import type { CredentialStatus } from '@journeyforge/shared';

const SERVICE_NAME = 'JourneyForge';
const PLAYWRIGHT_PASSWORD_ACCOUNT = 'playwright:test-password';
const KEYTAR_LOAD_FAILURE_PREFIX = 'Failed to load the macOS keychain integration.';

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, value: string): Promise<unknown>;
  deletePassword(service: string, account: string): Promise<unknown>;
};

export type CredentialStore = {
  getPlaywrightPassword(): Promise<string | null>;
  hasPlaywrightPassword(): Promise<boolean>;
  setPlaywrightPassword(value: string): Promise<void>;
  clearPlaywrightPassword(): Promise<void>;
  getStatus(): Promise<CredentialStatus>;
};

export type CredentialService = CredentialStore;

const loadKeytar = async (): Promise<KeytarModule> => {
  try {
    return await import('keytar');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown keytar load error.';
    throw new Error(
      `Failed to load the macOS keychain integration. Approve and rebuild native dependencies, then retry. Original error: ${message}`,
    );
  }
};

const withKeytarLoadFailure = (error: unknown): never => {
  if (error instanceof Error && error.message.startsWith(KEYTAR_LOAD_FAILURE_PREFIX)) {
    throw error;
  }
  const message = error instanceof Error ? error.message : 'Unknown keytar load error.';
  throw new Error(
    `Failed to load the macOS keychain integration. Approve and rebuild native dependencies, then retry. Original error: ${message}`,
  );
};

const withCredentialFailure = (message: string, error: unknown): never => {
  const detail = error instanceof Error ? error.message : 'Unknown keychain error.';
  throw new Error(`${message} Original error: ${detail}`);
};

export const createCredentialService = ({
  loadKeytar: loadKeytarImpl = loadKeytar,
}: {
  loadKeytar?: () => Promise<KeytarModule>;
} = {}): CredentialStore => ({
  async getPlaywrightPassword(): Promise<string | null> {
    const keytar = await loadKeytarImpl().catch(withKeytarLoadFailure);
    try {
      return await keytar.getPassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT);
    } catch (error) {
      return withCredentialFailure(
        'Failed to read the Playwright password from the macOS keychain. Open Keychain Access, verify JourneyForge access, then retry.',
        error,
      );
    }
  },
  async hasPlaywrightPassword(): Promise<boolean> {
    return Boolean(await this.getPlaywrightPassword());
  },
  async setPlaywrightPassword(value: string) {
    const keytar = await loadKeytarImpl().catch(withKeytarLoadFailure);
    try {
      await keytar.setPassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT, value);
    } catch (error) {
      return withCredentialFailure(
        'Failed to save the Playwright password to the macOS keychain. Unlock the login keychain or review keychain access prompts, then retry.',
        error,
      );
    }
  },
  async clearPlaywrightPassword() {
    const keytar = await loadKeytarImpl().catch(withKeytarLoadFailure);
    try {
      await keytar.deletePassword(SERVICE_NAME, PLAYWRIGHT_PASSWORD_ACCOUNT);
    } catch (error) {
      return withCredentialFailure(
        'Failed to remove the Playwright password from the macOS keychain. Verify the JourneyForge keychain item still exists, then retry.',
        error,
      );
    }
  },
  async getStatus(): Promise<CredentialStatus> {
    return {
      hasPlaywrightPassword: await this.hasPlaywrightPassword(),
    };
  },
});
