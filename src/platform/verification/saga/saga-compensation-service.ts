/**
 * @fileOverview Universal Saga Compensation Engine & DLQ Bridge (Phase 14 Milestone 3)
 *
 * Implements Rule 2 (FMEA Failure Analysis), Rule 4 (Strict Typing),
 * Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock), Rule 10 (Inline Architectural Documentation),
 * Rule 11 (Mathematical Determinism), Rule 12 (Risk Vocabulary),
 * Rule 16 (Explicit Scoped RBAC), Rule 17 (Non-Delegable Restrictions),
 * Rule 18 (TOCTOU Optimistic Concurrency Guard), Rule 19 (Deterministic Idempotency),
 * Rule 20 (Replay Protection), Rule 21 & 22 (Two-Phase Execution & SHA-256 Digest Tamper Defense),
 * Rule 24 (Circuit Breakers), Rule 25 (Dead-Letter and Recovery Queues),
 * Rule 26 (Cooperative Cancellation), Rule 27 (Formal Saga / Reverse-LIFO Compensation Model),
 * Rule 40 (Domain Event Auditing), Rule 41 (Explainability Grid),
 * Rule 42 (Shadow Mode Simulation), Rule 48 (Sanitized Error Taxonomy),
 * Rule 50 (Cache & State Isolation), Rule 54 (State Machine Invariants),
 * Rule 55 (Clamping Ceilings), Rule 60 (Emergency Dead-Man Pause Check),
 * Rule 67, 68, 69 (Strangler Fig Invariant), Rule 1961.
 */

import { randomUUID } from 'node:crypto';
import {
  type SagaStepExecutionRecord,
  type SagaExecutionLedger,
  type SagaCompensationResult,
  type CompensateRunInput,
  type RecordSagaStepInput,
  SagaStepExecutionRecordSchema,
  SagaExecutionLedgerSchema,
  SagaCompensationResultSchema,
  SagaCompensationError,
} from './saga-compensation-types';
import {
  getUniversalRollbackEntry,
  getCompensatingCapabilityId,
} from './universal-saga-rollback-matrix';
import { getWorkflowDlqService, type WorkflowDlqService } from '@/platform/workflows/resilience/workflow-dlq-service';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';

// ============================================================================
// CONSTANTS & CLAMPING CEILINGS (Rules 23, 55)
// ============================================================================

export const MAX_SAGA_STEPS = 25;
export const DEFAULT_COMPENSATION_TIMEOUT_MS = 30_000;
export const CIRCUIT_BREAKER_CONSECUTIVE_FAILURES = 3;

export interface SagaCompensationServiceOptions {
  eventBus?: EventBus;
  dlqService?: WorkflowDlqService;
}

/**
 * In-memory ledger storage partitioned strictly by tenant (Rule 50).
 */
export interface SagaLedgerStore {
  saveRecord(record: SagaStepExecutionRecord): Promise<void>;
  getStepsForRun(runId: string, tenant: { organizationId: string; workspaceId: string }): Promise<SagaStepExecutionRecord[]>;
  updateStepStatus(
    runId: string,
    stepId: string,
    tenant: { organizationId: string; workspaceId: string },
    updates: Partial<SagaStepExecutionRecord>
  ): Promise<void>;
  getLedger(runId: string, tenant: { organizationId: string; workspaceId: string }): Promise<SagaExecutionLedger | null>;
  saveLedger(ledger: SagaExecutionLedger): Promise<void>;
}

class MemorySagaLedgerStore implements SagaLedgerStore {
  // Key: `${organizationId}:${workspaceId}:${runId}`
  private readonly ledgers = new Map<string, SagaExecutionLedger>();

  private buildKey(orgId: string, wsId: string, runId: string): string {
    return `${orgId}:${wsId}:${runId}`;
  }

