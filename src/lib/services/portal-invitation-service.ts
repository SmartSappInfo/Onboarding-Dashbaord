/**
 * {{Org_name}} Experience Platform — Cryptographic Invitations Engine
 *
 * Manages single-use and multi-use invitation tokens, seat counting,
 * bulk CSV onboarding, auto-expiration, and atomic acceptance transactions.
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Multi-tenant isolation by organizationId and portalId.
 * - Concurrency protection: Multi-use token increments execute inside Firestore transactions.
 */

import crypto from 'crypto';
import { adminDb } from '../firebase-admin';
import { PortalMembershipService } from './portal-membership-service';
import type {
  PortalInvitation,
  CreateInvitationInput,
  PortalMembership,
  PortalMemberRole,
} from '../types/membership';

const INVITATIONS_COLLECTION = 'portal_invitations';

export class PortalInvitationService {
  /**
   * Generates a secure, URL-safe random token.
   */
  static generateToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Creates a single-use or multi-use invitation.
   */
  static async createInvitation(
    input: CreateInvitationInput,
    actorId: string = 'system'
  ): Promise<PortalInvitation> {
    if (!input.organizationId || !input.portalId) {
      throw new Error('organizationId and portalId are required to create an invitation.');
    }

    const docRef = adminDb.collection(INVITATIONS_COLLECTION).doc();
    const now = new Date().toISOString();
    const token = this.generateToken();

    const invitation: PortalInvitation = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['default'],
      email: input.email ? input.email.toLowerCase().trim() : undefined,
      token,
      role: input.role || 'member',
      planId: input.planId,
      assignedCourseIds: input.assignedCourseIds || [],
      maxUses: input.maxUses || (input.email ? 1 : 100),
      usedCount: 0,
      expiresAt: input.expiresAt,
      status: 'pending',
      note: input.note,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(invitation);
    return invitation;
  }

  /**
   * Creates bulk invitations from a list of emails.
   */
  static async createBulkInvitations(
    portalId: string,
    organizationId: string,
    workspaceIds: string[],
    emails: string[],
    role: PortalMemberRole = 'member',
    planId?: string,
    actorId: string = 'system'
  ): Promise<PortalInvitation[]> {
    const createdList: PortalInvitation[] = [];

    for (const email of emails) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) continue;

      const inv = await this.createInvitation(
        {
          portalId,
          organizationId,
          workspaceIds,
          email: cleanEmail,
          role,
          planId,
          maxUses: 1,
        },
        actorId
      );
      createdList.push(inv);
    }

    return createdList;
  }

  /**
   * Verifies an invitation token without consuming it.
   */
  static async verifyInvitationToken(
    portalId: string,
    token: string
  ): Promise<{ valid: boolean; error?: string; invitation?: PortalInvitation }> {
    const snap = await adminDb
      .collection(INVITATIONS_COLLECTION)
      .where('portalId', '==', portalId)
      .where('token', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      return { valid: false, error: 'Invitation link is invalid.' };
    }

    const invitation = snap.docs[0].data() as PortalInvitation;

    if (invitation.status === 'revoked') {
      return { valid: false, error: 'This invitation has been revoked by an administrator.' };
    }

    if (invitation.status === 'expired') {
      return { valid: false, error: 'This invitation link has expired.' };
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return { valid: false, error: 'This invitation link has expired.' };
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return { valid: false, error: 'This invitation link has reached its maximum number of uses.' };
    }

    return { valid: true, invitation };
  }

  /**
   * Accepts an invitation transactionally, increments used count, and creates PortalMembership.
   */
  static async acceptInvitation(
    portalId: string,
    token: string,
    userId: string,
    userProfile: {
      email: string;
      displayName?: string;
      avatarUrl?: string;
      contactId?: string;
    }
  ): Promise<{ success: boolean; membership?: PortalMembership; error?: string }> {
    const verification = await this.verifyInvitationToken(portalId, token);
    if (!verification.valid || !verification.invitation) {
      return { success: false, error: verification.error || 'Invalid invitation.' };
    }

    const inv = verification.invitation;
    const invRef = adminDb.collection(INVITATIONS_COLLECTION).doc(inv.id);

    // Atomically increment and mark accepted if max uses reached
    await adminDb.runTransaction(async t => {
      const doc = await t.get(invRef);
      if (!doc.exists) throw new Error('Invitation missing.');

      const current = doc.data() as PortalInvitation;
      const newUsedCount = current.usedCount + 1;
      const isMaxReached = newUsedCount >= current.maxUses;

      t.update(invRef, {
        usedCount: newUsedCount,
        status: isMaxReached ? 'accepted' : 'pending',
        updatedAt: new Date().toISOString(),
      });
    });

    // Create or retrieve membership
    const membership = await PortalMembershipService.createMembership(
      {
        organizationId: inv.organizationId,
        portalId: inv.portalId,
        workspaceIds: inv.workspaceIds,
        userId,
        contactId: userProfile.contactId,
        email: userProfile.email,
        displayName: userProfile.displayName || userProfile.email.split('@')[0],
        avatarUrl: userProfile.avatarUrl,
        role: inv.role,
        planId: inv.planId,
      },
      userId
    );

    return { success: true, membership };
  }

  /**
   * Revokes an invitation link.
   */
  static async revokeInvitation(invitationId: string, actorId: string): Promise<boolean> {
    const docRef = adminDb.collection(INVITATIONS_COLLECTION).doc(invitationId);
    await docRef.update({
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Lists invitations for a portal.
   */
  static async listInvitations(portalId: string, limitCount: number = 50): Promise<PortalInvitation[]> {
    const snap = await adminDb
      .collection(INVITATIONS_COLLECTION)
      .where('portalId', '==', portalId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map(d => d.data() as PortalInvitation);
  }
}
