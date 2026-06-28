'use client';

import * as React from 'react';
import type { EntityContact, EntityType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, X, Building, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AsyncEntityAvatar } from '../../../components/AsyncEntityAvatar';
import { useEntitySearch, type SearchedEntity } from '@/hooks/use-entity-search';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useTenant } from '@/context/TenantContext';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';

export interface EntitySelectorProps {
  channel: 'email' | 'sms';
  onSelectionChange: (entityIds: string[]) => void;
  selectedEntityIds: string[];
  onContactTypeFilterChange?: (typeKeys: string[]) => void;
  activeContactTypeFilter?: string[];
  /** Kept for backward-compat with callers/tests. */
  maxSelections?: number;
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const eidOf = (e: { entityId?: string; id: string }) => e.entityId || e.id;

export function EntitySelector({
  onSelectionChange,
  selectedEntityIds,
  onContactTypeFilterChange,
  activeContactTypeFilter = [],
}: EntitySelectorProps) {
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace } = useTenant();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [showSelectAllDialog, setShowSelectAllDialog] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Server-side, paginated entity search (replaces the streamed full set).
  const { results, isLoading, hasMore, loadMore } = useEntitySearch({
    search: debouncedSearch,
    pageSize: PAGE_SIZE,
  });

  // Resolve the selected entities (which may be off the current page) for the strip.
  const { entitiesById, resolveIds } = useEntityResolver();
  React.useEffect(() => {
    if (selectedEntityIds.length) resolveIds(selectedEntityIds);
  }, [selectedEntityIds, resolveIds]);
  const selectedEntities = React.useMemo(
    () => selectedEntityIds.map((id) => entitiesById.get(id)).filter(Boolean) as SearchedEntity[],
    [selectedEntityIds, entitiesById],
  );

  // Contact-type chips come from the workspace's effective contact types
  // (authoritative), not from scanning the entity set.
  const [contactTypes, setContactTypes] = React.useState<{ key: string; label: string }[]>([]);
  React.useEffect(() => {
    if (!activeWorkspaceId) return;
    const scope = (activeWorkspace?.contactScope || 'institution') as EntityType;
    let cancelled = false;
    getEffectiveContactTypes(scope, activeOrganizationId, activeWorkspaceId)
      .then((types) => {
        if (cancelled) return;
        setContactTypes(types.filter((t) => t.active).map((t) => ({ key: t.key, label: t.label })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeWorkspace?.contactScope, activeOrganizationId, activeWorkspaceId]);

  const toggle = (eid: string) => {
    onSelectionChange(
      selectedEntityIds.includes(eid)
        ? selectedEntityIds.filter((id) => id !== eid)
        : [...selectedEntityIds, eid],
    );
  };

  const handleSelectAllLoaded = () => {
    const ids = results.map(eidOf);
    onSelectionChange([...new Set([...selectedEntityIds, ...ids])]);
    setShowSelectAllDialog(false);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/30 border-border/50"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Contact-type filter chips */}
      {contactTypes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            <Filter className="h-3 w-3" /> Filter by contact type
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onContactTypeFilterChange?.([])}
              className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all',
                activeContactTypeFilter.length === 0 ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/40',
              )}
            >
              All contacts
            </button>
            {contactTypes.map(({ key, label }) => {
              const isActive = activeContactTypeFilter.includes(key);
              return (
                <button key={key}
                  type="button"
                  onClick={() => {
                    const next = isActive
                      ? activeContactTypeFilter.filter((k) => k !== key)
                      : [...activeContactTypeFilter, key];
                    onContactTypeFilterChange?.(next);
                  }}
                  className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all capitalize',
                    isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-bold">{selectedEntityIds.length} selected</Badge>
        </div>
        <div className="flex gap-2">
          {selectedEntityIds.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => onSelectionChange([])}>Clear all</Button>
          )}
          {results.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setShowSelectAllDialog(true)}>Select all loaded</Button>
          )}
        </div>
      </div>

      {/* Selected strip */}
      {selectedEntities.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Selected</p>
          <div className="max-h-28 overflow-y-auto pr-2">
            <div className="space-y-1.5">
              {selectedEntities.map((entity) => {
                const eid = eidOf(entity);
                return (
                  <div key={eid} className="flex items-center justify-between gap-2 py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <AsyncEntityAvatar entityId={eid} src={entity.logoUrl} name={entity.displayName} className="h-6 w-6 rounded-md shrink-0" fallbackClassName="text-[7px]" />
                      <span className="text-xs font-semibold truncate">{entity.displayName}</span>
                    </div>
                    <button type="button" onClick={() => onSelectionChange(selectedEntityIds.filter((id) => id !== eid))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Entity list */}
      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available Contacts</p>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {isLoading && results.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-9 w-9 rounded-xl bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-40 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-56 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building className="h-7 w-7 mx-auto mb-2 opacity-40" />
            <p className="text-xs">{searchTerm ? 'No contacts match your search' : 'No contacts in this workspace'}</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <div className="divide-y divide-border/40">
              {results.map((entity) => {
                const eid = eidOf(entity);
                const isSelected = selectedEntityIds.includes(eid);
                const contacts: EntityContact[] = entity.entityContacts || [];
                const visibleContacts = activeContactTypeFilter.length > 0
                  ? contacts.filter((c) => activeContactTypeFilter.includes(c.typeKey || ''))
                  : contacts;

                return (
                  <div key={eid} onClick={() => toggle(eid)}
                    className={cn('flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none',
                      isSelected ? 'bg-primary/[0.04]' : 'hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(eid)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 accent-primary cursor-pointer"
                    />
                    <AsyncEntityAvatar entityId={eid} src={entity.logoUrl} name={entity.displayName} className="h-9 w-9 rounded-xl shrink-0 mt-0.5" fallbackClassName="text-[10px]" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-bold leading-tight truncate text-primary">{entity.displayName}</p>
                      {visibleContacts.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground font-medium truncate">
                          {visibleContacts.map((c) => c.name).join(', ')}
                        </p>
                      ) : contacts.length > 0 && activeContactTypeFilter.length > 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">No matching contacts found</p>
                      ) : contacts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic opacity-60">No contacts recorded</p>
                      ) : null}
                    </div>
                    {isSelected && <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasMore && (
          <div className="px-4 py-3 border-t bg-muted/10">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="w-full py-1.5 text-center text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={showSelectAllDialog} onOpenChange={setShowSelectAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select all {results.length} loaded contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This selects the entities currently loaded. To reach a larger audience, load more or use the tag-based audience for bulk sends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSelectAllLoaded}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
