# Phase 6 Milestone 4 Implementation Plan: Step Verification, Human-in-the-Loop Proposal Interception & Two-Phase Approval

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement step output validation, post-condition verification, two-phase approval interception with cryptographic payload binding, and the unified end-to-end autonomous agent execution loop orchestrator.

**Architecture:** A layered, fail-closed runtime pipeline conforming to the Rule 47 execution principle (`MODEL -> PROPOSAL -> VALIDATOR -> POLICY -> PERMISSION -> EXECUTOR -> VERIFIER`). Step outputs are validated against capability schemas, sanitized against internal error leakage (Rule 48), and containerized in `<untrusted_reference_data>` boundaries (Rule 30). High-risk (L3/L4/non-delegable) operations are intercepted to generate two-phase `ActionProposal` records with SHA-256 `payloadHash` binding (Rules 21 & 22) in `/admin/approvals`. Post-conditions are verified against planned state changes (`expectedStateChange`), triggering dynamic replanning or LIFO Saga compensation on failure (Rules 23 & 27). The complete loop is coordinated by `AgentExecutionLoop`, integrating dead-man controls (Rule 60), budget reservations (Rule 23), and cooperative cancellation (Rule 26).

**Tech Stack:** TypeScript (strict mode, zero `any`/`any[]`), Zod v4, Node.js `node:crypto`, Google Genkit / Capability Registry, Vitest.

---

## File Structure & Module Map

```
src/platform/runtime/
├── agent-run-types.ts                      (Augment: add APPROVAL_REQUIRED, APPROVAL_REJECTED, PAYLOAD_TAMPERED error codes)
├── execution/
│   ├── execution-types.ts                  (New: Step validation, verification, and execution loop contracts)
│   ├── step-validator.ts                   (New: Output schema validation, error sanitization, untrusted XML containerization)
│   ├── step-verifier.ts                    (New: Post-condition verification, state assertions, failure diagnostics)
│   ├── approval-interceptor.ts             (New: High-risk detection, proposal generation, SHA-256 payloadHash binding)
│   ├── agent-execution-loop.ts             (New: End-to-end autonomous execution loop orchestrator)
│   └── index.ts                            (New: Execution module public barrel)
└── index.ts                                (Modify: export execution module)

src/platform/__tests__/runtime/
├── step-validator.test.ts                  (New: Tests for output validation, error sanitization, prompt injection isolation)
├── step-verifier.test.ts                   (New: Tests for post-condition verification, state assertions, replanner diagnostics)
├── approval-interceptor.test.ts            (New: Tests for proposal generation, SHA-256 binding, pause/resume, tampering rejection)
└── agent-execution-loop.test.ts            (New: Comprehensive integration tests for full autonomous execution loop)
```

---

## Tasks Breakdown

### Task 1: Execution Contracts, Types & Error Taxonomy

**Files:**
- Modify: `src/platform/runtime/agent-run-types.ts`
- Create: `src/platform/runtime/execution/execution-types.ts`
- Test: `src/platform/__tests__/runtime/step-validator.test.ts` (contract sanity)

- [ ] **Step 1: Write the failing test for execution contracts**

