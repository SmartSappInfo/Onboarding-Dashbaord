'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { APP_FEATURES, type AppFeatureId, type FeatureToggleMap } from '@/lib/types';

/**
 * @fileOverview Feature Resolution Hook.
 * Composites Organization-level and Workspace-level feature toggles
 * to determine which features are active for the current context.
 *
 * Resolution Logic:
 * 1. Start with APP_FEATURES defaults (all enabled by default)
 * 2. Apply org-level overrides (super admin controlled)
 * 3. Apply workspace-level overrides (only for features the org has enabled)
 * 4. A feature is "enabled" only if BOTH org AND workspace have it enabled (or defaulted)
 */

interface UseFeatureReturn {
  /** Check if a specific feature is enabled in the current context */
  isFeatureEnabled: (featureId: AppFeatureId) => boolean;
  /** Raw org-level toggle map */
  orgFeatures: FeatureToggleMap;
  /** Raw workspace-level toggle map */
  workspaceFeatures: FeatureToggleMap;
  /** Features the workspace admin CAN toggle (org-enabled features) */
  availableFeatures: AppFeatureId[];
  /** Features that are actually active in the current context */
  enabledFeatures: AppFeatureId[];
  /** All registered feature definitions */
  allFeatures: typeof APP_FEATURES;
  /** Whether the hook data is still loading */
  isLoading: boolean;
}

export function useFeatures(): UseFeatureReturn {
  const { activeOrganization, activeWorkspace, isLoading } = useTenant();

  const orgFeatures = React.useMemo<FeatureToggleMap>(() => 
    activeOrganization?.enabledFeatures || {}, 
  [activeOrganization?.enabledFeatures]);

  const workspaceFeatures = React.useMemo<FeatureToggleMap>(() => 
    activeWorkspace?.enabledFeatures || {}, 
  [activeWorkspace?.enabledFeatures]);

  /**
   * Determine if a feature is enabled at the organization level.
   * If the org hasn't set a value, fall back to the feature's default.
   */
  const isOrgEnabled = React.useCallback((featureId: AppFeatureId): boolean => {
    const feature = APP_FEATURES.find(f => f.id === featureId);
    if (!feature) return false;

    const orgValue = orgFeatures[featureId];
    // If org hasn't explicitly set this feature, use the default
    return orgValue !== undefined ? orgValue : feature.defaultEnabled;
  }, [orgFeatures]);

  /**
   * Determine if a feature is enabled at the workspace level.
   * If the workspace hasn't set a value, fall back to the feature's default.
   */
  const isWorkspaceEnabled = React.useCallback((featureId: AppFeatureId): boolean => {
    const feature = APP_FEATURES.find(f => f.id === featureId);
    if (!feature) return false;

    const wsValue = workspaceFeatures[featureId];
    // If workspace hasn't explicitly set this feature, use the default
    return wsValue !== undefined ? wsValue : feature.defaultEnabled;
  }, [workspaceFeatures]);

  /**
   * A feature is enabled only if BOTH org AND workspace have it active.
   * Org-level is the ceiling; workspace can only restrict, never expand.
   */
  const isFeatureEnabled = React.useCallback((featureId: AppFeatureId): boolean => {
    return isOrgEnabled(featureId) && isWorkspaceEnabled(featureId);
  }, [isOrgEnabled, isWorkspaceEnabled]);

  /**
   * Features the workspace admin CAN toggle = features enabled at org level.
   */
  const availableFeatures = React.useMemo(() => {
    return APP_FEATURES
      .filter(f => isOrgEnabled(f.id as AppFeatureId))
      .map(f => f.id as AppFeatureId);
  }, [isOrgEnabled]);

  /**
   * Features actually active = org enabled AND workspace enabled.
   */
  const enabledFeatures = React.useMemo(() => {
    return APP_FEATURES
      .filter(f => isFeatureEnabled(f.id as AppFeatureId))
      .map(f => f.id as AppFeatureId);
  }, [isFeatureEnabled]);

  return React.useMemo(() => ({
    isFeatureEnabled,
    orgFeatures,
    workspaceFeatures,
    availableFeatures,
    enabledFeatures,
    allFeatures: APP_FEATURES,
    isLoading,
  }), [isFeatureEnabled, orgFeatures, workspaceFeatures, availableFeatures, enabledFeatures, isLoading]);
}
