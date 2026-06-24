'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { UNASSIGNED_ZONE, zoneOrUnassigned, withUnassignedZone, type ZoneRef } from '@/lib/zone-constants';

interface ZoneSelectProps {
  value?: ZoneRef | null;
  onValueChange: (value: ZoneRef) => void;
  error?: boolean;
}

export function ZoneSelect({ value, onValueChange, error }: ZoneSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();

  const zonesQuery = useMemoFirebase(
    () => (firestore && activeOrganizationId ? query(
      collection(firestore, 'zones'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc')
    ) : null),
    [firestore, activeOrganizationId]
  );
  const { data: zones, isLoading } = useCollection<Zone>(zonesQuery);

  if (isLoading) {
 return <Skeleton className="h-11 w-full rounded-xl" />;
  }

  // "Unassigned" is the default — pinned first, selected when value is null/blank.
  const resolved = zoneOrUnassigned(value);
  const options = withUnassignedZone(zones);

  return (
    <Select
      value={resolved.id}
      onValueChange={(id) => {
        if (id === UNASSIGNED_ZONE.id) {
          onValueChange(UNASSIGNED_ZONE);
          return;
        }
        const zone = zones?.find((z) => z.id === id);
        if (zone) onValueChange({ id: zone.id, name: zone.name });
      }}
    >
      <SelectTrigger
 className={cn(
          'h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold',
          'transition-all duration-150 ease-out active:scale-[0.97] active:duration-100',
          'focus:ring-1 focus:ring-primary/20',
          error && 'ring-1 ring-destructive'
        )}
      >
        <SelectValue placeholder="Assign a Geographic Zone..." />
      </SelectTrigger>
 <SelectContent className="rounded-xl">
        {options.map((zone) => (
          <SelectItem
            key={zone.id}
            value={zone.id}
            className={cn(zone.id === UNASSIGNED_ZONE.id && 'italic text-muted-foreground font-semibold')}
          >
            {zone.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
