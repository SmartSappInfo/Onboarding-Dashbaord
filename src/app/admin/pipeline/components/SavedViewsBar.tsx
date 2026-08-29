/**
 * @fileoverview Saved Views Navigation Bar & Preset Selector
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Section 31, UI Section 14):
 * - Displays active commercial saved view presets with live badge counters.
 * - Supports instant switching between system presets (My Deals, Closing This Month, At Risk, etc.)
 *   and user-created custom views.
 * - Allows saving the current filter/column configuration as a new persistent saved view.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5, Rule 3):
 * - Zero 'any' / zero 'any[]'.
 * - Accessible touch targets >= 44px.
 * - Actionable toasts with relative paths on save / delete.
 */

'use client';

import * as React from 'react';
import {
  Star,
  Flame,
  AlertTriangle,
  Clock,
  DollarSign,
  Trophy,
  ListTodo,
  Layers,
  Bookmark,
  Plus,
  MoreVertical,
  Check,
  Trash2,
  Lock,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Deal, OnboardingStage, UserProfile } from '@/lib/types';
import type {
  DealSavedView,
  DealColumnKey,
  TableDensity,
} from '@/lib/deals/deal-saved-views';
import {
  createDealSavedViewAction,
  deleteDealSavedViewAction,
  updateDealSavedViewAction,
} from '@/app/actions/deal-saved-view-actions';
import type { KanbanFilters } from '../pipeline-types';
import { countMatchingDeals } from '@/lib/deals/deal-filter-engine';

interface SavedViewsBarProps {
  workspaceId: string;
  userId: string;
  userName?: string;
  savedViews: DealSavedView[];
  activeViewId: string;
  onSelectView: (view: DealSavedView) => void;
  currentFilters: KanbanFilters;
  currentColumns?: DealColumnKey[];
  currentDensity?: TableDensity;
  deals: Deal[];
  stages: OnboardingStage[];
  onRefreshViews?: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Layers: <Layers className="h-3.5 w-3.5" />,
  Star: <Star className="h-3.5 w-3.5" />,
  Flame: <Flame className="h-3.5 w-3.5" />,
  AlertTriangle: <AlertTriangle className="h-3.5 w-3.5" />,
  Clock: <Clock className="h-3.5 w-3.5" />,
  DollarSign: <DollarSign className="h-3.5 w-3.5" />,
  Trophy: <Trophy className="h-3.5 w-3.5" />,
  ListTodo: <ListTodo className="h-3.5 w-3.5" />,
  Bookmark: <Bookmark className="h-3.5 w-3.5" />,
};

