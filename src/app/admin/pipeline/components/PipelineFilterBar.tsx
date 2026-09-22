/**
 * @fileoverview Unified Pipeline Filter Command Bar Component
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (Rule 10, Rule 8, Rule 5):
 * - Consolidates the dual-row filtering interface into a single, high-performance command center.
 * - Primary bar hosts search, quick filters/views dropdown, status, owner, tags, and more filters toggle.
 * - Expanded panel hosts 1-click preset chips, numeric ranges (value, close date), health status,
 *   archive status, pipeline stages, and the merged Advanced Multi-Condition Rules engine.
 * - Recovers ~50px of vertical height for the Kanban board and deal lists.
 * - Full mobile responsiveness (min 44px touch targets, horizontal touch tracks, everyday simple UI English).
 */

'use client';

import * as React from 'react';
import { 
  Search, 
  X, 
  Users, 
  Tag as TagIcon, 
  Layers, 
  Banknote, 
  CalendarRange, 
  SlidersHorizontal, 
  RotateCcw, 
  ChevronDown,
  Archive,
  Activity,
  Bookmark,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UserProfile, OnboardingStage, Tag, Deal } from '@/lib/types';
import type { DealSavedView, DealColumnKey, TableDensity } from '@/lib/deals/deal-saved-views';
import { type KanbanFilters, isFilterActive, activeFilterCount } from '../pipeline-types';
import { QuickFiltersDropdown } from './QuickFiltersDropdown';

export interface PipelineFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  filters: KanbanFilters;
  updateFilter: <K extends keyof KanbanFilters>(key: K, value: KanbanFilters[K]) => void;
  onClear: () => void;
  users: UserProfile[] | null;
  tags: Tag[] | null;
  stages: OnboardingStage[] | null;
  showStagesFilter: boolean;
  onOpenAdvancedFilters?: () => void;
  // Saved views & presets integration
  workspaceId: string;
  userId: string;
  userName?: string;
  savedViews: DealSavedView[];
  activeViewId: string;
  onSelectView: (view: DealSavedView) => void;
  deals: Deal[];
  currentColumns?: DealColumnKey[];
  currentDensity?: TableDensity;
  onRefreshViews?: () => void;
}

