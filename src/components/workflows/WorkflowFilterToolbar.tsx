'use client';

/**
 * @fileOverview Workflow Filter & Actions Toolbar (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Debounced search input (300ms) across title, definitionId, and initiator.
 * - Single-select status filter pills (`ALL`, `RUNNING`, `WAITING`, `COMPLETED`, `FAILED`, `CANCELLED`).
 * - "Launch Template" trigger modal button.
 * - Mobile-first touch targets (min-h-[44px]) conforming to Rule 7.
 * - Tactile mechanical feedback (`active:scale-[0.97]`).
 */

import * as React from 'react';
import { Search, Plus, RefreshCw, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkflowState } from '@/platform/workflows/workflow-types';

export interface WorkflowFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: WorkflowState | 'ALL';
  onStatusFilterChange: (status: WorkflowState | 'ALL') => void;
  onLaunchClick: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const STATUS_FILTERS: Array<{ id: WorkflowState | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'WAITING', label: 'Waiting Approval' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function WorkflowFilterToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onLaunchClick,
  onRefresh,
  isRefreshing = false,
}: WorkflowFilterToolbarProps) {
  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, searchQuery, onSearchChange]);

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: search + action buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search workflows by title, definition, or ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 pr-9 h-11 sm:h-10 rounded-xl bg-card border-border/80 focus-visible:ring-1 text-sm"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-11 sm:h-10 px-3 rounded-xl border-border/80 active:scale-[0.97] transition-transform min-h-[44px] sm:min-h-[40px]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onLaunchClick}
            className="h-11 sm:h-10 px-4 rounded-xl font-medium active:scale-[0.97] transition-transform shadow-sm min-h-[44px] sm:min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Launch Template
          </Button>
        </div>
      </div>

      {/* Bottom row: status filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1.5 shrink-0">
          <Filter className="h-3 w-3" />
          <span>Status:</span>
        </div>
        {STATUS_FILTERS.map((filter) => {
          const isSelected = statusFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onStatusFilterChange(filter.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shrink-0 active:scale-[0.97] ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/80 hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
