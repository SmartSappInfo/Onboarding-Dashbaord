# Standalone Call Centre & App-Wide Navigation Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Call Centre from the Messaging scope to make it a first-class, standalone platform feature with independent navigation (`/admin/call-centre`), perform a 100% app-wide sweep of all routing/actions/imports, introduce governed MCP tooling for Call Centre, and resolve Firestore security rules and composite indexes for workspace messaging settings and user-specific conversation queries.

**Architecture:** 
- Standalone Route Structure: Move canonical call-centre pages and components to `src/app/admin/call-centre/*` while maintaining backwards-compatible redirect stubs at `src/app/admin/messaging/call-centre/*`.
- Independent Navigation: Promote Call Centre to a standalone top-level nav item in `AdminSidebar.tsx` under the "Work" section with independent feature gating (`isFeatureEnabled('call_centre')`), isolated from messaging.
- App-Wide Routing & Action Revalidation: Sweep all server actions, breadcrumbs, modal links, and adapters from `/admin/messaging/call-centre` to `/admin/call-centre`.
- Governed MCP Tools: Author `call_centre.list_campaigns` and `call_centre.get_campaign_analytics` strictly conforming to `docs/agents_mcp/agents_mcp_rules.md` (64-char SHA-256 schema hashing, fail-closed multi-tenancy, zero `any/any[]`).
- Firestore Security Rules & Indexes: Authorize `/workspaces/{workspaceId}/messaging_settings/{docId}` in `firestore.rules` and define composite indexes for user-specific message log queries in `firestore.indexes.json`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Lucide Icons, Vitest, Testing Library, Tailwind CSS, Firestore Security Rules & Indexes.

---

## What Could Go Wrong & Mitigation Strategies (Rule 2)

1. **Broken Bookmarks & Deep Links**:
   - *Risk*: Users or external notifications with existing URLs to `/admin/messaging/call-centre/...` encounter 404s.
   - *Mitigation*: Create Next.js server/client redirect pages at the old paths preserving all search parameters (e.g. `track`, `id`, `tab`, `step`).
2. **Stale Imports in Downstream Modules**:
   - *Risk*: Media dialogs (`EventAutomationsAccordion.tsx`, `share-media-dialog.tsx`) or modals (`CallNowModal.tsx`) breaking due to moved scripts components.
   - *Mitigation*: Update all known imports to `@/app/admin/call-centre/...` AND leave re-export bridge files in `src/app/admin/messaging/call-centre/scripts/components/`.
3. **Permission Gating Regression**:
   - *Risk*: Users without messaging permissions previously could not access call centre even if they had call centre permissions.
   - *Mitigation*: Decouple sidebar and route check so Call Centre only requires `can('studios', 'callCentre', 'view')` and `isFeatureEnabled('call_centre')`.
4. **Cache & Revalidation Invalidation**:
   - *Risk*: Server actions in `call-centre-actions.ts` revalidating stale paths (`/admin/messaging/call-centre`) leading to stale data on the new route.
   - *Mitigation*: Update all 18 `revalidatePath` calls in `call-centre-actions.ts` to revalidate `/admin/call-centre` and dynamic sub-paths.

---

## File Structure & Decomposition

### 1. New Canonical Route & Components (`src/app/admin/call-centre/`)
- `src/app/admin/call-centre/page.tsx`
- `src/app/admin/call-centre/CallCentreClient.tsx`
- `src/app/admin/call-centre/components/CallCentreBreadcrumbs.tsx`
- `src/app/admin/call-centre/components/ManageCampaignContactsDialog.tsx`
- `src/app/admin/call-centre/components/AddContactsDialog.tsx`
- `src/app/admin/call-centre/scripts/page.tsx`
- `src/app/admin/call-centre/scripts/new/page.tsx`
- `src/app/admin/call-centre/scripts/new/ScriptBuilderClient.tsx`
- `src/app/admin/call-centre/scripts/components/*`
- `src/app/admin/call-centre/campaigns/new/page.tsx`
- `src/app/admin/call-centre/campaigns/new/CampaignWizardClient.tsx`
- `src/app/admin/call-centre/workspace/[campaignId]/page.tsx`
- `src/app/admin/call-centre/workspace/[campaignId]/WorkspaceClient.tsx`
- `src/app/admin/call-centre/analytics/[campaignId]/page.tsx`
- `src/app/admin/call-centre/analytics/[campaignId]/CampaignAnalyticsClient.tsx`
- `src/app/admin/call-centre/analytics/[campaignId]/components/CampaignQueueTab.tsx`

