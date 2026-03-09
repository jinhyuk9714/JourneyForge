import type { JourneyForgeSettings } from './types';

export const STATIC_ASSET_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp',
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.ico',
  '.map',
  '.mp4',
  '.webm',
] as const;

export const DEFAULT_ANALYTICS_PATTERNS = [
  'google-analytics',
  'googletagmanager',
  'mixpanel',
  'amplitude',
  'segment',
  'sentry',
  'fullstory',
] as const;

export const DEFAULT_SETTINGS: JourneyForgeSettings = {
  analyticsPatterns: [...DEFAULT_ANALYTICS_PATTERNS],
  maskEmailInputs: true,
  k6Thresholds: {
    httpReqDurationP95: 500,
    httpReqFailedRate: 0.01,
  },
};