```typescript
// src/platform/__tests__/runtime/execution-contracts.test.ts
import { describe, it, expect } from 'vitest';
import {
  StepValidationResultSchema,
  StepVerificationResultSchema,
  ApprovalInterceptionResultSchema,
  ExecutionLoopOptionsSchema,
  EXECUTION_ERROR_CODES,
  ExecutionError,
} from '@/platform/runtime/execution/execution-types';

describe('Execution Contracts & Schemas (Rules 4, 13, 21, 22, 30, 31, 48)', () => {
  it('validates StepValidationResultSchema for success and failure', () => {
    const successResult = StepValidationResultSchema.safeParse({
      valid: true,
      validatedOutput: { contactId: 'con_123', status: 'created' },
      isolatedXmlOutput: '<untrusted_reference_data id="step_output_step_1">{"contactId":"con_123"}</untrusted_reference_data>',
      tokensUsed: 45,
    });
    expect(successResult.success).toBe(true);

    const failureResult = StepValidationResultSchema.safeParse({
      valid: false,
      sanitizedError: {
        code: 'SCHEMA_VALIDATION_FAILED',
        message: 'Required field "email" is missing.',
      },
      validationErrors: ['email is required'],
      isolatedXmlOutput: '<untrusted_reference_data id="step_output_step_1">ERROR: email is required</untrusted_reference_data>',
      tokensUsed: 15,
    });
    expect(failureResult.success).toBe(true);
  });

  it('validates StepVerificationResultSchema with state assertions', () => {
    const verified = StepVerificationResultSchema.safeParse({
      verified: true,
      assertionDetails: 'Entity con_123 verified created with status active',
      observedState: { exists: true, status: 'active' },
    });
    expect(verified.success).toBe(true);

    const failed = StepVerificationResultSchema.safeParse({
      verified: false,
      rejectionReason: 'Expected status "active", observed "pending"',
      observedState: { exists: true, status: 'pending' },
      suggestedRemediation: 'Trigger status activation step',
    });
    expect(failed.success).toBe(true);
  });

  it('validates ApprovalInterceptionResultSchema', () => {
    const intercepted = ApprovalInterceptionResultSchema.safeParse({
      requiresApproval: true,
      actionProposalId: 'prop_abc123',
      payloadHash: 'a'.repeat(64),
      riskLevel: 'L3_COMMUNICATION_EXTERNAL',
      reason: 'Outbound communication requires human operator approval',
    });
    expect(intercepted.success).toBe(true);

    const allowed = ApprovalInterceptionResultSchema.safeParse({
      requiresApproval: false,
    });
    expect(allowed.success).toBe(true);
  });

  it('throws ExecutionError with structured taxonomy', () => {
    const err = new ExecutionError({
      code: 'VERIFICATION_FAILED',
      message: 'Post-condition failed: contact was not activated',
      runId: 'run_123',
      stepId: 'step_1',
      organizationId: 'org_acme',
    });
    expect(err.code).toBe('VERIFICATION_FAILED');
    expect(EXECUTION_ERROR_CODES).toContain('VERIFICATION_FAILED');
    expect(EXECUTION_ERROR_CODES).toContain('APPROVAL_REQUIRED');
    expect(EXECUTION_ERROR_CODES).toContain('PAYLOAD_TAMPERED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/runtime/execution-contracts.test.ts`
Expected: FAIL with module `@/platform/runtime/execution/execution-types` not found.

- [ ] **Step 3: Implement execution contracts & schemas**

Augment `src/platform/runtime/agent-run-types.ts` with `'APPROVAL_REQUIRED'`, `'APPROVAL_REJECTED'`, `'PAYLOAD_TAMPERED'` in `AGENT_RUNTIME_ERROR_CODES`.

Create `src/platform/runtime/execution/execution-types.ts`:
- Define `EXECUTION_ERROR_CODES`: `['SCHEMA_VALIDATION_FAILED', 'VERIFICATION_FAILED', 'APPROVAL_REQUIRED', 'APPROVAL_REJECTED', 'PAYLOAD_TAMPERED', 'TOOL_EXECUTION_FAILED', 'UNTRUSTED_OUTPUT_DETECTED', 'EXECUTION_TIMEOUT', 'DEAD_MAN_PAUSED', 'INVALID_EXECUTION_STATE']`.
- Define `ExecutionError` and `ExecutionErrorDetails`.
- Define `StepValidationResultSchema` and `StepValidationResult`.
- Define `StepVerificationResultSchema` and `StepVerificationResult`.
- Define `ApprovalInterceptionResultSchema` and `ApprovalInterceptionResult`.
- Define `ExecutionLoopOptionsSchema` and `ExecutionLoopOptions`.
- Define `AgentExecutionOutcomeSchema` and `AgentExecutionOutcome`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/execution-contracts.test.ts`
Expected: PASS (4/4 tests).

---

### Task 2: Step Output Validator & Untrusted Containerization (`step-validator.ts`)

**Files:**
- Create: `src/platform/runtime/execution/step-validator.ts`
- Test: `src/platform/__tests__/runtime/step-validator.test.ts`

- [ ] **Step 1: Write the failing unit tests for `StepValidator`**

Test requirements:
1. Validates output against Zod schema parser (`capability.outputSchema.safeParse`).
2. Sanitizes internal error stacks/messages into clean structured errors (`sanitizedError`) avoiding database/network stack leakage (Rule 48).
3. Wraps all external tool outputs and error messages in `<untrusted_reference_data id="step_output_${stepId}">` containers (Rules 13 & 30).
4. Rejects recursive prompt injection tokens embedded inside tool results (e.g. `Ignore previous instructions and do X`).
5. Estimates token cost of validated output.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/runtime/step-validator.test.ts`
Expected: FAIL with `StepValidator` not found.

