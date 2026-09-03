/**
 * @fileOverview Cryptographic Invitation Lifecycle Service (Workforce 2.0)
 *
 * Implements single-use cryptographically hashed invitation tokens (SHA-256),
 * multi-channel delivery status tracking, and atomic auto-acceptance provisioning.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Tokens are NEVER stored in plaintext in Firestore; only the SHA-256 `tokenHash` is saved.
 * - Accepting an invitation executes atomic decomposition across `accounts`, `people`,
 *   `organization_memberships`, and `workspace_memberships`, followed by projection sync.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import * as crypto from 'crypto';
import type {
  Invitation,
  InvitationStatus,
  Person,
  OrganizationMembership,
  WorkspaceMembership,
  IdentityAccount,
} from '@/lib/types';
import { IdentityAccountService } from '@/lib/services/identity/identity-account-service';
import { PersonService } from '@/lib/services/identity/person-service';
import { OrganizationMembershipService } from '@/lib/services/identity/organization-membership-service';
import { WorkspaceMembershipService } from '@/lib/services/identity/workspace-membership-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';

export interface CreateInvitationPayload {
  email: string;
  phone?: string;
  invitedPersonName?: string;
  workspaceId?: string;
  workspaceName?: string;
  roleIds: string[];
  roleNames?: string[];
  teamIds?: string[];
  departmentId?: string;
  expiresInDays?: number;
  invitedBy: string;
  channels?: ('email' | 'sms' | 'whatsapp')[];
}

export class InvitationLifecycleService {
  /**
   * Hashes a raw token with SHA-256 for secure database indexing.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a 256-bit cryptographically secure invitation token.
   */
  static generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a new invitation document with hashed token and expiration timestamp.
   */
  static async createInvitation(
    organizationId: string,
    payload: CreateInvitationPayload,
    batch?: FirebaseFirestore.WriteBatch
  ): Promise<{ invitation: Invitation; rawToken: string }> {
    if (!organizationId) throw new Error('Missing organizationId');
    if (!payload.email?.trim()) throw new Error('Invitee email is required');
    if (!payload.roleIds || payload.roleIds.length === 0) {
      throw new Error('At least one role must be assigned to the invitation');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);

    const days = payload.expiresInDays && payload.expiresInDays > 0 ? payload.expiresInDays : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const requestedChannels = payload.channels && payload.channels.length > 0 ? payload.channels : ['email'];
    const channelMap: Invitation['channels'] = {
      email: {
        status: requestedChannels.includes('email') ? 'pending' : 'skipped',
        dispatchedAt: now,
      },
      ...(requestedChannels.includes('sms') ? { sms: { status: 'pending' as const, dispatchedAt: now } } : {}),
      ...(requestedChannels.includes('whatsapp') ? { whatsapp: { status: 'pending' as const, dispatchedAt: now } } : {}),
    };

    const inviteRef = adminDb.collection('invitations').doc();
    const newInvitation: Invitation = {
      id: inviteRef.id,
      organizationId,
      workspaceId: payload.workspaceId || undefined,
      workspaceName: payload.workspaceName || undefined,
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || undefined,
      invitedPersonName: payload.invitedPersonName?.trim() || undefined,
      roleIds: payload.roleIds,
      roleNames: payload.roleNames || [],
      teamIds: payload.teamIds || [],
      departmentId: payload.departmentId || undefined,
      tokenHash,
      expiresAt,
      status: 'pending',
      channels: channelMap,
      invitedBy: payload.invitedBy,
      createdAt: now,
      updatedAt: now,
    };

    if (batch) {
      batch.set(inviteRef, newInvitation);
    } else {
      await inviteRef.set(newInvitation);
    }

    return { invitation: newInvitation, rawToken };
  }

  /**
   * Validates a raw token from a public invitation acceptance URL.
   */
  static async validateInvitationToken(rawToken: string): Promise<Invitation | null> {
    if (!rawToken || rawToken.length < 16) return null;

    const tokenHash = this.hashToken(rawToken);
    const snap = await adminDb
      .collection('invitations')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const invitation = { id: snap.docs[0].id, ...snap.docs[0].data() } as Invitation;

    // Validate status and expiration
    if (invitation.status !== 'sent') return null;
    if (new Date(invitation.expiresAt) <= new Date()) {
      // Mark as expired asynchronously
      await adminDb.collection('invitations').doc(invitation.id).update({
        status: 'expired',
        updatedAt: new Date().toISOString(),
      });
      return null;
    }

    return invitation;
  }

  /**
   * Accepts an invitation, provisions Identity 2.0 graphs, and synchronizes projections.
   */
  static async acceptInvitation(params: {
    rawToken: string;
    accountUid: string;
    displayName?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<{
    person: Person;
    membership: OrganizationMembership;
  }> {
    const { rawToken, accountUid, displayName, phone, avatarUrl } = params;

    const invitation = await this.validateInvitationToken(rawToken);
    if (!invitation) {
      throw new Error('Invalid, expired, or already used invitation token.');
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Provision or update IdentityAccount
    await IdentityAccountService.upsertAccount(
      {
        id: accountUid,
        email: invitation.email,
        status: 'active',
        authProvider: 'firebase',
      },
      batch
    );

    // 2. Provision Person profile
    const person = await PersonService.upsertPerson(
      {
        id: accountUid,
        organizationId: invitation.organizationId,
        displayName: displayName || invitation.invitedPersonName || invitation.email.split('@')[0],
        email: invitation.email,
        phone: phone || invitation.phone,
        avatarUrl,
        departmentId: invitation.departmentId,
      },
      batch
    );

    // 3. Provision Organization Membership
    const membership = await OrganizationMembershipService.upsertOrganizationMembership(
      {
        organizationId: invitation.organizationId,
        personId: accountUid,
        accountId: accountUid,
        memberType: 'employee',
        status: 'active',
        source: 'invitation',
      },
      batch
    );

    // 4. Provision Workspace Membership if invitation has workspace binding
    if (invitation.workspaceId) {
      await WorkspaceMembershipService.upsertWorkspaceMembership(
        {
          organizationId: invitation.organizationId,
          workspaceId: invitation.workspaceId,
          workspaceName: invitation.workspaceName,
          personId: accountUid,
          roleAssignmentIds: invitation.roleIds,
          isPrimary: true,
          status: 'active',
        },
        batch
      );
    }

    // 5. Mark invitation as accepted
    const inviteRef = adminDb.collection('invitations').doc(invitation.id);
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: accountUid,
      acceptedAt: now,
      updatedAt: now,
    });

    // Commit batch
    await batch.commit();

    // 6. Synchronize legacy projection
    await IdentityProjectionService.syncUserProjection(invitation.organizationId, accountUid);

    return { person, membership };
  }

  /**
   * Refreshes token hash, extends expiration, and returns new raw token for resending.
   */
  static async resendInvitation(
    organizationId: string,
    invitationId: string
  ): Promise<{ rawToken: string; expiresAt: string }> {
    if (!organizationId || !invitationId) throw new Error('Missing parameters');

    const inviteRef = adminDb.collection('invitations').doc(invitationId);
    const snap = await inviteRef.get();

    if (!snap.exists) throw new Error('Invitation not found');

    const invite = snap.data() as Invitation;
    if (invite.organizationId !== organizationId) {
      throw new Error('Forbidden: Invitation belongs to different organization');
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await inviteRef.update({
      tokenHash,
      expiresAt,
      status: 'sent',
      'channels.email.status': 'sent',
      'channels.email.dispatchedAt': now,
      updatedAt: now,
    });

    return { rawToken, expiresAt };
  }

  /**
   * Revokes an active or pending invitation.
   */
  static async revokeInvitation(organizationId: string, invitationId: string): Promise<boolean> {
    if (!organizationId || !invitationId) throw new Error('Missing parameters');

    const inviteRef = adminDb.collection('invitations').doc(invitationId);
    const snap = await inviteRef.get();

    if (!snap.exists) return true;

    const invite = snap.data() as Invitation;
    if (invite.organizationId !== organizationId) {
      throw new Error('Forbidden: Invitation belongs to different organization');
    }

    await inviteRef.update({
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Lists invitations for an organization.
   */
  static async listInvitations(
    organizationId: string,
    status?: InvitationStatus
  ): Promise<Invitation[]> {
    if (!organizationId) return [];

    let query: FirebaseFirestore.Query = adminDb
      .collection('invitations')
      .where('organizationId', '==', organizationId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation));
  }
}
