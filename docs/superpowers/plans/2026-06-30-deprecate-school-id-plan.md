# Deprecate School ID and Fix Test Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up obsolete legacy `schoolId` migration/rollback tests and scripts, fix denormalization consistency property tests, and fix settings unit tests with strong typing and no `any`.

**Architecture:** We will delete obsolete migration/rollback test files, modify the settings actions/tests to remove legacy backward compatibility paths, and fix mocked environment issues in denormalization tests. All code will be strictly typed, avoiding `any` or `any[]` in favor of precise type signatures.

**Tech Stack:** TypeScript, Vitest, Firebase Admin SDK.

---

## What Could Go Wrong & Resolutions

1. **Broken Imports or References:** Other tests or files might import helpers from deleted migration test files or legacy migration code.
   - *Resolution:* Before deleting, we will verify imports and compilation.
2. **Missing `entityType` Defaults:** Removing obsolete legacy fields could lead to `undefined` runtime settings values if not defaulted.
   - *Resolution:* Default `entityType` to `'institution'` when loading settings where it is missing, and type it explicitly.
3. **Emulator Connectivity:** Security rules tests require the Firestore Emulator which won't run locally if JDK 21 is missing.
   - *Resolution:* These security rules tests themselves are untouched and correct; they are excluded from local non-emulator test runs to prevent false failures.

---

## Affected Features & Mitigation

- **Settings Module:** `schoolId` support is entirely removed. Settings are loaded and updated strictly via `entityId`.
- **Denormalization Invariant:** The consistency tests require proper permission mock bypassing since permissions check `users` and `roles`. Passing a `system-` prefixed user ID resolves this cleanly.

---

### Task 1: Clean Up Obsolete Migration Test Files

We will remove all tests verifying the deprecated `schoolId` to `entityId` migration and rollback engine.

**Files:**
- [DELETE] [migration-backup-creation.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-backup-creation.property.test.ts)
- [DELETE] [migration-engine.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-engine.test.ts)
- [DELETE] [migration-enrich-restore.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-enrich-restore.test.ts)
- [DELETE] [migration-enrichment-idempotency.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-enrichment-idempotency.property.test.ts)
- [DELETE] [migration-fetch-accuracy.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-fetch-accuracy.property.test.ts)
- [DELETE] [migration-fetch-operations.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-fetch-operations.test.ts)
- [DELETE] [migration-field-preservation.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-field-preservation.property.test.ts)
- [DELETE] [migration-rollback-cleanup.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-rollback-cleanup.property.test.ts)
- [DELETE] [migration-rollback-idempotency.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-rollback-idempotency.property.test.ts)
- [DELETE] [migration-rollback-operation.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-rollback-operation.test.ts)
- [DELETE] [migration-rollback-restoration.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-rollback-restoration.property.test.ts)
- [DELETE] [migration-rollback.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-rollback.property.test.ts)
- [DELETE] [migration-verification-completeness.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-verification-completeness.property.test.ts)
- [DELETE] [migration-verification-validation.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-verification-validation.property.test.ts)
- [DELETE] [migration-verify-operation.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/migration-verify-operation.test.ts)
- [DELETE] [task-41-5-migration-logic.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/task-41-5-migration-logic.test.ts)

- [ ] **Step 1: Check references in codebase**
  Verify that none of the target test files are imported elsewhere in test utilities.
- [ ] **Step 2: Delete the obsolete test files**
  Delete all 16 obsolete test files listed above.

---

### Task 2: Fix Denormalization Consistency Property Tests

We will bypass permission checks in denormalization property tests to avoid mock errors on unmocked collections.

**Files:**
- [MODIFY] [denormalization-consistency.property.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/denormalization-consistency.property.test.ts)

- [ ] **Step 1: Update `testUserId` to bypass permissions**
  Modify `testUserId` on line 152 to start with `'system-'` so that `updateEntityAction` skips the `canUser` check:
  ```typescript
  const testUserId = 'system-test-user-denorm';
  ```
- [ ] **Step 2: Clean duplicate keys in test file**
  Remove duplicated keys `entityContacts` and `entityType` in the mock objects in `denormalization-consistency.property.test.ts`.

---

### Task 3: Refactor Settings Actions and Defaulting

Ensure settings actions default `entityType` to `'institution'` when loading if missing, and maintain strict types.

**Files:**
- [MODIFY] [settings-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/settings-actions.ts)

- [ ] **Step 1: Default `entityType` on load**
  Modify `loadSettings` in `src/lib/settings-actions.ts`:
  ```typescript
  const data = snapshot.docs[0].data() as EntitySettings;
  const settings: EntitySettings = {
    ...data,
    entityType: data.entityType || 'institution',
  };
  return { success: true, settings };
  ```
- [ ] **Step 2: Verify no `any` is used**
  Strictly avoid `any` in modifications. Use proper types from `src/lib/types.ts`.

---

### Task 4: Fix Settings Unit Tests

Remove obsolete legacy compatibility tests and restore proper assertions to settings unit tests.

**Files:**
- [MODIFY] [settings-module-unit.test.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/__tests__/settings-module-unit.test.ts)

- [ ] **Step 1: Remove obsolete backward compatibility tests**
  Delete:
  - `describe('Settings Load with entityId (Backward Compatibility)', ...)`
  - `describe('Settings Update with entityId (Backward Compatibility)', ...)`
  - Legacy creation tests: `should create settings with entityId for legacy compatibility` and `should create settings with both identifiers (dual-write)`.
- [ ] **Step 2: Fix corrupted assertions and mocks**
  - In `should load settings using entityId` test, restore mock data to have `entityType: 'institution'`.
  - In `should update display preferences while preserving entityId` test, restore `existingSettings` to have `entityId: 'entity_789'`.
  - In `should create settings with entityId` test, correct the assertion to expect `entityId: 'entity_456'` (instead of `entityId: null`).
