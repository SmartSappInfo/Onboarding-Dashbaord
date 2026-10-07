# Phase 12 Milestone 3: Payment Reconciliation Workspace, Discrepancy Matcher & Exception Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated settlement matching engine, tolerance verification system, exception triage queue, and operator review workspace for multi-channel school fees and B2B invoices.

**Architecture:** Pure deterministic 3-way matching algorithm (Bank/Gateway Payout $\leftrightarrow$ Recorded Payment $\leftrightarrow$ Open Invoice) with weighted confidence scoring and configurable tolerance drift ($\le \$0.50$ auto-matched; $> \$0.50$ routed to Exception Queue). Next.js 15 Server Actions enforce Clerk session auth, anti-IDOR validation, dead-man pause evaluation, and cryptographic SHA-256 payload tampering detection. The operator workbench conforms to `theme.md` §8 (Standardized Modal Architecture) with a 3-way diff viewer, Real-Time SSE reactivity, and seamless Strangler Fig navigation.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5 (Strict Zero-`any`), Tailwind CSS, Radix UI Dialog & Tooltip, Lucide Icons, Zod v4, Vitest, EventBus SSE stream.

---

## 1. Master Rules Compliance Matrix (`agents_mcp_rules.md`)

Every task in this milestone is mapped directly to the governing platform and architecture rules:

