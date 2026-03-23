'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Zone } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ZoneSelectProps {
  value?: { id: string; name: string } | null;
  onValueChange: (value: { id: string; name: string }) => void;
  error?: boolean;
}

export function ZoneSelect({ value, onValueChange, error }: ZoneSelectProps) {
  const firestore = useFirestore();
  const zonesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'zones'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: zones, isLoading } = useCollection<Zone>(zonesQuery);

  if (isLoading) {
    return <Skeleton className="h-11 w-full rounded-xl" />;
  }

  return (
    <Select
      value={value?.id || ''}
      onValueChange={(id) => {
        const zone = zones?.find((z) => z.id === id);
        if (zone) onValueChange({ id: zone.id, name: zone.name });
      }}
    >
      <SelectTrigger
        className={cn(
          'h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all',
          error && 'ring-1 ring-destructive'
        )}
      >
        <SelectValue placeholder="Assign a Geographic Zone..." />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {zones?.map((zone) => (
          <SelectItem key={zone.id} value={zone.id}>
            {zone.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
