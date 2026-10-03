# Phase 6 Milestone 4: Step Verification, Human-in-the-Loop Proposal Interception & Two-Phase Approval Completion Report

**Date:** October 3, 2026  
**Status:** COMPLETE  
**Milestone:** Phase 6, Milestone 4  
**Author:** AI Agentic Architecture Team & Antigravity  

---

## Executive Summary

Phase 6 Milestone 4 implements the mission-critical core of the SmartSapp Agentic Runtime: **Step Output Validation, Post-Condition State Verification, Human-in-the-Loop Action Proposal Interception, Two-Phase Cryptographic Approval Binding, and the End-to-End Autonomous Agent Execution Loop Orchestrator**.

This subsystem operationalizes the **7-Stage Execution Pipeline** (`MODEL -> PROPOSAL -> VALIDATOR -> POLICY -> PERMISSION -> EXECUTOR -> VERIFIER`) mandated by Rule 47 ("Never Trust the Model") and Rule 48 ("Never Trust the Tool Either"). Every autonomous step executed by an agent is subjected to pre-reservation resource budgeting, dead-man kill switch gates, XML containerization preventing prompt injection, cryptographic approval checks, output schema validation, post-condition assertions, and reverse-LIFO Saga compensation rollbacks on unrecoverable failure.

---

## Delivered Architecture & Artifacts

### 1. Unified Execution Contracts (`src/platform/runtime/execution/execution-types.ts`)
- **Zod v4 Schemas:**
  - `StepValidationResultSchema`: Validated structured output, sanitized error masking, XML isolation container, and token consumption metrics.
  - `StepVerificationResultSchema`: Post-condition state assertion boolean, observed state, expected state, and structured suggested remediation for autonomous replanning.
  - `ApprovalInterceptionResultSchema`: Two-phase approval requirement gate, proposal ID, canonical SHA-256 payload hash, risk level, non-delegable flag, and interception rationale.
  - `ExecutionLoopOptionsSchema`: Execution settings including `dryRun`, `maxReplans`, `verifyPostConditions`, `autoTriggerSagaRollbackOnFailure`, and distributed tracing IDs (`correlationId`, `traceId`).
  - `AgentExecutionOutcomeSchema`: Comprehensive outcome reporting terminal state, completed/failed step counts, proposal references, durations, and token usage.
- **Error Taxonomy (`EXECUTION_ERROR_CODES` & `ExecutionError`):**
  - Includes `SCHEMA_VALIDATION_FAILED`, `VERIFICATION_FAILED`, `APPROVAL_REQUIRED`, `APPROVAL_REJECTED`, `PAYLOAD_TAMPERED`, `TOOL_EXECUTION_FAILED`, `UNTRUSTED_OUTPUT_DETECTED`, `EXECUTION_TIMEOUT`, `DEAD_MAN_PAUSED`, `INVALID_EXECUTION_STATE`, `CAPABILITY_NOT_FOUND`, and `TOCTOU_CONFLICT`.
- **Zero `any` / Zero `any[]` typing policy (Rule 4).**

### 2. Output Validator & Containerizer (`src/platform/runtime/execution/step-validator.ts`)
- **Schema Validation:** Evaluates tool outputs against the capability's Zod output schema via `safeParse`.
- **Prompt Injection Defense:** Scans outputs for adversarial directive patterns (`ADVERSARIAL_DIRECTIVE_PATTERNS`: `system instructions`, `ignore previous instructions`, `bypass authorization`, etc.).
- **XML Reference Containerization (Rules 13 & 30):** Encases all raw and parsed tool output inside `<untrusted_reference_data id="step_output_${stepId}">` before returning to LLM context, guaranteeing prompt injection containment.
- **Error Sanitization (Rule 48):** Strips sensitive tokens (GCP service account keys, JWTs, Clerk secret keys, database credentials, stack traces) using `SENSITIVE_ERROR_PATTERNS`.

### 3. Post-Condition State Verifier (`src/platform/runtime/execution/step-verifier.ts`)
- **Step 9 of Agentic Lifecycle (Rule 47):** Verifies that the real-world state of entities actually transitioned as intended (e.g. database status updated, record persisted) rather than blindly trusting the model's claim of success.
- **TOCTOU Concurrency Conflict Detection (Rule 18):** Cross-checks entity versions and throws `TOCTOU_CONFLICT` if state changed unexpectedly under concurrent access.
- **Diagnostics Generation:** Emits structured `suggestedRemediation` diagnostics ingested by `AgentReplanner` to dynamically construct repair DAG branches without infinite retry oscillation.

### 4. Two-Phase Approval Interceptor (`src/platform/runtime/execution/approval-interceptor.ts`)
- **Approval Store Architecture:**
  - `ApprovalStore` interface contract.
  - `createMemoryApprovalStore` implementation for hermetic isolated test suites.
  - `createFirestoreApprovalStore` production implementation persisting to `capability_approvals` collection.
- **Interception Logic:**
  - Evaluates non-delegable operations (Rule 17), high-risk operations (L3/L4, Rule 21), and operations exceeding the persona's autonomous risk ceiling (`exceedsAutonomousCeiling`).
  - Generates `ActionProposal` with WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE (Rule 41).
  - Deterministically calculates canonical key-sorted SHA-256 `payloadHash` (Rule 22).
  - Advances state machine legally (`created -> planning -> executing -> waiting_for_approval`) and records `approvalPausedStepId` on the run.
  - Emits `agent.run.approval_required` domain event via `defaultEventBus` for Operator UI reactivity.
