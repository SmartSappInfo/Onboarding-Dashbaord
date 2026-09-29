'use server';

/**
 * {{Org_name}} Experience Platform — Membership, Invitations & Entitlements Server Actions
 *
 * Strongly typed Next.js Server Actions invoking domain services and triggering
 * path revalidations for the visual studio and personal runtime dashboards.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): these are public endpoints.
 * - Studio (staff) actions: `requirePortalAdmin(portalId)` + `assertRecordInPortal` for record ids.
 * - Member actions: the client passes a Firebase ID token; identity and email come from it.
 * - `verifyInvitationTokenAction` stays public (the token is the secret).
 * No action accepts `actorId`, `userId` or `isOrgAdmin` from the caller any more.
 */

import { revalidatePath } from 'next/cache';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { PortalInvitationService } from '@/lib/services/portal-invitation-service';
import { MembershipPlanService } from '@/lib/services/membership-plan-service';
import { EntitlementService } from '@/lib/services/entitlement-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  isPortalStaff,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
  requirePortalUser,
  resolvePortalViewer,
} from '@/lib/auth/require-portal-access';
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

// Standard action response envelope
export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Auth failures surface their own message; everything else stays opaque (audit F9). */
function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.membership-actions', err, undefined, fallback) };
}

// ── 1. Membership Actions ───────────────────────────────────────────────────

/** Staff add a member manually. Members self-join via `joinPortalDirectAction`. */
export async function createMembershipAction(
  input: CreateMembershipInput
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth, portal } = await requirePortalAdmin(input.portalId);
    const membership = await PortalMembershipService.createMembership(
      { ...input, organizationId: portal.organizationId },
      auth.uid
    );
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: membership };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] createMembership failed:', err);
    return failure(err, 'Failed to create membership.');
  }
}

export async function updateMembershipRoleAction(
  membershipId: string,
  role: PortalMemberRole,
  portalId: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    const updated = await PortalMembershipService.updateRole(membershipId, role, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateRole failed:', err);
    return failure(err, 'Failed to update member role.');
  }
}

export async function suspendMembershipAction(
  membershipId: string,
  portalId: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    const updated = await PortalMembershipService.suspendMembership(membershipId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] suspendMembership failed:', err);
    return failure(err, 'Failed to suspend member.');
  }
}

export async function reactivateMembershipAction(
  membershipId: string,
  portalId: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    const updated = await PortalMembershipService.reactivateMembership(membershipId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] reactivateMembership failed:', err);
    return failure(err, 'Failed to reactivate member.');
  }
}

export async function deleteMembershipAction(
  membershipId: string,
  portalId: string
): Promise<ActionResult<boolean>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    await PortalMembershipService.deleteMembership(membershipId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] deleteMembership failed:', err);
    return failure(err, 'Failed to delete member.');
  }
}

/**
 * Updates a portal member's public/professional profile.
 * Automatically synchronizes custom fields and triggers 'complete_profile' onboarding advance.
 */
export async function updatePortalMemberProfileAction(
  idToken: string,
  input: Omit<UpdateMemberProfileInput, 'userId'>,
  portalSlug?: string
): Promise<ActionResult<PortalMembership>> {
  try {
    // A member may only edit their own profile: the userId comes from the verified token.
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const updated = await PortalMembershipService.updateMemberProfile({ ...input, userId: uid });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updatePortalMemberProfile failed:', err);
    return failure(err, 'Failed to update member profile.');
  }
}

/**
 * Updates a member's assigned Membership Plan tier.
 */
export async function updateMembershipPlanAction(
  membershipId: string,
  planId: string | undefined,
  planName: string | undefined,
  portalId: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    if (planId) await assertRecordInPortal('membership_plans', planId, portalId);
    const updated = await PortalMembershipService.updateMembership(
      membershipId,
      { planId, planName },
      auth.uid
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateMembershipPlan failed:', err);
    return failure(err, 'Failed to update member plan.');
  }
}

/**
 * Updates a member's contact/experience tags.
 */
