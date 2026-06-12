'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { SystemMigrationLog } from '@/lib/types';

/**
 * FER: Org-Admin Permission Remediation
 *
 * `completeOrganizationOnboardingAction` used to grant invited organization
 * administrators the full SUPER_ADMIN_PERMISSIONS list — including
 * `system_admin` / `system_user_switch`, the PLATFORM super-admin tokens that
 * both the Firestore rules (`isSystemAdmin()`) and the org switcher key off.
 * Seeded org "Administrator" roles also carried `system_admin`.
 *
 * This protocol strips those two platform tokens from:
 *  1. every user who is NOT a designated super admin (`admin@smartsapp.com`
 *     or listed in `system_config/super_admins`) — both top-level
 *     `permissions` and per-workspace `workspacePermissions`;
 *  2. every ORG-SCOPED role document carrying `system_admin` (replaced with
 *     the full operational permission set).
 *
 * Run with `dryRun: true` first to review the blast radius.
 */

const PLATFORM_PERMS = ['system_admin', 'system_user_switch'];

/** Org-admin operational permission set (mirrors organization-actions seeding). */
const ORG_ADMIN_ROLE_PERMS = [
  'schools_view', 'schools_edit', 'prospects_view', 'finance_view', 'finance_manage',
  'contracts_delete', 'studios_view', 'studios_edit', 'dashboard_manage',
  'meetings_manage', 'tasks_manage', 'activities_view',
  'tags_view', 'tags_manage', 'tags_apply', 'forms_manage', 'fields_manage',
];

interface AffectedUser {
  id: string;
  email: string;
  organizationId: string;
  topLevel: boolean;
  workspaces: string[];
}

interface AffectedRole {
  id: string;
  name: string;
  organizationId: string;
}

export interface OrgAdminFerResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  details: {
    usersScanned: number;
    usersAffected: AffectedUser[];
    usersFixed: number;
    rolesAffected: AffectedRole[];
    rolesFixed: number;
    skippedSuperAdmins: string[];
    errors: string[];
  };
}

function stripPlatformPerms(perms: unknown): { changed: boolean; perms: string[] } {
  if (!Array.isArray(perms)) return { changed: false, perms: [] };
  const next = perms.filter((p) => !PLATFORM_PERMS.includes(p));
  return { changed: next.length !== perms.length, perms: next };
}

export async function executeFixOrgAdminPermissionsFerAction(
  executorId: string,
  options: { dryRun: boolean }
): Promise<OrgAdminFerResult> {
  const { dryRun } = options;
  const migrationId = 'fer_fix_org_admin_permissions';
  const now = new Date().toISOString();
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);

  if (!dryRun) {
    await migrationRef.set({
      id: migrationId,
      status: 'in_progress',
      lastRunAt: now,
      executedBy: executorId,
      summary: 'Org-admin permission remediation started…',
    } as SystemMigrationLog, { merge: true });
  }

  const details: OrgAdminFerResult['details'] = {
    usersScanned: 0,
    usersAffected: [],
    usersFixed: 0,
    rolesAffected: [],
    rolesFixed: 0,
    skippedSuperAdmins: [],
    errors: [],
  };

  try {
    // 0. Super-admin allowlist
    const configDoc = await adminDb.collection('system_config').doc('super_admins').get();
    const allowEmails: string[] = (configDoc.exists ? configDoc.data()?.emails || [] : [])
      .map((e: string) => e.toLowerCase());
    allowEmails.push('admin@smartsapp.com');

    // 1. Org-scoped roles carrying the platform token
    const rolesSnap = await adminDb.collection('roles')
      .where('permissions', 'array-contains', 'system_admin')
      .get();
    for (const roleDoc of rolesSnap.docs) {
      const r = roleDoc.data();
      if (!r.organizationId) continue; // global/platform role — leave alone
      details.rolesAffected.push({ id: roleDoc.id, name: r.name || 'Unnamed', organizationId: r.organizationId });
      if (!dryRun) {
        await roleDoc.ref.update({ permissions: ORG_ADMIN_ROLE_PERMS, updatedAt: now });
        details.rolesFixed++;
      }
    }

    // 2. Full user scan — catches top-level AND workspace-level grants
    const usersSnap = await adminDb.collection('users').get();
    details.usersScanned = usersSnap.size;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const email = (data.email || '').toLowerCase();

      const top = stripPlatformPerms(data.permissions);
      const wsPerms = data.workspacePermissions || {};
      const nextWsPerms: Record<string, string[]> = {};
      const wsChangedIds: string[] = [];
      for (const [wsId, perms] of Object.entries(wsPerms)) {
        const res = stripPlatformPerms(perms);
        nextWsPerms[wsId] = res.perms;
        if (res.changed) wsChangedIds.push(wsId);
      }

      if (!top.changed && wsChangedIds.length === 0) continue;

      if (email && allowEmails.includes(email)) {
        details.skippedSuperAdmins.push(email);
        continue;
      }

      details.usersAffected.push({
        id: doc.id,
        email: email || '(no email)',
        organizationId: data.organizationId || '—',
        topLevel: top.changed,
        workspaces: wsChangedIds,
      });

      if (!dryRun) {
        const updates: Record<string, unknown> = { updatedAt: now };
        if (top.changed) updates.permissions = top.perms;
        if (wsChangedIds.length > 0) updates.workspacePermissions = nextWsPerms;
        await doc.ref.update(updates);
        details.usersFixed++;
      }
    }

    const summary = dryRun
      ? `Dry run: ${details.usersAffected.length} user(s) and ${details.rolesAffected.length} role(s) would be remediated.`
      : `Remediated ${details.usersFixed} user(s) and ${details.rolesFixed} role(s); ${details.skippedSuperAdmins.length} super admin(s) preserved.`;

    if (!dryRun) {
      await migrationRef.set({
        id: migrationId,
        status: 'completed',
        lastRunAt: now,
        completedAt: new Date().toISOString(),
        executedBy: executorId,
        summary,
      } as SystemMigrationLog, { merge: true });
    }

    return { success: true, message: summary, dryRun, details };
  } catch (error: any) {
    console.error('[FER:ORG_ADMIN_PERMS] Failed:', error);
    details.errors.push(error.message || 'Unknown error');
    if (!dryRun) {
      await migrationRef.set({
        id: migrationId,
        status: 'failed',
        lastRunAt: now,
        executedBy: executorId,
        summary: `Failed: ${error.message}`,
      } as SystemMigrationLog, { merge: true }).catch(() => {});
    }
    return { success: false, message: error.message || 'Remediation failed.', dryRun, details };
  }
}
