'use client';

import * as React from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Country } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface CountrySelectProps {
  value?: { id: string; name: string; code: string; flag: string } | null;
  onValueChange: (value: { id: string; name: string; code: string; flag: string } | null) => void;
  defaultCountryId?: string; // e.g. "GH"
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
}

export function CountrySelect({
  value,
  onValueChange,
  defaultCountryId,
  disabled,
  error,
  placeholder = 'Select a country…',
  className,
}: CountrySelectProps) {
  const firestore = useFirestore();
  const [search, setSearch] = React.useState('');

  const countriesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'countries'), orderBy('name', 'asc')) : null),
    [firestore],
  );
  const { data: countries, isLoading } = useCollection<Country>(countriesQuery);

  // Auto-select default country on first mount if no value set
  React.useEffect(() => {
    if (!value && defaultCountryId && countries && countries.length > 0) {
      const defaultCountry = countries.find(c => c.code === defaultCountryId || c.id === defaultCountryId);
      if (defaultCountry) {
        onValueChange({
          id: defaultCountry.id,
          name: defaultCountry.name,
          code: defaultCountry.code,
          flag: defaultCountry.flag,
        });
      }
    }
    // Only run on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries]);

  const filtered = React.useMemo(() => {
    if (!countries) return [];
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, search]);

  // Separate Ghana (or default) to pin it at top
  const { pinned, rest } = React.useMemo(() => {
    const pinnedId = defaultCountryId || 'GH';
    const pinnedCountry = filtered.find(c => c.code === pinnedId || c.id === pinnedId);
    const remaining = filtered.filter(c => c.code !== pinnedId && c.id !== pinnedId);
    return { pinned: pinnedCountry, rest: remaining };
  }, [filtered, defaultCountryId]);

  if (isLoading) {
    return <Skeleton className="h-11 w-full rounded-xl" />;
  }

  return (
    <Select
      value={value?.id || ''}
      onValueChange={(id) => {
        if (id === '__clear__') {
          onValueChange(null);
          return;
        }
        const c = countries?.find(x => x.id === id);
        if (c) onValueChange({ id: c.id, name: c.name, code: c.code, flag: c.flag });
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          className || 'h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all',
          error && 'ring-1 ring-destructive',
        )}
      >
        <SelectValue placeholder={placeholder}>
          {value && (
            <span className="flex items-center gap-2">
              <span className="text-base">{value.flag}</span>
              <span>{value.name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl max-h-[280px]">
        {/* Search inside dropdown */}
        <div className="px-2 pb-2 pt-1 sticky top-0 bg-popover z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search countries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 rounded-lg text-xs bg-muted/30 border-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {value && (
          <SelectItem value="__clear__" className="text-xs text-muted-foreground italic">
            Clear selection
          </SelectItem>
        )}

        {pinned && (
          <SelectGroup>
            <SelectLabel className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-2">
              Default
            </SelectLabel>
            <SelectItem value={pinned.id}>
              <span className="flex items-center gap-2.5">
                <span className="text-base">{pinned.flag}</span>
                <span className="font-semibold text-sm">{pinned.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{pinned.code}</span>
              </span>
            </SelectItem>
          </SelectGroup>
        )}

        <SelectGroup>
          <SelectLabel className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-2">
            All Countries
          </SelectLabel>
          {rest.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2.5">
                <span className="text-base">{c.flag}</span>
                <span className="font-semibold text-sm">{c.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{c.code}</span>
              </span>
            </SelectItem>
          ))}
          {rest.length === 0 && !pinned && (
            <div className="text-center py-4 text-xs text-muted-foreground">No countries found</div>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
