'use server';

/**
 * {{Org_name}} Experience Platform — Membership, Invitations & Entitlements Server Actions
 *
 * Strongly typed Next.js Server Actions invoking domain services and triggering
 * path revalidations for the visual studio and personal runtime dashboards.
 */

import { revalidatePath } from 'next/cache';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { PortalInvitationService } from '@/lib/services/portal-invitation-service';
import { MembershipPlanService } from '@/lib/services/membership-plan-service';
import { EntitlementService } from '@/lib/services/entitlement-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type {
  PortalMembership,
  PortalInvitation,
  MembershipPlan,
  AccessGrant,
  EntitlementCheckResult,
  CreateMembershipInput,
  CreateInvitationInput,
  CreatePlanInput,
  UpdatePlanInput,
  GrantAccessInput,
  PortalMemberRole,
  ResourceType,
} from '@/lib/types/membership';
import type { UpdateMemberProfileInput } from '@/lib/types/engagement';
import type { ContentItem } from '@/lib/types/content';

// Standard action response envelope
export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── 1. Membership Actions ───────────────────────────────────────────────────

export async function createMembershipAction(
  input: CreateMembershipInput,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const membership = await PortalMembershipService.createMembership(input, actorId);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: membership };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] createMembership failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to create membership.') };
  }
}

export async function updateMembershipRoleAction(
  membershipId: string,
  role: PortalMemberRole,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.updateRole(membershipId, role, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateRole failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to update member role.') };
  }
}

export async function suspendMembershipAction(
  membershipId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.suspendMembership(membershipId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] suspendMembership failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to suspend member.') };
  }
}

export async function reactivateMembershipAction(
  membershipId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.reactivateMembership(membershipId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] reactivateMembership failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to reactivate member.') };
  }
}

export async function deleteMembershipAction(
  membershipId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<boolean>> {
  try {
    await PortalMembershipService.deleteMembership(membershipId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] deleteMembership failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to delete member.') };
  }
}

/**
 * Updates a portal member's public/professional profile.
 * Automatically synchronizes custom fields and triggers 'complete_profile' onboarding advance.
 */
export async function updatePortalMemberProfileAction(
  input: UpdateMemberProfileInput,
  portalSlug?: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.updateMemberProfile(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updatePortalMemberProfile failed:', err);
    return {
      success: false,
      error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to update member profile.'),
    };
  }
}

/**
 * Updates a member's assigned Membership Plan tier.
 */
export async function updateMembershipPlanAction(
  membershipId: string,
  planId: string | undefined,
  planName: string | undefined,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.updateMembership(
      membershipId,
      { planId, planName },
      actorId
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateMembershipPlan failed:', err);
    return {
      success: false,
      error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to update member plan.'),
    };
  }
}

/**
 * Updates a member's contact/experience tags.
 */
export async function updateMembershipTagsAction(
  membershipId: string,
  tags: string[],
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalMembership>> {
  try {
    const updated = await PortalMembershipService.updateMembership(
      membershipId,
      { tags },
      actorId
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateMembershipTags failed:', err);
    return {
      success: false,
      error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to update member tags.'),
    };
  }
}

// ── 2. Invitations Actions ──────────────────────────────────────────────────

export async function createInvitationAction(
  input: CreateInvitationInput,
  actorId: string = 'system'
): Promise<ActionResult<PortalInvitation>> {
  try {
    const invitation = await PortalInvitationService.createInvitation(input, actorId);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: invitation };
  } catch (err) {
    console.error('[INVITATION_ACTION] createInvitation failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to create invitation.') };
  }
}

export async function createBulkInvitationsAction(
  portalId: string,
  organizationId: string,
  workspaceIds: string[],
  emails: string[],
  role: PortalMemberRole = 'member',
  planId?: string,
  actorId: string = 'system'
): Promise<ActionResult<PortalInvitation[]>> {
  try {
    const created = await PortalInvitationService.createBulkInvitations(
      portalId,
      organizationId,
      workspaceIds,
      emails,
      role,
      planId,
      actorId
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: created };
  } catch (err) {
    console.error('[INVITATION_ACTION] createBulkInvitations failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to create bulk invitations.') };
  }
}

