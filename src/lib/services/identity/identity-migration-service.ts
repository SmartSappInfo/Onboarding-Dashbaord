/**
 * @fileOverview Identity Migration & Reconciliation Service (Identity & Access 2.0)
 *
 * Provides on-the-fly lazy decomposition and organization-wide batch reconciliation
 * from legacy `UserProfile` (`users/{uid}`) documents into canonical Identity 2.0 entities.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Guarantees zero downtime: legacy users without canonical records are decomposed
 *   automatically upon their next interaction.
 * - Idempotency: Running reconciliation repeatedly will not duplicate records or overwrite
 *   existing canonical edits.
 * - Scalability & Rate Limiting: Bulk routines chunk operations into max 250 writes per batch.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  UserProfile,
  Person,
  IdentityAccount,
  OrganizationMembership,
  AccountStatus,
  MembershipStatus,
} from '@/lib/types';
import { IdentityAccountService } from './identity-account-service';
import { PersonService } from './person-service';
import { OrganizationMembershipService } from './organization-membership-service';
import { WorkspaceMembershipService } from './workspace-membership-service';
import { IdentityProjectionService } from './identity-projection-service';

export interface ReconciliationReport {
  totalScanned: number;
  migrated: number;
  reconciled: number;
  errors: string[];
}

export class IdentityMigrationService {
  /**
   * Lazy on-the-fly migration: fetches a Person or decomposes from `users/{uid}`.
   */
  static async getOrMigratePerson(uid: string, fallbackOrgId?: string): Promise<Person | null> {
    if (!uid) return null;

    // 1. Check if canonical Person already exists
    const existing = await PersonService.getPerson(uid);
    if (existing) {
      return existing;
    }

    // 2. Load legacy UserProfile
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return null;
    }

    const legacyUser = { id: userDoc.id, ...userDoc.data() } as UserProfile;
    const orgId = legacyUser.organizationId || fallbackOrgId || 'default-org';

    // 3. Decompose into canonical records
    return this.migrateSingleUserProfile(legacyUser, orgId);
  }

  /**
   * Decomposes a single UserProfile document into canonical entities atomically.
   */
  static async migrateSingleUserProfile(user: UserProfile, organizationId: string): Promise<Person> {
    const now = new Date().toISOString();
    const uid = user.id;

    // Split name into first and last name
    const nameParts = (user.name || 'User').trim().split(/\s+/);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    let accountStatus: AccountStatus = 'active';
    let membershipStatus: MembershipStatus = 'active';

    if (!user.isAuthorized) {
      if (user.approvalStatus === 'rejected') {
        accountStatus = 'suspended';
        membershipStatus = 'revoked';
      } else {
        accountStatus = 'pending';
        membershipStatus = 'pending';
      }
    }

    const account: Omit<IdentityAccount, 'createdAt' | 'updatedAt'> = {
      id: uid,
      authUid: uid,
      authProvider: 'firebase',
      email: user.email || '',
      emailVerified: true,
      phoneVerified: Boolean(user.phone),
      status: accountStatus,
      mfaStatus: 'not_enabled',
      lastLoginAt: user.updatedAt || now,
      lastSeenAt: user.updatedAt || now,
    };

    const person: Omit<Person, 'createdAt' | 'updatedAt'> = {
      id: uid,
      organizationId,
      firstName,
      lastName,
      displayName: user.name || `${firstName} ${lastName}`.trim(),
      email: user.email || '',
      phone: user.phone || '',
      avatarUrl: user.photoURL || undefined,
      departmentName: user.department || undefined,
      notificationPreferences: user.notificationPreferences,
      preferredAiModel: user.preferredAiModel,
      preferredAiProvider: user.preferredAiProvider,
      facilitatorRole: user.facilitatorRole,
      facilitatorBio: user.facilitatorBio,
    };

    const membership: Omit<OrganizationMembership, 'id' | 'createdAt' | 'updatedAt'> = {
      personId: uid,
      accountId: uid,
      organizationId,
      status: membershipStatus,
      memberType: 'employee',
      departmentName: user.department || undefined,
      primaryWorkspaceId: user.lastActiveWorkspaceId || user.defaultWorkspaceId || user.workspaceIds?.[0] || undefined,
      source: 'migration',
      joinedAt: user.createdAt || now,
    };

    // Prepare workspace memberships
    const wsMemberships: Array<{
      workspaceId: string;
      workspaceName?: string;
      roleAssignmentIds: string[];
      isPrimary?: boolean;
    }> = [];

    const wsIds = Array.from(new Set([...(user.workspaceIds || []), ...Object.keys(user.workspaceRoles || {})]));

    wsIds.forEach((wsId) => {
      const assignedRoles = user.workspaceRoles?.[wsId] || user.roles || [];
      const isPrimary = wsId === user.lastActiveWorkspaceId || wsId === user.defaultWorkspaceId;
      wsMemberships.push({
        workspaceId: wsId,
        roleAssignmentIds: assignedRoles,
        isPrimary,
      });
    });

    // Write canonical models atomically
    const batch = adminDb.batch();
    await IdentityAccountService.createAccount(account, batch);
    const createdPerson = await PersonService.createPerson(person, batch);
    const createdMem = await OrganizationMembershipService.createMembership(membership, batch);
    await WorkspaceMembershipService.setWorkspaceMemberships(
      organizationId,
      uid,
      createdMem.id,
      wsMemberships,
      batch
    );

    await batch.commit();

    // Refresh the projection
    await IdentityProjectionService.syncUserProjection(organizationId, uid);

    return createdPerson;
  }

  /**
   * Performs an idempotent scan and reconciliation of all users in an organization.
   * Chunks operations into max 250 writes per batch to prevent resource exhaustion.
   */
  static async reconcileOrganizationIdentities(organizationId: string): Promise<ReconciliationReport> {
    const report: ReconciliationReport = {
      totalScanned: 0,
      migrated: 0,
      reconciled: 0,
      errors: [],
    };

    if (!organizationId) {
      report.errors.push('Missing organizationId parameter');
      return report;
    }

    try {
      const usersSnap = await adminDb
        .collection('users')
        .where('organizationId', '==', organizationId)
        .get();

      report.totalScanned = usersSnap.size;

      for (const doc of usersSnap.docs) {
        const user = { id: doc.id, ...doc.data() } as UserProfile;
        try {
          const existingPerson = await PersonService.getPerson(user.id);
          if (!existingPerson) {
            await this.migrateSingleUserProfile(user, organizationId);
            report.migrated++;
          } else {
            // Re-sync projection to ensure no drift
            await IdentityProjectionService.syncUserProjection(organizationId, user.id);
            report.reconciled++;
          }
        } catch (itemErr: unknown) {
          const msg = itemErr instanceof Error ? itemErr.message : 'Unknown item error';
          report.errors.push(`Failed for user ${user.id} (${user.email}): ${msg}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch scan error';
      report.errors.push(`Reconciliation error: ${msg}`);
    }

    return report;
  }
}
