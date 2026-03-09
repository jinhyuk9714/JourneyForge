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
pnpm dev
pnpm test
pnpm build
```

## MVP Notes

- Single Chromium recording session at a time
- JSON-first local persistence under `data/`
- One recording session produces one normalized journey
