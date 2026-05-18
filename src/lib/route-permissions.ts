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

    // Operations
    { path: '/admin/entities', check: { label: 'Contacts', section: 'operations', feature: 'campuses' } },
    { path: '/admin/pipeline', check: { label: 'Deals', section: 'operations', feature: 'pipeline' } },
    { path: '/admin/tasks', check: { label: 'Tasks', section: 'operations', feature: 'tasks' } },
    { path: '/admin/meetings', check: { label: 'Meetings', section: 'operations', feature: 'meetings' } },
    { path: '/admin/automations', check: { label: 'Automations', section: 'operations', feature: 'automations' } },
    { path: '/admin/reports', check: { label: 'Intelligence', section: 'operations', feature: 'intelligence' } },

    // Studios
    { path: '/admin/portals', check: { label: 'Public Portals', section: 'studios', feature: 'publicPortals' } },
    { path: '/admin/pages', check: { label: 'Landing Pages', section: 'studios', feature: 'landingPages' } },
    { path: '/admin/media', check: { label: 'Media', section: 'studios', feature: 'media' } },
    { path: '/admin/surveys', check: { label: 'Surveys', section: 'studios', feature: 'surveys' } },
    { path: '/admin/pdfs', check: { label: 'Doc Signing', section: 'studios', feature: 'docSigning' } },
    { path: '/admin/messaging', check: { label: 'Messaging', section: 'studios', feature: 'messaging' } },
    { path: '/admin/forms', check: { label: 'Forms', section: 'studios', feature: 'forms' } },
    { path: '/admin/contacts/tags', check: { label: 'Tags', section: 'studios', feature: 'tags' } },
    { path: '/admin/qr-studio', check: { label: 'QR Studio', section: 'studios', feature: 'qrStudio' } },
    { path: '/admin/verify-studio', check: { label: 'Verify Studio', section: 'studios', feature: 'verifyStudio' } },

    // Management
    { path: '/admin/activities', check: { label: 'Activities', section: 'management', feature: 'activities' } },
    { path: '/admin/users', check: { label: 'Users', section: 'management', feature: 'users' } },
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
 * Get the href for a route permission check.
 */
export function getRouteHref(check: RoutePermissionCheck, workspaceId?: string): string {
    const entry = ROUTE_PERMISSION_MAP.find(
        e => e.check.section === check.section && e.check.feature === check.feature
    );
    const basePath = entry?.path || '/admin';
    return workspaceId ? `${basePath}?track=${workspaceId}` : basePath;
}
