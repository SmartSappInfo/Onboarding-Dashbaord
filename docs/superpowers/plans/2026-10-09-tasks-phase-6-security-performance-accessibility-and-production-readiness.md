# Tasks Phase 6: Security, Performance, Accessibility & Production Readiness Plan

> **Governance Notice:** Conforms strictly to `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `theme.md` (Section 8 Modal Architecture), `docs/tasks/tasks_roadmap_ui.md` (§79, §80–92), `docs/tasks/tasks_prd.md` (§20, §21), and `docs/tasks/tasks_ui_spec.md` (§12, §13).
> **Execution Status:** AWAITING PLAN APPROVAL. Do NOT begin execution until explicitly approved by the user.

---

## Executive Summary & Strategic Objective

Phase 6 is the final production readiness, hardening, and verification milestone of the Tasks Architecture upgrade. Having developed and stabilized the UI foundations (Phase 1), core workspace experience (Phase 2), execution workflows (Phase 3), scale, standups, analytics & AI (Phase 4), and cross-module integration with downstream sync (Phase 5), Phase 6 ensures that the entire system is:
1. **Bulletproof Under Security Audits:** Proven resistance against cross-tenant data leakage, unauthorized direct endpoint invocations, IDOR vulnerabilities, AI permission elevation, and unprivileged exposure of private standup notes.
2. **Accessible & Responsive Across All Devices:** 100% compliance with WCAG 2.1 AA / web.dev standards, enforcing $\ge 44\text{px}$ touch targets, tactile transitions (`active:scale-[0.97]`), keyboard-only complete operational journeys, screen reader semantics (`sr-only` descriptions), and responsive fidelity across Mobile (<768px), Tablet, and Desktop.
3. **Performant at Production Scale:** Verified cursor pagination and query execution times under synthetic volumes of 500, 5,000, and 50,000 tasks without memory exhaustion, UI freezing, or batch processing overloads.
4. **Reconciled for Absolute Data Integrity:** Zero state drift across task lifecycles (create, update, checklist, complete, reopen), bi-directional contract obligation synchronization with DocSigning/Agreements, standup commitments/carryovers, and operational analytics aggregations.
5. **Formally Documented & Certified:** Generates the official Phase 6 Production Readiness Report (§79) and completes the definition of done with zero TypeScript compiler diagnostics and zero ESLint errors/warnings under 8GB memory limits.

---

## Comprehensive Agents & MCP Rules Compliance Mapping

### 1. Foundation Rules (Rules 1 – 10)

| Rule | Requirement | Phase 6 Verification & Implementation Defense |
|---|---|---|
| **Rule 1: Design Standards & UI Consistency** | Next.js 15, React 19, `emilkowal-animations`, `frontend-design`, `backend-design`, `theme.md` §8. | Comprehensive audit of all modals, dialogs, drawers, and cards against Section 8 Modal Architecture. Verifies demarcated headers (`<DialogHeader demarcated>`), single-circle `CardInfoTooltip` (`z-[10050]`), `sr-only` descriptions, and demarcated footers with `active:scale-[0.97]` buttons. |
| **Rule 2: Risk Analysis, Prevention & Scalability** | Proactive failure mode analysis, clean refactoring, test-driven validation, no origin pushes. | Detailed Risk Analysis & Failure Modes Matrix below. Every verification gate executed via automated test suites. Strictly local commits; zero `git push`. |
| **Rule 3: Cross-Module Observability & Backoffice Governance** | Backoffice management without code changes; no broken downstream dependencies. | Audits backoffice visibility of task obligation sync states, standup submissions, blocker escalations, and system health metrics. |
| **Rule 4: Strict Typing Policy** | Zero `any` or `any[]`. No unchecked casts in domain code. Inferred/explicit types. Validate `unknown` at boundaries. | Absolute ban on `any` and `any[]`. Automated repository scan verifies zero occurrences across all tasks hubs. External payloads validated via Zod schemas. |
| **Rule 5: Deployment, Staging & Rule Safety** | Stage and verify rules/indexes before deployment. Never auto-deploy security-sensitive changes. | Validates Firestore security rules for `tasks`, `standups`, `blockers`, and `obligations` with automated rule simulation tests. Production deployment checklist enforces explicit approval. |
| **Rule 6: Dependency & Documentation Standards** | No unvetted dependencies. Use official SDKs and latest documentation via Context7. | Verifies all packages against allowed dependencies. No unvetted external libraries added. |
| **Rule 7: Mobile-First, Touch Targets & Everyday Plain UI English** | Touch targets $\ge 44\text{px}$. Gesture/viewport support. Minimal, plain everyday UI English. No verbose walls of text. | Automated viewport and tap-target audit tests verify $\ge 44\text{px}$ across all interactive buttons, filter chips, checkboxes, and drawer drag handles. Copy audited for concise everyday English. |
| **Rule 8: Security, Anti-IDOR & Zero Trust** | Workspace confinement, tenant isolation, anti-IDOR checks, safe relative navigation. | Comprehensive cross-tenant attack simulation suite testing direct action invocations with spoofed workspace tokens. All actionable toast paths verified to start with `/`. |
| **Rule 9: Concurrency, Load & Resource Protection** | Avoid batch overload, resource exhaustion, or unbounded queries. | Scale stress testing with up to 50,000 synthetic tasks. Verifies cursor-based pagination (`startAfter`), bounded queries (`limit`), and memory footprint safety under ESLint 8GB flag. |
| **Rule 10: Inline Architectural Guidance** | Clear code comments explaining what changed, why, caution areas, and testability pointers. | Verifies structured header documentation and maintainer guidance comments across all tasks architecture files. |

---

### 2. Protocol, Agentic & MCP Rules (Rules 11 – 20)

| Rule | Requirement | Phase 6 Verification & Implementation Defense |
|---|---|---|
| **Rule 11: MCP Protocol Compliance** | Target current supported MCP specification (`2026-07-28`), stateless execution, SDK v2 standards. | Audits capability contracts (`task.create`, `task.update`, `task.complete`, `task.search`, `task.get`, `standup.submit`, `blocker.mutate`, `task.obligation.sync`) for stateless operation. |
| **Rule 12: Server-Side Risk Enforcement** | Risk classifications enforced server-side independently of client/MCP metadata hints. | Verifies that all mutating task capabilities enforce `L2_STATE_MUTATION` server-side permission checks and reject unauthorized callers regardless of metadata hints. |
| **Rule 13: Formal Trust Boundary Matrix** | Data entering agent/system has explicit trust classification. External data treated as untrusted. | Verifies strict narrowing of `USER TRUST`, `SYSTEM TRUST`, `TENANT TRUST`, `AGENT TRUST`, and `EXTERNAL DATA` across all endpoints. |
| **Rule 16: Agent Identity as Security Principal** | Security principal includes `organizationId`, `workspaceId`, `userId`, `actorType`, `agentId`. | Validates that agent-initiated task actions preserve `actorType: 'agent'` and do not inherit unearned administrative privileges. |
| **Rule 17: Non-Delegable Privileges** | Administrative permissions cannot be delegated to autonomous agents. | Tests verify that agents cannot delete workspaces, alter tenant isolation, or override global security policies via task capabilities. |
| **Rule 18: TOCTOU Concurrency Protection** | Prevent time-of-check to time-of-use races using version/timestamp tokens. | Concurrency tests verify that simultaneous task mutations evaluate `expectedUpdatedAt` and gracefully abort on stale versions without data clobbering. |
| **Rule 19: Mutating Action Idempotency** | Define idempotency keys and retry semantics for every mutation. | Network retry simulation tests verify that duplicate calls with the same `idempotencyKey` return identical successful results without duplicate side-effects. |
| **Rule 20: Replay & Duplicate Delivery Protection** | Unique execution identifiers (`executionId`, `idempotencyKey`). | Verifies execution tracking across downstream agreement sync, standup submissions, and blocker state changes. |

---

## Proactive Risk Analysis & Failure Modes Matrix (Rule 2 & Rule 3)

| Failure Mode / Security Vulnerability | Root Cause | Severity | Prevention & Verification Defense |
|---|---|---|---|
| **Cross-Tenant IDOR Breach** | User passes a valid `taskId` belonging to Workspace B while authenticated in Workspace A. | Critical | Server action validates `task.workspaceId === session.activeWorkspaceId` before reading or updating. Automated test `tasks-security-confinement.test.ts` validates 100% rejection. |
| **Private Standup Note Leakage** | Peer developer inspects network tab or team standup feed and reads another developer's `privateManagerNote`. | High | Server-side query projection excludes `privateManagerNote` unless `currentUser.role === 'manager' \|\| 'admin'` or `submission.userId === session.uid`. Verified via `standup-privacy-hardening.test.ts`. |
| **Mobile Tap Target Inaccessibility** | Button or checkbox on mobile is $< 44\text{px}$, causing mis-taps or rage clicks on touchscreens. | High | Automated DOM bounding-box tests in `TasksAccessibilityAudit.test.tsx` assert all interactive triggers meet `min-h-[44px] min-w-[44px]`. |
| **Screen Reader Navigation Failure** | VoiceOver/NVDA users cannot determine task status, priority, or action dialog purposes due to missing ARIA tags. | High | Enforce `aria-label`, `aria-describedby`, and `<DialogDescription className="sr-only">`. Audit verified with testing-library accessibility queries. |
| **High-Volume Pagination Memory Spike** | Loading 5,000 tasks causes client-side state explosion or Firestore socket timeouts. | High | Cursor pagination test verifies that fetching subsequent pages uses `startAfter(lastDoc)` and keeps memory consumption linear ($O(k)$ per page). |
| **Downstream Obligation Sync Drift** | Task marked done but contract obligation remains pending or failed without notification. | High | Data reconciliation suite asserts that all completed contract-linked tasks trigger reverse hooks and transition to `obligationSyncStatus: 'synced'`. |
| **AI Copilot Hallucination Injection** | AI task generation creates un-vetted tasks directly in Firestore without user approval. | High | Policy audit asserts that `suggestTaskChecklistAction` and `generateTaskFromPromptAction` only return structured drafts; zero direct Firestore writes occur without explicit user confirmation. |

---

## File Structure & Impact Surface

```text
src/
├── platform/
│   └── domains/
│       └── tasks_productivity/
│           └── __tests__/
│               ├── tasks-security-confinement.test.ts              [Create: Cross-tenant & anti-IDOR tests]
│               ├── tasks-scale-performance.test.ts                 [Create: Volume & cursor pagination stress tests]
│               └── tasks-data-integrity-reconciliation.test.ts     [Create: Lifecycle & reverse sync reconciliation tests]
├── lib/
│   └── __tests__/
│       └── standup-privacy-hardening.test.ts                       [Create: Private manager note redaction tests]
└── app/
    └── admin/
        ├── tasks/
        │   └── components/
        │       └── __tests__/
        │           ├── TasksAccessibilityAudit.test.tsx            [Create: WCAG 2.1 AA & touch target audit tests]
        │           └── TasksResponsiveViewport.test.tsx            [Create: Mobile, tablet & desktop layout tests]
        └── standups/
            └── components/
                └── __tests__/
                    └── StandupPrivacyAudit.test.tsx                [Create: UI privacy protection component tests]
