'use server';

/**
 * @fileOverview Identity & Membership Server Actions (Identity & Access 2.0)
 *
 * Secure server actions for managing canonical people, accounts, organization memberships,
 * workspace access, and multi-channel credential dispatching.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Every server action validates caller ID tokens via `adminAuth.verifyIdToken`.
 * - Multi-tenant isolation: caller must belong to target `organizationId` or possess `system_admin`.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported server actions are verified in end-to-end and unit tests.
 */

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type {
  Person,
  IdentityAccount,
  OrganizationMembership,
  WorkspaceMembership,
  PersonDetailView,
  PeopleDirectoryFilter,
  MembershipStatus,
  UserProfile,
  Role,
  Workspace,
} from '@/lib/types';
import { IdentityAccountService } from '@/lib/services/identity/identity-account-service';
import { PersonService } from '@/lib/services/identity/person-service';
import { OrganizationMembershipService } from '@/lib/services/identity/organization-membership-service';
import { WorkspaceMembershipService } from '@/lib/services/identity/workspace-membership-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';
import { IdentityMigrationService, ReconciliationReport } from '@/lib/services/identity/identity-migration-service';
import { sendEmail } from '@/lib/resend-service';
import { sendSms } from '@/lib/mnotify-service';
import { resolveAndRender } from '@/lib/template-resolver';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import crypto from 'crypto';

interface CallerContext {
  uid: string;
  email: string | null;
  organizationId: string;
  isSystemAdmin: boolean;
  canManageUsers: boolean;
}

/**
 * Helper to verify caller's Firebase ID token and authorize tenant scope.
 */
async function verifyCallerContext(idToken: string, targetOrgId?: string): Promise<CallerContext> {
  if (!idToken) {
    throw new Error('Unauthorized: Missing session token.');
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid session';
    throw new Error(`Unauthorized: ${msg}`);
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email || null;

  // Load user profile
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    if (email === 'admin@smartsapp.com') {
      return {
        uid,
        email,
        organizationId: targetOrgId || 'smartsapp-hq',
        isSystemAdmin: true,
        canManageUsers: true,
      };
    }
    throw new Error('Forbidden: User profile not registered.');
  }

  const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
  if (!profile.isAuthorized && email !== 'admin@smartsapp.com') {
    throw new Error('Forbidden: Account is inactive or pending approval.');
  }

  const isSystemAdmin = Boolean(
    email === 'admin@smartsapp.com' || profile.permissions?.includes('system_admin')
  );

  const canManageUsers = Boolean(
    isSystemAdmin ||
    profile.permissions?.includes('users_manage') ||
    profile.permissions?.includes('management_users') ||
    profile.permissionsSchema?.management?.features?.users?.edit ||
    profile.permissionsSchema?.management?.features?.users?.create
  );

  const orgId = profile.organizationId || targetOrgId || '';

  if (targetOrgId && !isSystemAdmin && orgId !== targetOrgId) {
    throw new Error('Forbidden: Access to requested organization is denied.');
  }

  return {
    uid,
    email,
    organizationId: orgId,
    isSystemAdmin,
    canManageUsers,
  };
}

/**
 * Generates a cryptographically secure random password.
 */
function generateRandomPassword(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars.charAt(bytes[i] % chars.length);
  }
  return password;
}

/**
 * Retrieves people directory with metrics, memberships, and role summaries.
 */
