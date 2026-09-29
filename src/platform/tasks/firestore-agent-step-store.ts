/**
 * @fileOverview Firestore adapter for the agent-step executor (Phase 0 / Phase 7)
 *
 * Thin by design: all decision logic lives in `decideStepClaim` (pure, unit-tested).
 * This file only reads/writes `agent_runs/{runId}` and `agent_runs/{runId}/steps/{stepNumber}`.
 *
 * CAUTION: the claim MUST stay inside `runTransaction`. Reading the step and writing `running`
 * in separate calls lets two concurrent Cloud Tasks deliveries both execute the step.
 */

import type { DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import {
  AGENT_RUNS_COLLECTION,
  AGENT_STEPS_SUBCOLLECTION,
  AgentRunRecordSchema,
  AgentStepRecordSchema,
  decideStepClaim,
  type AgentRunRecord,
  type AgentStepRecord,
  type AgentStepTaskPayload,
} from './agent-step-contract';
import type { AgentStepStore, ClaimResult } from './agent-step-executor';

type Parsed<T> = { ok: true; value: T | null } | { ok: false };

function parseSnapshot<T>(snap: DocumentSnapshot, parse: (data: unknown) => { success: boolean; data?: T }): Parsed<T> {
  if (!snap.exists) return { ok: true, value: null };
  const result = parse(snap.data());
  return result.success && result.data !== undefined ? { ok: true, value: result.data } : { ok: false };
}

export function agentStepRefs(db: Firestore, payload: Pick<AgentStepTaskPayload, 'runId' | 'stepNumber'>): {
  runRef: DocumentReference;
  stepRef: DocumentReference;
} {
  const runRef = db.collection(AGENT_RUNS_COLLECTION).doc(payload.runId);
  const stepRef = runRef.collection(AGENT_STEPS_SUBCOLLECTION).doc(String(payload.stepNumber));
  return { runRef, stepRef };
}

export function createFirestoreAgentStepStore(db: Firestore): AgentStepStore {
  return {
    async claim(payload, { nowMs, leaseMsFor }): Promise<ClaimResult> {
      const { runRef, stepRef } = agentStepRefs(db, payload);

      return db.runTransaction(async (tx) => {
        const [runSnap, stepSnap] = await tx.getAll(runRef, stepRef);
        const run = parseSnapshot<AgentRunRecord>(runSnap, (d) => AgentRunRecordSchema.safeParse(d));
        const step = parseSnapshot<AgentStepRecord>(stepSnap, (d) => AgentStepRecordSchema.safeParse(d));

        if (!run.ok || !step.ok) {
          return {
            decision: { kind: 'reject', code: 'RECORD_CORRUPT', message: 'Stored run or step record failed schema validation.' },
            run: null,
            step: null,
          };
        }

        const decision = decideStepClaim({ run: run.value, step: step.value, idempotencyKey: payload.idempotencyKey, nowMs });

        if (decision.kind === 'claim' && run.value && step.value) {
          const nowIso = new Date(nowMs).toISOString();
          const leaseExpiresAt = new Date(nowMs + leaseMsFor(step.value.capabilityId)).toISOString();
          tx.update(stepRef, {
            status: 'running',
            attempts: decision.attempt,
            leaseExpiresAt,
            startedAt: nowIso,
            updatedAt: nowIso,
          });
          tx.update(runRef, {
            status: 'running',
            currentStep: payload.stepNumber,
            lastActiveAt: nowIso,
            updatedAt: nowIso,
          });
          return {
            decision,
            run: { ...run.value, status: 'running' },
            step: { ...step.value, status: 'running', attempts: decision.attempt, leaseExpiresAt },
          };
        }

        return { decision, run: run.value, step: step.value };
      });
    },

    async markCompleted(payload, { result, nowIso }) {
      const { runRef, stepRef } = agentStepRefs(db, payload);
      const batch = db.batch();
      batch.update(stepRef, {
        status: 'completed',
        result,
        error: null,
        leaseExpiresAt: null,
        completedAt: nowIso,
        updatedAt: nowIso,
      });
      batch.update(runRef, { lastCompletedStep: payload.stepNumber, lastActiveAt: nowIso, updatedAt: nowIso });
      await batch.commit();
    },

    async markRetryPending(payload, { error, nowIso, releaseLease }) {
      const { stepRef } = agentStepRefs(db, payload);
      await stepRef.update(
        releaseLease
          ? { status: 'retry_pending', error, leaseExpiresAt: null, updatedAt: nowIso }
          : // Keep status `running` + the lease: the timed-out handler may still be executing.
            { error, updatedAt: nowIso }
      );
    },

    async markFailed(payload, { error, nowIso }) {
      const { runRef, stepRef } = agentStepRefs(db, payload);
      const batch = db.batch();
      batch.update(stepRef, { status: 'failed', error, leaseExpiresAt: null, failedAt: nowIso, updatedAt: nowIso });
      batch.update(runRef, { status: 'failed', failedStep: payload.stepNumber, lastActiveAt: nowIso, updatedAt: nowIso });
      await batch.commit();
    },
  };
}
