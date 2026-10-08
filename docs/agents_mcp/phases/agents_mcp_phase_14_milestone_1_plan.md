# SmartSapp Agentic & MCP Transformation: Phase 14 Milestone 1 Plan
## Postcondition Verification Engine, Assertion Framework & Verification Matrix
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1964, Rules 67–69), `theme.md` §8, and `.agents/AGENTS.md`

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Goal & Milestone Overview

Milestone 1 builds the foundational **Postcondition Verification Engine**, **Assertion Framework**, and **Capability Verification Matrix** for Phase 14 ("Agentic Self-Management & Verification").

It transforms SmartSapp from an unverified execution model (`PLAN -> EXECUTE -> hope`) into a formally verified model:
```text
PLAN → PREDICT → EXECUTE → VERIFY (Postconditions) → COMMIT → LEARN
```

Every mutating capability in SmartSapp will declare and verify its real-world state changes, invariants, and side effects before committing transactions or emitting success signals.

---

## 2. Review of Source Documentation & Architectural Invariants

### 2.1 Alignment with `docs/agents_mcp/agents_mcp_roadmap.md` (§PHASE 14, lines 1867–1976)
- **The Core Axiom:** "This is where 'agent can execute' becomes 'agent can execute responsibly.'"
- **Formal Verification Examples:**
  - After `create campaign`: verify campaign exists, audience count correct, suppression rules applied, links valid, templates compile, variables resolve via `FieldsVariablesService`, approval satisfied.
  - After `update deal`: verify deal state changed, event emitted, activity recorded, related tasks updated.
  - After `send message`: verify provider accepted, recipient valid, message ID returned, CRM activity recorded, delivery tracking established.
  - After `financial resolution`: verify ledger entry created, balance updated, double-entry remainder balanced down to the cent (`roundCurrency`, Rule 11).
  - After `knowledge fact supersession`: verify temporal validity window set, fact supersession updated (`validUntil`, `supersededBy`, Rule 29).

### 2.2 Alignment with `docs/agents_mcp/agents_mcp_rules.md`
- **Rule 1 (Modern Web Guidance & Skills):** Code conforms to Next.js best practices, Emil Kowalski animations, and frontend-design skills.
- **Rule 2 (FMEA Risk Analysis):** Identifies potential failure modes (stale reads, assertion bypass, timeout hangs, ungrounded mutations) and implements concrete mitigations.
- **Rule 4 (Strict Typing):** Zero `any` or `any[]`. Inferred and explicit module types only. `unknown` narrowed with Zod v4 schemas at trust boundaries.
- **Rules 8 & 47 (Anti-IDOR & Multi-Tenant Boundaries):** All assertion contexts require `organizationId` and `workspaceId`. Server Actions reject cross-tenant callers with HTTP 403 `IDOR_VIOLATION`.
- **Rule 11 (Mathematical Determinism):** Financial assertions enforce double-entry remainder balancing with zero fractional floating-point drift.
- **Rule 12 (Risk Levels):** Verification capabilities are strictly classified as `L0_READ`.
- **Rules 13 & 30 (Untrusted Data Isolation & Injection Defense):** All post-state inspection records and assertion evidence are scanned for `ADVERSARIAL_DIRECTIVE_PATTERNS` and wrapped in `<untrusted_reference_data id="...">` XML containers.
- **Rule 14 (Rug-Pull Defense):** Verification capabilities are fingerprinted with SHA-256 schema hashes.
- **Rule 16 (Explicit RBAC Scopes):** Execution and verification operations require explicit, non-wildcard RBAC scopes.
- **Rule 17 (Non-Delegable Actions):** Verification bypass and manual recovery actions are strictly non-delegable to AI agents (`actor.type === 'user'`).
- **Rule 19 (Idempotency):** Assertion execution and result reporting are strictly deterministic and idempotent.
- **Rule 21 (Two-Phase Execution):** Postcondition assertions form Phase 4 of the 6-step loop (Verify before Commit).
- **Rule 23 (Resource Governance):** Assertion evaluation timeout bounded to $\le 5,000$ms; token budget bounded to $\le 4,000$.
- **Rule 26 (Cooperative Cancellation):** Native `AbortSignal` propagated to all assertion evaluators.
- **Rule 40 (Domain Event Auditing):** Verification results emit `verification.assertion.evaluated` and `verification.execution.completed` via `defaultEventBus`.
- **Rule 41 (Explainability):** Assertion evidence includes WHAT, WHY, and EXPECTED vs ACTUAL state change.
- **Rule 42 (Shadow Mode):** Verification engine evaluates postconditions in Shadow Mode (`dryRun: true`) with zero writes.
- **Rule 48 (Sanitized Error Taxonomy):** Typed `AgentVerificationError` with mapped HTTP status codes; zero internal stack leaks.
- **Rule 51 (Server Actions Security):** Next.js 15 Server Actions enforce `'use server'`, Clerk session authentication (`requireAuth()`), Anti-IDOR validation, and emergency dead-man pause check.
- **Rule 60 (Emergency Dead-Man Switch):** Checks `checkGovernanceDeadManSwitch(organizationId)` and fails closed immediately with HTTP 503 `VERIFICATION_DEAD_MAN_PAUSED`.
- **Rule 67 (The Agent Implementation Gate):** Passes all 5 checklist dimensions (Architecture, Authority, Data, Execution, MCP).
- **Rule 68 (The Five Non-Negotiables):** Zero `any`, no raw HTML, performance bounds, mobile-first touch targets, fail-closed security.
- **Rule 69 (Strangler Fig Pattern):** Preserves 100% of pre-existing routes, capability contracts, and operational database structures.
- **Rules 1954–1964 (Phase 14 Verification Specifics):** Direct implementation of postcondition checks, assertion framework, and capability verification matrix.