export async function getPeopleDirectoryAction(params: {
  idToken: string;
  organizationId: string;
  filter?: PeopleDirectoryFilter;
}): Promise<{
  success: boolean;
  people: PersonDetailView[];
  metrics: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    workspacesCount: number;
  };
  error?: string;
}> {
  try {
    await verifyCallerContext(params.idToken, params.organizationId);

    // 1. Fetch people and memberships
    let people = await PersonService.listPeopleByOrganization(params.organizationId, params.filter);

    // If no canonical people exist yet, auto-trigger lazy migration for the org
    if (people.length === 0) {
      const usersSnap = await adminDb
        .collection('users')
        .where('organizationId', '==', params.organizationId)
        .get();

      if (!usersSnap.empty) {
        await IdentityMigrationService.reconcileOrganizationIdentities(params.organizationId);
        people = await PersonService.listPeopleByOrganization(params.organizationId, params.filter);
      }
    }

    // 2. Fetch all memberships, workspaces, and roles in parallel
    const [membershipsSnap, wsMembershipsSnap, workspacesSnap, rolesSnap, usersSnap] = await Promise.all([
      adminDb.collection('organization_memberships').where('organizationId', '==', params.organizationId).get(),
      adminDb.collection('workspace_memberships').where('organizationId', '==', params.organizationId).get(),
      adminDb.collection('workspaces').where('organizationId', '==', params.organizationId).get(),
      adminDb.collection('roles').where('organizationId', '==', params.organizationId).get(),
      adminDb.collection('users').where('organizationId', '==', params.organizationId).get(),
    ]);

    const memMap = new Map<string, OrganizationMembership>();
    membershipsSnap.docs.forEach((d) => {
      const mem = { id: d.id, ...d.data() } as OrganizationMembership;
      memMap.set(mem.personId, mem);
    });

    const wsMemMap = new Map<string, WorkspaceMembership[]>();
    wsMembershipsSnap.docs.forEach((d) => {
      const wsMem = { id: d.id, ...d.data() } as WorkspaceMembership;
      const list = wsMemMap.get(wsMem.personId) || [];
      list.push(wsMem);
      wsMemMap.set(wsMem.personId, list);
    });

    const wsMap = new Map<string, string>();
    workspacesSnap.docs.forEach((d) => {
      const ws = d.data() as Workspace;
      wsMap.set(d.id, ws.name || 'Untitled Workspace');
    });

    const rolesMap = new Map<string, string>();
    rolesSnap.docs.forEach((d) => {
      const r = d.data() as Role;
      rolesMap.set(d.id, r.name || 'Role');
    });

    const usersMap = new Map<string, UserProfile>();
    usersSnap.docs.forEach((d) => {
      usersMap.set(d.id, { id: d.id, ...d.data() } as UserProfile);
    });

    // 3. Assemble PersonDetailView array
    const detailViews: PersonDetailView[] = [];

    let totalCount = 0;
    let activeCount = 0;
    let pendingCount = 0;
    let suspendedCount = 0;

    for (const person of people) {
      const membership = memMap.get(person.id) || {
        id: `mem_${params.organizationId}_${person.id}`,
        personId: person.id,
        accountId: person.id,
        organizationId: params.organizationId,
        status: 'active',
        memberType: 'employee',
        source: 'migration',
        createdAt: person.createdAt || new Date().toISOString(),
      };

      const rawWsMems = wsMemMap.get(person.id) || [];
      const enrichedWsMems: WorkspaceMembership[] = rawWsMems.map((w) => ({
        ...w,
        workspaceName: wsMap.get(w.workspaceId) || w.workspaceName || 'Workspace',
        roleNames: (w.roleAssignmentIds || []).map((rId) => rolesMap.get(rId) || rId),
      }));

      const userProfile = usersMap.get(person.id) || {
        id: person.id,
        organizationId: params.organizationId,
        workspaceIds: enrichedWsMems.map((w) => w.workspaceId),
        name: person.displayName,
        email: person.email,
        phone: person.phone || '',
        isAuthorized: membership.status === 'active',
        approvalStatus: membership.status === 'active' ? 'approved' : 'pending',
        createdAt: person.createdAt || new Date().toISOString(),
      };

      const account: IdentityAccount = {
        id: person.id,
        authUid: person.id,
        authProvider: 'firebase',
        email: person.email,
        emailVerified: true,
        phoneVerified: Boolean(person.phone),
        status: membership.status === 'active' ? 'active' : membership.status === 'suspended' ? 'suspended' : 'pending',
        mfaStatus: 'not_enabled',
        createdAt: person.createdAt || new Date().toISOString(),
      };

      totalCount++;
      if (membership.status === 'active') activeCount++;
      else if (membership.status === 'pending' || membership.status === 'invited') pendingCount++;
      else if (membership.status === 'suspended' || membership.status === 'revoked') suspendedCount++;

      // Filter check
      if (params.filter?.status && params.filter.status !== 'all') {
        if (membership.status !== params.filter.status) continue;
      }

      if (params.filter?.workspaceId) {
        if (!enrichedWsMems.some((w) => w.workspaceId === params.filter?.workspaceId)) continue;
      }

      detailViews.push({
        person,
        account,
        membership,
        workspaceMemberships: enrichedWsMems,
        effectivePermissionsSchema: userProfile.permissionsSchema,
        userProfileProjection: userProfile,
      });
    }

    return {
      success: true,
      people: detailViews,
      metrics: {
        total: totalCount,
        active: activeCount,
        pending: pendingCount,
        suspended: suspendedCount,
        workspacesCount: workspacesSnap.size,
      },
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to fetch people directory';
    console.error('[getPeopleDirectoryAction] Error:', err);
    return {
      success: false,
      people: [],
      metrics: { total: 0, active: 0, pending: 0, suspended: 0, workspacesCount: 0 },
      error,
    };
  }
}

/**
 * Retrieves a full PersonDetailView for inspecting/editing a specific person.
 */
export async function getPersonDetailAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
}): Promise<{
  success: boolean;
  detail?: PersonDetailView;
  error?: string;
}> {
  try {
    await verifyCallerContext(params.idToken, params.organizationId);

    // 1. Fetch or lazy-migrate Person
    const person = await IdentityMigrationService.getOrMigratePerson(params.personId, params.organizationId);
    if (!person) {
      return { success: false, error: 'Person not found' };
    }

    // 2. Fetch Account, Membership, and Workspace Memberships
    const [account, membership, wsMems, userProfile] = await Promise.all([
      IdentityAccountService.getAccount(params.personId),
      OrganizationMembershipService.getMembershipByPersonAndOrg(params.organizationId, params.personId),
      WorkspaceMembershipService.listWorkspaceMembershipsByPerson(params.organizationId, params.personId),
      adminDb.collection('users').doc(params.personId).get().then((d) => (d.exists ? ({ id: d.id, ...d.data() } as UserProfile) : null)),
    ]);

    // 3. Hydrate names
    const [workspacesSnap, rolesSnap] = await Promise.all([
      adminDb.collection('workspaces').where('organizationId', '==', params.organizationId).get(),
      adminDb.collection('roles').where('organizationId', '==', params.organizationId).get(),
    ]);

    const wsMap = new Map<string, string>();
    workspacesSnap.docs.forEach((d) => wsMap.set(d.id, d.data().name || 'Workspace'));

    const rolesMap = new Map<string, string>();
    rolesSnap.docs.forEach((d) => rolesMap.set(d.id, d.data().name || 'Role'));

    const enrichedWsMems: WorkspaceMembership[] = wsMems.map((w) => ({
      ...w,
      workspaceName: wsMap.get(w.workspaceId) || w.workspaceName || 'Workspace',
      roleNames: (w.roleAssignmentIds || []).map((rId) => rolesMap.get(rId) || rId),
    }));

    const detail: PersonDetailView = {
      person,
      account: account || {
        id: params.personId,
        authUid: params.personId,
        authProvider: 'firebase',
        email: person.email,
        emailVerified: true,
        phoneVerified: Boolean(person.phone),
        status: membership?.status === 'active' ? 'active' : 'pending',
        mfaStatus: 'not_enabled',
        createdAt: person.createdAt || new Date().toISOString(),
      },
      membership: membership || {
        id: `mem_${params.organizationId}_${params.personId}`,
        personId: params.personId,
        accountId: params.personId,
        organizationId: params.organizationId,
        status: 'active',
        memberType: 'employee',
        source: 'migration',
        createdAt: person.createdAt || new Date().toISOString(),
      },
      workspaceMemberships: enrichedWsMems,
      effectivePermissionsSchema: userProfile?.permissionsSchema,
      userProfileProjection: userProfile || {
        id: params.personId,
        organizationId: params.organizationId,
        workspaceIds: enrichedWsMems.map((w) => w.workspaceId),
        name: person.displayName,
        email: person.email,
        phone: person.phone || '',
        isAuthorized: true,
        createdAt: person.createdAt || new Date().toISOString(),
      },
    };

    return { success: true, detail };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to fetch person details';
    return { success: false, error };
  }
}

