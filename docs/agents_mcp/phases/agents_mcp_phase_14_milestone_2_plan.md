# SmartSapp Agentic & MCP Transformation: Phase 14 Milestone 2 Plan
## State-Version Validation, Optimistic Concurrency Engine & TOCTOU Guard (`STATE_VERSION_MATRIX`)
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1964, Rules 67–69), `theme.md` §8, and `.agents/AGENTS.md`

**Version:** 3.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Goal & Milestone Overview

Milestone 2 implements the **State-Version Validation & Optimistic Concurrency Engine (`STATE_VERSION_MATRIX`)** and the **Time-of-Check to Time-of-Use (TOCTOU) Guard** for Phase 14 ("Agentic Self-Management & Verification").

It operationalizes Step 2 (Predict / Snapshot Pre-State) and Step 5 (Commit / Assert Version Unchanged) of SmartSapp's **6-Step Responsible Execution Loop**:
```text
PLAN → PREDICT (Snapshot Pre-State) → EXECUTE → VERIFY → COMMIT (Assert Version Unchanged) → LEARN
```

Autonomous agents and human operators must never perform blind writes against stale data. Before executing any mutating capability, agents capture a deterministic `ResourceSnapshot` with a canonical SHA-256 state hash. Before committing transactions, the engine verifies that the underlying resource has not drifted or been concurrently modified by another agent or user (**Rule 18 TOCTOU Guard & Rule 22 Cryptographic Tampering Defense**).

---

## 2. Exhaustive Rules Alignment with `docs/agents_mcp/agents_mcp_rules.md`

### 2.1 The Master Rules (Rules 1–69)

