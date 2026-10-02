# Phase 4 Milestone 4 Implementation Plan
## Operator UI Surfaces: Company Brain (`/admin/brain`), Knowledge Inbox (`/admin/knowledge/inbox`) & Standardized Inspector (`theme.md` §8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the mission-control operator interfaces for the SmartSapp institutional memory system: the Company Brain workspace console (`/admin/brain`), the Knowledge Inbox triage desk (`/admin/knowledge/inbox`), and the Standardized Knowledge Item Inspector drawer strictly conforming to `theme.md` Section 8, backed by secure, authenticated Server Actions and real-time SSE stream updates.

**Architecture:** A Three-Zone reactive UI architecture powered by Next.js Server Components, client controllers (`BrainClient.tsx`, `KnowledgeInboxClient.tsx`), authenticated Server Actions (`memory-actions.ts`) wrapping `CanonicalMemoryService`, and live SSE synchronization (`useEventStream`). Full compliance with the 69 SmartSapp Agentic Development Rules, `theme.md` Section 8, and PRD Sections 62, 93, and 94.

**Tech Stack:** Next.js 14+ (App Router, Server Actions `'use server'`), React 18, Tailwind CSS, Radix UI Dialog & Tooltip primitives, Lucide React icons, Emil Kowalski tactile animations (`active:scale-[0.97]`), Vitest & React Testing Library.

---

## 1. Architectural Blueprint & Target File Map

```
src/
├── app/
│   ├── actions/
│   │   └── memory-actions.ts                         # Secure Server Actions with Anti-IDOR & Dead-Man checks
│   └── admin/
│       ├── brain/
│       │   ├── page.tsx                              # Server Route & SEO metadata for Company Brain
│       │   └── BrainClient.tsx                       # Three-Zone Client Controller & SSE Stream
│       ├── companybrain/
│       │   └── page.tsx                              # Legacy redirect to /admin/brain
│       └── knowledge/
│           └── inbox/
│               ├── page.tsx                          # Server Route & SEO metadata for Knowledge Inbox
│               └── KnowledgeInboxClient.tsx          # 6-Tab Knowledge Triage Client & SSE Stream
├── components/
│   └── brain/
│       ├── CompanyBrainMetrics.tsx                   # 4 KPI metrics cards + pulse indicators
│       ├── KnowledgeSearchBox.tsx                    # Real-time search with hybrid filter pills
│       ├── KnowledgeItemDrawer.tsx                   # theme.md §8 Standardized Inspector Drawer
│       ├── KnowledgeCandidateCard.tsx                # Inbox triage candidate card with quick actions
│       └── DeadManPauseBanner.tsx                    # High-visibility emergency pause indicator
├── platform/
│   ├── memory/
│   │   └── services/
│   │       └── canonical-memory-service.ts           # Augmented with lifecycle updates, deletion & stats
│   └── __tests__/
│       └── ui/
│           └── company-brain.test.tsx                # Exhaustive UI tests (12+ test cases)
```

---

## 2. Compliance Invariants with the 69 Agentic Development Rules

