import { DEFAULT_ANALYTICS_PATTERNS, STATIC_ASSET_EXTENSIONS } from './constants';
import type { LocatorDescriptor, MaskingDecision } from './types';

const PASSWORD_PATTERN = /(pass(word)?|pwd|pin|secret)/i;
const EMAIL_PATTERN = /email/i;
const TOKEN_HEADER_PATTERN = /^(authorization|cookie|set-cookie|x-api-key)$/i;
const SENSITIVE_QUERY_PATTERN = /(token|password|secret|session|auth)/i;

export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => !TOKEN_HEADER_PATTERN.test(name)),
  );

export const quoteForCode = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const maskInputValue = (input: {
  value: string;
  fieldName?: string;
  inputType?: string;
  maskEmails?: boolean;
}): MaskingDecision => {
  if (input.inputType === 'password' || PASSWORD_PATTERN.test(input.fieldName ?? '')) {
    return {
      value: '******',
      masked: true,
      reason: 'password',
    };
  }

  if (input.maskEmails && EMAIL_PATTERN.test(input.fieldName ?? '') && input.value.includes('@')) {
    const [name = '', domain = 'example.com'] = input.value.split('@');
    return {
      value: `${name.slice(0, 1)}***@${domain}`,
      masked: true,
      reason: 'email',
    };
  }

  return {
    value: input.value,
    masked: false,
  };
};

export const isStaticAssetUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return STATIC_ASSET_EXTENSIONS.some((extension) => parsed.pathname.toLowerCase().endsWith(extension));
  } catch {
    return false;
  }
};

export const isAnalyticsUrl = (url: string, patterns: string[] = [...DEFAULT_ANALYTICS_PATTERNS]): boolean =>
  patterns.some((pattern) => url.toLowerCase().includes(pattern.toLowerCase()));

export const safeQueryFromUrl = (url: string): Record<string, string> => {
  const parsed = new URL(url);
  const entries = [...parsed.searchParams.entries()].filter(([key]) => !SENSITIVE_QUERY_PATTERN.test(key));
  return Object.fromEntries(entries);
};

export const buildUrlWithSafeQuery = (url: string): string => {
  const parsed = new URL(url);
  const safeQuery = safeQueryFromUrl(url);
  const search = new URLSearchParams(safeQuery).toString();
  return search ? `${parsed.origin}${parsed.pathname}?${search}` : `${parsed.origin}${parsed.pathname}`;
};

export const buildPathWithSafeQuery = (url: string): string => {
  const parsed = new URL(url);
  const safeQuery = safeQueryFromUrl(url);
  const search = new URLSearchParams(safeQuery).toString();
  return search ? `${parsed.pathname}?${decodeURIComponent(search)}` : parsed.pathname;
};

export const buildEncodedPathWithSafeQuery = (url: string): string => {
  const parsed = new URL(url);
  const safeQuery = safeQueryFromUrl(url);
  const search = new URLSearchParams(safeQuery).toString();
  return search ? `${parsed.pathname}?${search}` : parsed.pathname;
};

export const normalizePathname = (url: string): string => new URL(url).pathname;

export const inferScenarioSlug = (method: string, path: string): string => {
  const pathname = (path.split('?')[0] ?? '').replace(/^\/api\//, '').replace(/^\/+/, '');
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments.at(-1);
  if (lastSegment && /^\d+$/.test(lastSegment) && segments.length > 1) {
    const parentSegment = segments[segments.length - 2] ?? '';
    segments[segments.length - 2] = parentSegment.replace(/s$/, '');
  }
  return slugify(`${method.toLowerCase()}-${segments.join('-')}`);
};

export const prettyPathLabel = (path: string): string => {
  const pathname = path.split('?')[0] ?? '';
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return 'home';
  }
  return trimmed
    .split('/')
    .map((segment) => segment.replace(/[-_]/g, ' '))
    .join(' ');
};

export const locatorToPlaywright = (locator: LocatorDescriptor): string => {
  switch (locator.strategy) {
    case 'label':
      return `page.getByLabel(${quoteForCode(locator.value)})`;
    case 'placeholder':
      return `page.getByPlaceholder(${quoteForCode(locator.value)})`;
    case 'text':
      return `page.getByText(${quoteForCode(locator.value)})`;
    case 'role': {
      const [role = 'button', name = ''] = locator.value.split(':');
      return `page.getByRole(${quoteForCode(role)}, { name: ${quoteForCode(name ?? '')} })`;
    }
    case 'css':
      return `page.locator(${quoteForCode(locator.value)})`;
  }
};