### 2. Backwards-Compatibility Redirects & Re-exports (`src/app/admin/messaging/call-centre/`)
- `src/app/admin/messaging/call-centre/page.tsx` (redirects to `/admin/call-centre`)
- `src/app/admin/messaging/call-centre/scripts/page.tsx` (redirects to `/admin/call-centre?tab=scripts`)
- `src/app/admin/messaging/call-centre/scripts/new/page.tsx` (redirects to `/admin/call-centre/scripts/new`)
- `src/app/admin/messaging/call-centre/campaigns/new/page.tsx` (redirects to `/admin/call-centre/campaigns/new`)
- `src/app/admin/messaging/call-centre/workspace/[campaignId]/page.tsx` (redirects to `/admin/call-centre/workspace/[campaignId]`)
- `src/app/admin/messaging/call-centre/analytics/[campaignId]/page.tsx` (redirects to `/admin/call-centre/analytics/[campaignId]`)
- `src/app/admin/messaging/call-centre/scripts/components/index.ts` (re-exports)

### 3. Navigation, Routing & Permission Integration
- `src/app/admin/components/AdminSidebar.tsx`: Standalone `/admin/call-centre` link and decoupled feature check.
- `src/lib/route-titles.ts` & `src/lib/__tests__/route-titles.test.ts`: Register `/admin/call-centre`.
- `src/lib/route-permissions.ts`: Register `/admin/call-centre`.
- `src/app/admin/components/BreadcrumbNav.tsx`: Ensure topbar shows `Dashboard > Call Centre`.
- `src/lib/note-source-adapters/call-note-adapter.ts`: Update `originHref` to `/admin/call-centre`.
- `src/lib/__tests__/quick-notes-adapters.test.ts`: Update test assertions.
- `src/lib/call-centre-actions.ts`: Update all `revalidatePath` targets.
- `src/components/call-centre/CallNowModal.tsx`: Update dynamic imports.
- `src/app/admin/media/components/EventAutomationsAccordion.tsx` & `share-media-dialog.tsx`: Update imports.

### 4. Governed MCP Tooling
- `src/lib/mcp/tools/call-centre-tools.ts`: `call_centre.list_campaigns` and `call_centre.get_campaign_analytics`.
- `src/lib/mcp/tools/__tests__/call-centre-tools.test.ts`: Unit test suite.
- `src/lib/mcp/tools/index.ts`: Register in `ALL_CORE_MCP_TOOLS`.

### 5. Firestore Rules & Composite Indexes
- `firestore.rules`: Add `/workspaces/{workspaceId}/messaging_settings/{docId}` read/write rule.
- `firestore.indexes.json`: Add composite indexes for `message_logs` with `userId` and `workspaceIds`.

---

## Tasks

### Task 1: Migrate Canonical Call Centre Pages & Components to `/admin/call-centre/`

**Files:**
- Create: `src/app/admin/call-centre/` hierarchy (pages, clients, scripts, campaigns, workspace, analytics).
- Modify: All internal links inside `CallCentreClient.tsx`, `ScriptBuilderClient.tsx`, `CampaignWizardClient.tsx`, `WorkspaceClient.tsx`, `CampaignAnalyticsClient.tsx`, and `CallCentreBreadcrumbs.tsx`.

- [ ] **Step 1: Copy/Migrate file tree from `src/app/admin/messaging/call-centre` to `src/app/admin/call-centre`**
- [ ] **Step 2: Update all internal route links from `/admin/messaging/call-centre` to `/admin/call-centre`**
  - In `CallCentreClient.tsx`: `/admin/call-centre/campaigns/new`, `/admin/call-centre/analytics/${camp.id}`, `/admin/call-centre/workspace/${camp.id}`, `/admin/call-centre/scripts/new`.
  - In `ScriptBuilderClient.tsx`: `/admin/call-centre`, `/admin/call-centre/scripts/new`, `/admin/call-centre?tab=scripts`.
  - In `CampaignWizardClient.tsx`: `/admin/call-centre?tab=campaigns`, `/admin/call-centre/scripts/new`, `/admin/call-centre/workspace/${id}`.
  - In `WorkspaceClient.tsx`: `/admin/call-centre`.
  - In `CampaignAnalyticsClient.tsx`: `/admin/call-centre/workspace/${campaign.id}`, `/admin/call-centre`.
  - In `CallCentreBreadcrumbs.tsx`: Root link points to `/admin/call-centre` with label "Call Centre".
- [ ] **Step 3: Update relative imports across moved components**
- [ ] **Step 4: Verify test suite `npx vitest run src/app/admin/call-centre/scripts/components/__tests__/ScriptBodyDisplay.test.tsx`**

---

