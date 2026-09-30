# Comprehensive Roles & Permissions Settings Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Roles & Permissions system across the entire application to achieve 100% feature parity with the sidebar navigation, adding all missing tools in Studios, Operations, Management, and introducing dedicated sections for Social Hub and Workspace & Users, with strict typing (zero `any`), backward compatibility, and backoffice governance.

**Architecture:** Upgrade `PermissionsSchema` from 4 sections to 6 canonical sections matching the 6 sidebar navigation groups 1:1 (`Operations`, `Studios`, `Finance Hub`, `Social Hub`, `Workspace and Users`, `Management`). Implement robust normalization with deep fallback defaults in `normalizePermissionsSchema`, update `CANONICAL_PERMISSIONS_CATALOG` with all 52 fine-grained platform capabilities, update `AdminSidebar.tsx` and `route-permissions.ts`, and provide Backoffice template propagation support.

**Tech Stack:** Next.js 15 (Turbopack, App Router), React 19, TypeScript (strict), Zod, Tailwind CSS, Lucide React, Firebase Admin / Firestore.

---

## 1. Executive Summary & Problem Inventory

### Visual Discrepancy Analysis (From Screenshots)
- **Studios (Screenshot 1)**: 13 sidebar tools vs 8 tools in permissions. Missing: *Landing Pages*, *Flipbook Studio*, *Thumbnail Studio*, *Surveys*, and *Doc Signing*.
- **Operations (Screenshot 2)**: 11 sidebar tools vs 8 in permissions. Missing as distinct controllable features: *Lead Intelligence*, *Sales Effort*, and *Knowledge Graph*.
- **Social Hub (Screenshot 3)**: 5 sidebar tools (*Dashboard*, *Composer*, *Calendar*, *Social Inbox*, *Connected Profiles*) with **zero representation** in the Roles & Permissions settings.
- **Management (Screenshot 4)**: 10 sidebar tools vs 3 in permissions (*Team Members*, *Custom Fields*, *System Settings*). Missing: *Activities Log*, *AI Prompts*, *Effort Rules*, *Developer API*, *Webhooks*.
- **Workspace & Users (Screenshot 5)**: 9 sidebar tools (*User Intelligence*, *Users Hub*, *Onboarding Journeys*, *AI Command Center*, *AI Workforce Advisor*, *Governance & Security*, *CRM Workload & Transfer*, *Enterprise SSO & SCIM*, *Roles & Permissions*). Missing dedicated section; features are either locked to Super Admin (`isSystemAdmin`) or bundled under generic users access.

---

## 2. Failure Modes & Mitigation Matrix (What Could Go Wrong)

| Failure Mode | Risk Level | Root Cause | Preventive Architecture & Mitigation |
| :--- | :---: | :--- | :--- |
| **FM-RBAC-01: Legacy Role Deserialization Crash** | Critical | Existing Firestore roles only have 4 sections (`operations`, `finance`, `studios`, `management`). Reading `schema.social.enabled` or `schema.workforce.features` will throw `TypeError: Cannot read properties of undefined`. | `normalizePermissionsSchema()` in `src/lib/permissions-engine.ts` must deep-clone and initialize all 6 sections with `{ enabled: false, features: {} }` if missing. `evaluatePermission()` must safely return `false` on missing sections without throwing. |
| **FM-RBAC-02: Existing User Lockout on Workspace Switch** | High | `route-permissions.ts` validates access when switching workspaces. If new routes are strictly enforced before roles are updated, users land on Access Denied dialogs. | `normalizePermissionsSchema()` and `migrateToPermissionsSchema()` dynamically mirror legacy permissions: e.g. `studios.media.view: true` automatically grants `flipbooks.view` and `thumbnails.view`; `management.users.view: true` automatically grants `workforce.users.view`. |
| **FM-RBAC-03: Privilege Escalation on Custom Roles** | Critical | A workspace admin creates a custom role granting `workforce.governance.edit` or `management.developerApi.edit`. | Privilege ceiling validation in `createOrUpdateRoleAction`: Non-super-admins cannot assign capabilities with `riskLevel: 'critical'` or governance tokens unless they themselves hold system admin rights. |
| **FM-RBAC-04: Client-Side Re-render Loops & Matrix Lag** | Medium | Rendering 52 feature cards with ~200 checkboxes in `PermissionExplorerMatrix.tsx` causes frame drops. | Memoize filtered feature lists with `React.useMemo`, debounce search inputs by 150ms, and maintain stable callback references. |
| **FM-RBAC-05: Mobile Viewport & Touch Target Clipping** | Medium | 6 sections with dozens of cards creates massive vertical scroll on smartphones. | Enforce `min-h-[44px]` touch targets, `active:scale-[0.97]` micro-interactions, responsive 1-column mobile reflow, and collapsible accordion groups for each section. |
| **FM-RBAC-06: Backoffice Template Synchronization Mismatch** | High | Backoffice `role_architecture` templates push outdated 4-section schemas to client workspaces, wiping newly configured sections. | Update `CANONICAL_ROLE_BLUEPRINTS` in `role-blueprint-presets.ts` and add Backoffice template propagation support to always serialize normalized 6-section schemas. |

