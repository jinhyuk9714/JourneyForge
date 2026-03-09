import type { JourneyForgeDesktopApi } from '../preload/index';

declare global {
  interface Window {
    journeyforge: JourneyForgeDesktopApi;
  }
}

export {};
