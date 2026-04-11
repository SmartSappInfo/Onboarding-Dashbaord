/**
 * Shared terminology utilities for use in both Client and Server components.
 */

export interface Terminology {
  singular: string;
  plural: string;
}

export const DEFAULT_TERMINOLOGY: Record<string, Terminology> = {
  institution: { singular: 'Campus', plural: 'Campuses' },
  family: { singular: 'Family', plural: 'Families' },
  person: { singular: 'Person', plural: 'People' },
};

/**
 * Shared logic to resolve terminology from workspace data
 */
export function resolveTerminologyFromWorkspace(workspace: any) {
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
    };
}
