/**
 * @fileOverview Three-Level Feature Flags for Event Backbone (Milestone 1)
 *
 * Implements Rule 64 (Three-Level Feature Flags) and Rule 65 (Canary Releases).
 *
 * Evaluates `enable_event_backbone` feature flag across three hierarchical tiers:
 *   1. Workspace level (highest precedence)
 *   2. Organization level
 *   3. Global level (default: true)
 *
 * Allows isolating problematic workspaces or canaries without affecting the broader platform.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/circuit-breaker.test.ts`.
 */

export interface EventFlagOverrides {
  global?: boolean;
  orgs?: Record<string, boolean>;
  workspaces?: Record<string, boolean>;
}

let testOverrides: EventFlagOverrides | null = null;

export function setEventFlagOverridesForTests(overrides: EventFlagOverrides | null): void {
  testOverrides = overrides;
}

/**
 * Evaluates whether the Event Backbone is enabled for a given tenant scope.
 */
export async function isEventBackboneEnabledForTenant(
  organizationId?: string,
  workspaceId?: string
): Promise<boolean> {
  // Test override check
  if (testOverrides) {
    if (workspaceId && testOverrides.workspaces?.[workspaceId] !== undefined) {
      return testOverrides.workspaces[workspaceId];
    }
    if (organizationId && testOverrides.orgs?.[organizationId] !== undefined) {
      return testOverrides.orgs[organizationId];
    }
    if (testOverrides.global !== undefined) {
      return testOverrides.global;
    }
    return true;
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');

    // 1. Workspace-level check
    if (workspaceId) {
      const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      if (wsDoc.exists) {
        const wsFlags = wsDoc.data()?.featureFlags as Record<string, boolean> | undefined;
        if (wsFlags?.enable_event_backbone !== undefined) {
          return wsFlags.enable_event_backbone;
        }
      }
    }

    // 2. Organization-level check
    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const orgFlags = orgDoc.data()?.featureFlags as Record<string, boolean> | undefined;
        if (orgFlags?.enable_event_backbone !== undefined) {
          return orgFlags.enable_event_backbone;
        }
      }
    }

    // 3. Global system default
    const globalDoc = await adminDb.collection('system_settings').doc('ai_config').get();
    if (globalDoc.exists) {
      const globalFlags = globalDoc.data()?.featureFlags as Record<string, boolean> | undefined;
      if (globalFlags?.enable_event_backbone !== undefined) {
        return globalFlags.enable_event_backbone;
      }
    }

    // Enabled by default
    return true;
  } catch {
    // Fail open if flag lookup fails, preserving business continuity
    return true;
  }
}

/**
 * Universal flag check helper for event backbone.
 */
export async function checkEventFlag(
  flagName: string,
  scope?: { organizationId?: string; workspaceId?: string }
): Promise<boolean> {
  if (flagName === 'enable_event_backbone') {
    return isEventBackboneEnabledForTenant(scope?.organizationId, scope?.workspaceId);
  }
  return true;
}

