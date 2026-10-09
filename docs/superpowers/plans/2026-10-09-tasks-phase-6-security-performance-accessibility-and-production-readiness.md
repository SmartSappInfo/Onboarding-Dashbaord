# Tasks Phase 6: Production Readiness, Security, Performance, Accessibility & Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Governance Notice:** Conforms strictly to all 25 rules in `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `theme.md` (Section 8 Modal Architecture), `docs/tasks/tasks_roadmap_ui.md` (§79, §80–92), `docs/tasks/tasks_prd.md` (§14 Acceptance Criteria, §15 Non-functional Requirements), `docs/tasks/tasks_ui_spec.md` (Phase 6 & Responsive Behavior), `docs/tasks/tasks_idea.md`, and `docs/tasks/tasks_feature_current.md`.
>
> **Execution Gate:** STRICT EXECUTION LOCK. Do NOT begin executing tasks until explicitly approved by the user.

**Goal:** Formally audit, stress-test, and certify the entire SmartSapp Tasks and Productivity architecture for enterprise production deployment across Security (anti-IDOR, tenant isolation, private standup notes), UI & Accessibility (WCAG 2.1 AA, 44px touch targets, mobile responsiveness), Performance (50,000 tasks scale, sub-50ms cursor pagination), and Data Integrity (lifecycle state machines, reverse sync reconciliation), generating the official Phase 6 Production Readiness Report (§79).

**Architecture:** A comprehensive verification and hardening layer built on top of the completed Phase 1–5 implementations (mutation core, task editor, execution drawer, standups, analytics, AI copilot, and cross-module compact cards). Implements automated multi-tenant attack simulations, standup private note redaction audits, viewport/touch-target compliance tests, synthetic load benchmarks with cursor pagination, and end-to-end mathematical data reconciliation suites before producing the certified sign-off documentation.

**Tech Stack:** Next.js 15, React 19, Cloud Firestore with Security Rules, TypeScript (strict zero-any mode), Vitest, React Testing Library, Lucide Icons, Tailwind CSS, Emil Kowalski tactile animations, Zod validation schemas.

---

## 1. High-Level Synthesis of Tasks Documentation & Current Status

### 1.1 Document Review & Foundation Analysis
- **`tasks_roadmap_ui.md` (§79 & §80–92):** Outlines the definitive Phase 6 production readiness checklist spanning 4 core pillars: Security (cross-tenant, direct invocation, bulk operations, MCP, private standup notes), UI/Accessibility (desktop/tablet/mobile, keyboard navigation, empty/loading/error states, long content resilience), Performance (500, 5,000, 50,000 task datasets, cursor pagination, concurrent mutations), and Data Integrity (lifecycle state machines, contract obligation sync, standup commitments/carryovers, analytics reconciliation). Defines AI agent execution rules 1–12.
- **`tasks_ui_spec.md` (Phase 6 & Responsive Behavior):** Establishes acceptance criteria for end-to-end responsive fidelity (Desktop $\ge 1024\text{px}$, Tablet $768\text{px}-1023\text{px}$, Mobile $< 768\text{px}$), accessible touch targets ($\ge 44\text{px} \times 44\text{px}$), zero reliance on hover/drag alone for critical actions, resilient skeletons matching content geometry, and privacy-aware product adoption tracking.
- **`tasks_prd.md` (§14 & §15):** Specifies rigorous verification matrix: SEC-01 to SEC-04 (tenant confinement, closed failure modes), MUT-01 to MUT-03 (canonical server action paths), AUT-01 to AUT-02 (immutable field protection), MOB-01 (44px touch targets), REM-01 to REM-03 (reminder deduplication), DSG-01 (DocSigning obligation recovery), SCL-01 to SCL-02 (cursor pagination sub-50ms latency), STN-01 to STN-04 (private manager note redaction), and AN-01 to AN-04 (analytics reconciliation).
- **`tasks_feature_current.md`:** Identifies baseline architectural bifurcations (VULN-01 through VULN-04, dual mutation architecture, unmetered client writes, untrusted tenant IDs) and sets the technical standard for total remediation.
- **`tasks_idea.md`:** Frames the 6 core pillars of the unified Tasks platform: Task & Work Management, Daily Standups, Performance Analytics, AI Copilot, CRM-Aware Execution, and Automation Extensibility.

