'use client';

import * as React from 'react';
import type { ResolvedContact, EntityContact } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, X, Building, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AsyncEntityAvatar } from '../../../components/AsyncEntityAvatar';

export interface EntitySelectorProps {
  /** Pre-loaded entities from the parent (lifted query). */
  entities: ResolvedContact[];
  isLoading: boolean;
  channel: 'email' | 'sms';
  onSelectionChange: (entityIds: string[]) => void;
  selectedEntityIds: string[];
  onContactTypeFilterChange?: (typeKeys: string[]) => void;
  activeContactTypeFilter?: string[];
  /** Kept for backward-compat with tests */
  maxSelections?: number;
}

const ENTITIES_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

function ContactChip({ contact }: { contact: EntityContact }) {
  const initials = (contact.name || '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      title={`${contact.name}${contact.typeLabel ? ` · ${contact.typeLabel}` : ''}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border/60 text-[10px] font-semibold text-foreground/80 whitespace-nowrap"
    >
      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 text-primary text-[8px] font-bold shrink-0">
        {initials}
      </span>
      <span className="max-w-[80px] truncate">{contact.name}</span>
      {contact.typeLabel && (
        <span className="text-muted-foreground/70 font-normal">· {contact.typeLabel}</span>
      )}
    </span>
  );
}

export function EntitySelector({
  entities,
  isLoading,
  onSelectionChange,
  selectedEntityIds,
  onContactTypeFilterChange,
  activeContactTypeFilter = [],
}: EntitySelectorProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showSelectAllDialog, setShowSelectAllDialog] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Collect all unique contact type keys
  const allContactTypes = React.useMemo<{ key: string; label: string }[]>(() => {
    const seen = new Map<string, string>();
    entities.forEach(e => {
      (e.entityContacts || []).forEach(c => {
        if (c.typeKey && !seen.has(c.typeKey)) seen.set(c.typeKey, c.typeLabel || c.typeKey);
      });
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [entities]);

  // Filter
  const filtered = React.useMemo(() => {
    const lower = debouncedSearch.toLowerCase().trim();
    
    // 1. First filter by contact type if active
    let pool = entities;
    if (activeContactTypeFilter.length > 0) {
      pool = entities.filter(e => 
        (e.entityContacts || []).some(c => activeContactTypeFilter.includes(c.typeKey || ''))
      );
    }

    if (!lower) return pool;
    return pool.filter(e => {
      const nameMatch = e.name?.toLowerCase().includes(lower);
      const typeMatch = e.entityType?.toLowerCase().includes(lower);
      const contactMatch = (e.entityContacts || []).some(c =>
        c.name?.toLowerCase().includes(lower) ||
        c.typeLabel?.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower)
      );
      return nameMatch || typeMatch || contactMatch;
    });
  }, [entities, debouncedSearch]);

  const totalPages = Math.ceil(filtered.length / ENTITIES_PER_PAGE);
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * ENTITIES_PER_PAGE;
    return filtered.slice(start, start + ENTITIES_PER_PAGE);
  }, [filtered, currentPage]);

  const selectedEntities = React.useMemo(
    () => entities.filter(e => selectedEntityIds.includes(e.entityId || e.id)),
    [entities, selectedEntityIds]
  );

  const toggle = (eid: string) => {
    onSelectionChange(
      selectedEntityIds.includes(eid)
        ? selectedEntityIds.filter(id => id !== eid)
        : [...selectedEntityIds, eid]
    );
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, contact, or type…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/30 border-border/50"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Contact-type filter chips */}
      {allContactTypes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            <Filter className="h-3 w-3" /> Filter by contact type
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onContactTypeFilterChange?.([])}
              className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all',
                activeContactTypeFilter.length === 0 ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/40'
              )}
            >
              All contacts
            </button>
            {allContactTypes.map(({ key, label }) => {
              const isActive = activeContactTypeFilter.includes(key);
              return (
                <button key={key}
                  type="button"
                  onClick={() => {
                    const next = isActive 
                      ? activeContactTypeFilter.filter(k => k !== key)
                      : [...activeContactTypeFilter, key];
                    onContactTypeFilterChange?.(next);
                  }}
                  className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all capitalize',
                    isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/40'
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
          <span className="text-xs text-muted-foreground">{filtered.length} available</span>
        </div>
        <div className="flex gap-2">
          {selectedEntityIds.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => onSelectionChange([])}>Clear all</Button>
          )}
          {filtered.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setShowSelectAllDialog(true)}>Select all</Button>
          )}
        </div>
      </div>

      {/* Selected strip */}
      {selectedEntities.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Selected</p>
          <div className="max-h-28 overflow-y-auto pr-2">
            <div className="space-y-1.5">
              {selectedEntities.map(entity => {
                const eid = entity.entityId || entity.id;
                return (
                  <div key={eid} className="flex items-center justify-between gap-2 py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <AsyncEntityAvatar entityId={eid} src={entity.logoUrl} name={entity.name} className="h-6 w-6 rounded-md shrink-0" fallbackClassName="text-[7px]" />
                      <span className="text-xs font-semibold truncate">{entity.name}</span>
                    </div>
                    <button type="button" onClick={() => onSelectionChange(selectedEntityIds.filter(id => id !== eid))}>
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

        {isLoading ? (
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
        ) : paginated.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building className="h-7 w-7 mx-auto mb-2 opacity-40" />
            <p className="text-xs">{searchTerm ? 'No contacts match your search' : 'No contacts in this workspace'}</p>
          </div>
        ) : (
          <div className="h-[420px] overflow-y-auto">
            <div className="divide-y divide-border/40">
              {paginated.map(entity => {
                const eid = entity.entityId || entity.id;
                const isSelected = selectedEntityIds.includes(eid);
                const contacts: EntityContact[] = entity.entityContacts || [];
                const visibleContacts = activeContactTypeFilter.length > 0
                  ? contacts.filter(c => activeContactTypeFilter.includes(c.typeKey || ''))
                  : contacts;

                return (
                  <div key={eid} onClick={() => toggle(eid)}
                    className={cn('flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none',
                      isSelected ? 'bg-primary/[0.04]' : 'hover:bg-muted/40'
                    )}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => toggle(eid)} 
                      onClick={e => e.stopPropagation()} 
                      className="mt-2 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 accent-primary cursor-pointer" 
                    />
                    <AsyncEntityAvatar entityId={eid} src={entity.logoUrl} name={entity.name} className="h-9 w-9 rounded-xl shrink-0 mt-0.5" fallbackClassName="text-[10px]" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-bold leading-tight truncate text-primary">{entity.name}</p>
                      {visibleContacts.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground font-medium truncate">
                          {visibleContacts.map(c => c.name).join(', ')}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
            <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showSelectAllDialog} onOpenChange={setShowSelectAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select all {filtered.length} contacts?</AlertDialogTitle>
            <AlertDialogDescription>This will queue approximately {filtered.length} messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onSelectionChange(filtered.map(e => e.entityId || e.id)); setShowSelectAllDialog(false); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
