# Phase 6: Member Onboarding, Actionable Tasks, Lifecycle Engagement & CRM Automation Engine — Production Implementation Plan

> **Platform Dependency Chain:**
> **Phase 0 (Architecture & Platform Prep) [COMPLETED]** → **Phase 1 (Experience Portal Core) [COMPLETED]** → **Phase 2 (Content Engine & Block Studio) [COMPLETED]** → **Phase 3 (Identity, Access & Membership Engine) [COMPLETED]** → **Phase 4 (Learning Engine / LMS) [COMPLETED]** → **Phase 5 (Community Engine) [COMPLETED/ACTIVE]** → **Phase 6 (Onboarding, Engagement & Automation) [ACTIVE PLANNING]** → **Phase 7 (Live Learning & Cohorts)** → **Phase 8 (Monetization & Commercial Platform)**.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task. Steps use trackable checkbox (`- [ ]`) syntax.

---

## 1. Executive Summary & Module Foresight Across All Phases

The SmartSapp Experience Platform has successfully engineered and delivered:
1. **Phase 1 (Experience Portal Core)**: Branded runtime shell, Figtree typography tokens, dynamic CSS variable system (`var(--portal-primary)`), responsive universal navigation, theme toggle, and search modal.
2. **Phase 2 (Content Engine & Block Studio)**: Universal `ContentItem` AST, full-screen `ContentEditorModal` with drag-and-drop sortable canvas (`@dnd-kit`), categorized block palette, deferred property inspector, AST plain-text search index synchronization, no-code starter templates, and dual-mode `PortalContentReaderClient`.
3. **Phase 3 (Identity, Access & Membership Engine)**: Server-enforced entitlement paywalls (`<PortalAccessGate>`), tier management, access grants, invitation links, and customer account self-service.
4. **Phase 4 (Learning Engine / LMS Capabilities)**: Curriculum tree studio (`CurriculumEditorModal`), temporal & prerequisite drip release engine (`ReleaseScheduleService`), dual-mode course player with `<LessonDripLockCard>`, automated quiz evaluation, and verified PDF certificates.
5. **Phase 5 (Community Engine & Social Engagement Layer)**: Tier-gated discussion channels, category filter pills, pinned announcements, Skool-style community leaderboard, threaded replies (Level 1/2), multi-emoji reactions, `<MemberPublicProfileModal>`, and lesson discussion synchronization.

### The Mission of Phase 6: The Retention & CRM Convergence Layer
Phase 6 is the critical convergence layer that transforms the platform from a passive educational repository into an active **Retention, Guided Activation & CRM Automation Machine**. Without Phase 6, new students and members land in a portal and experience decision paralysis. 

Phase 6 delivers:
1. **Interactive Multi-Step Onboarding Journey Studio (`PortalOnboardingManager.tsx` & `OnboardingStepEditorModal.tsx`)**: No-code visual sequence builder for portal operators to construct guided activation pathways (Welcome Video → Profile Setup → Required Orientation Course → First Actionable Task → Community Intro → Milestone Reward).
2. **Learner Onboarding Experience (`PortalOnboardingBanner.tsx` & `PortalOnboardingModal.tsx`)**: Prominent progressive onboarding widget on the portal dashboard with interactive progress bars, step checklist drawer, auto-verification checks, celebratory confetti, and gamification bounty points (+50 pts).
3. **Actionable Tasks & File Submission Engine (`PortalTasksClient.tsx` & `PortalTaskManager.tsx`)**: Dedicated `/portal/[slug]/tasks` workspace for students to track deadlines, download templates, submit completed worksheets/receipts, and receive instructor approvals.
4. **Deep CRM Timeline & Automation Integration (`CRM Contact Activities & Event Bus`)**: Every member maps to a CRM Contact (`portal_memberships.contactId`). Every step completion, task submission, and milestone is recorded as an immutable CRM Activity, triggering automated WhatsApp, SMS, and Email follow-ups using SmartSapp's existing automation workflow engine.
5. **Inactivity Detection & Re-engagement Engine**: Background scoring classifying members into engagement tiers (`champion`, `active`, `warm`, `cold`) based on `lastActiveAt`, triggering automated CRM reactivation campaigns when learners stall.

---

## 2. 10 Mandatory Architectural & Production Standards

