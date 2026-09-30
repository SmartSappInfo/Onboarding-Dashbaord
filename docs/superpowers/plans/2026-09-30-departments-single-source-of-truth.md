# Single Source of Truth (SSoT) for Departments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the canonical Firestore `departments` collection as the single source of truth (SSoT) for departments across all features (Users Hub, Regional Settings, Onboarding Profile Setup, Invitations, User Drawers, Projections, and Bulk Actions).

**Architecture:** Route all department reads and writes through `DepartmentService` and `workforce-actions`. Unify the legacy `organization.departments: string[]` as a synchronized downstream projection of the canonical `departments` collection. Update `/profile-setup`, `InviteUserModal`, `PersonProfileDrawer`, and `OrganizationRegionalTab` to consume canonical `{ id, name, code }` departments, guaranteeing both `departmentId` and `departmentName` are synchronized across `Person`, `OrganizationMembership`, and `UserProfile`.

**Tech Stack:** Next.js (App Router), TypeScript, Firebase Firestore & Admin SDK, Vitest.

---

### Task 1: Enhance `DepartmentService` with Synchronization & Resolution Helpers

**Files:**
- Modify: `src/lib/services/workforce/department-service.ts`
- Test: `src/lib/services/workforce/__tests__/department-ssot.test.ts`

- [ ] **Step 1: Write the failing tests for Department SSoT service helpers**
  Verify `getCanonicalDepartmentsForOrganization`, `findOrCreateDepartmentByName`, and projection sync on `organizations/{orgId}.departments`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/lib/services/workforce/__tests__/department-ssot.test.ts`
  Expected: FAIL with missing methods.

- [ ] **Step 3: Implement SSoT methods in `DepartmentService`**
  - Implement `syncOrganizationDepartmentsProjection(organizationId: string)`: queries `departments` for `organizationId` and updates `organizations/{orgId}.departments` with the current list of department names.
  - Call `syncOrganizationDepartmentsProjection` in `createDepartment`, `updateDepartment`, and `deleteDepartment`.
  - Implement `getCanonicalDepartmentsForOrganization(organizationId: string)`: queries `departments`. If 0 exist, auto-invokes `DepartmentSeedService.seedDepartmentsForOrganization(organizationId)`.
  - Implement `findOrCreateDepartmentByName(organizationId: string, name: string)`: finds existing department case-insensitively or creates a new one in the canonical collection.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/lib/services/workforce/__tests__/department-ssot.test.ts`
  Expected: PASS.

---

### Task 2: Update Server Actions for Onboarding and Workforce

**Files:**
- Modify: `src/app/actions/onboarding-actions.ts`
- Modify: `src/lib/user-invite-actions.ts`
- Modify: `src/app/actions/workforce-actions.ts`
- Modify: `src/lib/organization-actions.ts`
- Test: `src/lib/__tests__/onboarding-actions.test.ts`

- [ ] **Step 1: Update `validateJoinCodeAction` in `src/app/actions/onboarding-actions.ts`**
  Fetch canonical departments using `DepartmentService.getCanonicalDepartmentsForOrganization(orgId)`. Return both `departments: string[]` (for backwards compatibility) and `canonicalDepartments: Array<{ id: string; name: string; code: string }>`.

- [ ] **Step 2: Update `submitOnboardingProfileAction` in `src/app/actions/onboarding-actions.ts`**
  Accept `departmentId?: string` alongside `department?: string`. Resolve missing counterpart via `DepartmentService`. Save both `department` and `departmentId` on `users/{uid}`, `Person`, and `OrganizationMembership`.

- [ ] **Step 3: Update `inviteUserAction` in `src/lib/user-invite-actions.ts`**
  Accept `departmentId?: string` and resolve canonical department. Save both `department` and `departmentId` on `users/{uid}`, `Person`, and `OrganizationMembership`.

- [ ] **Step 4: Update `provisionOrganizationDefaults` in `src/lib/organization-actions.ts`**
  Call `DepartmentSeedService.seedDepartmentsForOrganization(slug, 'General')` when an organization is created.

- [ ] **Step 5: Run existing onboarding & workforce tests**
  Run: `pnpm vitest run src/lib/__tests__/onboarding-actions.test.ts` and `pnpm vitest run src/lib/services/workforce/__tests__/invite-user-actions.test.ts`
  Expected: PASS.

---