### 1.2 Status of Implemented Phases (Phase 1 — Phase 5 Baseline)
- **Phase 1 (UI Foundations & Trustworthy Feedback):** Implemented canonical primitives (`TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`, `TaskSourceBadge`), system states (`TaskEmptyState`, `TaskErrorState`, `TaskSkeleton`), `ConfirmDialog`, `BulkActionReviewDialog`, `TaskListRow`, and `TaskCard` with optimistic mutation locks. Mutation core secured in `task-core.ts` and `task-server-actions.ts`.
- **Phase 2 (Core Experience & Workspace Standards):** Implemented standardized `TaskEditor` modal with progressive disclosure, client-mode `<TagSelector>`, strict keyboard accessibility (non-drag status toggles), and theme.md §8 modal compliance.
- **Phase 3 (Reminders, Checklists, Relationships & Detail Drawer):** Delivered `TaskRemindersEditor` with channel persistence, `TaskChecklist` with interactive reordering and progress tracking, `TaskRelationshipBadge` with centralized routing, slide-over `TaskDetailDrawer`, quick filter chips, and scope switcher.
- **Phase 4 (Scale, Standups, Analytics & AI Copilot):** Implemented `/admin/standups` with draft saving, final submission, blocker synchronization into first-class `blockers` collection, `BlockerResolutionDrawer`, `/admin/task-analytics` with cycle time and throughput KPIs, and AI copilot actions (`suggestTaskChecklistAction`, `generateTaskFromPromptAction`).
- **Phase 5 (Cross-Module Harmonization & Resilient Integration):** Standardized cross-module task display with universal canonical `<CompactTaskCard>`, harmonized Dashboard `TaskWidget` with `limit(10)` bound, updated CRM Entity and Deals Detail tasks views with in-place `TaskDetailDrawer`, hardened downstream contract obligation reverse hook (`task-obligation-sync.contract.ts`, `retryTaskObligationSyncAction` with TOCTOU concurrency checks, alert banners, and failure indicators).

---

## 2. Comprehensive Agents & MCP Rules Compliance Mapping (All 25 Rules)

### Part I: Foundation Rules (Rules 1 – 10)
| Rule | Mandate & Intent | Phase 6 Verification & Implementation Defense |
|---|---|---|
| **Rule 1: Design Standards & UI Consistency** | Next.js 15, React 19, `emilkowal-animations`, `frontend-design`, `backend-design`, `theme.md` §8. | Comprehensive audit of all modals, dialogs, drawers, and cards against Section 8 Modal Architecture. Verifies demarcated headers (`<DialogHeader demarcated>`), single-circle `CardInfoTooltip` (`z-[10050]`), `sr-only` descriptions, and demarcated footers with tactile `active:scale-[0.97]` buttons. |
| **Rule 2: Risk Analysis, Prevention & Scalability** | Proactive failure mode analysis, clean refactoring, test-driven validation, zero remote pushes. | Detailed Risk Analysis & Failure Modes Matrix below. Every verification gate executed via automated test suites. Strictly local commits; zero `git push`. |
| **Rule 3: Cross-Module Observability & Backoffice Governance** | Backoffice management without code changes; zero broken downstream dependencies. | Audits backoffice visibility of task obligation sync states, standup submissions, blocker escalations, and system health metrics without code changes. |
| **Rule 4: Strict Typing Policy** | Zero `any` or `any[]`. No unchecked casts in domain code. Inferred/explicit types. Validate `unknown` at boundaries. | Absolute ban on `any` and `any[]`. Automated repository scan verifies zero occurrences across all tasks hubs. External payloads validated via Zod schemas. |
| **Rule 5: Deployment, Staging & Rule Safety** | Stage and verify rules/indexes before deployment. Never auto-deploy security-sensitive changes. | Validates Firestore security rules for `tasks`, `standups`, `blockers`, and `contract_obligations` with automated rule simulation tests. Production deployment checklist enforces explicit approval. |
| **Rule 6: Dependency & Documentation Standards** | No unvetted dependencies. Use official SDKs and latest documentation via Context7. | Verifies all packages against allowed dependencies. No unvetted external libraries added. |
| **Rule 7: Mobile-First, Touch Targets & Everyday Plain UI English** | Touch targets $\ge 44\text{px} \times 44\text{px}$. Gesture/viewport support. Minimal, plain everyday UI English. No verbose walls of text. | Automated viewport and tap-target audit tests verify $\ge 44\text{px}$ across all interactive buttons, filter chips, checkboxes, and drawer drag handles. Copy audited for concise everyday English. |
| **Rule 8: Security, Anti-IDOR & Zero Trust** | Workspace confinement, tenant isolation, anti-IDOR checks, safe relative navigation starting with `/`. | Comprehensive cross-tenant attack simulation suite testing direct action invocations with spoofed workspace tokens. All actionable toast paths verified to start with `/`. |
| **Rule 9: Concurrency, Load & Resource Protection** | Avoid batch overload, resource exhaustion, or unbounded queries. | Scale stress testing with up to 50,000 synthetic tasks. Verifies cursor-based pagination (`startAfter`), bounded queries (`limit`), and memory footprint safety under ESLint 8GB flag. |
| **Rule 10: Inline Architectural Guidance** | Clear code comments explaining what changed, why, caution areas, and testability pointers. | Verifies structured header documentation and maintainer guidance comments across all tasks architecture files. |

