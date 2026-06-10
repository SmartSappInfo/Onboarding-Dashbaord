'use client';

import * as React from 'react';
import { Search, X, Users, Tag as TagIcon, Layers, Banknote, CalendarRange, SlidersHorizontal, RotateCcw, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { UserProfile, OnboardingStage, Tag } from '@/lib/types';
import { type KanbanFilters, isFilterActive, activeFilterCount } from '../pipeline-types';

interface PipelineFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  filters: KanbanFilters;
  updateFilter: <K extends keyof KanbanFilters>(key: K, value: KanbanFilters[K]) => void;
  onClear: () => void;
  users: UserProfile[] | null;
  tags: Tag[] | null;
  stages: OnboardingStage[] | null;
}

/**
 * Inline, workspace-scoped filter card shown above the board / list.
 * Primary controls (search, status, owner, tags) are always visible;
 * value, date, and stage filters live behind an inline "More" disclosure.
 */
export default function PipelineFilterBar({
  searchTerm,
  onSearchChange,
  filters,
  updateFilter,
  onClear,
  users,
  tags,
  stages,
}: PipelineFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);
  const active = isFilterActive(filters) || searchTerm !== '';
  const count = activeFilterCount(filters);

  const toggleInArray = (key: 'tagIds' | 'stageIds', id: string) => {
    const arr = filters[key];
    updateFilter(key, arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  return (
    <div className="shrink-0 mb-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search deals..."
            className="h-9 rounded-xl bg-muted/20 border-none pl-9 pr-8 font-semibold text-xs shadow-inner"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status */}
        <Select value={filters.status} onValueChange={(v: any) => updateFilter('status', v)}>
          <SelectTrigger className="h-9 w-[120px] rounded-xl bg-muted/20 border-none font-bold text-[10px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-[10px] font-bold">All Statuses</SelectItem>
            <SelectItem value="open" className="text-[10px] font-bold text-blue-600">Open</SelectItem>
            <SelectItem value="won" className="text-[10px] font-bold text-emerald-600">Won</SelectItem>
            <SelectItem value="lost" className="text-[10px] font-bold text-rose-600">Lost</SelectItem>
          </SelectContent>
        </Select>

        {/* Owner */}
        <Select value={filters.assignedToId ?? 'any'} onValueChange={v => updateFilter('assignedToId', v === 'any' ? null : v)}>
          <SelectTrigger className="h-9 w-[140px] rounded-xl bg-muted/20 border-none font-bold text-[10px]">
            <Users className="h-3 w-3 mr-1 text-muted-foreground/60" />
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-[220px]">
            <SelectItem value="any" className="text-[10px] font-bold">Any Owner</SelectItem>
            <SelectItem value="unassigned" className="text-[10px] font-bold text-muted-foreground">Unassigned</SelectItem>
            {users?.map(u => (
              <SelectItem key={u.id} value={u.id} className="text-[10px] font-bold">{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags */}
        <MultiSelectPopover
          icon={<TagIcon className="h-3 w-3" />}
          label="Tags"
          selectedCount={filters.tagIds.length}
          empty={!tags || tags.length === 0}
        >
          {tags?.map(t => (
            <label key={t.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={filters.tagIds.includes(t.id)} onCheckedChange={() => toggleInArray('tagIds', t.id)} />
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-[10px] font-bold truncate">{t.name}</span>
            </label>
          ))}
        </MultiSelectPopover>

        {/* More */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(e => !e)}
          className={cn("h-9 rounded-xl font-bold text-[10px] gap-1.5 px-3", expanded ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary")}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> More
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </Button>

        {active && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9 rounded-xl font-bold text-[10px] text-rose-600 hover:bg-rose-50 gap-1.5 px-3">
            <RotateCcw className="h-3.5 w-3.5" /> Clear{count > 0 ? ` (${count})` : ''}
          </Button>
        )}
      </div>

      {/* Expanded: value, date, stages */}
      {expanded && (
        <div className="flex flex-wrap items-end gap-4 px-2.5 pb-3 pt-1 border-t border-dashed border-border/50">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Banknote className="h-3 w-3" /> Value</label>
            <div className="flex items-center gap-1.5">
              <Input type="number" min="0" placeholder="Min" value={filters.valueMin ?? ''} onChange={e => updateFilter('valueMin', e.target.value === '' ? null : Number(e.target.value))} className="h-8 w-[90px] rounded-lg bg-muted/20 border-none font-bold text-[10px]" />
              <span className="text-muted-foreground text-[10px]">–</span>
              <Input type="number" min="0" placeholder="Max" value={filters.valueMax ?? ''} onChange={e => updateFilter('valueMax', e.target.value === '' ? null : Number(e.target.value))} className="h-8 w-[90px] rounded-lg bg-muted/20 border-none font-bold text-[10px]" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><CalendarRange className="h-3 w-3" /> Forecast Date</label>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={filters.closeDateFrom ?? ''} onChange={e => updateFilter('closeDateFrom', e.target.value || null)} className="h-8 rounded-lg bg-muted/20 border-none font-bold text-[10px]" />
              <span className="text-muted-foreground text-[10px]">–</span>
              <Input type="date" value={filters.closeDateTo ?? ''} onChange={e => updateFilter('closeDateTo', e.target.value || null)} className="h-8 rounded-lg bg-muted/20 border-none font-bold text-[10px]" />
            </div>
          </div>

          {stages && stages.length > 0 && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Layers className="h-3 w-3" /> Stages</label>
              <div className="flex flex-wrap gap-1.5">
                {stages.map(s => {
                  const checked = filters.stageIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleInArray('stageIds', s.id)}
                      className={cn(
                        "px-2.5 h-7 rounded-lg text-[10px] font-bold border transition-colors",
                        checked ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/20 border-transparent text-muted-foreground hover:text-foreground"
                      )}
                      style={checked && s.color ? { color: s.color, borderColor: `${s.color}55` } : undefined}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelectPopover({
  icon,
  label,
  selectedCount,
  empty,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  selectedCount: number;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 rounded-xl font-bold text-[10px] gap-1.5 px-3 bg-muted/20",
            selectedCount > 0 ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {icon} {label}
          {selectedCount > 0 && (
            <span className="min-w-[15px] h-4 px-1 flex items-center justify-center text-[8px] bg-primary text-primary-foreground rounded-full">{selectedCount}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 rounded-xl border-none shadow-2xl max-h-[260px] overflow-y-auto">
        {empty ? (
          <p className="text-[10px] font-semibold text-muted-foreground text-center py-3">None available in this workspace.</p>
        ) : (
          <div className="flex flex-col gap-0.5">{children}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