---

## 3. Backoffice Impact & Enhancements (Managing Without Code)

### How This Affects the Backoffice
1. **Platform Templates (`/backoffice/templates`)**:
   - Backoffice templates of type `role_architecture` (e.g. Universal Super Admin, SaaS Sales Executive, School Admissions Officer) are stored in Firestore and propagated to customer workspaces.
   - Updating the canonical schema ensures that Backoffice operators preview and edit all 52 platform features when building role templates.
2. **Backoffice Operations & Diagnostics (`/backoffice/operations`)**:
   - Backoffice includes maintenance FERs (Fix Everything Runners) such as `FixOrgAdminPermissionsFer.tsx`.
   - We will enhance Backoffice with a **"Role Schema Normalizer & Permissions Sync FER"**:
     - Scans all organization roles in Firestore.
     - Runs `normalizePermissionsSchema()`.
     - Automatically backfills `social` and `workforce` sections for legacy roles with zero downtime.
     - Enables platform administrators to repair, synchronize, and update permissions across all client workspaces from the UI **without touching application code**.

---

## 4. Complete 6-Section Canonical Inventory (52 Features)

### 1. Operations (`operations`) — 11 Features
1. `dashboard`: Dashboard (`view, edit`)
2. `campuses`: Campuses / Entities (`view, create, edit, delete`)
3. `leadIntelligence`: Lead Intelligence (`view`)
4. `pipeline`: Pipeline & Deals (`view, create, edit, delete`)
5. `tasks`: Daily Tasks (`view, create, edit, delete`)
6. `meetings`: Meetings & Zoom (`view, create, edit, delete`)
7. `automations`: Automations (`view, create, edit, delete`)
8. `intelligence`: Intelligence Reports (`view`)
9. `salesEffort`: Sales Effort Analytics (`view`)
10. `quickNotes`: Company Brain (`view, create, edit, delete`)
11. `knowledgeGraph`: Knowledge Graph (`view`)

### 2. Studios (`studios`) — 13 Features
1. `publicPortals`: Public Portals (`view, create, edit, delete`)
2. `landingPages`: Landing Pages (`view, create, edit, delete`)
3. `media`: Media Library (`view, create, edit, delete`)
4. `flipbooks`: Flipbook Studio (`view, create, edit, delete`)
5. `thumbnails`: Thumbnail Studio (`view, create, edit, delete`)
6. `surveys`: Surveys (`view, create, edit, delete`)
7. `docSigning`: Doc Signing (PDFs) (`view, create, edit, delete`)
8. `messaging`: Messaging Studio (`view, create, edit, delete`)
9. `callCentre`: Call Centre (`view, create, edit, delete`)
10. `forms`: Form Studio (`view, create, edit, delete`)
11. `tags`: Workspace Tags (`view, create, edit, delete`)
12. `qrStudio`: QR Code Studio (`view, create, edit, delete`)
13. `verifyStudio`: Verification Studio (`view, create, edit, delete`)

### 3. Finance Hub (`finance`) — 5 Features
1. `agreements`: Agreements & Contracts (`view, create, edit, delete`)
2. `invoices`: Invoices & Billing (`view, create, edit, delete`)
3. `packages`: Pricing Packages (`view, create, edit, delete`)
4. `cycles`: Billing Cycles (`view, create, edit, delete`)
5. `billingSetup`: Payment Gateways (`view, edit`)

### 4. Social Hub (`social`) — 5 Features (New Section)
1. `dashboard`: Social Dashboard (`view`)
2. `composer`: Social Composer (`view, create, edit, delete`)
3. `calendar`: Content Calendar (`view, create, edit`)
4. `inbox`: Social Inbox (`view, create, edit, delete`)
5. `accounts`: Connected Profiles (`view, create, edit, delete`)

