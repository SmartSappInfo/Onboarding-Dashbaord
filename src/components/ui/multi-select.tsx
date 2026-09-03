
'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';

interface MultiSelectProps {
  options: { label: string; value: string }[];
  value?: string[];
  selected?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxCount?: number;
  onCreate?: (value: string) => void;
}

/**
 * @fileOverview High-fidelity Expandable Multi-Select.
 * Features a collapsible badge view to prevent UI overflow and full mouse interactivity.
 * Optimized with modal={false} to prevent focus loops when used inside Dialogs.
 */
export function MultiSelect({
  options,
  value,
  selected,
  onChange,
  placeholder = 'Select options...',
  className,
  maxCount = 2,
  onCreate,
}: MultiSelectProps) {
  const currentValues = value ?? selected ?? [];
  const selectedSet = React.useMemo(() => new Set(currentValues), [currentValues]);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const toggleSelection = (val: string) => {
    const next = new Set(currentValues);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onChange(Array.from(next));
  };

  const handleRemove = (val: string) => {
    onChange(currentValues.filter((i) => i !== val));
  };

  const visibleValues = expanded ? currentValues : currentValues.slice(0, maxCount);
  const hiddenCount = currentValues.length - visibleValues.length;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto min-h-10 border-input bg-background hover:bg-background transition-all',
            className
          )}
        >
          <div className="flex gap-1 flex-wrap py-1 pr-2">
            {currentValues.length > 0 ? (
              <>
                {visibleValues.map((val) => {
                  const option = options.find((o) => o.value === val);
                  return (
                    <Badge
                      variant="outline"
                      key={val}
                      className="mr-1 mb-1 font-medium text-xs rounded-md bg-muted text-foreground border border-border px-2 py-0.5 inline-flex items-center gap-1 animate-in fade-in zoom-in-95"
                    >
                      {option?.label || val}
                      <span
                        role="button"
                        tabIndex={0}
                        className="ml-1 rounded-sm outline-none ring-offset-background focus:ring-1 focus:ring-ring cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(val);
                          }
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </span>
                    </Badge>
                  );
                })}
                {(hiddenCount > 0 || (expanded && currentValues.length > maxCount)) && (
                  <Badge
                    variant="outline"
                    className="mr-1 mb-1 font-black text-[9px] uppercase tracking-widest rounded-sm cursor-pointer hover:bg-accent transition-colors bg-background border-primary/20 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(!expanded);
                    }}
                  >
                    {expanded ? 'Show Less' : `+${hiddenCount} more`}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 border-none shadow-2xl rounded-xl overflow-hidden" align="start">
        <Command className="w-full" shouldFilter={true}>
          <CommandInput 
            placeholder="Create or Search Tags" 
            className="font-bold text-sm h-11" 
            value={inputValue} 
            onValueChange={setInputValue} 
          />
          <CommandList className="max-h-64 overflow-auto scrollbar-thin">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No matches identified.</CommandEmpty>
            <CommandGroup className="p-1.5">
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggleSelection(option.value)}
                    className="cursor-pointer rounded-lg p-2 gap-2"
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 group-hover:opacity-100 [&_svg]:invisible'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className={cn("font-medium flex-1 text-sm", isSelected && "text-primary font-bold")}>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {onCreate && inputValue.trim() !== '' && !options.some(o => o.label.toLowerCase() === inputValue.trim().toLowerCase()) && (
              <CommandGroup className="p-1.5 border-t border-border/50" forceMount>
                <CommandItem
                  value={inputValue}
                  onSelect={() => {
                    onCreate(inputValue.trim());
                    setInputValue('');
                  }}
                  className="cursor-pointer rounded-lg p-2 gap-2 text-primary font-bold"
                  forceMount
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary/10">
                    <Check className="h-3.5 w-3.5 opacity-0" />
                  </div>
                  Create &quot;{inputValue.trim()}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