---

## 3. Deliverables & Specifications

### 3.1 Canonical Verification Contracts (`src/platform/verification/verification-types.ts`)
```typescript
export const PostconditionSeveritySchema = z.enum(['CRITICAL', 'WARNING']);
export type PostconditionSeverity = z.infer<typeof PostconditionSeveritySchema>;

export const PostconditionStatusSchema = z.enum(['VERIFIED', 'FAILED', 'SKIPPED']);
export type PostconditionStatus = z.infer<typeof PostconditionStatusSchema>;

export const OverallVerificationStatusSchema = z.enum(['PASS', 'FAIL', 'DEGRADED']);
export type OverallVerificationStatus = z.infer<typeof OverallVerificationStatusSchema>;

export const PostconditionAssertionSchema = z.object({
  assertionId: z.string().min(1),
  ruleName: z.string().min(1),
  targetResource: z.string().min(1),
  targetId: z.string().min(1),
  severity: PostconditionSeveritySchema,
  status: PostconditionStatusSchema,
  errorMessage: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  evaluatedAt: z.string().datetime(),
});
export type PostconditionAssertion = z.infer<typeof PostconditionAssertionSchema>;

export const PostconditionContextSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  preStateSnapshot: z.record(z.string(), z.unknown()),
  postStateSnapshot: z.record(z.string(), z.unknown()).nullable(),
  mutationPayload: z.record(z.string(), z.unknown()),
});
export type PostconditionContext = z.infer<typeof PostconditionContextSchema>;

export const VerificationResultSchema = z.object({
  executionId: z.string().min(1),
  capabilityId: z.string().min(1),
  overallStatus: OverallVerificationStatusSchema,
  assertionsCount: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  assertions: z.array(PostconditionAssertionSchema),
  durationMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
```

