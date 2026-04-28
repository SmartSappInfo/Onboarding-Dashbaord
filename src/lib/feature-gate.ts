/**
 * @fileOverview Feature Gate System
 * 
 * Provides feature gating functionality to control visibility of industry-specific features.
 * Features are enabled/disabled based on the workspace's industry vertical.
 * 
 * Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 * - 15.9: Support feature toggles at Organization and Workspace levels
 * 
 * Design Property 8: Feature gate enforcement
 * For any workspace industry I, features absent from INDUSTRY_CONFIG[I].features return false
 */

import { INDUSTRY_CONFIG } from '@/lib/industry-config';
import type { IndustryVertical } from '@/lib/types';
import type { FeatureGate } from '@/lib/industry-config';

/**
 * Check if a specific feature is enabled for a given industry vertical.
 * 
 * @param feature - The feature key to check (e.g., 'trials', 'matters', 'campaigns')
 * @param industry - The industry vertical to check against
 * @returns true if the feature is enabled for the industry, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if trials feature is enabled for SaaS industry
 * const enabled = isFeatureEnabled('trials', 'SaaS'); // true
 * 
 * // Check if trials feature is enabled for Law industry
 * const enabled = isFeatureEnabled('trials', 'Law'); // false
 * ```
 */
export function isFeatureEnabled(
  feature: keyof FeatureGate,
  industry: IndustryVertical
): boolean {
  const config = INDUSTRY_CONFIG[industry];
  
  if (!config) {
    console.warn(`Unknown industry vertical: ${industry}`);
    return false;
  }

  return config.features[feature] ?? false;
}

/**
 * Get all enabled features for a given industry vertical.
 * 
 * @param industry - The industry vertical to get features for
 * @returns Array of enabled feature keys
 * 
 * @example
 * ```typescript
 * const features = getEnabledFeatures('SaaS');
 * // ['trials', 'onboarding', 'subscriptions', 'healthScores', 'supportTickets']
 * ```
 */
export function getEnabledFeatures(industry: IndustryVertical): Array<keyof FeatureGate> {
  const config = INDUSTRY_CONFIG[industry];
  
  if (!config) {
    console.warn(`Unknown industry vertical: ${industry}`);
    return [];
  }

  return (Object.keys(config.features) as Array<keyof FeatureGate>).filter(
    (feature) => config.features[feature]
  );
}

/**
 * Check if multiple features are all enabled for a given industry.
 * 
 * @param features - Array of feature keys to check
 * @param industry - The industry vertical to check against
 * @returns true if ALL features are enabled, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if both trials and subscriptions are enabled
 * const enabled = areAllFeaturesEnabled(['trials', 'subscriptions'], 'SaaS'); // true
 * ```
 */
export function areAllFeaturesEnabled(
  features: Array<keyof FeatureGate>,
  industry: IndustryVertical
): boolean {
  return features.every((feature) => isFeatureEnabled(feature, industry));
}

/**
 * Check if any of the specified features are enabled for a given industry.
 * 
 * @param features - Array of feature keys to check
 * @param industry - The industry vertical to check against
 * @returns true if ANY feature is enabled, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if either trials or matters are enabled
 * const enabled = isAnyFeatureEnabled(['trials', 'matters'], 'SaaS'); // true
 * ```
 */
export function isAnyFeatureEnabled(
  features: Array<keyof FeatureGate>,
  industry: IndustryVertical
): boolean {
  return features.some((feature) => isFeatureEnabled(feature, industry));
}

/**
 * Get the feature gate configuration for a specific industry.
 * 
 * @param industry - The industry vertical to get configuration for
 * @returns Complete FeatureGate object for the industry
 * 
 * @example
 * ```typescript
 * const features = getFeatureGateConfig('SaaS');
 * // { trials: true, onboarding: true, ... }
 * ```
 */
export function getFeatureGateConfig(industry: IndustryVertical): FeatureGate {
  const config = INDUSTRY_CONFIG[industry];
  
  if (!config) {
    console.warn(`Unknown industry vertical: ${industry}`);
    // Return all features disabled as fallback
    return {
      trials: false,
      onboarding: false,
      subscriptions: false,
      healthScores: false,
      supportTickets: false,
      applications: false,
      enrollments: false,
      schoolVisits: false,
      matters: false,
      conflictChecks: false,
      timeTracking: false,
      courtDates: false,
      campaigns: false,
      proposals: false,
      deliverables: false,
      performanceMetrics: false,
      clientReports: false,
      properties: false,
      viewings: false,
      offers: false,
      negotiations: false,
      deals: false,
      engagements: false,
      discoveries: false,
      milestones: false,
      outcomes: false,
      retainers: false,
    };
  }

  return config.features;
}
