# JourneyForge MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first desktop MVP that records one browser journey and generates Playwright, flow markdown, and k6 starter artifacts.

**Architecture:** The desktop shell owns lifecycle and preview UX, while a shared core package handles recording, normalization, generation, storage, and export. Recorded sessions are persisted as JSON under `data/` and transformed immediately after recording stops into a single normalized journey plus generated artifacts.

**Tech Stack:** Electron, React, TypeScript, Vite, Tailwind CSS, Playwright, Vitest, pnpm workspaces, Turbo

---

### Task 1: Workspace Bootstrap

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `apps/desktop/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/core/package.json`

**Step 1: Write the failing test**

Write a root test command that fails because no package tests or sources exist yet.

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL because package sources and tests are missing.

**Step 3: Write minimal implementation**

Create the workspace manifests and TypeScript configs required for the monorepo skeleton.

**Step 4: Run test to verify it passes**

Run: `pnpm install && pnpm check-types`
Expected: TypeScript commands execute once package sources are added.

### Task 2: Shared Models and Core Pipeline

**Files:**
- Create: `packages/shared/src/**/*.ts`
- Create: `packages/core/src/**/*.ts`

**Step 1: Write the failing test**

Add tests for masking, filtering, normalization, and artifact generation.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @journeyforge/core test`
Expected: FAIL because the implementation does not exist.

**Step 3: Write minimal implementation**

Implement shared types/utilities and the recorder-normalizer-generator-storage pipeline.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @journeyforge/core test`
Expected: PASS with snapshot and unit coverage.

### Task 3: Desktop Shell and IPC

**Files:**
- Create: `apps/desktop/src/main/**/*.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/**/*.tsx`

**Step 1: Write the failing test**

Add renderer and service tests that describe recording state, session preview, and export interactions.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @journeyforge/desktop test`
Expected: FAIL because UI and IPC modules do not exist.

**Step 3: Write minimal implementation**

Create the Electron app shell, IPC handlers, preload bridge, and React UI for recording, session list, settings, preview, and export.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @journeyforge/desktop test`
Expected: PASS or `passWithNoTests` for non-critical shell code while core behavior remains tested.

### Task 4: Full Verification

**Files:**
- Modify: `README.md`
- Modify: `tests/fixtures/**`

**Step 1: Write the failing test**

Add or update a fixture-driven integration test that exercises `stopRecording` through JSON persistence and export.

**Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL until the end-to-end pipeline is complete.

**Step 3: Write minimal implementation**

Finish missing glue code, docs, and demo fixture data.

**Step 4: Run test to verify it passes**

Run: `pnpm test && pnpm check-types && pnpm build`
Expected: PASS for all commands.