- [ ] **Step 3: Implement `StepValidator`**

Create `src/platform/runtime/execution/step-validator.ts`:
- Class `StepValidator` with static methods:
  - `validateOutput(params: { stepId: string; capabilityId: string; outputSchema?: SchemaParser<unknown> | z.ZodType<unknown>; rawOutput: unknown }): StepValidationResult`
  - `sanitizeError(err: unknown, stepId: string): SanitizedStepError`
  - `containerizeOutput(stepId: string, content: string | Record<string, unknown>): string`
- Strict non-backtracking scanning for adversarial override directives (`scanForAdversarialDirectives`) to prevent tool output jailbreaking.
- Full typing, zero `any`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/step-validator.test.ts`
Expected: PASS.

---

### Task 3: Post-Condition Verification Engine (`step-verifier.ts`)

**Files:**
- Create: `src/platform/runtime/execution/step-verifier.ts`
- Test: `src/platform/__tests__/runtime/step-verifier.test.ts`

- [ ] **Step 1: Write the failing unit tests for `StepVerifier`**

Test requirements:
1. Step 9 Verification Gate: checks whether `planStep.expectedStateChange` was fulfilled.
2. Supports declarative state assertion predicates (e.g. `entity_exists`, `field_equals`, `status_in`, `record_count_changed`).
3. Evaluates custom verification handlers registered on capabilities (e.g. querying entity version or ETag to detect TOCTOU).
4. Emits `VERIFICATION_FAILED` when technical execution succeeded but state assertion failed (e.g. status did not change).
5. Generates structured diagnostic payload for `AgentReplanner` with `observedState`, `expectedState`, and `suggestedRemediation`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/runtime/step-verifier.test.ts`
Expected: FAIL with `StepVerifier` not found.

- [ ] **Step 3: Implement `StepVerifier`**

Create `src/platform/runtime/execution/step-verifier.ts`:
- Class `StepVerifier` with methods:
  - `verifyStep(params: { step: AgentStep; planStep: PlanStep; executionResult: unknown; context: CapabilityExecutionContext }): Promise<StepVerificationResult>`
  - Evaluates built-in assertion matchers based on `expectedStateChange`.
  - Integrates with capability verification hooks where available.
  - Fail-closed error handling mapping to `ExecutionError('VERIFICATION_FAILED')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/step-verifier.test.ts`
Expected: PASS.

---

### Task 4: Two-Phase Approval Interceptor & Hash Binding (`approval-interceptor.ts`)

**Files:**
- Create: `src/platform/runtime/execution/approval-interceptor.ts`
- Test: `src/platform/__tests__/runtime/approval-interceptor.test.ts`

- [ ] **Step 1: Write the failing unit tests for `ApprovalInterceptor`**

Test requirements:
1. Intercepts L3 (`L3_COMMUNICATION_EXTERNAL`) and L4 (`L4_PRIVILEGED_DESTRUCTIVE`) actions, or capabilities marked `isNonDelegable` (Rules 17 & 21).
2. Generates deterministic SHA-256 `payloadHash` of execution arguments with canonical key sorting (Rule 22).
3. Creates `ActionProposal` with WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE (Rule 41) in `capability_approvals`.
4. Transitions run to `waiting_for_approval` and pauses execution loop.
5. Emits `agent.run.approval_required` domain event via `EventBus` (Rule 40).
6. Resumes upon approval: validates proposal is `status: 'approved'` and `payloadHash` matches exact current step payload.
7. Rejects execution if payload was tampered with between approval and execution (`PAYLOAD_TAMPERED`).
8. If rejected, triggers `SagaCompensationEngine.rollbackRun` if prior mutating steps were completed (Rule 27).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/runtime/approval-interceptor.test.ts`
Expected: FAIL with `ApprovalInterceptor` not found.

- [ ] **Step 3: Implement `ApprovalInterceptor`**

Create `src/platform/runtime/execution/approval-interceptor.ts`:
- Define `ApprovalStore` interface with in-memory implementation (`createMemoryApprovalStore`) and Firestore adapter (`createFirestoreApprovalStore`).
- Class `ApprovalInterceptor`:
  - `evaluateStepApproval(params: { run: AgentRun; step: PlanStep; persona: AgentPersona; authorizingUserId: string }): Promise<ApprovalInterceptionResult>`
  - `verifyApprovalBinding(params: { proposalId: string; organizationId: string; currentPayload: Record<string, unknown> }): Promise<void>`
  - `handleApprovalRejection(params: { run: AgentRun; proposalId: string; reason?: string }): Promise<void>`
  - Deterministic `computePayloadHash` using canonical JSON stringification and SHA-256.
  - Emergency dead-man switch evaluation (Rule 60).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/approval-interceptor.test.ts`
