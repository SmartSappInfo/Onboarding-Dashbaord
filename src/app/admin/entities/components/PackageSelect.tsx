'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { SubscriptionPackage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';

interface PackageSelectProps {
  value?: string;
  onValueChange: (value: string, pkg?: SubscriptionPackage) => void;
  error?: boolean;
  disabled?: boolean;
}

/**
 * @fileOverview Robust Subscription Package selection component.
 * Synchronized with workspace context to ensure only authorized tiers are visible.
 */
export function PackageSelect({ value, onValueChange, error, disabled }: PackageSelectProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  
  const packagesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
        collection(firestore, 'subscription_packages'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('isActive', '==', true), 
        orderBy('name', 'asc')
    ) : null, 
  [firestore, activeWorkspaceId]);
  
  const { data: packages, isLoading } = useCollection<SubscriptionPackage>(packagesQuery);

  if (isLoading) {
 return <Skeleton className="h-11 w-full rounded-xl" />;
  }

  // Robust mapping for 'none' state
  const safeValue = value && value !== '' ? value : 'none';

  return (
    <Select 
        value={safeValue} 
        onValueChange={(id) => {
            const pkg = packages?.find(p => p.id === id);
            onValueChange(id, pkg);
        }}
        disabled={disabled}
    >
      <SelectTrigger 
 className={cn(
            "h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all", 
            error && "ring-1 ring-destructive"
        )}
      >
        <SelectValue placeholder="Pick a pricing tier..." />
      </SelectTrigger>
 <SelectContent className="rounded-xl shadow-2xl border-none">
 <SelectItem value="none" className="font-bold italic opacity-60">No Active Subscription</SelectItem>
        {packages?.map(pkg => (
 <SelectItem key={pkg.id} value={pkg.id} className="font-bold">
            {pkg.name} ({pkg.currency} {pkg.ratePerStudent}/student)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}