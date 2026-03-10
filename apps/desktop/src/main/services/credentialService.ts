import type { CredentialStatus } from '@journeyforge/shared';

const SERVICE_NAME = 'JourneyForge';
const PLAYWRIGHT_PASSWORD_ACCOUNT = 'playwright:test-password';
const KEYTAR_LOAD_FAILURE_PREFIX = 'Failed to load the macOS keychain integration.';

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, value: string): Promise<unknown>;
  deletePassword(service: string, account: string): Promise<unknown>;
};

type KeytarImport = Partial<KeytarModule> & {
  default?: Partial<KeytarModule>;
};

export type CredentialStore = {
  getPlaywrightPassword(): Promise<string | null>;
  hasPlaywrightPassword(): Promise<boolean>;
  setPlaywrightPassword(value: string): Promise<void>;
  clearPlaywrightPassword(): Promise<void>;
  getStatus(): Promise<CredentialStatus>;
};

export type CredentialService = CredentialStore;

const isKeytarModule = (value: Partial<KeytarModule> | undefined): value is KeytarModule =>
  Boolean(
    value &&
      typeof value.getPassword === 'function' &&
      typeof value.setPassword === 'function' &&
      typeof value.deletePassword === 'function',
  );

const resolveKeytarModule = (loaded: KeytarImport): KeytarModule => {
  if (isKeytarModule(loaded)) {
    return loaded;
  }

  if (isKeytarModule(loaded.default)) {
    return loaded.default;
  }

  const merged = {
    ...(loaded.default ?? {}),
    ...loaded,
  };

  if (isKeytarModule(merged)) {
    return merged;
  }

  throw new Error('Imported keytar module is missing getPassword, setPassword, or deletePassword.');
};

const loadKeytar = async (): Promise<KeytarModule> => {
  try {
    return resolveKeytarModule((await import('keytar')) as KeytarImport);
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
  loadKeytar?: () => Promise<KeytarImport>;
} = {}): CredentialStore => ({
  async getPlaywrightPassword(): Promise<string | null> {
    const keytar = resolveKeytarModule(await loadKeytarImpl().catch(withKeytarLoadFailure));
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
    const keytar = resolveKeytarModule(await loadKeytarImpl().catch(withKeytarLoadFailure));
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
    const keytar = resolveKeytarModule(await loadKeytarImpl().catch(withKeytarLoadFailure));
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