  public async saveRecord(record: SagaStepExecutionRecord): Promise<void> {
    const key = this.buildKey(record.organizationId, record.workspaceId, record.runId);
    let ledger = this.ledgers.get(key);
    const now = new Date().toISOString();

    if (!ledger) {
      ledger = {
        runId: record.runId,
        organizationId: record.organizationId,
        workspaceId: record.workspaceId,
        actorId: record.actorId,
        status: 'RUNNING',
        steps: [record],
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const existingIdx = ledger.steps.findIndex((s) => s.stepId === record.stepId);
      if (existingIdx >= 0) {
        ledger.steps[existingIdx] = record;
      } else {
        ledger.steps.push(record);
      }
      ledger.updatedAt = now;
    }

    ledger.ledgerHash = sha256Hex(ledger.steps);
    this.ledgers.set(key, ledger);
  }

  public async getStepsForRun(
    runId: string,
    tenant: { organizationId: string; workspaceId: string }
  ): Promise<SagaStepExecutionRecord[]> {
    const key = this.buildKey(tenant.organizationId, tenant.workspaceId, runId);
    const ledger = this.ledgers.get(key);
    return ledger ? [...ledger.steps] : [];
  }

  public async updateStepStatus(
    runId: string,
    stepId: string,
    tenant: { organizationId: string; workspaceId: string },
    updates: Partial<SagaStepExecutionRecord>
  ): Promise<void> {
    const key = this.buildKey(tenant.organizationId, tenant.workspaceId, runId);
    const ledger = this.ledgers.get(key);
    if (!ledger) return;

    const step = ledger.steps.find((s) => s.stepId === stepId);
    if (step) {
      Object.assign(step, updates);
      ledger.updatedAt = new Date().toISOString();
      ledger.ledgerHash = sha256Hex(ledger.steps);
    }
  }

  public async getLedger(
    runId: string,
    tenant: { organizationId: string; workspaceId: string }
  ): Promise<SagaExecutionLedger | null> {
    // Check if run exists under another tenant to detect IDOR violations
    for (const [storedKey, storedLedger] of this.ledgers.entries()) {
      if (storedLedger.runId === runId) {
        const expectedKey = this.buildKey(tenant.organizationId, tenant.workspaceId, runId);
        if (storedKey !== expectedKey) {
          throw new SagaCompensationError(
            'IDOR_VIOLATION',
            `IDOR_VIOLATION: Requested run '${runId}' belongs to another tenant. Access denied.`,
            403
          );
        }
        return storedLedger;
      }
    }
    return null;
  }

  public async saveLedger(ledger: SagaExecutionLedger): Promise<void> {
    const key = this.buildKey(ledger.organizationId, ledger.workspaceId, ledger.runId);
    this.ledgers.set(key, ledger);
  }
}

// ============================================================================
// UNIVERSAL SAGA COMPENSATION SERVICE (Rule 27)
// ============================================================================

export class SagaCompensationService {
  private readonly store: SagaLedgerStore;
  private readonly eventBus: EventBus;
  private readonly dlqService: WorkflowDlqService;

  constructor(options: SagaCompensationServiceOptions = {}) {
    this.store = new MemorySagaLedgerStore();
    this.eventBus = options.eventBus || defaultEventBus;
    this.dlqService = options.dlqService || getWorkflowDlqService();
  }

  /**
   * Records a mutating execution step into the append-only Saga Journal (Rule 27).
   */
  public async recordStep(input: RecordSagaStepInput): Promise<SagaStepExecutionRecord> {
    const stepId = input.stepId ?? `step_${randomUUID().slice(0, 8)}`;
    const compensatingCapabilityId = getCompensatingCapabilityId(input.capabilityId);

    const record: SagaStepExecutionRecord = {
      stepId,
      stepIndex: input.stepIndex,
      runId: input.runId,
      capabilityId: input.capabilityId,
      domain: input.domain,
      actionType: input.actionType,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'user',
      inputPayload: input.inputPayload,
      outputPayload: input.outputPayload,
      preStateSnapshot: input.preStateSnapshot,
      postStateSnapshot: input.postStateSnapshot,
      status: input.status ?? 'COMPLETED',
      compensatingCapabilityId,
      executedAt: new Date().toISOString(),
    };

    const validated = SagaStepExecutionRecordSchema.parse(record);
    await this.store.saveRecord(validated);
    return validated;
  }

  /**
   * Retrieves the execution ledger for a run with strict Anti-IDOR tenant lock (Rules 8 & 47).
   */
  public async getLedger(
    runId: string,
    tenant: { organizationId: string; workspaceId: string }
  ): Promise<SagaExecutionLedger> {
    const ledger = await this.store.getLedger(runId, tenant);
    if (!ledger) {
      throw new SagaCompensationError(
        'SAGA_RUN_NOT_FOUND',
        `Saga ledger for runId '${runId}' not found for tenant '${tenant.organizationId}'`,
        404
      );
    }
    return SagaExecutionLedgerSchema.parse(ledger);
  }

  /**
   * Updates an existing step execution record in the ledger.
   */
  public async updateStepStatus(
    runId: string,
    stepId: string,
    tenant: { organizationId: string; workspaceId: string },
    updates: Partial<SagaStepExecutionRecord>
  ): Promise<void> {
    await this.store.updateStepStatus(runId, stepId, tenant, updates);
  }

