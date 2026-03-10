# JourneyForge In-App Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run generated Playwright and k6 bundles directly from the Electron app, with live log streaming and secure password storage.

**Architecture:** The core package keeps ownership of session analysis and bundle export. The desktop main process adds an execution service that exports a bundle on demand, resolves execution settings plus keychain credentials, spawns child processes one at a time, and streams execution snapshots to the renderer over IPC.

**Tech Stack:** Electron, React, TypeScript, Vitest, Node child_process, keytar, pnpm workspaces

---

### Task 1: Shared Types And Settings Shape

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/core/src/settings.test.ts`

**Step 1: Write the failing test**

Extend the settings and settings repository tests to expect execution defaults plus backward-compatible settings reads.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @journeyforge/core test -- src/settings.test.ts`
Expected: FAIL because execution settings defaults and settings normalization do not exist yet.

**Step 3: Write minimal implementation**

Add execution settings, credential status, execution snapshot types, and default execution values. Update settings reads so older JSON files are merged with defaults.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @journeyforge/core test -- src/settings.test.ts`
Expected: PASS.

### Task 2: Main-Process Execution Service

**Files:**
- Create: `apps/desktop/src/main/services/credentialService.ts`
- Create: `apps/desktop/src/main/services/executionService.ts`
- Create: `apps/desktop/src/main/services/executionBuilders.ts`
- Modify: `apps/desktop/src/main/services/journeyForgeDesktopService.ts`
- Test: `apps/desktop/src/main/services/executionService.test.ts`

**Step 1: Write the failing test**

Add node-environment tests for command building, missing credential errors, bootstrap ordering, duplicate execution rejection, and cancellation.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @journeyforge/desktop test -- src/main/services/executionService.test.ts`
Expected: FAIL because the execution service does not exist.

**Step 3: Write minimal implementation**

Create injected credential and process-runner services, build Playwright and k6 execution commands, enforce one active run, stream execution snapshots, and integrate bundle export plus settings lookup.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @journeyforge/desktop test -- src/main/services/executionService.test.ts`
Expected: PASS.

### Task 3: IPC, Preload, And Renderer Execution UX

**Files:**
- Modify: `apps/desktop/src/main/ipc/channels.ts`
- Create: `apps/desktop/src/main/ipc/execution.ipc.ts`
- Create: `apps/desktop/src/main/ipc/credentials.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/hooks/useSessions.ts`
- Create: `apps/desktop/src/renderer/hooks/useExecution.ts`
- Create: `apps/desktop/src/renderer/components/ExecutionPanel.tsx`
- Modify: `apps/desktop/src/renderer/components/FilePreviewTabs.tsx`
- Modify: `apps/desktop/src/renderer/pages/SessionDetailPage.tsx`
- Modify: `apps/desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `apps/desktop/src/renderer/app/App.tsx`
- Test: `apps/desktop/src/renderer/components/FilePreviewTabs.test.tsx`
- Test: `apps/desktop/src/renderer/pages/SettingsPage.test.tsx`
- Test: `apps/desktop/src/renderer/components/ExecutionPanel.test.tsx`

**Step 1: Write the failing test**

Describe the new run button visibility, live execution panel updates, and keychain controls in renderer tests.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @journeyforge/desktop test -- src/renderer/components/FilePreviewTabs.test.tsx src/renderer/pages/SettingsPage.test.tsx src/renderer/components/ExecutionPanel.test.tsx`
Expected: FAIL because the bridge and UI do not support execution yet.

**Step 3: Write minimal implementation**

Add execution and credential IPC, preload subscriptions, renderer hooks, the execution panel, run/cancel buttons, and settings fields for runtime email/base URLs and password actions.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @journeyforge/desktop test -- src/renderer/components/FilePreviewTabs.test.tsx src/renderer/pages/SettingsPage.test.tsx src/renderer/components/ExecutionPanel.test.tsx`
Expected: PASS.

### Task 4: Verification, Docs, And Release Hygiene

**Files:**
- Modify: `README.md`
- Modify: `apps/desktop/package.json`
- Test: `pnpm check-types`
- Test: `pnpm build`
- Test: `pnpm test`

**Step 1: Write the failing test**

Run the full verification suite after implementation changes land.

**Step 2: Run test to verify it fails**

Run: `pnpm build`
Expected: FAIL or surface missing imports/types until all runtime dependencies and docs updates are complete.

**Step 3: Write minimal implementation**

Add any missing dependency wiring such as `keytar`, update README manual execution steps, and tighten any remaining type or build issues.

**Step 4: Run test to verify it passes**

Run: `pnpm check-types && pnpm build && pnpm test`
Expected: PASS.