export async function verifyInvitationTokenAction(
  portalId: string,
  token: string
): Promise<ActionResult<PortalInvitation>> {
  try {
    const res = await PortalInvitationService.verifyInvitationToken(portalId, token);
    if (!res.valid || !res.invitation) {
      return { success: false, error: res.error || 'Invalid or expired invitation.' };
    }
    return { success: true, data: res.invitation };
  } catch (err) {
    console.error('[INVITATION_ACTION] verifyToken failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Verification failed.') };
  }
}

export async function acceptInvitationAction(
  portalId: string,
  token: string,
  userId: string,
  userProfile: {
    email: string;
    displayName?: string;
    avatarUrl?: string;
    contactId?: string;
  }
): Promise<ActionResult<PortalMembership>> {
  try {
    const res = await PortalInvitationService.acceptInvitation(portalId, token, userId, userProfile);
    if (!res.success || !res.membership) {
      return { success: false, error: res.error || 'Failed to accept invitation.' };
    }
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: res.membership };
  } catch (err) {
    console.error('[INVITATION_ACTION] acceptInvitation failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to accept invitation.') };
  }
}

/**
 * Server action to join a portal directly (self-registration for open/public portals).
 * Provisions or retrieves an active member record and updates portal stats.
 */
export async function joinPortalDirectAction(
  portalId: string,
  userId: string,
  userProfile: {
    email: string;
    displayName?: string;
    avatarUrl?: string;
    role?: PortalMemberRole;
    joinedVia?: 'smart_onboarding' | 'direct_join' | 'invitation' | 'manual_admin_grant';
  }
): Promise<ActionResult<PortalMembership>> {
  try {
    if (!portalId || !userId || !userProfile.email) {
      return { success: false, error: 'Portal ID, User ID, and email are required.' };
    }

    const { PortalService } = await import('@/lib/services/portal-service');
    const portal = await PortalService.getPortalById(portalId);
    if (!portal) {
      return { success: false, error: 'Portal not found.' };
    }

    // Check if membership already exists for this user in this portal (idempotency guard)
    const existing = await PortalMembershipService.getMembership(portalId, userId);
    if (existing) {
      return { success: true, data: existing };
    }

    // Access Policy Verification:
    // If instant team join is explicitly turned off for this portal and smart onboarding was requested
    if (userProfile.joinedVia === 'smart_onboarding' && portal.accessPolicy?.allowInstantTeamJoin === false) {
      return { success: false, error: 'Instant team onboarding is disabled for this portal.' };
    }

    // Verify portal allows public access or registration
    if (portal.accessPolicy.visibility === 'invite_only') {
      return { success: false, error: 'This portal requires an invitation to join.' };
    }

    // Role assignment with security elevation check:
    // CAUTION: Client cannot self-promote to 'admin' or 'owner' without server-side validation against users/{userId}
    const fallbackRole: PortalMemberRole = portal.accessPolicy?.defaultMemberRole || 'member';
    let assignedRole: PortalMemberRole = userProfile.role || fallbackRole;

    if (assignedRole === 'admin' || assignedRole === 'owner') {
      const { adminDb } = await import('@/lib/firebase-admin');
      const userSnap = await adminDb.collection('users').doc(userId).get();
      const userData = userSnap.data();
      const isSystemAdmin = userData?.role === 'admin' || userData?.roles?.includes('admin');
      if (!isSystemAdmin) {
        assignedRole = fallbackRole;
      }
    }

    const membership = await PortalMembershipService.createMembership({
      organizationId: portal.organizationId,
      portalId,
      workspaceIds: portal.workspaceIds,
      userId,
      email: userProfile.email.toLowerCase().trim(),
      displayName: userProfile.displayName || userProfile.email.split('@')[0],
      avatarUrl: userProfile.avatarUrl,
      role: assignedRole,
      status: 'active',
      joinedVia: userProfile.joinedVia || 'direct_join',
    });

    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/${portal.slug}`);
    revalidatePath(`/portal/${portal.slug}/dashboard`);

    return { success: true, data: membership };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] joinPortalDirectAction failed:', err);
    return {
      success: false,
      error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to join portal.'),
    };
  }
}

export async function revokeInvitationAction(
  invitationId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<boolean>> {
  try {
    await PortalInvitationService.revokeInvitation(invitationId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[INVITATION_ACTION] revokeInvitation failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to revoke invitation.') };
  }
}

// ── 3. Membership Plans Actions ─────────────────────────────────────────────

export async function createPlanAction(
  input: CreatePlanInput,
  actorId: string = 'system'
): Promise<ActionResult<MembershipPlan>> {
  try {
    const plan = await MembershipPlanService.createPlan(input, actorId);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] createPlan failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to create plan.') };
  }
}

export async function updatePlanAction(
  planId: string,
  input: UpdatePlanInput,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<MembershipPlan>> {
  try {
    const plan = await MembershipPlanService.updatePlan(planId, input, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] updatePlan failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to update plan.') };
  }
}

export async function archivePlanAction(
  planId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<MembershipPlan>> {
  try {
    const plan = await MembershipPlanService.archivePlan(planId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] archivePlan failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to archive plan.') };
  }
}

// ── 4. Entitlements & Access Grant Actions ──────────────────────────────────

export async function checkEntitlementAction(
  portalId: string,
  userId: string | null | undefined,
  resourceType: ResourceType,
  resourceId: string,
  isOrgAdmin: boolean = false
): Promise<ActionResult<EntitlementCheckResult>> {
  try {
    const result = await EntitlementService.evaluateEntitlement(
      portalId,
      userId,
      resourceType,
      resourceId,
      isOrgAdmin
    );
    return { success: true, data: result };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] checkEntitlement failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Evaluation failed.') };
  }
}

export async function grantAccessAction(
  input: GrantAccessInput,
  actorId: string = 'system'
): Promise<ActionResult<AccessGrant>> {
  try {
    const grant = await EntitlementService.grantAccess(input, actorId);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: grant };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] grantAccess failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to grant access.') };
  }
}

export async function revokeAccessAction(
  grantId: string,
  portalId: string,
  actorId: string = 'system'
): Promise<ActionResult<boolean>> {
  try {
    await EntitlementService.revokeAccess(grantId, actorId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] revokeAccess failed:', err);
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to revoke grant.') };
  }
}

export async function listMembershipsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalMembership[]>> {
  try {
    const members = await PortalMembershipService.listMembers(portalId);
    return { success: true, data: members };
  } catch (err) {
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to list memberships.') };
  }
}

export async function listInvitationsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalInvitation[]>> {
  try {
    const invitations = await PortalInvitationService.listInvitations(portalId);
    return { success: true, data: invitations };
  } catch (err) {
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to list invitations.') };
  }
}

export async function listPlansByPortalAction(
  portalId: string
): Promise<ActionResult<MembershipPlan[]>> {
  try {
    const plans = await MembershipPlanService.listPortalPlans(portalId, true);
    return { success: true, data: plans };
  } catch (err) {
    return { success: false, error: toClientErrorMessage('actions.membership-actions', err, undefined, 'Failed to list plans.') };
  }
}

export interface ContentAccessEvaluationResult {
  access: EntitlementCheckResult;
  sanitizedItem: ContentItem;
}

/**
 * Server Action evaluating a visitor's access to a content item and returning
 * a sanitized item projection (blocks truncated if access is denied).
 */
export async function evaluateContentAccessAction(
  item: ContentItem,
  userId: string | null | undefined,
  portalId: string,
  isOrgAdmin: boolean = false
): Promise<ActionResult<ContentAccessEvaluationResult>> {
  try {
    const access = await EntitlementService.evaluateContentItemAccess(
      item,
      userId,
      portalId,
      isOrgAdmin
    );
    const sanitizedItem = EntitlementService.sanitizeContentItemForVisitor(item, access);
    return {
      success: true,
      data: {
        access,
        sanitizedItem,
      },
    };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] evaluateContentAccessAction failed:', err);
    return {
      success: false,
      error: toClientErrorMessage(
        'actions.membership-actions',
        err,
        undefined,
        'Failed to evaluate content access.'
      ),
    };
  }
}
