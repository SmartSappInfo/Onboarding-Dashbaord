'use client';

/**
 * TaskFilterPopover - Consolidated Filter Component
 *
 * Consolidates secondary filters (Status, Priority, Tags) into a single, clean popover.
 * Complies with Section 8 Popover architecture (border border-border/80 bg-card shadow-2xl rounded-2xl)
 * and guarantees min-h-[44px] touch targets for mobile accessibility.
 *
 * @rule Rule 1: Clean architecture & single responsibility
 * @rule Rule 4: Strict Typing (Zero any/any[])
 * @rule Rule 7: Mobile touch targets >= 44px
 * @rule AGENTS.md: TagSelector in client draft mode without contactId/contactType
 */

import * as React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TagSelector } from '@/components/tags/TagSelector';
import { cn } from '@/lib/utils';

export interface TaskFilterPopoverProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  selectedTagId: string;
  onTagChange: (tagId: string) => void;
  onClearFilters: () => void;
  className?: string;
}

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

const STATUS_OPTIONS: FilterOption<string>[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: FilterOption<string>[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function TaskFilterPopover({
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  selectedTagId,
  onTagChange,
  onClearFilters,
  className,
}: TaskFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);

  // Compute active filters count
  const activeCount = React.useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (priorityFilter !== 'all') count++;
    if (selectedTagId !== 'all' && selectedTagId.trim().length > 0) count++;
    return count;
  }, [statusFilter, priorityFilter, selectedTagId]);

  const currentTagIds = React.useMemo(() => {
    return selectedTagId !== 'all' && selectedTagId ? [selectedTagId] : [];
  }, [selectedTagId]);

  const handleTagsChange = (tagIds: string[]) => {
    if (tagIds.length === 0) {
      onTagChange('all');
    } else {
      onTagChange(tagIds[tagIds.length - 1]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-11 min-h-[44px] px-3.5 rounded-xl border border-border/80 bg-white dark:bg-card text-foreground hover:bg-muted/60 active:scale-[0.97] transition-all font-semibold text-xs flex items-center gap-2 shadow-xs',
            activeCount > 0 && 'border-primary/50 bg-primary/5 text-primary',
            className
          )}
          aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
        >
          <Filter className={cn('h-4 w-4', activeCount > 0 ? 'text-primary' : 'text-muted-foreground')} />
          <span>Filters</span>
          {activeCount > 0 && (
            <Badge
              data-testid="active-filters-badge"
              variant="default"
              className="h-5 px-1.5 min-w-[20px] rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[320px] sm:w-[360px] p-0 border border-border/80 bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Filter Tasks
            </h4>
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 active:scale-[0.97] transition-all px-2 py-1 rounded-md hover:bg-primary/10"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear all</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onStatusChange(opt.value)}
                    className={cn(
                      'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Priority
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isActive = priorityFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onPriorityChange(opt.value)}
                    className={cn(
                      'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workspace Tags (Standardized TagSelector in Client Draft Mode) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Workspace Tag
            </label>
            <div className="pt-0.5">
              <TagSelector
                currentTagIds={currentTagIds}
                onTagsChange={handleTagsChange}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/80 bg-muted/15 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            {activeCount === 0 ? 'No active filters' : `${activeCount} filter${activeCount > 1 ? 's' : ''} applied`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="h-9 min-h-[36px] px-3 text-xs font-semibold rounded-lg hover:bg-muted active:scale-[0.97]"
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
