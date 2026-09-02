/**
 * @fileOverview Workspace Membership Service (Identity & Access 2.0)
 *
 * Manages workspace-scoped memberships, role assignments, and primary workspace flags.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - A Person can have multiple `WorkspaceMembership` documents within an Organization.
 * - `workspace_memberships` documents use deterministic IDs: `wsm_${workspaceId}_${personId}`.
 * - Each workspace membership tracks `roleAssignmentIds`, `isPrimary`, and optional `scopePolicy`.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { WorkspaceMembership, WorkspaceMembershipStatus } from '@/lib/types';

export class WorkspaceMembershipService {
  private static COLLECTION = 'workspace_memberships';

  /**
   * Deterministic ID generation: `wsm_${workspaceId}_${personId}`.
   */
  static getWorkspaceMembershipId(workspaceId: string, personId: string): string {
    return `wsm_${workspaceId}_${personId}`;
  }

  /**
   * Retrieves a WorkspaceMembership by its ID.
   */
  static async getWorkspaceMembership(id: string): Promise<WorkspaceMembership | null> {
    if (!id) return null;
    const snap = await adminDb.collection(this.COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as WorkspaceMembership;
  }

  /**
   * Lists all workspace memberships for a Person within an Organization.
   */
  static async listWorkspaceMembershipsByPerson(
    organizationId: string,
    personId: string
  ): Promise<WorkspaceMembership[]> {
    if (!organizationId || !personId) return [];

    const snap = await adminDb
      .collection(this.COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WorkspaceMembership));
  }

  /**
   * Lists all memberships assigned to a specific Workspace.
   */
  static async listWorkspaceMembershipsByWorkspace(
    workspaceId: string
  ): Promise<WorkspaceMembership[]> {
    if (!workspaceId) return [];

    const snap = await adminDb
      .collection(this.COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WorkspaceMembership));
  }

  /**
   * Sets/replaces all workspace memberships for a person within an organization.
   * Atomically deletes unassigned workspace memberships and upserts active ones.
   */
  static async setWorkspaceMemberships(
    organizationId: string,
    personId: string,
    membershipId: string,
    memberships: Array<{
      workspaceId: string;
      workspaceName?: string;
      roleAssignmentIds: string[];
      roleNames?: string[];
      isPrimary?: boolean;
      status?: WorkspaceMembershipStatus;
    }>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<WorkspaceMembership[]> {
    const now = new Date().toISOString();

    // 1. Fetch current memberships for cleanup
    const currentList = await this.listWorkspaceMembershipsByPerson(organizationId, personId);
    const targetWsIds = new Set(memberships.map((m) => m.workspaceId));

    // 2. Identify stale memberships to remove
    const staleDocs = currentList.filter((m) => !targetWsIds.has(m.workspaceId));

    const results: WorkspaceMembership[] = [];

    // 3. Process deletions and upserts
    for (const stale of staleDocs) {
      const staleRef = adminDb.collection(this.COLLECTION).doc(stale.id);
      if (batchOrTransaction) {
        (batchOrTransaction as FirebaseFirestore.WriteBatch).delete(staleRef);
      } else {
        await staleRef.delete();
      }
    }

    for (const item of memberships) {
      const docId = this.getWorkspaceMembershipId(item.workspaceId, personId);
      const docRef = adminDb.collection(this.COLLECTION).doc(docId);

      const record: WorkspaceMembership = {
        id: docId,
        organizationId,
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName || '',
        personId,
        membershipId,
        status: item.status || 'active',
        roleAssignmentIds: item.roleAssignmentIds || [],
        roleNames: item.roleNames || [],
        isPrimary: Boolean(item.isPrimary),
        createdAt: now,
        updatedAt: now,
      };

      if (batchOrTransaction) {
        (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, record, { merge: true });
      } else {
        await docRef.set(record, { merge: true });
      }

      results.push(record);
    }

    return results;
  }

  /**
   * Upserts a single workspace membership document.
   */
  static async upsertWorkspaceMembership(
    membership: Omit<WorkspaceMembership, 'id' | 'createdAt' | 'updatedAt'>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<WorkspaceMembership> {
    const now = new Date().toISOString();
    const docId = this.getWorkspaceMembershipId(membership.workspaceId, membership.personId);
    const docRef = adminDb.collection(this.COLLECTION).doc(docId);

    const record: WorkspaceMembership = {
      id: docId,
      ...membership,
      createdAt: now,
      updatedAt: now,
    };

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, record, { merge: true });
    } else {
      await docRef.set(record, { merge: true });
    }

    return record;
  }
}
