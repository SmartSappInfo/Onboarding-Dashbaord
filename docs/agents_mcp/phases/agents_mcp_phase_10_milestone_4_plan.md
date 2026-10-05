# Phase 10 Milestone 4 Implementation Plan
## Autonomous Outbound Pipeline, Two-Phase Approval Desk & WhatsApp Formulator

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an operator-grade, autonomous sales outbound engine featuring multi-touch sequence compilation (Email, WhatsApp, Phone), two-phase human-in-the-loop approval interception with canonical SHA-256 `payloadHash` cryptographic binding, WhatsApp click-to-chat formulators, and an accessible Outreach Review Drawer strictly compliant with `theme.md` §8 and `agents_mcp_rules.md`.

**Architecture:** 
1. **SDR Outbound Contracts & Types (`sdr-outbound-types.ts`):** Canonical Zod v4 schemas for outreach channels, message drafts, sequence cadences, approval proposals, and structured error codes adhering strictly to Rule 4 (zero `any`/`any[]`).
2. **Autonomous SDR Outbound Engine (`sdr-outbound-engine.ts`):** Pure deterministic compilation of personalized outreach drafts. Resolves variables via `FieldsVariablesService.resolveTemplateVariables` (Workspace SSOT), sanitizes E.164 phone numbers for WhatsApp Web launchers, containerizes untrusted texts in `<untrusted-reference-data>` (Rules 13 & 30), and computes canonical SHA-256 `payloadHash` values (Rule 22).
3. **Canonical SDR Capability Adapters (`sdr-capabilities.ts`):** 5 registered capabilities (`sdr.draft_outreach`, `sdr.prepare_sequence`, `sdr.dispatch_whatsapp`, `sdr.dispatch_email`, `sdr.log_engagement`) with canonical risk levels (`L1_INTERNAL_DRAFT` to `L3_EXTERNAL_COMMUNICATION_FINANCE`), dead-man switch evaluation (Rule 60), and shadow simulation support (Rule 42).
4. **Server Actions & Two-Phase Approval Bridge (`sdr-outbound-actions.ts`):** Next.js 15 Server Actions ('use server') with Clerk session authentication, Anti-IDOR validation (Rules 8 & 47), dead-man pause evaluation (Rule 60), and two-phase approval staging in `ApprovalStore` preventing parameter tampering between staging and dispatch.
5. **Operator UI Surfaces (`OutreachReviewDrawer.tsx`, `WhatsAppLauncherModal.tsx`):** Standardized Modal & Drawer architecture strictly adhering to `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions, tactile buttons $\ge 44\text{px}$), `<VariablesPanel>` integration, and Rule 41 operational explainability.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict mode, Zod v4 (`zod/v4`), Tailwind CSS, Radix UI Dialog & Drawer, Lucide React, Vitest.

---

## Workspace & Master Rules Invariants

| Rule / Invariant | Enforcement Mechanism |
| :--- | :--- |
| **Rule 4: Zero `any` or `any[]`** | Strict TypeScript typing, Zod v4 validation across all contracts, parameters, actions, and UI props. |
| **Rule 7: Mobile-First & Touch Targets** | All interactive controls, copy buttons, tabs, and action footers maintain $\ge 44\text{px}$ touch targets (`min-h-[44px]`) and tactile `active:scale-[0.97]` transitions. |
| **Rule 8: Anti-IDOR & Multi-Tenancy** | Every Server Action validates caller's session `organizationId` against target parameters (`assertTenantContext`), failing closed on tenant mismatch. |
| **Rule 12: Canonical Risk Levels** | `sdr.draft_outreach` (`L1_INTERNAL_DRAFT`), `sdr.prepare_sequence` (`L1_INTERNAL_DRAFT`), `sdr.dispatch_whatsapp` (`L3_EXTERNAL_COMMUNICATION_FINANCE`), `sdr.dispatch_email` (`L3_EXTERNAL_COMMUNICATION_FINANCE`), `sdr.log_engagement` (`L2_STATE_MUTATION`). |
| **Rule 13: Anti-Self-Approval & Input Isolation** | Untrusted external texts containerized in `<untrusted-reference-data id="...">`. Approver cannot be the same entity as proposal creator. |
| **Rule 16: Explicit Least-Privilege RBAC** | Non-wildcard capability scopes: `campaigns:write`, `messages:send`, `contacts:read`. |
| **Rule 17: Non-Delegable External Communication** | Outbound messages to external recipients cannot be dispatched silently; must route through human approval proposals. |
| **Rule 18: Live TOCTOU Protection** | Verifies prospect version/status before live dispatch to prevent stale mutations. |
| **Rule 19: Deterministic Idempotency Keys** | Canonical key derivation: `sdr_draft_${orgId}_${hash}` and `sdr_disp_${orgId}_${hash}`. |
| **Rule 21: Two-Phase Action Model** | High-risk outbound operations follow: `PLAN -> PREVIEW -> APPROVE -> EXECUTE -> VERIFY`. |
| **Rule 22: Cryptographic Payload Binding** | Canonical sorted JSON SHA-256 `payloadHash` computed across `{campaignId, channel, recipients, templateId, resolvedBody}`. Mismatches reject with `PAYLOAD_TAMPERED`. |
| **Rule 26: Cooperative Cancellation** | AbortSignal support across sequence workers and modal lifecycles. |
| **Rule 27: Reverse-LIFO Saga Compensation** | Canceled sequences or failed dispatches trigger rollbacks and flag un-sent drafts in CRM. |
| **Rule 30: XML Untrusted Containerization** | Generated message drafts and prospect variables enclosed in `<untrusted-reference-data id="...">`. |
| **Rule 33 & 34: Outbound SSRF & Phone Sanitization** | Phone numbers normalized to E.164 (`+233...`); external egress URLs validated via `validateSafeEgressUrl`. |
| **Rule 40: Tamper-Evident Domain Events** | Emits `sales.outreach.drafted`, `sales.outreach.proposed`, `sales.outreach.approved`, `sales.outreach.dispatched` via `defaultEventBus`. |
| **Rule 41: Operational Explainability** | WHAT (outreach intent), WHY (grounding signals), EXPECTED STATE CHANGE (pipeline progression) displayed in UI surfaces. |
| **Rule 42: Shadow Mode Simulation** | Supports `dryRun: true` in capability adapters and actions to simulate sequences with 0 live network transmissions. |
| **Rule 60: Emergency Dead-Man Switch** | Evaluates `checkGovernanceDeadManSwitch(orgId)` returning HTTP 503 / `SALES_DEAD_MAN_PAUSED` if engaged. |
| **Rule 62: Live SSE Event Reactivity** | Real-time sequence progression and status updates streamed to UI via `useEventStream`. |
| **Rule 69: Strangler Fig Preservation** | 100% preservation of legacy `AutonomousSDREngine`, `ProspectingCampaignEngine`, and preexisting UI routes without regression. |
| **Theme §8: Standardized Modal Architecture** | Demarcated header, demarcated footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions (`<DialogDescription className="sr-only">`). |
| **Fields & Variables SSOT** | All template token substitutions strictly route through `FieldsVariablesService.resolveTemplateVariables`. Custom regex replacement is strictly prohibited. |
| **Tag Selector SSOT** | Any tag selection must exclusively use `<TagSelector>` in client/draft mode. |

---

## File Structure

```text
src/
├── platform/
│   ├── agents/
│   │   └── sales/
│   │       ├── outbound/
│   │       │   ├── sdr-outbound-types.ts       # Canonical Zod v4 contracts, schemas, and error codes
│   │       │   ├── sdr-outbound-engine.ts      # Pure sequence compiler, variable resolver & WhatsApp formulator
│   │       │   └── index.ts                    # Outbound module barrel
│   │       └── index.ts                        # Sales agent subsystem barrel
│   └── capabilities/
│       └── sales/
│           ├── sdr-capabilities.ts            # Canonical sdr.* capability adapters
│           └── index.ts                        # Sales capabilities barrel
├── app/
│   └── actions/
│       └── sdr-outbound-actions.ts             # Server Actions with auth, IDOR, dead-man & 2-phase approval
├── components/
│   └── sales/
│       ├── OutreachReviewDrawer.tsx            # Theme §8 compliant multi-touch review drawer & approval gate
│       ├── WhatsAppLauncherModal.tsx           # Theme §8 compliant WhatsApp Web click-to-chat dialog
│       └── index.ts                            # Sales UI barrel
└── platform/__tests__/
    ├── sales/
    │   ├── sdr-outbound-contracts.test.ts      # Zod schema & contract validation tests
    │   ├── sdr-outbound-engine.test.ts         # Sequence compiler & variable replacement tests
    │   ├── sdr-capabilities.test.ts            # sdr.* capability adapter & dry-run tests
    │   └── sdr-outbound-actions.test.ts        # Server Actions auth, IDOR, dead-man & approval tests
    └── ui/
        ├── outreach-review-drawer.test.tsx     # Theme §8 review drawer unit & interaction tests
        └── whatsapp-launcher-modal.test.tsx    # WhatsApp click-to-chat launcher tests
