'use client';

import { useMemo } from 'react';
import type { WorkspaceEntity } from '@/lib/types';
import type { LocationValue } from '@/components/location/LocationCascade';
import type { TagFilter as TagFilterState } from '@/components/tags/TagFilter';

// ─── Atomic Filter State ───────────────────────────────────────────
export interface DirectoryFilterState {
  search: string;
  status: string;
  location: LocationValue;
  tags: TagFilterState;
  lifecycle: string[];
  dateRange: string;
  interests?: string[];
}

export const DEFAULT_FILTERS: DirectoryFilterState = {
  search: '',
  status: 'active',
  location: {},
  tags: { tagIds: [], logic: 'OR' },
  lifecycle: [],
  dateRange: 'all',
  interests: [],
};

// ─── Date Range Boundary Helpers ───────────────────────────────────
const MS_DAY = 86_400_000;

function getDateBoundary(preset: string): number | null {
  const now = Date.now();
  switch (preset) {
    case 'today':       return now - MS_DAY;
    case 'last_7_days': return now - 7 * MS_DAY;
    case 'last_30_days': return now - 30 * MS_DAY;
    case 'last_90_days': return now - 90 * MS_DAY;
    default:            return null;
  }
}

// ─── Hook Parameters ───────────────────────────────────────────────
interface UseEntityFiltersParams {
  entities: WorkspaceEntity[] | null | undefined;
  filterState: DirectoryFilterState;
  assignedUserId?: string | null;
  tagFilteredIds: Set<string> | null;
}

// ─── Core Hook ─────────────────────────────────────────────────────
export function useEntityFilters({
  entities,
  filterState,
  assignedUserId,
  tagFilteredIds,
}: UseEntityFiltersParams) {

  // Single-pass high-performance iteration (js-combine-iterations)
  const filteredEntities = useMemo(() => {
    if (!entities || entities.length === 0) return [];

    const query = filterState.search.toLowerCase().trim();
    // Pre-build Set for O(1) lifecycle matching (js-set-map-lookups)
    const lifecycleSet = filterState.lifecycle.length > 0
      ? new Set(filterState.lifecycle)
      : null;
    const dateBoundary = getDateBoundary(filterState.dateRange);

    return entities.filter(entity => {
      // 1. Global Assignment Filter
      if (assignedUserId) {
        if (assignedUserId === 'unassigned') {
          if (entity.assignedTo?.userId) return false;
        } else {
          if (entity.assignedTo?.userId !== assignedUserId) return false;
        }
      }

      // 2. Text Search (early exit on miss)
      if (query && !entity.displayName?.toLowerCase().includes(query)) return false;

      // 3. Status Filter
      if (filterState.status !== 'all' && entity.status !== filterState.status) return false;

      // 4. Location Filters (cascading)
      if (filterState.location.country && entity.locationCountryId !== filterState.location.country.id) return false;
      if (filterState.location.region && entity.locationRegionId !== filterState.location.region.id) return false;
      if (filterState.location.district && entity.locationDistrictId !== filterState.location.district.id) return false;

      // 5. Tag Filter — server-side IDs restriction
      if (tagFilteredIds !== null && !tagFilteredIds.has(entity.entityId)) return false;

      // 6. Lifecycle Stage Filter
      if (lifecycleSet && (!entity.lifecycleStatus || !lifecycleSet.has(entity.lifecycleStatus))) return false;

      // 7. Date Added Range Filter
      if (dateBoundary !== null) {
        const addedTime = new Date(entity.addedAt).getTime();
        if (addedTime < dateBoundary) return false;
      }

      // 8. Interests Filter
      if (filterState.interests && filterState.interests.length > 0) {
        const entInterests = (entity as any).interests;
        if (!entInterests || !Array.isArray(entInterests) || entInterests.length === 0) return false;
        
        const hasMatch = entInterests.some((entInterest: any) => {
          const identifier = typeof entInterest === 'string' 
            ? entInterest 
            : (entInterest?.id || entInterest?.name || '');
            
          return filterState.interests?.includes(identifier);
        });
        
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [entities, filterState, assignedUserId, tagFilteredIds]);

  // Derived active filter count (rerender-derived-state-no-effect)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterState.search) count++;
    if (filterState.status !== 'active') count++;
    if (filterState.location.country) count++;
    if (filterState.tags.tagIds.length > 0) count++;
    if (filterState.lifecycle.length > 0) count++;
    if (filterState.dateRange !== 'all') count++;
    if (filterState.interests && filterState.interests.length > 0) count++;
    return count;
  }, [filterState]);

  // Build list of active filter descriptors for rendering capsules
  const activeFilterCapsules = useMemo(() => {
    const capsules: Array<{ id: string; label: string; value: string; onClear: () => DirectoryFilterState }> = [];

    if (filterState.search) {
      capsules.push({
        id: 'search',
        label: 'Search',
        value: `"${filterState.search}"`,
        onClear: () => ({ ...filterState, search: '' }),
      });
    }

    if (filterState.status !== 'active') {
      capsules.push({
        id: 'status',
        label: 'Status',
        value: filterState.status === 'all' ? 'All' : filterState.status.charAt(0).toUpperCase() + filterState.status.slice(1),
        onClear: () => ({ ...filterState, status: 'active' }),
      });
    }

    if (filterState.location.country) {
      const parts = [filterState.location.country.name];
      if (filterState.location.region) parts.push(filterState.location.region.name);
      if (filterState.location.district) parts.push(filterState.location.district.name);
      capsules.push({
        id: 'location',
        label: 'Location',
        value: parts.join(' › '),
        onClear: () => ({ ...filterState, location: {} }),
      });
    }

    if (filterState.tags.tagIds.length > 0) {
      capsules.push({
        id: 'tags',
        label: 'Tags',
        value: `${filterState.tags.tagIds.length} tag${filterState.tags.tagIds.length !== 1 ? 's' : ''}`,
        onClear: () => ({ ...filterState, tags: { tagIds: [], logic: 'OR' } }),
      });
    }

    if (filterState.lifecycle.length > 0) {
      capsules.push({
        id: 'lifecycle',
        label: 'Lifecycle',
        value: filterState.lifecycle.join(', '),
        onClear: () => ({ ...filterState, lifecycle: [] }),
      });
    }

    if (filterState.dateRange !== 'all') {
      const labels: Record<string, string> = {
        today: 'Today',
        last_7_days: 'Last 7 Days',
        last_30_days: 'Last 30 Days',
        last_90_days: 'Last 90 Days',
      };
      capsules.push({
        id: 'dateRange',
        label: 'Added',
        value: labels[filterState.dateRange] || filterState.dateRange,
        onClear: () => ({ ...filterState, dateRange: 'all' }),
      });
    }

    if (filterState.interests && filterState.interests.length > 0) {
      capsules.push({
        id: 'interests',
        label: 'Interests',
        value: `${filterState.interests.length} selected`,
        onClear: () => ({ ...filterState, interests: [] }),
      });
    }

    return capsules;
  }, [filterState]);

  return {
    filteredEntities,
    activeFiltersCount,
    activeFilterCapsules,
  };
}
