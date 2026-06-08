'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Region } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface RegionSelectProps {
  value?: { id: string; name: string } | null;
  onValueChange: (value: { id: string; name: string } | null) => void;
  countryId?: string | null;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
}

export function RegionSelect({
  value,
  onValueChange,
  countryId,
  disabled,
  error,
  placeholder = 'Select a region…',
  className,
}: RegionSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();

  const regionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query all regions globally, filter by country client-side to avoid composite index requirement
    return query(
      collection(firestore, 'regions'),
      orderBy('name', 'asc'),
    );
  }, [firestore]);

  const { data: allRegions, isLoading } = useCollection<Region>(regionsQuery);

  // Client-side filter by countryId
  const regions = React.useMemo(() => {
    if (!allRegions || !countryId) return [];
    return allRegions.filter(r => r.countryId === countryId);
  }, [allRegions, countryId]);

  const isDisabled = disabled || !countryId;

  if (isLoading && countryId) {
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
        const r = regions?.find(x => x.id === id);
        if (r) onValueChange({ id: r.id, name: r.name });
      }}
      disabled={isDisabled}
    >
      <SelectTrigger
        className={cn(
          className || 'h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all',
          error && 'ring-1 ring-destructive',
          isDisabled && 'opacity-50',
        )}
      >
        <SelectValue placeholder={isDisabled ? 'Select a country first' : placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl max-h-[280px]">
        {value && (
          <SelectItem value="__clear__" className="text-xs text-muted-foreground italic">
            Clear selection
          </SelectItem>
        )}
        {regions.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            No regions defined. Add them in Settings.
          </div>
        ) : (
          regions.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="font-semibold text-sm">{r.name}</span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
