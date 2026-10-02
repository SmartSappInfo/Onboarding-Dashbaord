'use client';

import type { PermissionsSchema, AppPermissionAction } from '@/lib/types';
import { evaluatePermission } from '@/lib/permissions-engine';

/**
 * Maps admin routes to their required permission checks.
 * Used by the workspace switcher to pre-validate access before switching.
 */

export type RoutePermissionCheck = {
    /** The display name shown in the access-denied dialog */
    label: string;
    /** Permission section from PermissionsSchema */
    section: keyof PermissionsSchema;
    /** Feature key within that section */
    feature: string;
    /** Action to check (defaults to 'view') */
    action?: AppPermissionAction;
};

/**
 * Map of route prefixes to their required permission checks.
 * Order matters — more specific routes should come first.
 */
export const ROUTE_PERMISSION_MAP: { path: string; check: RoutePermissionCheck }[] = [
    // Finance (more specific first)
    { path: '/admin/finance/contracts', check: { label: 'Agreements', section: 'finance', feature: 'agreements' } },
    { path: '/admin/finance/invoices', check: { label: 'Invoices', section: 'finance', feature: 'invoices' } },
    { path: '/admin/finance/packages', check: { label: 'Packages', section: 'finance', feature: 'packages' } },
    { path: '/admin/finance/periods', check: { label: 'Billing Cycles', section: 'finance', feature: 'cycles' } },
    { path: '/admin/finance/settings', check: { label: 'Billing Setup', section: 'finance', feature: 'billingSetup' } },

    // Social Hub
    { path: '/admin/social/composer', check: { label: 'Social Composer', section: 'social', feature: 'composer' } },
    { path: '/admin/social/calendar', check: { label: 'Social Calendar', section: 'social', feature: 'calendar' } },
    { path: '/admin/social/inbox', check: { label: 'Social Inbox', section: 'social', feature: 'inbox' } },
    { path: '/admin/social/accounts', check: { label: 'Connected Profiles', section: 'social', feature: 'accounts' } },
    { path: '/admin/social', check: { label: 'Social Hub', section: 'social', feature: 'dashboard' } },

    // Workforce & Users
    { path: '/admin/workforce/command-center', check: { label: 'AI Command Center', section: 'workforce', feature: 'commandCenter' } },
    { path: '/admin/workforce/ai', check: { label: 'AI Workforce Advisor', section: 'workforce', feature: 'advisor' } },
    { path: '/admin/users/governance', check: { label: 'Workforce Governance', section: 'workforce', feature: 'governance' } },
    { path: '/admin/workforce/crm', check: { label: 'CRM Workload & Transfer', section: 'workforce', feature: 'crmWorkload' } },
    { path: '/admin/workforce/enterprise-identity', check: { label: 'Enterprise Identity', section: 'workforce', feature: 'enterpriseIdentity' } },
    { path: '/admin/users/roles', check: { label: 'Roles & Permissions', section: 'workforce', feature: 'roles' } },
    { path: '/admin/workforce/onboarding', check: { label: 'Staff Onboarding', section: 'workforce', feature: 'onboarding' } },
    { path: '/admin/workforce/intelligence', check: { label: 'User Intelligence', section: 'workforce', feature: 'intelligence' } },
    { path: '/admin/users', check: { label: 'Users Directory', section: 'workforce', feature: 'users' } },

    // Operations
    { path: '/admin/entities/lead-scoring', check: { label: 'Lead Scoring', section: 'management', feature: 'leadScores' } },
    { path: '/admin/entities', check: { label: 'Contacts', section: 'operations', feature: 'campuses' } },
    { path: '/admin/lead-intelligence', check: { label: 'Lead Intelligence', section: 'operations', feature: 'leadIntelligence' } },
    { path: '/admin/pipeline', check: { label: 'Deals', section: 'operations', feature: 'pipeline' } },
    { path: '/admin/tasks', check: { label: 'Tasks', section: 'operations', feature: 'tasks' } },
    { path: '/admin/meetings', check: { label: 'Meetings', section: 'operations', feature: 'meetings' } },
    { path: '/admin/automations', check: { label: 'Automations', section: 'operations', feature: 'automations' } },
    { path: '/admin/analytics/sales-effort', check: { label: 'Sales Effort Analytics', section: 'operations', feature: 'salesEffort' } },
    { path: '/admin/reports', check: { label: 'Intelligence', section: 'operations', feature: 'intelligence' } },
    { path: '/admin/quick-notes/graph', check: { label: 'Knowledge Graph', section: 'operations', feature: 'knowledgeGraph' } },
    { path: '/admin/quick-notes', check: { label: 'Quick Notes', section: 'operations', feature: 'quickNotes' } },

    // Studios
    { path: '/admin/portals', check: { label: 'Public Portals', section: 'studios', feature: 'publicPortals' } },
    { path: '/admin/pages', check: { label: 'Landing Pages', section: 'studios', feature: 'landingPages' } },
    { path: '/admin/media/thumbnails', check: { label: 'Thumbnail Studio', section: 'studios', feature: 'thumbnails' } },
    { path: '/admin/flipbooks', check: { label: 'Flipbook Studio', section: 'studios', feature: 'flipbooks' } },
    { path: '/admin/media', check: { label: 'Media', section: 'studios', feature: 'media' } },
    { path: '/admin/surveys', check: { label: 'Surveys', section: 'studios', feature: 'surveys' } },
    { path: '/admin/pdfs', check: { label: 'Doc Signing', section: 'studios', feature: 'docSigning' } },
    { path: '/admin/messaging/call-centre', check: { label: 'Call Centre', section: 'studios', feature: 'callCentre' } },
    { path: '/admin/messaging', check: { label: 'Messaging', section: 'studios', feature: 'messaging' } },
    { path: '/admin/forms', check: { label: 'Forms', section: 'studios', feature: 'forms' } },
    { path: '/admin/contacts/tags', check: { label: 'Tags', section: 'studios', feature: 'tags' } },
    { path: '/admin/qr-studio', check: { label: 'QR Studio', section: 'studios', feature: 'qrStudio' } },
    { path: '/admin/verify-studio', check: { label: 'Verify Studio', section: 'studios', feature: 'verifyStudio' } },

    // Management
    { path: '/admin/activity', check: { label: 'Activities', section: 'management', feature: 'activities' } },
    { path: '/admin/activities', check: { label: 'Activities', section: 'management', feature: 'activities' } },
    { path: '/admin/settings/fields', check: { label: 'Fields & Variables', section: 'management', feature: 'fields' } },
    { path: '/admin/settings/invitation', check: { label: 'Messaging Settings', section: 'management', feature: 'messagingSettings' } },
    { path: '/admin/ai-prompts', check: { label: 'AI Prompts', section: 'management', feature: 'aiPrompts' } },
    { path: '/admin/settings/sales-performance', check: { label: 'Sales Effort Rules', section: 'management', feature: 'effortRules' } },
    { path: '/admin/settings/developer', check: { label: 'Developer API', section: 'management', feature: 'developerApi' } },
    { path: '/admin/webhooks', check: { label: 'Webhooks', section: 'management', feature: 'webhooks' } },
    { path: '/admin/settings', check: { label: 'Settings', section: 'management', feature: 'systemSettings' } },

    // Dashboard (always last — catch-all)
    { path: '/admin', check: { label: 'Dashboard', section: 'operations', feature: 'dashboard' } },
];

