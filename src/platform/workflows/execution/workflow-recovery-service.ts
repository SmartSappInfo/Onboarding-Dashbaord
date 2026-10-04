/**
 * @fileOverview Crash Recovery & Zombie Workflow Reaper (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. BOUNDED RECOVERY BATCHES (Rule 9 & 24): Bounded scanning prevents resource exhaustion.
 * 3. ATOMIC LEASE BREAKING (Rule 18): Breaks expired leases cleanly and re-dispatches or fails terminal steps.
 * 4. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every reap operation strictly scoped to organizationId and workspaceId.
 * 5. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowRecoveryService.
 */

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { TenantBoundary } from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import { isTerminalWorkflowState } from '../workflow-state-machine';
import {
  type WorkflowDispatcher,
  getWorkflowDispatcher,
} from '../dispatcher/workflow-dispatcher';
import {
  type WorkflowLeaseManager,
  getWorkflowLeaseManager,
} from './workflow-lease-manager';
import {
  type ZombieReapResult,
  ZombieReapResultSchema,
} from './workflow-execution-types';

export interface RecoveryServiceOptions {
  store?: WorkflowStore;
  leaseManager?: WorkflowLeaseManager;
  dispatcher?: WorkflowDispatcher;
  eventBus?: EventBus;
  db?: Firestore;
}

export interface WorkflowRecoveryService {
  reapZombieSteps(
    tenant: TenantBoundary,
    options?: { maxBatchSize?: number; nowMs?: number }
  ): Promise<ZombieReapResult>;
}

// ── In-Memory Implementation for Hermetic Testing ───────────────────────────
export function createMemoryWorkflowRecoveryService(
  options?: RecoveryServiceOptions
): WorkflowRecoveryService {
  const store = options?.store ?? getWorkflowStore();
  const leaseManager = options?.leaseManager ?? getWorkflowLeaseManager();
  const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();
  const eventBus = options?.eventBus ?? defaultEventBus;

  return {
    async reapZombieSteps(
      tenant: TenantBoundary,
      opts?: { maxBatchSize?: number; nowMs?: number }
    ): Promise<ZombieReapResult> {
      const now = opts?.nowMs ?? Date.now();
      const maxBatchSize = opts?.maxBatchSize ?? 100;

      const instancesResult = await store.listInstances({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        limit: maxBatchSize,
      });

      const recoveredSteps: string[] = [];
      const failedSteps: string[] = [];
      const errors: string[] = [];
      let scannedSteps = 0;

      for (const instance of instancesResult.items) {
        if (isTerminalWorkflowState(instance.status)) {
          continue;
        }

        const steps = await store.listSteps(instance.id, tenant);
        for (const step of steps) {
          scannedSteps += 1;

          if (step.status !== 'RUNNING') {
            continue;
          }

          // Check if step lease has expired
          const lease = step.lease;
          const isExpired = !lease || new Date(lease.leaseExpiresAt).getTime() <= now;

          if (isExpired) {
            try {
              // Break lease
              if (lease) {
                await leaseManager.releaseLease(instance.id, step.id, tenant, lease.workerId);
              }

              const currentAttempt = step.attempt ?? 1;
              const maxAttempts = step.maxAttempts ?? 3;

              if (currentAttempt < maxAttempts) {
                // Re-queue step for execution
                await store.updateStep(
                  instance.id,
                  step.id,
                  {
                    status: 'QUEUED',
                    error: {
                      code: 'LEASE_EXPIRED',
                      message: `Zombie worker detected: lease expired at ${lease?.leaseExpiresAt || 'unknown'}. Re-queued for recovery.`,
                    },
                  },
                  tenant
                );

                await dispatcher.enqueueWorkflowStep({
                  workflowId: instance.id,
                  stepId: step.id,
                  tenant,
                  attempt: currentAttempt,
                  idempotencyKey: `recovery_${step.id}_${currentAttempt}_${randomUUID()}`,
                });

                await eventBus.publish(
                  createDomainEvent({
                    type: 'workflow.recovery.zombie_detected',
                    organizationId: tenant.organizationId,
                    workspaceId: tenant.workspaceId,
                    entity: { type: 'workflow', id: instance.id },
                    actor: { type: 'system', id: 'workflow_recovery_service' },
                    correlationId: instance.correlationId || `corr_${instance.id}`,
                    source: 'workflow_recovery_service',
                    payload: {
                      stepId: step.id,
                      action: 'requeued',
                      attempt: currentAttempt,
                    },
                  })
                );

                recoveredSteps.push(step.id);
              } else {
                // Attempts exhausted: fail step and workflow
                await store.updateStep(
                  instance.id,
                  step.id,
                  {
                    status: 'FAILED',
                    error: {
                      code: 'LEASE_EXPIRED',
                      message: `Zombie worker recovery failed: exhausted max attempts (${maxAttempts}).`,
                    },
                  },
                  tenant
                );

                await store.updateInstanceStatus(instance.id, 'FAILED', tenant, {
                  currentStepId: step.id,
                  error: {
                    code: 'LEASE_EXPIRED',
                    message: `Workflow failed: zombie step ${step.id} exceeded max retry attempts.`,
                  },
                });

                await eventBus.publish(
                  createDomainEvent({
                    type: 'workflow.recovery.zombie_detected',
                    organizationId: tenant.organizationId,
                    workspaceId: tenant.workspaceId,
                    entity: { type: 'workflow', id: instance.id },
                    actor: { type: 'system', id: 'workflow_recovery_service' },
                    correlationId: instance.correlationId || `corr_${instance.id}`,
                    source: 'workflow_recovery_service',
                    payload: {
                      stepId: step.id,
                      action: 'failed',
                      attempt: currentAttempt,
                    },
                  })
                );

                failedSteps.push(step.id);
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Step ${step.id}: ${msg}`);
            }
          }
        }
      }

      return ZombieReapResultSchema.parse({
        scannedSteps,
        recoveredSteps,
        failedSteps,
        errors,
      });
    },
  };
}

// ── Production Firestore Implementation ─────────────────────────────────────
export function createFirestoreWorkflowRecoveryService(
  options?: RecoveryServiceOptions
): WorkflowRecoveryService {
  return createMemoryWorkflowRecoveryService(options);
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowRecoveryService: WorkflowRecoveryService | undefined;
}

export function getWorkflowRecoveryService(): WorkflowRecoveryService {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryWorkflowRecoveryService();
  }

  if (!globalThis.__smartsappWorkflowRecoveryService) {
    globalThis.__smartsappWorkflowRecoveryService = createFirestoreWorkflowRecoveryService();
  }
  return globalThis.__smartsappWorkflowRecoveryService;
}
