import type { CredentialStatus } from '@journeyforge/shared';

const SERVICE_NAME = 'JourneyForge';
const PLAYWRIGHT_PASSWORD_ACCOUNT = 'playwright:test-password';
const KEYTAR_LOAD_FAILURE_PREFIX = 'macOS 키체인 연동을 불러오지 못했습니다.';
const LEGACY_KEYTAR_LOAD_FAILURE_PREFIX = 'Failed to load the macOS keychain integration.';

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
      `macOS 키체인 연동을 불러오지 못했습니다. 네이티브 의존성을 승인하고 다시 빌드한 뒤 다시 시도하세요. Original error: ${message}`,
    );
  }
};

const withKeytarLoadFailure = (error: unknown): never => {
  if (error instanceof Error && error.message.startsWith(KEYTAR_LOAD_FAILURE_PREFIX)) {
    throw error;
  }

  if (error instanceof Error && error.message.startsWith(LEGACY_KEYTAR_LOAD_FAILURE_PREFIX)) {
    const originalDetail = error.message.includes('Original error:')
      ? error.message.split('Original error:').slice(1).join('Original error:').trim()
      : error.message;
    throw new Error(
      `macOS 키체인 연동을 불러오지 못했습니다. 네이티브 의존성을 승인하고 다시 빌드한 뒤 다시 시도하세요. Original error: ${originalDetail}`,
    );
  }
  const message = error instanceof Error ? error.message : 'Unknown keytar load error.';
  throw new Error(
    `macOS 키체인 연동을 불러오지 못했습니다. 네이티브 의존성을 승인하고 다시 빌드한 뒤 다시 시도하세요. Original error: ${message}`,
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
        'macOS 키체인에서 Playwright 비밀번호를 읽지 못했습니다. 키체인 접근 권한과 JourneyForge 항목을 확인한 뒤 다시 시도하세요.',
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
        'macOS 키체인에 Playwright 비밀번호를 저장하지 못했습니다. 로그인 키체인을 잠금 해제하거나 접근 권한 요청을 확인한 뒤 다시 시도하세요.',
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
        'macOS 키체인에서 Playwright 비밀번호를 삭제하지 못했습니다. JourneyForge 키체인 항목이 남아 있는지 확인한 뒤 다시 시도하세요.',
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
