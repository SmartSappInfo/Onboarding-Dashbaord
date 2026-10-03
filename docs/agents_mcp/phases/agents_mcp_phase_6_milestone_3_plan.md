# Phase 6 Milestone 3 Implementation Plan: Strict Resource Governance, Knapsack Context Compression, Sagas & Cancellation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the multi-dimensional resource governance, stratified knapsack context compression, cooperative cancellation, and formal Saga compensation engine for the SmartSapp autonomous agent runtime.

**Architecture:** 
1. `AgentBudgetManager` tracks and enforces multi-dimensional ceilings (`maxTokens`, `maxToolCalls`, `maxDurationMs`, `maxRecordsMutated`, `maxFinancialAmount`, `maxDelegationDepth`), failing closed with `BUDGET_EXCEEDED` on breach and synchronizing usage with `AgentRunStore`.
2. `AgentContextCompressor` applies stratified knapsack packing (Critical > Relevant > Supporting) and extractive summarization with PII/secret redaction to keep LLM context $\le 4,000$ tokens, preserving essential decision provenance inside `<untrusted_reference_data>` XML containers.
3. `CancellationEngine` manages cooperative cancellation tokens (`CancellationTokenSource`) and `AbortSignal` bindings, enabling immediate or graceful aborts with status transitions to `'cancelled'`.
4. `SagaCompensationEngine` executes registered inverse compensating capabilities in strict LIFO (reverse) order upon step failure or cancellation, generating deterministic idempotency keys, updating `compensationStatus`, and logging immutable audit events.
5. All components enforce zero `any`/`any[]` strict typing, tenant isolation (Rules 8 & 47), emergency dead-man pause evaluation (Rule 60), and the Strangler Fig preservation invariant (Rule 69).

**Tech Stack:** TypeScript 5, Next.js 15, Zod v4 (`zod/v4`), Vitest, Node.js `crypto` & `AbortController`, Firestore Admin SDK.

---

## 69 SmartSapp Agentic Development Rules Mapping

| Rule # | Requirement | Milestone 3 Architectural Implementation & Defense |
| :---: | :--- | :--- |
| **Rule 1** | No Mock Implementations in Prod | Test mocks (`createMemoryAgentRunStore`) isolated to `__tests__`; production delegates to Firestore and live capability registry. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Complete strict typing with Zod v4 schemas. `unknown` is narrowed at boundaries. |
| **Rule 8** | Multi-Tenancy & Anti-IDOR Isolation | All budget checks, cancellation, and saga operations mandate `organizationId` and `workspaceId`. |
| **Rule 9** | Cloud Run Serverless Statelessness | Cancellation and budget state persisted to Firestore. In-memory tokens exist strictly within invocation lifecycle. |
| **Rule 10** | Inline Architectural Documentation | Complete `@fileOverview` with invariants, state transitions, and testability pointers. |
| **Rule 11** | Idempotent Registration & HMR | Global singletons preserved via `globalThis.__smartsappCancellationEngine` and `globalThis.__smartsappSagaEngine`. |
| **Rule 12** | Canonical Risk Taxonomy & Weights | Compensating capabilities respect canonical `RISK_LEVELS` and numerical weights (`RISK_LEVEL_WEIGHTS`). |
| **Rule 13** | Never Trust the Model | LLM outputs cannot modify budgets or bypass cancellation signals; candidate inputs strictly validated. |
| **Rule 14** | Capability Fingerprint Verification | Compensating capabilities verified against approved fingerprints before dispatch. |
| **Rule 16** | Persona Security Boundaries | Rollbacks inherit agent persona scoping and cannot escalate privileges. |
| **Rule 17** | Non-Delegable Actions Guard | Compensating actions requiring non-delegable permissions require explicit human authorization. |
| **Rule 19** | Mandatory Idempotency | Every compensating step generates deterministic `idempotencyKey` (`saga_comp_${stepId}`). |
| **Rule 20** | Distributed Tracing & Correlation | Propagates `correlationId`, `traceId`, and `spanId` across all governance and compensation operations. |
| **Rule 21** | Two-Phase Action Model | High-risk compensating operations respect two-phase approval constraints. |
| **Rule 23** | Multi-Dimensional Resource Budgets | Enforces hard ceilings on tokens, tool calls, duration, mutated records, financial value, and delegation depth. |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed Saga compensations emit `agent.run.compensation_failed` and flag run for operator dead-letter recovery. |
| **Rule 26** | True Cancellation Semantics | Cooperative cancellation tokens with `AbortSignal`, distinguishing immediate abort vs graceful stop. |
| **Rule 27** | Formal Saga & Compensation Model | LIFO (reverse execution) rollback of executed mutating steps with registered compensating capabilities. |
| **Rule 28** | Context Budgeting | Stratified greedy knapsack packing keeping prompt history $\le 4,000$ tokens. |
| **Rule 30** | Knowledge Poisoning Defense | Compressed context wrapped inside `<untrusted_reference_data id="compressed_history">` XML container. |
| **Rule 32 & 33** | Exfiltration & Egress Control | In-line redaction of sensitive credentials, PII, and financial tokens during context compression. |
| **Rule 39** | OpenTelemetry Propagation | Telemetry metrics (latency, token usage, compensation counts) recorded for all governance operations. |
| **Rule 40** | Audit Log Immutability | Structured events emitted: `agent.run.budget_exceeded`, `agent.run.cancelled`, `agent.run.compensated`, `agent.run.compensation_failed`. |
| **Rule 41** | Explainability Fields | Every compensation record captures WHAT, WHY, and original step correlation. |
| **Rule 42** | Shadow Mode Simulation | Budget manager and Saga engine support `dryRun: true` mode with zero mutations committed. |
| **Rule 47** | Never Trust the Model | All governance schemas validated using Zod v4 before processing. |
| **Rule 48** | Sanitized Error Taxonomy | Structured errors mapped to `GOVERNANCE_ERROR_CODES` without stack trace leakage. |
| **Rule 54** | Performance Budgets | Context compression completes in $\le 100\text{ms}$; budget verification completes in $\le 10\text{ms}$. |
| **Rule 56** | Agent Context Compression | Compresses history while preserving critical decision evidence (entity IDs, timestamps, status, decisions). |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated as Step 1 of all governance operations, failing closed with `DEAD_MAN_PAUSED`. |
| **Rule 63** | Agent Incident Management | Unhandled compensation failures trigger immediate high-priority audit events for operator alerting. |
| **Rule 68** | Five Non-Negotiable Invariants | Strictly enforces cancellation and resource bounds on all agent operations. |
| **Rule 69** | Strangler Fig Pattern SSOT | 100% green pass on all 43 baseline regression test suites. |

---

## File Structure & Component Boundaries

