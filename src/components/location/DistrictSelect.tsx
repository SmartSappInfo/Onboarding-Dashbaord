'use client';

import * as React from 'react';
import { collection, query, where, orderBy, addDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { District } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Loader2 } from 'lucide-react';

interface DistrictSelectProps {
  value?: { id: string; name: string } | null;
  onValueChange: (value: { id: string; name: string } | null) => void;
  regionId?: string | null;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
}

export function DistrictSelect({
  value,
  onValueChange,
  regionId,
  disabled,
  error,
  placeholder = 'Select a district…',
  className,
}: DistrictSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const districtsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId || !regionId) return null;
    return query(
      collection(firestore, 'districts'),
      where('organizationId', '==', activeOrganizationId),
      where('regionId', '==', regionId),
      orderBy('name', 'asc'),
    );
  }, [firestore, activeOrganizationId, regionId]);

  const { data: districts, isLoading } = useCollection<District>(districtsQuery);

  const filtered = React.useMemo(() => {
    if (!districts) return [];
    if (!search.trim()) return districts;
    const q = search.toLowerCase();
    return districts.filter(d => d.name.toLowerCase().includes(q));
  }, [districts, search]);

  // Check if search term would create a new entry
  const canCreate = React.useMemo(() => {
    if (!search.trim() || !regionId) return false;
    const q = search.trim().toLowerCase();
    return !districts?.some(d => d.name.toLowerCase() === q);
  }, [search, districts, regionId]);

  const handleCreateDistrict = async () => {
    if (!firestore || !regionId || !activeOrganizationId || isCreating) return;
    const name = search.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(firestore, 'districts'), {
        name,
        regionId,
        organizationId: activeOrganizationId,
      });
      onValueChange({ id: docRef.id, name });
      setSearch('');
      toast({ title: 'District Created', description: `"${name}" has been added.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const isDisabled = disabled || !regionId;

  if (isLoading && regionId) {
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
        if (id === '__create__') {
          handleCreateDistrict();
          return;
        }
        const d = districts?.find(x => x.id === id);
        if (d) onValueChange({ id: d.id, name: d.name });
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
        <SelectValue placeholder={isDisabled ? 'Select a region first' : placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl max-h-[280px]">
        {/* Search */}
        <div className="px-2 pb-2 pt-1 sticky top-0 bg-popover z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search or create district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 rounded-lg text-xs bg-muted/30 border-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault();
                  handleCreateDistrict();
                }
              }}
            />
          </div>
        </div>

        {value && (
          <SelectItem value="__clear__" className="text-xs text-muted-foreground italic">
            Clear selection
          </SelectItem>
        )}

        {/* Inline create option */}
        {canCreate && (
          <SelectItem value="__create__" className="text-primary font-bold">
            <span className="flex items-center gap-2">
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Create &ldquo;{search.trim()}&rdquo;</span>
            </span>
          </SelectItem>
        )}

        <SelectGroup>
          {filtered.length === 0 && !canCreate ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              {!regionId ? 'Select a region first' : 'No districts yet. Type to create one.'}
            </div>
          ) : (
            filtered.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="font-semibold text-sm">{d.name}</span>
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
