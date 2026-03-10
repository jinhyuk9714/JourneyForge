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

## Demo Target

- `apps/demo-target` contains the in-repo verification target used by the real-browser smoke tests
- Start it manually with `pnpm demo-target`
- The happy path is fixed to `login -> search -> detail`

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
6. Confirm the preview shows Playwright, Flow Markdown, and k6 artifacts
7. Export at least one artifact and confirm a file appears under `data/exports`

## Current Limits

- Electron UI is still manually verified; this milestone does not automate the desktop shell itself
