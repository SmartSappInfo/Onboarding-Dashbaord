'use client';

import { useWorkspace } from '@/context/WorkspaceContext';

export interface Terminology {
  singular: string;
  plural: string;
}

const DEFAULT_TERMINOLOGY: Record<string, Terminology> = {
  institution: { singular: 'Institution', plural: 'Institutions' },
  family: { singular: 'Family', plural: 'Families' },
  person: { singular: 'Person', plural: 'People' },
};

/**
 * Hook to provide dynamic terminology based on workspace settings.
 * Phasing out 'School' in favor of scope-aware labels.
 */
export function useTerminology() {
  const { activeWorkspace } = useWorkspace();
  
  // 1. Resolve Scope
  const scope = activeWorkspace?.contactScope || 'institution';
  
  // 2. Resolve Terms (Custom override -> Scope Default -> Global Default)
  const terms = activeWorkspace?.terminology || DEFAULT_TERMINOLOGY[scope] || DEFAULT_TERMINOLOGY.institution;
  
  const s = terms.singular;
  const p = terms.plural;

  return {
    // Basic terms
    singular: s,
    plural: p,
    
    // UI Label Helpers
    addNew: `Add New ${s}`,
    importBulk: `Bulk Import ${p}`,
    noFound: `No ${p.toLowerCase()} found for the active workspace.`,
    deleteConfirm: `Delete ${s}?`,
    deleteLabel: `Delete ${s}`,
    updateStatus: `Update ${s} Status`,
    termName: `${s} Name`,
    termStatus: `${s} Status`,
    viewConsole: `View ${s} Console`,
    editProfile: `Edit ${s} Profile`,
  };
}