### 5. Workspace & Users (`workforce`) — 9 Features (New Section)
1. `intelligence`: User Intelligence (`view`)
2. `users`: Users Hub / Directory (`view, create, edit, delete`)
3. `onboarding`: Onboarding Journeys (`view, create, edit, delete`)
4. `commandCenter`: AI Command Center (`view, edit`)
5. `advisor`: AI Workforce Advisor (`view, edit`)
6. `governance`: Governance & Security (`view, edit`)
7. `crmWorkload`: CRM Workload & Transfer (`view, edit`)
8. `enterpriseIdentity`: Enterprise SSO & SCIM (`view, edit`)
9. `roles`: Roles & Permissions (`view, edit`)

### 6. Management (`management`) — 9 Features
1. `activities`: Audit Activities Log (`view`)
2. `leadScores`: Lead Scoring Rules (`view, edit`)
3. `messagingSettings`: Invitation Messaging (`view, edit`)
4. `fields`: Custom Fields & Variables (`view, create, edit, delete`)
5. `aiPrompts`: AI System Prompts (`view, create, edit, delete`)
6. `effortRules`: Sales Effort Rules (`view, edit`)
7. `systemSettings`: System & Branding (`view, edit`)
8. `developerApi`: Developer API & Keys (`view, edit`)
9. `webhooks`: Webhooks & Integrations (`view, create, edit, delete`)

---

## 5. Trackable Implementation Tasks