docs/
└── tasks/
    └── tasks_phase_6_production_readiness_report.md                [Create: Official §79 Production Readiness Report]
```

---

## Detailed Bite-Sized Implementation Tasks

### Task 1: Cross-Tenant Authorization, Direct Invocation & Anti-IDOR Security Suite
*Enforces Rule 8 (Security & Anti-IDOR), Rule 12 (Server-Side Risk), Rule 16 (Agent Principal), and Rule 47 (Workspace Confinement).*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`

- [ ] **Step 1: Write failing tests for cross-tenant isolation and anti-IDOR**
  - Test 1: Calling `updateTaskAction` with a `taskId` belonging to a foreign workspace returns `{ success: false, error: 'Unauthorized' }`.
  - Test 2: Calling `deleteTaskAction` across workspace boundaries aborts without deleting the document.
  - Test 3: Calling `bulkUpdateTasksAction` with an array containing both permitted and foreign workspace task IDs rejects the foreign IDs and enforces atomicity.
  - Test 4: Calling `retryTaskObligationSyncAction` with foreign workspace credentials returns permission failure.
  - Test 5: Capability contracts reject execution when `principal.workspaceId` does not match `input.workspaceId`.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`
  Expected: FAIL (or verify security coverage).
- [ ] **Step 3: Harden security checks across server actions and capability contracts**
  Ensure all server actions in `src/lib/task-server-actions.ts` and `src/lib/tasks/task-core.ts` strictly verify workspace tenancy and anti-IDOR boundaries.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement cross-tenant authorization and anti-IDOR security suite`