### Task 2: Create Backwards-Compatible Redirects & Bridge Re-exports in `/admin/messaging/call-centre/`

**Files:**
- Modify: `src/app/admin/messaging/call-centre/page.tsx`
- Modify: `src/app/admin/messaging/call-centre/scripts/page.tsx`
- Modify: `src/app/admin/messaging/call-centre/scripts/new/page.tsx`
- Modify: `src/app/admin/messaging/call-centre/campaigns/new/page.tsx`
- Modify: `src/app/admin/messaging/call-centre/workspace/[campaignId]/page.tsx`
- Modify: `src/app/admin/messaging/call-centre/analytics/[campaignId]/page.tsx`
- Create: Bridge re-exports in `src/app/admin/messaging/call-centre/scripts/components/*`

- [ ] **Step 1: Replace legacy page components with Next.js redirects to `/admin/call-centre/...`**
- [ ] **Step 2: Add bridge re-exports for `ActionConfigFields`, `OutcomeAutomationsEditor`, and `InteractiveScriptView`**
- [ ] **Step 3: Test legacy redirects and verify no broken imports**

---

### Task 3: Independent Sidebar Navigation & Route Metadata

**Files:**
- Modify: `src/app/admin/components/AdminSidebar.tsx`
- Modify: `src/lib/route-titles.ts`
- Modify: `src/lib/__tests__/route-titles.test.ts`
- Modify: `src/lib/route-permissions.ts`
- Modify: `src/app/admin/components/BreadcrumbNav.tsx`

- [ ] **Step 1: Update `AdminSidebar.tsx`**
  - Change href: `wrapHref('/admin/call-centre')`
  - Decouple visibility: `visible: isFeatureEnabled('call_centre') && can('studios', 'callCentre', 'view')`
- [ ] **Step 2: Update `route-titles.ts` and `route-permissions.ts`**
  - Register `/admin/call-centre` as `'Call Centre'`
  - Keep legacy `/admin/messaging/call-centre` as alias
- [ ] **Step 3: Run `npx vitest run src/lib/__tests__/route-titles.test.ts` to verify**

---

### Task 4: App-Wide Link & Action Sweep

**Files:**
- Modify: `src/lib/call-centre-actions.ts`
- Modify: `src/lib/note-source-adapters/call-note-adapter.ts`
- Modify: `src/lib/__tests__/quick-notes-adapters.test.ts`
- Modify: `src/components/call-centre/CallNowModal.tsx`
- Modify: `src/app/admin/media/components/EventAutomationsAccordion.tsx`
- Modify: `src/app/admin/media/components/share-media-dialog.tsx`

- [ ] **Step 1: Update all `revalidatePath` targets in `src/lib/call-centre-actions.ts`**
- [ ] **Step 2: Update `originHref` in `src/lib/note-source-adapters/call-note-adapter.ts` and test in `quick-notes-adapters.test.ts`**
- [ ] **Step 3: Update dynamic imports in `src/components/call-centre/CallNowModal.tsx`**
- [ ] **Step 4: Update imports in media components**
- [ ] **Step 5: Run `npx vitest run src/lib/__tests__/call-centre* src/components/call-centre/__tests__/` to verify**

---

### Task 5: Governed MCP Tooling for Standalone Call Centre

**Files:**
- Create: `src/lib/mcp/tools/call-centre-tools.ts`
- Create: `src/lib/mcp/tools/__tests__/call-centre-tools.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`
- Modify: `src/lib/mcp/types.ts`

- [ ] **Step 1: Author unit test suite for Call Centre MCP tools**
- [ ] **Step 2: Implement `call_centre.list_campaigns` and `call_centre.get_campaign_analytics`**
  - Risk tier: `read_only`
  - Fail-closed multi-tenancy verification
  - 64-char SHA-256 schema hashing
- [ ] **Step 3: Register tools in `ALL_CORE_MCP_TOOLS`**
- [ ] **Step 4: Run MCP tool tests and verify**

---

### Task 6: Firestore Security Rules & Composite Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Authorize `messaging_settings` subcollection under `workspaces/{workspaceId}` in `firestore.rules`**
  - Read: authorized users
  - Write: system admin or workspace admin/access
- [ ] **Step 2: Add composite indexes for `message_logs` with `userId` in `firestore.indexes.json`**
- [ ] **Step 3: Validate rules and indexes with Firebase validation tools**

---

### Task 7: Full System Verification, Typecheck & Local Git Commit

- [ ] **Step 1: Run full test suite for messaging and call centre**
- [ ] **Step 2: Run `tsc --noEmit` to verify 0 type errors**
- [ ] **Step 3: Perform local git commit conforming to Rule 5 (no unprompted push)**