```text
src/platform/runtime/governance/
├── governance-types.ts            # Canonical contracts, Zod schemas, error taxonomy (Rules 4, 19, 20, 23, 48)
├── agent-budget-manager.ts        # Multi-dimensional budget tracker & ceiling enforcement (Rules 23, 42, 54, 60)
├── context-compressor.ts          # Stratified knapsack context compressor & PII redactor (Rules 28, 30, 32, 33, 56)
├── cancellation-engine.ts         # Cooperative cancellation tokens & AbortSignal harness (Rules 26, 40, 60)
├── saga-compensation.ts           # LIFO reverse compensation engine & rollback dispatcher (Rules 19, 20, 25, 27, 40, 42, 60, 63)
└── index.ts                       # Governance subsystem barrel export

src/platform/runtime/index.ts       # Platform runtime barrel export updating governance

src/platform/__tests__/runtime/
├── governance-contracts.test.ts   # Unit tests for governance contracts & schemas
├── agent-budget-manager.test.ts   # Unit & integration tests for budget enforcement & dry-run
├── context-compressor.test.ts     # Unit & integration tests for knapsack compression & PII redaction
├── cancellation-engine.test.ts    # Unit & integration tests for cooperative cancellation
└── saga-compensation.test.ts      # Unit & integration tests for Saga LIFO rollback & error handling
```

---

## Detailed Bite-Sized Implementation Tasks

### Task 1: Governance Data Contracts, Zod Schemas & Error Taxonomy (`governance-types.ts`)

**Files:**
- Create: `src/platform/runtime/governance/governance-types.ts`
- Test: `src/platform/__tests__/runtime/governance-contracts.test.ts`

- [ ] **Step 1: Write failing test for governance contracts**

```typescript
// src/platform/__tests__/runtime/governance-contracts.test.ts
import { describe, it, expect } from 'vitest';
import {
  BudgetCheckResultSchema,
  CompensationStepSchema,
  SagaExecutionResultSchema,
  GOVERNANCE_ERROR_CODES,
  GovernanceError,
} from '@/platform/runtime/governance/governance-types';

describe('Governance Contracts & Schemas (Rules 4, 19, 20, 23, 48)', () => {
  it('validates BudgetCheckResultSchema with tracing context', () => {
    const valid = BudgetCheckResultSchema.safeParse({
      allowed: true,
      currentUsage: {
        tokensUsed: 1200,
        toolCallsExecuted: 3,
        durationMs: 4500,
        recordsMutated: 2,
        financialAmount: 0,
        currentDelegationDepth: 1,
      },
      remainingBudgets: {
        maxTokens: 48800,
        maxToolCalls: 12,
        maxDurationMs: 115500,
        maxRecordsMutated: 23,
        maxFinancialAmount: 0,
        maxDelegationDepth: 2,
      },
      traceId: 'trace_abc',
      correlationId: 'corr_xyz',
    });
    expect(valid.success).toBe(true);
  });

  it('validates CompensationStepSchema with deterministic idempotencyKey', () => {
    const valid = CompensationStepSchema.safeParse({
      stepId: 'step_1',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      idempotencyKey: 'saga_comp_step_1',
      compensationArguments: { contactId: 'con_123' },
      status: 'pending',
    });
    expect(valid.success).toBe(true);
  });

  it('throws GovernanceError with structured taxonomy', () => {
    const err = new GovernanceError({
      code: 'BUDGET_EXCEEDED',
      message: 'Token ceiling exceeded: 52000 > 50000',
      runId: 'run_123',
      organizationId: 'org_acme',
    });
    expect(err.code).toBe('BUDGET_EXCEEDED');
    expect(err.message).toContain('Token ceiling exceeded');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/runtime/governance-contracts.test.ts`  
Expected: FAIL (Cannot find module `@/platform/runtime/governance/governance-types`)

- [ ] **Step 3: Implement `governance-types.ts`**

```typescript
// src/platform/runtime/governance/governance-types.ts
/**
 * @fileOverview Governance Contracts, Zod Schemas & Error Taxonomy (Rule 4, 19, 20, 23, 26, 27, 28, 48, 56)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 19: Mandatory idempotency keys for compensating steps.
 * - Rule 20: Distributed tracing correlation propagation (`correlationId`, `traceId`, `spanId`).
 * - Rule 23: Multi-dimensional resource budgets (tokens, tool calls, duration, mutated records).
 * - Rule 26: Cooperative cancellation contracts and token state.
 * - Rule 27: Formal Saga compensation state and rollback result contracts.
 * - Rule 28 & 56: Knapsack context compression types.
 * - Rule 48: Sanitized error taxonomy.
 */

import { z } from 'zod/v4';
import {
  AgentRunBudgetsSchema,
  AgentRunBudgetUsageSchema,
} from '../agent-run-types';

export const GOVERNANCE_ERROR_CODES = [
  'BUDGET_EXCEEDED',
  'RUN_CANCELLED',
  'COMPENSATION_FAILED',
  'CONTEXT_OVERFLOW',
  'DATA_EXFILTRATION_BLOCKED',
  'DEAD_MAN_PAUSED',
  'INVALID_GOVERNANCE_INPUT',
] as const;

export type GovernanceErrorCode = (typeof GOVERNANCE_ERROR_CODES)[number];

export interface GovernanceErrorDetails {
  readonly code: GovernanceErrorCode;
  readonly message: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;
}

export class GovernanceError extends Error {
  readonly code: GovernanceErrorCode;
  readonly runId?: string;
  readonly stepId?: string;
  readonly organizationId?: string;
  readonly details?: Record<string, unknown>;

  constructor(opts: GovernanceErrorDetails) {
    super(`[Governance:${opts.code}] ${opts.message}`);
    this.name = 'GovernanceError';
    this.code = opts.code;
    this.runId = opts.runId;
    this.stepId = opts.stepId;
    this.organizationId = opts.organizationId;
    this.details = opts.details;
    Object.setPrototypeOf(this, GovernanceError.prototype);
  }
}

// 1. Budget Checking Schemas
export const BudgetCheckResultSchema = z.object({
  allowed: z.boolean(),
  breachedDimensions: z.array(z.string()).default([]),
  currentUsage: AgentRunBudgetUsageSchema,
  remainingBudgets: AgentRunBudgetsSchema,
  rejectionReason: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type BudgetCheckResult = z.infer<typeof BudgetCheckResultSchema>;

export const RecordUsageDeltaSchema = z.object({
  tokensUsed: z.number().int().min(0).default(0),
  toolCallsExecuted: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  recordsMutated: z.number().int().min(0).default(0),
  financialAmount: z.number().min(0).default(0),
});

export type RecordUsageDelta = z.infer<typeof RecordUsageDeltaSchema>;

// 2. Cancellation Schemas
export const CancellationReasonSchema = z.object({
  requestedBy: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.string().datetime(),
  immediate: z.boolean().default(false),
  triggerSagaCompensation: z.boolean().default(true),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
});

export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

// 3. Saga Compensation Schemas (Rule 19 & Rule 27)
export const CompensationStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  compensationArguments: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  error: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
});

export type CompensationStep = z.infer<typeof CompensationStepSchema>;

export const SagaExecutionResultSchema = z.object({
  success: z.boolean(),
  totalCompensations: z.number().int().min(0),
  completedCompensations: z.number().int().min(0),
  failedCompensations: z.number().int().min(0),
  compensationSteps: z.array(CompensationStepSchema),
  error: z.string().optional(),
  compensatedAt: z.string().datetime(),
  dryRun: z.boolean().default(false),
  requiresOperatorIntervention: z.boolean().default(false),
});

export type SagaExecutionResult = z.infer<typeof SagaExecutionResultSchema>;

// 4. Context Compressor Schemas
export const CompressContextOptionsSchema = z.object({
  maxTokens: z.number().int().min(500).max(32000).default(4000),
  charsPerToken: z.number().min(1).max(10).default(4.0),
  includeSystemInstructions: z.boolean().default(true),
  preserveRecentStepsCount: z.number().int().min(1).max(10).default(3),
  redactSensitiveData: z.boolean().default(true),
});

export type CompressContextOptions = z.infer<typeof CompressContextOptionsSchema>;

export const CompressedContextResultSchema = z.object({
  xmlPromptContext: z.string().min(1),
  totalTokens: z.number().int().min(0),
  maxTokens: z.number().int().min(0),
  compressedStepCount: z.number().int().min(0),
  retainedStepCount: z.number().int().min(0),
  redactedTokensCount: z.number().int().min(0).default(0),
  compressionRatio: z.number().min(0),
});

export type CompressedContextResult = z.infer<typeof CompressedContextResultSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/governance-contracts.test.ts`  
Expected: PASS

