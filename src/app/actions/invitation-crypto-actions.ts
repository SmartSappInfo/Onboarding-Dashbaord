'use server';

/**
 * @fileOverview Secure Server Actions for Encrypted Invitation Onboarding Flow
 *
 * Implements server-authoritative validation for encrypted invitation links,
 * accept/decline state transitions, and re-visit routing decisions.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Publicly callable by unauthenticated invitees to inspect welcome cards and accept/decline.
 * - Enforces zero `any` or `any[]` typing.
 * - External parameters are strictly validated with Zod schemas.
 * - Supports both modern AES-256-GCM encrypted tokens and legacy SHA-256 hashed tokens.
 *
 * @testability Covered in `src/lib/services/workforce/__tests__/invitation-crypto-actions.test.ts`.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { InviteCryptoService } from '@/lib/services/crypto/invite-crypto-service';
import { InvitationLifecycleService } from '@/lib/services/workforce/invitation-lifecycle-service';
import { DepartmentService } from '@/lib/services/workforce/department-service';
import type { Invitation } from '@/lib/types';

export type InvitationVerificationState =
  | 'valid'
  | 'already_completed'
  | 'accepted_pending_profile'
  | 'declined'
  | 'expired'
  | 'revoked'
  | 'invalid';

export interface VerifiedInvitationData {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  departmentId?: string;
  departmentName?: string;
  email: string;
  fullName?: string;
  tempPassword?: string;
  workspaceId?: string;
  workspaceName?: string;
  roleIds?: string[];
  roleNames?: string[];
  expiresAt?: string;
}

export interface ValidateInvitationResponse {
  success: boolean;
  state: InvitationVerificationState;
  invitation?: VerifiedInvitationData;
  error?: string;
}

const ValidateTokenInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const DeclineTokenInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  reason: z.string().max(500).optional(),
});

/**
 * Validates an invitation token (AES-256-GCM or legacy raw token)
 * and determines the exact onboarding/re-visit state.
 */
