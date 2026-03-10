# JourneyForge

JourneyForge turns a real browser journey into developer assets.

Record once, then generate:

- Playwright E2E tests
- API flow documentation
- k6 load test starters

## Workspace

- `apps/desktop`: Electron + React desktop shell
- `packages/shared`: shared domain types and utilities
- `packages/core`: recorder, normalizer, generators, JSON storage orchestration

## Commands

```bash
pnpm install
pnpm approve-builds
pnpm --filter @journeyforge/desktop exec node node_modules/electron/install.js
pnpm install:browsers
pnpm dev
pnpm demo-target
pnpm smoke
pnpm test
pnpm build
```

## MVP Notes

- Single Chromium recording session at a time
- JSON-first local persistence under `data/`
- One recording session produces one normalized journey
- Settings live in `data/settings.json`
- Saved settings apply to recordings that start after the save completes
- Playwright and k6 can be run directly from the desktop app after bundle export is prepared
- Runtime email and base URLs live in settings; the Playwright password lives in the OS keychain

## Demo Target

- `apps/demo-target` contains the in-repo verification target used by the real-browser smoke tests
- Start it manually with `pnpm demo-target`
- Supported happy paths are `login -> search -> detail`, `create post`, and `edit post`

## Native Runtime Setup

- `pnpm approve-builds` and approve `keytar` if pnpm reports blocked native build scripts
- `pnpm --filter @journeyforge/desktop exec node node_modules/electron/install.js` repairs a skipped Electron binary download in fresh worktrees
- If Playwright execution reports keychain load issues, rebuild native modules in the desktop package before retrying

## Real-Browser Verification

- `pnpm smoke` runs the real Chromium smoke test for `record -> normalize -> generate -> export`
- If Playwright browsers are not installed yet, run `pnpm install:browsers`
- The smoke target is intentionally minimal and exists only to validate JourneyForge itself

## Manual Validation Checklist

1. Run `pnpm demo-target`
2. In another terminal run `pnpm dev`
3. Open the Electron app and enter `http://127.0.0.1:4173/login`
4. Click `기록 시작`, then use the spawned Chromium window to log in, search `맥북`, and open `MacBook Pro 14`
5. Click `기록 종료`
6. Open `Settings` and set a Playwright test email, optional execution base URLs, and a Playwright password
7. Confirm the preview shows Playwright, Flow Markdown, and k6 artifacts
8. Use `실행 번들 내보내기` and confirm a bundle appears under `data/exports`
9. On the Playwright tab, click `Playwright 실행` and confirm the execution panel streams logs
10. On the k6 tab, click `k6 실행` and confirm the execution panel streams logs
11. Export at least one artifact and confirm a file appears under `data/exports`

## Current Limits

- Electron UI and in-app execution are still manually verified end-to-end; the desktop shell itself has no automated UI test suite yet