### 3.2 Error Taxonomy (`VERIFICATION_ERROR_CODES`) & Typed Error Class
```typescript
export const VERIFICATION_ERROR_CODES = {
  POSTCONDITION_ASSERTION_FAILED: 'POSTCONDITION_ASSERTION_FAILED',
  VERIFICATION_TIMEOUT: 'VERIFICATION_TIMEOUT',
  INVALID_POSTCONDITION_CONTEXT: 'INVALID_POSTCONDITION_CONTEXT',
  UNVERIFIED_MUTATION_REJECTED: 'UNVERIFIED_MUTATION_REJECTED',
  VERIFICATION_DEAD_MAN_PAUSED: 'VERIFICATION_DEAD_MAN_PAUSED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
} as const;

export type VerificationErrorCode =
  (typeof VERIFICATION_ERROR_CODES)[keyof typeof VERIFICATION_ERROR_CODES];

export class AgentVerificationError extends Error {
  public readonly code: VerificationErrorCode;
  public readonly statusCode: number;

  constructor(code: VerificationErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'AgentVerificationError';
    this.code = code;
    this.statusCode = statusCode ?? this.resolveStatusCode(code);
  }

  private resolveStatusCode(code: VerificationErrorCode): number {
    switch (code) {
      case 'INVALID_POSTCONDITION_CONTEXT':
        return 400;
      case 'IDOR_VIOLATION':
        return 403;
      case 'POSTCONDITION_ASSERTION_FAILED':
        return 422;
      case 'UNVERIFIED_MUTATION_REJECTED':
        return 409;
      case 'VERIFICATION_DEAD_MAN_PAUSED':
        return 503;
      case 'VERIFICATION_TIMEOUT':
        return 504;
      default:
        return 500;
    }
  }
}
```

### 3.3 Core Postcondition Engine (`src/platform/verification/postcondition-engine.ts`)
- Pure, deterministic evaluator implementing domain assertion rules:
  1. `crm:deal_stage_advanced`: Asserts target deal in `postStateSnapshot` reflects `mutationPayload.stage` and records stage history.
  2. `crm:entity_updated`: Asserts `/entities/{id}` exists and updated properties match `mutationPayload`.
  3. `crm:note_created`: Asserts note entry exists in entity timeline.
  4. `sales:outreach_sent`: Asserts recipient phone/email is valid E.164, status is sent/queued, and provider ID is recorded.
  5. `finance:remainder_balanced`: Asserts sum of installment milestones matches total principal down to the cent (Rule 11).
  6. `knowledge:fact_superseded`: Asserts `validUntil` is set and `supersededBy` forward link points to the new fact document (Rule 29).
  7. `supervisor:delegation_bounded`: Asserts delegation depth $\le 3$ and token budget allocation $\le 4,000$ (Rules 9, 23, 28).
- Safeguards:
  - Dead-man pause check: `await checkGovernanceDeadManSwitch(context.organizationId)` throws `AgentGovernanceEmergencyPausedError` (Rule 60).
  - Timeout ceiling: `AbortSignal.timeout(5000)` prevents hangs (Rule 26).
  - Prompt injection neutralization: sanitizes strings against `ADVERSARIAL_DIRECTIVE_PATTERNS` and isolates in `<untrusted_reference_data id="...">` (Rules 13 & 30).
  - Domain event publishing: `defaultEventBus.publish(createDomainEvent(...))` (Rule 40).
  - HMR singleton preservation: `getPostconditionEngine()`.