---

### Task 2: Standup Privacy & Sensitive Data Leakage Elimination Suite
*Enforces Rule 8 (Privacy & Security), Rule 10 (Guidance), Roadmap §79, and PRD §20.*

**Files:**
- Create: `src/lib/__tests__/standup-privacy-hardening.test.ts`
- Create: `src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`

- [ ] **Step 1: Write failing tests for private manager notes redaction**
  - Test 1: In `standup-server-actions.ts`, querying team standups for non-manager peers returns records with `privateManagerNote` redacted (`undefined` or `null`).
  - Test 2: Only workspace managers, admins, or the authoring user receive the decrypted/unredacted `privateManagerNote`.
  - Test 3: In `TeamOverviewView.tsx`, `screen.queryByText(/private/i)` never reveals manager note content to unauthorized peer viewers.
  - Test 4: Standup CSV/JSON export actions sanitize and strip `privateManagerNote` for non-administrative roles.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/lib/__tests__/standup-privacy-hardening.test.ts src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Verify and enforce privacy projections in standup server actions and UI**
  Ensure server actions and components strictly filter `privateManagerNote` before returning data to the client.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/lib/__tests__/standup-privacy-hardening.test.ts src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(standups): verify private manager note redaction and data leakage elimination`

---

### Task 3: Accessibility (a11y), Screen Reader & Touch Target Compliance Suite
*Enforces Rule 1 (Modal & UI Standards), Rule 7 (Touch Targets $\ge 44\text{px}$ & Plain UI English), and Roadmap §79.*

**Files:**
- Create: `src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`

- [ ] **Step 1: Write accessibility verification tests**
  - Test 1: Verify all interactive buttons, card triggers, checkboxes, and filters across `TaskListRow`, `TaskCard`, `CompactTaskCard`, and `TaskDetailDrawer` meet `min-h-[44px] min-w-[44px]`.
  - Test 2: Verify all interactive buttons include tactile feedback classes (`active:scale-[0.97]`).
  - Test 3: Verify keyboard navigation: `TaskCard` and `TaskListRow` can be focused via `Tab` and activated via `Enter` or `Space`.
  - Test 4: Verify screen reader attributes: modals use `<DialogDescription className="sr-only">`, icon-only buttons include descriptive `aria-label`, and status badges include semantic text.
  - Test 5: Verify single-circle `CardInfoTooltip` rendered at `z-[10050]` with no outer button border ring.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Apply accessibility fixes if any regressions or non-compliant controls are detected**
  Ensure all component markup complies with WCAG 2.1 AA.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement WCAG 2.1 AA accessibility and mobile touch target compliance suite`

