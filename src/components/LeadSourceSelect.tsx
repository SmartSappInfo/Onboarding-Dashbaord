'use client';

import * as React from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Loader2, Check } from 'lucide-react';

interface LeadSourceSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
}

const BASE_SOURCES = [
  'Referral',
  'Website',
  'Social Media',
  'Event',
  'Partner',
  'Cold Outreach',
  'Other',
];

export function LeadSourceSelect({
  value,
  onValueChange,
  disabled,
  error,
  placeholder = 'Select lead source…',
  className,
}: LeadSourceSelectProps) {
  const firestore = useFirestore();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  // Combine standard and custom lead sources from active workspace
  const sources = React.useMemo(() => {
    const custom = activeWorkspace?.customLeadSources || [];
    // Combine, filter out empty, and remove duplicates keeping order
    const combined = [...BASE_SOURCES, ...custom].filter(Boolean);
    return Array.from(new Set(combined));
  }, [activeWorkspace?.customLeadSources]);

  // Filter sources by search term
  const filtered = React.useMemo(() => {
    if (!search.trim()) return sources;
    const q = search.toLowerCase();
    return sources.filter(s => s.toLowerCase().includes(q));
  }, [sources, search]);

  // Check if we can create a new source
  const canCreate = React.useMemo(() => {
    const name = search.trim();
    if (!name || !activeWorkspace?.id) return false;
    return !sources.some(s => s.toLowerCase() === name.toLowerCase());
  }, [search, sources, activeWorkspace?.id]);

  const handleCreateLeadSource = async () => {
    if (!firestore || !activeWorkspace?.id || isCreating) return;
    const name = search.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const wsRef = doc(firestore, 'workspaces', activeWorkspace.id);
      await updateDoc(wsRef, {
        customLeadSources: arrayUnion(name),
      });
      onValueChange(name);
      setSearch('');
      toast({
        title: 'Lead Source Created',
        description: `"${name}" has been added to custom sources.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e.message || 'Failed to create lead source.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Select
      value={value || ''}
      onValueChange={(val) => {
        if (val === '__clear__') {
          onValueChange('');
          return;
        }
        if (val === '__create__') {
          handleCreateLeadSource();
          return;
        }
        onValueChange(val);
      }}
      disabled={disabled || !activeWorkspace?.id}
    >
      <SelectTrigger
        className={cn(
          className || 'h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all',
          error && 'ring-1 ring-destructive',
          (disabled || !activeWorkspace?.id) && 'opacity-50',
        )}
      >
        <SelectValue placeholder={!activeWorkspace?.id ? 'Loading workspace...' : placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl max-h-[280px]">
        {/* Search */}
        <div className="px-2 pb-2 pt-1 sticky top-0 bg-popover z-10 border-b border-border/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search or create lead source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 rounded-lg text-xs bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault();
                  handleCreateLeadSource();
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
              No results found. Type to create one.
            </div>
          ) : (
            filtered.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="font-semibold text-sm">{s}</span>
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
