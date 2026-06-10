/**
 * @fileOverview Pure deal-filtering logic shared by the Kanban board and the
 * list view. Keeping it here (rather than inline in each component) guarantees
 * the two views filter identically and makes the logic unit-testable.
 */

import type { Deal } from '@/lib/types';
import type { KanbanFilters } from '../pipeline-types';

/**
 * Applies all filter dimensions to a list of deals.
 *
 * @param deals             The full deal set for the pipeline.
 * @param filters           The active filter object (search merged in).
 * @param globalAssigneeId  Workspace-level GlobalFilter assignee. The local
 *                          `filters.assignedToId` OVERRIDES this when set.
 * @param getEntityTags     Resolver returning the tag IDs on a deal's linked
 *                          entity. Required only when `filters.tagIds` is set
 *                          (deals have no native tags). Defaults to none.
 */
export function applyDealFilters(
  deals: Deal[],
  filters: KanbanFilters,
  globalAssigneeId: string | null,
  getEntityTags: (entityId: string) => string[] = () => []
): Deal[] {
  let temp = deals;

  // A. Assignee — local filter overrides the workspace GlobalFilter.
  const effectiveAssigneeId = filters.assignedToId ?? globalAssigneeId;
  if (effectiveAssigneeId) {
    if (effectiveAssigneeId === 'unassigned') {
      temp = temp.filter(d => !d.assignedTo?.userId);
    } else {
      temp = temp.filter(d => d.assignedTo?.userId === effectiveAssigneeId);
    }
  }

  // B. Search across name, assignee, and focal contacts.
  if (filters.searchTerm) {
    const s = filters.searchTerm.toLowerCase();
    temp = temp.filter(d => {
      const nameMatch = d.name?.toLowerCase().includes(s);
      const assigneeMatch = d.assignedTo?.name?.toLowerCase().includes(s);
      const focalMatch = d.focalContacts?.some(fc => fc.name?.toLowerCase().includes(s));
      return nameMatch || assigneeMatch || focalMatch;
    });
  }

  // C. Status.
  if (filters.status !== 'all') {
    temp = temp.filter(d => d.status === filters.status);
  }

  // D. Value range.
  if (filters.valueMin !== null) {
    temp = temp.filter(d => (d.value ?? 0) >= filters.valueMin!);
  }
  if (filters.valueMax !== null) {
    temp = temp.filter(d => (d.value ?? 0) <= filters.valueMax!);
  }

  // E. Forecast close-date range (ISO string comparison).
  if (filters.closeDateFrom) {
    temp = temp.filter(d => d.expectedCloseDate && d.expectedCloseDate >= filters.closeDateFrom!);
  }
  if (filters.closeDateTo) {
    const upper = `${filters.closeDateTo}T23:59:59.999Z`;
    temp = temp.filter(d => d.expectedCloseDate && d.expectedCloseDate <= upper);
  }

  // F. Stage multi-select.
  if (filters.stageIds.length > 0) {
    temp = temp.filter(d => filters.stageIds.includes(d.stageId));
  }

  // G. Tag multi-select — matches against the linked entity's tags.
  if (filters.tagIds.length > 0) {
    temp = temp.filter(d => {
      const entityTags = getEntityTags(d.entityId);
      return entityTags.some(t => filters.tagIds.includes(t));
    });
  }

  return temp;
}