- **Rule 1 (Modern Web Guidance & Best Practices):** Server Actions ('use server') and concurrency services conform to modern Next.js 15 standards, Vercel React best practices, and serverless constraints.
- **Rule 2 (FMEA Failure Analysis):** Complete FMEA matrix covering TOCTOU race conditions, stealth attribute drift, phantom record deletions, IDOR tampering, and emergency lockdowns.
- **Rule 3 (Backoffice Governance Impact):** Backoffice operators can inspect snapshot histories, monitor concurrency conflicts, tune optimistic lease timeouts, and toggle emergency controls without code changes.
- **Rule 4 (Strict Typing):** Zero `any` or `any[]`. Bounded Zod v4 schemas only (`ResourceSnapshotSchema`, `VersionValidationResultSchema`). `unknown` narrowed immediately at boundaries.
- **Rule 5 (Staged Deployment & Verification):** All concurrency contracts, matrices, capabilities, and server actions are validated with rigorous test batteries before staging.
- **Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock):** Every snapshot capture and version validation strictly validates `organizationId` and `workspaceId`. Cross-tenant probes are rejected with HTTP 403 `IDOR_VIOLATION`.
- **Rule 10 (Inline Architectural Documentation):** Detailed comments explaining concurrency models, invariants, and failure modes across all source files.
- **Rule 11 (Mathematical Determinism):** Strict monotonic version sequence progression (`v + 1`) and deterministic state hashing over key-sorted JSON.
- **Rule 12 (Risk Vocabulary):** Concurrency capabilities strictly classified as `L0_READ`.
- **Rule 13 & 30 (Untrusted Data Isolation):** Any untrusted attributes in resource snapshots are sanitized against `ADVERSARIAL_DIRECTIVE_PATTERNS`.
- **Rule 14 (Schema Fingerprinting & Contracts):** Canonical Zod v4 contracts with deterministic property hashes preventing tool definition rug-pulls.
- **Rule 16 (Explicit Scoped RBAC):** Scoped non-wildcard permissions `concurrency:read` and `concurrency:snapshot` registered in `permission-refs.ts`.
- **Rule 17 (Non-Delegable Restrictions):** AI agents are strictly forbidden from overriding concurrency conflict rejections or bypassing TOCTOU checks.
- **Rule 18 (TOCTOU Optimistic Concurrency Guard):** Direct platform implementation verifying that live record versions and cryptographic state digests match pre-mutation snapshots.
- **Rule 19 (Deterministic Idempotency):** Snapshot generation and hash computation are 100% pure, repeatable, and deterministic.
- **Rule 20 (Replay / Duplicate Delivery Protection):** Snapshots carry immutable capture timestamps and unique deterministic IDs preventing replay.
- **Rule 21 & 22 (Two-Phase Execution & SHA-256 Hash Binding):** State hash computed over canonically key-sorted JSON representation (`canonicalizeJson`) to detect stealth drift.
- **Rule 23 (Resource Governance & Quotas):** Snapshot capture and verification bounded to $\le 5,000$ms timeout.
- **Rule 24 (Circuit Breakers):** Firestore contention or throttling trips circuit breakers with graceful backoff.
- **Rule 25 (Dead-Letter and Recovery Queues):** Failed mutations due to concurrency conflicts are routed to Dead-Letter Queues (DLQ) for operator review.
- **Rule 26 (Cooperative Cancellation):** Native `AbortSignal` supported throughout `StateVersionService`.
- **Rule 27 (Formal Saga / Compensation Model):** Concurrency conflicts halt multi-step sagas immediately and trigger reverse-LIFO rollback compensation.
- **Rule 40 (Domain Event Auditing):** Emits `concurrency.snapshot.captured` and `concurrency.conflict.detected` via `defaultEventBus`.
- **Rule 41 (Explainability Grid):** Conflict reports provide expected vs actual version, drift delta, and violation type (WHAT, WHY, EXPECTED STATE CHANGE).
- **Rule 42 (Shadow Mode & Simulation):** Concurrency verification supports `dryRun: true` producing zero live mutations.
- **Rule 44 (Deterministic Simulation):** Unit and integration suites mock database states to simulate competing writers and stale readers.
- **Rule 45 (Chaos Fault Injection):** Chaos testing covers Firestore contention, network timeouts, and concurrent modification races.
- **Rule 46 (Adversarial Agent Red-Team Battery):** Dedicated 4-vector red-team suite covering TOCTOU race bypass, SHA-256 state tampering, emergency pause bypass, and phantom deletions.
- **Rule 47 (Never Trust the Model):** Concurrency validation is evaluated server-side independently of model output or claims.
- **Rule 48 (Sanitized Error Taxonomy):** `StateConcurrencyError` with mapped HTTP status codes (400, 403, 404, 409, 503, 504).
- **Rule 50 (Cache Isolation):** In-memory snapshot caches are strictly partitioned by `organizationId:workspaceId:resourceType:resourceId`.
- **Rule 51 (Server Actions Security):** `'use server'`, Clerk session authentication (`requireAuth()`), Anti-IDOR tenant lock (`assertTenantAccess`), and emergency dead-man switch evaluation (Rule 60).
- **Rule 60 (Emergency Dead-Man Switch Evaluation):** Checks `checkGovernanceDeadManSwitch(orgId)` and fails closed immediately with HTTP 503 `CONCURRENCY_DEAD_MAN_PAUSED`.
- **Rule 61 (Backoffice Control Plane):** Operations can inspect snapshots, monitor conflict telemetry, and tune lease durations without code deployments.
- **Rule 67 (The Agent Implementation Gate):** Fully satisfies Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing, and Migration checklists.
- **Rule 68 (The Five Non-Negotiables):**
  1. The model is never the security boundary.
  2. Tool output is untrusted data.
  3. Every mutation must be idempotent, authorized, version-checked, and auditable.
  4. Every production agent must have bounded authority and bounded resources.
  5. Every autonomous capability must be operable without code.
- **Rule 69 (Strangler Fig Invariant):** Governed capability layer underneath SmartSapp, 100% backward compatible with existing Firestore collections and domain services.

---

## 3. The 4 Mandatory Governance Matrices (Rules 1940–1953)

### 3.1 Concurrency Permission Matrix (Rule 16)
| Persona / Principal | `concurrency:read` | `concurrency:snapshot` | `concurrency:override` |
| :--- | :---: | :---: | :---: |
| `autonomous_agent` | ALLOWED | ALLOWED | **FORBIDDEN (Rule 17)** |
| `human_operator` | ALLOWED | ALLOWED | REQUIRES_ADMIN_OVERRIDE |
| `backoffice_admin` | ALLOWED | ALLOWED | ALLOWED (Audited) |

### 3.2 Concurrency Tool Matrix (Rule 12 & 14)
| Tool / Capability | Risk Classification | Requires Expected Version | Audit Required | Idempotent |
| :--- | :---: | :---: | :---: | :---: |
| `concurrency.snapshot_resource` | `L0_READ` | No | Yes | Yes |
| `concurrency.verify_version` | `L0_READ` | Yes | Yes | Yes |

