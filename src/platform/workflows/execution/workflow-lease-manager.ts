/**
 * @fileOverview Distributed Workflow Lease Manager (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. DISTRIBUTED LEASE TIME-TO-LIVE (Rule 9): Default lease TTL 120s, max 300s.
 * 3. ATOMIC CONCURRENCY & TOCTOU DEFENSE (Rule 18): Acquisition and renewal execute atomically
 *    (in-memory mutex / Firestore transaction) checking lease expiration and version.
 * 4. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every lease operation asserts organizationId and workspaceId.
 * 5. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowLeaseManager.
 */

import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { TenantBoundary, WorkflowStep } from '../workflow-types';
import {
  type WorkflowLease,
  WorkflowLeaseSchema,
  DEFAULT_LEASE_TTL_MS,
  MAX_LEASE_TTL_MS,
  WorkflowLeaseError,
} from './workflow-execution-types';

export interface WorkflowLeaseManager {
  acquireLease(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary,
    workerId: string,
    ttlMs?: number
  ): Promise<WorkflowLease>;

  renewLease(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary,
    workerId: string,
    ttlMs?: number
  ): Promise<WorkflowLease>;

  releaseLease(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary,
    workerId: string
  ): Promise<void>;

  getLease(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary
  ): Promise<WorkflowLease | null>;

  clearForTests?(): Promise<void>;
}

function clampTtl(ttlMs?: number): number {
  if (typeof ttlMs !== 'number' || ttlMs <= 0) {
    return DEFAULT_LEASE_TTL_MS;
  }
  return Math.min(ttlMs, MAX_LEASE_TTL_MS);
}

function assertTenantMatch(record: { organizationId: string; workspaceId: string }, requested: TenantBoundary): void {
  if (
    record.organizationId !== requested.organizationId ||
    record.workspaceId !== requested.workspaceId
  ) {
    throw new WorkflowLeaseError(
      'TENANT_SCOPE_VIOLATION',
      `Access denied: organization (${requested.organizationId}) or workspace (${requested.workspaceId}) mismatch`
    );
  }
}

// ── In-Memory Lease Manager for Hermetic Testing ─────────────────────────────
export function createMemoryWorkflowLeaseManager(): WorkflowLeaseManager {
  const leases = new Map<string, WorkflowLease>();

  const buildKey = (workflowId: string, stepId: string) => `${workflowId}:${stepId}`;

  return {
    async acquireLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string,
      ttlMs?: number
    ): Promise<WorkflowLease> {
      const key = buildKey(workflowId, stepId);
      const existing = leases.get(key);
      const now = Date.now();
      const validTtl = clampTtl(ttlMs);

      if (existing) {
        assertTenantMatch(existing, tenant);
        const expiresAtMs = new Date(existing.leaseExpiresAt).getTime();
        // If lease is active and held by a different worker, reject acquisition
        if (expiresAtMs > now && existing.workerId !== workerId) {
          throw new WorkflowLeaseError(
            'LEASE_ALREADY_ACQUIRED',
            `Lease for step ${stepId} is currently held by worker ${existing.workerId} until ${existing.leaseExpiresAt}`,
            { existingWorkerId: existing.workerId, leaseExpiresAt: existing.leaseExpiresAt }
          );
        }
      }

      const acquiredAt = new Date(now).toISOString();
      const leaseExpiresAt = new Date(now + validTtl).toISOString();
      const leaseVersion = existing ? existing.leaseVersion + 1 : 1;

      const lease: WorkflowLease = {
        workflowId,
        stepId,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workerId,
        leaseExpiresAt,
        leaseVersion,
        acquiredAt,
      };

      leases.set(key, lease);
      return lease;
    },

    async renewLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string,
      ttlMs?: number
    ): Promise<WorkflowLease> {
      const key = buildKey(workflowId, stepId);
      const existing = leases.get(key);
      const now = Date.now();

      if (!existing) {
        throw new WorkflowLeaseError(
          'LEASE_NOT_FOUND',
          `Cannot renew lease for step ${stepId}: no active lease exists`
        );
      }

      assertTenantMatch(existing, tenant);

      if (existing.workerId !== workerId) {
        throw new WorkflowLeaseError(
          'LEASE_CONCURRENCY_CONFLICT',
          `Cannot renew lease for step ${stepId}: lease held by worker ${existing.workerId}, not ${workerId}`
        );
      }

      const expiresAtMs = new Date(existing.leaseExpiresAt).getTime();
      if (expiresAtMs <= now) {
        throw new WorkflowLeaseError(
          'LEASE_EXPIRED',
          `Cannot renew lease for step ${stepId}: lease expired at ${existing.leaseExpiresAt}`
        );
      }

      const validTtl = clampTtl(ttlMs);
      const updated: WorkflowLease = {
        ...existing,
        leaseExpiresAt: new Date(now + validTtl).toISOString(),
        leaseVersion: existing.leaseVersion + 1,
      };

      leases.set(key, updated);
      return updated;
    },

    async releaseLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string
    ): Promise<void> {
      const key = buildKey(workflowId, stepId);
      const existing = leases.get(key);

      if (!existing) {
        return;
      }

      assertTenantMatch(existing, tenant);

      if (existing.workerId !== workerId) {
        const now = Date.now();
        const expiresAtMs = new Date(existing.leaseExpiresAt).getTime();
        if (expiresAtMs > now) {
          throw new WorkflowLeaseError(
            'LEASE_CONCURRENCY_CONFLICT',
            `Cannot release lease for step ${stepId}: held by worker ${existing.workerId}`
          );
        }
      }

      leases.delete(key);
    },

    async getLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowLease | null> {
      const key = buildKey(workflowId, stepId);
      const lease = leases.get(key);
      if (!lease) return null;

      assertTenantMatch(lease, tenant);

      const now = Date.now();
      const expiresAtMs = new Date(lease.leaseExpiresAt).getTime();
      if (expiresAtMs <= now) {
        leases.delete(key);
        return null;
      }

      return lease;
    },

    async clearForTests(): Promise<void> {
      leases.clear();
    },
  };
}

