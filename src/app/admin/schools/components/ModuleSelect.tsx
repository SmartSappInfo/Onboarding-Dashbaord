
'use client';
import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Module } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ModuleOption = Pick<Module, 'id' | 'name' | 'abbreviation' | 'color'>;

interface ModuleSelectProps {
  value?: ModuleOption[];
  onChange?: (value: ModuleOption[]) => void;
}

export function ModuleSelect({ value, onChange }: ModuleSelectProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const modulesQuery = useMemoFirebase(() => {
    return firestore ? query(collection(firestore, 'modules'), orderBy('order')) : null;
  }, [firestore]);
  const { data: allModules, isLoading } = useCollection<Module>(modulesQuery);

  const options: ModuleOption[] = React.useMemo(() => {
    if (!allModules) return [];
    return allModules.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allModules, searchTerm]);
  
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
  
  const handleRemove = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
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
                         <button
                            role="button"
                            aria-label={`Remove ${module.name}`}
                            tabIndex={0}
                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onClick={(e) => handleRemove(module.id, e)}
                        >
                            <X className="h-3 w-3" />
                        </button>
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

    