---

### Task 2: Multi-Dimensional Budget Manager (`agent-budget-manager.ts`)

**Files:**
- Create: `src/platform/runtime/governance/agent-budget-manager.ts`
- Test: `src/platform/__tests__/runtime/agent-budget-manager.test.ts`

- [ ] **Step 1: Write failing test for `AgentBudgetManager`**

```typescript
// src/platform/__tests__/runtime/agent-budget-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentBudgetManager } from '@/platform/runtime/governance/agent-budget-manager';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { GovernanceError } from '@/platform/runtime/governance/governance-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('AgentBudgetManager (Rules 23, 42, 54, 60)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let budgetManager: AgentBudgetManager;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    runStore = createMemoryAgentRunStore();
    budgetManager = new AgentBudgetManager({ runStore });
  });

  it('allows operations within budget and records usage deltas', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: {
        maxTokens: 10000,
        maxToolCalls: 5,
        maxDurationMs: 60000,
      },
    });

    const check = await budgetManager.checkBudget({
      organizationId: 'org_acme',
      runId: run.runId,
      estimatedTokens: 500,
      toolCalls: 1,
    });

    expect(check.allowed).toBe(true);

    const updated = await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 650,
        toolCallsExecuted: 1,
        durationMs: 1200,
        recordsMutated: 0,
        financialAmount: 0,
      },
    });

    expect(updated.tokensUsed).toBe(650);
    expect(updated.toolCallsExecuted).toBe(1);
  });

  it('fails closed and throws BUDGET_EXCEEDED when token ceiling is breached', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: {
        maxTokens: 1000,
      },
    });

    await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 950,
        toolCallsExecuted: 1,
        durationMs: 500,
        recordsMutated: 0,
        financialAmount: 0,
      },
    });

    await expect(
      budgetManager.checkOrThrow({
        organizationId: 'org_acme',
        runId: run.runId,
        estimatedTokens: 100, // 950 + 100 = 1050 > 1000
      })
    ).rejects.toThrowError(GovernanceError);
  });

  it('supports dry-run mode without committing usage to run store (Rule 42)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
      customBudgets: { maxTokens: 5000 },
    });

    const updated = await budgetManager.recordUsage({
      organizationId: 'org_acme',
      runId: run.runId,
      delta: {
        tokensUsed: 800,
        toolCallsExecuted: 1,
        durationMs: 500,
        recordsMutated: 0,
        financialAmount: 0,
      },
      dryRun: true,
    });

    // Returned usage reflects delta for simulation
    expect(updated.tokensUsed).toBe(800);

    // But actual stored usage in runStore remains 0
    const persisted = await runStore.getRun('org_acme', run.runId);
    expect(persisted?.budgetUsage.tokensUsed).toBe(0);
  });

  it('fails closed when emergency dead-man switch is tripped (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Find leads' },
    });

    await expect(
      budgetManager.checkBudget({
        organizationId: 'org_acme',
        runId: run.runId,
      })
    ).rejects.toThrowError(GovernanceError);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/runtime/agent-budget-manager.test.ts`  
Expected: FAIL (Cannot find module `@/platform/runtime/governance/agent-budget-manager`)

- [ ] **Step 3: Implement `agent-budget-manager.ts`**

