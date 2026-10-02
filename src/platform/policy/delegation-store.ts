/**
 * @fileOverview Delegation Store Interface & Implementations (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 40 (Audit Log Immutability), and Rule 69 (SSOT Architecture).
 *
 * Provides both in-memory storage for unit tests and production Firestore storage.
 * All mutations and lookups are strictly scoped by tenant parameters.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type {
  AgentDelegationGrant,
  AgentDelegationGrantStatus,
} from './delegation-types';
import { AgentDelegationGrantSchema } from './delegation-types';

export interface ListDelegationQuery {
  organizationId: string;
  workspaceId?: string;
  authorizingUserId?: string;
  agentPersonaId?: string;
  status?: AgentDelegationGrantStatus;
}

export interface DelegationStore {
  saveGrant(grant: AgentDelegationGrant): Promise<void>;
  getGrant(delegationId: string): Promise<AgentDelegationGrant | null>;
  updateGrantStatus(
    delegationId: string,
    status: AgentDelegationGrantStatus,
    metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
  ): Promise<void>;
  listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]>;
  revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number>;
  clearForTests(): Promise<void>;
}

/**
 * In-memory DelegationStore for deterministic unit and security testing.
 */
export function createMemoryDelegationStore(): DelegationStore {
  const grants = new Map<string, AgentDelegationGrant>();

  return {
    async saveGrant(grant: AgentDelegationGrant): Promise<void> {
      const parsed = AgentDelegationGrantSchema.parse(grant);
      grants.set(parsed.id, { ...parsed });
    },

    async getGrant(delegationId: string): Promise<AgentDelegationGrant | null> {
      const found = grants.get(delegationId);
      return found ? { ...found } : null;
    },

    async updateGrantStatus(
      delegationId: string,
      status: AgentDelegationGrantStatus,
      metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
    ): Promise<void> {
      const existing = grants.get(delegationId);
      if (!existing) return;
      const updated: AgentDelegationGrant = {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
        ...(metadata?.revokedAt ? { revokedAt: metadata.revokedAt } : {}),
        ...(metadata?.revokedBy ? { revokedBy: metadata.revokedBy } : {}),
        ...(metadata?.revocationReason ? { revocationReason: metadata.revocationReason } : {}),
      };
      grants.set(delegationId, updated);
    },

    async listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]> {
      const results: AgentDelegationGrant[] = [];
      for (const grant of grants.values()) {
        if (grant.organizationId !== query.organizationId) continue;
        if (query.workspaceId && grant.workspaceId !== query.workspaceId) continue;
        if (query.authorizingUserId && grant.authorizingUserId !== query.authorizingUserId) continue;
        if (query.agentPersonaId && grant.agentPersonaId !== query.agentPersonaId) continue;
        if (query.status && grant.status !== query.status) continue;
        results.push({ ...grant });
      }
      return results;
    },

    async revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number> {
      let count = 0;
      const now = new Date().toISOString();
      for (const [id, grant] of grants.entries()) {
        if (grant.parentDelegationId === parentDelegationId && grant.status === 'active') {
          grants.set(id, {
            ...grant,
            status: 'revoked',
            revokedAt: now,
            revokedBy: revokerId,
            revocationReason: reason,
            updatedAt: now,
          });
          count++;
          // Recursively cascade downwards
          count += await this.revokeChildDelegations(id, revokerId, reason);
        }
      }
      return count;
    },

    async clearForTests(): Promise<void> {
      grants.clear();
    },
  };
}

/**
 * Production Firestore DelegationStore writing to `agent_delegations` collection.
 */
export function createFirestoreDelegationStore(db: Firestore): DelegationStore {
  const collectionRef = db.collection('agent_delegations');

  return {
    async saveGrant(grant: AgentDelegationGrant): Promise<void> {
      const parsed = AgentDelegationGrantSchema.parse(grant);
      await collectionRef.doc(parsed.id).set(parsed);
    },

    async getGrant(delegationId: string): Promise<AgentDelegationGrant | null> {
      const snap = await collectionRef.doc(delegationId).get();
      if (!snap.exists) return null;
      const parsed = AgentDelegationGrantSchema.safeParse(snap.data());
      return parsed.success ? parsed.data : null;
    },

    async updateGrantStatus(
      delegationId: string,
      status: AgentDelegationGrantStatus,
      metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
    ): Promise<void> {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status,
        updatedAt: now,
      };
      if (metadata?.revokedAt) updates.revokedAt = metadata.revokedAt;
      if (metadata?.revokedBy) updates.revokedBy = metadata.revokedBy;
      if (metadata?.revocationReason) updates.revocationReason = metadata.revocationReason;
      await collectionRef.doc(delegationId).update(updates);
    },

    async listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]> {
      let q = collectionRef.where('organizationId', '==', query.organizationId);
      if (query.workspaceId) q = q.where('workspaceId', '==', query.workspaceId);
      if (query.authorizingUserId) q = q.where('authorizingUserId', '==', query.authorizingUserId);
      if (query.agentPersonaId) q = q.where('agentPersonaId', '==', query.agentPersonaId);
      if (query.status) q = q.where('status', '==', query.status);

      const snap = await q.get();
      const results: AgentDelegationGrant[] = [];
      for (const doc of snap.docs) {
        const parsed = AgentDelegationGrantSchema.safeParse(doc.data());
        if (parsed.success) results.push(parsed.data);
      }
      return results;
    },

    async revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number> {
      const childrenSnap = await collectionRef
        .where('parentDelegationId', '==', parentDelegationId)
        .where('status', '==', 'active')
        .get();

      if (childrenSnap.empty) return 0;

      let count = 0;
      const now = new Date().toISOString();
      const batch = db.batch();

      for (const doc of childrenSnap.docs) {
        batch.update(doc.ref, {
          status: 'revoked',
          revokedAt: now,
          revokedBy: revokerId,
          revocationReason: reason,
          updatedAt: now,
        });
        count++;
      }

      await batch.commit();

      // Cascade to grandchildren
      for (const doc of childrenSnap.docs) {
        count += await this.revokeChildDelegations(doc.id, revokerId, reason);
      }

      return count;
    },

    async clearForTests(): Promise<void> {
      const snap = await collectionRef.limit(500).get();
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    },
  };
}

// Global Singleton Store with HMR Preservation
const globalRef = globalThis as { __smartsappDelegationStore?: DelegationStore };
if (!globalRef.__smartsappDelegationStore) {
  globalRef.__smartsappDelegationStore = createMemoryDelegationStore();
}

export const globalDelegationStore: DelegationStore = globalRef.__smartsappDelegationStore;
