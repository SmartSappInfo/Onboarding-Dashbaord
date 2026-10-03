/**
 * @fileOverview Cooperative Cancellation Engine & Abort Controller Harness (Rules 26, 40, 60)
 *
 * Implements:
 * - Active Run AbortController registry (`CancellationToken`).
 * - Distinguishes immediate abort vs graceful stop.
 * - Updates `AgentRunStore` status to 'cancelled' with immutable state history.
 * - Publishes `agent.run.cancelled` domain events through `defaultEventBus`.
 * - Emergency dead-man fail-closed controls (Rule 60).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
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

class InternalCancellationTokenSource implements CancellationToken {
  private readonly controller: AbortController = new AbortController();
  public isCancelled: boolean = false;
  public reason?: CancellationReason;

  constructor(public readonly runId: string) {}

  public get signal(): AbortSignal {
    return this.controller.signal;
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
      return existing;
    }
    const source = new InternalCancellationTokenSource(runId);
    this.activeSources.set(runId, source);
    return source;
  }

  public getToken(runId: string): CancellationToken | undefined {
    return this.activeSources.get(runId);
  }

  public async cancelRun(params: {
    organizationId: string;
    runId: string;
    reason: CancellationReason;
  }): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch (e) {
      if (e instanceof GovernanceError) throw e;
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
    await this.runStore.updateRunStatus({
      organizationId: params.organizationId,
      runId: params.runId,
      toStatus: 'cancelled',
      reason: params.reason.reason,
    });

    // 3. Publish domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'agent.run.cancelled',
        source: 'agent-runtime',
        organizationId: params.organizationId,
        workspaceId: run.workspaceId,
        actor: { type: 'user', id: params.reason.requestedBy },
        entity: { type: 'agent_run', id: params.runId },
        correlationId: params.reason.correlationId || `corr_${params.runId}`,
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
