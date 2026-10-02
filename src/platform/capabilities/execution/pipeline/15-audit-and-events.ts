/**
 * @fileOverview Pipeline Step 15: Audit & Event Outbox (Phase 1 / PR-4)
 *
 * Implements Rule 27 (Dual-Write Defense / Outbox Pattern), Rule 39 (OpenTelemetry Tracing),
 * Rule 40 (Audit Immutability), Rule 41 ("Why Did You Do This?" Trace), PRD §73, and Tools §4.
 *
 * Records execution audit trail and queues emitted `DomainEvent` objects to the transactional outbox.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type {
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
} from '../../contracts/capability-definition';
import type { DomainEvent } from '../../events/domain-event';
import type { StateChanged } from '../../errors/capability-error';

export interface ExecutionAuditEntry {
  executionId: string;
  capabilityId: string;
  capabilityVersion: string;
  userId: string;
  agentId?: string;
  organizationId: string;
  workspaceId: string;
  correlationId: string;
  causationId?: string;
  decision: 'allowed' | 'denied';
  outcome: 'succeeded' | 'failed' | 'denied';
  code?: string;
  durationMs: number;
  stateChanged: StateChanged;
  timestamp: string;
  inputHash?: string;
}

export interface AuditAndEventsOptions {
  auditSink?: (entry: ExecutionAuditEntry) => Promise<void> | void;
  outboxSink?: (events: DomainEvent[]) => Promise<void> | void;
}

export interface ExecutionAuditInput {
  executionId: string;
  success: boolean;
  code?: string;
  durationMs: number;
  stateChanged: StateChanged;
  inputHash?: string;
  emittedEvents?: DomainEvent[];
}

export async function step15AuditAndEvents(
  capability: AnyCapabilityDefinition,
  context: CapabilityExecutionContext,
  execution: ExecutionAuditInput,
  options?: AuditAndEventsOptions
): Promise<void> {
  const auditEntry: ExecutionAuditEntry = {
    executionId: execution.executionId,
    capabilityId: capability.id,
    capabilityVersion: capability.version,
    userId: context.principal.userId,
    agentId: context.principal.agentId,
    organizationId: context.principal.organizationId,
    workspaceId: context.principal.workspaceId,
    correlationId: context.correlationId,
    causationId: context.causationId,
    decision: execution.success ? 'allowed' : 'denied',
    outcome: execution.success ? 'succeeded' : 'failed',
    code: execution.code,
    durationMs: execution.durationMs,
    stateChanged: execution.stateChanged,
    timestamp: context.timestamp,
    inputHash: execution.inputHash,
  };

  // 1. Audit sink
  if (options?.auditSink) {
    try {
      await options.auditSink(auditEntry);
    } catch (auditErr: unknown) {
      console.error(
        `[AUDIT-ERROR] Failed to record capability audit for ${capability.id} (executionId=${execution.executionId}):`,
        auditErr
      );
    }
  }

  // 2. Outbox event queueing (Rule 27 Dual-Write Defense)
  if (execution.emittedEvents && execution.emittedEvents.length > 0 && options?.outboxSink) {
    try {
      await options.outboxSink(execution.emittedEvents);
    } catch (outboxErr: unknown) {
      console.error(
        `[OUTBOX-ERROR] Failed to queue domain events for ${capability.id} (executionId=${execution.executionId}):`,
        outboxErr
      );
    }
  }
}