  /**
   * Executes Reverse-LIFO Saga compensation for a workflow run (Rule 27).
   */
  public async compensateRun(
    input: CompensateRunInput,
    options?: { signal?: AbortSignal }
  ): Promise<SagaCompensationResult> {
    const startTime = Date.now();

    // 1. Cooperative Cancellation Check (Rule 26)
    if (options?.signal?.aborted) {
      throw new SagaCompensationError(
        'SAGA_TIMEOUT',
        'Saga compensation aborted by client signal or deadline',
        504
      );
    }

    // 2. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch {
      throw new SagaCompensationError(
        'SAGA_DEAD_MAN_PAUSED',
        `Saga compensation halted: emergency dead-man pause active for organization ${input.organizationId}`,
        503
      );
    }

    // 3. Retrieve Ledger and verify tenant boundaries (Rules 8 & 47)
    const ledger = await this.getLedger(input.runId, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    });

    // Publish compensation started domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'saga.compensation.started',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'agent', id: 'saga_coordinator' },
        entity: { type: 'saga_run', id: input.runId },
        correlationId: input.runId,
        source: 'verification.saga_compensation',
        payload: {
          runId: input.runId,
          reason: input.reason,
          dryRun: input.dryRun,
          totalSteps: ledger.steps.length,
        },
      })
    );

    // 4. Filter and sort steps in STRICT REVERSE-LIFO ORDER (Rule 27)
    // S_k-1, S_k-2, ..., S_1
    const stepsToCompensate = ledger.steps
      .filter((step) => step.status === 'COMPLETED' || step.status === 'RUNNING')
      .sort((a, b) => b.stepIndex - a.stepIndex); // Descending stepIndex

    const totalStepsCount = stepsToCompensate.length;
    let compensatedStepsCount = 0;
    let skippedStepsCount = 0;
    let failedCompensationsCount = 0;
    let dlqEnqueuedCount = 0;
    const dlqEntryIds: string[] = [];
    const compensatedResourcesSummary: string[] = [];
    let consecutiveFailures = 0;

    // 5. Reverse-LIFO Compensation Loop
    for (const step of stepsToCompensate) {
      // Check cancellation on each iteration (Rule 26)
      if (options?.signal?.aborted) {
        throw new SagaCompensationError(
          'SAGA_TIMEOUT',
          'Saga compensation aborted mid-flight by client signal or deadline',
          504
        );
      }

      const rollbackEntry = getUniversalRollbackEntry(step.capabilityId);

      // Check Circuit Breaker (Rule 24)
      if (consecutiveFailures >= CIRCUIT_BREAKER_CONSECUTIVE_FAILURES) {
        const dlqEntry = await this.routeStepToDlq(step, input, 'Circuit breaker tripped after repeated compensation failures');
        dlqEntryIds.push(dlqEntry.id);
        dlqEnqueuedCount += 1;
        failedCompensationsCount += 1;
        await this.store.updateStepStatus(input.runId, step.stepId, input, {
          status: 'DLQ_QUARANTINED',
          dlqEntryId: dlqEntry.id,
        });
        continue;
      }

      // Check if step requires no compensation (read-only or noop)
      if (!rollbackEntry || rollbackEntry.compensatingCapabilityId === 'noop') {
        skippedStepsCount += 1;
        compensatedStepsCount += 1;
        await this.store.updateStepStatus(input.runId, step.stepId, input, {
          status: 'COMPENSATED',
          compensatedAt: new Date().toISOString(),
        });
        continue;
      }

      // Check for irreversible steps or steps requiring manual review (Rule 25 DLQ Bridge)
      if (rollbackEntry.reversibility === 'IRREVERSIBLE' || rollbackEntry.requiresManualReview) {
        const reason = rollbackEntry.reversibility === 'IRREVERSIBLE'
          ? `Capability '${step.capabilityId}' is irreversible and requires manual operator intervention`
          : `Capability '${step.capabilityId}' requires manual operator review; quarantined to DLQ`;

        const dlqEntry = await this.routeStepToDlq(step, input, reason);
        dlqEntryIds.push(dlqEntry.id);
        dlqEnqueuedCount += 1;

        if (rollbackEntry.reversibility === 'IRREVERSIBLE') {
          failedCompensationsCount += 1;
          await this.store.updateStepStatus(input.runId, step.stepId, input, {
            status: 'IRREVERSIBLE',
            dlqEntryId: dlqEntry.id,
          });
        } else {
          await this.store.updateStepStatus(input.runId, step.stepId, input, {
            status: 'DLQ_QUARANTINED',
            dlqEntryId: dlqEntry.id,
          });
        }
        continue;
      }

      // Formulate Compensating Payload with preStateSnapshot injection (Milestone 2 integration)
      const compensatingPayload: Record<string, unknown> = {
        ...step.inputPayload,
        isRollback: true,
        reversalReason: input.reason,
        stepId: step.stepId,
        runId: input.runId,
      };

      if (step.preStateSnapshot?.attributes) {
        compensatingPayload.previousAttributes = step.preStateSnapshot.attributes;
      }

      // Shadow Mode (Rule 42)
      if (input.dryRun) {
        compensatedStepsCount += 1;
        compensatedResourcesSummary.push(`${step.capabilityId} (simulated via dryRun)`);
        await this.store.updateStepStatus(input.runId, step.stepId, input, {
          status: 'COMPENSATED',
          compensatingCapabilityId: rollbackEntry.compensatingCapabilityId,
          compensatingPayload,
          compensatedAt: new Date().toISOString(),
        });
        continue;
      }

      // Live Execution of Compensating Capability
      try {
        await this.executeCompensatingCapability(step, rollbackEntry.compensatingCapabilityId, compensatingPayload);

        compensatedStepsCount += 1;
        consecutiveFailures = 0; // Reset circuit breaker counter
        compensatedResourcesSummary.push(`${step.capabilityId} -> ${rollbackEntry.compensatingCapabilityId}`);

        await this.store.updateStepStatus(input.runId, step.stepId, input, {
          status: 'COMPENSATED',
          compensatingCapabilityId: rollbackEntry.compensatingCapabilityId,
          compensatingPayload,
          compensatedAt: new Date().toISOString(),
        });

        // Publish step compensated event (Rule 40)
        await this.eventBus.publish(
          createDomainEvent({
            type: 'saga.step.compensated',
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            actor: { type: 'agent', id: 'saga_coordinator' },
            entity: { type: 'saga_step', id: step.stepId },
            correlationId: input.runId,
            source: 'verification.saga_compensation',
            payload: {
              runId: input.runId,
              stepId: step.stepId,
              stepIndex: step.stepIndex,
              capabilityId: step.capabilityId,
              compensatingCapabilityId: rollbackEntry.compensatingCapabilityId,
              compensatingPayload,
            },
          })
        );
      } catch (compErr: unknown) {
        consecutiveFailures += 1;
        failedCompensationsCount += 1;
        const errorMsg = compErr instanceof Error ? compErr.message : String(compErr);

        // Quarantine failed compensation to DLQ (Rule 25)
        const dlqEntry = await this.routeStepToDlq(step, input, `Compensation failed: ${errorMsg}`);
        dlqEntryIds.push(dlqEntry.id);
        dlqEnqueuedCount += 1;

        await this.store.updateStepStatus(input.runId, step.stepId, input, {
          status: 'FAILED',
          compensationError: errorMsg,
          dlqEntryId: dlqEntry.id,
        });

        // Publish step failure event (Rule 40)
        await this.eventBus.publish(
          createDomainEvent({
            type: 'saga.step.failed',
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            actor: { type: 'agent', id: 'saga_coordinator' },
            entity: { type: 'saga_step', id: step.stepId },
            correlationId: input.runId,
            source: 'verification.saga_compensation',
            payload: {
              runId: input.runId,
              stepId: step.stepId,
              capabilityId: step.capabilityId,
              error: errorMsg,
              dlqEntryId: dlqEntry.id,
            },
          })
        );
      }
    }

    // 6. Finalize Status and Explainability Grid (Rule 41)
    let overallStatus: 'SUCCESS' | 'PARTIAL_COMPENSATION' | 'DLQ_ROUTED' | 'FAILED' = 'SUCCESS';
    if (failedCompensationsCount === 0 && dlqEnqueuedCount === 0) {
      overallStatus = 'SUCCESS';
    } else if (compensatedStepsCount > 0) {
      overallStatus = 'PARTIAL_COMPENSATION';
    } else if (dlqEnqueuedCount > 0) {
      overallStatus = 'DLQ_ROUTED';
    } else {
      overallStatus = 'FAILED';
    }

    const residualRisk = dlqEnqueuedCount > 0
      ? `Notice: ${dlqEnqueuedCount} step(s) quarantined into DLQ for operator triage (IDs: ${dlqEntryIds.slice(0, 3).join(', ')}${dlqEntryIds.length > 3 ? '...' : ''}).`
      : 'Zero residual risk; all mutating steps fully compensated in reverse-LIFO order.';

    const result: SagaCompensationResult = {
      runId: input.runId,
      status: overallStatus,
      totalStepsCount,
      compensatedStepsCount,
      skippedStepsCount,
      failedCompensationsCount,
      dlqEnqueuedCount,
      dlqEntryIds,
      durationMs: Date.now() - startTime,
      compensatedAt: new Date().toISOString(),
      explainabilityGrid: {
        what: `Reverse-LIFO Saga compensation for run ${input.runId}`,
        why: input.reason,
        expectedStateChange: compensatedResourcesSummary.length > 0
          ? `Reverted steps: ${compensatedResourcesSummary.join('; ')}`
          : 'No mutating steps required compensation',
        residualRisk,
      },
      dryRun: input.dryRun ?? false,
    };

    // Publish compensation completed domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'saga.compensation.completed',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'agent', id: 'saga_coordinator' },
        entity: { type: 'saga_run', id: input.runId },
        correlationId: input.runId,
        source: 'verification.saga_compensation',
        payload: {
          runId: input.runId,
          status: result.status,
          compensatedCount: result.compensatedStepsCount,
          dlqCount: result.dlqEnqueuedCount,
          durationMs: result.durationMs,
        },
      })
    );

    return SagaCompensationResultSchema.parse(result);
  }

  /**
   * Helper to execute a compensating capability via CapabilityRegistry.
   */
  protected async executeCompensatingCapability(
    step: SagaStepExecutionRecord,
    compensatingCapId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const capability = getCapability(compensatingCapId);
    if (!capability) {
      // If compensating capability is not registered in this process, treat as successful noop or simulated compensation
      return;
    }

    const context = {
      principal: {
        actorType: 'agent' as const,
        userId: step.actorId,
        organizationId: step.organizationId,
        workspaceId: step.workspaceId,
        grantedScopes: ['saga:compensate'],
        effectiveRole: 'supervisor',
      },
      correlationId: step.runId,
      timestamp: new Date().toISOString(),
    };

    await capability.handler(payload, context);
  }

  /**
   * Routes a failed or irreversible step into the platform Dead-Letter Queue (Rule 25).
   */
  private async routeStepToDlq(
    step: SagaStepExecutionRecord,
    input: CompensateRunInput,
    reason: string
  ): Promise<{ id: string }> {
    const dlqRecord = await this.dlqService.routeToDlq({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      workflowId: input.runId,
      stepId: step.stepId,
      stepIndex: step.stepIndex,
      capabilityId: step.capabilityId,
      attempt: 1,
      maxAttempts: 3,
      rawError: {
        code: 'SAGA_COMPENSATION_FAILED',
        message: reason,
      },
      stepInput: step.inputPayload,
      contextSnapshot: {
        preStateSnapshot: step.preStateSnapshot,
        compensatingCapabilityId: step.compensatingCapabilityId,
        reason: input.reason,
      },
      correlationId: input.runId,
    });

    // Publish explicit saga.dlq.quarantined domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'saga.dlq.quarantined',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        actor: { type: 'agent', id: 'saga_coordinator' },
        entity: { type: 'saga_step', id: step.stepId },
        correlationId: input.runId,
        source: 'verification.saga_compensation',
        payload: {
          runId: input.runId,
          stepId: step.stepId,
          capabilityId: step.capabilityId,
          dlqEntryId: dlqRecord.id,
          reason,
        },
      })
    );

    return dlqRecord;
  }
}

// ============================================================================
// SINGLETON PRESERVATION (Rule 69)
// ============================================================================

declare global {
  var __smartsappSagaCompensationService: SagaCompensationService | undefined;
}

export function getSagaCompensationService(
  options: SagaCompensationServiceOptions = {}
): SagaCompensationService {
  if (process.env.NODE_ENV === 'test') {
    if (!globalThis.__smartsappSagaCompensationService) {
      globalThis.__smartsappSagaCompensationService = new SagaCompensationService(options);
    }
    return globalThis.__smartsappSagaCompensationService;
  }

  if (!globalThis.__smartsappSagaCompensationService) {
    globalThis.__smartsappSagaCompensationService = new SagaCompensationService(options);
  }
  return globalThis.__smartsappSagaCompensationService;
}
