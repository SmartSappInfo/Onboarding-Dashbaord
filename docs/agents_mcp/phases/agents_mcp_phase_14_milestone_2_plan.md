# SmartSapp Agentic & MCP Transformation: Phase 14 Milestone 2 Plan
## State-Version Validation, Optimistic Concurrency Engine & TOCTOU Guard
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1964, Rules 67–69), `theme.md` §8, and `.agents/AGENTS.md`

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Goal & Milestone Overview

Milestone 2 implements the **State-Version Validation & Optimistic Concurrency Engine (`STATE_VERSION_MATRIX`)** and the **Time-of-Check to Time-of-Use (TOCTOU) Guard** for Phase 14 ("Agentic Self-Management & Verification").

It enforces Step 2 (Predict / Snapshot Pre-State) and Step 5 (Commit / Assert Version Unchanged) of SmartSapp's 6-Step Responsible Execution Loop:
```text
PLAN → PREDICT (Snapshot Pre-State) → EXECUTE → VERIFY → COMMIT (Assert Version Unchanged) → LEARN
```

Autonomous agents and human operators must never perform blind writes against stale data. Before executing any mutating capability, agents capture a deterministic `ResourceSnapshot` with a canonical SHA-256 state hash. Before committing transactions, the engine verifies that the underlying resource has not drifted or been concurrently modified by another agent or user (**Rule 18 TOCTOU Guard & Rule 22 Cryptographic Tampering Defense**).

---

## 2. Review of Source Documentation & Architectural Invariants

### 2.1 Alignment with `docs/agents_mcp/agents_mcp_roadmap.md` (§PHASE 14, lines 1867–1976)
- **The Core Axiom:** "Every mutating capability must declare pre-conditions, post-conditions, and rollback capability."
- **Optimistic Concurrency Control:**
  - Before mutation: capture resource snapshot (`version`, canonical SHA-256 hash of state).
  - During mutation: check atomic version lease.
  - Before commit: verify `currentVersion === expectedVersion` and `hash(currentState) === expectedPreHash`.
  - On conflict: halt execution immediately with `STALE_VERSION_DETECTED` (HTTP 409), trigger compensation or alert operator.

### 2.2 Alignment with `docs/agents_mcp/agents_mcp_rules.md`
- **Rule 1 (Modern Web Guidance & Best Practices):** Server actions and concurrency services conform to modern Next.js 15 standards.
- **Rule 2 (FMEA Failure Analysis):** Exhaustive failure mode analysis covering TOCTOU races, stealth attribute drift, phantom deletions, and emergency lockdowns.
- **Rule 3 (Backoffice Governance Impact):** Backoffice operators can inspect snapshot history, audit concurrency conflicts, and adjust optimistic lease timeouts without code changes.
- **Rule 4 (Strict Typing):** Zero `any` or `any[]`. Bounded Zod v4 schemas only.
- **Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock):** Every snapshot capture and version validation strictly validates `organizationId` and `workspaceId`. Cross-tenant probes are rejected with HTTP 403 `IDOR_VIOLATION`.
- **Rule 10 (Inline Architectural Documentation):** Detailed comments explaining concurrency models, invariants, and failure modes.
- **Rule 11 (Mathematical Determinism):** Strict monotonic version sequence progression (`v + 1`) and deterministic state hashing.
- **Rule 12 (Risk Vocabulary):** Concurrency capabilities strictly classified as `L0_READ`.
- **Rule 13 & 30 (Untrusted Data Isolation):** Any untrusted attributes in resource snapshots are sanitized against `ADVERSARIAL_DIRECTIVE_PATTERNS`.
- **Rule 14 (Schema Fingerprinting & Contracts):** Canonical Zod v4 contracts with deterministic property hashes.
- **Rule 16 (Explicit RBAC Scopes):** Scoped permissions `concurrency:read` and `concurrency:snapshot` registered in `permission-refs.ts`.
- **Rule 17 (Non-Delegable Actions):** AI agents are strictly forbidden from overriding concurrency conflict rejections or bypassing TOCTOU checks.
- **Rule 18 (TOCTOU Optimistic Concurrency Guard):** Direct implementation of the platform-wide TOCTOU concurrency firewall.
- **Rule 19 (Deterministic Idempotency):** Snapshot generation and hash computation are 100% pure and deterministic.
- **Rule 21 & 22 (Two-Phase Execution & SHA-256 Hash Binding):** State hash computed over canonically key-sorted JSON representation.
- **Rule 23 (Resource Governance):** Snapshot capture and verification bounded to $\le 5,000$ms.
- **Rule 26 (Cooperative Cancellation):** Native `AbortSignal` supported throughout `StateVersionService`.
- **Rule 40 (Domain Event Auditing):** Emits `concurrency.snapshot.captured` and `concurrency.conflict.detected` via `defaultEventBus`.
- **Rule 41 (Explainability Grid):** Conflict reports provide expected vs actual version, drift delta, and violation type.
- **Rule 48 (Sanitized Error Taxonomy):** `StateConcurrencyError` with mapped HTTP status codes (400, 403, 404, 409, 503, 504).
- **Rule 51 (Server Actions Security):** `'use server'`, Clerk session authentication (`requireAuth()`), Anti-IDOR tenant lock (`assertTenantAccess`), and emergency dead-man switch evaluation (Rule 60).
- **Rule 60 (Emergency Dead-Man Switch Evaluation):** Checks `checkGovernanceDeadManSwitch(orgId)` and fails closed immediately with HTTP 503 `CONCURRENCY_DEAD_MAN_PAUSED`.
- **Rule 67 (The Agent Implementation Gate):** Fully satisfies Architecture, Authority, Data, Execution, and MCP checklists.
- **Rule 68 (The Five Non-Negotiables):** Zero `any`, no raw HTML, performance bounds, tactile buttons, fail-closed security.
- **Rule 69 (Strangler Fig Invariant):** 100% backward compatible with existing Firestore collections and domain services.