export async function validateEncryptedInvitationAction(
  rawParams: unknown
): Promise<ValidateInvitationResponse> {
  const parseResult = ValidateTokenInputSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return {
      success: false,
      state: 'invalid',
      error: 'Invalid request: missing or malformed token parameter.',
    };
  }

  const { token } = parseResult.data;

  // 1. Attempt decryption via InviteCryptoService (AES-256-GCM)
  const decrypted = InviteCryptoService.decryptInvitePayload(token);

  if (decrypted) {
    const { invitationId, email, organizationId, departmentId } = decrypted;

    // Fetch live invitation doc from Firestore
    let liveInvite: Invitation | null = null;
    if (invitationId) {
      liveInvite = await InvitationLifecycleService.getInvitationById(invitationId);
    }

    // Check live invitation state if found
    if (liveInvite) {
      if (liveInvite.status === 'declined') {
        return {
          success: true,
          state: 'declined',
          invitation: {
            invitationId: liveInvite.id,
            organizationId: liveInvite.organizationId,
            organizationName: decrypted.organizationName,
            departmentId: liveInvite.departmentId || decrypted.departmentId,
            departmentName: decrypted.departmentName,
            email: liveInvite.email,
            fullName: liveInvite.invitedPersonName || decrypted.fullName,
          },
        };
      }

      if (liveInvite.status === 'revoked') {
        return {
          success: true,
          state: 'revoked',
          error: 'This invitation was revoked by your organization administrator.',
        };
      }

      if (liveInvite.status === 'expired' || new Date(liveInvite.expiresAt) <= new Date()) {
        return {
          success: true,
          state: 'expired',
          error: 'This invitation link has expired.',
        };
      }
    }

    // Check if user account already exists and has completed onboarding
    const usersSnap = await adminDb
      .collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const userData = usersSnap.docs[0].data();
      if (userData.profileCompleted === true) {
        return {
          success: true,
          state: 'already_completed',
          invitation: {
            invitationId,
            organizationId,
            organizationName: decrypted.organizationName,
            departmentId,
            departmentName: decrypted.departmentName,
            email,
            fullName: userData.name || decrypted.fullName,
          },
        };
      }
    }

    // If invitation is already marked accepted, but profile is not completed yet
    if (liveInvite && liveInvite.status === 'accepted') {
      return {
        success: true,
        state: 'accepted_pending_profile',
        invitation: {
          invitationId,
          organizationId,
          organizationName: decrypted.organizationName,
          departmentId,
          departmentName: decrypted.departmentName,
          email,
          fullName: decrypted.fullName,
          tempPassword: decrypted.tempPassword,
          workspaceId: decrypted.workspaceId,
          workspaceName: decrypted.workspaceName,
          roleIds: decrypted.roleIds,
          roleNames: decrypted.roleNames,
        },
      };
    }

    // Fresh, valid invitation
    return {
      success: true,
      state: 'valid',
      invitation: {
        invitationId,
        organizationId,
        organizationName: decrypted.organizationName,
        departmentId,
        departmentName: decrypted.departmentName,
        email,
        fullName: decrypted.fullName,
        tempPassword: decrypted.tempPassword,
        workspaceId: decrypted.workspaceId,
        workspaceName: decrypted.workspaceName,
        roleIds: decrypted.roleIds,
        roleNames: decrypted.roleNames,
        expiresAt: new Date(decrypted.exp).toISOString(),
      },
    };
  }

  // 2. Backwards-compatible fallback: check if it's a legacy raw token (SHA-256 hash lookup)
  try {
    const legacyInvite = await InvitationLifecycleService.validateInvitationToken(token);
    if (legacyInvite) {
      let deptName = 'General';
      if (legacyInvite.departmentId) {
        try {
          // Organization-checked: the invite's department id originally came from a request.
          const dept = await DepartmentService.getDepartmentForOrganization(legacyInvite.organizationId, legacyInvite.departmentId);
          if (dept) deptName = dept.name;
        } catch {
          // Fallback to default
        }
      }

      // Check organization name
      const orgSnap = await adminDb
        .collection('organizations')
        .doc(legacyInvite.organizationId)
        .get();
      const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

      return {
        success: true,
        state: 'valid',
        invitation: {
          invitationId: legacyInvite.id,
          organizationId: legacyInvite.organizationId,
          organizationName: orgName,
          departmentId: legacyInvite.departmentId || '',
          departmentName: deptName,
          email: legacyInvite.email,
          fullName: legacyInvite.invitedPersonName,
          workspaceId: legacyInvite.workspaceId,
          workspaceName: legacyInvite.workspaceName,
          roleIds: legacyInvite.roleIds,
          roleNames: legacyInvite.roleNames,
          expiresAt: legacyInvite.expiresAt,
        },
      };
    }
  } catch (legacyErr) {
    console.warn('[validateEncryptedInvitationAction] Legacy token check error:', legacyErr);
  }

  return {
    success: false,
    state: 'invalid',
    error: 'Invitation link is invalid, expired, or has already been used.',
  };
}

/**
 * Marks invitation as accepted on the landing page before routing to login.
 */
export async function acceptInvitationLandingAction(
  rawParams: unknown
): Promise<{ success: boolean; error?: string }> {
  const parseResult = ValidateTokenInputSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid invitation token parameter.' };
  }

  const { token } = parseResult.data;
  const decrypted = InviteCryptoService.decryptInvitePayload(token);

  let invitationId = decrypted?.invitationId;

  // If not an encrypted token, attempt legacy token resolution
  if (!invitationId) {
    const legacy = await InvitationLifecycleService.validateInvitationToken(token);
    if (legacy) invitationId = legacy.id;
  }

  if (!invitationId) {
    return { success: false, error: 'Cannot accept invalid or expired invitation.' };
  }

  try {
    const now = new Date().toISOString();
    await adminDb.collection('invitations').doc(invitationId).update({
      status: 'accepted',
      acceptedAt: now,
      updatedAt: now,
    });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record acceptance';
    return { success: false, error: msg };
  }
}

/**
 * Marks invitation as declined on the landing page when candidate rejects it.
 */
export async function declineInvitationLandingAction(
  rawParams: unknown
): Promise<{ success: boolean; error?: string }> {
  const parseResult = DeclineTokenInputSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid parameters for declining invitation.' };
  }

  const { token, reason } = parseResult.data;
  const decrypted = InviteCryptoService.decryptInvitePayload(token);

  let invitationId = decrypted?.invitationId;

  if (!invitationId) {
    const legacy = await InvitationLifecycleService.validateInvitationToken(token);
    if (legacy) invitationId = legacy.id;
  }

  if (!invitationId) {
    return { success: false, error: 'Cannot decline invalid or expired invitation.' };
  }

  try {
    await InvitationLifecycleService.declineInvitation(invitationId, reason);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record decline';
    return { success: false, error: msg };
  }
}
