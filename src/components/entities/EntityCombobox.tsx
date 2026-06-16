'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useFirestore } from '@/firebase';
import { useEntitySearch, type SearchedEntity } from '@/hooks/use-entity-search';
import { useEntityResolver } from '@/context/EntityCacheContext';

export interface EntityComboboxProps {
  /** Selected value (an entityId or doc id per `valueKey`), or `noneValue`. */
  value?: string | null;
  /** Receives the new value and (when a real entity was picked) the entity, so
   *  consumers can sync denormalized fields like name/logo. */
  onChange: (value: string, entity?: SearchedEntity) => void;
  /**
   * Which key the consumer stores. `'entityId'` (canonical, default) or `'id'`
   * (the workspace_entities document id). Determines what `onChange` emits and
   * how the selected label is resolved.
   */
  valueKey?: 'entityId' | 'id';
  placeholder?: string;
  /** When set, renders a "clear/none" option with this label. */
  noneLabel?: string;
  /** Value emitted for the none option (default 'none'). */
  noneValue?: string;
  /** Extra equality filters passed to the search, e.g. status. */
  filters?: Array<{ field: string; value: unknown }>;
  className?: string;
  disabled?: boolean;
}

const keyOf = (e: SearchedEntity, valueKey: 'entityId' | 'id') =>
  (valueKey === 'id' ? e.id : e.entityId) ?? e.id;

/**
 * Reusable entity picker backed by paginated server-side search (Phase 5.2).
 * Replaces inline `<Select>{entities.map(...)}</Select>` dropdowns that loaded
 * the whole workspace. Resolves the currently-selected entity's name by id so
 * it still displays even when not in the current search page.
 */
export function EntityCombobox({
  value,
  onChange,
  valueKey = 'entityId',
  placeholder = 'Select…',
  noneLabel,
  noneValue = 'none',
  filters,
  className,
  disabled,
}: EntityComboboxProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const { results, hasMore, loadMore } = useEntitySearch({
    search,
    enabled: open,
    pageSize: 25,
    filters,
  });

  // Resolve the selected value's name (it may not be in the current page).
  const { entitiesById, resolveIds } = useEntityResolver();
  const [resolvedLabel, setResolvedLabel] = React.useState<string | null>(null);
  const isNone = !value || value === noneValue;

  React.useEffect(() => {
    if (isNone) {
      setResolvedLabel(null);
      return;
    }
    const inResults = results.find((r) => keyOf(r, valueKey) === value);
    if (inResults) {
      setResolvedLabel(inResults.displayName ?? null);
      return;
    }
    if (valueKey === 'entityId') {
      resolveIds([value as string]); // populates entitiesById
    } else if (firestore) {
      let active = true;
      getDoc(doc(firestore, 'workspace_entities', value as string)).then((s) => {
        if (active && s.exists()) setResolvedLabel((s.data() as { displayName?: string }).displayName ?? null);
      });
      return () => {
        active = false;
      };
    }
  }, [isNone, value, valueKey, results, resolveIds, firestore]);

  const selectedLabel = React.useMemo(() => {
    if (isNone) return noneLabel ?? placeholder;
    return (
      resolvedLabel ||
      (valueKey === 'entityId' ? entitiesById.get(value as string)?.displayName : undefined) ||
      results.find((r) => keyOf(r, valueKey) === value)?.displayName ||
      placeholder
    );
  }, [isNone, noneLabel, placeholder, resolvedLabel, valueKey, entitiesById, value, results]);

  const select = (v: string, entity?: SearchedEntity) => {
    onChange(v, entity);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-11 w-full justify-between rounded-xl border-border bg-background font-medium', className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {noneLabel && (
                <CommandItem value={noneValue} onSelect={() => select(noneValue)}>
                  <Check className={cn('mr-2 h-4 w-4', isNone ? 'opacity-100' : 'opacity-0')} />
                  {noneLabel}
                </CommandItem>
              )}
              {results.map((e) => {
                const k = keyOf(e, valueKey);
                return (
                  <CommandItem key={e.id} value={k} onSelect={() => select(k, e)}>
                    <Check className={cn('mr-2 h-4 w-4', value === k ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{e.displayName}</span>
                  </CommandItem>
                );
              })}
              {hasMore && (
                <CommandItem
                  value="__load_more__"
                  onSelect={() => loadMore()}
                  className="justify-center text-[10px] font-bold text-primary"
                >
                  Load more…
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