Every phase and line of code must strictly conform to these 10 principles:

1. **Skill Conformance & Standards Enforcement**:
   - `next-best-practices`: Explicit RSC leaf boundaries in `/portal/[slug]/tasks` and onboarding widgets. Route segment configurations with async `params`. Dynamic lazy-loading (`next/dynamic`) for heavy canvas, modal, and confetti components to protect initial load performance.
   - `vercel-react-best-practices`:
     - `rerender-memo`: Memoize `SortableStepItem` and `TaskCard` with `React.memo` to eliminate cascading tree re-renders during active interactions.
     - `rerender-functional-setstate`: Use functional updater forms (`setSteps(prev => ...)`) for stable callbacks.
     - `rerender-use-deferred-value`: Defer search inputs in task queues so high-frequency filtering never stutters 60fps painting.
     - `rendering-content-visibility`: Apply `content-visibility: auto; contain-intrinsic-size: 1px 90px;` to task lists and step queues to ensure smooth 60fps rendering even with 100+ tasks.
   - `emilkowal-animations`:
     - Standard tactile feedback (`active:scale-[0.97]` on all buttons, touch duration $\le 200$ms).
     - Confetti celebration modal on 100% onboarding completion with smooth spring transitions.
     - Accordion-style smooth disclosure animations for onboarding checklists.
   - `backend-design`:
     - Scoped multi-tenant keys (`organizationId`, `portalId`, `workspaceIds`).
     - Safe batch operations chunked to $\le 400$ operations per batch (preventing Firestore's 500-op cap).
     - Anti-spam rate-limiting on task submission uploads and step completions.
   - `frontend-design`:
     - Figtree typography tokens, semantic portal CSS variables (`var(--portal-primary)`, `var(--portal-surface)`, `var(--portal-text)`).
     - Refined editorial feel, subtle hover boundaries, clear empty state illustrations.
2. **Fields & Variables Single Source of Truth**:
   - All email, WhatsApp, and SMS automation notification templates generated from onboarding events must route exclusively through `FieldsVariablesService` (`src/lib/services/fields-variables-service.ts`) and `<VariablesPanel>`. Custom string regex replacements are strictly prohibited.
3. **Tag Selection Single Source of Truth**:
   - Any tag assignment to onboarding steps or completed task triggers must use the standardized `<TagSelector>` component (`src/components/tags/TagSelector.tsx`) in client draft mode. Direct text inputs for tags are forbidden.
4. **Actionable Error & Toast Navigation**:
   - Whenever an onboarding or task action prompts a member to visit a section (e.g. "Complete your profile" or "View community channels"), pass `actionConfig` with safe relative paths (`/portal/${slug}/...`). External links or javascript targets are strictly forbidden.
5. **Strict Typing Standard**:
   - Strictly **0 `any`**, **0 `any[]`**, and **0 unhandled `unknown`**. All schemas validated via Zod and strongly typed TypeScript interfaces. Inferred module types used wherever possible.
6. **Mobile-First & Touch Ergonomics**:
   - All interactive controls, step checkboxes, file upload dropzones, and modal dismiss buttons must adhere to `min-h-[44px]` touch targets.
   - Fail-safe 1-tap "Move Up / Move Down" buttons provided alongside drag handles.
7. **Security, Sanitization & Data Protection**:
   - All student-submitted attachments validated for MIME-type safety (PDF, PNG, JPEG, WEBP, XLSX, DOCX only; scripts, SVG with embedded scripts, and executables strictly rejected).
   - Maximum 20 MB ceiling per upload. Base64 binary injection forbidden; files upload to Firebase Storage with secure scoped paths (`portal_task_submissions/{portalId}/{taskId}/{userId}_{timestamp}_{filename}`).
8. **Git & Deployment Protocol**:
   - Zero pushes to remote branches (`main` or `deployment`). Local commits only with descriptive conventional commit messages.
9. **Verification Before Completion**:
   - Rigorous automated verification via `vitest` unit tests and `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` before any sub-phase is claimed complete.
10. **Inline Architectural Documentation**:
    - Every file must feature clear header documentation explaining its rationale, security boundaries, and testability pointers.

---

## 3. What Could Go Wrong & Production Mitigations (Risk Matrix)

| Risk / Failure Mode | Likelihood & Impact | Architectural Mitigation Strategy |
|:---|:---|:---|
| **1. Premature / False Step Completion** | **High / Critical** | Students click "Mark Done" on steps (e.g. "Watch Welcome Video" or "Complete Profile") without actually performing the action. <br/>**Mitigation**: Implement `autoVerificationType` on `OnboardingStep`: `has_profile` verifies non-default `displayName` and `avatarUrl` on `portal_memberships`; `has_started_lesson` verifies `learning_progress` size $> 0$; `has_community_post` verifies author post count $> 0$; `has_task_submission` verifies `task_submissions` status; `auto_watch` requires $\ge 90\%$ playback time before unlocking step. Only `manual_confirm` allows freeform clicking when explicitly set by the operator. |
| **2. CRM Contact Disconnection & Data Drift** | **Medium / High** | If a member signs up via magic link or invitation, their `portal_memberships.contactId` might be null or desynchronized from the main CRM `contacts` collection. <br/>**Mitigation**: Self-healing reconciliation protocol in `EngagementService`: If `membership.contactId` is missing, perform an atomic lookup in `contacts` by `email` + `organizationId`. If found, link it; if not found, create a CRM Contact record atomically and write back `contactId`. |
| **3. File Upload Bombing / Quota Exhaustion** | **Low / Critical** | Malicious users upload multi-gigabyte video or binary files to task submissions, exhausting Firebase Storage bandwidth and storage caps. <br/>**Mitigation**: Enforce 20 MB ceiling per submission in `TaskSubmissionUploader`. Validate file magic numbers / MIME types against allowed whitelist (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `application/vnd.openxmlformats-officedocument.*`). Strictly reject SVGs, HTML, and executables. |
| **4. Inactivity Cron Storm & Cloud Function Overload** | **Medium / High** | Running inactivity checks over tens of thousands of members simultaneously leads to Firestore read timeouts and Cloud Function execution limits. <br/>**Mitigation**: Partition inactivity evaluation by portal ID and paginate with limit batches of 200 members (`orderBy('lastActiveAt', 'asc').limit(200)`). Update `lastInactivityEvaluatedAt` on the portal so evaluations run at most once per 24 hours per portal. |
| **5. Duplicate Onboarding Progress Records** | **Medium / Medium** | Simultaneous login from multiple browser tabs creates competing `member_onboarding_progress` documents. <br/>**Mitigation**: Enforce deterministic document ID convention: `docId = onboarding_${portalId}_${userId}`. Use Firestore transactions or `set(..., { merge: true })` to prevent duplicates. |
| **6. Point Bounty Duplication Exploits** | **High / Critical** | Users repeat completed onboarding steps or refresh completion modals to receive duplicate +50 gamification points. <br/>**Mitigation**: Server-side idempotency in `EngagementService.advanceOnboardingStep`. Verify `isCompleted` flag and `pointsHistory.referenceId = onboarding_flow_${flow.id}_${userId}` before invoking `PortalMembershipService.awardPoints`. |
| **7. Automation Webhook Loops & Event Cascades** | **Low / High** | Triggering `task.completed` runs an automation that marks another task completed, causing recursive automation loops. <br/>**Mitigation**: Introduce an execution depth guard (`depth <= 2`) and deduplication cache keys on automation event triggers. |
| **8. Broken Deep-Links in Mobile Views** | **Medium / Medium** | Action buttons inside onboarding steps link to relative paths that 404 or fail inside mobile app / embedded webviews. <br/>**Mitigation**: Centralize route resolution via `getPortalActionUrl(portalSlug, step)` ensuring valid internal paths (`/portal/${slug}/learn`, `/portal/${slug}/community`, `/portal/${slug}/settings`). |
| **9. Stale Onboarding Steps After Flow Edits** | **Medium / Low** | Admin updates the portal's onboarding steps, but existing members have progress arrays referencing deleted step IDs. <br/>**Mitigation**: In `getMemberOnboardingProgress`, reconcile member's `completedStepIds` against the current flow's active step IDs. Ignore orphaned IDs and calculate `progressPercentage` based on current active steps only. |
| **10. UI Hydration Mismatch on Welcome Banner** | **High / Medium** | Reading `localStorage` for dismissed onboarding banners causes Next.js client/server hydration errors. <br/>**Mitigation**: Wrap banner display in an `isMounted` state guard or persist dismissal status in `portal_memberships.customFields.dismissedOnboardingBanner` so server and client render consistently. |
| **11. Orphaned Submissions on Task Deletion** | **Medium / Low** | Admin deletes a task from the backoffice; student submissions remain orphaned in Firestore. <br/>**Mitigation**: Implement chunked cascade deletion in `EngagementService.deleteTask`: query and batch-delete all `task_submissions` where `taskId == taskId` in chunks of $\le 400$ operations. |
| **12. Document Size Limit (1MB) on Onboarding Flows** | **Low / High** | Admin inputs long copy or base64 images into step descriptions, exceeding Firestore's 1MB limit. <br/>**Mitigation**: Step descriptions capped at 2,000 characters; video URLs strictly point to hosted platforms (YouTube, Vimeo, Loom, Cloud Storage MP4); validate total flow payload size before persisting. |

---

## 4. Impact Analysis Across Pre-Existing Features & Backoffice Governance

### 4.1 Cross-Subsystem Impact

| Feature Subsystem | Potential Impact | Required Integration & Enhancement |
|:---|:---|:---|
| **Portal Dashboard** (`/portal/[slug]`) | Homepage needs to welcome new members and show their onboarding checklist without cluttering the feed. | Add `<PortalOnboardingBanner>` and `<PortalTasksWidget>` to `PortalRuntimeClient.tsx`, styled with Figtree typography and collapsible layout. |
| **Course Player** (`/portal/[slug]/learn/*`) | Starting a lesson or completing a course should automatically advance linked onboarding steps and tasks. | Call `EngagementService.advanceStepByType(portalId, userId, 'start_course')` inside `LearningProgressService.updateWatchTime` and `completeLesson`. |
| **Community Engine** (`/portal/[slug]/community`) | The onboarding step "Introduce yourself in the community" should link directly to `#general` and auto-complete when the member posts. | Call `EngagementService.advanceStepByType(portalId, userId, 'community_post')` inside `CommunityService.createPost`. |
| **CRM Contacts Hub** (`/admin/contacts`) | Sales and support operators need visibility into member portal engagement directly inside the CRM Contact profile. | Render an "Experience Portal Activity" feed tab inside `ContactDetailClient.tsx` showing onboarding progress, course enrollments, and task submissions. |
| **Automation Builder** (`/admin/automations`) | Operators need triggers for portal events to send WhatsApp/SMS/Email sequences. | Register 5 new event triggers in the Automation Trigger catalog: `portal.member_joined`, `portal.onboarding_completed`, `portal.task_submitted`, `portal.course_completed`, `portal.member_inactive`. |
| **Gamification & Leaderboard** (Phase 5) | Onboarding completion and task submissions award points that must reflect in the Skool-style Community Leaderboard. | Ensure all point awards route through `PortalMembershipService.awardPoints` with clear action descriptions so they appear in member public profiles and leaderboards. |

### 4.2 Backoffice Governance Enhancements (No Code Needed)

Administrators and course managers can manage and scale the entire engagement lifecycle directly from the Backoffice Studio (`PortalOnboardingManager.tsx`) without developer intervention:
1. **Onboarding Flow Builder Tab**:
   - Visual drag-and-drop step sequencer with 1-click starter presets ("School Leadership Starter", "Student Orientation", "VIP Client Onboarding").
   - Configure step verification mode (`auto_watch`, `has_profile`, `has_started_lesson`, `has_community_post`, `manual_confirm`).
   - Customize CTA button text ("Watch Video →", "Set Up Profile", "Say Hello in #general").
   - Set completion point bounty (e.g. +50 points) and award celebratory badge.
2. **Action Tasks & Challenges Tab**:
   - Create milestone tasks with relative deadlines (e.g. "Due 3 days after joining").
   - Require file submissions (worksheets, intake forms, receipts) with download template links.
   - Use standardized `<TagSelector>` to automatically apply CRM tags upon task completion (e.g. `completed-intake`, `bursary-form-submitted`).
3. **Submission Review Queue Tab**:
   - Centralized instructor inbox displaying student submissions with one-click "Approve (+Points)", "Request Revision", or "Add Feedback" actions.
   - Automatic member notification when submission is approved or needs changes.

---

## 5. Firebase Indexes, Security Rules & Protocols

### 5.1 Security Rules (`firestore.rules`)
```text
// --- {{Org_name}} Experience Platform — Onboarding Flows ---
match /onboarding_flows/{flowId} {
  allow get, list: if true;
  allow create, update, delete: if isAuthorized();
}

// --- {{Org_name}} Experience Platform — Member Onboarding Progress ---
match /member_onboarding_progress/{progressId} {
  allow get, list: if isSignedIn() && (request.auth.uid == resource.data.userId || isAuthorized());
  allow create, update: if isSignedIn();
  allow delete: if isAuthorized();
}

// --- {{Org_name}} Experience Platform — Member Tasks ---
match /member_tasks/{taskId} {
  allow get, list: if true;
  allow create, update, delete: if isAuthorized();
}

// --- {{Org_name}} Experience Platform — Task Submissions ---
match /task_submissions/{submissionId} {
  allow get, list: if isSignedIn() && (request.auth.uid == resource.data.userId || isAuthorized());
  allow create, update: if isSignedIn();
  allow delete: if isAuthorized();
}
```

### 5.2 Composite Indexes (`firestore.indexes.json`)
```json
[
  {
    "collectionGroup": "member_onboarding_progress",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "portalId", "order": "ASCENDING" },
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "progressPercentage", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "member_onboarding_progress",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "portalId", "order": "ASCENDING" },
      { "fieldPath": "isCompleted", "order": "ASCENDING" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "member_tasks",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "portalId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "order", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "task_submissions",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "portalId", "order": "ASCENDING" },
      { "fieldPath": "taskId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "submittedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "task_submissions",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "portalId", "order": "ASCENDING" },
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "submittedAt", "order": "DESCENDING" }
    ]
  }
]
```

### 5.3 Fetch-Enrich-Restore & Seeding Protocols
1. **Default Flow Seeding**:
   - If a portal has no `onboarding_flow` document, `EngagementService.getOnboardingFlow` falls back to `DEFAULT_ONBOARDING_STEPS` (Welcome Video, Complete Profile, Start First Course, Introduce Yourself in Community).
   - Operators can click "Seed Starter Onboarding" in `PortalOnboardingManager.tsx` to instantiate an editable copy into Firestore with 1 click.
2. **Chunked Cascade Deletion**:
   - Deleting a task or onboarding flow splits deletion references into chunks of $\le 400$ operations per batch:
     ```typescript
     for (let i = 0; i < allRefs.length; i += 400) {
       const batch = adminDb.batch();
       allRefs.slice(i, i + 400).forEach(ref => batch.delete(ref));
       await batch.commit();
     }
     ```

---

## 6. File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/engagement.ts` | Enhance | Strict contracts for `OnboardingStep`, `OnboardingFlow`, `MemberOnboardingProgress`, `MemberTask`, `TaskSubmission`, `AutoVerificationType`. Strictly 0 `any`. |
| `src/lib/services/engagement-service.ts` | Enhance | Server-side domain operations: `reconcileOnboarding`, auto-verification engine, idempotent point awarding, task submission lifecycles, and CRM timeline activity logging. |
| `src/app/actions/engagement-actions.ts` | Enhance | Strongly typed Next.js Server Actions for flow saves, step completions, task submissions, and submission review approvals. |
| `src/lib/services/__tests__/engagement-service.test.ts` | Create | Unit tests validating step verification, point idempotency, CRM activity dispatch, and progress reconciliation. |
| `src/app/admin/portals/components/onboarding/OnboardingStepEditorModal.tsx` | Create | Dialog modal for configuring step details: video embed, auto-verification rule, action CTA, target route, and point reward. |
| `src/app/admin/portals/components/onboarding/SortableOnboardingStepItem.tsx` | Create | Drag-and-drop sortable step card with reorder handles, 1-tap buttons, and edit triggers. |
| `src/app/admin/portals/components/onboarding/TaskEditorModal.tsx` | Create | Modal for creating actionable member tasks with due dates, file submission requirements, points, and `<TagSelector>`. |
| `src/app/admin/portals/components/PortalOnboardingManager.tsx` | Enhance | Backoffice studio with 3 tabs: Onboarding Flow Builder, Action Tasks Manager, and Submission Review Queue. |
| `src/app/portal/[slug]/components/PortalOnboardingBanner.tsx` | Create | Dashboard checklist card with progress bar, step items, and button to open full onboarding wizard. |
| `src/app/portal/[slug]/components/PortalOnboardingModal.tsx` | Create | Full-screen interactive wizard with video player, inline actions, confetti celebration, and reward claim. |
| `src/app/portal/[slug]/tasks/page.tsx` | Create | Dedicated Member Tasks route (`/portal/[slug]/tasks`) with OpenGraph metadata. |
| `src/app/portal/[slug]/tasks/PortalTasksClient.tsx` | Create | Student-facing task dashboard with tabs ("All", "Due Soon", "Completed"), file submission uploader, and status badges. |
| `src/app/portal/[slug]/PortalRuntimeClient.tsx` | Modify | Embed `<PortalOnboardingBanner>` on the homepage when member has incomplete onboarding steps. |
| `src/lib/services/learning-progress-service.ts` | Modify | Hook into `EngagementService.advanceStepByType` on lesson start and course completion. |
| `src/lib/services/community-service.ts` | Modify | Hook into `EngagementService.advanceStepByType` on first community post. |

---

## 7. Phase-by-Phase Implementation Plan

### Sub-Phase 6.1: Domain Type Contracts, Schema Hardening & Unit Tests

**Files:**
- Modify: `src/lib/types/engagement.ts`
- Modify: `src/lib/services/engagement-service.ts`
- Modify: `src/app/actions/engagement-actions.ts`
- Create: `src/lib/services/__tests__/engagement-service.test.ts`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Update `src/lib/types/engagement.ts` with complete Phase 6 types**
  - Add `AutoVerificationType`: `'auto_watch' | 'has_profile' | 'has_started_lesson' | 'has_community_post' | 'has_task_submission' | 'manual_confirm'`.
  - Add `TaskSubmission`: `id`, `taskId`, `userId`, `portalId`, `submissionText`, `attachmentUrls`, `status: 'pending_review' | 'approved' | 'rejected'`, `instructorFeedback`, `submittedAt`, `reviewedAt`.
  - Add `EngagementTier` thresholds and `AutomationTriggerType` definitions.
- [ ] **Step 2: Add composite indexes to `firestore.indexes.json`**
  - Add indexes for `member_onboarding_progress` and `task_submissions`.
- [ ] **Step 3: Enhance `EngagementService` in `src/lib/services/engagement-service.ts`**
  - Implement `reconcileOnboarding(portalId, userId)`: automatically asserts completed actions (profile filled, lesson started, community post published) and updates progress.
  - Implement idempotent point awarding via `PortalMembershipService.awardPoints` with duplicate detection.
  - Implement `submitTask(input)` and `reviewTaskSubmission(input)` with CRM Activity timeline logging.
- [ ] **Step 4: Update Server Actions in `src/app/actions/engagement-actions.ts`**
  - Export `reconcileOnboardingAction`, `submitTaskAction`, `reviewTaskSubmissionAction`, `listTaskSubmissionsAction`.
- [ ] **Step 5: Write unit tests in `src/lib/services/__tests__/engagement-service.test.ts`**
  - Test auto-verification of profile completion and lesson start.
  - Test point bounty idempotency (no duplicate points awarded).
  - Test task submission lifecycle (`pending_review` → `approved`).
- [ ] **Step 6: Run tests and typecheck**
  - Run `npx vitest run src/lib/services/__tests__/engagement-service.test.ts`.
  - Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.
- [ ] **Step 7: Commit Sub-Phase 6.1 locally**
  - Commit: `feat(engagement): enhance domain models, verification engine, and task submission actions`.

---

### Sub-Phase 6.2: Backoffice Onboarding Studio & Submission Review Queue

**Files:**
- Create: `src/app/admin/portals/components/onboarding/OnboardingStepEditorModal.tsx`
- Create: `src/app/admin/portals/components/onboarding/SortableOnboardingStepItem.tsx`
- Create: `src/app/admin/portals/components/onboarding/TaskEditorModal.tsx`
- Modify: `src/app/admin/portals/components/PortalOnboardingManager.tsx`

- [ ] **Step 1: Create `SortableOnboardingStepItem.tsx`**
  - Render step order badge, icon, title, verification badge (`Auto-Verified`, `Manual Confirm`), and action CTA.
  - Quick action toolbar: Edit, Move Up, Move Down, Delete.
  - Touch-friendly with $\ge 44$px touch targets and `active:scale-[0.97]`.
- [ ] **Step 2: Create `OnboardingStepEditorModal.tsx`**
  - Dialog for editing step title, description, step type, custom action CTA label, target URL/route, and `autoVerificationType`.
  - Embedded video URL input for `'welcome_video'` steps.
- [ ] **Step 3: Create `TaskEditorModal.tsx`**
  - Dialog for creating/editing member tasks: Title, description, due date / relative days after join, priority (`low`, `medium`, `high`, `urgent`), reward points (+5 to +25), and file submission toggle.
  - Standardized `<TagSelector>` for applying contact tags upon completion.
- [ ] **Step 4: Enhance `PortalOnboardingManager.tsx`**
  - Add 3rd tab: **"Submission Review Queue"** (`TabsTrigger value="submissions"`).
  - Display pending member submissions with member avatar, submitted file links, and 1-click "Approve (+Points)" and "Request Revision" buttons.
  - Top bar "Preview Onboarding Flow" test button.
- [ ] **Step 5: Run typecheck and commit Sub-Phase 6.2 locally**
  - Run `tsc --noEmit`.
  - Commit: `feat(onboarding-studio): add visual step builder, task modal, and submission review queue`.

---

### Sub-Phase 6.3: Learner Dashboard Onboarding Banner & Interactive Wizard Modal

**Files:**
- Create: `src/app/portal/[slug]/components/PortalOnboardingBanner.tsx`
- Create: `src/app/portal/[slug]/components/PortalOnboardingModal.tsx`
- Modify: `src/app/portal/[slug]/PortalRuntimeClient.tsx`

- [ ] **Step 1: Create `PortalOnboardingBanner.tsx`**
  - Positioned at the top of the portal dashboard for active members.
  - Header: "Getting Started with {{Portal_Name}}" with progress ring / bar (e.g. "3 of 5 steps completed").
  - Step checklist rows: Green checkmark for completed, active circle for current, lock/gray for upcoming.
  - Click on any incomplete step opens `<PortalOnboardingModal>` directly at that step.
  - Dismiss / collapse toggle (re-expandable from a subtle floating pill).
- [ ] **Step 2: Create `PortalOnboardingModal.tsx`**
  - Full-screen or large dialog wizard (`max-w-2xl`).
  - Left navigation / progress steps sidebar; right active step pane.
  - Video player embed for welcome video steps (`react-player` or responsive iframe with aspect ratio container).
  - Profile setup step: Inline avatar uploader and display name input updating `portal_memberships`.
  - Course enrollment / first lesson step: 1-click "Enroll & Start Lesson" action.
  - Community introduction step: Prompt with button routing to `/portal/${slug}/community`.
  - Confetti celebration modal on final step with "+50 Points Claimed!" badge and level advancement announcement.
- [ ] **Step 3: Embed in `PortalRuntimeClient.tsx`**
  - Query member's onboarding progress.
  - Mount `<PortalOnboardingBanner>` above the Spaces Grid when onboarding is incomplete (`!progress.isCompleted`).
- [ ] **Step 4: Run typecheck and commit Sub-Phase 6.3 locally**
  - Run `tsc --noEmit`.
  - Commit: `feat(portal-onboarding): implement progressive dashboard banner and full interactive wizard`.

---

### Sub-Phase 6.4: Dedicated Member Tasks Hub & File Submission Uploader

**Files:**
- Create: `src/app/portal/[slug]/tasks/page.tsx`
- Create: `src/app/portal/[slug]/tasks/PortalTasksClient.tsx`
- Modify: `src/app/portal/[slug]/components/PortalShellHeader.tsx`

- [ ] **Step 1: Create `src/app/portal/[slug]/tasks/page.tsx`**
  - Async Next.js 15 page route with dynamic OpenGraph metadata ("Tasks & Action Items | {{Portal_Name}}").
- [ ] **Step 2: Create `PortalTasksClient.tsx`**
  - Wrapped in `<PortalPageShell>`.
  - Filter tabs: "All Tasks", "Pending Action", "Submitted & Under Review", "Completed".
  - Task card components: Title, due date badge (highlighting overdue tasks in red/amber), reward points badge, priority badge.
  - File submission uploader: Drag-and-drop file dropzone with progress indicator for submitting completed assignments, worksheets, or receipts.
  - Submission status chip: "Under Review ⏳" vs "Approved! 🎉 (+15 pts)".
- [ ] **Step 3: Add Tasks Link to `PortalShellHeader.tsx`**
  - Add navigation item for "Tasks" (with badge showing pending task count) when tasks are enabled for the portal.
- [ ] **Step 4: Run typecheck and commit Sub-Phase 6.4 locally**
  - Run `tsc --noEmit`.
  - Commit: `feat(portal-tasks): add dedicated member task hub with file upload submissions`.

---

### Sub-Phase 6.5: Deep CRM Timeline Sync & Automation Trigger Dispatch

**Files:**
- Modify: `src/lib/services/engagement-service.ts`
- Modify: `src/lib/services/learning-progress-service.ts`
- Modify: `src/lib/services/community-service.ts`

- [ ] **Step 1: CRM Activity Logging on Onboarding & Tasks**
  - In `EngagementService.advanceOnboardingStep`, log structured CRM Activity to `contacts/{contactId}/activities`:
    ```typescript
    await logActivity({
      contactId: membership.contactId,
      organizationId: membership.organizationId,
      type: 'portal_onboarding_step_completed',
      title: `Completed Onboarding: ${step.title}`,
      metadata: { portalId, stepId: step.id, pointsAwarded: step.points },
    });
    ```
- [ ] **Step 2: Connect LMS & Community to Onboarding Auto-Advancement**
  - In `LearningProgressService.updateWatchTime`: call `advanceStepByType(portalId, userId, 'start_course')`.
  - In `CommunityService.createPost`: call `advanceStepByType(portalId, userId, 'community_post')`.
- [ ] **Step 3: Dispatch Automation Triggers**
  - When onboarding is 100% completed, dispatch domain event:
    `EventBus.publish('portal.onboarding_completed', { portalId, userId, contactId, completedAt })`.
- [ ] **Step 4: Run typecheck and commit Sub-Phase 6.5 locally**
  - Run `tsc --noEmit`.
  - Commit: `feat(engagement-crm): wire real-time CRM activity logging and automation trigger dispatch`.

---

### Sub-Phase 6.6: End-to-End Verification & Browser Audit

**Files:**
- Full test suite & lint verification

- [ ] **Step 1: Run complete Vitest suite**
  - Run: `npx vitest run`.
- [ ] **Step 2: Run strict TypeScript static analysis**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` (Confirm 0 errors).
- [ ] **Step 3: Run ESLint across touched files**
  - Verify clean linting with 0 errors or warnings.
- [ ] **Step 4: Verify Git Status**
  - Verify clean git tree, ahead only of origin by local commits, 0 remote pushes.

---

## 8. Summary of Detailed UI Changes

| Subsystem / View | Current State | Required UI Transformation |
|:---|:---|:---|
| **Portal Dashboard** (`/portal/[slug]`) | Displays spaces grid and catalog without onboarding direction. | Adds sticky, dismissible `<PortalOnboardingBanner>` with progress ring, Figtree font styling, and 1-tap wizard launcher. |
| **Onboarding Wizard** (`PortalOnboardingModal`) | Non-existent in member portal. | Full-screen/modal multi-step wizard with responsive video player, inline profile setup, smooth Emil Kowalski transitions, and celebration confetti. |
| **Member Tasks Hub** (`/portal/[slug]/tasks`) | Non-existent. | Dedicated responsive tasks interface with tab filters, due-date badges, file submission dropzones, and instructor approval tags. |
| **Backoffice Studio** (`PortalOnboardingManager`) | Basic placeholder step table. | 3-tab modern studio: visual drag-and-drop step builder, task configurator with `<TagSelector>`, and live submission review queue. |
| **Navigation Header** (`PortalShellHeader`) | Contains Courses, Community, Library. | Adds "Tasks" tab with real-time pending task counter badge. |
| **CRM Contact View** (`/admin/contacts/[id]`) | Shows standard emails and calls. | Displays real-time portal engagement timeline: onboarding milestone completions, course watch percentage, and task submissions. |
