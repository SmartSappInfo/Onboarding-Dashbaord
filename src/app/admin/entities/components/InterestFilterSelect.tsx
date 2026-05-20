'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Module } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Flame } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface InterestFilterSelectProps {
  value?: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function InterestFilterSelect({ value = [], onChange, className }: InterestFilterSelectProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const modulesQuery = useMemoFirebase(() => {
    return firestore ? query(collection(firestore, 'modules'), orderBy('order')) : null;
  }, [firestore]);
  const { data: allModules, isLoading } = useCollection<Module>(modulesQuery);

  const options = React.useMemo(() => {
    if (!allModules) return [];
    
    // Deduplicate by name to prevent duplicates in workspace UI
    const uniqueMap = new Map<string, Pick<Module, 'id' | 'name' | 'abbreviation' | 'color'>>();
    allModules.forEach(m => {
      // We map the unique string identifier (which could be the ID or Name)
      // Since entities are mapped via their module names/ids, we use Name as the identifier for perfect matching
      if (!uniqueMap.has(m.name)) {
        uniqueMap.set(m.name, {
          id: m.id,
          name: m.name,
          abbreviation: m.abbreviation,
          color: m.color
        });
      }
    });

    return Array.from(uniqueMap.values());
  }, [allModules]);

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const handleSelect = (name: string) => {
    const updated = [...value];
    const index = updated.indexOf(name);
    if (index > -1) {
      updated.splice(index, 1);
    } else {
      updated.push(name);
    }
    onChange(updated);
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-full rounded-xl" />;
  }

  // Find names/colors for active badges preview
  const activeSelections = options.filter(opt => selectedSet.has(opt.name));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs hover:bg-accent/10 transition-all select-none",
            className
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden text-left">
            <Flame className={cn("h-3.5 w-3.5 shrink-0", activeSelections.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground")} />
            <span className="truncate">
              {activeSelections.length === 0 && "All Interests"}
              {activeSelections.length === 1 && activeSelections[0].name}
              {activeSelections.length > 1 && `${activeSelections.length} Interests`}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 rounded-2xl border border-border/80 shadow-lg bg-popover/95 backdrop-blur-md" align="start">
        <Command className="bg-transparent">
          <CommandInput 
            placeholder="Search interests..." 
            value={searchTerm} 
            onValueChange={setSearchTerm} 
            className="h-9 border-none focus:ring-0 text-xs"
          />
          <CommandList className="max-h-[220px] p-1">
            <CommandEmpty className="py-2 text-[10px] text-muted-foreground text-center">No interests found.</CommandEmpty>
            <CommandGroup>
              {options
                .filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((option) => {
                  const isSelected = selectedSet.has(option.name);
                  return (
                    <CommandItem
                      key={option.id}
                      onSelect={() => handleSelect(option.name)}
                      className="rounded-lg text-xs px-2 py-1.5 flex items-center gap-2 cursor-pointer select-none transition-colors duration-150"
                    >
                      <div className="flex items-center justify-center h-4 w-4 rounded border border-border/80 shrink-0">
                        {isSelected && <Check className="h-3 w-3 text-primary stroke-[3]" />}
                      </div>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: option.color || '#3b82f6' }} />
                      <span className="truncate font-semibold text-foreground/90">{option.name}</span>
                      {option.abbreviation && (
                        <span className="ml-auto text-[9px] font-black uppercase text-muted-foreground/60">{option.abbreviation}</span>
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