```

---

## Step-by-Step Implementation Tasks

### Task 1: Canonical SDR Outbound Contracts, Error Taxonomy & Schema Architecture

**Files:**
- Create: `src/platform/agents/sales/outbound/sdr-outbound-types.ts`
- Modify: `src/platform/agents/sales/index.ts`
- Test: `src/platform/__tests__/sales/sdr-outbound-contracts.test.ts`

- [ ] **Step 1: Write failing contract test suite (`sdr-outbound-contracts.test.ts`)**
  - Validate `OutreachChannelSchema` (`'email' | 'whatsapp' | 'phone_script'`).
  - Validate `OutreachMessageDraftSchema` with required fields (`id`, `prospectId`, `channel`, `recipientAddress`, `subject`, `body`, `variablesUsed`, `groundingPoints`, `status`, `payloadHash`).
  - Validate `OutboundSequenceConfigSchema` (multi-touch step configuration with delay days, channel, and conditions).
  - Validate `PrepareSequenceParamsSchema` and `PrepareSequenceResultSchema`.
  - Validate `DispatchOutreachParamsSchema` and `DispatchOutreachResultSchema`.
  - Validate `OutreachApprovalBindingSchema` and `SDR_OUTBOUND_ERROR_CODES`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-contracts.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `sdr-outbound-types.ts` and export in barrels**
  - Canonical Zod v4 schemas using `import { z } from 'zod/v4'`.
  - Bifurcated input/output schemas (`DraftOutreachInput` vs `DraftOutreachParams`).
  - Structured error codes: `UNAUTHORIZED`, `IDOR_VIOLATION`, `SALES_DEAD_MAN_PAUSED`, `PAYLOAD_TAMPERED`, `SELF_APPROVAL_FORBIDDEN`, `INVALID_CHANNEL`, `RECIPIENT_MISSING`, `RATE_LIMITED`, `DELIVERABILITY_SUPPRESSED`.
  - Typed `SdrOutboundError` class extending `PlatformError`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-contracts.test.ts`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit Task 1 deliverables**
  - Git commit: `feat(sales): add canonical SDR outbound contracts, Zod v4 schemas and error taxonomy (Phase 10 M4 Task 1)`

