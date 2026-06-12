/**
 * Remediation: strip platform-level permissions (`system_admin`,
 * `system_user_switch`) from users who are NOT designated super admins.
 *
 * Background: `completeOrganizationOnboardingAction` used to grant invited
 * organization administrators the full SUPER_ADMIN_PERMISSIONS list, which
 * includes `system_admin`. Both the Firestore rules (`isSystemAdmin()`) and
 * the org switcher key off that permission, so those users could see and
 * switch into every organization. The action now grants ORG_ADMIN_PERMISSIONS;
 * this script fixes users created before the fix.
 *
 * Legit super admins are preserved: `admin@smartsapp.com` and any email listed
 * in `system_config/super_admins`.
 *
 * Usage:
 *   pnpm tsx scripts/fix-org-admin-permissions.ts            # dry run (no writes)
 *   pnpm tsx scripts/fix-org-admin-permissions.ts --apply    # write changes
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
  });
}

const db = getFirestore();
const APPLY = process.argv.includes('--apply');
const PLATFORM_PERMS = ['system_admin', 'system_user_switch'];

function stripPlatformPerms(perms: unknown): { changed: boolean; perms: string[] } {
  if (!Array.isArray(perms)) return { changed: false, perms: [] };
  const next = perms.filter((p) => !PLATFORM_PERMS.includes(p));
  return { changed: next.length !== perms.length, perms: next };
}

/** Org-admin operational permission set (mirrors organization-actions seeding). */
const ORG_ADMIN_ROLE_PERMS = [
  'schools_view', 'schools_edit', 'prospects_view', 'finance_view', 'finance_manage',
  'contracts_delete', 'studios_view', 'studios_edit', 'dashboard_manage',
  'meetings_manage', 'tasks_manage', 'activities_view',
  'tags_view', 'tags_manage', 'tags_apply', 'forms_manage', 'fields_manage',
];

async function main() {
  // 1. Resolve the legit super-admin allowlist
  const configDoc = await db.collection('system_config').doc('super_admins').get();
  const allowEmails: string[] = (configDoc.exists ? configDoc.data()?.emails || [] : [])
    .map((e: string) => e.toLowerCase());
  allowEmails.push('admin@smartsapp.com');
  console.log(`Super-admin allowlist (${allowEmails.length}):`, allowEmails.join(', '));

  // 2. Fix org-scoped ROLE documents seeded with the platform token
  //    (assigning such a role would re-leak system_admin into user perms).
  const rolesSnap = await db.collection('roles')
    .where('permissions', 'array-contains', 'system_admin')
    .get();
  for (const roleDoc of rolesSnap.docs) {
    const r = roleDoc.data();
    if (!r.organizationId) {
      console.log(`SKIP role ${roleDoc.id} (${r.name}) — global/platform role`);
      continue;
    }
    console.log(`${APPLY ? 'FIX' : 'WOULD FIX'} role ${roleDoc.id} (${r.name}) org=${r.organizationId} — replace system_admin with operational set`);
    if (APPLY) {
      await roleDoc.ref.update({ permissions: ORG_ADMIN_ROLE_PERMS, updatedAt: new Date().toISOString() });
    }
  }

  // 3. Full user scan — catches both top-level and workspace-level grants.
  const snap = await db.collection('users').get();
  console.log(`Scanning ${snap.size} user(s)…\n`);

  let fixed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase();

    const hasTop = Array.isArray(data.permissions) && data.permissions.some((p: string) => PLATFORM_PERMS.includes(p));
    const hasWs = Object.values(data.workspacePermissions || {}).some(
      (perms) => Array.isArray(perms) && perms.some((p: string) => PLATFORM_PERMS.includes(p))
    );
    if (!hasTop && !hasWs) continue;

    if (email && allowEmails.includes(email)) {
      console.log(`SKIP   ${doc.id} (${email}) — designated super admin`);
      continue;
    }

    const updates: Record<string, unknown> = {};

    const top = stripPlatformPerms(data.permissions);
    if (top.changed) updates.permissions = top.perms;

    const wsPerms = data.workspacePermissions || {};
    const nextWsPerms: Record<string, string[]> = {};
    let wsChanged = false;
    for (const [wsId, perms] of Object.entries(wsPerms)) {
      const res = stripPlatformPerms(perms);
      nextWsPerms[wsId] = res.perms;
      if (res.changed) wsChanged = true;
    }
    if (wsChanged) updates.workspacePermissions = nextWsPerms;

    if (Object.keys(updates).length === 0) {
      console.log(`OK     ${doc.id} (${email}) — nothing to change`);
      continue;
    }

    console.log(
      `${APPLY ? 'FIX' : 'WOULD FIX'} ${doc.id} (${email || 'no email'}) org=${data.organizationId || '—'}` +
      `${top.changed ? ' [permissions]' : ''}${wsChanged ? ' [workspacePermissions]' : ''}`
    );

    if (APPLY) {
      updates.updatedAt = new Date().toISOString();
      await doc.ref.update(updates);
      fixed++;
    }
  }

  console.log(
    APPLY
      ? `\nDone. ${fixed} user(s) remediated.`
      : `\nDry run complete — re-run with --apply to write changes.`
  );
}

main().catch((e) => {
  console.error('Remediation failed:', e);
  process.exit(1);
});