---

## 3. FMEA Failure Mode & Effects Analysis (Rule 2)

| Failure Mode | Root Cause | Risk Level | Automatic Mitigation & Recovery Strategy |
| :--- | :--- | :---: | :--- |
| **TOCTOU Race Condition** | Human operator or competing agent updates resource between agent read and write. | **CRITICAL** | `StateVersionService.assertVersionCurrent` detects `actualVersion > expectedVersion`, rejects mutation with HTTP 409 `STALE_VERSION_DETECTED`, and triggers replan or alert. |
| **Stealth Attribute Tampering** | Resource version was not bumped, but critical fields were modified out-of-band. | **CRITICAL** | Cryptographic canonical SHA-256 `stateHash` detects bit-level differences; fails closed with HTTP 409 `STATE_HASH_MISMATCH`. |
| **Phantom Deletion** | Target record deleted after planning step. | **CRITICAL** | Evaluator checks post-read existence; halts closed with HTTP 404 `RESOURCE_NOT_FOUND`. |
| **Cross-Tenant Snapshot Probing (IDOR)** | Malicious agent attempts to snapshot or verify resources belonging to another organization. | **HIGH** | `assertTenantContext` and `assertTenantAccess` enforce caller `organizationId === resource.organizationId`; fails with HTTP 403 `IDOR_VIOLATION`. |
| **Emergency Lockdown Active** | Platform kill switch engaged during concurrency verification. | **CRITICAL** | `checkGovernanceDeadManSwitch` throws immediately; returns HTTP 503 `CONCURRENCY_DEAD_MAN_PAUSED`. |
| **Adversarial Latency Hang** | Downstream database read stalls or hangs indefinitely. | **HIGH** | `AbortSignal.timeout(5000)` aborts evaluation; throws HTTP 504 `CONCURRENCY_TIMEOUT`. |

---

## 4. Deliverables & Specifications

