/**
 * Shared terminology utilities for use in both Client and Server components.
 * 
 * This module provides backward compatibility with the legacy contactScope-based
 * terminology system while integrating with the new industry-specific terminology.
 * 
 * Requirements:
 * - 13.1–13.12: Apply industry-specific terminology to UI
 * - Backward compatibility: Support legacy contactScope terminology
 */

import type { IndustryVertical } from '@/lib/types';
import { INDUSTRY_CONFIG } from '@/lib/industry-config';

export interface Terminology {
  singular: string;
  plural: string;
  focalPerson: string;
  addNew: string;
  importBulk: string;
  noFound: string;
  deleteConfirm: string;
  deleteLabel: string;
  updateStatus: string;
  termName: string;
  termStatus: string;
  viewConsole: string;
  editProfile: string;
  dealSingular: string;
  dealPlural: string;
}

export const DEFAULT_TERMINOLOGY: Record<string, { singular: string; plural: string; dealSingular?: string; dealPlural?: string }> = {
  institution: { singular: 'Campus', plural: 'Campuses', dealSingular: 'Deal', dealPlural: 'Deals' },
  family: { singular: 'Family', plural: 'Families', dealSingular: 'Deal', dealPlural: 'Deals' },
  person: { singular: 'Person', plural: 'People', dealSingular: 'Deal', dealPlural: 'Deals' },
};

/**
 * Shared logic to resolve terminology from workspace data.
 * 
 * Priority order:
 * 1. Industry-specific terminology (if workspace.industry is set)
 * 2. Custom workspace terminology (if workspace.terminology is set)
 * 3. Legacy contactScope terminology (fallback)
 * 
 * @param workspace - Workspace object with optional industry and terminology fields
 * @returns Terminology object with all UI labels
 */
export function resolveTerminologyFromWorkspace(workspace: any): Terminology {
    // Priority 1: Industry-specific terminology
    if (workspace?.industry) {
        const industry = workspace.industry as IndustryVertical;
        const industryTerms = INDUSTRY_CONFIG[industry].terminology;
        
        // Allow workspace-level custom terminology to override industry defaults
        const s = workspace?.terminology?.singular || industryTerms.entitySingular;
        const p = workspace?.terminology?.plural || industryTerms.entityPlural;
        
        return {
            singular: s,
            plural: p,
            focalPerson: 'Focal Person',
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
            dealSingular: (industryTerms as any).dealSingular || 'Deal',
            dealPlural: (industryTerms as any).dealPlural || 'Deals',
        };
    }

    // Priority 2 & 3: Custom workspace terminology or legacy contactScope
    const scope = workspace?.contactScope || 'institution';
    const terms = workspace?.terminology || DEFAULT_TERMINOLOGY[scope] || DEFAULT_TERMINOLOGY.institution;
    const s = terms.singular;
    const p = terms.plural;

    return {
        singular: s,
        plural: p,
        focalPerson: 'Focal Person',
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
        dealSingular: terms.dealSingular || 'Deal',
        dealPlural: terms.dealPlural || 'Deals',
    };
}