// ── Production Firestore Lease Manager ──────────────────────────────────────
export function createFirestoreWorkflowLeaseManager(customDb?: Firestore): WorkflowLeaseManager {
  const db = customDb || adminDb;

  const getStepRef = (tenant: TenantBoundary, workflowId: string, stepId: string): DocumentReference => {
    return db
      .collection('organizations')
      .doc(tenant.organizationId)
      .collection('workflows')
      .doc(workflowId)
      .collection('steps')
      .doc(stepId);
  };

  return {
    async acquireLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string,
      ttlMs?: number
    ): Promise<WorkflowLease> {
      const stepRef = getStepRef(tenant, workflowId, stepId);
      const validTtl = clampTtl(ttlMs);

      return await db.runTransaction(async (tx: Transaction) => {
        const stepSnap = await tx.get(stepRef);
        if (!stepSnap.exists) {
          throw new WorkflowLeaseError(
            'LEASE_NOT_FOUND',
            `Cannot acquire lease: step document ${stepId} does not exist in workflow ${workflowId}`
          );
        }

        const data = stepSnap.data() as WorkflowStep;
        assertTenantMatch(data, tenant);

        const now = Date.now();
        const existingLease = data.lease;

        if (existingLease) {
          const expiresAtMs = new Date(existingLease.leaseExpiresAt).getTime();
          if (expiresAtMs > now && existingLease.workerId !== workerId) {
            throw new WorkflowLeaseError(
              'LEASE_ALREADY_ACQUIRED',
              `Lease for step ${stepId} is currently held by worker ${existingLease.workerId} until ${existingLease.leaseExpiresAt}`,
              { existingWorkerId: existingLease.workerId, leaseExpiresAt: existingLease.leaseExpiresAt }
            );
          }
        }

        const acquiredAt = new Date(now).toISOString();
        const leaseExpiresAt = new Date(now + validTtl).toISOString();
        const leaseVersion = existingLease ? existingLease.leaseVersion + 1 : 1;

        const lease: WorkflowLease = {
          workflowId,
          stepId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          workerId,
          leaseExpiresAt,
          leaseVersion,
          acquiredAt,
        };

        const validatedLease = WorkflowLeaseSchema.parse(lease);

        tx.update(stepRef, {
          lease: validatedLease,
          updatedAt: acquiredAt,
        });

        return validatedLease;
      });
    },

    async renewLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string,
      ttlMs?: number
    ): Promise<WorkflowLease> {
      const stepRef = getStepRef(tenant, workflowId, stepId);
      const validTtl = clampTtl(ttlMs);

      return await db.runTransaction(async (tx: Transaction) => {
        const stepSnap = await tx.get(stepRef);
        if (!stepSnap.exists) {
          throw new WorkflowLeaseError(
            'LEASE_NOT_FOUND',
            `Cannot renew lease: step document ${stepId} does not exist in workflow ${workflowId}`
          );
        }

        const data = stepSnap.data() as WorkflowStep;
        assertTenantMatch(data, tenant);

        const existingLease = data.lease;
        const now = Date.now();

        if (!existingLease) {
          throw new WorkflowLeaseError(
            'LEASE_NOT_FOUND',
            `Cannot renew lease for step ${stepId}: no active lease exists`
          );
        }

        if (existingLease.workerId !== workerId) {
          throw new WorkflowLeaseError(
            'LEASE_CONCURRENCY_CONFLICT',
            `Cannot renew lease for step ${stepId}: lease held by worker ${existingLease.workerId}, not ${workerId}`
          );
        }

        const expiresAtMs = new Date(existingLease.leaseExpiresAt).getTime();
        if (expiresAtMs <= now) {
          throw new WorkflowLeaseError(
            'LEASE_EXPIRED',
            `Cannot renew lease for step ${stepId}: lease expired at ${existingLease.leaseExpiresAt}`
          );
        }

        const updatedLease: WorkflowLease = {
          workflowId,
          stepId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          workerId: existingLease.workerId,
          acquiredAt: existingLease.acquiredAt,
          leaseExpiresAt: new Date(now + validTtl).toISOString(),
          leaseVersion: existingLease.leaseVersion + 1,
        };

        const validatedLease = WorkflowLeaseSchema.parse(updatedLease);

        tx.update(stepRef, {
          lease: validatedLease,
          updatedAt: new Date(now).toISOString(),
        });

        return validatedLease;
      });
    },

    async releaseLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      workerId: string
    ): Promise<void> {
      const stepRef = getStepRef(tenant, workflowId, stepId);

      await db.runTransaction(async (tx: Transaction) => {
        const stepSnap = await tx.get(stepRef);
        if (!stepSnap.exists) return;

        const data = stepSnap.data() as WorkflowStep;
        assertTenantMatch(data, tenant);

        const existingLease = data.lease;
        if (!existingLease) return;

        if (existingLease.workerId !== workerId) {
          const now = Date.now();
          const expiresAtMs = new Date(existingLease.leaseExpiresAt).getTime();
          if (expiresAtMs > now) {
            throw new WorkflowLeaseError(
              'LEASE_CONCURRENCY_CONFLICT',
              `Cannot release lease for step ${stepId}: held by worker ${existingLease.workerId}`
            );
          }
        }

        tx.update(stepRef, {
          lease: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });
      });
    },

    async getLease(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowLease | null> {
      const stepRef = getStepRef(tenant, workflowId, stepId);
      const stepSnap = await stepRef.get();
      if (!stepSnap.exists) return null;

      const data = stepSnap.data() as WorkflowStep;
      assertTenantMatch(data, tenant);

      const lease = data.lease;
      if (!lease) return null;

      const now = Date.now();
      const expiresAtMs = new Date(lease.leaseExpiresAt).getTime();
      if (expiresAtMs <= now) {
        return null;
      }

      return {
        workflowId,
        stepId,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workerId: lease.workerId,
        leaseExpiresAt: lease.leaseExpiresAt,
        leaseVersion: lease.leaseVersion,
        acquiredAt: lease.acquiredAt,
      };
    },
  };
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowLeaseManager: WorkflowLeaseManager | undefined;
}

export function getWorkflowLeaseManager(): WorkflowLeaseManager {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryWorkflowLeaseManager();
  }

  if (!globalThis.__smartsappWorkflowLeaseManager) {
    globalThis.__smartsappWorkflowLeaseManager = createFirestoreWorkflowLeaseManager();
  }
  return globalThis.__smartsappWorkflowLeaseManager;
}