export async function updateMembershipTagsAction(
  membershipId: string,
  tags: string[],
  portalId: string
): Promise<ActionResult<PortalMembership>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_memberships', membershipId, portalId);
    const updated = await PortalMembershipService.updateMembership(
      membershipId,
      { tags },
      auth.uid
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: updated };
  } catch (err) {
    console.error('[MEMBERSHIP_ACTION] updateMembershipTags failed:', err);
    return failure(err, 'Failed to update member tags.');
  }
}

// ── 2. Invitations Actions ──────────────────────────────────────────────────

export async function createInvitationAction(
  input: CreateInvitationInput
): Promise<ActionResult<PortalInvitation>> {
  try {
    const { auth, portal } = await requirePortalAdmin(input.portalId);
    const invitation = await PortalInvitationService.createInvitation(
      { ...input, organizationId: portal.organizationId },
      auth.uid
    );
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: invitation };
  } catch (err) {
    console.error('[INVITATION_ACTION] createInvitation failed:', err);
    return failure(err, 'Failed to create invitation.');
  }
}

export async function createBulkInvitationsAction(
  portalId: string,
  _organizationId: string,
  workspaceIds: string[],
  emails: string[],
  role: PortalMemberRole = 'member',
  planId?: string
): Promise<ActionResult<PortalInvitation[]>> {
  try {
    // The organization is taken from the portal, never from the caller.
    const { auth, portal } = await requirePortalAdmin(portalId);
    if (planId) await assertRecordInPortal('membership_plans', planId, portalId);
    const created = await PortalInvitationService.createBulkInvitations(
      portalId,
      portal.organizationId,
      workspaceIds,
      emails,
      role,
      planId,
      auth.uid
    );
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: created };
  } catch (err) {
    console.error('[INVITATION_ACTION] createBulkInvitations failed:', err);
    return failure(err, 'Failed to create bulk invitations.');
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
  idToken: string,
  portalId: string,
  token: string,
  userProfile: {
    displayName?: string;
    avatarUrl?: string;
  }
): Promise<ActionResult<PortalMembership>> {
  try {
    // The accepting user and their email come from the verified token, not the caller.
    const { uid, email } = await requirePortalUser(idToken);
    if (!email) return { success: false, error: 'Your account needs an email address to accept an invitation.' };
    // Only display fields are taken from the caller; the CRM contact link is never caller-supplied.
    const res = await PortalInvitationService.acceptInvitation(portalId, token, uid, {
      email,
      displayName: userProfile.displayName,
      avatarUrl: userProfile.avatarUrl,
    });
    if (!res.success || !res.membership) {
      return { success: false, error: res.error || 'Failed to accept invitation.' };
    }
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: res.membership };
  } catch (err) {
    console.error('[INVITATION_ACTION] acceptInvitation failed:', err);
    return failure(err, 'Failed to accept invitation.');
  }
}

/**
 * Server action to join a portal directly (self-registration for open/public portals).
 * Provisions or retrieves an active member record and updates portal stats.
 */
export async function joinPortalDirectAction(
  idToken: string,
  portalId: string,
  userProfile: {
    displayName?: string;
    avatarUrl?: string;
    role?: PortalMemberRole;
    joinedVia?: 'smart_onboarding' | 'direct_join' | 'invitation' | 'manual_admin_grant';
  }
): Promise<ActionResult<PortalMembership>> {
  try {
    // Identity and email come from the verified Firebase ID token (was a caller-supplied userId).
    const { uid: userId, email: tokenEmail } = await requirePortalUser(idToken);
    if (!portalId || !tokenEmail) {
      return { success: false, error: 'Portal ID and an account email are required.' };
    }
    const email = tokenEmail;

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
    // CAUTION: a self-joining user gets the portal's default role. Any other requested role
    // (admin, owner, instructor, moderator…) requires the verified user to be staff of the
    // portal's organization.
    const fallbackRole: PortalMemberRole = portal.accessPolicy?.defaultMemberRole || 'member';
    let assignedRole: PortalMemberRole = userProfile.role || fallbackRole;
    if (assignedRole !== fallbackRole && !(await isPortalStaff(userId, portal.organizationId))) {
      assignedRole = fallbackRole;
    }

    const membership = await PortalMembershipService.createMembership({
      organizationId: portal.organizationId,
      portalId,
      workspaceIds: portal.workspaceIds,
      userId,
      email: email.toLowerCase().trim(),
      displayName: userProfile.displayName || email.split('@')[0],
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
    return failure(err, 'Failed to join portal.');
  }
}

export async function revokeInvitationAction(
  invitationId: string,
  portalId: string
): Promise<ActionResult<boolean>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_invitations', invitationId, portalId);
    await PortalInvitationService.revokeInvitation(invitationId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[INVITATION_ACTION] revokeInvitation failed:', err);
    return failure(err, 'Failed to revoke invitation.');
  }
}

// ── 3. Membership Plans Actions ─────────────────────────────────────────────

export async function createPlanAction(
  input: CreatePlanInput
): Promise<ActionResult<MembershipPlan>> {
  try {
    const { auth, portal } = await requirePortalAdmin(input.portalId);
    const plan = await MembershipPlanService.createPlan({ ...input, organizationId: portal.organizationId }, auth.uid);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] createPlan failed:', err);
    return failure(err, 'Failed to create plan.');
  }
}

