/**
 * @fileOverview Static route → feature-label maps for the Admin and Backoffice
 * control planes. These mirror the sidebar nav ([AdminSidebar], [BackofficeSidebar])
 * but are plain data — the sidebars are permission/feature-gated and hook-driven,
 * so a static map is the right single source for browser tab titles.
 *
 * Consumed by the `PageTitleManager` client component to set `document.title`.
 */

export type RouteTitleMap = Record<string, string>;

/** Admin (`/admin/*`) routes → human label shown in the tab title. */
export const ADMIN_ROUTE_TITLES: RouteTitleMap = {
  '/admin': 'Dashboard',
  '/admin/lead-intelligence': 'Lead Intelligence',
  '/admin/entities/lead-scoring': 'Lead Cleanup',
  '/admin/entities': 'Entities',
  '/admin/pipeline': 'Deals',
  '/admin/tasks': 'Tasks',
  '/admin/meetings': 'Meetings',
  '/admin/automations': 'Automations',
  '/admin/reports': 'Intelligence',
  '/admin/quick-notes': 'Quick Notes',
  '/admin/finance/contracts': 'Agreements',
  '/admin/finance/invoices': 'Invoices',
  '/admin/finance/packages': 'Packages',
  '/admin/finance/periods': 'Cycles',
  '/admin/finance/settings': 'Billing Setup',
  '/admin/finance': 'Finance',
  '/admin/portals': 'Public Portals',
  '/admin/pages': 'Landing Pages',
  '/admin/media': 'Media',
  '/admin/surveys': 'Surveys',
  '/admin/pdfs': 'Doc Signing',
  '/admin/messaging/call-centre': 'Call Centre',
  '/admin/messaging': 'Messaging',
  '/admin/forms': 'Forms',
  '/admin/contacts/tags': 'Tags',
  '/admin/contacts': 'Contacts',
  '/admin/qr-studio': 'QR Studio',
  '/admin/verify-studio': 'Verify Studio',
  '/admin/social': 'Social Intelligence',
  '/admin/social/composer': 'Social Composer',
  '/admin/social/calendar': 'Social Calendar',
  '/admin/social/inbox': 'Social Inbox',
  '/admin/social/accounts': 'Social Accounts',
  '/admin/social/listening': 'Social Listening',
  '/admin/social/analytics': 'Social Analytics',
  '/admin/activities': 'Activities',
  '/admin/users/roles': 'Roles & Permissions',
  '/admin/users': 'Users',
  '/admin/webhooks': 'Webhooks',
  '/admin/settings/invitation': 'Invitations',
  '/admin/settings/fields': 'Fields & Variables',
  '/admin/settings/developer': 'Developer API',
  '/admin/settings': 'System Settings',
  '/admin/profile': 'Profile',
  '/admin/deals': 'Deals',
};

/** Backoffice (`/backoffice/*`) routes → human label shown in the tab title. */
export const BACKOFFICE_ROUTE_TITLES: RouteTitleMap = {
  '/backoffice': 'Dashboard',
  '/backoffice/organizations': 'Organizations',
  '/backoffice/workspaces': 'Workspaces',
  '/backoffice/settings/system-defaults': 'System Defaults',
  '/backoffice/features': 'Features & Rollouts',
  '/backoffice/templates': 'Templates',
  '/backoffice/messaging/blueprints': 'System Blueprints',
  '/backoffice/messaging/styles': 'Global Styles',
  '/backoffice/integrations': 'WhatsApp Registry',
  '/backoffice/fields': 'Fields & Variables',
  '/backoffice/assets': 'Assets',
  '/backoffice/developer': 'Developer & API',
  '/backoffice/operations': 'Operations',
  '/backoffice/audit': 'Audit Logs',
  '/backoffice/settings': 'Settings',
};

/**
 * Resolves a pathname to its feature label using longest-prefix matching, so
 * `/admin/entities/123` resolves to "Entities" and `/admin/entities/lead-scoring`
 * resolves to the more specific "Lead Cleanup".
 */
export function resolveRouteTitle(
  pathname: string,
  map: RouteTitleMap,
  fallback = '',
): string {
  let bestLabel = fallback;
  let bestLen = -1;
  for (const prefix in map) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > bestLen) {
      bestLabel = map[prefix];
      bestLen = prefix.length;
    }
  }
  return bestLabel;
}