### Part II: Protocol, Agentic & MCP Rules (Rules 11 – 25)
| Rule | Mandate & Intent | Phase 6 Verification & Implementation Defense |
|---|---|---|
| **Rule 11: MCP Protocol Compliance** | Target current supported MCP specification (`2026-07-28`), stateless execution, split `@modelcontextprotocol/server`, SDK v2 standards. | Audits capability contracts (`task.create`, `task.update`, `task.complete`, `task.search`, `task.get`, `standup.submit`, `blocker.mutate`, `task.obligation.sync`) for stateless operation. |
| **Rule 12: Server-Side Risk Enforcement** | Risk classifications enforced server-side independently of client/MCP metadata hints. | Verifies that all mutating task capabilities enforce `L2_STATE_MUTATION` server-side permission checks and reject unauthorized callers regardless of metadata hints. |
| **Rule 13: Formal Trust Boundary Matrix** | Data entering agent/system has explicit trust classification. External data treated as untrusted. | Verifies strict narrowing of `USER TRUST`, `SYSTEM TRUST`, `TENANT TRUST`, `AGENT TRUST`, and `EXTERNAL DATA` across all endpoints. |
| **Rule 14: MCP Tool Poisoning / Rug-Pull Defense** | Tool definitions versioned, fingerprinted with schemaHash, descriptionHash, permissionHash, riskHash. | Audits capability definition hashes to ensure no task tool signature has mutated unexpectedly since registration. |
| **Rule 15: Server Allowlisting & Supply-Chain Controls** | External MCP servers allowlisted, provenance-verified, version-pinned, dependency-scanned. | Verifies that task and standup capabilities only route through verified, allowlisted internal domain tools. |
| **Rule 16: Agent Identity as Security Principal** | Security principal includes `organizationId`, `workspaceId`, `userId`, `actorType`, `agentId`. | Validates that agent-initiated task actions preserve `actorType: 'agent'` and do not inherit unearned administrative privileges. |
| **Rule 17: Non-Delegable Privileges** | Administrative permissions cannot be delegated to autonomous agents. | Tests verify that agents cannot delete workspaces, alter tenant isolation, or override global security policies via task capabilities. |
| **Rule 18: TOCTOU Concurrency Protection** | Prevent time-of-check to time-of-use races using version/timestamp tokens. | Concurrency tests verify that simultaneous task mutations evaluate `expectedUpdatedAt` and gracefully abort on stale versions without data clobbering. |
| **Rule 19: Mutating Action Idempotency** | Define idempotency keys and retry semantics for every mutation. | Network retry simulation tests verify that duplicate calls with the same `idempotencyKey` return identical successful results without duplicate side-effects. |
| **Rule 20: Replay & Duplicate Delivery Protection** | Unique execution identifiers (`executionId`, `idempotencyKey`). | Verifies execution tracking across downstream agreement sync, standup submissions, and blocker state changes. |
| **Rule 21: Two-Phase Action Model for High-Risk Work** | High-risk operations follow `PLAN` $\to$ `PREVIEW` $\to$ `APPROVE` $\to$ `EXECUTE` $\to$ `VERIFY`. | Audits `BulkActionReviewDialog` to verify that bulk updates and deletions require two-phase user confirmation before mutating data. |
| **Rule 22: Approval Binding** | Approvals bound to exact operation parameters and invalidate if underlying record changes. | Verifies that modifying a task or bulk selection after initial review invalidates prior confirmation tokens. |
| **Rule 23: Budget, Backpressure & Resource Governance** | Agent runs enforce execution bounds (`maxDuration`, `maxRecordsMutated`, `maxTokens`). | Verifies that AI Copilot task generation limits output tokens, checklist item counts ($\le 10$), and aborts on excessive recursion. |
| **Rule 24: Circuit Breakers** | Graceful fail-fast when external services or AI models throttle or degrade. | Tests verify that if AI Copilot or downstream sync encounters 429/503 errors, the UI falls back to manual entry without freezing. |
| **Rule 25: Human-in-the-Loop Interventions & Audit Trail** | Full immutable event logging, user override, and clear attribution of human vs AI changes. | Verifies that every task, standup, and blocker event emits an audit log entry in `activity_logs` distinguishing human vs agent actors. |

