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
  contactRoles?: string[];
  contactHealths?: string[];
}

export const DEFAULT_FILTERS: DirectoryFilterState = {
  search: '',
  status: 'active',
  location: {},
  tags: { tagIds: [], logic: 'OR' },
  lifecycle: [],
  dateRange: 'all',
  interests: [],
  contactRoles: [],
  contactHealths: [],
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

// Helper function to match query against phone numbers in different formats
function matchPhoneNumber(storedPhone: string | undefined | null, query: string): boolean {
  if (!storedPhone) return false;
  const sClean = storedPhone.replace(/\D/g, '');
  const qClean = query.replace(/\D/g, '');
  if (!qClean) return false;
  
  // Direct substring match
  if (sClean.includes(qClean) || qClean.includes(sClean)) return true;
  
  // Handle local Ghana zero leading format matching E.164 (without zero, with country code)
  if (qClean.startsWith('0')) {
    const qCleanNoZero = qClean.slice(1);
    if (qCleanNoZero && sClean.includes(qCleanNoZero)) return true;
  }
  
  return false;
}

// ─── Hook Parameters ───────────────────────────────────────────────
interface UseEntityFiltersParams {
  entities: WorkspaceEntity[] | null | undefined;
  filterState: DirectoryFilterState;
  assignedUserId?: string | null;
  tagFilteredIds: Set<string> | null;
  emailVerificationCache?: Record<string, { status: string; score: number }>;
}

// ─── Core Hook ─────────────────────────────────────────────────────
export function useEntityFilters({
  entities,
  filterState,
  assignedUserId,
  tagFilteredIds,
  emailVerificationCache,
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
      if (query) {
        const matchesEntityName = 
          entity.displayName?.toLowerCase().includes(query) || 
          entity.entityName?.toLowerCase().includes(query);
          
        const matchesContactName = 
          entity.primaryContactName?.toLowerCase().includes(query) ||
          entity.entityContacts?.some(c => c.name?.toLowerCase().includes(query));
          
        const matchesEmail = 
          entity.primaryEmail?.toLowerCase().includes(query) ||
          entity.entityContacts?.some(c => c.email?.toLowerCase().includes(query));
          
        const matchesPhone = 
          matchPhoneNumber(entity.primaryPhone, query) ||
          entity.entityContacts?.some(c => matchPhoneNumber(c.phone, query));

        if (!matchesEntityName && !matchesContactName && !matchesEmail && !matchesPhone) {
          return false;
        }
      }

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

      // 9. Contact Roles Filter
      if (filterState.contactRoles && filterState.contactRoles.length > 0) {
        const sourceContacts = entity.entityContacts || (entity as any).contacts || [];
        if (sourceContacts.length === 0) {
          const hasPrimarySelected = filterState.contactRoles.includes('primary');
          if (!hasPrimarySelected) return false;
        } else {
          const hasMatchingContact = sourceContacts.some((c: any) => {
            return filterState.contactRoles!.some(role => {
              if (role === 'primary') return !!c.isPrimary;
              if (role === 'signatories' || role === 'signatory') return !!c.isSignatory;
              const cleanRole = role.startsWith('role:') ? role.substring(5) : role;
              return c.typeKey === cleanRole;
            });
          });
          if (!hasMatchingContact) return false;
        }
      }

      // 10. Contact Health Filter
      if (filterState.contactHealths && filterState.contactHealths.length > 0) {
        const sourceContacts = entity.entityContacts || (entity as any).contacts || [];
        if (sourceContacts.length === 0) {
          const hasUncheckedSelected = filterState.contactHealths.includes('unchecked');
          if (!hasUncheckedSelected) return false;
        } else {
          const hasMatchingContact = sourceContacts.some((c: any) => {
            const email = c.email?.toLowerCase().trim() || '';
            const status = email && emailVerificationCache ? (emailVerificationCache[email]?.status || 'unchecked') : 'unchecked';
            return filterState.contactHealths!.includes(status);
          });
          if (!hasMatchingContact) return false;
        }
      }

      return true;
    });
  }, [entities, filterState, assignedUserId, tagFilteredIds, emailVerificationCache]);

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
    if (filterState.contactRoles && filterState.contactRoles.length > 0) count++;
    if (filterState.contactHealths && filterState.contactHealths.length > 0) count++;
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

    if (filterState.contactRoles && filterState.contactRoles.length > 0) {
      capsules.push({
        id: 'contactRoles',
        label: 'Roles',
        value: filterState.contactRoles.map(role => {
          if (role === 'primary') return 'Primary';
          if (role === 'signatories') return 'Signatory';
          if (role.startsWith('role:')) return role.substring(5).charAt(0).toUpperCase() + role.substring(5).slice(1);
          return role;
        }).join(', '),
        onClear: () => ({ ...filterState, contactRoles: [] }),
      });
    }

    if (filterState.contactHealths && filterState.contactHealths.length > 0) {
      capsules.push({
        id: 'contactHealths',
        label: 'Health',
        value: filterState.contactHealths.map(h => {
          if (h === 'likely_valid') return 'Likely Valid';
          return h.charAt(0).toUpperCase() + h.slice(1);
        }).join(', '),
        onClear: () => ({ ...filterState, contactHealths: [] }),
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
