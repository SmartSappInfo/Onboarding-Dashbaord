/**
 * @fileOverview Just-In-Time (JIT) Temporary Access Service (Governance 2.0)
 *
 * Manages time-bounded privilege grants with explicit start/expiration timers,
 * auto-reaping expiration sweeps, and dual-layer real-time access checks.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Automatically attaches role to workspace membership on grant, and detaches on expiration.
 * - Triggers `IdentityProjectionService.syncUserProjection()` on all state mutations.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `governance-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { TemporaryAccessGrant, TemporaryAccessStatus } from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';
import { SecurityAuditService } from './security-audit-service';

export class TemporaryAccessService {
  private static collectionName = 'temporary_access_grants';

  /**
   * Grants time-bounded Just-In-Time access to a member.
   */
  static async grantTemporaryAccess(
    organizationId: string,
    payload: {
      personId: string;
      roleId: string;
      roleName: string;
      workspaceId?: string;
      reason: string;
      durationHours: number;
      grantedBy: string;
      granterName: string;
    }
  ): Promise<TemporaryAccessGrant> {
    const person = await PersonService.getPerson(payload.personId);
    if (!person) {
      throw new Error(`Person not found: ${payload.personId}`);
    }

    const docRef = adminDb.collection(this.collectionName).doc();
    const now = new Date();
    const startsAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + payload.durationHours * 60 * 60 * 1000).toISOString();

    const grant: TemporaryAccessGrant = {
      id: docRef.id,
      organizationId,
      personId: payload.personId,
      personName: person.displayName || person.email,
      personEmail: person.email,
      roleId: payload.roleId,
      roleName: payload.roleName,
      workspaceId: payload.workspaceId,
      reason: payload.reason.trim(),
      durationHours: payload.durationHours,
      grantedBy: payload.grantedBy,
      granterName: payload.granterName,
      startsAt,
      expiresAt,
      status: 'active',
    };

    await docRef.set(grant);

    // Attach role to workspace membership
    await this.attachRoleToWorkspace(organizationId, payload.personId, payload.roleId, payload.workspaceId);

    // Synchronize projection
    await IdentityProjectionService.syncUserProjection(organizationId, payload.personId);

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'jit_grant_created',
      actorId: payload.grantedBy,
      actorName: payload.granterName,
      targetId: person.id,
      targetName: person.displayName,
      description: `Granted ${payload.durationHours}h JIT access for role '${payload.roleName}' to ${person.displayName}. Reason: ${payload.reason}`,
    });

    return grant;
  }

  /**
   * Manually revokes an active JIT grant.
   */
  static async revokeTemporaryAccess(
    organizationId: string,
    grantId: string,
    revokedBy: string
  ): Promise<TemporaryAccessGrant> {
    const docRef = adminDb.collection(this.collectionName).doc(grantId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`JIT grant not found: ${grantId}`);
    }

    const grant = snap.data() as TemporaryAccessGrant;
    if (grant.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    const now = new Date().toISOString();
    const updated: TemporaryAccessGrant = {
      ...grant,
      status: 'revoked',
      revokedAt: now,
      revokedBy,
    };

    await docRef.set(updated, { merge: true });

    // Detach role from workspace
    await this.detachRoleFromWorkspace(organizationId, grant.personId, grant.roleId);

    // Synchronize projection
    await IdentityProjectionService.syncUserProjection(organizationId, grant.personId);

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'role_revoked',
      actorId: revokedBy,
      actorName: 'Security Admin',
      targetId: grant.personId,
      targetName: grant.personName,
      description: `Revoked JIT grant '${grant.roleName}' for ${grant.personName}.`,
    });

    return updated;
  }

  /**
   * Scans and auto-reaps expired temporary access grants in batches of <= 250 write operations.
   */
  static async reapExpiredGrants(organizationId: string): Promise<{ reapedCount: number }> {
    const nowIso = new Date().toISOString();

    const activeSnap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .get();

    const expiredGrants = activeSnap.docs
      .map((d) => d.data() as TemporaryAccessGrant)
      .filter((g) => g.expiresAt < nowIso);

    if (expiredGrants.length === 0) {
      return { reapedCount: 0 };
    }

    const CHUNK_SIZE = 250;
    const modifiedPeople = new Set<string>();

    for (let i = 0; i < expiredGrants.length; i += CHUNK_SIZE) {
      const chunk = expiredGrants.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const grant of chunk) {
        const ref = adminDb.collection(this.collectionName).doc(grant.id);
        batch.update(ref, {
          status: 'expired',
          updatedAt: nowIso,
        });
        modifiedPeople.add(grant.personId);
      }

      await batch.commit();
    }

    // Detach roles and sync projections for modified people
    for (const grant of expiredGrants) {
      await this.detachRoleFromWorkspace(organizationId, grant.personId, grant.roleId);
    }

    for (const personId of modifiedPeople) {
      await IdentityProjectionService.syncUserProjection(organizationId, personId);
    }

    return { reapedCount: expiredGrants.length };
  }

  /**
   * Lists active JIT grants for an organization.
   */
  static async listGrants(
    organizationId: string,
    status?: TemporaryAccessStatus
  ): Promise<TemporaryAccessGrant[]> {
    let q = adminDb.collection(this.collectionName).where('organizationId', '==', organizationId);

    if (status) {
      q = q.where('status', '==', status);
    }

    const snap = await q.get();
    const grants = snap.docs.map((d) => d.data() as TemporaryAccessGrant);
    return grants.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  }

  private static async attachRoleToWorkspace(
    organizationId: string,
    personId: string,
    roleId: string,
    workspaceId?: string
  ): Promise<void> {
    let q = adminDb
      .collection('workspace_memberships')
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId);

    if (workspaceId) {
      q = q.where('workspaceId', '==', workspaceId);
    }

    const snap = await q.limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      const roles: string[] = doc.data().roleAssignmentIds || [];
      if (!roles.includes(roleId)) {
        await doc.ref.update({
          roleAssignmentIds: [...roles, roleId],
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private static async detachRoleFromWorkspace(
    organizationId: string,
    personId: string,
    roleId: string
  ): Promise<void> {
    const snap = await adminDb
      .collection('workspace_memberships')
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .get();

    const batch = adminDb.batch();
    for (const doc of snap.docs) {
      const roles: string[] = doc.data().roleAssignmentIds || [];
      if (roles.includes(roleId)) {
        batch.update(doc.ref, {
          roleAssignmentIds: roles.filter((r) => r !== roleId),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await batch.commit();
  }
}