---

## 3. Backoffice Impact & Observability Governance (Rule 3)

### How Tasks & Productivity Relates to the Backoffice
1. **Capability Governance Matrix (`/backoffice/capability-governance`):**
   - The task capability contracts (`task.obligation.sync`, `task.create`, `task.update`) must be visible, inspectable, and toggleable by system administrators without code changes.
2. **Contract Obligation Reverse Sync Health Monitor:**
   - Backoffice administrators must be able to view workspaces with high obligation sync failure rates and trigger batch reconciliation jobs directly from the backoffice interface.
3. **Standup & Blocker Escalation Thresholds:**
   - Workspace-level standup configurations (submission deadlines, reminder channels, blocker auto-escalation to management) are managed via Backoffice System Governance.
4. **Zero-Code Observability:**
   - Any failure in the downstream reverse hook or AI copilot generates structured audit logs queryable in the Backoffice Audit Log viewer.

---

## 4. Proactive Risk Analysis & Failure Modes Matrix (Rule 2)

| Failure Mode / Security Vulnerability | Root Cause | Severity | Prevention & Verification Defense |
|---|---|---|---|
| **Cross-Tenant IDOR Breach** | User passes a valid `taskId` belonging to Workspace B while authenticated in Workspace A. | Critical | Server action validates `task.workspaceId === session.activeWorkspaceId` before reading or updating. Automated test `tasks-security-confinement.test.ts` validates 100% rejection. |
| **Direct Unauthenticated Invocation** | Next.js exports an internal mutation core from a `'use server'` file without auth wrapper. | Critical | Static analysis & AST security test asserts that `task-core.ts` contains no `'use server'` directive and only authenticated actions are exported. |
| **Private Standup Note Leakage** | Peer developer inspects network tab or team standup feed and reads another developer's `privateManagerNote`. | High | Server-side query projection excludes `privateManagerNote` unless `currentUser.role === 'manager' \|\| 'admin'` or `submission.userId === session.uid`. Verified via `standup-privacy-hardening.test.ts` and `StandupPrivacyAudit.test.tsx`. |
| **Mobile Tap Target Inaccessibility** | Button or checkbox on mobile is $< 44\text{px}$, causing mis-taps or rage clicks on touchscreens. | High | Automated DOM bounding-box tests in `TasksAccessibilityAudit.test.tsx` assert all interactive triggers meet `min-h-[44px] min-w-[44px]`. |
| **Screen Reader Navigation Failure** | VoiceOver/NVDA users cannot determine task status, priority, or action dialog purposes due to missing ARIA tags. | High | Enforce `aria-label`, `aria-describedby`, and `<DialogDescription className="sr-only">`. Audit verified with testing-library accessibility queries. |
| **High-Volume Pagination Memory Spike** | Loading 5,000 tasks causes client-side state explosion or Firestore socket timeouts. | High | Cursor pagination test verifies that fetching subsequent pages uses `startAfter(lastDoc)` and keeps memory consumption linear ($O(k)$ per page). |
| **Downstream Obligation Sync Drift** | Task marked done but contract obligation remains pending or failed without notification. | High | Data reconciliation suite asserts that all completed contract-linked tasks trigger reverse hooks and transition to `obligationSyncStatus: 'synced'`. |
| **AI Copilot Hallucination Injection** | AI task generation creates un-vetted tasks directly in Firestore without user approval. | High | Policy audit asserts that `suggestTaskChecklistAction` and `generateTaskFromPromptAction` only return structured drafts; zero direct Firestore writes occur without explicit user confirmation. |

