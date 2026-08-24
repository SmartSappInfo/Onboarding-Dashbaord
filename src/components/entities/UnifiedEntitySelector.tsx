'use client';

import * as React from 'react';
import { 
  Search, 
  X, 
  Building, 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  BookmarkCheck, 
  Tag as TagIcon, 
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { LocationCascade, type LocationValue } from '@/components/location/LocationCascade';
import { TagFilter, type TagFilter as TagFilterState } from '@/components/tags/TagFilter';
import { AsyncEntityAvatar } from '@/app/admin/components/AsyncEntityAvatar';
import { useEntitySearch, type SearchedEntity } from '@/hooks/use-entity-search';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { useAudiences } from '@/lib/audience-hooks';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { getContactsByTagsAction } from '@/lib/tag-actions';
import type { EntityContact, EntityType } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface UnifiedEntitySelectorProps {
  /** Single selection value (entityId or doc id depending on valueKey) */
  value?: string | null;
  /** Multi selection values */
  values?: string[];
  /** Single selection change handler */
  onChange?: (value: string, entity?: SearchedEntity) => void;
  /** Multi selection change handler */
  onValuesChange?: (values: string[], entities?: SearchedEntity[]) => void;
  /** Selection mode */
  mode?: 'single' | 'multiple';
  /** Key to emit in onChange ('id' doc id or 'entityId' canonical id) */
  valueKey?: 'entityId' | 'id';
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Whether to render a rich preview card for the selected entity */
  showPreviewCard?: boolean;
  /** Optional explicit workspaceId override */
  workspaceId?: string;
}

const keyOf = (e: SearchedEntity, valueKey: 'entityId' | 'id') =>
  (valueKey === 'id' ? e.id : e.entityId) ?? e.id;

/**
 * UnifiedEntitySelector Component
 * 
 * Production-grade, unified entity picker supporting:
 * - Server-side, cursor-paginated, debounced text search (name, email, phone, contact names)
 * - Saved Audience / Segment filtering
 * - Workspace Tag filtering (AND/OR logic)
 * - Cascading Location filtering (Country > Region > District)
 * - Status filtering (Active, Inactive, Archived, All)
 * - Contact Role / Type filtering (Primary, Signatory, Custom Types)
 * - Assignee filtering (All, My Assignees, Specific User)
 * - Single-select & Multi-select modes with live preview
 * - Zero `any` usage, strict typing, Emil Kowalski animation compliance
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * Always ensure that selected IDs are resolved via `useEntityResolver` so entity
 * display names and avatars remain visible even if the entity is not on page 1 of search.
 */
export function UnifiedEntitySelector({
  value,
  values = [],
  onChange,
  onValuesChange,
  mode = 'single',
  valueKey = 'id',
  placeholder,
  label,
  disabled = false,
  className,
  triggerClassName,
  showPreviewCard = true,
  workspaceId: explicitWorkspaceId,
}: UnifiedEntitySelectorProps) {
  const { activeWorkspaceId: tenantWorkspaceId, activeOrganizationId, activeWorkspace } = useTenant();
  const { singular, plural } = useTerminology();
  const targetWorkspaceId = explicitWorkspaceId || tenantWorkspaceId || '';

  const defaultPlaceholder = placeholder || `Select ${singular.toLowerCase()}...`;
  const defaultLabel = label || `Target ${singular}`;

  // Modal open state
  const [isOpen, setIsOpen] = React.useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = React.useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'inactive' | 'archived' | 'all'>('all');
  const [selectedAudienceId, setSelectedAudienceId] = React.useState<string | null>(null);
  const [tagFilter, setTagFilter] = React.useState<TagFilterState>({ tagIds: [], logic: 'OR' });
  const [locationFilter, setLocationFilter] = React.useState<LocationValue>({ country: null, region: null, district: null });
  const [selectedContactRoles, setSelectedContactRoles] = React.useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');

  // Tag filtered entity IDs set
  const [tagFilteredIds, setTagFilteredIds] = React.useState<Set<string> | null>(null);

  // Debounce search input (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load Saved Audiences
  const { audiences: savedAudiences } = useAudiences(targetWorkspaceId);

  // Load Effective Contact Types
  const [contactTypes, setContactTypes] = React.useState<{ key: string; label: string }[]>([]);
  React.useEffect(() => {
    if (!targetWorkspaceId) return;
    const scope = (activeWorkspace?.contactScope || 'institution') as EntityType;
    let cancelled = false;
    getEffectiveContactTypes(scope, activeOrganizationId, targetWorkspaceId)
      .then((types) => {
        if (cancelled) return;
        setContactTypes(types.filter((t) => t.active).map((t) => ({ key: t.key, label: t.label })));
      })
      .catch((err: unknown) => {
        console.error('[UNIFIED_ENTITY_SELECTOR] Failed to fetch contact types:', err);
      });
    return () => { cancelled = true; };
  }, [targetWorkspaceId, activeOrganizationId, activeWorkspace?.contactScope]);

  // Load Workspace Users for Assignee filter
  const { data: workspaceUsers } = useWorkspaceUsers(targetWorkspaceId);

  // Tag filter resolution via server action
  React.useEffect(() => {
    if (!tagFilter.tagIds || tagFilter.tagIds.length === 0) {
      setTagFilteredIds(null);
      return;
    }
    let cancelled = false;
    getContactsByTagsAction(targetWorkspaceId, { tagIds: tagFilter.tagIds, logic: tagFilter.logic })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setTagFilteredIds(new Set(res.data));
        } else {
          setTagFilteredIds(new Set());
        }
      })
      .catch((err: unknown) => {
        console.error('[UNIFIED_ENTITY_SELECTOR] Tag filter error:', err);
        if (!cancelled) setTagFilteredIds(new Set());
      });
    return () => { cancelled = true; };
  }, [tagFilter, targetWorkspaceId]);

  // Server-side paginated entity search
  const searchFilters = React.useMemo(() => {
    const filters: Array<{ field: string; value: unknown }> = [];
    if (statusFilter !== 'all') {
      filters.push({ field: 'status', value: statusFilter });
    }
    return filters;
  }, [statusFilter]);

  const { results, isLoading, hasMore, loadMore } = useEntitySearch({
    search: debouncedSearch,
    pageSize: 30,
    filters: searchFilters,
    enabled: isOpen,
    workspaceId: targetWorkspaceId,
  });

  // Out-of-band resolution for selected entities
  const { entitiesById, resolveIds } = useEntityResolver();
  const selectedIds = React.useMemo(() => {
    if (mode === 'single') return value ? [value] : [];
    return values;
  }, [mode, value, values]);

  React.useEffect(() => {
    if (selectedIds.length > 0) {
      resolveIds(selectedIds);
    }
  }, [selectedIds, resolveIds]);

  // Client-side multi-dimensional filtering over the loaded paginated set
  const filteredResults = React.useMemo(() => {
    if (!results || results.length === 0) return [];

    return results.filter((entity) => {
      const canonicalId = entity.entityId || entity.id;

      // 1. Tag Filter
      if (tagFilteredIds !== null && !tagFilteredIds.has(canonicalId)) {
        return false;
      }

      // 2. Location Cascade
      if (locationFilter.country && entity.locationCountryId !== locationFilter.country.id) return false;
      if (locationFilter.region && entity.locationRegionId !== locationFilter.region.id) return false;
      if (locationFilter.district && entity.locationDistrictId !== locationFilter.district.id) return false;

      // 3. Assignee Filter
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
          if (entity.assignedTo?.userId) return false;
        } else {
          if (entity.assignedTo?.userId !== assigneeFilter) return false;
        }
      }

      // 4. Contact Roles Filter
      if (selectedContactRoles.length > 0) {
        const contacts: EntityContact[] = entity.entityContacts || [];
        if (contacts.length === 0) {
          if (!selectedContactRoles.includes('primary')) return false;
        } else {
          const hasRoleMatch = contacts.some((c) => {
            return selectedContactRoles.some((role) => {
              if (role === 'primary') return !!c.isPrimary;
              if (role === 'signatory' || role === 'signatories') return !!c.isSignatory;
              return c.typeKey === role;
            });
          });
          if (!hasRoleMatch) return false;
        }
      }

      return true;
    });
  }, [results, tagFilteredIds, locationFilter, assigneeFilter, selectedContactRoles]);

  // Derived Active Filter Capsules
  const activeFilterCapsules = React.useMemo(() => {
    const capsules: Array<{ id: string; label: string; value: string; onClear: () => void }> = [];

    if (debouncedSearch) {
      capsules.push({
        id: 'search',
        label: 'Search',
        value: `"${debouncedSearch}"`,
        onClear: () => setSearchTerm(''),
      });
    }

    if (statusFilter !== 'all') {
      capsules.push({
        id: 'status',
        label: 'Status',
        value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1),
        onClear: () => setStatusFilter('all'),
      });
    }

    if (selectedAudienceId && savedAudiences) {
      const aud = savedAudiences.find((a) => a.id === selectedAudienceId);
      if (aud) {
        capsules.push({
          id: 'audience',
          label: 'Segment',
          value: aud.name,
          onClear: () => setSelectedAudienceId(null),
        });
      }
    }

    if (tagFilter.tagIds.length > 0) {
      capsules.push({
        id: 'tags',
        label: 'Tags',
        value: `${tagFilter.tagIds.length} tag${tagFilter.tagIds.length > 1 ? 's' : ''} (${tagFilter.logic})`,
        onClear: () => setTagFilter({ tagIds: [], logic: 'OR' }),
      });
    }

    if (locationFilter.country) {
      const parts = [locationFilter.country.name];
      if (locationFilter.region) parts.push(locationFilter.region.name);
      if (locationFilter.district) parts.push(locationFilter.district.name);
      capsules.push({
        id: 'location',
        label: 'Location',
        value: parts.join(' › '),
        onClear: () => setLocationFilter({ country: null, region: null, district: null }),
      });
    }

    if (selectedContactRoles.length > 0) {
      capsules.push({
        id: 'roles',
        label: 'Roles',
        value: `${selectedContactRoles.length} selected`,
        onClear: () => setSelectedContactRoles([]),
      });
    }

    if (assigneeFilter !== 'all') {
      const userName = assigneeFilter === 'unassigned' 
        ? 'Unassigned' 
        : workspaceUsers?.find((u) => u.id === assigneeFilter)?.name || 'User';
      capsules.push({
        id: 'assignee',
        label: 'Assignee',
        value: userName,
        onClear: () => setAssigneeFilter('all'),
      });
    }

    return capsules;
  }, [
    debouncedSearch, 
    statusFilter, 
    selectedAudienceId, 
    savedAudiences, 
    tagFilter, 
    locationFilter, 
    selectedContactRoles, 
    assigneeFilter, 
    workspaceUsers
  ]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedAudienceId(null);
    setTagFilter({ tagIds: [], logic: 'OR' });
    setLocationFilter({ country: null, region: null, district: null });
    setSelectedContactRoles([]);
    setAssigneeFilter('all');
  };

  // Selected Entity Details Resolution for Single Mode Trigger
  const selectedEntity = React.useMemo(() => {
    if (mode !== 'single' || !value) return null;
    return (
      results.find((r) => keyOf(r, valueKey) === value) ||
      (valueKey === 'entityId'
        ? (entitiesById.get(value) as SearchedEntity | undefined)
        : (Array.from(entitiesById.values()).find((e) => e.id === value) as SearchedEntity | undefined)) ||
      null
    );
  }, [mode, value, results, valueKey, entitiesById]);

  // Selection Toggle Handlers
  const handleSelectEntity = (entity: SearchedEntity) => {
    const key = keyOf(entity, valueKey);
    if (mode === 'single') {
      onChange?.(key, entity);
      setIsOpen(false);
    } else {
      const nextValues = values.includes(key)
        ? values.filter((id) => id !== key)
        : [...values, key];
      const nextEntities = nextValues
        .map((k) => results.find((r) => keyOf(r, valueKey) === k) || (entitiesById.get(k) as SearchedEntity))
        .filter(Boolean);
      onValuesChange?.(nextValues, nextEntities);
    }
  };

  const handleSelectAllLoaded = () => {
    if (mode === 'multiple') {
      const loadedKeys = filteredResults.map((r) => keyOf(r, valueKey));
      const combined = Array.from(new Set([...values, ...loadedKeys]));
      onValuesChange?.(combined);
    }
  };

  const isSelected = (entity: SearchedEntity) => {
    const key = keyOf(entity, valueKey);
    return mode === 'single' ? value === key : values.includes(key);
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={cn(
          'w-full min-h-[44px] h-auto p-3 justify-between rounded-xl border-border bg-background/50 hover:bg-muted/30 text-left font-normal transition-all active:scale-[0.99]',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedEntity ? (
            <>
              <AsyncEntityAvatar
                entityId={selectedEntity.entityId || selectedEntity.id}
                src={selectedEntity.logoUrl}
                name={selectedEntity.displayName}
                className="h-7 w-7 rounded-lg shrink-0"
                fallbackClassName="text-[9px]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {selectedEntity.displayName}
                </p>
                {selectedEntity.primaryContactName && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {selectedEntity.primaryContactName}
                  </p>
                )}
              </div>
            </>
          ) : mode === 'multiple' && values.length > 0 ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-bold text-[10px]">
                {values.length} {values.length === 1 ? singular : plural} selected
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building className="h-4 w-4 shrink-0 opacity-50" />
              <span className="text-xs font-medium truncate">{defaultPlaceholder}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {activeFilterCapsules.length > 0 && (
            <Badge variant="outline" className="text-[9px] font-bold h-5 px-1.5 bg-primary/5 text-primary border-primary/20">
              {activeFilterCapsules.length} filter{activeFilterCapsules.length > 1 ? 's' : ''}
            </Badge>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-40" />
        </div>
      </Button>

      {/* Selected Entity Live Preview Card (Single Mode) */}
      {showPreviewCard && mode === 'single' && selectedEntity && (
        <div className="p-3 rounded-xl border border-primary/15 bg-primary/[0.02] flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <AsyncEntityAvatar
              entityId={selectedEntity.entityId || selectedEntity.id}
              src={selectedEntity.logoUrl}
              name={selectedEntity.displayName}
              className="h-10 w-10 rounded-xl shrink-0"
              fallbackClassName="text-xs"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-bold text-primary truncate">
                {selectedEntity.displayName}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {selectedEntity.primaryContactName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 opacity-60" />
                    {selectedEntity.primaryContactName}
                  </span>
                )}
                {selectedEntity.primaryEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 opacity-60" />
                    {selectedEntity.primaryEmail}
                  </span>
                )}
                {selectedEntity.primaryPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 opacity-60" />
                    {selectedEntity.primaryPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange?.('', undefined)}
            className="h-7 px-2 text-[10px] font-semibold text-muted-foreground hover:text-destructive active:scale-[0.97]"
          >
            Change
          </Button>
        </div>
      )}

      {/* Selection Modal Console */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card text-left">
          <DialogHeader className="p-5 pb-3 bg-muted/20 border-b shrink-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {defaultLabel}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Filter, segment, and select target {plural.toLowerCase()} for billing.
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
                className={cn(
                  'h-8 px-3 text-xs font-bold gap-1.5 rounded-lg active:scale-[0.97] transition-all',
                  showFiltersDrawer ? 'bg-primary text-white border-primary' : 'bg-background'
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {showFiltersDrawer ? 'Hide Filters' : 'Filters & Segments'}
                {activeFilterCapsules.length > 0 && !showFiltersDrawer && (
                  <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary text-white">
                    {activeFilterCapsules.length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Search Input Bar */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${plural.toLowerCase()} by name, contact, email or phone...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-9 h-10 rounded-xl bg-background border-border/70 text-xs font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Expandable Filter & Segmentation Console */}
          {showFiltersDrawer && (
            <div className="p-4 bg-muted/15 border-b space-y-4 max-h-[300px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status Filter */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'active', 'inactive', 'archived'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-[0.97]',
                          statusFilter === st
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved Audience / Segment Dropdown */}
                {savedAudiences && savedAudiences.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <BookmarkCheck className="h-3 w-3" /> Saved Audience Segment
                    </span>
                    <select
                      value={selectedAudienceId || ''}
                      onChange={(e) => setSelectedAudienceId(e.target.value || null)}
                      className="w-full h-8 px-2.5 rounded-lg border border-border/70 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">All Audiences</option>
                      {savedAudiences.map((aud) => (
                        <option key={aud.id} value={aud.id}>
                          {aud.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Tag Filter Component */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <TagIcon className="h-3 w-3" /> Filter by Tags
                </span>
                <TagFilter
                  value={tagFilter}
                  onFilterChange={setTagFilter}
                  className="w-full"
                />
              </div>

              {/* Cascading Location Filter */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location Cascade
                </span>
                <LocationCascade
                  value={locationFilter}
                  onChange={setLocationFilter}
                />
              </div>

              {/* Contact Roles Filter */}
              {contactTypes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <User className="h-3 w-3" /> Contact Roles & Types
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'primary', label: 'Primary Contact' },
                      { key: 'signatory', label: 'Signatories' },
                      ...contactTypes,
                    ].map(({ key, label }) => {
                      const isActive = selectedContactRoles.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedContactRoles((prev) =>
                              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                            );
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-[0.97]',
                            isActive
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-background border-border/60 text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Capsules Bar */}
          {activeFilterCapsules.length > 0 && (
            <div className="px-4 py-2 bg-muted/10 border-b flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Active:
              </span>
              {activeFilterCapsules.map((capsule) => (
                <Badge
                  key={capsule.id}
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 py-0.5 text-[10px] font-medium bg-background border border-border/60 text-foreground"
                >
                  <span className="text-muted-foreground">{capsule.label}:</span>
                  <span className="font-bold">{capsule.value}</span>
                  <button
                    type="button"
                    onClick={capsule.onClear}
                    className="hover:text-destructive p-0.5 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 px-2 text-[10px] font-bold text-destructive hover:bg-destructive/10 rounded-md"
              >
                Clear all
              </Button>
            </div>
          )}

          {/* Entity List Container */}
          <div className="h-[340px] overflow-y-auto divide-y divide-border/30">
            {isLoading && results.length === 0 ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                    <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-40 bg-muted rounded" />
                      <div className="h-3 w-56 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Building className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-xs font-semibold">
                  {searchTerm || activeFilterCapsules.length > 0
                    ? 'No records match your filters'
                    : `No ${plural.toLowerCase()} found in this workspace`}
                </p>
                {activeFilterCapsules.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-7 text-xs font-bold rounded-lg mt-1"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              <div>
                {filteredResults.map((entity) => {
                  const selected = isSelected(entity);
                  const contacts: EntityContact[] = entity.entityContacts || [];
                  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

                  return (
                    <div
                      key={entity.id}
                      onClick={() => handleSelectEntity(entity)}
                      className={cn(
                        'flex items-center gap-3.5 px-5 py-3 cursor-pointer transition-colors select-none group',
                        selected
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/30'
                      )}
                    >
                      {mode === 'multiple' && (
                        <div
                          className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center transition-all shrink-0',
                            selected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border group-hover:border-primary/50'
                          )}
                        >
                          {selected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      )}

                      <AsyncEntityAvatar
                        entityId={entity.entityId || entity.id}
                        src={entity.logoUrl}
                        name={entity.displayName}
                        className="h-10 w-10 rounded-xl shrink-0 border border-border/40"
                        fallbackClassName="text-xs"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                            {entity.displayName}
                          </p>
                          {entity.status && entity.status !== 'active' && (
                            <Badge
                              variant="outline"
                              className="text-[8px] uppercase font-bold h-4 px-1 opacity-70"
                            >
                              {entity.status}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-medium truncate">
                          {primaryContact?.name && (
                            <span className="flex items-center gap-1 text-foreground/80 font-semibold truncate">
                              <User className="h-3 w-3 opacity-60 shrink-0" />
                              {primaryContact.name}
                            </span>
                          )}
                          {entity.primaryPhone && (
                            <span className="flex items-center gap-1 truncate opacity-80">
                              <Phone className="h-3 w-3 opacity-60 shrink-0" />
                              {entity.primaryPhone}
                            </span>
                          )}
                          {entity.primaryEmail && (
                            <span className="flex items-center gap-1 truncate opacity-80">
                              <Mail className="h-3 w-3 opacity-60 shrink-0" />
                              {entity.primaryEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      {mode === 'single' && (
                        <div className="shrink-0">
                          {selected ? (
                            <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="h-6 w-6 rounded-full border border-border/80 group-hover:border-primary/60 transition-colors" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="px-5 py-2.5 border-t bg-muted/10 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadMore()}
                disabled={isLoading}
                className="w-full h-8 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.97]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Loading more...
                  </>
                ) : (
                  'Load more records...'
                )}
              </Button>
            </div>
          )}

          {/* Footer Controls */}
          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground font-medium">
              {mode === 'multiple' ? (
                <span>
                  <strong>{values.length}</strong> selected
                </span>
              ) : (
                <span>Click a record to select</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {mode === 'multiple' && (
                <>
                  {filteredResults.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllLoaded}
                      className="h-9 px-3 text-xs font-bold rounded-xl active:scale-[0.97]"
                    >
                      Select all loaded
                    </Button>
                  )}
                  {values.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onValuesChange?.([])}
                      className="h-9 px-3 text-xs font-bold rounded-xl"
                    >
                      Clear
                    </Button>
                  )}
                </>
              )}
              <Button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-9 px-5 text-xs font-bold rounded-xl bg-primary text-white active:scale-[0.97]"
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