| Rule # | Requirement | Implementation in Milestone 4 |
| :--- | :--- | :--- |
| **Rule 1** | Ecosystem Compatibility | Integrates with existing `/admin/` layout; provides backwards-compatible redirect from `/admin/companybrain` $\to$ `/admin/brain`. |
| **Rule 4** | Zero `any` / `any[]` | Absolute zero `any` across all Server Actions, schemas, and UI props. Schema validation at all external boundaries. |
| **Rule 7** | Mobile & Accessibility First | $\ge 44\text{px}$ touch targets, responsive 1-to-3 column layouts, full keyboard navigation, screen-reader sr-only descriptions. |
| **Rule 8 & 47** | Fail-Closed Multi-Tenancy & Anti-IDOR | Every Server Action validates `organizationId` and `workspaceId` against authenticated Clerk profile (`requireAuth()`). |
| **Rule 9** | Load Governance & Resource Bounds | 300ms search input debouncing; paginated queries (default 20, max 100); bounded render lists. |
| **Rule 10** | Inline Architectural Documentation | Comprehensive maintainer guides, architectural notes, and testability pointers across all components. |
| **Rule 13 & 30** | Model Distrust & Anti-Poisoning | Displayed memory text is treated as untrusted data; wrapped inside `<untrusted_reference_data>` XML containers in the Inspector. |
| **Rule 21 & 40** | Domain Event Integration | Memory lifecycle actions (`verify`, `supersede`, `reject`, `delete`) publish typed events (`memory.item.*`) via `defaultEventBus`. |
| **Rule 22** | Cryptographic Hashing | SHA-256 chunk hashes displayed as badges with copy buttons on cards and in the Inspector drawer. |
| **Rule 28** | Context Budgeting | Displays token estimates and tier allocation badges on memory cards. |
| **Rule 29** | Temporal Validity & Decay | Expiration dates (`validFrom`, `validUntil`, `supersededBy`) rendered with status pills; stale items routed to dedicated Inbox tab. |
| **Rule 32** | Sensitivity Classification | Color-coded sensitivity badges (`public`, `internal`, `confidential`, `restricted`) on every item card. |
| **Rule 51** | Server Actions Security | Marked `'use server'` with strict `requireAuth()` validation; no unauthenticated endpoints. |
| **Rule 60** | Emergency Dead-Man Switch | Dead-man pause banner renders when switch is active; mutation actions throw `MEMORY_DEAD_MAN_PAUSED`. |
| **Rule 61** | Dedicated Operator Console | First-class operator control panels at `/admin/brain` and `/admin/knowledge/inbox`. |
| **Rule 62** | Live SSE Reactivity | `useEventStream` integration dynamically adds/updates items on `memory.ingestion.completed` and `memory.item.*` events. |
| **Rule 64** | Tactile Micro-Interactions | Emil Kowalski mechanical tactile feedback `active:scale-[0.97]` on all buttons, filters, and cards. |
| **Rule 69** | Strangler Fig Invariant | Fully decoupled from legacy `src/lib/memory/`. All 60 preexisting legacy tests pass untouched. |
| **theme.md §8** | Standardized Modal Architecture | `KnowledgeItemDrawer.tsx` strictly adheres to `border-border/80 bg-card shadow-2xl sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip>`, `<DialogDescription className="sr-only">`, and demarcated footer. |

---

## 3. Step-by-Step Task Breakdown

### Task 1: Augment `CanonicalMemoryService` with Lifecycle & Stats Methods
**Files:**
- Modify: `src/platform/memory/services/canonical-memory-service.ts`
- Modify: `src/platform/__tests__/memory/canonical-memory-service.test.ts`

- [ ] **Step 1.1: Write unit tests for lifecycle mutations and memory stats**
  - Test `updateLifecycleStatus(id, status, notes)` updating `lifecycle.status`, `lifecycle.verificationState`, and emitting domain event.
  - Test `deleteMemoryItem(id)` removing item from memory store, sparse BM25 index, and emitting `memory.item.deleted`.
  - Test `getMemoryStats(organizationId, workspaceId)` aggregating total items, items by tier, verification state counts, and sensitivity breakdowns.
- [ ] **Step 1.2: Implement methods in `CanonicalMemoryService`**
  - Implement `updateLifecycleStatus()`, `deleteMemoryItem()`, and `getMemoryStats()` with strict tenant checks and domain event publishing.
- [ ] **Step 1.3: Run tests and verify 100% pass**
  - Command: `pnpm vitest run src/platform/__tests__/memory/canonical-memory-service.test.ts`

---

### Task 2: Implement Secure Server Actions (`src/app/actions/memory-actions.ts`)
**Files:**
- Create: `src/app/actions/memory-actions.ts`
- Create: `src/platform/__tests__/memory/memory-actions.test.ts`

- [ ] **Step 2.1: Write unit tests for Server Actions**
  - Test `searchMemoryAction` with tenant scoping and query input.
  - Test `listKnowledgeInboxAction` filtering by tab (`new`, `insights`, `potential`, `conflicts`, `unconfirmed`, `stale`).
  - Test `inspectMemoryItemAction` returning canonical memory details.
  - Test `verifyMemoryItemAction` transitioning candidate to verified.
  - Test `rejectMemoryItemAction` transitioning candidate to rejected.
  - Test `deleteMemoryItemAction` deleting item.
  - Test `getMemoryBrainMetricsAction` returning aggregated statistics.
  - Test anti-IDOR enforcement (cross-tenant access rejection).
  - Test Rule 60 emergency dead-man switch rejection.
