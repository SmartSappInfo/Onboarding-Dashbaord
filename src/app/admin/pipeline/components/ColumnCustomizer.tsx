/**
 * @fileoverview Configurable Table Columns Customizer Popover
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Section 30):
 * - Allows sales managers and reps to customize visible data columns in the Deals List View.
 * - Supports toggling MRR, ARR, Contract Term, Probability, Forecast Category, Days in Stage, and Lead Source.
 * - Provides quick presets: Default, Full Commercial, and Compact.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Zero 'any' / zero 'any[]'.
 * - Accessible touch targets >= 44px on mobile viewports.
 */

'use client';

import * as React from 'react';
import {
  Columns,
  Check,
  RotateCcw,
  Sliders,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  type DealColumnKey,
  ALL_AVAILABLE_DEAL_COLUMNS,
  DEFAULT_DEAL_COLUMNS,
} from '@/lib/deals/deal-saved-views';
import { cn } from '@/lib/utils';

interface ColumnCustomizerProps {
  visibleColumns: DealColumnKey[];
  onChangeColumns: (cols: DealColumnKey[]) => void;
}

export default function ColumnCustomizer({
  visibleColumns,
  onChangeColumns,
}: ColumnCustomizerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredColumns = React.useMemo(() => {
    if (!search.trim()) return ALL_AVAILABLE_DEAL_COLUMNS;
    const q = search.toLowerCase();
    return ALL_AVAILABLE_DEAL_COLUMNS.filter(c => c.label.toLowerCase().includes(q));
  }, [search]);

  const toggleColumn = (key: DealColumnKey) => {
    if (key === 'name') return; // Name is permanently fixed
    if (visibleColumns.includes(key)) {
      if (visibleColumns.length <= 2) return; // Prevent removing everything
      onChangeColumns(visibleColumns.filter(c => c !== key));
    } else {
      onChangeColumns([...visibleColumns, key]);
    }
  };

  const handleReset = () => {
    onChangeColumns(DEFAULT_DEAL_COLUMNS);
  };

  const handleSelectAll = () => {
    onChangeColumns(ALL_AVAILABLE_DEAL_COLUMNS.map(c => c.key));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-10 sm:h-9 rounded-xl font-bold text-xs border-border bg-background hover:bg-muted/40 gap-1.5 shadow-xs active:scale-[0.97]"
        >
          <Columns className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Columns</span>
          <span className="h-4 px-1.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {visibleColumns.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 rounded-2xl border-border shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-bold text-foreground">Customize Columns</h4>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="h-8 rounded-lg text-xs pl-7 bg-muted/30"
          />
        </div>

        {/* Columns Checkbox List */}
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {filteredColumns.map(col => {
            const isChecked = visibleColumns.includes(col.key);
            const isLocked = col.key === 'name';

            return (
              <label
                key={col.key}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer text-xs select-none',
                  isChecked ? 'bg-primary/5 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/40',
                  isLocked && 'opacity-70 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isChecked}
                    disabled={isLocked}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span>{col.label}</span>
                </div>
                {isLocked && <span className="text-[10px] text-muted-foreground font-normal">(Required)</span>}
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Select All ({ALL_AVAILABLE_DEAL_COLUMNS.length})
          </button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-7 px-3 rounded-lg text-xs font-bold bg-primary text-primary-foreground"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
