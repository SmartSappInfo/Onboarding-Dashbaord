'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query, where } from 'firebase/firestore';
import type { Module } from '@/lib/types';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ModuleOption = Pick<Module, 'id' | 'name' | 'abbreviation' | 'color'>;

/**
 * ARCHITECTURAL NOTICE (Workspace Interest Scoping):
 * This component handles the selection of specific interests/modules for entities.
 * It is strictly scoped to the target workspace and organization. Modules specified for other
 * workspaces are filtered out, while organization-wide default modules are preserved.
 */
interface ModuleSelectProps {
  value?: ModuleOption[];
  onChange?: (value: ModuleOption[]) => void;
  /** Explicit target workspace ID override */
  workspaceId?: string;
  /** Explicit array of target workspace IDs override (e.g. multi-workspace entity creation) */
  workspaceIds?: string[];
  /** Explicit organization ID override */
  organizationId?: string;
}

export function ModuleSelect({ value, onChange, workspaceId, workspaceIds, organizationId }: ModuleSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const targetOrgId = organizationId || activeOrganizationId;

  // Resolve active target workspace IDs
  const targetWorkspaceIdsList = React.useMemo(() => {
    if (workspaceIds && workspaceIds.length > 0) return workspaceIds;
    if (workspaceId) return [workspaceId];
    if (activeWorkspaceId) return [activeWorkspaceId];
    return [];
  }, [workspaceId, workspaceIds, activeWorkspaceId]);

  const modulesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (targetOrgId) {
      return query(
        collection(firestore, 'modules'),
        where('organizationId', '==', targetOrgId),
        orderBy('order')
      );
    }
    return query(collection(firestore, 'modules'), orderBy('order'));
  }, [firestore, targetOrgId]);

  const { data: allModules, isLoading } = useCollection<Module>(modulesQuery);

  const options: ModuleOption[] = React.useMemo(() => {
    if (!allModules) return [];

    // Filter modules to those matching target workspace(s) or org defaults
    const workspaceFilteredModules = allModules.filter(m => {
      // Enforce organization scope boundary
      if (targetOrgId && m.organizationId && m.organizationId !== targetOrgId) {
        return false;
      }

      // Check for workspace-specific restrictions
      const hasWorkspaceRestriction = Boolean(m.workspaceId || (m.workspaceIds && m.workspaceIds.length > 0));
      if (!hasWorkspaceRestriction) {
        // Organization default module — available to all workspaces
        return true;
      }

      if (targetWorkspaceIdsList.length === 0) return true;

      const matchesSingle = m.workspaceId ? targetWorkspaceIdsList.includes(m.workspaceId) : false;
      const matchesArray = m.workspaceIds ? targetWorkspaceIdsList.some(id => m.workspaceIds?.includes(id)) : false;

      return matchesSingle || matchesArray;
    });

    // Deduplicate by name to prevent confusing duplicates in UI
    const uniqueMap = new Map<string, ModuleOption>();
    workspaceFilteredModules.forEach(m => {
        if (!uniqueMap.has(m.name)) {
            uniqueMap.set(m.name, {
                id: m.id,
                name: m.name,
                abbreviation: m.abbreviation,
                color: m.color
            });
        }
    });

    const filtered = Array.from(uniqueMap.values());
    if (!searchTerm) return filtered;
    return filtered.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allModules, targetOrgId, targetWorkspaceIdsList, searchTerm]);
  
  const selectedValues = new Set(value?.map(v => v.id) || []);

  const handleSelect = (option: ModuleOption) => {
    const currentValue = value || [];
    const newSelection = [...currentValue];
    const index = newSelection.findIndex(item => item.id === option.id);
    if (index > -1) {
      newSelection.splice(index, 1);
    } else {
      newSelection.push(option);
    }
    onChange?.(newSelection);
  };
  
  const handleRemove = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onChange?.(value?.filter(v => v.id !== id) || []);
  }
  
  if (isLoading) {
 return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
 className="w-full justify-between h-auto min-h-10"
        >
 <div className="flex gap-1 flex-wrap">
            {value && value.length > 0 ? (
                value.map(module => (
                    <Badge
                        key={module.id}
                        style={{ backgroundColor: module.color, color: 'hsl(var(--primary-foreground))' }}
 className="mr-1 mb-1 border-transparent"
                    >
                        {module.abbreviation}
                         <div
                            role="button"
                            aria-label={`Remove ${module.name}`}
                            tabIndex={0}
 className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onClick={(e) => handleRemove(module.id, e)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRemove(module.id, e);
                                }
                            }}
                        >
 <X className="h-3 w-3" />
                        </div>
                    </Badge>
                ))
            ) : (
 <span className="text-muted-foreground">Select modules...</span>
            )}
          </div>
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
 <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search modules..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandList>
            <CommandEmpty>No modules found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => handleSelect(option)}
                  value={option.name}
                >
                  <Check
 className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.has(option.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
 <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: option.color}} />
                  <span>{option.name}</span>
 <span className="ml-auto text-muted-foreground text-xs">{option.abbreviation}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