### 4.1 State Version Contracts (`src/platform/verification/concurrency/state-version-types.ts`)
```typescript
export const ConcurrencyViolationTypeSchema = z.enum([
  'NONE',
  'STALE_READ',
  'CONCURRENT_MUTATION',
  'DELETED_RESOURCE',
  'HASH_DRIFT',
]);
export type ConcurrencyViolationType = z.infer<typeof ConcurrencyViolationTypeSchema>;

export const ResourceSnapshotSchema = z.object({
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  version: z.union([z.number(), z.string()]),
  stateHash: z.string().length(64), // SHA-256 over key-sorted JSON
  capturedAt: z.string().datetime(),
  attributes: z.record(z.string(), z.unknown()),
});
export type ResourceSnapshot = z.infer<typeof ResourceSnapshotSchema>;

export const VersionValidationResultSchema = z.object({
  isCurrent: z.boolean(),
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  expectedVersion: z.union([z.number(), z.string()]),
  actualVersion: z.union([z.number(), z.string()]).nullable(),
  driftDetected: z.boolean(),
  violationType: ConcurrencyViolationTypeSchema,
  message: z.string(),
  capturedAt: z.string().datetime(),
});
export type VersionValidationResult = z.infer<typeof VersionValidationResultSchema>;

export const StateVersionMatrixEntrySchema = z.object({
  resourceType: z.string().min(1),
  collectionPath: z.string().min(1),
  versionField: z.string().min(1),
  leaseDurationMs: z.number().int().positive(),
  requiresHashValidation: z.boolean(),
});
export type StateVersionMatrixEntry = z.infer<typeof StateVersionMatrixEntrySchema>;
```

### 4.2 Error Taxonomy (`CONCURRENCY_ERROR_CODES`) & Typed Error Class
```typescript
export const CONCURRENCY_ERROR_CODES = {
  STALE_VERSION_DETECTED: 'STALE_VERSION_DETECTED',
  CONCURRENT_MUTATION_CONFLICT: 'CONCURRENT_MUTATION_CONFLICT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  STATE_HASH_MISMATCH: 'STATE_HASH_MISMATCH',
  CONCURRENCY_DEAD_MAN_PAUSED: 'CONCURRENCY_DEAD_MAN_PAUSED',
  CONCURRENCY_TIMEOUT: 'CONCURRENCY_TIMEOUT',
  INVALID_SNAPSHOT_CONTEXT: 'INVALID_SNAPSHOT_CONTEXT',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
} as const;

export type ConcurrencyErrorCode =
  (typeof CONCURRENCY_ERROR_CODES)[keyof typeof CONCURRENCY_ERROR_CODES];

export class StateConcurrencyError extends Error {
  public readonly code: ConcurrencyErrorCode;
  public readonly statusCode: number;

  constructor(code: ConcurrencyErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'StateConcurrencyError';
    this.code = code;
    this.statusCode = statusCode ?? this.resolveStatusCode(code);
  }

  private resolveStatusCode(code: ConcurrencyErrorCode): number {
    switch (code) {
      case 'INVALID_SNAPSHOT_CONTEXT':
        return 400;
      case 'IDOR_VIOLATION':
        return 403;
      case 'RESOURCE_NOT_FOUND':
        return 404;
      case 'STALE_VERSION_DETECTED':
      case 'CONCURRENT_MUTATION_CONFLICT':
      case 'STATE_HASH_MISMATCH':
        return 409;
      case 'CONCURRENCY_DEAD_MAN_PAUSED':
        return 503;
      case 'CONCURRENCY_TIMEOUT':
        return 504;
      default:
        return 500;
    }
  }
}
```

### 4.3 State Version Matrix (`src/platform/verification/concurrency/state-version-matrix.ts`)
Authoritative `STATE_VERSION_MATRIX` registry:
- `crm_entity`: collection `/entities/{id}` & `/workspace_entities/{ws}_{id}`, versionField `version`, lease 30,000ms.
- `deal`: collection `/deals/{id}`, versionField `stageVersion`, lease 15,000ms.
- `invoice`: collection `/invoices/{id}`, versionField `version`, lease 60,000ms.
- `installment_plan`: collection `/installment_plans/{id}`, versionField `version`, lease 30,000ms.
- `knowledge_fact`: collection `/knowledge_facts/{id}`, versionField `version`, lease 10,000ms.
- `mesh_task`: collection `/mesh_tasks/{id}`, versionField `version`, lease 15,000ms.

