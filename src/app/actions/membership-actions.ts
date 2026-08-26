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
import type {
  PortalMembership,
  PortalInvitation,
  MembershipPlan,
  AccessGrant,
  EntitlementCheckResult,
  CreateMembershipInput,
  UpdateMembershipInput,
  CreateInvitationInput,
  CreatePlanInput,
  UpdatePlanInput,
  GrantAccessInput,
  PortalMemberRole,
  ResourceType,
} from '@/lib/types/membership';

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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create membership.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update member role.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to suspend member.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reactivate member.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete member.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create invitation.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create bulk invitations.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Verification failed.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to accept invitation.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to revoke invitation.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create plan.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update plan.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to archive plan.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Evaluation failed.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to grant access.' };
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to revoke grant.' };
  }
}

export async function listMembershipsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalMembership[]>> {
  try {
    const members = await PortalMembershipService.listMembers(portalId);
    return { success: true, data: members };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list memberships.' };
  }
}

export async function listInvitationsByPortalAction(
  portalId: string
): Promise<ActionResult<PortalInvitation[]>> {
  try {
    const invitations = await PortalInvitationService.listInvitations(portalId);
    return { success: true, data: invitations };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list invitations.' };
  }
}

export async function listPlansByPortalAction(
  portalId: string
): Promise<ActionResult<MembershipPlan[]>> {
  try {
    const plans = await MembershipPlanService.listPortalPlans(portalId, true);
    return { success: true, data: plans };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list plans.' };
  }
}
