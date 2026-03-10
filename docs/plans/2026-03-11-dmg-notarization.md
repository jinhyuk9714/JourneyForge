# DMG Notarization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the signed macOS release flow so `package:mac` notarizes and staples the generated DMG, allowing `notarize:mac:verify` to validate both the app bundle and the DMG.

**Architecture:** Keep `electron-builder` responsible for app signing and app notarization, then run a second `notarytool submit --wait` pass against the generated DMG from the existing desktop release scripts. Centralize the notarization argument construction in `macos-release-support.mjs` so packaging and verification share one source of truth.

**Tech Stack:** Node.js release scripts, electron-builder, Apple `notarytool`, `stapler`, `spctl`, Vitest.

---

### Task 1: Add failing release-helper tests

**Files:**
- Modify: `apps/desktop/src/main/services/macosReleaseSupport.test.ts`

**Steps:**
1. Add a failing test for keychain-profile DMG notarization steps.
2. Add a failing test for API key DMG notarization steps.
3. Add a failing test for Apple ID DMG notarization steps.
4. Keep the verification-step expectation aligned with stapled DMG validation.

### Task 2: Implement DMG notarization helpers

**Files:**
- Modify: `apps/desktop/scripts/macos-release-support.mjs`

**Steps:**
1. Export a helper that builds notarization submit args from the validated environment.
2. Export a helper that returns DMG notarization/staple steps.
3. Preserve existing environment validation and artifact discovery behavior.

### Task 3: Run the new helper from signed packaging

**Files:**
- Modify: `apps/desktop/scripts/package-mac-signed.mjs`

**Steps:**
1. Run electron-builder first.
2. Resolve the generated artifacts.
3. Execute DMG notarization and stapling steps after the build succeeds.

### Task 4: Refresh verification and docs

**Files:**
- Modify: `README.md`

**Steps:**
1. Update the signed release section to explain that `package:mac` now notarizes the DMG after the app build.
2. Tighten the manual release steps so `notarize:mac:verify` is described as a post-build validation pass.

### Task 5: Verify and ship

**Steps:**
1. Run targeted desktop tests for release helpers.
2. Run `pnpm check-types`, `pnpm build`, `pnpm test`.
3. Run `pnpm --filter @journeyforge/desktop test:package-smoke`.
4. If credentials are available, run `pnpm --filter @journeyforge/desktop package:mac` and `pnpm --filter @journeyforge/desktop notarize:mac:verify`.
5. Commit and push the branch.