### 4.4 State Version Service (`src/platform/verification/concurrency/state-version-service.ts`)
- Pure, deterministic concurrency manager:
  - `captureSnapshot(resourceType, resourceId, resourceData, context, options)`:
    - Verifies dead-man switch (Rule 60) and signal cancellation (Rule 26).
    - Sorts attributes canonically and calculates SHA-256 state hash (Rule 22).
    - Returns typed `ResourceSnapshot`.
    - Emits `concurrency.snapshot.captured` domain event (Rule 40).
  - `validateResourceVersion(snapshot, currentResourceData, context)`:
    - Compares `snapshot.version` with `currentResourceData[versionField]`.
    - If `currentResourceData` is null: violation is `DELETED_RESOURCE`.
    - If version differs: violation is `STALE_READ` or `CONCURRENT_MUTATION`.
    - If version matches but hash differs: violation is `HASH_DRIFT`.
    - Returns `VersionValidationResult`.
  - `assertVersionCurrent(expectedSnapshot, currentResourceData, context)`:
    - Calls `validateResourceVersion`.
    - Throws `StateConcurrencyError` immediately on violation.
  - Global singleton preservation: `getStateVersionService()`.

### 4.5 Canonical Concurrency Capabilities (`src/platform/capabilities/concurrency/`)
- `concurrency.snapshot_resource` (L0_READ)
- `concurrency.verify_version` (L0_READ)
- Registered in `CapabilityRegistry` with permissions `concurrency:snapshot` and `concurrency:read`.

### 4.6 Next.js 15 Server Actions (`src/app/actions/concurrency-actions.ts`)
- `captureResourceSnapshotAction`
- `verifyResourceVersionAction`
- Fully protected with Clerk auth (`requireAuth()`), Anti-IDOR lock, dead-man check, and sanitized error taxonomy.

---

## 5. The Rule 67 Agent Implementation Gate Checklists

```text
ARCHITECTURE
□ What canonical capability does this use? (concurrency.snapshot_resource, concurrency.verify_version)
□ Is this duplicating an existing service? (No, formalizes state snapshotting & TOCTOU guard)
□ What is the source of truth? (Firestore resource versions & canonical SHA-256 state digests)
□ What events are emitted? (concurrency.snapshot.captured, concurrency.conflict.detected via defaultEventBus)

AUTHORITY
□ Who is allowed to use it? (Clerk session authenticated callers with valid tenant context)
□ What may the agent do? (Capture immutable pre-state snapshots, assert optimistic version currency)
□ What may the agent never do? (Perform blind overwrites or bypass TOCTOU conflict checks - Rule 18)
□ Can a sub-agent inherit this authority? (Inherits read snapshot authority, cannot disable concurrency rules)

DATA
□ What data enters the agent? (Target resource IDs, resource types, raw document snapshots)
□ What data leaves the system? (Sanitized ResourceSnapshot and VersionValidationResult)
□ What is trusted? (Internal database states, cryptographic hash digests)
□ What is untrusted? (Client-provided expected versions, unverified post-payloads)
□ What is sensitive? (Scrubbed credentials via [REDACTED_SECRET:<type>])

EXECUTION
□ Is it idempotent? (Deterministic SHA-256 hash evaluation and pure version validation)
□ Can it be retried? (Yes, snapshots and version checks are 100% idempotent)
□ Can it be cancelled? (Cooperative cancellation via AbortSignal - Rule 26)
□ Can it be duplicated? (Safe across concurrent reads)
□ What if the underlying record changes? (Fails closed immediately with STALE_VERSION_DETECTED - HTTP 409)
□ What if the response is lost? (Idempotent re-validation from snapshot)

MCP
□ What protocol version? (MCP Spec 2026-07-28)
□ What SDK version? (TypeScript SDK v2)
□ What capabilities? (concurrency.snapshot_resource, concurrency.verify_version)
□ What annotations? (Risk level L0_READ, audit required)
□ What server identity? (Stateless HTTP streamable transport)
□ What schema version? (Zod v4 canonical contracts)
```

---

## 6. Detailed Task-by-Task Implementation Steps (TDD Protocol)

