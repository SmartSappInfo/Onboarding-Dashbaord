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
import { z } from 'zod';
import { adminDb } from '../firebase-admin';
import { PortalMembershipService } from './portal-membership-service';
import type {
  PortalInvitation,
  CreateInvitationInput,
  PortalMembership,
  PortalMemberRole,
} from '../types/membership';

const INVITATIONS_COLLECTION = 'portal_invitations';

/** Usage fields of a stored invitation, validated before consuming a use. */
const InvitationUsageSchema = z.object({
  status: z.string(),
  usedCount: z.number(),
  maxUses: z.number(),
  expiresAt: z.string().optional(),
});

/** Thrown inside the accept transaction when the invitation can no longer be used. */
class InvitationUnavailableError extends Error {}

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
      /** The accepting user's email, from their verified ID token (never caller-supplied). */
      email: string;
      displayName?: string;
      avatarUrl?: string;
    }
  ): Promise<{ success: boolean; membership?: PortalMembership; error?: string }> {
    const verification = await this.verifyInvitationToken(portalId, token);
    if (!verification.valid || !verification.invitation) {
      return { success: false, error: verification.error || 'Invalid invitation.' };
    }
    const inv = verification.invitation;

    // SECURITY (Round 4 item 6): a targeted invite (it may carry an elevated role) is only valid for
    // the address it was sent to. Email *verification* is deliberately not required: new accounts
    // accept immediately after sign-up, and the token itself was delivered to that address.
    if (inv.email && inv.email.trim().toLowerCase() !== userProfile.email.trim().toLowerCase()) {
      return { success: false, error: 'This invitation was sent to a different email address.' };
    }

    // An existing member keeps their membership and does not consume a use.
    const existing = await PortalMembershipService.getMembership(inv.portalId, userId);
    if (existing) return { success: true, membership: existing };

    // Consume one use atomically. Everything is re-checked INSIDE the transaction: the pre-check above
    // runs outside it, so concurrent accepts could otherwise exceed `maxUses`.
    const invRef = adminDb.collection(INVITATIONS_COLLECTION).doc(inv.id);
    try {
      await adminDb.runTransaction(async t => {
        const doc = await t.get(invRef);
        const current = InvitationUsageSchema.safeParse(doc.exists ? doc.data() : undefined);
        if (!current.success) throw new InvitationUnavailableError('Invitation link is invalid.');
        const { status, usedCount, maxUses, expiresAt } = current.data;
        if (status !== 'pending') throw new InvitationUnavailableError('This invitation is no longer available.');
        if (expiresAt && new Date(expiresAt) < new Date()) throw new InvitationUnavailableError('This invitation link has expired.');
        if (usedCount >= maxUses) {
          throw new InvitationUnavailableError('This invitation link has reached its maximum number of uses.');
        }

        const newUsedCount = usedCount + 1;
        t.update(invRef, {
          usedCount: newUsedCount,
          status: newUsedCount >= maxUses ? 'accepted' : 'pending',
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (err: unknown) {
      if (err instanceof InvitationUnavailableError) return { success: false, error: err.message };
      throw err;
    }

    // Create the membership. The CRM contact link is never caller-supplied (linked via CRM flows only).
    const membership = await PortalMembershipService.createMembership(
      {
        organizationId: inv.organizationId,
        portalId: inv.portalId,
        workspaceIds: inv.workspaceIds,
        userId,
        email: userProfile.email,
        displayName: userProfile.displayName || userProfile.email.split('@')[0],
        avatarUrl: userProfile.avatarUrl,
        role: inv.role,
        planId: inv.planId,
        joinedVia: 'invitation',
      },
      userId
    );

    return { success: true, membership };
  }

  /**
   * Revokes an invitation link.
   */
  static async revokeInvitation(invitationId: string, _actorId: string): Promise<boolean> {
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