---

### Task 2: Autonomous SDR Outbound Engine & Multi-Touch Sequence Compiler

**Files:**
- Create: `src/platform/agents/sales/outbound/sdr-outbound-engine.ts`
- Create: `src/platform/agents/sales/outbound/index.ts`
- Modify: `src/platform/agents/sales/index.ts`
- Test: `src/platform/__tests__/sales/sdr-outbound-engine.test.ts`

- [ ] **Step 1: Write failing engine test suite (`sdr-outbound-engine.test.ts`)**
  - Test `draftOutreach`: generates personalized Email, WhatsApp, and Phone drafts with grounding points.
  - Test variable interpolation: verifies double-brace tokens (`{{prospect.name}}`, `{{contact.name}}`) are resolved via `FieldsVariablesService.resolveTemplateVariables` without regex.
  - Test phone number normalization: converts local/raw phone numbers to strict E.164 (`+233...`) for WhatsApp links.
  - Test untrusted text isolation: wraps generated text and citations in `<untrusted-reference-data id="...">`.
  - Test `compileSequence`: constructs 3-touch sequence with delay intervals (Day 1: WhatsApp, Day 3: Email, Day 5: Call script).
  - Test cryptographic `payloadHash` derivation: verifies SHA-256 hash across canonically sorted parameters.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-engine.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `sdr-outbound-engine.ts`**
  - Class `SdrOutboundEngine` with static methods:
    - `draftOutreach(params, context)`
    - `compileSequence(params)`
    - `formatWhatsAppLauncherUrl(phone, message)`
    - `computeOutreachPayloadHash(params)`
  - Strangler Fig integration: incorporates legacy logic from `AutonomousSDREngine` without modifying original files.
  - Strict typing: zero `any` or `any[]`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-engine.test.ts`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit Task 2 deliverables**
  - Git commit: `feat(sales): implement SDR outbound engine and multi-touch sequence compiler (Phase 10 M4 Task 2)`

---

### Task 3: Canonical SDR Capability Adapters (`sdr.*`) & Capability Registry

**Files:**
- Create: `src/platform/capabilities/sales/sdr-capabilities.ts`
- Modify: `src/platform/capabilities/sales/index.ts`
- Modify: `src/platform/capabilities/registry/capability-registry.ts`
- Test: `src/platform/__tests__/sales/sdr-capabilities.test.ts`

- [ ] **Step 1: Write failing capability adapter test suite (`sdr-capabilities.test.ts`)**
  - Test `sdr.draft_outreach`: executes with risk level `L1_INTERNAL_DRAFT`.
  - Test `sdr.prepare_sequence`: executes with risk level `L1_INTERNAL_DRAFT`.
  - Test `sdr.dispatch_whatsapp`: executes with risk level `L3_EXTERNAL_COMMUNICATION_FINANCE`, evaluates dead-man pause (Rule 60), and enforces shadow mode dry-run (Rule 42).
  - Test `sdr.dispatch_email`: executes with risk level `L3_EXTERNAL_COMMUNICATION_FINANCE`, validates deliverability score $\ge 70$, and enforces dead-man pause.
  - Test `sdr.log_engagement`: executes with risk level `L2_STATE_MUTATION`, records interaction to timeline.
  - Test domain event publishing: verifies `sales.outreach.drafted` and `sales.outreach.dispatched` emitted via `defaultEventBus`.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-capabilities.test.ts`
  - Expected: FAIL with capability not found.

