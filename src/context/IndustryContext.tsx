'use client';

import * as React from 'react';
import { useTenant } from './TenantContext';
import { INDUSTRY_CONFIG } from '@/lib/industry-config';
import type { IndustryVertical } from '@/lib/types';
import type {
  TerminologyMap,
  FeatureGate,
  PipelineTemplate,
  SidebarItem,
} from '@/lib/industry-config';

/**
 * @fileOverview Industry Context Provider
 * 
 * Provides industry-specific configuration based on the active workspace's industry.
 * Wraps TenantContext to derive industry-specific values from INDUSTRY_CONFIG.
 * 
 * Requirements:
 * - 2.4: Display industry-specific terminology in Workspace UI
 * - 13.7: Store Terminology_Map for each Industry_Vertical
 * - 15.5: Filter available features based on Workspace Industry_Vertical
 */

export interface IndustryContextType {
  industry: IndustryVertical;
  terminology: TerminologyMap;
  features: FeatureGate;
  pipelineTemplate: PipelineTemplate;
  sidebarItems: SidebarItem[];
  contactTypes: string[];
  isLoading: boolean;
}

const IndustryContext = React.createContext<IndustryContextType | undefined>(undefined);

export function IndustryProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, isLoading: isTenantLoading } = useTenant();

  const value = React.useMemo<IndustryContextType>(() => {
    // Default to SaaS if workspace is not yet loaded or doesn't have an industry
    const industry = activeWorkspace?.industry || 'SaaS';
    const config = INDUSTRY_CONFIG[industry];

    return {
      industry,
      terminology: config.terminology,
      features: config.features,
      pipelineTemplate: config.pipelineTemplate,
      sidebarItems: config.sidebarItems,
      contactTypes: config.contactTypes,
      isLoading: isTenantLoading,
    };
  }, [activeWorkspace, isTenantLoading]);

  return (
    <IndustryContext.Provider value={value}>
      {children}
    </IndustryContext.Provider>
  );
}

/**
 * Hook to access industry-specific configuration for the active workspace.
 * 
 * @returns Industry context with terminology, features, pipeline template, and sidebar items
 * @throws Error if used outside of IndustryProvider
 * 
 * @example
 * ```tsx
 * function EntityList() {
 *   const { terminology, features } = useIndustry();
 *   
 *   return (
 *     <div>
 *       <h1>{terminology.entityPlural}</h1>
 *       {features.trials && <TrialsPanel />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIndustry() {
  const context = React.useContext(IndustryContext);
  if (context === undefined) {
    throw new Error('useIndustry must be used within an IndustryProvider');
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled for the current workspace's industry.
 * 
 * @returns Function to check if a feature is enabled
 * @throws Error if used outside of IndustryProvider
 * 
 * Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 * 
 * @example
 * ```tsx
 * function TrialsPanel() {
 *   const isFeatureEnabled = useFeatureGate();
 *   
 *   if (!isFeatureEnabled('trials')) {
 *     return null;
 *   }
 *   
 *   return <div>Trials content...</div>;
 * }
 * ```
 */
export function useFeatureGate() {
  const { features } = useIndustry();
  
  return React.useCallback(
    (feature: keyof FeatureGate) => {
      return features[feature] ?? false;
    },
    [features]
  );
}