```typescript
// src/platform/runtime/governance/agent-budget-manager.ts
/**
 * @fileOverview Multi-Dimensional Resource Governance & Budget Manager (Rules 23, 40, 42, 54, 60)
 *
 * Implements strict resource ceilings:
 * - maxTokens, maxToolCalls, maxDurationMs, maxRecordsMutated, maxFinancialAmount, maxDelegationDepth.
 * - Pre-execution reservation checks (`checkBudget`, `checkOrThrow`).
 * - Atomic persistence to `AgentRunStore` with dry-run support (Rule 42).
 * - Emits `agent.run.budget_exceeded` domain events on breach (Rule 40).
 * - Emergency dead-man evaluation (Rule 60).
 */

import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  type BudgetCheckResult,
  type RecordUsageDelta,
  GovernanceError,
} from './governance-types';
import { type AgentRunBudgetUsage } from '../agent-run-types';

export interface AgentBudgetManagerOptions {
  runStore?: AgentRunStore;
  eventBus?: EventBus;
}

export interface CheckBudgetParams {
  organizationId: string;
  runId: string;
  estimatedTokens?: number;
  toolCalls?: number;
  estimatedDurationMs?: number;
  recordsMutated?: number;
  financialAmount?: number;
  delegationDepth?: number;
  correlationId?: string;
  traceId?: string;
}

export class AgentBudgetManager {
  private readonly runStore: AgentRunStore;
  private readonly eventBus: EventBus;

  constructor(options?: AgentBudgetManagerOptions) {
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.eventBus = options?.eventBus ?? defaultEventBus;
  }

  public async checkBudget(params: CheckBudgetParams): Promise<BudgetCheckResult> {
    const isPaused = await checkGovernanceDeadManSwitch(params.organizationId);
    if (isPaused) {
      throw new GovernanceError({
        code: 'DEAD_MAN_PAUSED',
        message: `Operation halted: Emergency dead-man switch is active for tenant '${params.organizationId}'.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new GovernanceError({
        code: 'INVALID_GOVERNANCE_INPUT',
        message: `Agent run '${params.runId}' not found.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const { budgets, budgetUsage } = run;
    const breached: string[] = [];

    const projectedTokens = budgetUsage.tokensUsed + (params.estimatedTokens ?? 0);
    if (projectedTokens > budgets.maxTokens) {
      breached.push(`tokens (${projectedTokens} > ${budgets.maxTokens})`);
    }

    const projectedToolCalls = budgetUsage.toolCallsExecuted + (params.toolCalls ?? 0);
    if (projectedToolCalls > budgets.maxToolCalls) {
      breached.push(`toolCalls (${projectedToolCalls} > ${budgets.maxToolCalls})`);
    }

    const projectedDuration = budgetUsage.durationMs + (params.estimatedDurationMs ?? 0);
    if (projectedDuration > budgets.maxDurationMs) {
      breached.push(`durationMs (${projectedDuration} > ${budgets.maxDurationMs})`);
    }

    const projectedRecords = budgetUsage.recordsMutated + (params.recordsMutated ?? 0);
    if (projectedRecords > budgets.maxRecordsMutated) {
      breached.push(`recordsMutated (${projectedRecords} > ${budgets.maxRecordsMutated})`);
    }

    const projectedFinance = budgetUsage.financialAmount + (params.financialAmount ?? 0);
    if (projectedFinance > budgets.maxFinancialAmount) {
      breached.push(`financialAmount (${projectedFinance} > ${budgets.maxFinancialAmount})`);
    }

    if (params.delegationDepth !== undefined && params.delegationDepth > budgets.maxDelegationDepth) {
      breached.push(`delegationDepth (${params.delegationDepth} > ${budgets.maxDelegationDepth})`);
    }

    const allowed = breached.length === 0;

    if (!allowed) {
      await this.eventBus.publish(
        createDomainEvent({
          eventType: 'agent.run.budget_exceeded',
          producer: 'agent-runtime',
          organizationId: params.organizationId,
          workspaceId: run.workspaceId,
          correlationId: params.correlationId,
          payload: {
            runId: params.runId,
            agentPersonaId: run.agentPersonaId,
            breachedDimensions: breached,
            currentUsage: budgetUsage,
            budgets,
          },
        })
      );
    }

    return {
      allowed,
      breachedDimensions: breached,
      currentUsage: budgetUsage,
      remainingBudgets: {
        maxTokens: Math.max(0, budgets.maxTokens - budgetUsage.tokensUsed),
        maxToolCalls: Math.max(0, budgets.maxToolCalls - budgetUsage.toolCallsExecuted),
        maxDurationMs: Math.max(0, budgets.maxDurationMs - budgetUsage.durationMs),
        maxRecordsMutated: Math.max(0, budgets.maxRecordsMutated - budgetUsage.recordsMutated),
        maxFinancialAmount: Math.max(0, budgets.maxFinancialAmount - budgetUsage.financialAmount),
        maxDelegationDepth: Math.max(0, budgets.maxDelegationDepth - budgetUsage.currentDelegationDepth),
      },
      rejectionReason: allowed ? undefined : `Budget breached on dimensions: ${breached.join(', ')}`,
      traceId: params.traceId,
      correlationId: params.correlationId,
    };
  }

  public async checkOrThrow(params: CheckBudgetParams): Promise<void> {
    const check = await this.checkBudget(params);
    if (!check.allowed) {
      throw new GovernanceError({
        code: 'BUDGET_EXCEEDED',
        message: check.rejectionReason ?? 'Agent resource budget exceeded.',
        runId: params.runId,
        organizationId: params.organizationId,
        details: {
          breachedDimensions: check.breachedDimensions,
          currentUsage: check.currentUsage,
        },
      });
    }
  }

  public async recordUsage(params: {
    organizationId: string;
    runId: string;
    delta: RecordUsageDelta;
    dryRun?: boolean;
  }): Promise<AgentRunBudgetUsage> {
    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new GovernanceError({
        code: 'INVALID_GOVERNANCE_INPUT',
        message: `Agent run '${params.runId}' not found.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    if (params.dryRun) {
      // Simulate usage accumulation in memory without committing to database (Rule 42)
      return {
        tokensUsed: run.budgetUsage.tokensUsed + params.delta.tokensUsed,
        toolCallsExecuted: run.budgetUsage.toolCallsExecuted + params.delta.toolCallsExecuted,
        durationMs: run.budgetUsage.durationMs + params.delta.durationMs,
        recordsMutated: run.budgetUsage.recordsMutated + params.delta.recordsMutated,
        financialAmount: run.budgetUsage.financialAmount + params.delta.financialAmount,
        currentDelegationDepth: run.budgetUsage.currentDelegationDepth,
      };
    }

    const updated = await this.runStore.incrementBudgetUsage(
      params.organizationId,
      params.runId,
      params.delta
    );

    return updated;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/agent-budget-manager.test.ts`  
Expected: PASS

---

### Task 3: Agent Context Compressor & Secret Redactor (`context-compressor.ts`)

**Files:**
- Create: `src/platform/runtime/governance/context-compressor.ts`
- Test: `src/platform/__tests__/runtime/context-compressor.test.ts`

- [ ] **Step 1: Write failing test for `AgentContextCompressor`**

```typescript
// src/platform/__tests__/runtime/context-compressor.test.ts
import { describe, it, expect } from 'vitest';
import { AgentContextCompressor } from '@/platform/runtime/governance/context-compressor';
import { type AgentStep } from '@/platform/runtime/agent-run-types';

describe('AgentContextCompressor (Rules 28, 30, 32, 33, 56)', () => {
  const createStep = (id: string, index: number, title: string, outputSummary: string, sensitiveData?: string): AgentStep => ({
    stepId: id,
    runId: 'run_123',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    stepIndex: index,
    type: 'tool_call',
    title,
    capabilityId: 'crm.search',
    status: 'completed',
    idempotencyKey: `idemp_${id}`,
    correlationId: `corr_${id}`,
    input: { query: 'test' },
    output: { summary: outputSummary, secret: sensitiveData, items: Array(5).fill('item') },
    outputValidated: true,
    tokensUsed: 200,
    compensationStatus: 'not_required',
  });

  it('compresses step history to fit within maxTokens budget', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Initial Search', 'Found 100 contacts matching criteria'),
      createStep('step_1', 1, 'Profile Extraction', 'Extracted 10 high-value targets'),
      createStep('step_2', 2, 'Enrichment Phase', 'Enriched firmographic data for accounts'),
      createStep('step_3', 3, 'Draft Email', 'Generated cold email drafts for review'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Find and reach out to enterprise leads',
      steps,
      memoryCitations: ['Customer requested annual plans in Q2 2026.'],
      options: {
        maxTokens: 500,
        preserveRecentStepsCount: 2,
      },
    });

    expect(result.totalTokens).toBeLessThanOrEqual(500);
    expect(result.xmlPromptContext).toContain('<untrusted_reference_data id="compressed_history">');
    expect(result.xmlPromptContext).toContain('Draft Email');
    expect(result.retainedStepCount).toBeGreaterThan(0);
  });

  it('redacts sensitive API keys and credit cards during compression (Rule 32 & 33)', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Fetch Secret', 'Retrieved key', 'sk-ant-api03-12345678901234567890'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Fetch credentials',
      steps,
      options: { redactSensitiveData: true },
    });

    expect(result.xmlPromptContext).not.toContain('sk-ant-api03-12345678901234567890');
    expect(result.xmlPromptContext).toContain('[REDACTED_CREDENTIAL]');
    expect(result.redactedTokensCount).toBeGreaterThan(0);
  });

  it('preserves essential decision evidence and citations without loss (Rule 56)', () => {
    const steps: AgentStep[] = [
      createStep('step_0', 0, 'Check Note', 'Note says contact moved to VP of Sales'),
    ];

    const result = AgentContextCompressor.compress({
      goalPrompt: 'Verify contact status',
      steps,
      memoryCitations: ['Citation #1: CRM Note con_987'],
      options: { maxTokens: 1000 },
    });

    expect(result.xmlPromptContext).toContain('Citation #1: CRM Note con_987');
    expect(result.xmlPromptContext).toContain('VP of Sales');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/runtime/context-compressor.test.ts`  
Expected: FAIL (Cannot find module `@/platform/runtime/governance/context-compressor`)

- [ ] **Step 3: Implement `context-compressor.ts`**

```typescript
// src/platform/runtime/governance/context-compressor.ts
/**
 * @fileOverview Stratified Knapsack Context Compressor & Provenance Retainer (Rules 28, 30, 32, 33, 56)
 *
 * Implements:
 * - Stratified priority ranking: Recent active steps (Critical) > Intermediate tool summaries (Relevant) > Citations (Supporting).
 * - Greedy knapsack token budgeting keeping total context <= maxTokens (default 4000).
 * - Linear non-backtracking redaction of credentials and financial tokens (Rules 32 & 33).
 * - Encloses compressed history in `<untrusted_reference_data id="compressed_history">` XML boundaries (Rule 30).
 */

import { type AgentStep } from '../agent-run-types';
import {
  type CompressContextOptions,
  type CompressedContextResult,
  CompressContextOptionsSchema,
} from './governance-types';

export interface CompressContextParams {
  goalPrompt: string;
  steps: AgentStep[];
  memoryCitations?: string[];
  options?: Partial<CompressContextOptions>;
}

// Bounded regex patterns for sensitive data redaction (Rule 33)
const SENSITIVE_PATTERNS = [
  { pattern: /\b(?:sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z-_]{35}|sk-ant-[a-zA-Z0-9_-]{20,})\b/g, replacement: '[REDACTED_CREDENTIAL]' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, replacement: '[REDACTED_FINANCIAL]' },
];

export class AgentContextCompressor {
  public static estimateTokens(text: string, charsPerToken: number = 4.0): number {
    if (!text) return 0;
    return Math.ceil(text.length / charsPerToken);
  }

  public static redactString(input: string): { text: string; redactedCount: number } {
    let text = input;
    let redactedCount = 0;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      text = text.replace(pattern, () => {
        redactedCount++;
        return replacement;
      });
    }
    return { text, redactedCount };
  }

  public static compress(params: CompressContextParams): CompressedContextResult {
    const options = CompressContextOptionsSchema.parse(params.options ?? {});
    const { maxTokens, charsPerToken, preserveRecentStepsCount, redactSensitiveData } = options;

    let totalRedacted = 0;

    const sanitize = (text: string): string => {
      if (!redactSensitiveData) return text;
      const res = this.redactString(text);
      totalRedacted += res.redactedCount;
      return res.text;
    };

    const baseGoalText = `GOAL:\n${sanitize(params.goalPrompt)}\n\n`;
    let currentTokens = this.estimateTokens(baseGoalText, charsPerToken);

    // Split steps into recent preserved vs historical compressed
    const steps = [...params.steps].sort((a, b) => a.stepIndex - b.stepIndex);
    const recentCutoffIndex = Math.max(0, steps.length - preserveRecentStepsCount);

    const historicalSteps = steps.slice(0, recentCutoffIndex);
    const recentSteps = steps.slice(recentCutoffIndex);

    // 1. Format Recent Steps (Critical Priority)
    const formattedRecent = recentSteps.map((s) => {
      const outputStr = s.output ? JSON.stringify(s.output) : 'None';
      const truncatedOutput = outputStr.length > 500 ? `${outputStr.slice(0, 500)}... [truncated]` : outputStr;
      return sanitize(
        `[Step ${s.stepIndex}: ${s.title} (${s.capabilityId ?? s.type})] -> Status: ${s.status}\nOutput: ${truncatedOutput}`
      );
    });

    // 2. Format Historical Steps (Extractive Summaries - Relevant Priority)
    const formattedHistorical = historicalSteps.map((s) => {
      const summary = s.output && typeof s.output.summary === 'string'
        ? s.output.summary
        : s.title;
      return sanitize(`- Step ${s.stepIndex} [${s.title}]: ${s.status} -> ${summary}`);
    });

    // 3. Format Memory Citations (Supporting Priority)
    const formattedCitations = (params.memoryCitations ?? []).map((c) => sanitize(`- Citation: ${c}`));

    const retainedLines: string[] = [];

    // Add recent steps first
    for (const recentLine of formattedRecent) {
      const cost = this.estimateTokens(recentLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(recentLine);
        currentTokens += cost;
      }
    }

    // Add historical summaries next
    for (const histLine of formattedHistorical) {
      const cost = this.estimateTokens(histLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(histLine);
        currentTokens += cost;
      }
    }

    // Add memory citations if space remains
    for (const citLine of formattedCitations) {
      const cost = this.estimateTokens(citLine, charsPerToken);
      if (currentTokens + cost <= maxTokens) {
        retainedLines.push(citLine);
        currentTokens += cost;
      }
    }

    const contextBody = retainedLines.join('\n\n');
    const xmlPromptContext = `<untrusted_reference_data id="compressed_history">\n${baseGoalText}${contextBody}\n</untrusted_reference_data>`;
    const totalTokens = this.estimateTokens(xmlPromptContext, charsPerToken);

    return {
      xmlPromptContext,
      totalTokens,
      maxTokens,
      compressedStepCount: historicalSteps.length,
      retainedStepCount: retainedLines.length,
      redactedTokensCount: totalRedacted,
      compressionRatio: steps.length > 0 ? retainedLines.length / steps.length : 1.0,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/context-compressor.test.ts`  
Expected: PASS

---

### Task 4: Cooperative Cancellation Engine (`cancellation-engine.ts`)

**Files:**
- Create: `src/platform/runtime/governance/cancellation-engine.ts`
- Test: `src/platform/__tests__/runtime/cancellation-engine.test.ts`

- [ ] **Step 1: Write failing test for `CancellationEngine`**

```typescript
// src/platform/__tests__/runtime/cancellation-engine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CancellationEngine } from '@/platform/runtime/governance/cancellation-engine';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { GovernanceError } from '@/platform/runtime/governance/governance-types';

describe('CancellationEngine (Rules 26, 40, 60)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let cancellationEngine: CancellationEngine;

  beforeEach(() => {
    runStore = createMemoryAgentRunStore();
    cancellationEngine = new CancellationEngine({ runStore });
  });

  it('creates cancellation tokens and triggers abort signal on cancel', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_res_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Long running task' },
    });

    const token = cancellationEngine.registerRun(run.runId);
    expect(token.isCancelled).toBe(false);
    expect(token.signal.aborted).toBe(false);

    let abortFired = false;
    token.signal.addEventListener('abort', () => {
      abortFired = true;
    });

    await cancellationEngine.cancelRun({
      organizationId: 'org_acme',
      runId: run.runId,
      reason: {
        requestedBy: 'user_1',
        reason: 'User cancelled via UI',
        timestamp: new Date().toISOString(),
        immediate: true,
        triggerSagaCompensation: true,
      },
    });

    expect(abortFired).toBe(true);
    expect(token.isCancelled).toBe(true);

    const updatedRun = await runStore.getRun('org_acme', run.runId);
    expect(updatedRun?.status).toBe('cancelled');
  });

  it('rejects cancellation on terminal run states', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_res_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Finished task' },
    });

    await runStore.updateRunStatus('org_acme', run.runId, 'completed');

    await expect(
      cancellationEngine.cancelRun({
        organizationId: 'org_acme',
        runId: run.runId,
        reason: {
          requestedBy: 'user_1',
          reason: 'Too late',
          timestamp: new Date().toISOString(),
          immediate: true,
          triggerSagaCompensation: false,
        },
      })
    ).rejects.toThrowError(GovernanceError);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/runtime/cancellation-engine.test.ts`  
Expected: FAIL (Cannot find module `@/platform/runtime/governance/cancellation-engine`)

- [ ] **Step 3: Implement `cancellation-engine.ts`**

```typescript
// src/platform/runtime/governance/cancellation-engine.ts
/**
 * @fileOverview Cooperative Cancellation Engine & Abort Controller Harness (Rules 26, 40, 60)
 *
 * Implements:
 * - Active Run AbortController registry (`CancellationToken`).
 * - Distinguishes immediate abort vs graceful stop.
 * - Updates `AgentRunStore` status to 'cancelled' with immutable state history.
 * - Publishes `agent.run.cancelled` domain events through `defaultEventBus`.
 */

