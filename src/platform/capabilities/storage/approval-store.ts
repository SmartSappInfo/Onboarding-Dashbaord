/**
 * @fileOverview Canonical Capability Approval Store (PR-7 / Workstream 1.4)
 *
 * Implements Rule 21 (Two-Phase Actions), Rule 22 (Approval Binding & Burn Prevention),
 * Rule 34 (4-Level Approval Architecture), and Master Roadmap Phase 1 Section 4.2.
 *
 * Persists approval requests and decisions in Firestore collection `capability_approvals/{id}`.
 * Adjudicates approvals with single-use binding to prevent replay or parameter tampering.
 *
 * Provides:
 * - `ApprovalStore`: Comprehensive management and verification interface.
 * - `createInMemoryApprovalStore`: Fast in-memory store for unit tests and local dev.
 * - `FirestoreApprovalStore`: Production Firestore transactional approval store.
 * - `defaultApprovalStore`: Process-wide default approval store.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { randomUUID } from 'node:crypto';
import {
  CAPABILITY_APPROVALS_COLLECTION,
  CapabilityApprovalRecordSchema,
  checkApprovalRecord,
  type ApprovalRequest,
  type ApprovalVerification,
  type ApprovalVerifier,
  type CapabilityApprovalRecord,
} from '../policy/approval-verifier';

export interface CreateApprovalRequestParams {
  approvalId?: string;
  organizationId: string;
  workspaceId: string;
  capabilityId: string;
  capabilityVersion: string;
  payloadHash: string;
  requestedBy: string;
  expiresInMs?: number;
}

export interface ApprovalStore extends ApprovalVerifier {
  createRequest(params: CreateApprovalRequestParams): Promise<CapabilityApprovalRecord>;
  get(approvalId: string): Promise<CapabilityApprovalRecord | null>;
  approve(approvalId: string, approvedBy: string, nowMs?: number): Promise<CapabilityApprovalRecord>;
  reject(approvalId: string, rejectedBy: string, nowMs?: number): Promise<CapabilityApprovalRecord>;
  revoke(approvalId: string, revokedBy: string, nowMs?: number): Promise<CapabilityApprovalRecord>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<CapabilityApprovalRecord[]>;
}

const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Creates an in-memory implementation of ApprovalStore.
 */
export function createInMemoryApprovalStore(): ApprovalStore {
  const records = new Map<string, CapabilityApprovalRecord>();

  return {
    async createRequest(params: CreateApprovalRequestParams): Promise<CapabilityApprovalRecord> {
      const approvalId = params.approvalId || `appr_${randomUUID()}`;
      const now = Date.now();
      const expiresAt = new Date(now + (params.expiresInMs ?? DEFAULT_EXPIRATION_MS)).toISOString();

      const candidate: CapabilityApprovalRecord = {
        approvalId,
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        capabilityId: params.capabilityId,
        capabilityVersion: params.capabilityVersion,
        payloadHash: params.payloadHash,
        requestedBy: params.requestedBy,
        approvedBy: null,
        approvedAt: null,
        expiresAt,
        status: 'pending',
      };

      const validated = CapabilityApprovalRecordSchema.parse(candidate);
      records.set(approvalId, validated);
      return validated;
    },

    async get(approvalId: string): Promise<CapabilityApprovalRecord | null> {
      return records.get(approvalId) ?? null;
    },

    async approve(approvalId: string, approvedBy: string, nowMs: number = Date.now()): Promise<CapabilityApprovalRecord> {
      const existing = records.get(approvalId);
      if (!existing) {
        throw new Error(`Approval request '${approvalId}' not found.`);
      }
      if (existing.status !== 'pending') {
        throw new Error(`Cannot approve request in status '${existing.status}'.`);
      }
      if (existing.requestedBy === approvedBy) {
        throw new Error('Self-approval is forbidden: requester cannot approve their own action.');
      }

      const updated: CapabilityApprovalRecord = {
        ...existing,
        status: 'approved',
        approvedBy,
        approvedAt: new Date(nowMs).toISOString(),
      };

      records.set(approvalId, updated);
      return updated;
    },

    async reject(approvalId: string, _rejectedBy: string): Promise<CapabilityApprovalRecord> {
      const existing = records.get(approvalId);
      if (!existing) {
        throw new Error(`Approval request '${approvalId}' not found.`);
      }

      const updated: CapabilityApprovalRecord = {
        ...existing,
        status: 'rejected',
      };

      records.set(approvalId, updated);
      return updated;
    },

    async revoke(approvalId: string, _revokedBy: string): Promise<CapabilityApprovalRecord> {
      const existing = records.get(approvalId);
      if (!existing) {
        throw new Error(`Approval request '${approvalId}' not found.`);
      }

      const updated: CapabilityApprovalRecord = {
        ...existing,
        status: 'revoked',
      };

      records.set(approvalId, updated);
      return updated;
    },

    async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CapabilityApprovalRecord[]> {
      const results: CapabilityApprovalRecord[] = [];
      for (const rec of records.values()) {
        if (rec.workspaceId === workspaceId) {
          results.push(rec);
          if (results.length >= limit) break;
        }
      }
      return results;
    },

    async verify(request: ApprovalRequest): Promise<ApprovalVerification> {
      const record = records.get(request.approvalId);
      if (!record) {
        return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
      }
      return checkApprovalRecord(record, request).result;
    },

    async verifyAndBind(request: ApprovalRequest): Promise<ApprovalVerification> {
      const record = records.get(request.approvalId);
      if (!record) {
        return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
      }

      const { result, bind } = checkApprovalRecord(record, request);
      if (result.ok && bind) {
        records.set(request.approvalId, {
          ...record,
          status: 'bound',
          boundToolInvocationId: request.toolInvocationId,
          boundAt: new Date(request.nowMs).toISOString(),
        });
      }

      return result;
    },
  };
}

