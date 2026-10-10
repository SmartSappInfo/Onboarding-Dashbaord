'use client';

/**
 * TaskAccordionHeader
 *
 * Header row for each of the 3 triage cards (Overdue, Upcoming, Completed).
 * Houses the accordion collapse/expand toggle on the left, and an independent,
 * horizontally scrollable row of sub-filter chips on the right.
 *
 * @rule Rule 1: Clean architecture & single responsibility
 * @rule Rule 4: Strict Typing (Zero any/any[])
 * @rule Rule 7: Mobile-first & min-h-[44px] touch targets
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface SubFilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface TaskAccordionHeaderProps<T extends string = string> {
  title: string;
  icon?: React.ReactNode;
  count: number;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  badgeClassName?: string;
  filterOptions: SubFilterOption<T>[];
  activeFilter: T;
  onSelectFilter: (filter: T) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  className?: string;
}

export function TaskAccordionHeader<T extends string = string>({
  title,
  icon,
  count,
  badgeClassName,
  filterOptions,
  activeFilter,
  onSelectFilter,
  isExpanded,
  onToggleExpand,
  className,
}: TaskAccordionHeaderProps<T>) {
  return (
    <div
      className={cn(
        'w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 px-4 sm:px-5 bg-muted/20 border-b border-border/80 transition-all',
        className
      )}
    >
      {/* Left: Accordion Title & Toggle Trigger */}
      <button
        type="button"
        data-testid="accordion-toggle-btn"
        onClick={onToggleExpand}
        className="flex items-center gap-3 text-left cursor-pointer group min-h-[44px] sm:min-h-[36px] -my-1 py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 select-none active:scale-[0.99] transition-transform"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
      >
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground shrink-0',
            isExpanded ? 'transform rotate-0' : 'transform -rotate-90'
          )}
        />
        {icon && <span className="shrink-0">{icon}</span>}
        <h3 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
          {title}
        </h3>
        <Badge
          variant="secondary"
          className={cn(
            'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground',
            badgeClassName
          )}
        >
          {count}
        </Badge>
      </button>

      {/* Right: Independent Sub-Filter Chips */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0"
        role="group"
        aria-label={`${title} sub-filters`}
      >
        {filterOptions.map((opt) => {
          const isActive = activeFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectFilter(opt.value);
              }}
              aria-label={`Filter ${title} by ${opt.label}`}
              aria-pressed={isActive}
              className={cn(
                'whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none min-h-[44px] sm:min-h-[36px] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 border shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                  : 'bg-background/80 text-muted-foreground border-border/70 hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