### 3.4 Capability Verification Matrix (`src/platform/verification/verification-matrix.ts`)
- Maps every mutating capability across all 6 core domains:
  - `crm.deal.advance_stage` $\rightarrow$ `['crm:deal_stage_advanced']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `crm.entity.update` $\rightarrow$ `['crm:entity_updated']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `crm.note.create` $\rightarrow$ `['crm:note_created']` (WARNING, `RECORD_WARNING`)
  - `sdr.dispatch_whatsapp` $\rightarrow$ `['sales:outreach_sent']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `sdr.dispatch_email` $\rightarrow$ `['sales:outreach_sent']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `collections.execute_proposal` $\rightarrow$ `['finance:remainder_balanced']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `knowledge.candidate.decide` $\rightarrow$ `['knowledge:fact_superseded']` (CRITICAL, `FAIL_AND_COMPENSATE`)
  - `supervisor.mesh.route_handoff` $\rightarrow$ `['supervisor:delegation_bounded']` (CRITICAL, `FAIL_AND_COMPENSATE`)

### 3.5 Canonical Verification Capabilities (`src/platform/capabilities/verification/`)
- `verification.assert_postconditions`: (L0_READ) runs assertions against pre/post snapshots.
- `verification.get_execution_verification`: (L0_READ) fetches historical verification results by execution ID.
- Registered in `CapabilityRegistry` with explicit policies (`auditRequired: true`, etc.).

### 3.6 Next.js 15 Server Actions (`src/app/actions/verification-actions.ts`)
- `evaluatePostconditionsAction(input)`:
  - Enforces `'use server'` directive (Rule 51).
  - Clerk session authentication via `requireAuth()`.
  - Anti-IDOR validation via `assertTenantAccess(auth, input.organizationId)` (Rules 8 & 47).
  - Dead-man pause check via `checkGovernanceDeadManSwitch` (Rule 60).
  - Dispatches to `getPostconditionEngine().evaluatePostconditions`.
  - Returns `VerificationActionResult<VerificationResult>`.

### 3.7 Adversarial Security Red-Team & Chaos Battery
- `src/platform/__tests__/verification/verification-milestone-1-red-team.test.ts`:
  1. Attack Vector 1: Dead-man switch engaged fail-closed lockdown (Rule 60).
  2. Attack Vector 2: Missing or deleted target record detection (ungrounded mutation).
  3. Attack Vector 3: Adversarial prompt injection neutralization inside post-state evidence (Rules 13 & 30).
  4. Attack Vector 4: Cooperative timeout cancellation under adversarial hangs (Rule 26).

---

## 4. The Rule 67 Agent Implementation Gate Checklists

```text
ARCHITECTURE
□ What canonical capability does this use? (verification.assert_postconditions, verification.get_execution_verification)
□ Is this duplicating an existing service? (No, extends CapabilityRegistry with formal postcondition evaluation)
□ What is the source of truth? (Firestore operational snapshots + postcondition assertion results)
□ What events are emitted? (verification.assertion.evaluated, verification.execution.completed via defaultEventBus)

AUTHORITY
□ Who is allowed to use it? (Clerk session authenticated callers with valid tenant context)
□ What may the agent do? (Evaluate pre/post state snapshots, compute verification results)
□ What may the agent never do? (Bypass failed critical assertions or forge verification status - Rule 17)
□ Can a sub-agent inherit this authority? (Inherits verification read authority, cannot modify policies)

DATA
□ What data enters the agent? (Pre- and post-mutation resource snapshots, mutation payloads)
□ What data leaves the system? (Sanitized VerificationResult with passed/failed counts and assertion evidence)
□ What is trusted? (Internal schema definitions, database snapshots)
□ What is untrusted? (External status strings, user note text)
□ What is sensitive? (Scrubbed credentials via [REDACTED_SECRET:<type>])

EXECUTION
□ Is it idempotent? (Deterministic assertion IDs and hash evaluation)
□ Can it be retried? (Yes, pure postcondition evaluation is 100% idempotent)
□ Can it be cancelled? (Cooperative cancellation via AbortSignal - Rule 26)
□ Can it be duplicated? (Deduplicated via executionId)
□ What if the underlying record changes? (Fails closed and reports mismatch)
□ What if the response is lost? (Idempotent re-evaluation from snapshot)

MCP
□ What protocol version? (MCP Spec 2026-07-28)
□ What SDK version? (TypeScript SDK v2)
□ What capabilities? (verification.assert_postconditions, verification.get_execution_verification)
□ What annotations? (Risk level L0_READ, audit required)
□ What server identity? (Stateless HTTP streamable transport)
□ What schema version? (Zod v4 canonical contracts)
```

---

## 5. Detailed Task-by-Task Implementation Steps (TDD Protocol)

### Task 1: Canonical Verification Contracts & Zod Schemas
- [ ] **Step 1: Write failing contract tests**
  - Author `src/platform/__tests__/verification/verification-contracts.test.ts`.
  - Test valid assertion parsing, invalid status rejection, verification result validation, and `AgentVerificationError` HTTP mapping.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-contracts.test.ts`.
  - Expect failure: module `@/platform/verification/verification-types` not found.
- [ ] **Step 3: Implement contracts and barrel**
  - Create `src/platform/verification/verification-types.ts` and `src/platform/verification/index.ts`.
  - Define all Zod schemas, types, error taxonomy, and error class with zero `any`/`any[]`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-contracts.test.ts`.
  - Expect 100% pass.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(verification): define canonical verification contracts, zod schemas and error taxonomy"`

