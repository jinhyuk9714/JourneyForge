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
- The signed packaging flow notarizes the app through `electron-builder`, then submits the generated DMG to `notarytool` and staples it before returning
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

### Keychain Credential Loop

The dev-runtime keychain loop was manually validated on March 11, 2026.

1. Run `pnpm dev`
2. Open `Settings`
3. Enter a Playwright password and click `비밀번호 저장/교체`
4. Confirm the status changes to `Playwright password configured`
5. Enter a different password and click `비밀번호 저장/교체` again
6. Quit and relaunch the app, then confirm the configured status still matches the macOS keychain item
7. Click `비밀번호 삭제`
8. Confirm the status changes to `Playwright password not configured`
9. Quit and relaunch the app again, then confirm the cleared status still matches the macOS keychain item

### Packaged App Keychain Loop

The packaged-app keychain loop was manually validated on March 11, 2026.

1. Run `pnpm --filter @journeyforge/desktop package:mac:unsigned` for a fast local package or `pnpm --filter @journeyforge/desktop package:mac` for the signed release path
2. Launch the packaged `.app`
3. Repeat the same save, replace, delete, and relaunch loop from the `Settings` screen
4. Confirm the credential status stays in sync with the macOS keychain across packaged app restarts

### Signed Release Validation

1. Export signing and notarization credentials
2. Run `pnpm --filter @journeyforge/desktop package:mac`
3. Confirm `.dmg` and `.zip` artifacts are produced under `apps/desktop/release`
4. Run `pnpm --filter @journeyforge/desktop notarize:mac:verify`
5. Confirm the signed/notarized `.app` and stapled `.dmg` pass `codesign`, `stapler`, and `spctl`

## Current Limits

- Signed/notarized macOS releases are still produced manually on a developer Mac; CI release automation is not wired yet
