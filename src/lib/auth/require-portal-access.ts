/**
 * @fileOverview Server-side identity for Experience Portal server actions (auth hotfix, Phase 1 §1.1a).
 *
 * Portal actions are public HTTP endpoints (Server Actions). Two kinds of caller use them:
 *
 * 1. PORTAL STAFF — SmartSapp users managing a portal from `/admin/portals`. They carry the
 *    `__session` cookie, so identity comes from `requireAuth()`. They may act only on portals of
 *    their own organization (system admins bypass).
 * 2. PORTAL MEMBERS — learners/community members on `/portal/[slug]`. They sign in with Firebase
 *    client auth and do NOT get the staff session cookie (and are usually not `isAuthorized` staff),
 *    so the client passes a Firebase ID token (`await auth.currentUser.getIdToken()`), verified here —
 *    the same pattern as `authorizeBackoffice(idToken, …)`.
 *
 * NEVER accept `userId`, `actorId` or `isOrgAdmin` from the caller: identity is derived here (audit F2).
 */

import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { requireAuth, requireOrganization, ForbiddenError, UnauthorizedError, type AuthContext } from '@/lib/auth/require-auth';
import { PortalService } from '@/lib/services/portal-service';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type { Portal } from '@/lib/types/portal';
import type { PortalMembership } from '@/lib/types/membership';

export { ForbiddenError, UnauthorizedError };

export interface PortalAdminContext {
  auth: AuthContext;
  portal: Portal;
}

export type PortalAdminNeed = 'view' | 'manage' | 'members';

function isRoleAdmin(profile: { role?: string; roles?: string[]; roleNames?: string[] }): boolean {
  const adminRoles = ['admin', 'superadmin', 'administrator', 'system_admin'];
  if (profile.role && adminRoles.includes(profile.role.toLowerCase())) {
    return true;
  }
  if (profile.roles && profile.roles.some((r) => adminRoles.includes(r.toLowerCase()))) {
    return true;
  }
  if (profile.roleNames && profile.roleNames.some((r) => adminRoles.includes(r.toLowerCase()))) {
    return true;
  }
  return false;
}

function hasPortalPermission(
  perms: readonly string[] | undefined,
  need: PortalAdminNeed,
  isRoleAdminUser: boolean
): boolean {
  if (isRoleAdminUser || !perms) {
    return true;
  }
  if (perms.includes('system_admin')) {
    return true;
  }
  const hasManage = perms.includes('portals_manage');
  if (need === 'view') {
    return hasManage || perms.includes('portals_view');
  }
  if (need === 'manage') {
    return hasManage;
  }
  if (need === 'members') {
    return hasManage || perms.includes('portal_members_manage');
  }
  return false;
}

/** Staff caller who may manage this portal: session + same organization (system admins bypass). */
export async function requirePortalAdmin(
  portalId: string,
  need: PortalAdminNeed = 'manage'
): Promise<PortalAdminContext> {
  if (!portalId) throw new ForbiddenError('A portal id is required.');
  const auth = await requireAuth();
  const portal = await PortalService.getPortalById(portalId);
  if (!portal) throw new ForbiddenError('Portal not found.');
  if (!auth.isSystemAdmin && auth.profile.organizationId !== portal.organizationId) {
    throw new ForbiddenError('No access to this portal.');
  }

  if (!auth.isSystemAdmin) {
    const isRoleAdminUser = isRoleAdmin(auth.profile);
    if (!hasPortalPermission(auth.profile.permissions, need, isRoleAdminUser)) {
      throw new ForbiddenError('Insufficient permissions for this portal operation.');
    }
  }

  return { auth, portal };
}

/**
 * Non-throwing staff check for read endpoints that serve both staff and the public
 * (staff see drafts; everyone else sees published content only).
 */
export async function isPortalAdminCaller(
  portalId: string,
  need: PortalAdminNeed = 'view'
): Promise<boolean> {
  return requirePortalAdmin(portalId, need).then(
    () => true,
    () => false
  );
}

export interface PortalViewer {
  /** Verified uid, or null for an anonymous visitor (or an invalid/expired token). */
  userId: string | null;
  /** Staff of the portal's organization — via the admin session OR the viewer's own verified profile. */
  isStaff: boolean;
}

/**
 * Viewer of a PUBLIC read endpoint (catalog, reader, search, entitlement checks). Never throws for a
 * missing/invalid token — the viewer is simply anonymous, so an expired token degrades to the public
 * view instead of breaking the page. Never use this to authorize a write.
 */
export async function resolvePortalViewer(idToken: string | null | undefined, portalId: string): Promise<PortalViewer> {
  if (await isPortalAdminCaller(portalId)) {
    const user = idToken ? await requirePortalUser(idToken).catch(() => null) : null;
    return { userId: user?.uid ?? null, isStaff: true };
  }
  if (!idToken) return { userId: null, isStaff: false };
  const user = await requirePortalUser(idToken).catch(() => null);
  if (!user) return { userId: null, isStaff: false };
  const portal = await PortalService.getPortalById(portalId);
  return { userId: user.uid, isStaff: portal ? await isStaffOfOrganization(user.uid, portal.organizationId) : false };
}