export default function PipelineFilterBar({
  searchTerm,
  onSearchChange,
  filters,
  updateFilter,
  onClear,
  users,
  tags,
  stages,
  showStagesFilter,
  onOpenAdvancedFilters,
  workspaceId,
  userId,
  userName,
  savedViews,
  activeViewId,
  onSelectView,
  deals,
  currentColumns,
  currentDensity,
  onRefreshViews,
}: PipelineFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  const active = isFilterActive(filters) || searchTerm !== '';
  const totalCount = activeFilterCount(filters);

  // Active count of dimensions housed inside the expanded "More Filters" panel
  const moreFiltersActiveCount = React.useMemo(() => {
    let count = 0;
    if (filters.valueMin !== null || filters.valueMax !== null) count++;
    if (filters.closeDateFrom !== null || filters.closeDateTo !== null) count++;
    if (filters.healthStatus && filters.healthStatus !== 'all') count++;
    if (filters.archiveStatus && filters.archiveStatus !== 'active') count++;
    if (filters.stageIds && filters.stageIds.length > 0) count++;
    if (filters.filterTree && filters.filterTree.groups && filters.filterTree.groups.length > 0) {
      count += filters.filterTree.groups.reduce((acc, g) => acc + (g.rules?.length || 0), 0);
    }
    return count;
  }, [filters]);

  const hasAdvancedRules = Boolean(
    filters.filterTree && filters.filterTree.groups && filters.filterTree.groups.length > 0
  );
  const advancedRulesCount = filters.filterTree?.groups?.reduce(
    (acc, g) => acc + (g.rules?.length || 0),
    0
  ) || 0;

  const toggleInArray = (key: 'tagIds' | 'stageIds', id: string) => {
    const arr = filters[key];
    updateFilter(key, arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const handleClearAdvancedRules = () => {
    updateFilter('filterTree', null);
  };

  return (
    <div className="shrink-0 mb-4 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card transition-all duration-200">
      {/* Primary Command Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search deals..."
            className="h-10 sm:h-9 rounded-xl border-border bg-background pl-9 pr-8 font-semibold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none min-h-[44px] sm:min-h-[36px]"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filters & Saved Views Dropdown */}
        <QuickFiltersDropdown
          workspaceId={workspaceId}
          userId={userId}
          userName={userName}
          savedViews={savedViews}
          activeViewId={activeViewId}
          onSelectView={onSelectView}
          currentFilters={filters}
          currentColumns={currentColumns}
          currentDensity={currentDensity}
          deals={deals}
          stages={stages || []}
          onRefreshViews={onRefreshViews}
        />

        {/* Status Dropdown */}
        <Select 
          value={filters.status} 
          onValueChange={(v: 'all' | 'open' | 'won' | 'lost') => updateFilter('status', v)}
        >
          <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[110px] rounded-xl border border-border bg-background font-bold text-xs sm:text-[11px] shadow-sm hover:bg-muted/10 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[36px] focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-xs font-semibold">All Statuses</SelectItem>
            <SelectItem value="open" className="text-xs font-semibold text-blue-600">Open</SelectItem>
            <SelectItem value="won" className="text-xs font-semibold text-emerald-600">Won</SelectItem>
            <SelectItem value="lost" className="text-xs font-semibold text-rose-600">Lost</SelectItem>
          </SelectContent>
        </Select>

        {/* Owner Dropdown */}
        <Select 
          value={filters.assignedToId ?? 'all'} 
          onValueChange={v => updateFilter('assignedToId', v)}
        >
          <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[130px] rounded-xl border border-border bg-background font-bold text-xs sm:text-[11px] shadow-sm hover:bg-muted/10 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[36px] focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none">
            <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground/60 shrink-0" />
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-[220px]">
            <SelectItem value="all" className="text-xs font-semibold">Any Owner</SelectItem>
            <SelectItem value="unassigned" className="text-xs font-semibold text-muted-foreground">Unassigned</SelectItem>
            {users?.map(u => (
              <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags Popover */}
        <MultiSelectPopover
          icon={<TagIcon className="h-3.5 w-3.5 shrink-0" />}
          label="Tags"
          selectedCount={filters.tagIds.length}
          empty={!tags || tags.length === 0}
        >
          {tags?.map(t => (
            <label 
              key={t.id} 
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 cursor-pointer min-h-[44px] sm:min-h-[36px] transition-colors"
            >
              <Checkbox 
                checked={filters.tagIds.includes(t.id)} 
                onCheckedChange={() => toggleInArray('tagIds', t.id)} 
              />
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-xs font-semibold truncate">{t.name}</span>
            </label>
          ))}
        </MultiSelectPopover>

        {/* More Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setExpanded(e => !e)}
          className={cn(
            "h-10 sm:h-9 rounded-xl font-bold text-xs sm:text-[11px] gap-1.5 px-3 border border-border bg-background shadow-sm hover:bg-muted/10 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[36px] focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none",
            expanded ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:text-foreground",
            moreFiltersActiveCount > 0 && !expanded && "border-primary/40 text-primary bg-primary/[0.04]"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>More Filters</span>
          {moreFiltersActiveCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] bg-primary text-primary-foreground rounded-full font-bold">
              {moreFiltersActiveCount}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")} />
        </Button>

        {/* Clear All Filters Button */}
        {active && (
          <Button 
            variant="ghost" 
            onClick={onClear} 
            className="h-10 sm:h-9 rounded-xl font-bold text-xs sm:text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 gap-1.5 px-3 border border-rose-200/60 bg-rose-500/[0.03] active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[36px]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 
            <span>Clear{totalCount > 0 ? ` (${totalCount})` : ''}</span>
          </Button>
        )}
      </div>

      {/* Expanded Accordion Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-dashed border-border/70"
          >
            <div className="p-3 sm:p-4 space-y-4 bg-muted/[0.02]">
              {/* Row 1: Quick Filter Preset Chips (User Request: expands to show all deals, etc.) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" /> Quick Presets
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                  {savedViews.filter(v => v.isSystemPreset).map(preset => {
                    const isSelected = preset.id === activeViewId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectView(preset)}
                        className={cn(
                          "h-9 sm:h-8 px-3 rounded-lg font-bold text-xs sm:text-[11px] flex items-center gap-1.5 shrink-0 transition-all select-none active:scale-[0.97] min-h-[44px] sm:min-h-[32px]",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-background border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Range & Deep Filter Attributes */}
              <div className="flex flex-wrap items-end gap-4 sm:gap-6 pt-1">
                {/* Value Range */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote className="h-3 w-3" /> Deal Value
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder="Min" 
                      value={filters.valueMin ?? ''} 
                      onChange={e => updateFilter('valueMin', e.target.value === '' ? null : Number(e.target.value))} 
                      className="h-10 sm:h-9 w-[110px] sm:w-[95px] rounded-xl border border-border bg-background font-semibold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]" 
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder="Max" 
                      value={filters.valueMax ?? ''} 
                      onChange={e => updateFilter('valueMax', e.target.value === '' ? null : Number(e.target.value))} 
                      className="h-10 sm:h-9 w-[110px] sm:w-[95px] rounded-xl border border-border bg-background font-semibold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]" 
                    />
                  </div>
                </div>

                {/* Forecast Close Date Range */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarRange className="h-3 w-3" /> Forecast Date
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input 
                      type="date" 
                      value={filters.closeDateFrom ?? ''} 
                      onChange={e => updateFilter('closeDateFrom', e.target.value || null)} 
                      className="h-10 sm:h-9 rounded-xl border border-border bg-background font-semibold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]" 
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input 
                      type="date" 
                      value={filters.closeDateTo ?? ''} 
                      onChange={e => updateFilter('closeDateTo', e.target.value || null)} 
                      className="h-10 sm:h-9 rounded-xl border border-border bg-background font-semibold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]" 
                    />
                  </div>
                </div>

                {/* Health Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Health Status
                  </label>
                  <Select 
                    value={filters.healthStatus ?? 'all'} 
                    onValueChange={(v: 'all' | 'healthy' | 'at_risk' | 'stalled') => updateFilter('healthStatus', v)}
                  >
                    <SelectTrigger className="h-10 sm:h-9 w-[130px] rounded-xl border border-border bg-background font-bold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]">
                      <SelectValue placeholder="Health" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs font-semibold">All Health</SelectItem>
                      <SelectItem value="healthy" className="text-xs font-semibold text-emerald-600">Healthy</SelectItem>
                      <SelectItem value="at_risk" className="text-xs font-semibold text-amber-600">At Risk</SelectItem>
                      <SelectItem value="stalled" className="text-xs font-semibold text-rose-600">Stalled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Archive Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Archive className="h-3 w-3" /> Archive Filter
                  </label>
                  <Select 
                    value={filters.archiveStatus ?? 'active'} 
                    onValueChange={(v: 'active' | 'archived' | 'all') => updateFilter('archiveStatus', v)}
                  >
                    <SelectTrigger className="h-10 sm:h-9 w-[130px] rounded-xl border border-border bg-background font-bold text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40 min-h-[44px] sm:min-h-[36px]">
                      <SelectValue placeholder="Archive Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="active" className="text-xs font-semibold text-emerald-600">Active Only</SelectItem>
                      <SelectItem value="archived" className="text-xs font-semibold text-amber-600">Archived Only</SelectItem>
                      <SelectItem value="all" className="text-xs font-semibold text-muted-foreground">All Records</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stages Filter (Available in List View or when explicitly enabled) */}
                {showStagesFilter && stages && stages.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3 w-3" /> Stages
                    </label>
                    <MultiSelectPopover
                      icon={<Layers className="h-3.5 w-3.5" />}
                      label="Stages"
                      selectedCount={filters.stageIds.length}
                      empty={!stages || stages.length === 0}
                    >
                      {stages.map(s => (
                        <label 
                          key={s.id} 
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 cursor-pointer min-h-[40px] transition-colors"
                        >
                          <Checkbox 
                            checked={filters.stageIds.includes(s.id)} 
                            onCheckedChange={() => toggleInArray('stageIds', s.id)} 
                          />
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || '#3b82f6' }} />
                          <span className="text-xs font-semibold truncate">{s.name}</span>
                        </label>
                      ))}
                    </MultiSelectPopover>
                  </div>
                )}
              </div>

              {/* Row 3: Merged Advanced Filter Rules Engine (Unified "Rules" section) */}
              {onOpenAdvancedFilters && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-background border border-border/70 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "p-2 rounded-lg",
                        hasAdvancedRules ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-muted text-muted-foreground"
                      )}>
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Advanced Filter Rules</span>
                          {hasAdvancedRules && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {advancedRulesCount} active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {hasAdvancedRules 
                            ? "Custom multi-condition logic is currently filtering this pipeline."
                            : "Create complex AND/OR logic rules across any deal property."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasAdvancedRules && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearAdvancedRules}
                          className="h-8 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Clear Rules
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant={hasAdvancedRules ? "default" : "outline"}
                        size="sm"
                        onClick={onOpenAdvancedFilters}
                        className={cn(
                          "h-8 px-3 rounded-lg text-xs font-bold shadow-xs active:scale-[0.97] transition-all",
                          hasAdvancedRules 
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                            : "border-border text-foreground hover:bg-muted/40"
                        )}
                      >
                        {hasAdvancedRules ? "Edit Rules..." : "+ Configure Rules"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Accessible popover wrapper for multi-select options (Tags, Stages).
 */
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
          variant="outline"
          className={cn(
            "h-10 sm:h-9 rounded-xl font-bold text-xs sm:text-[11px] gap-1.5 px-3 border border-border bg-background shadow-sm hover:bg-muted/10 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[36px] focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none",
            selectedCount > 0 ? "text-primary border-primary/30 bg-primary/[0.04]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {icon} 
          <span>{label}</span>
          {selectedCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] bg-primary text-primary-foreground rounded-full font-bold">
              {selectedCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 rounded-2xl border-border shadow-2xl max-h-[260px] overflow-y-auto z-[150]">
        {empty ? (
          <p className="text-xs font-semibold text-muted-foreground text-center py-4">None available in this workspace.</p>
        ) : (
          <div className="flex flex-col gap-0.5">{children}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
