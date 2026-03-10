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
pnpm --filter @journeyforge/desktop test:e2e
pnpm --filter @journeyforge/desktop test:smoke-real
pnpm --filter @journeyforge/desktop test:smoke-execution-real
pnpm --filter @journeyforge/desktop test:package-smoke
pnpm --filter @journeyforge/desktop test:package-smoke:signed
pnpm --filter @journeyforge/desktop package:mac
pnpm --filter @journeyforge/desktop notarize:mac:verify
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

## Signed macOS Release

- `pnpm --filter @journeyforge/desktop package:mac` is now the signed release path and emits a signed `.dmg` and `.zip` under `apps/desktop/release`
- `pnpm --filter @journeyforge/desktop package:mac:unsigned` and `pnpm --filter @journeyforge/desktop package:mac:dir:unsigned` remain available as developer-only fallbacks
- `pnpm --filter @journeyforge/desktop notarize:mac:verify` runs `codesign`, `stapler`, `spctl`, and the packaged startup smoke against the signed artifacts
- Export these variables before building a signed release:
  - signing: `CSC_NAME` or `CSC_LINK`
  - notarization via App Store Connect API key: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  - notarization via Apple ID: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  - notarization via keychain profile: `APPLE_KEYCHAIN_PROFILE` with optional `APPLE_KEYCHAIN`
- Add the Developer ID certificate to your login keychain before packaging. `security find-identity -v -p codesigning` should show a `Developer ID Application` identity.
- `pnpm --filter @journeyforge/desktop test:package-smoke` still uses an unsigned unpacked `.app` for fast local packaged-startup coverage
- The packaged app keeps the same `data/` subdirectory layout, but stores it under Electron `userData` instead of the repo root
- `settings.json`, session data, and exports appear there after the first settings/session interaction
- Playwright, k6, and keychain behavior still depend on the local machine toolchain and macOS keychain

## Real-Browser Verification

- `pnpm smoke` runs the real Chromium smoke test for `record -> normalize -> generate -> export`
- If Playwright browsers are not installed yet, run `pnpm install:browsers`
- The smoke target is intentionally minimal and exists only to validate JourneyForge itself

## Desktop UI Automation

- `pnpm --filter @journeyforge/desktop test:e2e` launches the built Electron app with a fake runtime and verifies the shell UI end-to-end
- Covered scenarios are `default`, `legacy`, and `cancel-execution`
- The suite validates recording state transitions, preview rendering, explainability cards, artifact/bundle export messaging, and in-app execution logs

## Real Desktop Smoke

- `pnpm --filter @journeyforge/desktop test:smoke-real` launches the built Electron app against the real desktop runtime
- The suite drives recording through a test-only autopilot in headless Chromium and verifies `record -> normalize -> generate -> preview -> export`
- Covered scenarios are `login-search-detail` and `create-post`

## Real Local Execution Smoke

- `pnpm --filter @journeyforge/desktop test:smoke-execution-real` launches the built Electron app against the real execution service
- The suite records the `login -> search -> detail` flow, then runs the generated Playwright and k6 bundles from inside Electron
- `k6` must already be installed and available on your local `PATH`

## Packaged App Smoke

- `pnpm --filter @journeyforge/desktop test:package-smoke` launches the release `.app` executable instead of the built Electron entrypoint
- The suite verifies packaged renderer/main/preload bootstrap and confirms packaged persistence under Electron `userData/data`

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
12. Save, replace, and clear the Playwright password from `Settings`
13. Restart the app and confirm the credential status still matches the OS keychain state
14. Export signing and notarization credentials, run `pnpm --filter @journeyforge/desktop package:mac`, then run `pnpm --filter @journeyforge/desktop notarize:mac:verify`
15. Confirm `.dmg` and `.zip` artifacts are produced under `apps/desktop/release`

## Current Limits

- OS keychain-backed credential flow is still manually validated on a developer machine