### 3.3 Concurrency Failure Matrix (Rule 2 & 48)
| Error Code | HTTP Status | Root Cause | Deterministic Recovery Strategy |
| :--- | :---: | :--- | :--- |
| `STALE_VERSION_DETECTED` | 409 | `actualVersion > expectedVersion` | `FAIL_CLOSED` (Abort execution, trigger replan or alert operator) |
| `CONCURRENT_MUTATION_CONFLICT` | 409 | Competing agent/user modified record | `FAIL_CLOSED` (Reject mutation, refresh snapshot) |
| `STATE_HASH_MISMATCH` | 409 | Attributes modified without version bump | `FAIL_CLOSED` (Reject mutation, report hash drift) |
| `RESOURCE_NOT_FOUND` | 404 | Record deleted after planning | `FAIL_CLOSED` (Abort execution) |
| `CONCURRENCY_DEAD_MAN_PAUSED` | 503 | Platform emergency pause active | `FAIL_CLOSED` (Halt immediately) |
| `CONCURRENCY_TIMEOUT` | 504 | Verification exceeded 5,000ms | `FAIL_CLOSED` (Abort with timeout) |
| `IDOR_VIOLATION` | 403 | Cross-tenant resource probe | `FAIL_CLOSED` (Log security alert, reject) |

### 3.4 Concurrency Rollback Matrix (Rule 27)
| Mutating Capability | Concurrency Check Location | Rollback / Compensating Capability |
| :--- | :--- | :--- |
| `crm.entity.update` | Pre-commit step | Revert entity to snapshot attributes |
| `deals.stage.advance` | Pre-commit step | Revert deal stage to previous stage |
| `finance.invoice.update` | Pre-commit step | Revert invoice state |
| `knowledge.fact.update` | Pre-commit step | Restore superseded fact validity |

---

## 4. FMEA Failure Mode & Effects Analysis (Rule 2)

| Failure Mode | Root Cause | Risk Level | Automatic Mitigation & Recovery Strategy |
| :--- | :--- | :---: | :--- |
| **TOCTOU Race Condition** | Human operator or competing agent updates resource between agent read and write. | **CRITICAL** | `StateVersionService.assertVersionCurrent` detects `actualVersion > expectedVersion`, rejects mutation with HTTP 409 `STALE_VERSION_DETECTED`, and triggers replan or alert. |
| **Stealth Attribute Tampering** | Resource version was not bumped, but critical fields were modified out-of-band. | **CRITICAL** | Cryptographic canonical SHA-256 `stateHash` detects bit-level differences; fails closed with HTTP 409 `STATE_HASH_MISMATCH`. |
| **Phantom Deletion** | Target record deleted after planning step. | **CRITICAL** | Evaluator checks post-read existence; halts closed with HTTP 404 `RESOURCE_NOT_FOUND`. |
| **Cross-Tenant Snapshot Probing (IDOR)** | Malicious agent attempts to snapshot or verify resources belonging to another organization. | **HIGH** | `assertTenantContext` and `assertTenantAccess` enforce caller `organizationId === resource.organizationId`; fails with HTTP 403 `IDOR_VIOLATION`. |
| **Emergency Lockdown Active** | Platform kill switch engaged during concurrency verification. | **CRITICAL** | `checkGovernanceDeadManSwitch` throws immediately; returns HTTP 503 `CONCURRENCY_DEAD_MAN_PAUSED`. |
| **Adversarial Latency Hang** | Downstream database read stalls or hangs indefinitely. | **HIGH** | `AbortSignal.timeout(5000)` aborts evaluation; throws HTTP 504 `CONCURRENCY_TIMEOUT`. |
| **Clock Skew / Expired Lease** | Snapshot held longer than allowed lease duration. | **MEDIUM** | Engine flags lease expiration; recommends fresh snapshot capture before write. |

---

## 5. Deliverables & Specifications

### 5.1 State Version Contracts (`src/platform/verification/concurrency/state-version-types.ts`)
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

### 5.2 Error Taxonomy (`CONCURRENCY_ERROR_CODES`) & Typed Error Class
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

