/**
 * @fileOverview Canonical Tamper-Evident Audit Store (PR-7 / Workstream 1.4)
 *
 * Implements Rule 31 (Immutable Audit Trail), Rule 40 (Audit Immutability),
 * Rule 69 (SSOT Audit Log), and Master Roadmap Phase 1 Section 4.2.
 *
 * Persists capability invocation audit logs into Firestore collection `capability_audit/{id}`.
 * Enforces per-workspace SHA-256 cryptographic hash chaining (`prevHash` -> `hash`)
 * and monotonic sequence numbers, enabling mathematical verification of audit integrity.
 *
 * Provides:
 * - `computeAuditEntryHash`: Deterministic canonical SHA-256 hash computation.
 * - `createInMemoryAuditStore`: Isolated in-memory store for unit tests and local dev.
 * - `FirestoreAuditStore`: Production Firestore store using transactional chain updates.
 * - `verifyWorkspaceAuditChain`: Verifies the mathematical integrity of a workspace's audit log.
 * - `defaultAuditStore` & `defaultAuditSink`: Standardized plug-in sinks for execution gateway.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../contracts/canonical-json';
import type { StateChanged } from '../errors/capability-error';
import type { ExecutionAuditEntry } from '../execution/pipeline/15-audit-and-events';

export const CAPABILITY_AUDIT_COLLECTION = 'capability_audit';
export const CAPABILITY_AUDIT_HEADS_COLLECTION = 'capability_audit_heads';
export const GENESIS_PREV_HASH = '0'.repeat(64);

export interface CanonicalAuditRecord extends ExecutionAuditEntry {
  id: string;
  sequenceNumber: number;
  prevHash: string;
  hash: string;
  inputHash?: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  tamperedIndex?: number;
  tamperedRecordId?: string;
  reason?: string;
}

export interface AuditStore {
  record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord>;
  get(id: string): Promise<CanonicalAuditRecord | null>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<CanonicalAuditRecord[]>;
  verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult>;
}

/**
 * Computes deterministic SHA-256 hash across canonical representation of core audit fields.
 */
export function computeAuditEntryHash(params: {
  prevHash: string;
  sequenceNumber: number;
  executionId: string;
  workspaceId: string;
  organizationId: string;
  capabilityId: string;
  capabilityVersion: string;
  userId: string;
  agentId?: string;
  decision: 'allowed' | 'denied';
  outcome: 'succeeded' | 'failed' | 'denied';
  code?: string;
  durationMs: number;
  stateChanged: StateChanged;
  timestamp: string;
  inputHash?: string;
}): string {
  return sha256Hex({
    prevHash: params.prevHash,
    sequenceNumber: params.sequenceNumber,
    executionId: params.executionId,
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    capabilityId: params.capabilityId,
    capabilityVersion: params.capabilityVersion,
    userId: params.userId,
    agentId: params.agentId ?? null,
    decision: params.decision,
    outcome: params.outcome,
    code: params.code ?? null,
    durationMs: params.durationMs,
    stateChanged: params.stateChanged,
    timestamp: params.timestamp,
    inputHash: params.inputHash ?? null,
  });
}

/**
 * Verifies that a list of audit records forms an unbroken cryptographic chain.
 */