- [ ] **Step 3: Implement `sdr-capabilities.ts` and register in `capability-registry.ts`**
  - Implement 5 capability definitions conforming to `CapabilityDefinition<TInput, TOutput>`.
  - Wire into `registerDefaultSalesCapabilities()` in `src/platform/capabilities/sales/index.ts`.
  - Wire into `capabilityRegistry` singleton in `src/platform/capabilities/registry/capability-registry.ts`.
  - Enforce `checkGovernanceDeadManSwitch` on all mutating/dispatching capabilities.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-capabilities.test.ts`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit Task 3 deliverables**
  - Git commit: `feat(sales): implement canonical sdr.* capability adapters and register with platform registry (Phase 10 M4 Task 3)`

---

### Task 4: Next.js 15 Server Actions & Two-Phase Approval Interception

**Files:**
- Create: `src/app/actions/sdr-outbound-actions.ts`
- Test: `src/platform/__tests__/sales/sdr-outbound-actions.test.ts`

- [ ] **Step 1: Write failing actions test suite (`sdr-outbound-actions.test.ts`)**
  - Test `draftProspectOutreachAction`: requires auth, blocks cross-tenant IDOR, and generates typed draft.
  - Test `stageSequenceApprovalAction`: creates two-phase `ActionProposal` in `ApprovalStore` (Rules 21 & 22) with canonical SHA-256 `payloadHash`.
  - Test `dispatchApprovedOutreachAction`:
    - Blocks execution if proposal is not approved.
    - Blocks execution if caller is the proposal creator (`SELF_APPROVAL_FORBIDDEN`, Rule 13).
    - Blocks execution if parameters were modified (`PAYLOAD_TAMPERED`, Rule 22).
    - Halts with HTTP 503 if dead-man switch is engaged (Rule 60).
    - Dispatches outbound message or generates WhatsApp launcher link.
  - Test `getOutreachMetricsAction`: aggregates sequence and outreach telemetry.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-actions.test.ts`
  - Expected: FAIL with action not found.