export async function updatePlanAction(
  planId: string,
  input: UpdatePlanInput,
  portalId: string
): Promise<ActionResult<MembershipPlan>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('membership_plans', planId, portalId);
    const plan = await MembershipPlanService.updatePlan(planId, input, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] updatePlan failed:', err);
    return failure(err, 'Failed to update plan.');
  }
}

export async function archivePlanAction(
  planId: string,
  portalId: string
): Promise<ActionResult<MembershipPlan>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('membership_plans', planId, portalId);
    const plan = await MembershipPlanService.archivePlan(planId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: plan };
  } catch (err) {
    console.error('[PLAN_ACTION] archivePlan failed:', err);
    return failure(err, 'Failed to archive plan.');
  }
}

// ── 4. Entitlements & Access Grant Actions ──────────────────────────────────

export async function checkEntitlementAction(
  idToken: string | null,
  portalId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<ActionResult<EntitlementCheckResult>> {
  try {
    // Anonymous visitors pass null. Signed-in identity and org-admin status are derived server-side
    // (they used to be caller-supplied, letting anyone claim isOrgAdmin=true).
    const viewer = await resolvePortalViewer(idToken, portalId);
    const result = await EntitlementService.evaluateEntitlement(
      portalId,
      viewer.userId,
      resourceType,
      resourceId,
      viewer.isStaff
    );
    return { success: true, data: result };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] checkEntitlement failed:', err);
    return failure(err, 'Evaluation failed.');
  }
}

export async function grantAccessAction(
  input: GrantAccessInput
): Promise<ActionResult<AccessGrant>> {
  try {
    const { auth } = await requirePortalAdmin(input.portalId);
    const grant = await EntitlementService.grantAccess(input, auth.uid);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: grant };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] grantAccess failed:', err);
    return failure(err, 'Failed to grant access.');
  }
}

export async function revokeAccessAction(
  grantId: string,
  portalId: string
): Promise<ActionResult<boolean>> {
  try {
    const { auth } = await requirePortalAdmin(portalId);
    await assertRecordInPortal('access_grants', grantId, portalId);
    await EntitlementService.revokeAccess(grantId, auth.uid);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err) {
    console.error('[ENTITLEMENT_ACTION] revokeAccess failed:', err);
    return failure(err, 'Failed to revoke grant.');
  }
}

export async function listMembershipsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalMembership[]>> {
  try {
    await requirePortalAdmin(portalId);
    const members = await PortalMembershipService.listMembers(portalId);
    return { success: true, data: members };
  } catch (err) {
    return failure(err, 'Failed to list memberships.');
  }
}

export async function listInvitationsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalInvitation[]>> {
  try {
    await requirePortalAdmin(portalId);
    const invitations = await PortalInvitationService.listInvitations(portalId);
    return { success: true, data: invitations };
  } catch (err) {
    return failure(err, 'Failed to list invitations.');
  }
}

export async function listPlansByPortalAction(
  portalId: string
): Promise<ActionResult<MembershipPlan[]>> {
  try {
    await requirePortalAdmin(portalId);
    const plans = await MembershipPlanService.listPortalPlans(portalId, true);
    return { success: true, data: plans };
  } catch (err) {
    return failure(err, 'Failed to list plans.');
  }
}