| Rule ID | Rule Requirement | Specific Milestone 3 Implementation & Guardrail |
| :--- | :--- | :--- |
| **Rule 1** | Canonical Capability Layer | Routes payment reconciliation operations through canonical capabilities (`finance.payment.reconcile`, `finance.payment.search`, `finance.payment.get`). |
| **Rule 2** | Failure Modes & Recovery | Structured error taxonomy `RECONCILIATION_ERROR_CODES` with deterministic recovery strategies (`FAIL_CLOSED`, `ROUTE_TO_EXCEPTION_QUEUE`, `RE_FETCH_AND_VERIFY`). |
| **Rule 4** | Zero `any` / Zero `any[]` | 100% strict typing across all interfaces, schemas, Server Actions, state hooks, and UI props. Bounded Zod v4 schemas only. |
| **Rule 7** | Mobile-First & Touch Targets | Minimum `44px` touch targets (`min-h-[44px]`), responsive layout grids, and keyboard accessibility (`Esc`, `Tab`, `Enter`). |
| **Rule 8 & 47** | Multi-Tenant Scoping & Anti-IDOR | All queries and mutations strictly validated against authenticated `organizationId` and `workspaceId` via `assertTenantAccess`. |
| **Rule 10** | Canonical Schemas & Bounded Collections | All input/output schemas use Zod v4 with `.min(1)`, `.max(50)` on arrays, and strict date/currency validations. |
| **Rule 11** | Mathematical Determinism in Financial Logic | Double-entry rounding via `Math.round(val * 100) / 100` preventing floating-point currency drift. Zero ledger discrepancies. |
| **Rule 12** | Risk Level Hierarchy | Automated matching capped at `L2_STATE_MUTATION`. Operations exceeding tolerance or involving non-delegable actions require human operator intervention (`L3`/`L4`). |
| **Rule 13** | Grounding & Untrusted Data Isolation | Untrusted bank memos, counterparty remarks, and wire references isolated inside `<untrusted_reference_data id="...">` containers. |
| **Rule 14** | Complete Input/Output Schema Enforcement | Every function, capability, and Server Action has explicit, validated Zod v4 input and output contracts. |
| **Rule 16** | Least Privilege & Zero Wildcard Scopes | Non-wildcard RBAC coordinates (`app:invoices:read`, `rbac:payments:reconcile`, `finance:reconciliation:resolve`). |
| **Rule 17** | Non-Delegable Actions Guard | Purging ledger records, altering bank payout destinations, or deleting posted invoices are strictly non-delegable. |
| **Rule 18** | Live TOCTOU Authority & Freshness Checks | Checks invoice payment status and balance before applying reconciliation; rejects stale records with `VERSION_MISMATCH`. |
| **Rule 19** | Deterministic Idempotency | Idempotency keys generated deterministically: `rec_match_${batchId}_${payoutId}` ensuring replay safety. |
| **Rule 20 & 39** | Distributed Tracing & Causation | Every batch match and exception resolution injects `correlationId` and `causationId` into domain events and logs. |
| **Rule 21** | Action Proposal Interception | Discrepancies $> \$0.50$ or ambiguous matches routed into the unified `ApprovalStore` as structured `ActionProposal` items. |
| **Rule 22** | Cryptographic SHA-256 Tampering Detection | Key-sorted canonical SHA-256 payload hashing (`payloadHash`). Tampered resolution payloads rejected with `PAYLOAD_TAMPERED`. |
| **Rule 23** | Deterministic Budgets | Bounded batch execution: max duration 30s, max items per batch $\le 50$, max monetary exposure tracked. |
| **Rule 26** | Cooperative Cancellation | Reconciler algorithm and Server Actions listen to native `AbortSignal` for instantaneous client or operator cancellation. |
| **Rule 27** | Reverse-LIFO Saga Compensation | Reconciled payments map to compensating capability `finance.payment.unreconcile` in `FINANCE_ROLLBACK_MATRIX`. |
| **Rule 28 & 56** | Knapsack Context Budgeting & Bounded Queries | Query limits bounded strictly to $\le 50$ transactions; prompt payloads bounded $\le 4,000$ tokens. |
| **Rule 30** | Prompt Injection Neutralization | External bank notes scanned for adversarial directives (`ADVERSARIAL_DIRECTIVE_PATTERNS`) and sanitized before display. |
| **Rule 40** | Mandatory Domain Event Publishing | Emits `finance.reconciliation.matched`, `finance.reconciliation.exception_flagged`, `finance.reconciliation.exception_resolved` via `defaultEventBus`. |
| **Rule 41** | Explainability Breakdown | Every match and exception includes explainability breakdown: `WHAT`, `WHY`, `EXPECTED STATE CHANGE`, and `CONFIDENCE SCORE`. |
| **Rule 42** | Zero Live Writes in Simulation | Shadow mode simulation runs with `dryRun: true` and 0 live database writes. |
| **Rule 48** | Standardized Error Taxonomy | Unified error structure: `{ success: false, error: { code, message, httpStatus } }` with typed `ReconciliationError`. |
| **Rule 50** | Multi-Tenant In-Memory Cache | Cache entries partitioned strictly by `${organizationId}:${workspaceId}:${key}` with 3-minute TTL and event invalidation. |
| **Rule 51** | Secure Next.js 15 Server Actions | `'use server'` actions with session auth (`requireAuth()`), parameter validation, and IDOR prevention. |
| **Rule 60** | Emergency Dead-Man Switch Evaluation | `checkGovernanceDeadManSwitch(orgId)` evaluated before execution; fails closed with HTTP 503 (`RECONCILIATION_DEAD_MAN_PAUSED`). |
| **Rule 61** | Three-Zone Mission Control Layout | Executive Header / KPI Cards (Zone 1), Filter Toolbar (Zone 2), Interactive Data Grid & Detail Drawer (Zone 3). |
| **Rule 62** | Real-Time SSE Reactivity | `useEventStream` hook subscribing to `finance.reconciliation.*` and `finance.payment.*` for real-time reactivity without polling. |
| **Rule 69** | Strangler Fig Invariant | Preserves existing financial core (`InvoiceSequenceService`, `RecurringBillingService`, `InvoiceLifecycleService`) with zero regressions. |
| **theme.md §8** | Standardized Modal Architecture | `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, `<DialogHeader demarcated>`, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, `<DialogDescription className="sr-only">`, demarcated footer with tactile buttons (`active:scale-[0.97]`). |
| **.agents/AGENTS.md** | Workspace Rules & Toast Navigation | Actionable toast navigation with relative paths (`actionConfig: { path: '/admin/finance/reconciliation', label: 'View Reconciliation Desk' }`), strict typing, and demarcated dialog geometry. |

---

## 2. File Structure & Responsibilities

| Action | Path | Responsibility |
| :--- | :--- | :--- |
| **Create** | `src/platform/agents/finance/reconciliation/reconciliation-types.ts` | Canonical Zod v4 schemas, interfaces, error taxonomy, and confidence scoring types. |
| **Create** | `src/platform/agents/finance/reconciliation/reconciliation-engine.ts` | Deterministic 3-way matching algorithm, weighted confidence scoring, and tolerance checker. |
| **Create** | `src/platform/agents/finance/reconciliation/index.ts` | Public barrel export for reconciliation module. |
| **Create** | `src/app/actions/finance-reconciliation-actions.ts` | Secure Next.js 15 Server Actions (`'use server'`) with anti-IDOR, dead-man pause, and SHA-256 validation. |
| **Create** | `src/components/finance/reconciliation/ReconciliationMatchModal.tsx` | Standardized modal (`theme.md` §8) featuring 3-way diff viewer and tactile buttons. |
| **Create** | `src/components/finance/reconciliation/ReconciliationKPIHeader.tsx` | Executive KPI summary cards (Unmatched Settlements, Matched Today, Flagged Discrepancies, Net Discrepancy). |
| **Create** | `src/components/finance/reconciliation/ReconciliationExceptionTable.tsx` | Interactive match table with status pills, confidence meters, and 1-click modal triggers. |
| **Create** | `src/components/finance/reconciliation/index.ts` | Public UI barrel for reconciliation components. |
| **Create** | `src/app/admin/finance/reconciliation/page.tsx` | Server Component route with Suspense boundary, metadata, and auth guarding. |
| **Create** | `src/app/admin/finance/reconciliation/ReconciliationClient.tsx` | Client Component mission control workbench with 300ms debounced search, status filter tabs, and SSE live stream. |
| **Modify** | `src/app/admin/components/AdminSidebar.tsx` | Mounts `/admin/finance/reconciliation` under `TRANSACT` group (Rule 69). |
| **Modify** | `src/platform/agents/finance/index.ts` | Re-exports reconciliation engine and types from domain root. |
| **Create** | `src/platform/__tests__/agents/finance/reconciliation-engine.test.ts` | Unit tests for 3-way matching algorithm, scoring weights, and tolerance boundaries. |
| **Create** | `src/platform/__tests__/agents/finance/finance-reconciliation-actions.test.ts` | Server Actions security tests (auth, IDOR, dead-man fail-closed, SHA-256 tampering). |
| **Create** | `src/platform/__tests__/ui/reconciliation-workspace.test.tsx` | UI component tests (`ReconciliationMatchModal`, `ReconciliationClient`, `theme.md` §8 compliance). |

---

## 3. Detailed Step-by-Step Tasks

### Task 1: Canonical Reconciliation Contracts, Types & Schemas
**Files:**
- Create: `src/platform/agents/finance/reconciliation/reconciliation-types.ts`
- Create: `src/platform/agents/finance/reconciliation/index.ts`
- Modify: `src/platform/agents/finance/index.ts`

- [x] **Step 1: Define canonical Zod v4 schemas.**
  - `BankPayoutTransactionSchema`:
    - `id`: string (uuid / prefixed)
    - `reference`: string (min 1)
    - `amount`: number (positive, rounded 2 decimal places)
    - `currency`: string (3 uppercase chars, e.g. `'GHS' | 'USD' | 'EUR' | 'GBP'`)
    - `settlementDate`: string (ISO datetime)
    - `sourceGateway`: enum (`'stripe'`, `'momo_mtn'`, `'momo_telecel'`, `'bank_wire'`, `'cash'`)
    - `counterpartyName`: optional string
    - `counterpartyAccount`: optional string
    - `rawMemo`: optional string (wrapped in untrusted container)
  - `RecordedPaymentItemSchema`:
    - `id`: string
    - `paymentId`: string
    - `amount`: number
    - `currency`: string
    - `recordedDate`: string
    - `method`: string
    - `reference`: optional string
    - `status`: enum (`'unallocated'`, `'partially_allocated'`, `'allocated'`)
  - `InvoiceCandidateSchema`:
    - `id`: string
    - `invoiceNumber`: string
    - `entityId`: string
    - `entityName`: string
    - `totalPayable`: number
    - `amountPaid`: number
    - `balanceDue`: number
    - `dueDate`: string
    - `currency`: string
    - `status`: string
  - `ReconciliationMatchCandidateSchema`:
    - `matchId`: string
    - `payoutId`: string
    - `paymentId`: optional string
    - `invoiceId`: string
    - `confidenceScore`: number (0–100)
    - `matchTier`: enum (`'EXACT_MATCH'`, `'TOLERANCE_MATCH'`, `'EXCEPTION_FLAGGED'`, `'MANUAL_REVIEW'`)
    - `varianceAmount`: number
    - `varianceReason`: enum (`'EXACT_MATCH'`, `'ROUNDING_DRIFT'`, `'EXCHANGE_RATE_DIFF'`, `'UNIDENTIFIED_SURCHARGE'`, `'REFERENCE_MISMATCH'`)
    - `suggestedAction`: enum (`'AUTO_RECONCILE'`, `'ADJUST_VARIANCE_AND_RECONCILE'`, `'ROUTE_TO_EXCEPTION_QUEUE'`, `'SPLIT_ALLOCATION'`)
    - `idempotencyKey`: string
  - `ReconciliationExceptionItemSchema`:
    - `exceptionId`: string
    - `payoutId`: string
    - `payoutReference`: string
    - `amount`: number
    - `currency`: string
    - `flaggedReason`: string
    - `confidenceScore`: number
    - `candidateInvoices`: array of candidate matches
    - `assignedToPersonaId`: string (default `'reconciliation_agent'`)
    - `createdAt`: string
    - `status`: enum (`'OPEN'`, `'IN_REVIEW'`, `'RESOLVED'`, `'DISMISSED'`)
  - `RECONCILIATION_ERROR_CODES` taxonomy and `ReconciliationError` class extending `Error`.
- [x] **Step 2: Create public barrel `src/platform/agents/finance/reconciliation/index.ts`.**
- [x] **Step 3: Re-export from `src/platform/agents/finance/index.ts`.**

---

### Task 2: Automated 3-Way Reconciliation & Discrepancy Matching Engine
**Files:**
- Create: `src/platform/agents/finance/reconciliation/reconciliation-engine.ts`
- Test: `src/platform/__tests__/agents/finance/reconciliation-engine.test.ts`

- [x] **Step 1: Write comprehensive Vitest test suite for `ReconciliationEngine`.**
  - Exact match: identical amount, date within 1 day, matching reference token $\to$ score $\ge 95$, tier `EXACT_MATCH`.
  - Tolerance match: amount drift $\le \$0.50$ (e.g. 0.20 exchange/rounding drift) $\to$ tier `TOLERANCE_MATCH`.
  - Discrepancy exception: drift $> \$0.50$ $\to$ tier `EXCEPTION_FLAGGED` with variance calculated.
  - Multi-invoice split: single payout covering multiple siblings or fee items.
  - Reference extraction: extracting `INV-2026-042`, admission `ADM-092`, or student ID from dirty bank memo.
  - Prompt injection in bank memo: neutralized inside `<untrusted_reference_data>` without triggering execution.
  - Cooperative cancellation via `AbortSignal`.
  - Emergency dead-man switch evaluation failing closed when engaged.
- [x] **Step 2: Implement `ReconciliationEngine` class.**
  - Weighted matching formula:
    $$\text{Score} = w_{\text{amount}} \cdot S_{\text{amount}} + w_{\text{date}} \cdot S_{\text{date}} + w_{\text{token}} \cdot S_{\text{token}} + w_{\text{entity}} \cdot S_{\text{entity}}$$
    where:
    - $w_{\text{amount}} = 0.40$
    - $w_{\text{date}} = 0.25$
    - $w_{\text{token}} = 0.25$
    - $w_{\text{entity}} = 0.10$
  - Tolerance rules:
    - $| \Delta | = 0 \land S_{\text{token}} \ge 80 \to \text{EXACT\_MATCH}$ (eligible for auto-reconciliation).
    - $| \Delta | \le 0.50 \to \text{TOLERANCE\_MATCH}$ (eligible for auto-reconciliation with automated variance allocation).
    - $| \Delta | > 0.50 \lor S_{\text{token}} < 50 \to \text{EXCEPTION\_FLAGGED}$ (routed to Exception Queue).
  - Deterministic idempotency key: `computeReconciliationIdempotencyKey(payoutId, invoiceId, timestampWindow)`.
  - Reverse-LIFO Saga compensation mapping: binds to `finance.payment.unreconcile` (Rule 27).
  - HMR singleton preservation via `getReconciliationEngine()`.

---

### Task 3: Reconciliation Server Actions & Domain Event Publications
**Files:**
- Create: `src/app/actions/finance-reconciliation-actions.ts`
- Test: `src/platform/__tests__/agents/finance/finance-reconciliation-actions.test.ts`

- [x] **Step 1: Write test suite for reconciliation Server Actions.**
  - Authentication check: missing session returns `AUTHENTICATION_REQUIRED` (HTTP 401).
  - Anti-IDOR check: mismatched `organizationId` or `workspaceId` returns `IDOR_VIOLATION` (HTTP 403).
  - Dead-man pause check: returns `RECONCILIATION_DEAD_MAN_PAUSED` (HTTP 503).
  - Cryptographic tampering check: tampered `payloadHash` returns `PAYLOAD_TAMPERED` (HTTP 400).
  - Event publishing: verifies domain events emitted on `defaultEventBus`.
- [x] **Step 2: Implement Next.js 15 Server Actions (`'use server'`).**
  - `matchPaymentBatchAction(input)`:
    - Verifies session auth (`requireAuth()`).
    - Validates anti-IDOR boundary.
    - Evaluates dead-man switch (`checkGovernanceDeadManSwitch`).
    - Executes `ReconciliationEngine.matchBatch()`.
    - Emits `finance.reconciliation.matched` and `finance.reconciliation.exception_flagged` events.
  - `resolveReconciliationExceptionAction(input)`:
    - Validates SHA-256 `payloadHash` to detect tampering (Rule 22).
    - Rule 13: Enforces anti-self-approval.
    - Resolves exception: applies match or flags for operator proposal.
    - Emits `finance.reconciliation.exception_resolved`.
  - `getReconciliationExceptionsAction(filters)`:
    - Bounded query ($\le 50$ items).
    - Supports status tabs (`ALL`, `UNMATCHED`, `VARIANCE_DETECTED`, `RESOLVED`).
  - `getReconciliationMetricsAction()`:
    - Aggregates executive KPIs (Unmatched Settlements, Matched Today, Flagged Discrepancies, Net Discrepancy Amount).
  - Actionable toast responses (`actionConfig: { path: '/admin/finance/reconciliation', label: 'View Reconciliation Desk' }`).

---

### Task 4: Standardized Reconciliation Modal Architecture
**Files:**
- Create: `src/components/finance/reconciliation/ReconciliationMatchModal.tsx`
- Create: `src/components/finance/reconciliation/index.ts`
- Test: `src/platform/__tests__/ui/reconciliation-workspace.test.tsx`

- [x] **Step 1: Implement `ReconciliationMatchModal.tsx` strictly conforming to `theme.md` §8.**
  - **Surface & Geometry:** `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
  - **Demarcated Header:** `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`.
  - **Single-Circle Info Tooltip:** `<CardInfoTooltip text="..." />` elevated at `z-[10050]`.
  - **Accessibility:** `<DialogDescription className="sr-only">`.
  - **3-Way Reconciliation Diff Viewer:**
    - Column 1: Bank / Gateway Payout Statement (Ref, Date, Amount, Source Gateway badge).
    - Column 2: Platform Ledger Record (Payment ID, Allocation Status, Method).
    - Column 3: Open Invoice Delta (Invoice #, Total Payable, Balance, Variance Delta $\Delta$).
  - **Variance Alert Banner:** Shows amber warning chip when $| \Delta | > 0.50$ with explanation note.
  - **Explainability Grid (Rule 41):** `WHAT`, `WHY`, `EXPECTED STATE CHANGE`, `CONFIDENCE SCORE`.
  - **Untrusted Reference Data Container:** Counterparty memo isolated in `<UntrustedReferenceData id="...">` (Rule 13 & 30).
  - **Demarcated Footer:** `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).

---

### Task 5: Operator Reconciliation Workbench & Exception Queue Console
**Files:**
- Create: `src/components/finance/reconciliation/ReconciliationKPIHeader.tsx`
- Create: `src/components/finance/reconciliation/ReconciliationExceptionTable.tsx`
- Create: `src/app/admin/finance/reconciliation/page.tsx`
- Create: `src/app/admin/finance/reconciliation/ReconciliationClient.tsx`
- Modify: `src/app/admin/components/AdminSidebar.tsx`

- [x] **Step 1: Implement `ReconciliationKPIHeader.tsx`.**
  - 4 Executive KPI cards:
    1. Unmatched Settlements (count + currency total)
    2. Matched Today (count + currency total)
    3. Flagged Discrepancies (count requiring review)
    4. Total Net Discrepancy Amount (currency value)
- [x] **Step 2: Implement `ReconciliationExceptionTable.tsx`.**
  - Columns: Settlement Reference, Source Gateway, Counterparty, Discrepancy Amount, Confidence Score, Status Badge, Actions.
  - Status badges: `EXACT_MATCH` (emerald), `TOLERANCE_MATCH` (blue), `EXCEPTION_FLAGGED` (amber), `MANUAL_REVIEW` (purple).
  - 1-click modal inspection trigger (`Inspect 3-Way Diff`, `Approve Match`).
- [x] **Step 3: Implement `ReconciliationClient.tsx`.**
  - Three-Zone layout with 300ms debounced search, status filter tabs, and category filter chips (Bank Wire, MoMo MTN, MoMo Telecel, Stripe, Cash).
  - Real-time SSE reactivity via `useEventStream` subscribing to `finance.reconciliation.*` and `finance.payment.*` (Rule 62).
  - Toast feedback with actionable navigation.
- [x] **Step 4: Implement Server Component route `src/app/admin/finance/reconciliation/page.tsx`.**
  - SEO metadata (`title: 'Payment Reconciliation Desk | SmartSapp'`).
  - Auth protection and Suspense boundary fallback.
- [x] **Step 5: Strangler Fig Navigation Integration in `src/app/admin/components/AdminSidebar.tsx`.**
  - Add `{ href: wrapHref('/admin/finance/reconciliation'), icon: Scale, label: 'Reconciliation', visible: can('finance', 'invoices', 'view') || isSystemAdmin }` under `TRANSACT` group (Rule 69).

---

### Task 6: Comprehensive Test Verification Gate
**Files:**
- Verify all unit, contract, and UI tests pass on remote GitHub Actions CI.

- [ ] **Step 1: Run remote verification on commit.**
- [ ] **Step 2: Verify `reconciliation-engine.test.ts` passes 100%.**
- [ ] **Step 3: Verify `finance-reconciliation-actions.test.ts` passes 100%.**
- [ ] **Step 4: Verify `reconciliation-workspace.test.tsx` passes 100%.**
- [ ] **Step 5: Verify zero regressions across baseline, CRM, sales, and finance test suites.**
- [ ] **Step 6: Verify clean TypeScript typecheck (`tsc`) with 0 errors.**
- [ ] **Step 7: Verify ESLint passes under ceiling.**
- [ ] **Step 8: Verify Next.js production build passes.**