---

## 5. File Structure & Verification Impact Surface

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

## 6. Detailed Bite-Sized Implementation Tasks

### Task 1: Cross-Tenant Authorization, Direct Invocation & Anti-IDOR Security Suite
*Enforces Rule 8 (Security & Anti-IDOR), Rule 12 (Server-Side Risk), Rule 16 (Agent Principal), Rule 17 (Non-Delegable Privileges), and PRD §14.1 (SEC-01–SEC-04).*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`
- Modify: `src/lib/task-server-actions.ts` (if any security gap detected during testing)
- Modify: `src/lib/tasks/task-core.ts` (if any multi-tenant boundary gap detected)

- [ ] **Step 1: Write failing security tests for cross-tenant isolation and anti-IDOR**
  - Test 1 (SEC-01): Verify that `task-core.ts` is not marked `'use server'`, ensuring core mutation functions are never directly callable over HTTP RPC.
  - Test 2 (SEC-02): Verify that `createTaskAction` rejects requests where `data.workspaceId` does not match the authenticated session workspace.
  - Test 3 (SEC-03): Verify that `updateTaskAction`, `deleteTaskAction`, and `retryTaskObligationSyncAction` reject IDs belonging to a foreign workspace (anti-IDOR).
  - Test 4 (SEC-04): Verify that `bulkUpdateTasksAction` and `bulkDeleteTasksAction` reject mixed-workspace arrays, aborting without modifying foreign records.
  - Test 5 (Rule 12 & 16): Verify capability contract `task.obligation.sync` rejects execution when `principal.workspaceId` does not match `input.workspaceId`.
- [ ] **Step 2: Run test to verify execution**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`
  Expected: Executes and identifies any security discrepancies.
- [ ] **Step 3: Implement any required security hardening**
  Address any detected edge cases in server action session guards.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-security-confinement.test.ts`
  Expected: All 5 security tests pass with 100% assertions satisfied.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement cross-tenant authorization and anti-IDOR security suite`

---

### Task 2: Standup Privacy & Sensitive Data Leakage Elimination Suite
*Enforces Rule 8 (Privacy & Security), Rule 13 (Trust Boundaries), Roadmap §79, and PRD §14.4 (STN-04).*

**Files:**
- Create: `src/lib/__tests__/standup-privacy-hardening.test.ts`
- Create: `src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`
- Modify: `src/lib/standup-server-actions.ts` (if any projection leak identified)
- Modify: `src/app/admin/standups/components/TeamOverviewView.tsx` (if any UI leakage identified)

- [ ] **Step 1: Write failing privacy tests for private manager notes redaction**
  - Test 1 (Backend Projection): Calling `getStandupsForDateAction` as a peer team member strips `privateManagerNote` from other users' submissions.
  - Test 2 (Privileged Access): Calling `getStandupsForDateAction` as a workspace admin (`system_admin`) or as the authoring user returns the intact `privateManagerNote`.
  - Test 3 (UI Confinement): In `TeamOverviewView`, verify that `privateManagerNote` is rendered ONLY for privileged users or the submission author, never appearing in peer cards.
  - Test 4 (Export Sanitization): Verify any standup JSON/CSV export routines omit `privateManagerNote` for non-administrative roles.
- [ ] **Step 2: Run tests to verify failure**
  Run: `pnpm test:run src/lib/__tests__/standup-privacy-hardening.test.ts src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`
  Expected: Identifies privacy leakage vectors.