- [ ] **Step 3: Implement `sdr-outbound-actions.ts`**
  - Add `'use server'` directive (Rule 51).
  - Authenticate sessions via Clerk `requireAuth()`.
  - Enforce `assertTenantContext(auth, requestedOrgId)`.
  - Evaluate `checkGovernanceDeadManSwitch(organizationId)`.
  - Interface with `getApprovalStore()` to stage and verify proposals.
  - Emit typed domain events (`sales.outreach.proposed`, `sales.outreach.approved`, `sales.outreach.dispatched`).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/sales/sdr-outbound-actions.test.ts`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit Task 4 deliverables**
  - Git commit: `feat(sales): add SDR outbound server actions with two-phase approval interception (Phase 10 M4 Task 4)`

---

### Task 5: Two-Phase Outreach Review Drawer & WhatsApp Formulator UI

**Files:**
- Create: `src/components/sales/OutreachReviewDrawer.tsx`
- Create: `src/components/sales/WhatsAppLauncherModal.tsx`
- Modify: `src/components/sales/index.ts`
- Modify: `src/app/admin/lead-intelligence/components/ProspectFinderTab.tsx`
- Test: `src/platform/__tests__/ui/outreach-review-drawer.test.tsx`
- Test: `src/platform/__tests__/ui/whatsapp-launcher-modal.test.tsx`

- [ ] **Step 1: Write failing UI test suites**
  - `outreach-review-drawer.test.tsx`:
    - Verifies adherence to `theme.md` §8 (`<DialogHeader demarcated>`, `<DialogDescription className="sr-only">`, `<CardInfoTooltip>` at `z-[10050]`).
    - Verifies rendering of multi-touch sequence steps and channel tabs.
    - Verifies SHA-256 `payloadHash` badge with 1-click copy action.
    - Verifies Rule 41 explainability grid (WHAT, WHY, EXPECTED STATE CHANGE).
    - Verifies approval trigger invoking `dispatchApprovedOutreachAction`.
  - `whatsapp-launcher-modal.test.tsx`:
    - Verifies adherence to `theme.md` §8 modal architecture.
    - Verifies E.164 phone rendering and direct `wa.me` launcher link.
    - Verifies 1-click script copying with toast feedback.
    - Verifies `<untrusted-reference-data>` containerization.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `pnpm vitest run src/platform/__tests__/ui/outreach-review-drawer.test.tsx src/platform/__tests__/ui/whatsapp-launcher-modal.test.tsx`
  - Expected: FAIL with components not found.

- [ ] **Step 3: Implement `OutreachReviewDrawer.tsx` & `WhatsAppLauncherModal.tsx`**
  - Strict compliance with `theme.md` §8 modal and drawer architecture.
  - Integrate `<VariablesPanel>` for inspecting template variables.
  - Implement tactile buttons with `rounded-xl active:scale-[0.97] min-h-[44px]`.
  - Export via barrel `src/components/sales/index.ts`.
  - Mount launchers in `ProspectFinderTab.tsx` non-destructively preserving all preexisting controls (Rule 69).

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm vitest run src/platform/__tests__/ui/outreach-review-drawer.test.tsx src/platform/__tests__/ui/whatsapp-launcher-modal.test.tsx`
  - Expected: PASS (100%).

- [ ] **Step 5: Run full verification battery**
  - Run sales test suite: `pnpm vitest run src/platform/__tests__/sales/`
  - Run baseline regression suite: `pnpm vitest run src/platform/__tests__/baseline/`
  - Run TypeScript typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Run ESLint analysis: `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint`

- [ ] **Step 6: Commit Task 5 deliverables and milestone completion**
  - Git commit: `feat(sales): add Outreach Review Drawer, WhatsApp Formulator and mount in Prospect Finder (Phase 10 M4 Task 5)`

---

## Final Verification Checklist

1. [ ] All 5 task deliverables created, strictly typed, and covered by unit/integration tests.
2. [ ] Zero `any` or `any[]` typing across all newly authored files.
3. [ ] All modals and drawers strictly adhere to `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions).
4. [ ] Fields & Variables SSOT: Double-brace tokens strictly resolved via `FieldsVariablesService.resolveTemplateVariables`.
5. [ ] Tag Selector SSOT: Tag inputs strictly use `<TagSelector>` in client/draft mode.
6. [ ] Two-phase approval model: Outbound messages stage proposals with canonical SHA-256 `payloadHash` binding (Rules 21 & 22).
7. [ ] Prompt injection defense: All untrusted reference texts containerized in `<untrusted-reference-data>` (Rules 13 & 30).
8. [ ] Emergency dead-man switch: Verified to fail closed with HTTP 503 / `SALES_DEAD_MAN_PAUSED` (Rule 60).
9. [ ] 100% Strangler Fig preservation: Zero regressions across baseline test suites (Rule 69).
10. [ ] Clean TypeScript typecheck (`tsc --noEmit`, exit 0) and clean ESLint static analysis (warnings $\le 670$, exit 0).
