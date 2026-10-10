'use client';

import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { LocationCascade, type LocationValue } from './LocationCascade';
import { MapPin, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type { LocationValue };

/**
 * Computes a human-readable specific selection label for location filter triggers and capsules.
 * Example outputs:
 * - "All Locations"
 * - "Ghana"
 * - "Greater Accra, GH"
 * - "Accra Metro, GH"
 */
export function getSpecificLocationLabel(value?: LocationValue | null): string {
  if (!value) return 'All Locations';
  const { country, region, district } = value;

  const countryRef = country?.code || country?.name || '';

  if (district?.name) {
    return countryRef ? `${district.name}, ${countryRef}` : district.name;
  }

  if (region?.name) {
    return countryRef ? `${region.name}, ${countryRef}` : region.name;
  }

  if (country?.name) {
    return country.name;
  }

  return 'All Locations';
}

export interface LocationFilterPopoverProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * LocationFilterPopover
 *
 * ARCHITECTURAL GUIDANCE:
 * Unifies Country, Region, and District cascading selections into a single, compact,
 * non-truncating trigger with instant popover picker and 1-click clearance.
 */
export function LocationFilterPopover({
  value,
  onChange,
  className,
  placeholder = 'All Locations',
  disabled = false,
}: LocationFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);

  const isLocationActive = Boolean(value?.country || value?.region || value?.district);
  const displayLabel = isLocationActive ? getSpecificLocationLabel(value) : placeholder;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ country: null, region: null, district: null });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between rounded-xl bg-background/50 border-border shadow-xs px-2.5 font-bold text-xs text-left transition-all active:scale-[0.97] hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/20',
            isLocationActive ? 'text-foreground border-primary/40 bg-primary/5' : 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className={cn('h-3.5 w-3.5 shrink-0', isLocationActive ? 'text-primary' : 'text-muted-foreground')} />
            <span className="truncate">{displayLabel}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {isLocationActive && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear location filter"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClear(e as unknown as React.MouseEvent);
                  }
                }}
                className="p-0.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 p-3.5 rounded-2xl border border-border/80 shadow-2xl bg-card text-card-foreground animate-in fade-in-0 zoom-in-95 z-[100]"
      >
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/70">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold tracking-tight text-foreground">Filter by Location</span>
          </div>
          {isLocationActive && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        <LocationCascade
          value={value}
          onChange={(newVal) => {
            onChange(newVal);
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