- [ ] **Step 3: Harden privacy projections in standup server actions and UI**
  Ensure server actions and components strictly filter `privateManagerNote` before returning data to the client.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/lib/__tests__/standup-privacy-hardening.test.ts src/app/admin/standups/components/__tests__/StandupPrivacyAudit.test.tsx`
  Expected: All tests pass cleanly.
- [ ] **Step 5: Commit**
  Git commit: `test(standups): verify private manager note redaction and data leakage elimination`

---

### Task 3: Accessibility (a11y), Screen Reader & Touch Target Compliance Suite
*Enforces Rule 1 (Modal & UI Standards), Rule 7 (Touch Targets $\ge 44\text{px}$ & Plain UI English), Roadmap §79, and PRD §14.2 (MOB-01).*

**Files:**
- Create: `src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`
- Modify: Component files if any touch target $< 44\text{px}$ or missing ARIA tag is discovered.

- [ ] **Step 1: Write accessibility verification tests**
  - Test 1 (Touch Targets): Verify all interactive triggers across `TaskListRow`, `TaskCard`, `CompactTaskCard`, `TaskEditor`, and `TaskDetailDrawer` meet `min-h-[44px] min-w-[44px]` (or accessible wrapper padding).
  - Test 2 (Tactile Feedback): Verify all interactive buttons include tactile feedback classes (`active:scale-[0.97]`).
  - Test 3 (Keyboard Navigation): Verify `TaskCard`, `TaskListRow`, and `CompactTaskCard` can be focused via `Tab` and activated via `Enter` or `Space`.
  - Test 4 (Screen Reader Semantics): Verify dialogs use `<DialogDescription className="sr-only">`, icon-only buttons include descriptive `aria-label`, and status badges include semantic text.
  - Test 5 (Modal Architecture): Verify single-circle `CardInfoTooltip` rendered at `z-[10050]` with zero outer button border ring.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`
  Expected: Tests catch any accessibility regressions.
- [ ] **Step 3: Apply accessibility fixes if any non-compliant controls are detected**
  Ensure all component markup complies with WCAG 2.1 AA.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksAccessibilityAudit.test.tsx`
  Expected: All accessibility tests pass.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement WCAG 2.1 AA accessibility and mobile touch target compliance suite`

---

### Task 4: Cross-Device Responsive Layout Verification (Desktop, Tablet, Mobile)
*Enforces Rule 1 (Design Standards), Rule 7 (Mobile-First UX), Roadmap §79, and UI Spec Responsive Behavior.*

**Files:**
- Create: `src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`
- Modify: Component files if responsive layout regressions are detected.

- [ ] **Step 1: Write responsive viewport integration tests**
  - Test 1 (Desktop $\ge 1024\text{px}$): `TaskDetailDrawer` renders as slide-over right panel; Kanban board renders multi-column layout with horizontal scroll.
  - Test 2 (Mobile $< 768\text{px}$): `TaskDetailDrawer` renders as full-width bottom sheet; toolbar filters collapse into mobile sheet / filter trigger; `TaskListRow` adapts gracefully to stacked card layout.
  - Test 3 (Content Stress): 200-character titles truncate with ellipsis without breaking card layout or overflowing containers; long assignee names and many tags wrap safely.
  - Test 4 (System States): `TaskEmptyState`, `TaskSkeleton`, and no-data analytics cards render cleanly without UI jitter.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`
  Expected: Tests verify layout adaptations.
- [ ] **Step 3: Refine responsive styling where necessary**
  Verify responsive classes (`hidden sm:flex`, `flex-col sm:flex-row`, `w-full sm:w-auto`).
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TasksResponsiveViewport.test.tsx`
  Expected: All responsive tests pass.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement cross-device responsive layout verification suite`

---

### Task 5: Scale, Concurrency & High-Load Stress Suite (500, 5,000, 50,000 Tasks)
*Enforces Rule 9 (Load & Concurrency Protection), Rule 18 (TOCTOU), Rule 19 (Idempotency), Rule 23 (Resource Governance), Roadmap §79, and PRD §15 (SCL-01, SCL-02).*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`
- Modify: Query or memoization utilities if latency thresholds are exceeded.

- [ ] **Step 1: Write synthetic volume performance and concurrency stress tests**
  - Test 1 (Cursor Pagination): Benchmark dataset of 500, 5,000, and 50,000 synthetic tasks; verify pagination with `limit(50)` + `startAfter` maintains linear memory usage and execution $< 50\text{ms}$.
  - Test 2 (In-Memory Filtering): Filtering 5,000 tasks by priority, status, category, and search query executes in $< 20\text{ms}$ with memoization.
  - Test 3 (Concurrent Mutations): Simulate 20 parallel updates to distinct tasks in the same workspace; verify zero deadlocks and 100% success rate.
  - Test 4 (TOCTOU Race Simulation): Simulate 2 concurrent updates to the same task with stale `expectedUpdatedAt`; verify exactly one succeeds and the other fails safely with concurrency error.
  - Test 5 (Reminder Batch Processing): Simulate 500 scheduled reminders; verify batch processing chunks without exceeding memory or transaction limits.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`
  Expected: Tests benchmark performance under load.
- [ ] **Step 3: Optimize query helpers, memoization, and batching if bottlenecks are identified**
  Ensure performant execution under large loads.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-scale-performance.test.ts`
  Expected: All performance benchmarks pass.