---

### Task 4: Cross-Device Responsive Layout Verification (Desktop, Tablet, Mobile)
*Enforces Rule 1 (Design Standards), Rule 7 (Mobile-First UX), and Roadmap §79.*

**Files:**
- Create: `src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`

- [ ] **Step 1: Write responsive viewport integration tests**
  - Test 1: Desktop viewport ($\ge 1024\text{px}$): `TaskDetailDrawer` renders as slide-over right panel; Kanban board renders multi-column layout with horizontal scroll.
  - Test 2: Mobile viewport ($< 768\text{px}$): `TaskDetailDrawer` renders as full-width bottom sheet; toolbar filters collapse into mobile sheet / filter trigger; `TaskListRow` adapts gracefully to stacked card layout.
  - Test 3: Long titles & content stress: 200-character titles truncate with ellipsis without breaking card layout or overflowing containers.
  - Test 4: Empty states & loading states: `TaskEmptyState`, `TaskSkeleton`, and no-data analytics cards render cleanly without UI jitter.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Refine responsive styling where necessary**
  Verify responsive classes (`hidden sm:flex`, `flex-col sm:flex-row`, `w-full sm:w-auto`).
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement cross-device responsive layout verification suite`

---

### Task 5: Scale, Concurrency & High-Load Stress Suite (500, 5,000, 50,000 Tasks)
*Enforces Rule 9 (Load & Concurrency Protection), Rule 18 (TOCTOU), and Roadmap §79.*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`