/**
 * Find the permission check required for a given route.
 */
export function getPermissionForRoute(pathname: string): RoutePermissionCheck | null {
    // Strip query params and track param
    const cleanPath = pathname.split('?')[0];

    for (const entry of ROUTE_PERMISSION_MAP) {
        if (cleanPath === entry.path || cleanPath.startsWith(entry.path + '/')) {
            return entry.check;
        }
    }
    return null;
}

/**
 * Check if a given permission schema allows access to a route.
 */
export function canAccessRoute(
    schema: PermissionsSchema | undefined,
    routeCheck: RoutePermissionCheck,
    isSuperAdmin: boolean
): boolean {
    if (isSuperAdmin) return true;
    if (!schema) return false;
    return evaluatePermission(schema, routeCheck.section, routeCheck.feature, routeCheck.action || 'view');
}

/**
 * Get a list of accessible routes for a given permission schema.
 * Returns the first N routes the user CAN access (for suggesting alternatives).
 */
export function getAccessibleRoutes(
    schema: PermissionsSchema | undefined,
    isSuperAdmin: boolean,
    limit: number = 2
): RoutePermissionCheck[] {
    if (isSuperAdmin) {
        return ROUTE_PERMISSION_MAP.slice(0, limit).map(e => e.check);
    }
    if (!schema) return [];

    const accessible: RoutePermissionCheck[] = [];
    for (const entry of ROUTE_PERMISSION_MAP) {
        if (evaluatePermission(schema, entry.check.section, entry.check.feature, entry.check.action || 'view')) {
            accessible.push(entry.check);
            if (accessible.length >= limit) break;
        }
    }
    return accessible;
}

/**
 * Given a pathname, return the root list-view path for the current feature.
 * Used when switching workspaces so the app exits detail/edit/preview modes
 * and lands on the feature's index page.
 *
 * Examples:
 *   /admin/meetings/abc123/edit  → /admin/meetings
 *   /admin/qr-studio/xyz/detail → /admin/qr-studio
 *   /admin                      → /admin
 */
export function getFeatureRootPath(pathname: string): string {
    const cleanPath = pathname.split('?')[0];

    for (const entry of ROUTE_PERMISSION_MAP) {
        if (cleanPath === entry.path || cleanPath.startsWith(entry.path + '/')) {
            return entry.path;
        }
    }
    return '/admin';
}

/**
 * Get the href for a route permission check.
 */
export function getRouteHref(check: RoutePermissionCheck, workspaceId?: string): string {
    const entry = ROUTE_PERMISSION_MAP.find(
        e => e.check.section === check.section && e.check.feature === check.feature
    );
    const basePath = entry?.path || '/admin';
    return workspaceId ? `${basePath}?track=${workspaceId}` : basePath;
}
