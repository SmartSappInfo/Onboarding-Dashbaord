'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';

import type { AuditActor } from './backoffice-types';
import type { Organization } from '../types';

// ─────────────────────────────────────────────────
// Backoffice Organization Server Actions
// Extends existing organization-actions.ts with
// backoffice-specific operations and audit logging.
// ─────────────────────────────────────────────────

/** Provisioning join token lifetime: 7 days. Re-share mints a fresh token. */
const JOIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lists all organizations with computed stats.
 */
export async function listAllOrganizations(): Promise<{
  success: boolean;
  data?: (Organization & {
    workspaceCount: number;
    userCount: number;
    activeUsers: number;
  })[];
  error?: string;
}> {
  try {
    const [orgsSnap, workspacesSnap, usersSnap] = await Promise.all([
      adminDb.collection('organizations').orderBy('name', 'asc').get(),
      adminDb.collection('workspaces').get(),
      adminDb.collection('users').get(),
    ]);

    const orgs = orgsSnap.docs.map((doc) => {
      const data = doc.data() as Organization;
      const orgId = doc.id;

      // Count workspaces and users for this org
      const workspaceCount = workspacesSnap.docs.filter(
        (w) => w.data().organizationId === orgId
      ).length;

      const orgUsers = usersSnap.docs.filter(
        (u) => u.data().organizationId === orgId
      );
      const userCount = orgUsers.length;
      const activeUsers = orgUsers.filter(
        (u) => u.data().isAuthorized !== false
      ).length;

      return {
        ...data,
        id: orgId,
        workspaceCount,
        userCount,
        activeUsers,
      };
    });

    return { success: true, data: orgs };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] listAllOrganizations failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets detailed information about a single organization.
 */
export async function getOrganizationDetail(orgId: string): Promise<{
  success: boolean;
  data?: Organization & {
    workspaceCount: number;
    userCount: number;
    activeUsers: number;
    entityCount: number;
  };
  error?: string;
}> {
  try {
    const [orgSnap, workspacesSnap, usersSnap, entitiesSnap] = await Promise.all([
      adminDb.collection('organizations').doc(orgId).get(),
      adminDb.collection('workspaces').where('organizationId', '==', orgId).get(),
      adminDb.collection('users').where('organizationId', '==', orgId).get(),
      adminDb.collection('entities').where('organizationId', '==', orgId).get(),
    ]);

    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const data = orgSnap.data() as Organization;
    const orgUsers = usersSnap.docs;

    return {
      success: true,
      data: {
        ...data,
        id: orgId,
        workspaceCount: workspacesSnap.size,
        userCount: orgUsers.length,
        activeUsers: orgUsers.filter((u) => u.data().isAuthorized !== false).length,
        entityCount: entitiesSnap.size,
      },
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] getOrganizationDetail failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Suspends an organization — all workspace access is blocked.
 * Requires elevated confirmation (dangerous action).
 */
export async function suspendOrganization(
  orgId: string,
  reason: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      status: 'suspended',
      suspendedAt: new Date().toISOString(),
      suspendedBy: actor.userId,
      suspensionReason: reason,
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.suspend', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
      metadata: { reason },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] suspendOrganization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restores a suspended organization.
 */
export async function restoreOrganization(
  orgId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      status: 'active',
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      updatedAt: new Date().toISOString(),
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.restore', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] restoreOrganization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates organization details from the backoffice.
 * Wraps the update with audit logging.
 */
export async function updateOrganizationFromBackoffice(
  orgId: string,
  updates: Partial<Organization>,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const before = createAuditSnapshot(orgSnap.data() as Record<string, unknown>);

    await adminDb.collection('organizations').doc(orgId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await adminDb.collection('organizations').doc(orgId).get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'organization.update', 'organization', orgId, {
      scope: 'organization',
      scopeId: orgId,
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] updateOrganizationFromBackoffice failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets diagnostic information for an organization.
 * Used for health checks and support troubleshooting.
 */
export async function getOrganizationDiagnostics(orgId: string): Promise<{
  success: boolean;
  data?: {
    orgId: string;
    status: string;
    workspaces: { id: string; name: string; status: string; scope: string }[];
    userCount: number;
    entityCount: number;
    featureOverrides: Record<string, boolean>;
    hasCustomRoles: boolean;
    createdAt: string;
  };
  error?: string;
}> {
  try {
    const [orgSnap, workspacesSnap, usersSnap, entitiesSnap, rolesSnap] = await Promise.all([
      adminDb.collection('organizations').doc(orgId).get(),
      adminDb.collection('workspaces').where('organizationId', '==', orgId).get(),
      adminDb.collection('users').where('organizationId', '==', orgId).get(),
      adminDb.collection('entities').where('organizationId', '==', orgId).get(),
      adminDb.collection('roles').where('organizationId', '==', orgId).get(),
    ]);

    if (!orgSnap.exists) {
      return { success: false, error: 'Organization not found' };
    }

    const orgData = orgSnap.data() as Organization;

    return {
      success: true,
      data: {
        orgId,
        status: orgData.status || 'active',
        workspaces: workspacesSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          status: d.data().status,
          scope: d.data().contactScope || 'unknown',
        })),
        userCount: usersSnap.size,
        entityCount: entitiesSnap.size,
        featureOverrides: orgData.enabledFeatures || {},
        hasCustomRoles: rolesSnap.docs.some((d) => !d.data().isDefault),
        createdAt: orgData.createdAt,
      },
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] getOrganizationDiagnostics failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new organization from backoffice.
 * Pre-assigns feature entitlements, sets isConfigured to false, and generates a joinToken.
 */
export async function createOrganizationFromBackofficeAction(
  data: {
    name: string;
    email?: string;
    enabledFeatures: Record<string, boolean>;
  },
  actor: AuditActor
): Promise<{ success: boolean; error?: string; data?: { organizationId: string; joinToken: string; slug: string } }> {
  try {
    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Organization name is required' };
    }

    const timestamp = new Date().toISOString();
    const baseSlug = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Generate slug with entropy
    const entropy = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const slug = `${baseSlug}-${entropy}`;

    // Generate unique case-sensitive alphanumeric joinToken (e.g. format: SS-XXXXXX)
    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randToken = '';
    for (let i = 0; i < 6; i++) {
      randToken += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    const joinToken = `SS-${randToken}`;

    const newOrgRef = adminDb.collection('organizations').doc(slug);
    
    // Check if organization slug or joinToken already exists
    const [existingSlug, existingToken] = await Promise.all([
      newOrgRef.get(),
      adminDb.collection('organizations').where('joinToken', '==', joinToken).limit(1).get()
    ]);

    if (existingSlug.exists) {
      return { success: false, error: 'Organization namespace conflict. Please try again.' };
    }
    if (!existingToken.empty) {
      return { success: false, error: 'Token generation conflict. Please try again.' };
    }

    const newOrgData = {
      name: data.name.trim(),
      email: data.email?.trim() || '',
      slug,
      joinToken,
      // Provisioning-token hardening: expires after a window, single-use.
      joinTokenExpiresAt: new Date(Date.now() + JOIN_TOKEN_TTL_MS).toISOString(),
      joinTokenUsed: false,
      isConfigured: false,
      enabledFeatures: data.enabledFeatures || {},
      status: 'active',
      departments: ['General'],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: actor.userId,
    };

    await newOrgRef.set(newOrgData);

    // Write audit log
    const after = createAuditSnapshot(newOrgData as Record<string, unknown>);
    await logBackofficeAction(actor, 'organization.create', 'organization', slug, {
      scope: 'organization',
      scopeId: slug,
      before: {},
      after,
    });

    return { 
      success: true, 
      data: {
        organizationId: slug,
        joinToken,
        slug
      }
    };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] createOrganizationFromBackofficeAction failed:', error);
    return { success: false, error: error.message };
  }
}

/** Generates a unique `SS-XXXXXX` join token (case-sensitive). */
async function generateUniqueJoinToken(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    let rand = '';
    for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    const token = `SS-${rand}`;
    const existing = await adminDb.collection('organizations').where('joinToken', '==', token).limit(1).get();
    if (existing.empty) return token;
  }
  throw new Error('Could not generate a unique join token. Please retry.');
}

function buildInviteEmailHtml(orgName: string, link: string, token: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color:#0f172a;">You're invited to set up ${orgName} on SmartSapp</h2>
      <p style="color:#475569;">You've been invited to complete the setup of <strong>${orgName}</strong> and become its administrator.</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="background:#10b981;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Complete Setup</a>
      </p>
      <p style="color:#475569;">Or use this join code on the setup screen: <strong style="letter-spacing:1px;">${token}</strong></p>
      <p style="color:#94a3b8;font-size:12px;">This invitation link expires in 7 days. If it has expired, ask your administrator to re-share it.</p>
    </div>`;
}

/**
 * Shares an organization's setup credentials (join token + invite link) by
 * email and/or SMS. Re-reads the org server-side (never trusts a client token),
 * and rotates the token + extends the expiry on every share so an expired/used
 * link is automatically renewed.
 */
export async function shareOrgSetupInviteAction(
  params: { organizationId: string; email?: string; phone?: string; channel: 'email' | 'sms' | 'both' },
  actor: AuditActor
): Promise<{ success: boolean; error?: string; sentTo?: { email?: boolean; sms?: boolean }; joinToken?: string; link?: string }> {
  try {
    const { organizationId, email, phone, channel } = params;
    const wantEmail = channel === 'email' || channel === 'both';
    const wantSms = channel === 'sms' || channel === 'both';

    if (wantEmail && (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (wantSms && (!phone || phone.trim().length < 6)) {
      return { success: false, error: 'A valid phone number is required.' };
    }

    const orgRef = adminDb.collection('organizations').doc(organizationId);
    const snap = await orgRef.get();
    if (!snap.exists) return { success: false, error: 'Organization not found.' };
    const org = snap.data() as any;

    if (org.isConfigured === true) {
      return { success: false, error: 'This organization is already configured; setup can no longer be shared.' };
    }

    // Renew: rotate the token if it was used/expired, always extend the window.
    const expired = org.joinTokenExpiresAt && new Date(org.joinTokenExpiresAt).getTime() < Date.now();
    const token = (org.joinTokenUsed || expired || !org.joinToken)
      ? await generateUniqueJoinToken()
      : (org.joinToken as string);
    const timestamp = new Date().toISOString();
    await orgRef.update({
      joinToken: token,
      joinTokenExpiresAt: new Date(Date.now() + JOIN_TOKEN_TTL_MS).toISOString(),
      joinTokenUsed: false,
      updatedAt: timestamp,
    });

    const { getRequestBaseUrl } = await import('../utils/url-helpers');
    const base = await getRequestBaseUrl();
    const link = `${base}/profile-setup?code=${encodeURIComponent(token)}`;
    const orgName = org.name || 'your organization';

    const sentTo: { email?: boolean; sms?: boolean } = {};

    if (wantEmail) {
      try {
        const { sendEmail } = await import('../resend-service');
        await sendEmail({
          to: email!.trim(),
          subject: `You're invited to set up ${orgName} on SmartSapp`,
          html: buildInviteEmailHtml(orgName, link, token),
        });
        sentTo.email = true;
      } catch (e) {
        console.error('[BACKOFFICE_ORG] invite email failed:', e);
        sentTo.email = false;
      }
    }

    if (wantSms) {
      try {
        const { sendSms } = await import('../mnotify-service');
        await sendSms({
          recipient: phone!.trim(),
          message: `You're invited to set up ${orgName} on SmartSapp. Complete setup: ${link} (code: ${token})`,
          sender: (orgName.substring(0, 11)) || 'SmartSapp',
        });
        sentTo.sms = true;
      } catch (e) {
        console.error('[BACKOFFICE_ORG] invite SMS failed:', e);
        sentTo.sms = false;
      }
    }

    await logBackofficeAction(actor, 'organization.invite_shared', 'organization', organizationId, {
      scope: 'organization',
      scopeId: organizationId,
    } as any);

    const anySent = (wantEmail && sentTo.email) || (wantSms && sentTo.sms);
    if (!anySent) {
      return { success: false, error: 'Failed to send the invitation. Please try again.', sentTo, joinToken: token, link };
    }
    return { success: true, sentTo, joinToken: token, link };
  } catch (error: any) {
    console.error('[BACKOFFICE_ORG] shareOrgSetupInviteAction failed:', error);
    return { success: false, error: error.message };
  }
}