/**
 * Updates a Person's profile information and synchronizes the legacy projection.
 */
export async function updatePersonProfileAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
  updates: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    departmentName?: string;
    departmentId?: string;
    jobTitle?: string;
    employeeCode?: string;
    avatarUrl?: string;
    facilitatorRole?: string;
    facilitatorBio?: string;
  };
}): Promise<{
  success: boolean;
  userProfile?: UserProfile;
  error?: string;
}> {
  try {
    const caller = await verifyCallerContext(params.idToken, params.organizationId);

    // Only allow updating other people if caller is an authorized admin
    if (caller.uid !== params.personId && !caller.canManageUsers) {
      throw new Error('Forbidden: You lack permission to update other team members.');
    }

    // 1. Update Person document
    await PersonService.updatePerson(params.personId, params.updates);

    // 2. Sync to legacy UserProfile projection
    const userProfile = await IdentityProjectionService.syncUserProjection(params.organizationId, params.personId);

    return { success: true, userProfile: userProfile || undefined };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to update person profile';
    return { success: false, error };
  }
}

/**
 * Updates organization membership status (Approve, Suspend, Reactivate, Revoke).
 */
export async function updateMembershipStatusAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
  status: MembershipStatus;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const caller = await verifyCallerContext(params.idToken, params.organizationId);
    if (!caller.canManageUsers) {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    // Prevent self-suspension or self-revocation
    if (caller.uid === params.personId && (params.status === 'suspended' || params.status === 'revoked')) {
      throw new Error('Forbidden: You cannot suspend or revoke your own membership.');
    }

    // 1. Update OrganizationMembership
    await OrganizationMembershipService.updateMembershipStatus(params.organizationId, params.personId, params.status);

    // 2. Update Account status
    const accountStatus = params.status === 'active' ? 'active' : params.status === 'suspended' ? 'suspended' : 'pending';
    await IdentityAccountService.updateAccountStatus(params.personId, accountStatus);

    // 3. Re-sync projection
    await IdentityProjectionService.syncUserProjection(params.organizationId, params.personId);

    return { success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to update membership status';
    return { success: false, error };
  }
}