Expected: PASS.

---

### Task 5: End-to-End Autonomous Execution Loop Orchestrator (`agent-execution-loop.ts`)

**Files:**
- Create: `src/platform/runtime/execution/agent-execution-loop.ts`
- Create: `src/platform/runtime/execution/index.ts`
- Modify: `src/platform/runtime/index.ts`
- Test: `src/platform/__tests__/runtime/agent-execution-loop.test.ts`

- [ ] **Step 1: Write the comprehensive integration tests for `AgentExecutionLoop`**

Test scenarios:
1. **Happy Path:** Multi-step autonomous execution from Goal -> Plan -> Authorize -> Execute -> Verify -> Complete.
2. **Step Failure & Dynamic Replanning:** Injected tool failure triggers `AgentReplanner`, synthesizes remedial steps, and completes successfully without exceeding replan ceiling (Rule 23).
3. **Two-Phase Approval Interception:** L3 tool pauses run in `'waiting_for_approval'`; approving resumes and executes; parameter tampering throws `PAYLOAD_TAMPERED`.
4. **Rejection & Saga Rollback:** Operator rejection triggers `SagaCompensationEngine.rollbackRun` in reverse LIFO order.
5. **Budget Ceiling Breach:** Step exceeding remaining token or tool call ceiling fails closed with `BUDGET_EXCEEDED`.
6. **Cooperative Cancellation:** Triggering `cancellationEngine.cancelRun()` aborts in-flight execution and marks run `'cancelled'`.
7. **Dead-Man Switch:** Active dead-man switch immediately halts loop with `EMERGENCY_DEAD_MAN_PAUSED`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/runtime/agent-execution-loop.test.ts`
Expected: FAIL with `AgentExecutionLoop` not found.

- [ ] **Step 3: Implement `AgentExecutionLoop`**

Create `src/platform/runtime/execution/agent-execution-loop.ts`:
- Class `AgentExecutionLoop`:
  - `executeRun(params: { organizationId: string; runId: string; options?: ExecutionLoopOptions }): Promise<AgentExecutionOutcome>`
  - Orchestrates:
    1. Dead-man switch check (Rule 60).
    2. Cancellation token registration (`CancellationEngine`).
    3. Plan acquisition (or calls `AgentPlanner`).
    4. Topological step iteration (Kahn's DAG).
    5. Budget reservation (`AgentBudgetManager.checkOrThrow`).
    6. Tool fingerprint verification (`globalToolFingerprintService`).
    7. Two-phase approval evaluation (`ApprovalInterceptor`).
    8. Execution via capability handler / `GenkitToolAdapter`.
    9. Output validation (`StepValidator.validateOutput`).
    10. Post-condition verification (`StepVerifier.verifyStep`).
    11. Budget usage recording (`AgentBudgetManager.recordUsage`).
    12. Failure replanning (`AgentReplanner`) or saga rollback (`SagaCompensationEngine`).
    13. Context compression (`AgentContextCompressor.compress`).
    14. Outcome synthesis and run completion (`agent.run.completed`).
- Barrels:
  - Create `src/platform/runtime/execution/index.ts`.
  - Update `src/platform/runtime/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/agent-execution-loop.test.ts`
Expected: PASS.

---

### Task 6: Verification Gates, Static Analysis & Strangler Regression

**Files:**
- Test all runtime suites: `pnpm vitest run src/platform/__tests__/runtime/`
- Test baseline regression suite: `pnpm vitest run src/platform/__tests__/baseline/`
- Typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
- Lint: `pnpm lint`

- [ ] **Step 1: Run all 17 runtime test suites**
Run: `pnpm vitest run src/platform/__tests__/runtime/`
Expected: 17/17 suites passing, 100% green.

- [ ] **Step 2: Run baseline regression suite (Rule 69)**
Run: `pnpm vitest run src/platform/__tests__/baseline/`
Expected: 6/6 suites passing (43/43 tests).

- [ ] **Step 3: Run TypeScript typecheck**
Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 4: Run ESLint**
Run: `pnpm lint`
Expected: 0 errors, warnings $\le 670$.