- [ ] **Step 2.2: Implement `src/app/actions/memory-actions.ts`**
  - Add `'use server'`.
  - Use `requireAuth()` to validate session and extract tenant scope.
  - Check `checkGovernanceDeadManSwitch` for mutations (Rule 60).
  - Enforce anti-IDOR checks (Rule 47).
  - Validate inputs with Zod schemas (Rule 4 & Rule 10).
  - Emit domain events via `defaultEventBus` (Rule 40).
- [ ] **Step 2.3: Run tests and verify 100% pass**
  - Command: `pnpm vitest run src/platform/__tests__/memory/memory-actions.test.ts`

---

### Task 3: Build Standardized Knowledge Item Inspector Drawer (`theme.md` §8)
**Files:**
- Create: `src/components/brain/KnowledgeItemDrawer.tsx`

- [ ] **Step 3.1: Implement `KnowledgeItemDrawer.tsx` strictly conforming to `theme.md` §8**
  - Surface geometry: `sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl`.
  - Demarcated header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`.
  - Single-circle `<CardInfoTooltip text="..." />` alongside title, elevated at `z-[10050]`.
  - Screen reader description: `<DialogDescription className="sr-only">`.
  - Content tabs:
    - **Overview:** Excerpt inside `<untrusted_reference_data>` container (Rule 30), markdown heading breadcrumbs (`# H1 > ## H2`), confidence score, verification status badge, sensitivity badge, temporal validity dates.
    - **Provenance & Cryptography:** SHA-256 chunk hash badge (truncated with copy button), source ID/type, author, correlation ID.
    - **Vector Embeddings:** 768-dim status, vector norm, Qdrant indexing status.
  - Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97]`).
  - Action buttons: `[Confirm / Verify]`, `[Reject / Invalidate]`, `[Delete]`.

---

### Task 4: Build Metrics, Search, Filter & Dead-Man UI Components
**Files:**
- Create: `src/components/brain/CompanyBrainMetrics.tsx`
- Create: `src/components/brain/KnowledgeSearchBox.tsx`
- Create: `src/components/brain/KnowledgeCandidateCard.tsx`
- Create: `src/components/brain/DeadManPauseBanner.tsx`

- [ ] **Step 4.1: Implement `CompanyBrainMetrics.tsx`**
  - 4 KPI cards: `Total Indexed Knowledge`, `Semantic Vectors`, `Active Sources`, `Inbox Items Pending`.
  - Subtle glowing pulse indicator and icons.
- [ ] **Step 4.2: Implement `KnowledgeSearchBox.tsx`**
  - Debounced text search input (`min-h-[44px]`).
  - Filter chips for memory tiers (`All`, `Semantic`, `Episodic`, `Relational`, `Procedural`).
  - Source type chips (`All`, `Notes`, `Meetings`, `Deals`, `Lessons`, `Documents`).
  - Sensitivity filter pills (`All`, `Public`, `Internal`, `Confidential`, `Restricted`).
- [ ] **Step 4.3: Implement `KnowledgeCandidateCard.tsx`**
  - Clean card displaying title, excerpt, source entity, confidence score, SHA-256 hash badge.
  - Quick action buttons: `[Verify]`, `[Reject]`, `[Inspect]`.
  - Emil Kowalski tactile scaling `active:scale-[0.97]`.
- [ ] **Step 4.4: Implement `DeadManPauseBanner.tsx`**
  - High-visibility banner when emergency pause is active, warning that autonomous indexing is on hold.

---

### Task 5: Build Knowledge Inbox Surface (`/admin/knowledge/inbox`)
**Files:**
- Create: `src/app/admin/knowledge/inbox/page.tsx`
- Create: `src/app/admin/knowledge/inbox/KnowledgeInboxClient.tsx`

- [ ] **Step 5.1: Implement Server Route `page.tsx`**
  - SEO metadata, `dynamic = 'force-dynamic'`, Suspense boundary.
- [ ] **Step 5.2: Implement Client Container `KnowledgeInboxClient.tsx`**
  - 6 tabs from PRD §93:
    1. `New Memories` (recent unverified items)
    2. `AI Insights` (high-confidence agent deductions)
    3. `Potential Knowledge` (unverified meeting/note takeaways)
    4. `Conflicts` (competing or superseded assertions)
    5. `Needs Confirmation` (unverified high-impact items)
    6. `Stale Memories` (expired or nearing `validUntil`)
  - Integration with `listKnowledgeInboxAction`.
  - Real-time SSE updates via `useEventStream` (Rule 62).
  - Drawer inspector integration (`KnowledgeItemDrawer.tsx`).

---

### Task 6: Build Company Brain Surface (`/admin/brain`) & Legacy Redirect
**Files:**
- Create: `src/app/admin/brain/page.tsx`
- Create: `src/app/admin/brain/BrainClient.tsx`
- Create: `src/app/admin/companybrain/page.tsx`

- [ ] **Step 6.1: Implement Server Route `src/app/admin/brain/page.tsx`**
  - SEO metadata, `dynamic = 'force-dynamic'`, Suspense boundary.
- [ ] **Step 6.2: Implement Client Container `BrainClient.tsx`**
  - Three-Zone layout (Header/Metrics, Search & Filter Bar, Knowledge Stream / Cards).
  - Search integration with `searchMemoryAction` and debounced input.
  - Drawer inspector integration (`KnowledgeItemDrawer.tsx`).
  - Real-time SSE updates via `useEventStream`.
- [ ] **Step 6.3: Implement Legacy Redirect `src/app/admin/companybrain/page.tsx`**
  - Redirects `/admin/companybrain` $\to$ `/admin/brain` using Next.js `redirect()`.

---

### Task 7: Comprehensive UI Test Suites & Verification Gates
**Files:**
- Create: `src/platform/__tests__/ui/company-brain.test.tsx`

- [ ] **Step 7.1: Author 12+ UI unit & integration tests**
  - Test metrics card rendering with live values.
  - Test search input debouncing and filter chip selection.
  - Test `KnowledgeItemDrawer` opening and strict `theme.md` §8 compliance (demarcated header, single-circle `<CardInfoTooltip>`, sr-only description, demarcated footer).
  - Test `<untrusted_reference_data>` XML rendering in drawer excerpt.
  - Test SHA-256 chunk hash badge display and copy action.
  - Test `KnowledgeInboxClient` 6-tab switching.
  - Test quick verify / reject actions updating state optimistically.
  - Test dead-man pause banner visibility when emergency pause is active.
  - Test Server Action multi-tenant anti-IDOR rejection.
- [ ] **Step 7.2: Run memory & UI test suites**
  - Command: `pnpm vitest run src/platform/__tests__/ui/company-brain.test.tsx`
  - Command: `pnpm vitest run src/platform/__tests__/memory/`
- [ ] **Step 7.3: Run full platform baseline regression suite**
  - Command: `pnpm vitest run src/platform/__tests__/` (All 72+ suites passing)
- [ ] **Step 7.4: Run legacy memory suite (Rule 69)**
  - Command: `pnpm vitest run src/lib/memory/__tests__/` (All 60 tests passing)
- [ ] **Step 7.5: Run TypeScript compilation**
  - Command: `pnpm typecheck` (0 errors)
- [ ] **Step 7.6: Run ESLint static analysis**
  - Command: `pnpm lint` (0 errors, 0 warnings)

---

## 4. Verification Checkpoints & Deliverables Summary

1. `src/platform/memory/services/canonical-memory-service.ts` updated with `updateLifecycleStatus`, `deleteMemoryItem`, and `getMemoryStats`.
2. `src/app/actions/memory-actions.ts` authored with strict `'use server'`, Clerk auth, Anti-IDOR, dead-man pause check, and domain event publishing.
3. `src/components/brain/KnowledgeItemDrawer.tsx` strictly conforming to `theme.md` §8.
4. `src/components/brain/CompanyBrainMetrics.tsx`, `KnowledgeSearchBox.tsx`, `KnowledgeCandidateCard.tsx`, `DeadManPauseBanner.tsx`.
5. `src/app/admin/knowledge/inbox/page.tsx` & `KnowledgeInboxClient.tsx` (6 PRD §93 triage tabs).
6. `src/app/admin/brain/page.tsx` & `BrainClient.tsx` (Three-Zone layout).
7. `src/app/admin/companybrain/page.tsx` (legacy redirect).
8. `src/platform/__tests__/ui/company-brain.test.tsx` (12+ tests passing 100%).
9. 100% green verification across all tests, `tsc`, and `eslint`.