### Task 2: Core Postcondition Engine & Standardized Domain Assertions
- [ ] **Step 1: Write failing postcondition engine tests**
  - Author `src/platform/__tests__/verification/postcondition-engine.test.ts`.
  - Test passing assertion, failing assertion (state mismatch), prompt injection neutralization, and singleton preservation.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/postcondition-engine.test.ts`.
  - Expect failure: `PostconditionEngine` not found.
- [ ] **Step 3: Implement PostconditionEngine**
  - Create `src/platform/verification/postcondition-engine.ts`.
  - Implement assertion registry for CRM, Sales, Finance, Knowledge, and Supervisor.
  - Implement dead-man switch fail-closed evaluation (Rule 60) and prompt injection XML isolation (Rules 13 & 30).
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/postcondition-engine.test.ts`.
  - Expect 100% pass.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(verification): implement core PostconditionEngine and standardized domain assertions"`

### Task 3: Capability Verification Matrix & Recovery Routing
- [ ] **Step 1: Write failing verification matrix tests**
  - Author `src/platform/__tests__/verification/verification-matrix.test.ts`.
  - Test CRM, Sales, Finance mappings and default fallback for unmapped read-only capabilities.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-matrix.test.ts`.
  - Expect failure: `VERIFICATION_POLICY_MATRIX` not found.
- [ ] **Step 3: Implement Verification Matrix**
  - Create `src/platform/verification/verification-matrix.ts`.
  - Define `VERIFICATION_POLICY_MATRIX`, `getRequiredAssertionsForCapability`, and `resolveVerificationFailureStrategy`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-matrix.test.ts`.
  - Expect 100% pass.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(verification): establish VERIFICATION_POLICY_MATRIX and recovery strategies"`

### Task 4: Canonical Verification Capabilities Registration
- [ ] **Step 1: Write failing capability tests**
  - Author `src/platform/__tests__/verification/verification-capabilities.test.ts`.
  - Verify registration of `verification.assert_postconditions` and `verification.get_execution_verification`.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-capabilities.test.ts`.
  - Expect failure: capabilities not found in `CapabilityRegistry`.
- [ ] **Step 3: Implement verification capabilities**
  - Create `src/platform/capabilities/verification/verification-capabilities.ts` and `src/platform/capabilities/verification/index.ts`.
  - Re-export in `src/platform/capabilities/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-capabilities.test.ts`.
  - Expect 100% pass.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(verification): register canonical verification capabilities in CapabilityRegistry"`

### Task 5: Next.js 15 Server Actions & Anti-IDOR Security Boundary
- [ ] **Step 1: Write failing server action tests**
  - Author `src/platform/__tests__/verification/verification-actions.test.ts`.
  - Test clean execution for authorized callers and `IDOR_VIOLATION` for cross-tenant callers.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-actions.test.ts`.
  - Expect failure: `evaluatePostconditionsAction` not found.
- [ ] **Step 3: Implement verification server actions**
  - Create `src/app/actions/verification-actions.ts`.
  - Add `'use server'`, Clerk auth, `assertTenantAccess`, and dead-man pause check.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-actions.test.ts`.
  - Expect 100% pass.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(verification): implement secure Next.js 15 Server Actions for postcondition evaluation"`

### Task 6: Adversarial Security & Verification Test Battery
- [ ] **Step 1: Author adversarial red-team test suite**
  - Author `src/platform/__tests__/verification/verification-milestone-1-red-team.test.ts`.
  - Cover dead-man lockdown, missing target records, prompt injection neutralization, and timeout aborts.
- [ ] **Step 2: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/verification-milestone-1-red-team.test.ts`.
  - Expect 100% pass.
- [ ] **Step 3: Commit**
  - `git commit -m "test(verification): author 4-vector adversarial red-team and chaos test battery"`

---

## 6. Execution Notice & Hold Protocol

**CRITICAL INSTRUCTION:** Per user directive, implementation of Milestone 1 will **NOT** begin until this plan is formally reviewed and approved by the user.
