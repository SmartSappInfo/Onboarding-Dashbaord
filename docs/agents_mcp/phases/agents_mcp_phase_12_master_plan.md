# SmartSapp Agentic & MCP Transformation: Phase 12 Master Implementation Plan
## Fourth Agent Wave: Finance, Billing & School Operational Automation Agents
### Conforms to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1953), `.agents/AGENTS.md`, and `theme.md` §8

**Version:** 1.1.0  
**Status:** PROPOSED / AWAITING USER APPROVAL (Phase 12 execution blocked until approved)  
**Date:** 2026-10-07  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Executive Summary & Transformation Destination

Phase 9 taught SmartSapp to understand an account across 360° context. Phase 10 taught SmartSapp to grow pipeline through autonomous sales intelligence. Phase 11 taught SmartSapp to capture meeting voice and synthesize institutional memory into the knowledge graph. 

**Phase 12 transforms SmartSapp’s core transactional and school operational layer into an autonomous, policy-bounded engine:**
1. **Autonomous Finance & Billing Agents:**
   - **Billing Analyst (`billing_analyst`):** Audits invoices, recurring fee cycles, package upgrades, and license seat discrepancies.
   - **Collections Agent (`collections_agent`):** Manages aging receivables, dunning sequences, promise-to-pay tracking, and prioritized recovery actions.
   - **Payment Reconciliation Agent (`reconciliation_agent`):** Reconciles bank/gateway settlements, payment-to-invoice matching, and exception resolution.
   - **Revenue Analyst (`revenue_analyst`):** Cash flow forecasts, MRR/ARR velocity, churn exposure, and collection realization rates.
   - **Invoice Assistant (`invoice_assistant`):** Multi-campus invoice drafting, line-item tax/discount validation, and currency normalization.
   - **Finance Reporting Agent (`finance_reporter`):** Audit trails, balance sheet aggregates, and compliance reports.
2. **School Operations & Attendance Agents:**
   - **School Operations Agent (`school_ops_agent`):** Campus-wide operational telemetry, academic calendar checkpoints, and facility readiness.
   - **Attendance Analyst (`attendance_analyst`):** Chronic absenteeism detection, pattern anomalies, and teacher log reconciliation.
   - **Fee Collection Agent (`fee_collection_agent`):** Term fee schedules, guardian installment agreements, and school cash collection reconciliations.
3. **Core Architectural Principle (Rule 69 Invariant):**
   > *The agent never directly writes or mutates financial ledgers, invoice sequence numbers, payment balances, or school attendance logs.*  
   > *All interactions route exclusively through canonical, typed capabilities in `src/platform/capabilities/finance/` and `src/platform/capabilities/school/` via `executeCapability`.*

---

## 2. Honest Baseline & Pre-existing Asset Re-use (Rule 69 Strangler Fig)

SmartSapp already possesses robust transactional finance infrastructure. Phase 12 encapsulates and orchestrates these modules rather than rebuilding them.

| Existing Asset | Location | Baseline Status | Phase 12 Encapsulation |
| --- | --- | --- | --- |
| **Invoice Sequence Service** | `src/lib/services/invoice-sequence-service.ts` | Production (Atomic counters, prefixing) | Reused by `finance.invoice.create_draft` & `finance.invoice.issue` |
| **Recurring Billing Engine** | `src/lib/services/recurring-billing-service.ts` | Production (Term cycle billing) | Reused by `BillingAnalyst` and batch workflows |
| **Invoice Snapshot Service** | `src/lib/services/invoice-snapshot-service.ts` | Production (Immutable PDF/JSON snapshot) | Bound to `finance.invoice.validate` post-conditions |
| **Invoice Lifecycle Service** | `src/lib/services/invoice-lifecycle-service.ts` | Production (Draft $\to$ Issued $\to$ Paid $\to$ Void) | Reused for state transitions & reverse-LIFO rollback |
| **Billing Actions** | `src/lib/billing-actions.ts` | Production Server Actions | Encapsulated under canonical capabilities |
| **Finance UI Screens** | `src/app/admin/finance/*` (14 subroutes) | Production Pages | Augmented with Mission Control & Context Rail |
| **Finance Modals** | `src/components/finance/*.tsx` (12 modals) | Production UI | Standardized to `theme.md` §8 with tactile feedback |
| **Backoffice Finance Monitor** | `src/app/(backoffice)/backoffice/finance-monitor` | Production Control Plane | Integrated with Rule 60 Emergency Dead-Man Switches |
| **School Enrollment Actions** | `src/lib/school-enrollment-actions.ts` | Production Service | Reused by `EnrollmentAgent` & `SchoolOpsAgent` |
| **Attendance Engine** | `src/lib/services/__tests__/attendance-engine.test.ts` | Core Engine | Reused by `AttendanceAnalyst` |

---

## 3. The 5 Milestones of Phase 12