### Task 1: State Version Contracts & Zod Schemas
- [ ] **Step 1: Write failing contract tests**
  - Author `src/platform/__tests__/verification/state-version-contracts.test.ts`.
  - Test valid snapshot parsing, violation type validation, and `StateConcurrencyError` HTTP mapping (409, 404, 403, 503, 504).
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-contracts.test.ts`.
- [ ] **Step 3: Implement contracts and barrel**
  - Create `src/platform/verification/concurrency/state-version-types.ts` and `src/platform/verification/concurrency/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-contracts.test.ts`.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(concurrency): define state version contracts, zod schemas and error taxonomy"`

### Task 2: State Version Matrix & Resource Policies
- [ ] **Step 1: Write failing matrix tests**
  - Author `src/platform/__tests__/verification/state-version-matrix.test.ts`.
  - Verify resource policy lookup for `crm_entity`, `deal`, `invoice`, `installment_plan`, `knowledge_fact`.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-matrix.test.ts`.
- [ ] **Step 3: Implement State Version Matrix**
  - Create `src/platform/verification/concurrency/state-version-matrix.ts`.
  - Define `STATE_VERSION_MATRIX` and lookup helpers.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-matrix.test.ts`.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(concurrency): establish STATE_VERSION_MATRIX and resource version policies"`

### Task 3: Core State Version & Optimistic Concurrency Service
- [ ] **Step 1: Write failing service tests**
  - Author `src/platform/__tests__/verification/state-version-service.test.ts`.
  - Test snapshot capture, canonical SHA-256 state hashing, TOCTOU drift detection, and dead-man fail-closed semantics.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-service.test.ts`.
- [ ] **Step 3: Implement StateVersionService**
  - Create `src/platform/verification/concurrency/state-version-service.ts`.
  - Implement `captureSnapshot`, `validateResourceVersion`, and `assertVersionCurrent`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/state-version-service.test.ts`.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(concurrency): implement StateVersionService and TOCTOU optimistic guard"`

### Task 4: Canonical Concurrency Capabilities Registration
- [ ] **Step 1: Write failing capability tests**
  - Author `src/platform/__tests__/verification/concurrency-capabilities.test.ts`.
  - Test registration of `concurrency.snapshot_resource` and `concurrency.verify_version`.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/concurrency-capabilities.test.ts`.
- [ ] **Step 3: Implement concurrency capabilities**
  - Create `src/platform/capabilities/concurrency/concurrency-capabilities.ts` and `src/platform/capabilities/concurrency/index.ts`.
  - Register canonical permissions `concurrency:read` and `concurrency:snapshot` in `permission-refs.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/concurrency-capabilities.test.ts`.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(concurrency): register canonical concurrency capabilities in CapabilityRegistry"`

### Task 5: Next.js 15 Server Actions & Anti-IDOR Security Boundary
- [ ] **Step 1: Write failing server action tests**
  - Author `src/platform/__tests__/verification/concurrency-actions.test.ts`.
  - Test session auth, Anti-IDOR enforcement, dead-man fail-closed, and snapshot capture/verify.
- [ ] **Step 2: Run test to verify it fails**
  - Run `pnpm vitest run src/platform/__tests__/verification/concurrency-actions.test.ts`.
- [ ] **Step 3: Implement server actions**
  - Create `src/app/actions/concurrency-actions.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/concurrency-actions.test.ts`.
- [ ] **Step 5: Commit**
  - `git commit -m "feat(concurrency): implement secure Next.js 15 Server Actions for optimistic concurrency"`

### Task 6: Adversarial Security & Concurrency Test Battery
- [ ] **Step 1: Author adversarial red-team test suite**
  - Author `src/platform/__tests__/verification/concurrency-red-team.test.ts`.
  - Cover TOCTOU race condition, SHA-256 tampering, dead-man lockdown, and phantom deletion.
- [ ] **Step 2: Run test to verify it passes**
  - Run `pnpm vitest run src/platform/__tests__/verification/concurrency-red-team.test.ts`.
- [ ] **Step 3: Commit**
  - `git commit -m "test(concurrency): author 4-vector adversarial red-team and chaos test battery"`

---

## 7. Execution Notice & Hold Protocol

**CRITICAL INSTRUCTION:** Per user directive, implementation of Milestone 2 will **NOT** begin until this plan is formally reviewed and approved by the user.