### Task 1: Domain Schemas, Type Definitions & Canonical Catalog
**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/services/authorization/permission-registry-service.ts`
- Test: `src/lib/__tests__/permissions.test.ts`

- [ ] **Step 1: Write unit tests verifying all 6 sections and 52 canonical features**
  Verify that `PermissionsSchema` accepts `social` and `workforce` sections and that `CANONICAL_PERMISSIONS_CATALOG` contains all 52 definitions with valid risk levels.
- [ ] **Step 2: Update `PermissionsSchema` in `src/lib/types.ts`**
  Add `social?: SectionPermissions` and `workforce?: SectionPermissions` to `PermissionsSchema`. Ensure all properties are strictly typed with zero `any`.
- [ ] **Step 3: Update `CANONICAL_PERMISSIONS_CATALOG` in `permission-registry-service.ts`**
  Add definitions for all missing capabilities (Landing Pages, Flipbooks, Thumbnails, Surveys, Doc Signing, Lead Intelligence, Sales Effort, Knowledge Graph, Social Hub suite, Workforce suite, Management suite).
- [ ] **Step 4: Run unit tests and verify they pass**
  Run: `pnpm test:run src/lib/__tests__/permissions.test.ts`
- [ ] **Step 5: Commit changes locally**
  `git commit -m "feat(rbac): extend permissions schema to 6 sections and register canonical catalog"`

---

### Task 2: Permissions Engine Normalization, DAG Dependencies & Presets
**Files:**
- Modify: `src/lib/permissions-engine.ts`
- Modify: `src/lib/role-blueprint-presets.ts`
- Test: `src/lib/__tests__/permissions-engine.test.ts`
- Test: `src/lib/__tests__/role-templates-qa.test.ts`

- [ ] **Step 1: Write test for legacy role schema normalization with backfill**
  Test that a legacy 4-section schema automatically backfills `social` and `workforce` sections with correct defaults.
- [ ] **Step 2: Update `normalizePermissionsSchema` and engine helpers**
  - Update `getBlankPermissions()`, `getFullAdminPermissions()`, `normalizePermissionsSchema()`, `flattenPermissionsSchema()`, `mergePermissionsSchemas()`, and `migrateToPermissionsSchema()` in `src/lib/permissions-engine.ts`.
  - Maintain backward compatibility: map legacy `studios.socialIntelligence` to `social.dashboard` and `management.users` to `workforce.users`.
- [ ] **Step 3: Update `role-blueprint-presets.ts`**
  Update all 22 industry role blueprints (Universal, SaaS, School, Marketing, Law, Real Estate, Consultancy) to provide sensible defaults for the new features.
- [ ] **Step 4: Run tests to verify zero regressions**
  Run: `pnpm test:run src/lib/__tests__/permissions-engine.test.ts src/lib/__tests__/role-templates-qa.test.ts`
- [ ] **Step 5: Commit changes locally**
  `git commit -m "feat(rbac): upgrade permissions engine normalization and 22 role blueprint presets"`

---

### Task 3: Roles & Permissions Visual Editor Upgrade
**Files:**
- Modify: `src/app/admin/users/roles/PermissionEditor.tsx`
- Modify: `src/app/admin/users/roles/components/PermissionExplorerMatrix.tsx`
- Modify: `src/app/admin/users/roles/components/AccessSimulatorSheet.tsx`

- [ ] **Step 1: Update `SECTIONS` and `SECTION_FEATURES` in `PermissionEditor.tsx`**
  - Define all 6 section cards with concise everyday UI descriptions.
  - Populate all 52 features across the 6 sections.
  - Ensure DAG cascades (`create`/`edit`/`delete` auto-activating `view`) work smoothly across all newly added features.
  - Enforce touch targets >= 44px on mobile and active scale micro-interactions (`active:scale-[0.97]`).
- [ ] **Step 2: Update `PermissionExplorerMatrix.tsx`**
  Add tabs for `Social Hub` and `Workspace and Users`. Update search filtering to query across all 52 features.
- [ ] **Step 3: Update `AccessSimulatorSheet.tsx`**
  Verify simulator resolves all 52 capabilities against simulated user roles.
- [ ] **Step 4: Commit changes locally**
  `git commit -m "feat(rbac): upgrade permission editor and matrix to render all 6 sections and 52 tools"`

---

### Task 4: Route Permissions & Sidebar Navigation Alignment
**Files:**
- Modify: `src/lib/route-permissions.ts`
- Modify: `src/app/admin/components/AdminSidebar.tsx`
- Modify: `src/hooks/use-permissions.ts`

- [ ] **Step 1: Update `ROUTE_PERMISSION_MAP` in `src/lib/route-permissions.ts`**
  Register routes for all 52 features so workspace switching and access pre-validation work seamlessly without unhandled routes.
- [ ] **Step 2: Update `AdminSidebar.tsx` navigation items**
  - Replace aliased checks (e.g. Flipbook Studio checking `media`, Lead Intelligence checking `campuses`) with their dedicated permission checks.
  - Update `Social Hub` items to check `can('social', feature, 'view')`.
  - Update `Workspace and Users` items to check `can('workforce', feature, 'view') || isSystemAdmin`.
  - Update `Management` items to check their specific feature permissions.
- [ ] **Step 3: Commit changes locally**
  `git commit -m "feat(rbac): align sidebar navigation items and route permissions map with canonical coordinates"`

---

### Task 5: Backoffice Maintenance FER & Verification
**Files:**
- Create/Modify: `src/app/actions/sync-role-permissions-fer-action.ts`
- Modify: `src/app/(backoffice)/backoffice/operations/page.tsx`
- Test: `pnpm test:run src/lib/__tests__/*.test.ts`
- Test: `pnpm typecheck`

- [ ] **Step 1: Implement Backoffice FER Server Action**
  Create `syncRolePermissionsFerAction` allowing Backoffice operators to run a dry-run or live sync across all organization roles in Firestore, upgrading legacy schemas to the normalized 6-section structure.
- [ ] **Step 2: Mount FER in Backoffice Operations UI**
  Add a clean card in `/backoffice/operations` with Dry Run and Apply buttons for zero-code role maintenance.
- [ ] **Step 3: Run comprehensive verification**
  Run: `pnpm test:run src/lib/__tests__/permissions*.test.ts src/lib/__tests__/role*.test.ts`
  Run: `pnpm typecheck`
- [ ] **Step 4: Commit changes locally**
  `git commit -m "feat(backoffice): add role schema normalization maintenance fer and verify zero type errors"`

---

## 6. Verification Checklist
- [ ] All 6 sections visible in `/admin/users/roles` matching the sidebar navigation.
- [ ] All 52 platform features configurable with CRUD checkboxes.
- [ ] Zero `any` or `any[]` introduced in application code (Rule 4).
- [ ] Legacy roles load without errors or missing property crashes (Rule 9).
- [ ] Mobile responsive layout with touch targets >= 44x44px (Rule 7).
- [ ] TypeScript check (`pnpm typecheck`) exits with 0 errors.
- [ ] Strictly local git commits; no push to remote origin.
