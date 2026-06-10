/**
 * @fileOverview Shared types for the Pipeline / Deals views.
 *
 * Centralises the filter shape used by the board, the list view, and the
 * PipelineClient toolbar so the three stay in sync (avoids silent drift when
 * a new filter dimension is added).
 */

export type DealStatusFilter = 'open' | 'won' | 'lost' | 'all';

export interface KanbanFilters {
  /** Free-text search across deal name and assignee. */
  searchTerm: string;
  /** Deal lifecycle status. */
  status: DealStatusFilter;
  /**
   * Local assignee filter. When set, OVERRIDES the workspace-level
   * GlobalFilter (see KanbanBoard). `null` means "no local override".
   */
  assignedToId: string | null;
  /** Inclusive minimum deal value. `null` = unbounded. */
  valueMin: number | null;
  /** Inclusive maximum deal value. `null` = unbounded. */
  valueMax: number | null;
  /** Inclusive lower bound for expected close date (ISO yyyy-mm-dd). */
  closeDateFrom: string | null;
  /** Inclusive upper bound for expected close date (ISO yyyy-mm-dd). */
  closeDateTo: string | null;
  /** Stage multi-select. Empty array = all stages. */
  stageIds: string[];
  /**
   * Tag multi-select. A deal matches when its linked entity carries any of
   * these tag IDs (deals have no native tags). Empty array = all tags.
   */
  tagIds: string[];
}

export const DEFAULT_FILTERS: KanbanFilters = {
  searchTerm: '',
  status: 'all',
  assignedToId: null,
  valueMin: null,
  valueMax: null,
  closeDateFrom: null,
  closeDateTo: null,
  stageIds: [],
  tagIds: [],
};

/** True when any filter dimension is active (search excluded — it has its own UI). */
export function isFilterActive(f: KanbanFilters): boolean {
  return (
    f.status !== 'all' ||
    f.assignedToId !== null ||
    f.valueMin !== null ||
    f.valueMax !== null ||
    f.closeDateFrom !== null ||
    f.closeDateTo !== null ||
    f.stageIds.length > 0 ||
    f.tagIds.length > 0
  );
}

/** Number of active filter dimensions, for the badge counter. */
export function activeFilterCount(f: KanbanFilters): number {
  return [
    f.status !== 'all',
    f.assignedToId !== null,
    f.valueMin !== null || f.valueMax !== null,
    f.closeDateFrom !== null || f.closeDateTo !== null,
    f.stageIds.length > 0,
    f.tagIds.length > 0,
  ].filter(Boolean).length;
}
