/**
 * @fileOverview Organization Membership Service (Identity & Access 2.0)
 *
 * Manages the authoritative relationship between a Person/Account and an Organization.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - A membership ties `personId` (and `accountId`) to `organizationId`.
 * - A Person has one active OrganizationMembership at a time in the standard tenant model.
 * - Membership status controls the tenant lifecycle (`invited`, `pending`, `active`, `suspended`, `revoked`).
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported methods are covered in `identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { OrganizationMembership, MembershipStatus, MemberType, MembershipSource } from '@/lib/types';

export class OrganizationMembershipService {
  private static COLLECTION = 'organization_memberships';

  /**
   * Deterministic ID generation for membership documents: `mem_${orgId}_${personId}`.
   */
  static getMembershipId(organizationId: string, personId: string): string {
    return `mem_${organizationId}_${personId}`;
  }

  /**
   * Retrieves a membership by its ID.
   */
  static async getMembership(id: string): Promise<OrganizationMembership | null> {
    if (!id) return null;
    const snap = await adminDb.collection(this.COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as OrganizationMembership;
  }

  /**
   * Retrieves a Person's membership for a specific organization.
   */
  static async getMembershipByPersonAndOrg(
    organizationId: string,
    personId: string
  ): Promise<OrganizationMembership | null> {
    if (!organizationId || !personId) return null;
    const docId = this.getMembershipId(organizationId, personId);
    const directSnap = await adminDb.collection(this.COLLECTION).doc(docId).get();
    if (directSnap.exists) {
      return { id: directSnap.id, ...directSnap.data() } as OrganizationMembership;
    }

    // Query fallback for non-standard IDs
    const querySnap = await adminDb
      .collection(this.COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .limit(1)
      .get();

    if (querySnap.empty) return null;
    const doc = querySnap.docs[0];
    return { id: doc.id, ...doc.data() } as OrganizationMembership;
  }

  /**
   * Creates or sets an OrganizationMembership document.
   * Supports optional external Firestore transaction/batch for atomicity.
   */
  static async createMembership(
    membership: Omit<OrganizationMembership, 'id' | 'createdAt' | 'updatedAt'>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<OrganizationMembership> {
    const now = new Date().toISOString();
    const docId = this.getMembershipId(membership.organizationId, membership.personId);

    const completeMembership: OrganizationMembership = {
      id: docId,
      ...membership,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = adminDb.collection(this.COLLECTION).doc(docId);

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, completeMembership, { merge: true });
    } else {
      await docRef.set(completeMembership, { merge: true });
    }

    return completeMembership;
  }

  /**
   * Updates a membership's status (`active`, `suspended`, `revoked`, `pending`).
   */
  static async updateMembershipStatus(
    organizationId: string,
    personId: string,
    status: MembershipStatus,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<void> {
    const now = new Date().toISOString();
    const docId = this.getMembershipId(organizationId, personId);
    const docRef = adminDb.collection(this.COLLECTION).doc(docId);

    const updates: Partial<OrganizationMembership> = {
      status,
      updatedAt: now,
    };

    if (status === 'active') updates.joinedAt = now;
    if (status === 'suspended') updates.suspendedAt = now;
    if (status === 'revoked') updates.revokedAt = now;

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
  }

  /**
   * Lists all memberships belonging to an organization.
   */
  static async listMembershipsByOrganization(
    organizationId: string,
    status?: MembershipStatus
  ): Promise<OrganizationMembership[]> {
    if (!organizationId) return [];

    let query: FirebaseFirestore.Query = adminDb
      .collection(this.COLLECTION)
      .where('organizationId', '==', organizationId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OrganizationMembership));
  }
}