/**
 * Production Firestore-backed ApprovalStore.
 */
export class FirestoreApprovalStore implements ApprovalStore {
  public async createRequest(params: CreateApprovalRequestParams): Promise<CapabilityApprovalRecord> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const approvalId = params.approvalId || `appr_${randomUUID()}`;
    const now = Date.now();
    const expiresAt = new Date(now + (params.expiresInMs ?? DEFAULT_EXPIRATION_MS)).toISOString();

    const candidate: CapabilityApprovalRecord = {
      approvalId,
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      capabilityId: params.capabilityId,
      capabilityVersion: params.capabilityVersion,
      payloadHash: params.payloadHash,
      requestedBy: params.requestedBy,
      approvedBy: null,
      approvedAt: null,
      expiresAt,
      status: 'pending',
    };

    const validated = CapabilityApprovalRecordSchema.parse(candidate);
    await adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId).set(validated);
    return validated;
  }

  public async get(approvalId: string): Promise<CapabilityApprovalRecord | null> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId).get();
      if (!snap.exists) return null;
      return snap.data() as CapabilityApprovalRecord;
    } catch {
      return null;
    }
  }

  public async approve(approvalId: string, approvedBy: string, nowMs: number = Date.now()): Promise<CapabilityApprovalRecord> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const ref = adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId);

    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error(`Approval request '${approvalId}' not found.`);
      const data = snap.data() as CapabilityApprovalRecord;
      if (data.status !== 'pending') throw new Error(`Cannot approve request in status '${data.status}'.`);
      if (data.requestedBy === approvedBy) throw new Error('Self-approval is forbidden.');

      const updated: CapabilityApprovalRecord = {
        ...data,
        status: 'approved',
        approvedBy,
        approvedAt: new Date(nowMs).toISOString(),
      };

      tx.update(ref, {
        status: 'approved',
        approvedBy,
        approvedAt: updated.approvedAt,
      });

      return updated;
    });
  }

  public async reject(approvalId: string, _rejectedBy: string): Promise<CapabilityApprovalRecord> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const ref = adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId);
    await ref.update({ status: 'rejected' });
    const updated = await this.get(approvalId);
    if (!updated) throw new Error('Record not found after update.');
    return updated;
  }

  public async revoke(approvalId: string, _revokedBy: string): Promise<CapabilityApprovalRecord> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const ref = adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId);
    await ref.update({ status: 'revoked' });
    const updated = await this.get(approvalId);
    if (!updated) throw new Error('Record not found after update.');
    return updated;
  }

  public async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CapabilityApprovalRecord[]> {
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb
        .collection(CAPABILITY_APPROVALS_COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .limit(limit)
        .get();

      return snap.docs.map((doc) => doc.data() as CapabilityApprovalRecord);
    } catch {
      return [];
    }
  }

  public async verify(request: ApprovalRequest): Promise<ApprovalVerification> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(request.approvalId).get();
    if (!snap.exists) {
      return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
    }
    const parsed = CapabilityApprovalRecordSchema.safeParse(snap.data());
    if (!parsed.success) {
      return { ok: false, code: 'APPROVAL_CORRUPT', message: 'Approval record failed schema validation.' };
    }
    return checkApprovalRecord(parsed.data, request).result;
  }

  public async verifyAndBind(request: ApprovalRequest): Promise<ApprovalVerification> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const ref = adminDb.collection(CAPABILITY_APPROVALS_COLLECTION).doc(request.approvalId);

    return await adminDb.runTransaction(async (tx): Promise<ApprovalVerification> => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
      }
      const parsed = CapabilityApprovalRecordSchema.safeParse(snap.data());
      if (!parsed.success) {
        return { ok: false, code: 'APPROVAL_CORRUPT', message: 'Approval record failed schema validation.' };
      }

      const { result, bind } = checkApprovalRecord(parsed.data, request);
      if (result.ok && bind) {
        tx.update(ref, {
          status: 'bound',
          boundToolInvocationId: request.toolInvocationId,
          boundAt: new Date(request.nowMs).toISOString(),
        });
      }

      return result;
    });
  }
}

/**
 * Process-wide default approval store.
 */
export const defaultApprovalStore: ApprovalStore =
  process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID
    ? createInMemoryApprovalStore()
    : new FirestoreApprovalStore();