- **Approval Resumption & Cryptographic Tamper Verification:**
  - Detects pre-existing proposals on step resumption; bypasses re-prompting if operator already approved.
  - Verifies exact canonical SHA-256 payload hash binding (`verifyApprovalBinding`) and throws `PAYLOAD_TAMPERED` if arguments were modified post-approval.

### 5. Autonomous Agent Execution Loop (`src/platform/runtime/execution/agent-execution-loop.ts`)
- **The Complete 7-Stage Pipeline:**
  1. `Dead-Man Gate`: Re-evaluates `checkGovernanceDeadManSwitch` before every step, throwing `AgentGovernanceEmergencyPausedError` on trip (Rule 60).
  2. `Context Compression`: Invokes `AgentContextCompressor.compressContext` using knapsack token packing and sensitive data redaction (Rules 28 & 56).
  3. `Cancellation Check`: Cooperative cancellation monitoring via native `AbortSignal` through `CancellationEngine` (Rule 26).
  4. `Budget Reservation`: Enforces multi-dimensional limits prior to tool execution via `AgentBudgetManager.checkOrThrow` (Rules 23 & 54).
  5. `Two-Phase Approval Interception`: Intercepts L3/L4/non-delegable operations, persists proposals, sets step to `pending`, and pauses execution in `waiting_for_approval` (Rules 21 & 22).
  6. `Capability Dispatch`: In-process capability execution with type-safe `CapabilityExecutionContext` (`principal`, `correlationId`, `idempotencyKey`).
  7. `Validation & Verification`: Schema validation (`StepValidator.validateOutput`), XML isolation wrapping, and post-condition assertions (`StepVerifier.verifyStep`).
- **Failure Recovery & Sagas:**
  - On unrecoverable failure: triggers reverse-LIFO Saga compensation rollback via `SagaCompensationEngine.rollbackRun` (Rule 27).
  - Updates run and step statuses with sanitized error records (Rule 48).
  - Emits real-time domain events (`agent.run.step_completed`, `agent.run.completed`, `agent.run.compensated`).

---

## Verification & Quality Gates

| Verification Gate | Command | Result |
| :--- | :--- | :--- |
| **Milestone 4 Test Suites** | `pnpm vitest run src/platform/__tests__/runtime/execution* src/platform/__tests__/runtime/step* src/platform/__tests__/runtime/approval* src/platform/__tests__/runtime/agent-execution*` | **24 / 24 PASSED** (100%) |
| **Total Runtime Test Suites** | `pnpm vitest run src/platform/__tests__/runtime/` | **18 files / 117 tests PASSED** (100%) |
| **Baseline Regression Suites (Rule 69)** | `pnpm vitest run src/platform/__tests__/baseline/` | **6 files / 43 tests PASSED** (100%) |
| **TypeScript Static Typecheck** | `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` | **0 errors (Exit code 0)** |
| **ESLint Static Analysis** | `pnpm lint` | **0 errors (Exit code 0)** |

---

## Rule Compliance Matrix (Milestone 4)

- **Rule 4 (Zero `any`):** Strictly zero `any` or `any[]` across all runtime execution code and tests.
- **Rule 8 & 47 (Multi-Tenancy & Anti-IDOR):** Explicit `organizationId` and `workspaceId` enforcement on all stores and step executions.
- **Rule 13 & 30 (Untrusted Tool Isolation):** All tool outputs containerized inside `<untrusted_reference_data id="step_output_${stepId}">`.
- **Rule 17 & 21 (Non-Delegable & Two-Phase Approval):** Mandatory approval interception on L3/L4/non-delegable actions.
- **Rule 22 (Cryptographic Approval Binding):** Deterministic SHA-256 `payloadHash` calculated with key-sorting and verified before execution.
- **Rule 23 & 54 (Resource Governance):** Step-level budget reservation before dispatch; accumulation of token and mutation deltas.
- **Rule 26 (Cooperative Cancellation):** Native `AbortSignal` wired to cancellation token sources; aborts in-flight execution.
- **Rule 27 (Saga Compensation):** Reverse-LIFO execution of compensating capabilities on unrecoverable failure.
- **Rule 28 & 56 (Knapsack Context Compression):** Prompt context constrained strictly $\le$ 4,000 tokens with linear secret redaction.
- **Rule 31 (Output Schema Validation):** Tool execution output validated against Zod contracts before propagation.
- **Rule 40 (Audit Logging & Domain Events):** Events emitted for approval pauses, step completion, run completion, and compensation.
- **Rule 41 (Decision Provenance):** Proposals carry structured WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE.
- **Rule 42 (Shadow Mode):** Dry-run mode supported across execution loop and stores.
- **Rule 47 (Never Trust the Model):** Post-condition state assertions verify real-world entity mutation.
- **Rule 48 (Never Trust the Tool Either):** Sanitized error taxonomy masks internal secrets and credentials.
- **Rule 60 (Governance Dead-Man Switch):** Evaluated before every step execution and proposal evaluation.
- **Rule 68 (Five Non-Negotiable Invariants):** Preserved throughout runtime architecture.
- **Rule 69 (Strangler Invariant):** 43/43 baseline regression tests passing with zero behavioral divergence.

---

## Next Steps

Milestone 4 is complete, verified, and ready for formal review by the Senior Principal Systems & AI Agentic Architecture Reviewer. Upon approval, proceed to **Phase 6 Milestone 5: Swarm Workflows, Multi-Agent Handoffs & Dynamic Topology Routing**.