### Task 3: Sync Identity Projection, Migration, and Bulk Services

**Files:**
- Modify: `src/lib/services/identity/identity-projection-service.ts`
- Modify: `src/lib/services/identity/identity-migration-service.ts`
- Modify: `src/lib/services/workforce/bulk-workforce-service.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update `UserProfile` in `src/lib/types.ts`**
  Add `departmentId?: string` to `UserProfile`.

- [ ] **Step 2: Update `identity-projection-service.ts`**
  In `syncUserProjection`, resolve `departmentName` from `departmentId` if missing, or `departmentId` from `departmentName` if missing. Project both `department: departmentName` and `departmentId` onto `UserProfile`.

- [ ] **Step 3: Update `identity-migration-service.ts`**
  In `migrateSingleUserProfile`, resolve `departmentId` from canonical `departments` collection when decomposing legacy `user.department`.

- [ ] **Step 4: Update `bulk-workforce-service.ts`**
  In `assign_department`, resolve `departmentName` from `departmentId` (or vice-versa), update both `Person` and `OrganizationMembership`, and recalculate member count.

- [ ] **Step 5: Run typecheck**
  Run: `pnpm typecheck`
  Expected: PASS.

---

### Task 4: Harmonize Regional Settings (`OrganizationRegionalTab.tsx` & `OrganizationManagementDialog.tsx`)

**Files:**
- Modify: `src/app/admin/settings/components/OrganizationRegionalTab.tsx`
- Modify: `src/app/admin/components/OrganizationManagementDialog.tsx`

- [ ] **Step 1: Connect `OrganizationRegionalTab.tsx` to canonical `DepartmentService`**
  - Load canonical departments for the organization using `listDepartmentsAction` or query.
  - Adding a department creates a canonical `Department` doc via `createOrUpdateDepartmentAction`.
  - Deleting a department deletes via `deleteDepartmentAction` (with active member guard).
  - Display code badge, e.g. `[ACCT] Client Accounts & Strategy`, member count badge, and a direct link to `Users Hub -> Teams & Departments`.
  - Keep `organization.departments` projection in sync.

- [ ] **Step 2: Harmonize `OrganizationManagementDialog.tsx`**
  - Use `DepartmentService` / canonical departments list instead of standalone strings.

---

### Task 5: Harmonize Onboarding UI & User Modals (`/profile-setup`, `InviteUserModal`, `PersonProfileDrawer`)

**Files:**
- Modify: `src/app/profile-setup/page.tsx`
- Modify: `src/app/admin/users/components/InviteUserModal.tsx`
- Modify: `src/app/admin/users/components/PersonProfileDrawer.tsx`
- Modify: `src/app/admin/users/UsersClient.tsx`

- [ ] **Step 1: Update `src/app/profile-setup/page.tsx`**
  - Bind to canonical departments (`{ id, name, code }`).
  - Render department options with name and code badge.
  - Submit both `department` (name) and `departmentId` to `submitOnboardingProfileAction`.

- [ ] **Step 2: Update `src/app/admin/users/components/InviteUserModal.tsx`**
  - Update `departments` prop to accept `Department[]` or `{ id: string; name: string; code?: string }[]`.
  - Render canonical departments in select dropdown.
  - Submit `department` name and `departmentId`.

- [ ] **Step 3: Update `src/app/admin/users/components/PersonProfileDrawer.tsx`**
  - Accept `departments?: Department[]` prop.
  - Replace the free-form text `<Input>` with a `<Select>` of canonical departments with code and name.
  - Save both `departmentId` and `departmentName` on submit.

- [ ] **Step 4: Update `src/app/admin/users/UsersClient.tsx`**
  - Pass `canonicalDepartments` to `PersonProfileDrawer` and `InviteUserModal`.

---

### Task 6: End-to-End Verification & Linting

**Files:**
- Run: `pnpm typecheck`
- Run: `pnpm lint`
- Run: unit and integration tests

- [ ] **Step 1: Verify TypeScript compilation**
  Run: `pnpm typecheck`
  Expected: 0 errors.

- [ ] **Step 2: Verify ESLint**
  Run: `pnpm lint`
  Expected: PASS within warning limits.

- [ ] **Step 3: Run full suite of relevant tests**
  Run: `pnpm vitest run src/lib/__tests__/onboarding-actions.test.ts src/lib/services/workforce/__tests__/`
  Expected: All tests pass.