export function verifyAuditRecordChain(records: CanonicalAuditRecord[]): AuditVerificationResult {
  if (records.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < records.length; i++) {
    const current = records[i];
    const expectedSeq = i + 1;

    // 1. Verify monotonic sequence number
    if (current.sequenceNumber !== expectedSeq) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Broken sequence: expected ${expectedSeq}, got ${current.sequenceNumber}`,
      };
    }

    // 2. Verify prevHash link
    const expectedPrevHash = i === 0 ? GENESIS_PREV_HASH : records[i - 1].hash;
    if (current.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Broken chain link: prevHash does not match hash of preceding record`,
      };
    }

    // 3. Verify record's own computed hash
    const computedHash = computeAuditEntryHash(current);
    if (current.hash !== computedHash) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Tampered content: computed hash ${computedHash} does not match stored hash ${current.hash}`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: records.length,
  };
}

/**
 * In-memory audit store for testing, local development, and fast verification.
 */
export function createInMemoryAuditStore(): AuditStore {
  const chains = new Map<string, CanonicalAuditRecord[]>();
  const byId = new Map<string, CanonicalAuditRecord>();

  return {
    async record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord> {
      const workspaceKey = entry.workspaceId || 'global';
      const chain = chains.get(workspaceKey) ?? [];

      const sequenceNumber = chain.length + 1;
      const prevHash = chain.length === 0 ? GENESIS_PREV_HASH : chain[chain.length - 1].hash;

      const hash = computeAuditEntryHash({
        prevHash,
        sequenceNumber,
        executionId: entry.executionId,
        workspaceId: entry.workspaceId,
        organizationId: entry.organizationId,
        capabilityId: entry.capabilityId,
        capabilityVersion: entry.capabilityVersion,
        userId: entry.userId,
        agentId: entry.agentId,
        decision: entry.decision,
        outcome: entry.outcome,
        code: entry.code,
        durationMs: entry.durationMs,
        stateChanged: entry.stateChanged,
        timestamp: entry.timestamp,
        inputHash: entry.inputHash,
      });

      const recordId = `audit_${entry.executionId || randomUUID()}`;
      const record: CanonicalAuditRecord = {
        ...entry,
        id: recordId,
        sequenceNumber,
        prevHash,
        hash,
      };

      chain.push(record);
      chains.set(workspaceKey, chain);
      byId.set(recordId, record);

      return record;
    },

    async get(id: string): Promise<CanonicalAuditRecord | null> {
      return byId.get(id) ?? null;
    },

    async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CanonicalAuditRecord[]> {
      const workspaceKey = workspaceId || 'global';
      const chain = chains.get(workspaceKey) ?? [];
      return [...chain].reverse().slice(0, limit);
    },

    async verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult> {
      const workspaceKey = workspaceId || 'global';
      const chain = chains.get(workspaceKey) ?? [];
      return verifyAuditRecordChain(chain);
    },
  };
}

/**
 * Firestore-backed audit store implementing cryptographic chaining via atomic transactions.
 */
export class FirestoreAuditStore implements AuditStore {
  public async record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const workspaceKey = entry.workspaceId || 'global';
    const headRef = adminDb.collection(CAPABILITY_AUDIT_HEADS_COLLECTION).doc(workspaceKey);
    const recordId = `audit_${entry.executionId || randomUUID()}`;
    const recordRef = adminDb.collection(CAPABILITY_AUDIT_COLLECTION).doc(recordId);

    return await adminDb.runTransaction(async (transaction) => {
      const headSnap = await transaction.get(headRef);
      let sequenceNumber = 1;
      let prevHash = GENESIS_PREV_HASH;

      if (headSnap.exists) {
        const headData = headSnap.data();
        if (headData?.headHash) {
          prevHash = headData.headHash as string;
          sequenceNumber = (typeof headData.sequenceNumber === 'number' ? headData.sequenceNumber : 0) + 1;
        }
      }

      const hash = computeAuditEntryHash({
        prevHash,
        sequenceNumber,
        executionId: entry.executionId,
        workspaceId: entry.workspaceId,
        organizationId: entry.organizationId,
        capabilityId: entry.capabilityId,
        capabilityVersion: entry.capabilityVersion,
        userId: entry.userId,
        agentId: entry.agentId,
        decision: entry.decision,
        outcome: entry.outcome,
        code: entry.code,
        durationMs: entry.durationMs,
        stateChanged: entry.stateChanged,
        timestamp: entry.timestamp,
        inputHash: entry.inputHash,
      });

      const record: CanonicalAuditRecord = {
        ...entry,
        id: recordId,
        sequenceNumber,
        prevHash,
        hash,
      };

      transaction.set(recordRef, record);
      transaction.set(headRef, {
        workspaceId: entry.workspaceId,
        headHash: hash,
        sequenceNumber,
        updatedAt: entry.timestamp,
      });

      return record;
    });
  }

  public async get(id: string): Promise<CanonicalAuditRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection(CAPABILITY_AUDIT_COLLECTION).doc(id).get();
      if (!snap.exists) return null;
      return snap.data() as CanonicalAuditRecord;
    } catch {
      return null;
    }
  }

  public async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CanonicalAuditRecord[]> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snapshot = await adminDb
        .collection(CAPABILITY_AUDIT_COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .orderBy('sequenceNumber', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as CanonicalAuditRecord);
    } catch {
      // In-memory fallback if composite index is pending
      const { adminDb } = await import('@/lib/firebase-admin');
      const snapshot = await adminDb
        .collection(CAPABILITY_AUDIT_COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .limit(limit)
        .get();

      const records = snapshot.docs.map((doc) => doc.data() as CanonicalAuditRecord);
      return records.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
    }
  }

  public async verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snapshot = await adminDb
      .collection(CAPABILITY_AUDIT_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    const records = snapshot.docs
      .map((doc) => doc.data() as CanonicalAuditRecord)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return verifyAuditRecordChain(records);
  }
}

/**
 * Default process-wide audit store singleton.
 */
export const defaultAuditStore: AuditStore =
  process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID
    ? createInMemoryAuditStore()
    : new FirestoreAuditStore();

/**
 * Creates a standard audit sink function suitable for `executeCapability` or `step15AuditAndEvents`.
 */
export function createFirestoreAuditSink(store: AuditStore = defaultAuditStore): (entry: ExecutionAuditEntry) => Promise<void> {
  return async (entry: ExecutionAuditEntry) => {
    await store.record(entry);
  };
}

/**
 * Default audit sink delegating directly to the canonical audit store.
 */
export const defaultAuditSink = createFirestoreAuditSink(defaultAuditStore);

/**
 * Helper to verify workspace audit chain on the default store.
 */
export async function verifyWorkspaceAuditChain(
  workspaceId: string,
  store: AuditStore = defaultAuditStore
): Promise<AuditVerificationResult> {
  return await store.verifyWorkspaceChain(workspaceId);
}
