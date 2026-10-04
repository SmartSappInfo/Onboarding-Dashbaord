/**
 * @fileOverview Deterministic Checkpoint Replay Engine (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. CRYPTOGRAPHIC PROVENANCE & AUDIT TRAIL (Rule 40 & 43): Traverses checkpoint chain,
 *    verifying SHA-256 hash continuity (recomputedHash === checkpoint.hash and previousHash link).
 * 3. POINT-IN-TIME RECONSTRUCTION (Rule 43): Deterministically restores workflow and step state at any checkpoint.
 * 4. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Scoped to organizationId and workspaceId.
 * 5. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowReplayEngine.
 */

import type { TenantBoundary, WorkflowCheckpoint, WorkflowState } from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import { createCheckpointHash } from '../workflow-state-machine';
import {
  type ReplayVerificationResult,
  ReplayVerificationResultSchema,
  WorkflowReplayError,
} from './workflow-execution-types';

export interface WorkflowReplayEngine {
  replayWorkflow(
    workflowId: string,
    tenant: TenantBoundary,
    targetSequence?: number
  ): Promise<ReplayVerificationResult>;

  reconstructStateAtCheckpoint(
    workflowId: string,
    tenant: TenantBoundary,
    targetSequence: number
  ): Promise<{
    status: WorkflowState;
    stepOutputs: Record<string, unknown>;
    lastCheckpoint: WorkflowCheckpoint;
  }>;
}

export function createWorkflowReplayEngine(options?: {
  store?: WorkflowStore;
}): WorkflowReplayEngine {
  const store = options?.store ?? getWorkflowStore();

  return {
    async replayWorkflow(
      workflowId: string,
      tenant: TenantBoundary,
      targetSequence?: number
    ): Promise<ReplayVerificationResult> {
      const checkpoints = await store.listCheckpoints(workflowId, tenant);
      const sorted = [...checkpoints].sort((a, b) => a.checkpointSequence - b.checkpointSequence);

      if (sorted.length === 0) {
        return ReplayVerificationResultSchema.parse({
          workflowId,
          isValid: true,
          totalCheckpoints: 0,
          verifiedCheckpoints: 0,
          lastVerifiedSequence: 0,
        });
      }

      const limit = targetSequence !== undefined
        ? Math.min(targetSequence, sorted.length - 1)
        : sorted.length - 1;

      let verifiedCount = 0;
      let lastSeq = 0;

      for (let i = 0; i <= limit; i++) {
        const cp = sorted[i];

        // 1. Verify previousHash chaining
        if (i > 0) {
          const prevCp = sorted[i - 1];
          if (cp.previousHash !== prevCp.hash) {
            return ReplayVerificationResultSchema.parse({
              workflowId,
              isValid: false,
              totalCheckpoints: sorted.length,
              verifiedCheckpoints: verifiedCount,
              lastVerifiedSequence: lastSeq,
              failureReason: `Broken previousHash chain at sequence ${cp.checkpointSequence}: expected ${prevCp.hash}, found ${cp.previousHash}`,
              divergenceIndex: i,
            });
          }
        }

        // 2. Recompute and verify content hash
        const recomputedHash = createCheckpointHash({
          workflowId: cp.workflowId,
          sequence: cp.checkpointSequence,
          fromState: cp.fromState,
          toState: cp.toState,
          stepId: cp.stepId,
          statePayload: cp.statePayload ?? {},
          previousHash: cp.previousHash,
        });

        if (recomputedHash !== cp.hash) {
          return ReplayVerificationResultSchema.parse({
            workflowId,
            isValid: false,
            totalCheckpoints: sorted.length,
            verifiedCheckpoints: verifiedCount,
            lastVerifiedSequence: lastSeq,
            failureReason: `Hash mismatch at sequence ${cp.checkpointSequence}: recorded hash ${cp.hash} does not match computed hash ${recomputedHash}`,
            divergenceIndex: i,
          });
        }

        verifiedCount += 1;
        lastSeq = cp.checkpointSequence;
      }

      return ReplayVerificationResultSchema.parse({
        workflowId,
        isValid: true,
        totalCheckpoints: sorted.length,
        verifiedCheckpoints: verifiedCount,
        lastVerifiedSequence: lastSeq,
      });
    },

    async reconstructStateAtCheckpoint(
      workflowId: string,
      tenant: TenantBoundary,
      targetSequence: number
    ): Promise<{
      status: WorkflowState;
      stepOutputs: Record<string, unknown>;
      lastCheckpoint: WorkflowCheckpoint;
    }> {
      const checkpoints = await store.listCheckpoints(workflowId, tenant);
      const sorted = [...checkpoints].sort((a, b) => a.checkpointSequence - b.checkpointSequence);

      if (sorted.length === 0) {
        throw new WorkflowReplayError(
          'CHECKPOINTS_EMPTY',
          `Cannot reconstruct state: no checkpoints exist for workflow ${workflowId}`
        );
      }

      if (targetSequence < 0 || targetSequence >= sorted.length) {
        throw new WorkflowReplayError(
          'STATE_DIVERGENCE',
          `Target sequence ${targetSequence} out of range [0, ${sorted.length - 1}]`
        );
      }

      // Verify chain up to target sequence
      const verifyResult = await this.replayWorkflow(workflowId, tenant, targetSequence);
      if (!verifyResult.isValid) {
        throw new WorkflowReplayError(
          'HASH_CHAIN_BROKEN',
          `Cannot reconstruct state: ${verifyResult.failureReason}`
        );
      }

      const stepOutputs: Record<string, unknown> = {};
      for (let i = 0; i <= targetSequence; i++) {
        const cp = sorted[i];
        if (cp.stepId && cp.statePayload) {
          stepOutputs[cp.stepId] = cp.statePayload;
        }
      }

      const lastCheckpoint = sorted[targetSequence];
      return {
        status: lastCheckpoint.toState,
        stepOutputs,
        lastCheckpoint,
      };
    },
  };
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowReplayEngine: WorkflowReplayEngine | undefined;
}

export function getWorkflowReplayEngine(): WorkflowReplayEngine {
  if (!globalThis.__smartsappWorkflowReplayEngine) {
    globalThis.__smartsappWorkflowReplayEngine = createWorkflowReplayEngine();
  }
  return globalThis.__smartsappWorkflowReplayEngine;
}