- [ ] **Step 1: Write synthetic volume performance and concurrency stress tests**
  - Test 1: Cursor pagination benchmark: simulate 500, 5,000, and 50,000 task datasets; verify pagination with `limit(50)` + `startAfter` maintains linear memory usage and execution $< 50\text{ms}$.
  - Test 2: In-memory filter benchmark: filtering 5,000 tasks by priority, status, category, and search query executes in $< 20\text{ms}$ with memoization.
  - Test 3: Concurrent mutation stress: simulate 20 parallel updates to distinct tasks in the same workspace; verify zero deadlocks and 100% success rate.
  - Test 4: TOCTOU race simulation: simulate 2 concurrent updates to the same task with stale `expectedUpdatedAt`; verify exactly one succeeds and the other fails safely with concurrency error.
  - Test 5: Reminder queue processing: simulate 500 scheduled reminders; verify batch processing chunks without exceeding memory or transaction limits.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Optimize query helpers, memoization, and batching if bottlenecks are identified**
  Ensure performant execution under large loads.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement scale stress testing and concurrency benchmarks`

---

### Task 6: Data Integrity & Downstream Synchronization Reconciliation Suite
*Enforces Rule 2 (Integrity), Rule 3 (Cross-Module Observability), and Roadmap §79.*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`

