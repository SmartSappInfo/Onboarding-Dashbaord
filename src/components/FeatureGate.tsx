/**
 * @fileOverview FeatureGate Component
 * 
 * Conditional rendering component that shows/hides content based on feature availability
 * for the current workspace's industry vertical.
 * 
 * Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 * 
 * Design Property 8: Feature gate enforcement
 */

'use client';

import * as React from 'react';
import { useFeatureGate } from '@/context/IndustryContext';
import type { FeatureGate as FeatureGateType } from '@/lib/industry-config';

export interface FeatureGateProps {
  /**
   * The feature key to check (e.g., 'trials', 'matters', 'campaigns')
   */
  feature: keyof FeatureGateType;
  
  /**
   * Content to render when the feature is enabled
   */
  children: React.ReactNode;
  
  /**
   * Optional fallback content to render when the feature is disabled
   * If not provided, renders null
   */
  fallback?: React.ReactNode;
  
  /**
   * Optional callback when feature is disabled
   */
  onDisabled?: () => void;
}

/**
 * FeatureGate component that conditionally renders children based on feature availability.
 * 
 * @example
 * ```tsx
 * // Simple usage - renders null when disabled
 * <FeatureGate feature="trials">
 *   <TrialsPanel />
 * </FeatureGate>
 * 
 * // With fallback content
 * <FeatureGate 
 *   feature="matters" 
 *   fallback={<div>This feature is not available</div>}
 * >
 *   <MattersPanel />
 * </FeatureGate>
 * 
 * // With callback
 * <FeatureGate 
 *   feature="campaigns"
 *   onDisabled={() => console.log('Campaigns not available')}
 * >
 *   <CampaignsPanel />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  onDisabled,
}: FeatureGateProps) {
  const isFeatureEnabled = useFeatureGate();
  const enabled = isFeatureEnabled(feature);

  React.useEffect(() => {
    if (!enabled && onDisabled) {
      onDisabled();
    }
  }, [enabled, onDisabled]);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Props for FeatureGateMultiple component
 */
export interface FeatureGateMultipleProps {
  /**
   * Array of feature keys to check
   */
  features: Array<keyof FeatureGateType>;
  
  /**
   * Logic to apply when checking multiple features
   * - 'all': All features must be enabled (AND logic)
   * - 'any': At least one feature must be enabled (OR logic)
   */
  mode?: 'all' | 'any';
  
  /**
   * Content to render when the condition is met
   */
  children: React.ReactNode;
  
  /**
   * Optional fallback content to render when the condition is not met
   */
  fallback?: React.ReactNode;
}

/**
 * FeatureGate component for checking multiple features at once.
 * 
 * @example
 * ```tsx
 * // Render only if ALL features are enabled
 * <FeatureGateMultiple features={['trials', 'subscriptions']} mode="all">
 *   <TrialsAndSubscriptionsPanel />
 * </FeatureGateMultiple>
 * 
 * // Render if ANY feature is enabled
 * <FeatureGateMultiple features={['matters', 'campaigns']} mode="any">
 *   <CaseOrCampaignPanel />
 * </FeatureGateMultiple>
 * ```
 */
export function FeatureGateMultiple({
  features,
  mode = 'all',
  children,
  fallback = null,
}: FeatureGateMultipleProps) {
  const isFeatureEnabled = useFeatureGate();

  const enabled = React.useMemo(() => {
    if (mode === 'all') {
      return features.every((feature) => isFeatureEnabled(feature));
    } else {
      return features.some((feature) => isFeatureEnabled(feature));
    }
  }, [features, mode, isFeatureEnabled]);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component that wraps a component with feature gating.
 * 
 * @param feature - The feature key to check
 * @param Component - The component to wrap
 * @param fallback - Optional fallback component
 * @returns Wrapped component with feature gating
 * 
 * @example
 * ```tsx
 * const TrialsPanel = () => <div>Trials content</div>;
 * const GatedTrialsPanel = withFeatureGate('trials', TrialsPanel);
 * 
 * // Usage
 * <GatedTrialsPanel />
 * ```
 */
export function withFeatureGate<P extends object>(
  feature: keyof FeatureGateType,
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  const WrappedComponent = (props: P) => {
    return (
      <FeatureGate feature={feature} fallback={fallback}>
        <Component {...props} />
      </FeatureGate>
    );
  };

  WrappedComponent.displayName = `withFeatureGate(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
