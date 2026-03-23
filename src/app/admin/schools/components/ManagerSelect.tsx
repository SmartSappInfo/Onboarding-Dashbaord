'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';

interface ManagerSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

/**
 * @fileOverview Robust Manager selection component.
 * Encapsulates data fetching and fallback mapping for 'unassigned' state.
 */
export function ManagerSelect({ value, onValueChange, error, disabled }: ManagerSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'users'), 
        where('organizationId', '==', activeOrganizationId),
        where('isAuthorized', '==', true), 
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);
  
  const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-xl" />;
  }

  // Robust mapping: ensure internal Select always has a string that matches an item
  const safeValue = value || 'unassigned';

  return (
    <Select value={safeValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger 
        className={cn(
            "h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all", 
            error && "ring-1 ring-destructive"
        )}
      >
        <SelectValue placeholder="Assign to team member..." />
      </SelectTrigger>
      <SelectContent className="rounded-xl shadow-2xl border-none">
        <SelectItem value="unassigned" className="font-bold italic opacity-60">Unassigned</SelectItem>
        {users?.map(u => (
          <SelectItem key={u.id} value={u.id} className="font-bold">{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}