- [ ] **Step 1: Write data integrity reconciliation tests**
  - Test 1: Task completion lifecycle: completing a task updates `status: 'done'`, sets `completedAt`, emits domain event `task.completed`, and updates activity log.
  - Test 2: Task reopening lifecycle: reopening a completed task sets `status: 'todo'`, clears `completedAt`, and logs activity.
  - Test 3: Reverse hook reconciliation: completing a contract-linked task triggers `syncTaskCompletionToObligation` and verifies that contract obligation status reflects task state.
  - Test 4: Standup commitments & carryovers: submitting a standup extracts blockers to the `blockers` collection and records planned work items. Incomplete commitments correctly carry over.
  - Test 5: Analytics metrics mathematical reconciliation: verify that `calculateTaskAnalytics` aggregates (completion rate, overdue count, blocker counts) match ground-truth raw task counts.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement data integrity validations and assertions**
  Ensure end-to-end mathematical correctness across all state machines.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement data integrity and downstream synchronization reconciliation suite`

---

### Task 7: Official Phase 6 Production Readiness Report & Checklist Generation
*Enforces Roadmap §79, PRD §20, and Definition of Done.*

**Files:**
- Create: `docs/tasks/tasks_phase_6_production_readiness_report.md`

- [ ] **Step 1: Compile verification evidence across all 4 pillars**
  - Pillar 1: Security (Cross-tenant, direct invocation, bulk operations, MCP authorization, AI permissions, export permissions, private standup notes).
  - Pillar 2: UI & Accessibility (Desktop, Tablet, Mobile, Keyboard, Screen reader, Empty/Loading/Error/Permission states, Long titles, Large datasets, Multiple assignees, No-data dashboards).
  - Pillar 3: Performance (500, 5,000, 50,000 tasks, Large filters, Large exports, Concurrent mutations, Background reminders).
  - Pillar 4: Data Integrity (Completion, Reopening, Contract obligation sync, Automation tasks, AI tasks, Standup links, Carryovers, Analytics reconciliation).
- [ ] **Step 2: Generate `docs/tasks/tasks_phase_6_production_readiness_report.md`**
  Produce the formal, signed-off markdown document containing detailed test results, benchmark metrics, checklist states, and architectural certifications.
- [ ] **Step 3: Commit**
  Git commit: `docs(tasks): publish Phase 6 production readiness checklist report`

---

### Task 8: End-to-End Quality Gates & Final System Certification
*Enforces Rule 1, 2, 4, 5, 7, 8, 9, 10, and Definition of Done.*

**Files:**
- Complete repository codebase across all tasks and related hubs.

- [ ] **Step 1: Run complete repository test suites for Tasks & Productivity**
  Execute all unit, integration, and security test suites:
  ```bash
  pnpm test:run src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/components/dashboard/ src/platform/domains/tasks_productivity/ src/lib/__tests__/
  ```
  Expected: 100% test pass rate across all suites.
- [ ] **Step 2: Run Full TypeScript Typecheck**
  Execute repository-wide typecheck:
  ```bash
  pnpm typecheck
  ```
  Expected: 0 errors in tasks, standups, analytics, and contracts.
- [ ] **Step 3: Run ESLint with 8GB Memory Allocation**
  Execute ESLint over all tasks hubs:
  ```bash
  NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/platform/domains/tasks_productivity/
  ```
  Expected: 0 errors, 0 warnings.
- [ ] **Step 4: Verify Zero `any` or `any[]` Invariant**
  Scan all tasks source files for `any` or `any[]`:
  ```bash
  grep -rn "any\[\]" src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/platform/domains/tasks_productivity/
  ```
  Expected: 0 matches.
- [ ] **Step 5: Senior Principal Systems & AI Agent Architect Review**
  Dispatch review request to `senior_principal_architect` subagent to perform final review of Phase 6 against PRD §20 and Roadmap §79.
- [ ] **Step 6: Final git commit for Phase 6**
  Git commit: `feat(tasks): complete Phase 6 production readiness, security, performance, and accessibility certification`

---

## Verification & Architecture Review Plan

1. **Automated CI/CD Quality Gates:**
   - 100% pass across all test suites (unit, integration, security, performance, reconciliation).
   - Zero TypeScript compiler diagnostics (`tsc --noEmit`).
   - Zero ESLint warnings or errors across all tasks and standup modules.
   - Zero `any` or `any[]` occurrences in application/domain code.

2. **Architectural Checklist for Final Production Sign-off:**
   - [ ] Cross-tenant isolation proven with automated penetration tests.
   - [ ] Private standup notes strictly redacted for non-manager peers.
   - [ ] All interactive touch targets $\ge 44\text{px}$ with `active:scale-[0.97]` transitions.
   - [ ] Keyboard navigation journeys complete without mouse interaction.
   - [ ] Scale benchmarks confirm $< 50\text{ms}$ query latency on 50,000 tasks via cursor pagination.
   - [ ] Bi-directional downstream obligation synchronization verified with zero silent failures.
   - [ ] Official Production Readiness Report published and archived in `docs/tasks/`.