/** Staff caller acting on an organization's portals before a portal exists (create, seed, slug check). */
export async function requirePortalOrganizationAdmin(
  organizationId: string,
  need: 'view' | 'manage' = 'manage'
): Promise<AuthContext & { organizationId: string }> {
  const auth = await requireOrganization(organizationId);
  if (!auth.isSystemAdmin) {
    const isRoleAdminUser = isRoleAdmin(auth.profile);
    if (!hasPortalPermission(auth.profile.permissions, need, isRoleAdminUser)) {
      throw new ForbiddenError('Insufficient permissions for this portal operation.');
    }
  }
  return auth;
}

export interface PortalUserContext {
  uid: string;
  /**
   * The token's email. NOTE: `email_verified` is NOT checked — new portal accounts act immediately after
   * sign-up. Do not treat this as proof of mailbox ownership for anything security-sensitive.
   */
  email: string | null;
}

/** Any signed-in Firebase user (e.g. joining a portal or accepting an invitation). */
export async function requirePortalUser(idToken: string): Promise<PortalUserContext> {
  if (!idToken) throw new UnauthorizedError('Not signed in.');
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new UnauthorizedError('Session expired or invalid. Please sign in again.');
  }
}

export interface PortalMemberContext extends PortalUserContext {
  /** Null when the caller is portal staff acting as a member (preview / moderation). */
  membership: PortalMembership | null;
  isPortalStaff: boolean;
}

/**
 * Signed-in caller who is an ACTIVE member of the portal — or staff of the portal's organization.
 * Staff are resolved from the verified token's own user profile, never from a parameter.
 */
export async function requirePortalMember(idToken: string, portalId: string): Promise<PortalMemberContext> {
  const user = await requirePortalUser(idToken);
  if (!portalId) throw new ForbiddenError('A portal id is required.');

  const membership = await PortalMembershipService.getMembership(portalId, user.uid);
  if (membership && membership.status === 'active') {
    return { ...user, membership, isPortalStaff: false };
  }

  const portal = await PortalService.getPortalById(portalId);
  if (portal && (await isStaffOfOrganization(user.uid, portal.organizationId))) {
    return { ...user, membership: membership ?? null, isPortalStaff: true };
  }

  throw new ForbiddenError(membership ? `Membership is ${membership.status}.` : 'Not a member of this portal.');
}

const StaffProfileSchema = z.object({
  isAuthorized: z.boolean().optional(),
  organizationId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

/** Collections whose documents carry a `portalId` and must stay inside the portal being administered. */
export type PortalScopedCollection =
  | 'portal_memberships'
  | 'membership_plans'
  | 'portal_invitations'
  | 'access_grants'
  | 'courses'
  | 'course_modules'
  | 'course_lessons'
  | 'community_spaces'
  | 'community_posts'
  | 'community_comments'
  | 'moderation_reports'
  | 'member_tasks'
  | 'task_submissions'
  | 'content_items'
  | 'certificate_templates'
  | 'issued_certificates'
  | 'live_events'
  | 'course_cohorts'
  | 'portal_offers'
  | 'portal_coupons'
  | 'affiliate_partners';

const PortalScopedDocSchema = z.object({ portalId: z.string() });

/**
 * Stops an admin of portal A from touching a record of portal B by pairing A's id with B's record id.
 * Call after `requirePortalAdmin(portalId)` / `requirePortalMember(…, portalId)`.
 */
export async function assertRecordInPortal(collection: PortalScopedCollection, recordId: string, portalId: string): Promise<void> {
  if (!recordId) throw new ForbiddenError('A record id is required.');
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection(collection).doc(recordId).get();
  const parsed = PortalScopedDocSchema.safeParse(snap.data());
  if (!snap.exists || !parsed.success || parsed.data.portalId !== portalId) {
    throw new ForbiddenError('Record not found in this portal.');
  }
}

/**
 * Resolves the owning portal of a record, for actions that receive only a record id.
 * Callers still authorize against the returned portal (`requirePortalAdmin`).
 */
export async function portalIdOfRecord(collection: PortalScopedCollection, recordId: string): Promise<string> {
  if (!recordId) throw new ForbiddenError('A record id is required.');
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection(collection).doc(recordId).get();
  const parsed = PortalScopedDocSchema.safeParse(snap.data());
  if (!snap.exists || !parsed.success || !parsed.data.portalId) throw new ForbiddenError('Record not found.');
  return parsed.data.portalId;
}

/** True when the verified uid is approved staff of the organization (or a platform system admin). */
export async function isPortalStaff(uid: string, organizationId: string): Promise<boolean> {
  return isStaffOfOrganization(uid, organizationId);
}

async function isStaffOfOrganization(uid: string, organizationId: string): Promise<boolean> {
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const parsed = StaffProfileSchema.safeParse(snap.data());
  if (!parsed.success || !parsed.data.isAuthorized) return false;
  const profile = parsed.data;
  return Boolean(profile.permissions?.includes('system_admin')) || profile.organizationId === organizationId;
}

/** Maps guard failures to the `{ success: false, error }` shape portal actions already return. */
export function portalAuthErrorMessage(err: unknown): string | null {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return err.message;
  return null;
}