- [ ] **Step 5: Commit**
  Git commit: `test(tasks): implement scale stress testing and concurrency benchmarks`

---

### Task 6: Data Integrity & Downstream Synchronization Reconciliation Suite
*Enforces Rule 2 (Integrity), Rule 3 (Cross-Module Observability), Rule 20 (Duplicate Delivery Protection), Roadmap §79, and PRD §14.5 (INT-01, OPS-01).*

**Files:**
- Create: `src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`
- Modify: Sync or analytics services if reconciliation discrepancies are found.

- [ ] **Step 1: Write data integrity reconciliation tests**
  - Test 1 (Task Completion Lifecycle): Completing a task updates `status: 'done'`, sets `completedAt`, emits domain event `task.completed`, and updates activity log.
  - Test 2 (Task Reopening Lifecycle): Reopening a completed task sets `status: 'todo'`, clears `completedAt`, and logs activity.
  - Test 3 (Reverse Hook Reconciliation): Completing a contract-linked task triggers `syncTaskCompletionToObligation` and verifies that contract obligation status reflects task state.
  - Test 4 (Standup Commitments & Carryovers): Submitting a standup extracts blockers to the `blockers` collection and records planned work items. Incomplete commitments correctly carry over.
  - Test 5 (Analytics Reconciliation): Verify that `calculateTaskAnalytics` aggregates (completion rate, overdue count, blocker counts) match ground-truth raw task counts; cancelled tasks excluded from completion rate.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`
  Expected: Tests identify any state synchronization drift.
- [ ] **Step 3: Implement data integrity validations and assertions**
  Ensure end-to-end mathematical correctness across all state machines.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/__tests__/tasks-data-integrity-reconciliation.test.ts`
  Expected: All data integrity tests pass.
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
*Enforces Rules 1, 2, 4, 5, 7, 8, 9, 10, and Definition of Done.*

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
  NODE_OPTIONS='--max-old-space-size=8192' ./node_modules/.bin/eslint src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/platform/domains/tasks_productivity/ src/components/dashboard/TaskWidget.tsx
  ```
  Expected: 0 errors, 0 warnings.
- [ ] **Step 4: Verify Zero `any` or `any[]` Invariant**
  Scan all tasks source files for `any` or `any[]`:
  ```bash
  grep -rn -E ':\s*any(\[\])?' src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/platform/domains/tasks_productivity/
  ```
  Expected: 0 matches.
- [ ] **Step 5: Senior Principal Systems & AI Agent Architect Review**
  Dispatch review request to `senior_principal_architect` subagent to perform final review of Phase 6 against PRD §14, §15, and Roadmap §79.
- [ ] **Step 6: Final git commit for Phase 6**
  Git commit: `feat(tasks): complete Phase 6 production readiness, security, performance, and accessibility certification`

---

## 7. Verification & Architecture Review Plan

1. **Automated CI/CD Quality Gates:**
   - 100% pass across all test suites (unit, integration, security, performance, reconciliation).
   - Zero TypeScript compiler diagnostics (`tsc --noEmit`).
   - Zero ESLint warnings or errors across all tasks and standup modules.
   - Zero `any` or `any[]` occurrences in application/domain code.

2. **Architectural Checklist for Final Production Sign-off:**
   - [ ] Cross-tenant isolation proven with automated penetration tests.
   - [ ] Private standup notes strictly redacted for non-manager peers.
   - [ ] All interactive touch targets $\ge 44\text{px} \times 44\text{px}$ with `active:scale-[0.97]` transitions.
   - [ ] Keyboard navigation journeys complete without mouse interaction.
   - [ ] Scale benchmarks confirm $< 50\text{ms}$ query latency on 50,000 tasks via cursor pagination.
   - [ ] Bi-directional downstream obligation synchronization verified with zero silent failures.
   - [ ] Official Production Readiness Report published and archived in `docs/tasks/`.
   - [ ] Senior Principal Systems Architect formal sign-off.