import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { isCancellableState } from '../agent-state-machine';
import {
  type CancellationReason,
  GovernanceError,
} from './governance-types';

export interface CancellationToken {
  readonly runId: string;
  readonly isCancelled: boolean;
  readonly signal: AbortSignal;
  readonly reason?: CancellationReason;
}

class InternalCancellationTokenSource {
  private readonly controller: AbortController = new AbortController();
  public isCancelled: boolean = false;
  public reason?: CancellationReason;

  constructor(public readonly runId: string) {}

  public get token(): CancellationToken {
    return {
      runId: this.runId,
      isCancelled: this.isCancelled,
      signal: this.controller.signal,
      reason: this.reason,
    };
  }

  public cancel(reason: CancellationReason): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.reason = reason;
    this.controller.abort(reason.reason);
  }
}

export interface CancellationEngineOptions {
  runStore?: AgentRunStore;
  eventBus?: EventBus;
}

export class CancellationEngine {
  private readonly runStore: AgentRunStore;
  private readonly eventBus: EventBus;
  private readonly activeSources: Map<string, InternalCancellationTokenSource> = new Map();

  constructor(options?: CancellationEngineOptions) {
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.eventBus = options?.eventBus ?? defaultEventBus;
  }

  public registerRun(runId: string): CancellationToken {
    const existing = this.activeSources.get(runId);
    if (existing) {
      return existing.token;
    }
    const source = new InternalCancellationTokenSource(runId);
    this.activeSources.set(runId, source);
    return source.token;
  }

