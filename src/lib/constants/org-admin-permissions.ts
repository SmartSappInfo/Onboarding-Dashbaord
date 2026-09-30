/**
 * @fileOverview The legacy flat permission set an ORGANIZATION administrator holds.
 *
 * Shared by the two places that create organization admins, so they cannot drift apart:
 * - organization provisioning (the seeded "Administrator" role), and
 * - organization onboarding (the first admin who completes setup).
 * Pair it with `getFullAdminPermissions()` for the hierarchical permissions schema.
 *
 * CAUTION: never add 'system_admin'. It is the PLATFORM super-admin token: Firestore rules
 * (`isSystemAdmin()`), `requireAuth` and the organization switcher treat it as access to every
 * tenant. Onboarding once granted it, which made each organization's owner an admin of all of them.
 */

import type { AppPermissionId } from '@/lib/types';

export const ORG_ADMIN_PERMISSIONS: readonly AppPermissionId[] = [
  'schools_view', 'schools_edit', 'prospects_view', 'finance_view', 'finance_manage',
  'contracts_delete', 'studios_view', 'studios_edit', 'dashboard_manage',
  'meetings_manage', 'tasks_manage', 'activities_view',
  'tags_view', 'tags_manage', 'tags_apply', 'forms_manage', 'fields_manage',
];