### 5.3 State Version Matrix (`src/platform/verification/concurrency/state-version-matrix.ts`)
Authoritative `STATE_VERSION_MATRIX` registry:
- `crm_entity`: collection `/entities/{id}` & `/workspace_entities/{ws}_{id}`, versionField `version`, lease 30,000ms.
- `deal`: collection `/deals/{id}`, versionField `stageVersion`, lease 15,000ms.
- `invoice`: collection `/invoices/{id}`, versionField `version`, lease 60,000ms.
- `installment_plan`: collection `/installment_plans/{id}`, versionField `version`, lease 30,000ms.
- `knowledge_fact`: collection `/knowledge_facts/{id}`, versionField `version`, lease 10,000ms.
- `mesh_task`: collection `/mesh_tasks/{id}`, versionField `version`, lease 15,000ms.

### 5.4 State Version Service (`src/platform/verification/concurrency/state-version-service.ts`)
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

### 5.5 Canonical Concurrency Capabilities (`src/platform/capabilities/concurrency/`)
- `concurrency.snapshot_resource` (L0_READ)
- `concurrency.verify_version` (L0_READ)
- Registered in `CapabilityRegistry` with permissions `concurrency:snapshot` and `concurrency:read`.

### 5.6 Next.js 15 Server Actions (`src/app/actions/concurrency-actions.ts`)
- `captureResourceSnapshotAction`
- `verifyResourceVersionAction`
- Fully protected with Clerk auth (`requireAuth()`), Anti-IDOR lock, dead-man check, and sanitized error taxonomy.

---

## 6. The Complete Rule 67 Agent Implementation Gate Checklists

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
□ What happens if the tool definition changes? (Fingerprint drift detection fails closed - Rule 14)

FAILURE
□ Timeout? (AbortSignal.timeout(5000) aborts with CONCURRENCY_TIMEOUT - HTTP 504)
□ 429? (Exponential backoff with jitter)
□ 500? (Fails closed, records alert)
□ Partial execution? (No partial writes; evaluation is atomic)
□ Provider unavailable? (Fails closed, degrades gracefully)
□ Stale approval? (Checked against current version; rejected if drifted)
□ Concurrent modification? (Rejects mutation with HTTP 409 STALE_VERSION_DETECTED)

SECURITY
□ Prompt injection? (Directives in memo/text attributes neutralized)
□ Tool poisoning? (Tool fingerprints pinned)
□ Confused deputy? (Multi-tenant lock enforced strictly)
□ SSRF? (No external network egress)
□ Exfiltration? (Zero PII emitted in events)
□ Privilege escalation? (Agents cannot grant concurrency override)
□ Cross-tenant leakage? (Anti-IDOR assertTenantAccess strictly enforced)

OPERATIONS
□ Can Backoffice disable it? (Yes, via emergency dead-man switch - Rule 60)
□ Can Backoffice inspect it? (Yes, via snapshot and conflict audit telemetry - Rule 41)
□ Can Backoffice replay it? (Yes, snapshots are deterministic and replayable)
□ Can Backoffice rollback it? (Yes, rollback capabilities mapped in Rollback Matrix)
□ Can Backoffice change policy without code? (Yes, lease durations configurable in Backoffice - Rule 61)

TESTING
□ Unit: state-version-contracts.test.ts
□ Integration: state-version-service.test.ts, state-version-matrix.test.ts
□ Contract: concurrency-capabilities.test.ts
□ E2E: concurrency-actions.test.ts
□ Security: Anti-IDOR cross-tenant test suite
□ Adversarial: concurrency-red-team.test.ts (4 attack vectors)
□ Chaos: Firestore contention and latency injection tests
□ Evaluation: Gold-standard conflict benchmarks

MIGRATION
□ Existing behavior preserved? (100% backward compatible with existing Firestore collections - Rule 69)
□ Existing routes preserved? (Zero breaking changes to existing routes or actions)
□ Existing data preserved? (No data schema mutations or migrations required)
□ Backfill needed? (Existing records without version field default to initial version 1)
□ Restore procedure documented? (Restoration via snapshot attributes)
□ Rollback documented? (Reverse-LIFO saga compensation)
```

---

## 7. Detailed Task-by-Task Implementation Steps (TDD Protocol)

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

## 8. Execution Notice & Hold Protocol

**CRITICAL INSTRUCTION:** Per user directive, implementation of Milestone 2 will **NOT** begin until this plan is formally reviewed and approved by the user.
