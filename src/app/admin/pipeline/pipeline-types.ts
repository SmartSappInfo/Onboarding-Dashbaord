/**
 * @fileOverview Shared types for the Pipeline / Deals views.
 *
 * Centralises the filter shape used by the board, the list view, and the
 * PipelineClient toolbar so the three stay in sync (avoids silent drift when
 * a new filter dimension is added).
 */

import type { DealFilterTree } from '@/lib/deals/deal-saved-views';

export type DealStatusFilter = 'open' | 'won' | 'lost' | 'all';
export type DealHealthFilter = 'healthy' | 'at_risk' | 'stalled' | 'all';
export type DealArchiveFilter = 'active' | 'archived' | 'all';
export type PipelineViewMode = 'overview' | 'board' | 'list' | 'forecast' | 'config' | 'actions';

export interface KanbanFilters {
  /** Free-text search across deal name and assignee. */
  searchTerm: string;
  /** Deal lifecycle status. */
  status: DealStatusFilter;
  /** Deal health status filter. */
  healthStatus?: DealHealthFilter;
  /** Deal archive status filter ('active' default, 'archived', 'all'). */
  archiveStatus?: DealArchiveFilter;
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
  /** Dynamic advanced multi-condition filter rule tree (Phase 6). */
  filterTree?: DealFilterTree | null;
}

export const DEFAULT_FILTERS: KanbanFilters = {
  searchTerm: '',
  status: 'all',
  healthStatus: 'all',
  archiveStatus: 'active',
  assignedToId: 'all',
  valueMin: null,
  valueMax: null,
  closeDateFrom: null,
  closeDateTo: null,
  stageIds: [],
  tagIds: [],
  filterTree: null,
};

/** True when any filter dimension is active (search excluded — it has its own UI). */
export function isFilterActive(f: KanbanFilters): boolean {
  return (
    f.status !== 'all' ||
    (f.healthStatus && f.healthStatus !== 'all') ||
    (f.archiveStatus && f.archiveStatus !== 'active') ||
    (f.assignedToId !== null && f.assignedToId !== 'all') ||
    f.valueMin !== null ||
    f.valueMax !== null ||
    f.closeDateFrom !== null ||
    f.closeDateTo !== null ||
    f.stageIds.length > 0 ||
    f.tagIds.length > 0 ||
    Boolean(f.filterTree && f.filterTree.groups && f.filterTree.groups.length > 0)
  );
}

/** Number of non-default filter dimensions active. */
export function activeFilterCount(f: KanbanFilters): number {
  let count = 0;
  if (f.status !== 'all') count++;
  if (f.healthStatus && f.healthStatus !== 'all') count++;
  if (f.archiveStatus && f.archiveStatus !== 'active') count++;
  if (f.assignedToId !== null && f.assignedToId !== 'all') count++;
  if (f.valueMin !== null || f.valueMax !== null) count++;
  if (f.closeDateFrom !== null || f.closeDateTo !== null) count++;
  if (f.stageIds.length > 0) count++;
  if (f.tagIds.length > 0) count++;
  if (f.filterTree && f.filterTree.groups && f.filterTree.groups.length > 0) {
    count += f.filterTree.groups.reduce((acc, g) => acc + (g.rules?.length || 0), 0);
  }
  return count;
}


