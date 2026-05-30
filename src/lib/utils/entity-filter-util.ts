import type { WorkspaceEntity } from '../types';

export interface FilterStateInput {
  search: string;
  status: string;
  location: {
    country?: { id: string; name?: string; code?: string; flag?: string } | null;
    region?: { id: string; name?: string } | null;
    district?: { id: string; name?: string } | null;
  };
  tags: {
    tagIds: string[];
    logic: 'AND' | 'OR' | 'NOT';
  };
  lifecycle: string[];
  dateRange: string;
  interests?: string[];
  contactRoles?: string[];
  contactHealths?: string[];
  savedAudienceId?: string | null;
}

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

function matchPhoneNumber(storedPhone: string | undefined | null, query: string): boolean {
  if (!storedPhone) return false;
  const sClean = storedPhone.replace(/\D/g, '');
  const qClean = query.replace(/\D/g, '');
  if (!qClean) return false;
  
  if (sClean.includes(qClean) || qClean.includes(sClean)) return true;
  
  if (qClean.startsWith('0')) {
    const qCleanNoZero = qClean.slice(1);
    if (qCleanNoZero && sClean.includes(qCleanNoZero)) return true;
  }
  
  return false;
}

export function filterAndSortEntities(
  entities: any[],
  filterState: FilterStateInput,
  assignedUserId?: string | null,
  tagFilteredIds?: Set<string> | null,
  emailVerificationCache?: Record<string, { status: string; score: number }>,
  matchedEntityIds?: Set<string> | null,
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null
): any[] {
  let filtered = entities.filter(entity => {
    // 1. Saved Audience matched IDs restriction
    if (matchedEntityIds !== undefined && matchedEntityIds !== null) {
      if (!matchedEntityIds.has(entity.entityId)) {
        return false;
      }
    }

    // 2. Global Assignment Filter
    if (assignedUserId) {
      if (assignedUserId === 'unassigned') {
        if (entity.assignedTo?.userId) return false;
      } else {
        if (entity.assignedTo?.userId !== assignedUserId) return false;
      }
    }

    // 3. Status Filter
    if (filterState.status !== 'all' && entity.status !== filterState.status) return false;

    // 4. Text Search
    const searchQuery = (filterState.search || '').toLowerCase().trim();
    if (searchQuery) {
      const matchesEntityName = 
        entity.displayName?.toLowerCase().includes(searchQuery) || 
        entity.entityName?.toLowerCase().includes(searchQuery);
        
      const matchesContactName = 
        entity.primaryContactName?.toLowerCase().includes(searchQuery) ||
        entity.entityContacts?.some((c: any) => c.name?.toLowerCase().includes(searchQuery));
        
      const matchesEmail = 
        entity.primaryEmail?.toLowerCase().includes(searchQuery) ||
        entity.entityContacts?.some((c: any) => c.email?.toLowerCase().includes(searchQuery));
        
      const matchesPhone = 
        matchPhoneNumber(entity.primaryPhone, searchQuery) ||
        entity.entityContacts?.some((c: any) => matchPhoneNumber(c.phone, searchQuery));

      if (!matchesEntityName && !matchesContactName && !matchesEmail && !matchesPhone) {
        return false;
      }
    }

    // 5. Location Filters (cascading)
    if (filterState.location.country && entity.locationCountryId !== filterState.location.country.id) return false;
    if (filterState.location.region && entity.locationRegionId !== filterState.location.region.id) return false;
    if (filterState.location.district && entity.locationDistrictId !== filterState.location.district.id) return false;

    // 6. Tag Filter
    if (tagFilteredIds !== undefined && tagFilteredIds !== null && !tagFilteredIds.has(entity.entityId)) return false;

    // 7. Lifecycle Stage Filter
    if (filterState.lifecycle && filterState.lifecycle.length > 0) {
      const lifecycleSet = new Set(filterState.lifecycle);
      if (!entity.lifecycleStatus || !lifecycleSet.has(entity.lifecycleStatus)) return false;
    }

    // 8. Date Added Range Filter
    const dateBoundary = getDateBoundary(filterState.dateRange);
    if (dateBoundary !== null) {
      const addedTime = new Date(entity.addedAt).getTime();
      if (addedTime < dateBoundary) return false;
    }

    // 9. Interests Filter
    if (filterState.interests && filterState.interests.length > 0) {
      const entInterests = entity.interests;
      if (!entInterests || !Array.isArray(entInterests) || entInterests.length === 0) return false;
      
      const hasMatch = entInterests.some((entInterest: any) => {
        const identifier = typeof entInterest === 'string' 
          ? entInterest 
          : (entInterest?.id || entInterest?.name || '');
          
        return filterState.interests?.includes(identifier);
      });
      
      if (!hasMatch) return false;
    }

    // 10. Contact Roles Filter
    if (filterState.contactRoles && filterState.contactRoles.length > 0) {
      const sourceContacts = entity.entityContacts || entity.contacts || [];
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

    // 11. Contact Health Filter
    if (filterState.contactHealths && filterState.contactHealths.length > 0) {
      const sourceContacts = entity.entityContacts || entity.contacts || [];
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

  // Sort logic
  if (sortConfig) {
    const { key, direction } = sortConfig;
    filtered.sort((a, b) => {
      const getValue = (obj: any, path: string) => path.split('.').reduce((o, i) => o?.[i], obj);
      const aV = getValue(a, key);
      const bV = getValue(b, key);
      if (aV === null || aV === undefined) return 1;
      if (bV === null || bV === undefined) return -1;
      const comparison = typeof aV === 'string' 
        ? aV.localeCompare(bV, undefined, { numeric: true }) 
        : (aV < bV ? -1 : 1);
      return direction === 'asc' ? comparison : -comparison;
    });
  } else {
    // Default fallback sort: addedAt desc
    filtered.sort((a, b) => {
      const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  return filtered;
}