```text
Phase 12: Finance & Operational Automation Agents
├── Milestone 1: Unified Finance Context, Aging Analyzer & Canonical finance.* Capabilities
├── Milestone 2: Specialized Finance & School Agent Personas, 4 Governance Matrices & Shadow Mode
├── Milestone 3: Payment Reconciliation Workspace, Discrepancy Matcher & Exception Queue
├── Milestone 4: Intelligent Collections Engine, Dynamic Payment Plans & Two-Phase Proposals
└── Milestone 5: School Operations Intelligence, Attendance Anomaly Engine & Backoffice Control Plane
```

---

### Milestone 1: Unified Finance Context, Aging Analyzer & Canonical `finance.*` Capabilities
**Focus:** Grounding data plane, financial aggregator, context assembly, and canonical capability definitions.

- **Tasks:**
  - **T1: Canonical Finance Contracts & Zod Schemas (`src/platform/agents/finance/context/finance-context-types.ts`):**
    - `AccountFinanceSummarySchema`, `InvoiceSummarySchema`, `PaymentSummarySchema`, `ReceivablesAgingSchema`, `CollectionCaseSchema`, `FeeScheduleSchema`.
    - Error taxonomy `FINANCE_ERROR_CODES` with typed `FinanceError` class.
    - Zero `any` or `any[]` typing policy (Rule 4).
  - **T2: Account Finance Context Assembler (`src/platform/agents/finance/context/account-finance-assembler.ts`):**
    - Multi-domain parallel data plane retrieval across `/invoices`, `/payments`, `/payment_plans`, `/credit_notes`, and `/workspace_entities`.
    - Knapsack context budgeting enforcing prompt context $\le 4,000$ tokens (Rules 28 & 56).
    - Linear non-backtracking regex scanning for prompt injection directives in payment reference notes and customer memos (`<untrusted_reference_data id="...">`, Rules 13 & 30).
    - Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`), failing closed with HTTP 503 / `FINANCE_DEAD_MAN_PAUSED` (Rule 60).
    - Anti-IDOR multi-tenant validation failing closed on tenant boundary mismatch (Rules 8 & 47).
  - **T3: Receivables Aging & Balance Analysis Engine (`src/platform/agents/finance/context/receivables-aging-service.ts`):**
    - Deterministic aging bucket computation: Current (0–30d), Warning (31–60d), Critical (61–90d), Default Risk (>90d).
    - Multi-tenant in-memory cache partitioned by `${organizationId}:${workspaceId}:${entityId}` with 3-minute TTL (Rule 50).
    - Reactive EventBus cache invalidation on domain mutation events (`finance.invoice.*`, `finance.payment.*`).
  - **T4: Canonical `finance.*` Capability Registry Adapters (`src/platform/capabilities/finance/finance-capabilities.ts`):**
    - 8 Canonical Capabilities:
      1. `finance.invoice.create_draft` (L1_INTERNAL_DRAFT)
      2. `finance.invoice.validate` (L0_READ)
      3. `finance.invoice.issue` (L3_EXTERNAL_COMMUNICATION_FINANCE)
      4. `finance.payment.search` (L0_READ)
      5. `finance.payment.get` (L0_READ)
      6. `finance.payment.reconcile` (L2_STATE_MUTATION)
      7. `finance.account.get_balance` (L0_READ)
      8. `finance.receivables.get_aging` (L0_READ)
    - Full Strangler Fig encapsulation of existing `InvoiceSequenceService` and `RecurringBillingService`.
  - **T5: Server Actions & Unit Test Battery:**
    - Next.js 15 Server Actions (`src/app/actions/finance-agent-actions.ts`) with Clerk auth and anti-IDOR validation (Rules 8, 47, 51).
    - Unit tests in `src/platform/__tests__/agents/finance/finance-context.test.ts` and `finance-capabilities.test.ts`.

---

### Milestone 2: Specialized Finance & School Agent Personas, 4 Governance Matrices & Shadow Mode
**Focus:** Personas, least-privilege RBAC, failure recovery strategies, reverse-LIFO rollback, gold-standard benchmark datasets, and zero-write simulation.

- **Tasks:**
  - **T1: Specialized Finance & School Operations Personas (`src/platform/agents/finance/personas/`):**
    - 6 Finance Personas:
      - `billing_analyst` (Risk Ceiling: `L1_INTERNAL_DRAFT`, Budget: $5,000 max financial value)
      - `collections_agent` (Risk Ceiling: `L2_STATE_MUTATION`, Budget: $10,000 max financial value)
      - `reconciliation_agent` (Risk Ceiling: `L2_STATE_MUTATION`, Budget: $25,000 max reconciliation value)
      - `revenue_analyst` (Risk Ceiling: `L0_READ`, Analytics & Forecasts)
      - `invoice_assistant` (Risk Ceiling: `L1_INTERNAL_DRAFT`, Draft preparation)
      - `finance_reporter` (Risk Ceiling: `L0_READ`, Compliance & audit)
    - 3 School Operations Personas:
      - `school_ops_agent` (Risk Ceiling: `L1_INTERNAL_DRAFT`)
      - `attendance_analyst` (Risk Ceiling: `L0_READ`)
      - `fee_collection_agent` (Risk Ceiling: `L2_STATE_MUTATION`)
    - Registration in canonical `BUILT_IN_AGENT_PERSONAS` and `AGENT_PERSONA_IDS`.
  - **T2: The 4 Mandatory Governance Matrices (Rules 1940–1953):**
    1. `FINANCE_PERMISSION_MATRIX`: Non-wildcard RBAC mapping per persona (Rules 8, 16, 17).
    2. `FINANCE_TOOL_MATRIX`: Explicit capability inventory and risk ceilings per persona (Rules 12, 59).
    3. `FINANCE_FAILURE_MATRIX`: Deterministic handling for `DISCREPANCY_EXCEEDS_TOLERANCE`, `INVOICE_ALREADY_PAID`, `GATEWAY_TIMEOUT`, `CURRENCY_MISMATCH`, `STALE_BALANCE`, `DEAD_MAN_ENGAGED` (Rules 2, 48).
    4. `FINANCE_ROLLBACK_MATRIX`: Reverse-LIFO Saga compensation mapping for every state-mutating capability (Rule 27).
  - **T3: Gold-Standard Evaluation Dataset (`src/platform/agents/finance/evaluation/finance-eval-dataset.ts`):**
    - 24 Enterprise benchmark scenarios conforming to `FinanceEvalScenarioSchema` (Rule 44).
    - 6 Mandatory Categories (4 scenarios each):
      1. `PAYMENT_RECONCILIATION_MATCH`
      2. `OVERDUE_COLLECTIONS_ESCALATION`
      3. `MULTI_CAMPUS_INVOICE_CYCLE`
      4. `SCHOOL_FEE_INSTALLMENT_AGREEMENT`
      5. `ATTENDANCE_ANOMALY_DETECTION`
      6. `FINANCIAL_SECURITY_ATTACK` (Adversarial prompt injection in invoice memo, cross-tenant IDOR balance probe, unauthorized refund execution bypass, replay attack with duplicate idempotency key) (Rules 13, 30, 46).
  - **T4: Finance Shadow Mode Runner (`src/platform/agents/finance/evaluation/finance-shadow-mode.ts`):**
    - Enforces `dryRun: true` and 0 live database writes (Rule 42).
    - Intercepts all mutating operations (`finance.invoice.create_draft`, `finance.payment.reconcile`, `finance.collection.execute_action`).
    - Synthesizes `BlastRadiusReport` with financial value exposure, records at risk, and explainability breakdown (WHAT / WHY / EXPECTED STATE CHANGE) (Rule 41).
    - Anti-IDOR validation and emergency dead-man switch evaluation (Rules 8, 47, 60).
  - **T5: Test Verification Gate:**
    - Test suites: `finance-personas.test.ts`, `finance-governance-matrices.test.ts`, `finance-eval-dataset.test.ts`, `finance-shadow-mode.test.ts`.

---

### Milestone 3: Payment Reconciliation Workspace, Discrepancy Matcher & Exception Queue
**Focus:** Automated settlement matching, tolerance verification, exception triage queue, and operator review workspace.

- **Tasks:**
  - **T1: Automated Settlement & Invoice Matching Engine (`src/platform/agents/finance/reconciliation/reconciliation-engine.ts`):**
    - Deterministic 3-way matching algorithm (Bank/Gateway Payout $\leftrightarrow$ Recorded Payment $\leftrightarrow$ Open Invoice).
    - Confidence scoring based on amount match, date proximity ($\pm 3$ days), reference token extraction, and debtor entity resolution.
    - Configurable tolerance thresholds (e.g. currency conversion drift $\le \$0.50$ auto-matched; $> \$0.50$ routed to Exception Queue).
  - **T2: Reconciliation Server Actions & Event Publications (`src/app/actions/finance-reconciliation-actions.ts`):**
    - `matchPaymentBatchAction`, `resolveReconciliationExceptionAction`, `getReconciliationMetricsAction`.
    - Clerk session auth via `requireAuth()` (Rule 51).
    - Cryptographic SHA-256 payload tampering check (Rule 22).
    - Domain event publication: `finance.reconciliation.matched`, `finance.reconciliation.exception_flagged` via `defaultEventBus` (Rule 40).
  - **T3: Standardized Reconciliation Modal Architecture (`theme.md` §8):**
    - `src/components/finance/reconciliation/ReconciliationMatchModal.tsx`:
      - Demarcated header (`<DialogHeader demarcated>`) and `<DialogDescription className="sr-only">`.
      - Single-circle info tooltip button `<CardInfoTooltip text="..." />` at `z-[10050]`.
      - 3-Way diff viewer (Bank Statement vs Platform Ledger vs Invoice Delta).
      - Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
  - **T4: Operator Reconciliation Workbench (`src/app/admin/finance/reconciliation/page.tsx` & `ReconciliationClient.tsx`):**
    - Three-Zone mission control layout with SEO metadata and Suspense boundary.
    - Zone 1: Executive KPI cards (Unmatched Settlements, Matched Today, Flagged Discrepancies, Total Net Discrepancy).
    - Zone 2: Exception Queue filter tabs (`All`, `Unmatched`, `Variance Detected`, `Resolved`) and 300ms debounced search.
    - Zone 3: Interactive match table with 1-click reconciliation approval and drawer review.
    - Real-time SSE reactivity via `useEventStream` subscribing to `finance.payment.*` and `finance.reconciliation.*` (Rule 62).
  - **T5: Test Verification Gate:**
    - Test suites: `reconciliation-engine.test.ts`, `finance-reconciliation-actions.test.ts`, `reconciliation-workspace.test.tsx`.

---

### Milestone 4: Intelligent Collections Engine, Dynamic Payment Plans & Two-Phase Proposals
**Focus:** Aging receivables recovery, dunning escalation workflows, promise-to-pay tracker, and two-phase financial proposal interception.

- **Tasks:**
  - **T1: Collections Recovery & Next-Best-Action Engine (`src/platform/agents/finance/collections/collections-engine.ts`):**
    - Multi-tiered dunning escalation policy based on days overdue and relationship health (from Phase 9):
      - 1–14 days overdue: Courtesy automated reminder draft (`L1_INTERNAL_DRAFT`)
      - 15–30 days overdue: Formal statement of account + payment link
      - 31–60 days overdue: Structured installment proposal (`L2_STATE_MUTATION`)
      - >60 days overdue: Executive suspension review proposal (`L4_PRIVILEGED_DESTRUCTIVE`, Rule 17 non-delegable)
    - Explainability grid: WHAT, WHY, RECOVERY PROBABILITY, RISK LEVEL (Rule 41).
    - Variables Single Source of Truth: Dunning letters and statements delegate token interpolation strictly through `FieldsVariablesService.resolveTemplateVariables` and `<VariablesPanel>` (`.agents/AGENTS.md`).
    - Tag Selection Single Source of Truth: Collection account tagging routes strictly through `<TagSelector>` in client/draft mode (`.agents/AGENTS.md`).
    - Generates dynamic installment payment plans with customizable frequency (weekly/monthly/termly).
  - **T2: Two-Phase Financial Proposal Bridge (`src/platform/agents/finance/collections/finance-proposal-bridge.ts`):**
    - Intercepts all mutating collections and billing actions into the unified `ApprovalStore` (Rule 21).
    - Cryptographic SHA-256 payload binding rejecting tampered transactions with `PAYLOAD_TAMPERED` (Rule 22).
    - Anti-Self-Approval enforcement: authenticated user cannot approve their own financial proposal (Rule 13).
    - Live TOCTOU authority and invoice state freshness checks (`VERSION_MISMATCH`, Rule 18).
    - Reverse-LIFO Saga compensation mapping to `FINANCE_ROLLBACK_MATRIX` (Rule 27).
  - **T3: Standardized Financial Proposal Modal (`theme.md` §8):**
    - `src/components/finance/collections/FinancialProposalModal.tsx`:
      - Strict compliance with `theme.md` §8 surface geometry and demarcated headers.
      - Financial Exposure Banner with currency value ceiling and debtor details.
      - Installment plan breakdown table with payment schedule.
      - Actionable toast navigation with relative paths (`actionConfig: { path: '/admin/finance/collections', label: 'View Collections' }`, `.agents/AGENTS.md`).
  - **T4: Collections Action Desk (`src/app/admin/finance/collections/page.tsx` & `CollectionsClient.tsx`):**
    - Mission control desk for collections agents and operators.
    - Aging debtors list with Lucide urgency icons, promise-to-pay calendar badges, and 1-click proposal launchers.
    - Real-time SSE reactivity via `useEventStream` (Rule 62).
  - **T5: Test Verification Gate:**
    - Test suites: `collections-engine.test.ts`, `finance-proposal-bridge.test.ts`, `collections-actions.test.ts`, `collections-action-desk.test.tsx`.

---

### Milestone 5: School Operations Intelligence, Attendance Anomaly Engine & Backoffice Control Plane
**Focus:** School operational agents, attendance pattern analytics, fee payment synthesis, backoffice emergency control plane, and full platform QA.

- **Tasks:**
  - **T1: School Operations & Attendance Intelligence Engine (`src/platform/agents/school/school-operations-service.ts`):**
    - Attendance pattern aggregator: scans classroom attendance logs and calculates absenteeism velocity.
    - Detects chronic absentee risks, unexcused absence clusters, and teacher submission anomalies.
    - Generates grounded Parent Communication Briefs with XML reference isolation: `<untrusted_reference_data id="attendance_...">` (Rules 13 & 30).
    - Fee payment reconciliation per student/family entity, synthesizing tuition balances and payment receipts.
  - **T2: School Operations Capabilities (`src/platform/capabilities/school/school-capabilities.ts`):**
    - 4 Canonical Capabilities:
      1. `school.attendance.get_patterns` (L0_READ)
      2. `school.attendance.flag_anomaly` (L1_INTERNAL_DRAFT)
      3. `school.fee.reconcile_student` (L2_STATE_MUTATION)
      4. `school.communication.draft_parent_brief` (L1_INTERNAL_DRAFT)
  - **T3: Backoffice Finance & Operations Control Plane (`src/app/admin/finance/monitor/` & `/backoffice/finance-monitor`):**
    - Rule 60 Emergency Dead-Man Switches:
      - `agent_finance`: Halts all automated invoice generation and payment processing.
      - `agent_collections`: Halts all outbound dunning and automated payment plan proposals.
      - `agent_school_operations`: Halts automated school attendance alerts and parent briefs.
      - `financial_mutation_halt`: Global freeze on all L2/L3 financial mutations across the platform.
    - Double-confirmation modal adhering to `theme.md` §8 requiring mandatory audit justification note ($\ge 5$ characters).
    - Real-time security incident feed (DLQ failures, reconciliation mismatches, IDOR attempts).
  - **T4: Strangler Fig Navigation Integration:**
    - Seamlessly mounted in `AdminSidebar.tsx` under `TRANSACT` and `INTELLIGENCE` groups with zero broken links (Rule 69).
  - **T5: Full Platform QA & Verification Battery (Phases 0–12):**
    - Full platform regression across all domains: Baseline (Phase 0–3), Agents (Phase 4–8), CRM (Phase 9), Sales (Phase 10), Meetings & Knowledge (Phase 11), Finance & School Ops (Phase 12).
    - Dedicated Adversarial Red-Team suite covering:
      1. Tampered refund values & payload hash verification (Rule 22)
      2. Cross-tenant IDOR balance and invoice probes (Rules 8 & 47)
      3. Prompt injection in invoice memos and student notes (Rule 30)
      4. Emergency dead-man switch enforcement failing closed (Rule 60)
      5. Token overflow & Knapsack context budgeting (Rules 28 & 56)
    - Zero `any` or `any[]` typing policy (Rule 4).

---

## 4. Trust Boundaries & Risk Register (Rules 12, 13, 17, 21, 22)

Financial operations carry the highest regulatory, legal, and fiduciary exposure in enterprise software.

| Risk ID | Threat Vector | Risk Level | Mitigation & Invariant | Enforced Rule |
| --- | --- | --- | --- | --- |
| **R12-1** | LLM hallucinates an arbitrary ledger balance or discount | High | Immutable double-entry calculations performed strictly in deterministic services; LLM only reads validated ledger outputs. | Rules 11, 69 |
| **R12-2** | Cross-tenant IDOR leak of school fee balances or invoice amounts | Critical | Multi-tenant boundary check `assertTenantAccess(auth, orgId)` on every Server Action and capability invocation. | Rules 8, 47 |
| **R12-3** | Unauthorized cash refund or debt write-off executed by agent | Critical | Classified as `L4_PRIVILEGED_DESTRUCTIVE` and Non-Delegable (Rule 17). Strictly requires human operator two-phase approval via `ApprovalStore`. | Rules 12, 17, 21 |
| **R12-4** | Replay or tampering of financial proposal parameters between approval and execution | High | Key-sorted canonical SHA-256 `payloadHash` binding. Any drift in invoice ID, amount, or recipient causes immediate `PAYLOAD_TAMPERED` rejection. | Rule 22 |
| **R12-5** | Approver approves their own financial adjustment or invoice waiver | High | Anti-Self-Approval gate: `auth.uid === proposal.requestedBy` immediately rejects with `SELF_APPROVAL_FORBIDDEN` (HTTP 403). | Rule 13 |
| **R12-6** | Prompt injection directive hidden inside customer bank wire memo or invoice note | High | All untrusted invoice memos, wire descriptions, and payment remarks are scanned (`ADVERSARIAL_DIRECTIVE_PATTERNS`) and wrapped inside `<untrusted_reference_data id="...">`. | Rules 13, 30 |
| **R12-7** | Rapid automated runaway billing runs draining customer accounts | Critical | Deterministic `maxFinancialValue` ceilings ($5,000 per run) and Rule 60 emergency kill switches failing closed instantly with HTTP 503. | Rules 23, 60 |
| **R12-8** | Failed financial mutation leaves ledgers in an inconsistent state | High | Reverse-LIFO Saga compensation mapping in `FINANCE_ROLLBACK_MATRIX` restores previous state upon failure. | Rules 27, 63 |

---

## 5. Execution Budgets & Limits (Rule 23)

Every Finance and School Operations agent run is bounded by immutable execution budgets:

```typescript
export const FINANCE_AGENT_BUDGETS = {
  billing_analyst: {
    maxDurationMs: 120_000,
    maxTokens: 50_000,
    maxToolCalls: 15,
    maxRecordsMutated: 25,
    maxFinancialValueUsd: 5_000,
  },
  collections_agent: {
    maxDurationMs: 120_000,
    maxTokens: 50_000,
    maxToolCalls: 20,
    maxRecordsMutated: 50,
    maxFinancialValueUsd: 10_000,
  },
  reconciliation_agent: {
    maxDurationMs: 180_000,
    maxTokens: 60_000,
    maxToolCalls: 25,
    maxRecordsMutated: 100,
    maxFinancialValueUsd: 25_000,
  },
  revenue_analyst: {
    maxDurationMs: 90_000,
    maxTokens: 40_000,
    maxToolCalls: 10,
    maxRecordsMutated: 0, // Read-only
    maxFinancialValueUsd: 0,
  },
  school_ops_agent: {
    maxDurationMs: 90_000,
    maxTokens: 40_000,
    maxToolCalls: 15,
    maxRecordsMutated: 10,
    maxFinancialValueUsd: 1_000,
  },
} as const;
```

---

## 6. Complete Master 69-Rules Verification & Architecture Matrix

| Rule # | Master Rule Requirement | Phase 12 Architectural Implementation & Conformance |
| --- | --- | --- |
| **Rule 1** | Tracked Roadmap & Phase Invariants | Full Phase 12 master plan documented in `docs/agents_mcp/phases/` with exact task breakdowns and status tracking. |
| **Rule 2** | Comprehensive Risk Register | Section 4 details all 8 financial risk vectors with cryptographic and architectural mitigations. |
| **Rule 3** | Backoffice Operator Management Without Code Deployments | `/admin/finance/monitor` & `/backoffice/finance-monitor` allow zero-code policy and kill-switch control. |
| **Rule 4** | Strict Typing Policy | 100% strict TypeScript types and Zod v4 schemas. Zero `any` or `any[]` throughout codebase. |
| **Rule 5** | Verification & Zero-Downtime Migration Protocol | Clean git-based deployment, no schema destruction, backward compatibility preserved. |
| **Rule 6** | No Direct Model Writes / Model Is Not Database Operator | The model never mutates Firestore directly; all writes route through `executeCapability`. |
| **Rule 7** | Mobile-First, Accessibility & Emil Kowalski Animations | All modals, cards, and toolbars have $\ge 44\text{px}$ touch targets, Emil Kowalski `active:scale-[0.97]` compression, and responsive grids. |
| **Rule 8 & 47** | Multi-Tenant Boundary & Anti-IDOR Enforcement | Session-locked `assertTenantAccess(auth, orgId)` on all Server Actions, data access, and capability handlers. |
| **Rule 9** | Query Bounding & Rate Limiting | Bounded queries $\le 50$, pagination via cursors, latency budgets $\le 1,500\text{ms}$. |
| **Rule 10** | Zod v4 Schema Validation on Every Boundary | All inputs and outputs strictly parsed and validated with Zod v4 schemas. |
| **Rule 11** | The Model Is Never the Security Boundary | Balances, invoice calculations, and aging formulas are computed in deterministic TypeScript code; model only analyzes validated summaries. |
| **Rule 12** | Canonical 5-Tier Risk Classification | `L0_READ` (balance, aging), `L1_INTERNAL_DRAFT` (invoice draft), `L2_STATE_MUTATION` (reconcile), `L3_EXTERNAL_COMMUNICATION_FINANCE` (issue invoice), `L4_PRIVILEGED_DESTRUCTIVE` (refund, debt write-off). |
| **Rule 13** | Tool Output Is Untrusted & Anti-Self-Approval | Memos wrapped in `<untrusted_reference_data id="...">`; approver cannot approve their own financial proposal. |
| **Rule 14** | Dynamic Progressive Tool Disclosure | Agents receive only domain-scoped tools, not entire 300+ tool catalog. |
| **Rule 15** | Capability Manifest Self-Description | Tools declare risk class, latency, idempotency, versioning, rollback capability. |
| **Rule 16** | Explicit Least-Privilege RBAC | Non-wildcard permissions: `finance:read`, `finance:invoice:draft`, `finance:reconcile`, `school:attendance:read`. |
| **Rule 17** | Non-Delegable Human Operator Actions | Debt write-offs, irreversible ledger adjustments, cash refunds, and tax invoice issuance REQUIRE human approval. |
| **Rule 18** | Live TOCTOU Authority & Freshness Checks | Checks approver permissions and invoice `version` at exact moment of execution. |
| **Rule 19** | Deterministic Idempotency Keys | Formatted as `fin_inv_${orgId}_${hash}` and `fin_rec_${settlementId}_${hash}`. |
| **Rule 20** | Distributed Tracing & Correlation IDs | `traceId`, `correlationId`, `toolInvocationId` propagated across all financial runs and steps. |
| **Rule 21** | Two-Phase Human-in-the-Loop Interception | All state-mutating financial proposals route through unified `ApprovalStore`. |
| **Rule 22** | Cryptographic SHA-256 Approval Binding | Proposal execution verifies exact SHA-256 hash of parameters matches `proposal.payloadHash`. |
| **Rule 23** | Execution Budgets & Backpressure | `maxFinancialValueUsd`, `maxTokens`, `maxDurationMs`, `maxToolCalls` strictly enforced. |
| **Rule 24** | Tiered Model Routing & Circuit Breakers | `flash` for heuristics/matching, `pro` for financial analysis/auditing; circuit breakers with exponential backoff. |
| **Rule 25** | Dead-Letter Queue (DLQ) & Ingestion Reprocessing | Failed financial events routed to DLQ with Backoffice replay affordance. |
| **Rule 26** | Cooperative Cancellation via Native AbortSignal | Native `AbortSignal` propagated to all database calls and LLM streams. |
| **Rule 27** | Reverse-LIFO Saga Compensation | `FINANCE_ROLLBACK_MATRIX` provides exact compensating actions for state-mutating capabilities. |
| **Rule 28 & 56** | Knapsack Context Token Budgeting | Bounded prompt context strictly $\le 4,000$ tokens with greedy priority packing. |
| **Rule 29** | Immutable Temporal Fact Supersession | Historical financial states preserved; new facts supersede rather than overwrite. |
| **Rule 30** | Canonical XML Reference Isolation Containerization | External wire notes wrapped in `<untrusted_reference_data id="...">` to neutralize prompt injections. |
| **Rule 31** | Zero-Silent-Failures | All failures logged, surfaced in UI with actionable toast paths, never swallowed. |
| **Rule 32 & 33** | Credential Redaction & Secret Boundary | Linear non-backtracking redaction `[REDACTED_SECRET:<type>]`. |
| **Rule 34** | Strict SSRF Outbound Guard | Outbound webhook and payment provider URLs validated against private RFC 1918 IPs and cloud metadata addresses. |
| **Rule 35** | Offline Queue & Sync | Optimistic UI updates with offline queuing. |
| **Rule 36** | Cross-Module Event Handshakes | EventBus decoupling across CRM, Finance, Sales, School Ops. |
| **Rule 37** | Zero Blind Retries | Exponential jittered backoff on transient errors; fail-closed on 4xx/validation errors. |
| **Rule 38** | State Machine Transitions | Deterministic state machines: Draft $\to$ Validated $\to$ Approved $\to$ Issued $\to$ Paid $\to$ Reconciled $\to$ Void. |
| **Rule 39** | Causality & Span Provenance | Causal graph tracking every financial action to triggering agent/operator/workflow. |
| **Rule 40** | Domain Event Telemetry | Emits `finance.invoice.*`, `finance.payment.*`, `finance.reconciliation.*`, `school.attendance.*` to `defaultEventBus`. |
| **Rule 41** | Granular Explainability Breakdown | Every recommendation includes: WHAT, WHY, IMPACT, BLAST RADIUS, RISK LEVEL. |
| **Rule 42** | Shadow Mode Simulation Engine | Enforces `dryRun: true` and 0 live database writes, generating `BlastRadiusReport`. |
| **Rule 43** | Semantic Versioning of Personas & Tools | SemVer progression: `patch`, `minor`, `major` with version diffing. |
| **Rule 44** | Gold-Standard Evaluation Dataset | 24 enterprise scenarios with ground-truth assertions across 6 categories. |
| **Rule 45** | Synthetic Test Data Generation | Hermetic mock environments without real customer data. |
| **Rule 46** | Adversarial Security Red-Team Benchmarks | Dedicated suites for prompt injection, IDOR probing, payload tampering, and dead-man bypass. |
| **Rule 48** | Standardized Error Taxonomy | Structured error codes `FINANCE_ERROR_CODES`, typed `FinanceError`, HTTP status mapping. |
| **Rule 49** | Graceful Degradation Under Load | Fallback to static rules if LLM latency exceeds 1,500ms. |
| **Rule 50** | Multi-Tenant In-Memory Cache | Partitioned by `${organizationId}:${workspaceId}:${entityId}` with 3-minute TTL and reactive event invalidation. |
| **Rule 51** | Next.js 15 Server Actions Architecture | Standardized `'use server'` actions with session auth, input parsing, and structured result types. |
| **Rule 52** | Tag Selection SSOT (`.agents/AGENTS.md`) | Debtors and collection cases tagged exclusively via `<TagSelector>` in client/draft mode. |
| **Rule 53** | Variables SSOT (`.agents/AGENTS.md`) | Dunning statements and invoices route exclusively through `FieldsVariablesService` and `<VariablesPanel>`. |
| **Rule 54** | Actionable Toasts & Safe Navigation (`.agents/AGENTS.md`) | Toasts carry relative `actionConfig: { path, label }` with keyboard focus and active tactile styling. |
| **Rule 55** | Modal & Dialog System SSOT (`theme.md` §8) | Surfaces use `bg-card sm:rounded-2xl`, demarcated headers, `<CardInfoTooltip text="..." />` at `z-[10050]`, sr-only descriptions, and demarcated footers. |
| **Rule 57** | Zero Dangling Promises | All async operations properly awaited or tracked via Next.js `after()`. |
| **Rule 58** | Model Provider Abstraction | Standardized model router with Genkit/Vertex fallback. |
| **Rule 59** | Dynamic Tool Permission Filtering | Agent capabilities filtered by caller's session permissions. |
| **Rule 60** | Emergency Dead-Man Kill Switches | Backoffice switches fail closed instantly with HTTP 503 / `FINANCE_DEAD_MAN_PAUSED`. |
| **Rule 61** | Suspense Boundaries & Streaming Hydration | SEO metadata and Next.js Suspense wrappers on all new routes. |
| **Rule 62** | Real-Time SSE Reactivity | Client UI subscribes via `useEventStream` without polling loops. |
| **Rule 63** | Compensating Saga Rollback Execution | Automated execution of reverse-LIFO rollbacks on failed financial transactions. |
| **Rule 64** | 3-Tier Feature Flags & Policy Thresholds | Global, organization, and workspace flag overrides. |
| **Rule 65** | No Secret Leakage to Client | Credentials kept server-side. |
| **Rule 66** | Cross-Cutting Gates for Phases 0–15 | Rigorous milestone gates. |
| **Rule 67** | The Agent Implementation Gate | 9-Dimension Architecture, Authority, Data, MCP, Failure, Security, Operations, Testing, Migration gate. |
| **Rule 68** | The Five Non-Negotiables | Model not boundary; untrusted tool output; idempotent/authorized mutations; bounded resources; zero-code operability. |
| **Rule 69** | Governed Capability Layer Underneath | Human UI, AI agents, MCP, and workflows all call canonical `finance.*` and `school.*` capabilities. |
| **Rules 1940–1953** | Mandatory Domain Agent Deliverables | Every agent ships with: Shadow Mode, Eval Dataset, Permission Matrix, Tool Matrix, Failure Matrix, Security Tests, Rollback Plan. |

---

## 7. Deliverables & Implementation Sequence

| Milestone | Deliverables | Verification Gates |
| --- | --- | --- |
| **Milestone 1** | Contracts, Context Assembler, Aging Engine, 8 `finance.*` Capabilities, Server Actions | Vitest contract suite, baseline regression |
| **Milestone 2** | 9 Personas (6 Finance + 3 School), 4 Governance Matrices, 24 Eval Scenarios, Shadow Mode Runner | Eval dataset suite, shadow mode blast radius tests |
| **Milestone 3** | Reconciliation Matcher Engine, Exception Queue, Reconciliation Workbench UI, SSE Reactivity | Reconciliation engine tests, UI match tests |
| **Milestone 4** | Collections Engine, Dunning Workflow, Installment Generator, Two-Phase Proposal Bridge, Proposal Modal UI | Collections action tests, proposal modal tests |
| **Milestone 5** | School Operations & Attendance Engine, Backoffice Control Plane, Navigation Integration, Full Platform QA | Full QA (Phases 0–12), Adversarial Security tests |

---

## 8. Definition of Done for Phase 12

1. **Zero Raw HTML/CSS Leakage:** All UI adheres strictly to Tailwind tokens, Shadcn UI primitives, and `theme.md` §8.
2. **Zero `any` or `any[]`:** All contracts, schemas, functions, and props strictly typed.
3. **The 7 Mandatory Domain Agent Deliverables:** Shipped for all 9 personas (Shadow Mode, Eval Dataset, Permission Matrix, Tool Matrix, Failure Matrix, Security Tests, Rollback Plan).
4. **Idempotency & Rollback:** 100% of mutating financial capabilities have deterministic idempotency keys and compensating capabilities in `FINANCE_ROLLBACK_MATRIX`.
5. **Two-Phase Approval Gate:** Issuing invoices, processing refunds, debt write-offs, and plan downgrades cannot execute without operator approval.
6. **Remote CI/CD Verification:** Full test suite passing, clean build, clean typecheck, clean lint on GitHub Actions CI.