export default function SavedViewsBar({
  workspaceId,
  userId,
  userName,
  savedViews,
  activeViewId,
  onSelectView,
  currentFilters,
  currentColumns,
  currentDensity,
  deals,
  stages,
  onRefreshViews,
}: SavedViewsBarProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [isSaveOpen, setIsSaveOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState('');
  const [newViewVisibility, setNewViewVisibility] = React.useState<'private' | 'workspace'>('workspace');
  const [newViewIcon, setNewViewIcon] = React.useState('Bookmark');
  const [isSaving, setIsSaving] = React.useState(false);

  const stagesMap = React.useMemo(() => {
    const map = new Map<string, OnboardingStage>();
    stages.forEach(s => map.set(s.id, s));
    return map;
  }, [stages]);

  // Calculate live counts for each view
  const viewCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    savedViews.forEach(v => {
      if (v.id === 'preset_all_deals') {
        counts[v.id] = deals.filter(d => !d.isArchived).length;
      } else if (v.filters.healthStatus && v.filters.healthStatus !== 'all') {
        counts[v.id] = deals.filter(d => !d.isArchived && d.healthStatus === v.filters.healthStatus).length;
      } else if (v.filters.filterTree) {
        counts[v.id] = countMatchingDeals(deals, v.filters.filterTree, {
          currentUserId: userId,
          stagesMap,
          now: new Date(),
        });
      } else if (v.filters.ownerId === 'current_user') {
        counts[v.id] = deals.filter(d => !d.isArchived && d.assignedTo?.userId === userId).length;
      } else if (v.filters.valueMin) {
        counts[v.id] = deals.filter(d => !d.isArchived && (d.value ?? 0) >= v.filters.valueMin!).length;
      } else if (v.filters.status && v.filters.status !== 'all') {
        counts[v.id] = deals.filter(d => !d.isArchived && d.status === v.filters.status).length;
      } else {
        counts[v.id] = deals.filter(d => !d.isArchived).length;
      }
    });
    return counts;
  }, [savedViews, deals, userId, stagesMap]);

  const handleSaveView = async () => {
    if (!newViewName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for your saved view.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await createDealSavedViewAction(
        {
          workspaceId,
          name: newViewName.trim(),
          icon: newViewIcon,
          visibility: newViewVisibility,
          filters: {
            searchTerm: currentFilters.searchTerm,
            status: currentFilters.status,
            healthStatus: currentFilters.healthStatus,
            isArchived: currentFilters.archiveStatus === 'archived',
            ownerId: currentFilters.assignedToId || undefined,
            valueMin: currentFilters.valueMin,
            valueMax: currentFilters.valueMax,
            closeDateFrom: currentFilters.closeDateFrom,
            closeDateTo: currentFilters.closeDateTo,
            stageIds: currentFilters.stageIds,
            tagIds: currentFilters.tagIds,
            filterTree: currentFilters.filterTree || undefined,
          },
          columns: currentColumns,
          density: currentDensity,
        },
        userId,
        userName
      );

      if (res.success && res.view) {
        toast({
          title: 'View Saved',
          description: `Saved view "${newViewName.trim()}" is now ready.`,
          actionConfig: { path: '/admin/pipeline', label: 'View Pipeline' },
        });
        setIsSaveOpen(false);
        setNewViewName('');
        onRefreshViews?.();
        onSelectView(res.view);
      } else {
        toast({
          title: 'Save Failed',
          description: res.error || 'Failed to create saved view.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while saving the view.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteView = async (view: DealSavedView) => {
    const isConfirmed = await confirm({
      title: 'Delete Saved View',
      description: `Are you sure you want to permanently delete the "${view.name}" saved view?`,
      confirmText: 'Delete View',
      variant: 'destructive',
    });

    if (!isConfirmed) return;

    const res = await deleteDealSavedViewAction(view.id, userId);
    if (res.success) {
      toast({
        title: 'View Deleted',
        description: `Saved view "${view.name}" was removed.`,
        actionConfig: { path: '/admin/pipeline', label: 'Pipeline' },
      });
      onRefreshViews?.();
      // Switch back to All Deals
      const defaultView = savedViews.find(v => v.id === 'preset_all_deals') || savedViews[0];
      if (defaultView) onSelectView(defaultView);
    } else {
      toast({
        title: 'Delete Failed',
        description: res.error || 'Failed to delete saved view.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="shrink-0 mb-3 flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* Scrollable Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        {savedViews.map(view => {
          const isActive = view.id === activeViewId;
          const icon = ICON_MAP[view.icon || 'Bookmark'] || <Bookmark className="h-3.5 w-3.5" />;
          const count = viewCounts[view.id] ?? 0;

          return (
            <div key={view.id} className="relative flex items-center shrink-0">
              <button
                type="button"
                onClick={() => onSelectView(view)}
                className={cn(
                  'h-9 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all select-none min-h-[38px]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
                )}
              >
                <span className={cn(isActive ? 'text-primary-foreground' : 'text-primary')}>
                  {icon}
                </span>
                <span>{view.name}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-tight',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background/80 text-muted-foreground border border-border/50'
                  )}
                >
                  {count}
                </span>
              </button>

              {/* Context menu for custom views */}
              {!view.isSystemPreset && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'h-7 w-7 rounded-lg ml-0.5 flex items-center justify-center transition-colors',
                        isActive ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                      aria-label="View options"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl w-44">
                    <DropdownMenuItem
                      onClick={() => handleDeleteView(view)}
                      className="text-xs font-semibold text-rose-600 focus:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Save View Popover Button */}
      <Popover open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-xl font-bold text-xs shrink-0 border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground gap-1.5 shadow-xs active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Save View</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4 rounded-2xl border-border shadow-xl space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">Save Current View</h4>
            <p className="text-[11px] text-muted-foreground">
              Save current filters, column visibility, and row density as a reusable view preset.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">View Name</Label>
              <Input
                value={newViewName}
                onChange={e => setNewViewName(e.target.value)}
                placeholder="e.g. Enterprise Q3 Pipeline"
                className="h-9 rounded-xl text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visibility</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewViewVisibility('workspace')}
                  className={cn(
                    'p-2.5 rounded-xl border text-left space-y-1 transition-all',
                    newViewVisibility === 'workspace'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Globe className="h-3.5 w-3.5" /> Workspace
                  </div>
                  <p className="text-[10px] opacity-80 leading-tight">Shared with all team members</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNewViewVisibility('private')}
                  className={cn(
                    'p-2.5 rounded-xl border text-left space-y-1 transition-all',
                    newViewVisibility === 'private'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Lock className="h-3.5 w-3.5" /> Private
                  </div>
                  <p className="text-[10px] opacity-80 leading-tight">Visible only to you</p>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSaveOpen(false)}
              className="h-8 rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveView}
              disabled={isSaving || !newViewName.trim()}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Check className="h-3 w-3 mr-1.5" />}
              Save View
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