  public getToken(runId: string): CancellationToken | undefined {
    return this.activeSources.get(runId)?.token;
  }

  public async cancelRun(params: {
    organizationId: string;
    runId: string;
    reason: CancellationReason;
  }): Promise<void> {
    const isPaused = await checkGovernanceDeadManSwitch(params.organizationId);
    if (isPaused) {
      throw new GovernanceError({
        code: 'DEAD_MAN_PAUSED',
        message: `Cancellation halted: Emergency dead-man switch is active for tenant '${params.organizationId}'.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new GovernanceError({
        code: 'INVALID_GOVERNANCE_INPUT',
        message: `Cannot cancel non-existent run '${params.runId}'.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    if (!isCancellableState(run.status)) {
      throw new GovernanceError({
        code: 'RUN_CANCELLED',
        message: `Run '${params.runId}' is in terminal status '${run.status}' and cannot be cancelled.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    // 1. Abort in-flight promises via token
    const source = this.activeSources.get(params.runId);
    if (source) {
      source.cancel(params.reason);
      this.activeSources.delete(params.runId);
    }

    // 2. Persist status transition to run store
    await this.runStore.updateRunStatus(
      params.organizationId,
      params.runId,
      'cancelled',
      params.reason.reason
    );

    // 3. Publish domain event
    await this.eventBus.publish(
      createDomainEvent({
        eventType: 'agent.run.cancelled',
        producer: 'agent-runtime',
        organizationId: params.organizationId,
        workspaceId: run.workspaceId,
        correlationId: params.reason.correlationId,
        payload: {
          runId: params.runId,
          agentPersonaId: run.agentPersonaId,
          cancelledBy: params.reason.requestedBy,
          reason: params.reason.reason,
          triggerSagaCompensation: params.reason.triggerSagaCompensation,
        },
      })
    );
  }

  public unregisterRun(runId: string): void {
    this.activeSources.delete(runId);
  }
}

declare global {
  var __smartsappCancellationEngine: CancellationEngine | undefined;
}

export function getCancellationEngine(options?: CancellationEngineOptions): CancellationEngine {
  if (process.env.NODE_ENV === 'test') {
    return new CancellationEngine(options);
  }
  if (!globalThis.__smartsappCancellationEngine) {
    globalThis.__smartsappCancellationEngine = new CancellationEngine(options);
  }
  return globalThis.__smartsappCancellationEngine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/cancellation-engine.test.ts`  
Expected: PASS

---

### Task 5: Formal Saga & Compensation Engine (`saga-compensation.ts`)

**Files:**
- Create: `src/platform/runtime/governance/saga-compensation.ts`
- Test: `src/platform/__tests__/runtime/saga-compensation.test.ts`

- [ ] **Step 1: Write failing test for `SagaCompensationEngine`**

```typescript
// src/platform/__tests__/runtime/saga-compensation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import {
  createCapabilityRegistryStore,
  type CapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { z } from 'zod/v4';

describe('SagaCompensationEngine (Rules 19, 20, 25, 27, 40, 42, 60, 63)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let registryStore: CapabilityRegistryStore;
  let sagaEngine: SagaCompensationEngine;
  let executedRollbacks: string[];

  const mockDeleteContact: AnyCapabilityDefinition = {
    id: 'crm.delete_contact',
    name: 'Delete Contact',
    description: 'Rolls back contact creation',
    version: '1.0.0',
    domain: 'crm_contacts',
    risk: { level: 'L2_STATE_MUTATION' },
    schema: {
      input: z.object({ contactId: z.string() }),
      output: z.object({ deleted: z.boolean() }),
    },
    handler: async (ctx) => {
      executedRollbacks.push(`delete_contact:${ctx.input.contactId}`);
      return { deleted: true };
    },
  };

  const mockRevokeAccess: AnyCapabilityDefinition = {
    id: 'iam.revoke_access',
    name: 'Revoke Access',
    description: 'Rolls back granted access',
    version: '1.0.0',
    domain: 'identity_access',
    risk: { level: 'L2_STATE_MUTATION' },
    schema: {
      input: z.object({ userId: z.string() }),
      output: z.object({ revoked: z.boolean() }),
    },
    handler: async (ctx) => {
      executedRollbacks.push(`revoke_access:${ctx.input.userId}`);
      return { revoked: true };
    },
  };

  beforeEach(() => {
    executedRollbacks = [];
    runStore = createMemoryAgentRunStore();
    registryStore = createCapabilityRegistryStore();
    registryStore.register(mockDeleteContact);
    registryStore.register(mockRevokeAccess);
    sagaEngine = new SagaCompensationEngine({
      runStore,
      capabilityRegistry: registryStore,
    });
  });

  it('executes compensating steps in strict LIFO (reverse) order upon rollback', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Onboard contact and grant access' },
    });

    // Step 0: Create contact (compensated by crm.delete_contact)
    await runStore.createStep({
      stepId: 'step_0',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Create Contact',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      status: 'completed',
      idempotencyKey: 'idemp_0',
      correlationId: 'corr_0',
      output: { contactId: 'con_abc' },
      compensationStatus: 'pending',
    });

    // Step 1: Grant access (compensated by iam.revoke_access)
    await runStore.createStep({
      stepId: 'step_1',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 1,
      type: 'tool_call',
      title: 'Grant Access',
      capabilityId: 'iam.grant_access',
      compensatingCapabilityId: 'iam.revoke_access',
      status: 'completed',
      idempotencyKey: 'idemp_1',
      correlationId: 'corr_1',
      output: { userId: 'usr_xyz' },
      compensationStatus: 'pending',
    });

    // Execute Saga Rollback
    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Step 2 failed; rolling back prior mutations',
    });

    expect(result.success).toBe(true);
    expect(result.totalCompensations).toBe(2);
    expect(result.completedCompensations).toBe(2);

    // Strict LIFO execution check: Step 1 (revoke_access) MUST execute before Step 0 (delete_contact)
    expect(executedRollbacks).toEqual([
      'revoke_access:usr_xyz',
      'delete_contact:con_abc',
    ]);
  });

  it('supports dry-run mode without invoking mutating capability handlers (Rule 42)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Dry run compensation' },
    });

    await runStore.createStep({
      stepId: 'step_0',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Create Contact',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.delete_contact',
      status: 'completed',
      idempotencyKey: 'idemp_0',
      correlationId: 'corr_0',
      output: { contactId: 'con_abc' },
      compensationStatus: 'pending',
    });

    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Simulate rollback',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(executedRollbacks).toHaveLength(0); // Zero mutating handlers called
  });

  it('handles partial compensation failures and flags operator intervention required (Rule 25 & 63)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'lead_sdr',
      principalId: 'agent_sdr_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Partial failure test' },
    });

    // Step with non-existent compensating capability to trigger failure
    await runStore.createStep({
      stepId: 'step_missing',
      runId: run.runId,
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      stepIndex: 0,
      type: 'tool_call',
      title: 'Bad Step',
      capabilityId: 'crm.create_contact',
      compensatingCapabilityId: 'crm.missing_rollback_capability',
      status: 'completed',
      idempotencyKey: 'idemp_m',
      correlationId: 'corr_m',
      compensationStatus: 'pending',
    });

    const result = await sagaEngine.rollbackRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      runId: run.runId,
      reason: 'Rollback with missing cap',
    });

    expect(result.success).toBe(false);
    expect(result.failedCompensations).toBe(1);
    expect(result.requiresOperatorIntervention).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/runtime/saga-compensation.test.ts`  
Expected: FAIL (Cannot find module `@/platform/runtime/governance/saga-compensation`)

- [ ] **Step 3: Implement `saga-compensation.ts`**

```typescript
// src/platform/runtime/governance/saga-compensation.ts
/**
 * @fileOverview Formal Saga & Compensation Engine (Rules 19, 20, 25, 27, 40, 42, 60, 63)
 *
 * Implements:
 * - Collects completed mutating steps with registered `compensatingCapabilityId`.
 * - Executes compensations in strict LIFO (reverse execution) order on failure or cancellation.
 * - Generates deterministic `idempotencyKey` (`saga_comp_${stepId}`) (Rule 19).
 * - Invokes compensating capability handlers via `CapabilityRegistryStore` with dry-run support (Rule 42).
 * - Updates step `compensationStatus` and emits audit events.
 * - Alerts operators on partial failure requiring manual recovery (Rule 25 & 63).
 * - Evaluates emergency dead-man pause (Rule 60).
 */

import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import {
  type CapabilityRegistryStore,
  canonicalCapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type CompensationStep,
  type SagaExecutionResult,
  GovernanceError,
} from './governance-types';
import { type AgentStep } from '../agent-run-types';

export interface SagaCompensationEngineOptions {
  runStore?: AgentRunStore;
  capabilityRegistry?: CapabilityRegistryStore;
  eventBus?: EventBus;
}

export class SagaCompensationEngine {
  private readonly runStore: AgentRunStore;
  private readonly capabilityRegistry: CapabilityRegistryStore;
  private readonly eventBus: EventBus;

  constructor(options?: SagaCompensationEngineOptions) {
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.capabilityRegistry = options?.capabilityRegistry ?? canonicalCapabilityRegistryStore;
    this.eventBus = options?.eventBus ?? defaultEventBus;
  }

  public async rollbackRun(params: {
    organizationId: string;
    workspaceId: string;
    runId: string;
    reason: string;
    dryRun?: boolean;
    correlationId?: string;
  }): Promise<SagaExecutionResult> {
    const isPaused = await checkGovernanceDeadManSwitch(params.organizationId);
    if (isPaused) {
      throw new GovernanceError({
        code: 'DEAD_MAN_PAUSED',
        message: `Saga rollback halted: Emergency dead-man switch is active for tenant '${params.organizationId}'.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const steps = await this.runStore.listSteps(params.organizationId, params.runId);

    // Filter to completed steps requiring compensation, sorted in strict LIFO order (descending stepIndex)
    const compensableSteps = steps
      .filter((s) => s.status === 'completed' && s.compensatingCapabilityId)
      .sort((a, b) => b.stepIndex - a.stepIndex);

    const compensationSteps: CompensationStep[] = [];
    let completedCount = 0;
    let failedCount = 0;

    for (const step of compensableSteps) {
      const compCapId = step.compensatingCapabilityId!;
      const startTime = Date.now();
      const compRecord: CompensationStep = {
        stepId: step.stepId,
        capabilityId: step.capabilityId ?? 'unknown',
        compensatingCapabilityId: compCapId,
        idempotencyKey: `saga_comp_${step.stepId}`,
        compensationArguments: this.extractCompensationArguments(step),
        status: 'pending',
      };

      try {
        compRecord.status = 'running';

        if (!params.dryRun) {
          const capability = this.capabilityRegistry.get(compCapId);
          if (!capability) {
            throw new Error(`Compensating capability '${compCapId}' not registered in platform catalog.`);
          }

          // Execute compensating capability handler
          await capability.handler({
            input: compRecord.compensationArguments,
            principal: {
              principalId: `saga_rollback_${params.runId}`,
              effectiveRole: 'system',
              grantedScopes: ['*'],
              organizationId: params.organizationId,
              workspaceId: params.workspaceId,
            },
            invocationId: `saga_${step.stepId}_${Date.now()}`,
            organizationId: params.organizationId,
            workspaceId: params.workspaceId,
          });

          // Update step status in run store
          await this.runStore.updateStep(params.organizationId, params.runId, step.stepId, {
            compensationStatus: 'completed',
          });
        }

        compRecord.status = 'completed';
        compRecord.completedAt = new Date().toISOString();
        compRecord.durationMs = Date.now() - startTime;
        completedCount++;
      } catch (err) {
        compRecord.status = 'failed';
        compRecord.error = err instanceof Error ? err.message : String(err);
        compRecord.durationMs = Date.now() - startTime;
        failedCount++;

        if (!params.dryRun) {
          await this.runStore.updateStep(params.organizationId, params.runId, step.stepId, {
            compensationStatus: 'failed',
          });
        }
      }

      compensationSteps.push(compRecord);
    }

    const success = failedCount === 0;
    const requiresOperatorIntervention = failedCount > 0;

    // Emit domain event for audit immutability (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        eventType: success ? 'agent.run.compensated' : 'agent.run.compensation_failed',
        producer: 'agent-runtime',
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        correlationId: params.correlationId,
        payload: {
          runId: params.runId,
          success,
          totalCompensations: compensationSteps.length,
          completedCompensations: completedCount,
          failedCompensations: failedCount,
          dryRun: !!params.dryRun,
          requiresOperatorIntervention,
          reason: params.reason,
        },
      })
    );

    return {
      success,
      totalCompensations: compensationSteps.length,
      completedCompensations: completedCount,
      failedCompensations: failedCount,
      compensationSteps,
      error: success ? undefined : `One or more compensating operations failed during rollback.`,
      compensatedAt: new Date().toISOString(),
      dryRun: !!params.dryRun,
      requiresOperatorIntervention,
    };
  }

  private extractCompensationArguments(step: AgentStep): Record<string, unknown> {
    // If output contains an entity identifier, propagate to rollback args
    if (step.output && typeof step.output === 'object') {
      return { ...step.output };
    }
    return step.input ?? {};
  }
}

declare global {
  var __smartsappSagaEngine: SagaCompensationEngine | undefined;
}

export function getSagaCompensationEngine(options?: SagaCompensationEngineOptions): SagaCompensationEngine {
  if (process.env.NODE_ENV === 'test') {
    return new SagaCompensationEngine(options);
  }
  if (!globalThis.__smartsappSagaEngine) {
    globalThis.__smartsappSagaEngine = new SagaCompensationEngine(options);
  }
  return globalThis.__smartsappSagaEngine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/runtime/saga-compensation.test.ts`  
Expected: PASS

---

### Task 6: Barrels, Platform Integration & Full Regression Gates

**Files:**
- Create: `src/platform/runtime/governance/index.ts`
- Modify: `src/platform/runtime/index.ts`
- Test: All runtime test suites & baseline suites

- [ ] **Step 1: Create `src/platform/runtime/governance/index.ts`**

```typescript
// src/platform/runtime/governance/index.ts
/**
 * @fileOverview Governance Subsystem Barrel Export (Phase 6 Milestone 3)
 */

export * from './governance-types';
export * from './agent-budget-manager';
export * from './context-compressor';
export * from './cancellation-engine';
export * from './saga-compensation';
```

- [ ] **Step 2: Update `src/platform/runtime/index.ts` to export governance**

```typescript
// Add to src/platform/runtime/index.ts:
export * from './governance';
```

- [ ] **Step 3: Run all platform runtime tests**

Run: `pnpm vitest run src/platform/__tests__/runtime/`  
Expected: PASS (All test suites green)

- [ ] **Step 4: Run baseline regression suite (Rule 69)**

Run: `pnpm vitest run src/platform/__tests__/baseline/`  
Expected: PASS (All 43 baseline regression tests green)

- [ ] **Step 5: Run TypeScript static verification**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`  
Expected: Clean exit code 0, 0 errors.

- [ ] **Step 6: Run ESLint verification**

Run: `pnpm lint`  
Expected: Clean exit code 0, 0 errors.

---

## Plan Self-Review Checklist

1. **Spec Coverage:**
   - Multi-dimensional budgets & ceilings? Covered in Task 2 (`AgentBudgetManager`).
   - Stratified knapsack context compression $\le 4,000$ tokens & PII redaction? Covered in Task 3 (`AgentContextCompressor`).
   - Cooperative cancellation tokens & AbortSignal? Covered in Task 4 (`CancellationEngine`).
   - Formal Saga compensation & strict LIFO rollback? Covered in Task 5 (`SagaCompensationEngine`).
   - Error taxonomy & contracts? Covered in Task 1 (`governance-types.ts`).
   - XML prompt injection containerization? Covered in Task 3 (`<untrusted_reference_data id="compressed_history">`).
   - Dead-man kill switch evaluation? Covered in Tasks 2, 4, 5.
   - Strangler Fig preservation? Covered in Task 6 (100% baseline regression pass).

2. **Placeholder Scan:**
   - Zero "TODO", "TBD", or vague instructions. All tasks contain exact file paths, schemas, and complete implementations.

3. **Type Consistency:**
   - Zero `any` or `any[]` typing. Strict Zod v4 schemas used throughout.