/**
 * Assigns or updates workspace memberships and roles for a Person.
 */
export async function manageWorkspaceMembershipsAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
  memberships: Array<{
    workspaceId: string;
    workspaceName?: string;
    roleAssignmentIds: string[];
    roleNames?: string[];
    isPrimary?: boolean;
  }>;
}): Promise<{
  success: boolean;
  userProfile?: UserProfile;
  error?: string;
}> {
  try {
    const caller = await verifyCallerContext(params.idToken, params.organizationId);
    if (!caller.canManageUsers) {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    const membership = await OrganizationMembershipService.getMembershipByPersonAndOrg(params.organizationId, params.personId);
    const membershipId = membership ? membership.id : OrganizationMembershipService.getMembershipId(params.organizationId, params.personId);

    // 1. Update workspace memberships
    await WorkspaceMembershipService.setWorkspaceMemberships(
      params.organizationId,
      params.personId,
      membershipId,
      params.memberships
    );

    // 2. Re-sync projection
    const userProfile = await IdentityProjectionService.syncUserProjection(params.organizationId, params.personId);

    return { success: true, userProfile: userProfile || undefined };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to update workspace memberships';
    return { success: false, error };
  }
}

/**
 * Multi-Channel Person Invitation Action.
 * Creates canonical entities, generates temporary password, sends notifications, and syncs projection.
 */
export async function invitePersonAction(params: {
  idToken: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  workspaceRoles: Record<string, string[]>;
  sendMethods: ('email' | 'sms')[];
}): Promise<{
  success: boolean;
  userId?: string;
  temporaryPassword?: string;
  deliveryStatus?: { emailSent: boolean; smsSent: boolean };
  error?: string;
}> {
  try {
    const caller = await verifyCallerContext(params.idToken, params.organizationId);
    if (!caller.canManageUsers) {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    const { fullName, email, phone, department, jobTitle, workspaceRoles, sendMethods } = params;
    const tempPassword = generateRandomPassword();
    const loginLink = `${getBaseUrl()}/login`;

    // 1. Fetch organization branding details
    const orgSnap = await adminDb.collection('organizations').doc(params.organizationId).get();
    const orgName = orgSnap.exists ? orgSnap.data()?.name || 'SmartSapp' : 'SmartSapp';

    // 2. Create or verify User in Firebase Auth
    let uid: string;
    try {
      const existingAuth = await adminAuth.getUserByEmail(email);
      uid = existingAuth.uid;
    } catch (authErr: unknown) {
      const isNotFound = (authErr as { code?: string }).code === 'auth/user-not-found';
      if (isNotFound) {
        const newAuth = await adminAuth.createUser({
          email,
          password: tempPassword,
          displayName: fullName,
          phoneNumber: phone || undefined,
          emailVerified: false,
        });
        uid = newAuth.uid;
      } else {
        throw authErr;
      }
    }

    // 3. Prepare Canonical Models
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const wsMemberships = Object.entries(workspaceRoles).map(([wsId, roleIds], idx) => ({
      workspaceId: wsId,
      roleAssignmentIds: roleIds,
      isPrimary: idx === 0,
    }));

    await IdentityProjectionService.atomicCreateUserIdentity({
      account: {
        id: uid,
        authUid: uid,
        authProvider: 'firebase',
        email,
        emailVerified: false,
        phoneVerified: Boolean(phone),
        status: 'active',
        mfaStatus: 'not_enabled',
      },
      person: {
        id: uid,
        organizationId: params.organizationId,
        firstName,
        lastName,
        displayName: fullName,
        email,
        phone: phone || '',
        departmentName: department || undefined,
        jobTitle: jobTitle || undefined,
      },
      membership: {
        personId: uid,
        accountId: uid,
        organizationId: params.organizationId,
        status: 'active',
        memberType: 'employee',
        departmentName: department || undefined,
        source: 'invitation',
        invitedBy: caller.uid,
      },
      workspaceMemberships: wsMemberships,
      requiresPasswordReset: true,
    });

    // 4. Dispatch Multi-Channel Notifications
    let emailSent = false;
    let smsSent = false;

    const emailTemplate = await resolveAndRender('users', 'user_invitation', params.organizationId, {
      fullName,
      email,
      temporaryPassword: tempPassword,
      loginLink,
      orgName,
    });

    const smsTemplate = await resolveAndRender('users', 'user_invitation_sms', params.organizationId, {
      fullName,
      temporaryPassword: tempPassword,
      loginLink,
      orgName,
    });

    const emailHtml = emailTemplate?.body || `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827;">Welcome to ${orgName}</h2>
        <p style="color: #374151;">Hello ${fullName},</p>
        <p style="color: #374151;">You have been invited to join the ${orgName} workspace on SmartSapp.</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0; color: #4b5563;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        <p><a href="${loginLink}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Log In to SmartSapp</a></p>
        <p style="color: #6b7280; font-size: 14px;">You will be prompted to change your temporary password upon your first sign in.</p>
      </div>
    `;

    const smsBody = smsTemplate?.body || `Hello ${fullName}, you've been invited to ${orgName}. Login at ${loginLink} with email: ${email} and Temp Password: ${tempPassword}`;

    const promises: Promise<unknown>[] = [];

    if (sendMethods.includes('email')) {
      promises.push(
        sendEmail({
          to: email,
          subject: emailTemplate?.subject || `Invitation to join ${orgName} on SmartSapp`,
          html: emailHtml,
          from: 'SmartSapp <noreply@smartsapp.com>',
        }).then((res) => {
          if (res.success) emailSent = true;
        })
      );
    }

    if (sendMethods.includes('sms') && phone) {
      promises.push(
        sendSms({
          to: phone,
          message: smsBody,
          organizationId: params.organizationId,
        }).then((res) => {
          if (res.success) smsSent = true;
        })
      );
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    return {
      success: true,
      userId: uid,
      temporaryPassword: tempPassword,
      deliveryStatus: { emailSent, smsSent },
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to invite team member';
    console.error('[invitePersonAction] Error:', err);
    return { success: false, error };
  }
}

/**
 * Reconciles an organization's legacy UserProfile documents into canonical Identity 2.0 entities.
 */
export async function reconcileOrganizationIdentitiesAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  report?: ReconciliationReport;
  error?: string;
}> {
  try {
    const caller = await verifyCallerContext(params.idToken, params.organizationId);
    if (!caller.canManageUsers) {
      throw new Error('Forbidden: Administrative privileges required.');
    }

    const report = await IdentityMigrationService.reconcileOrganizationIdentities(params.organizationId);
    return { success: true, report };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Failed to reconcile organization identities';
    return { success: false, error };
  }
}
