/**
 * @fileoverview Quick Filters & Saved Views Dropdown Component
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (Rule 10, Rule 8, Rule 5):
 * - Bundles all system quick filter presets (My Deals, Closing This Month, At Risk,
 *   Stalled Deals, High Value, Won This Quarter, Without Next Steps) and custom user
 *   saved views into a unified, high-performance dropdown on the primary filter bar.
 * - Computes dynamic live counts for each view in a single memoized O(N) pass.
 * - Supports saving current filters, column layouts, and densities as a persistent view.
 * - Supports custom view deletion with confirmation dialog and safe fallback.
 * - Mobile ergonomics: Accessible touch targets >= 44px, minimal everyday UI English.
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
  Trash2,
  Lock,
  Globe,
  Loader2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import type { Deal, OnboardingStage } from '@/lib/types';
import type {
  DealSavedView,
  DealColumnKey,
  TableDensity,
} from '@/lib/deals/deal-saved-views';
import {
  createDealSavedViewAction,
  deleteDealSavedViewAction,
} from '@/app/actions/deal-saved-view-actions';
import type { KanbanFilters } from '../pipeline-types';
import { countMatchingDeals } from '@/lib/deals/deal-filter-engine';

export interface QuickFiltersDropdownProps {
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
  className?: string;
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

export function QuickFiltersDropdown({
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
  className,
}: QuickFiltersDropdownProps) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState('');
  const [newViewVisibility, setNewViewVisibility] = React.useState<'private' | 'workspace'>('workspace');
  const [newViewIcon] = React.useState('Bookmark');
  const [isSaving, setIsSaving] = React.useState(false);
  const [deletingViewId, setDeletingViewId] = React.useState<string | null>(null);

  // Map stages for O(1) lookups during count evaluations
  const stagesMap = React.useMemo(() => {
    const map = new Map<string, OnboardingStage>();
    if (Array.isArray(stages)) {
      stages.forEach(s => {
        if (s && s.id) map.set(s.id, s);
      });
    }
    return map;
  }, [stages]);

  // High-performance memoized count computation (10,000 items scale safe)
  const viewCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const safeDeals = Array.isArray(deals) ? deals : [];

    if (Array.isArray(savedViews)) {
      savedViews.forEach(v => {
        if (!v || !v.id) return;
        const filters = v.filters || {};

        if (v.id === 'preset_all_deals') {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived).length;
        } else if (filters.healthStatus && filters.healthStatus !== 'all') {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived && d?.healthStatus === filters.healthStatus).length;
        } else if (filters.filterTree) {
          counts[v.id] = countMatchingDeals(safeDeals, filters.filterTree, {
            currentUserId: userId,
            stagesMap,
            now: new Date(),
          });
        } else if (filters.ownerId === 'current_user') {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived && d?.assignedTo?.userId === userId).length;
        } else if (typeof filters.valueMin === 'number') {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived && (d?.value ?? 0) >= filters.valueMin!).length;
        } else if (filters.status && filters.status !== 'all') {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived && d?.status === filters.status).length;
        } else {
          counts[v.id] = safeDeals.filter(d => !d?.isArchived).length;
        }
      });
    }
    return counts;
  }, [savedViews, deals, userId, stagesMap]);

  const activeView = React.useMemo(() => {
    return savedViews.find(v => v.id === activeViewId) || savedViews[0] || null;
  }, [savedViews, activeViewId]);

  const activeIcon = activeView?.icon && ICON_MAP[activeView.icon] ? ICON_MAP[activeView.icon] : <Bookmark className="h-3.5 w-3.5" />;
  const activeCount = activeView ? (viewCounts[activeView.id] ?? 0) : 0;

  const systemPresets = React.useMemo(() => {
    return savedViews.filter(v => v.isSystemPreset);
  }, [savedViews]);

  const customViews = React.useMemo(() => {
    return savedViews.filter(v => !v.isSystemPreset);
  }, [savedViews]);

  const handleSaveView = async () => {
    if (!newViewName.trim()) {
      toast({
        title: 'Validation Alert',
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
        setIsSaveModalOpen(false);
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

  const handleDeleteView = async (e: React.MouseEvent, view: DealSavedView) => {
    e.stopPropagation();
    if (deletingViewId) return;

    const isConfirmed = await confirm({
      title: 'Delete Saved View',
      description: `Permanently delete the "${view.name}" saved view?`,
      confirmText: 'Delete View',
      variant: 'destructive',
    });

    if (!isConfirmed) return;

    try {
      setDeletingViewId(view.id);
      const res = await deleteDealSavedViewAction(view.id, userId);
      if (res.success) {
        toast({
          title: 'View Deleted',
          description: `Saved view "${view.name}" was removed.`,
          actionConfig: { path: '/admin/pipeline', label: 'Pipeline' },
        });
        onRefreshViews?.();
        // Fallback to All Deals if currently active
        if (view.id === activeViewId) {
          const defaultView = savedViews.find(v => v.id === 'preset_all_deals') || savedViews[0];
          if (defaultView) onSelectView(defaultView);
        }
      } else {
        toast({
          title: 'Delete Failed',
          description: res.error || 'Failed to delete saved view.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Delete Error',
        description: 'Failed to delete saved view.',
        variant: 'destructive',
      });
    } finally {
      setDeletingViewId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-10 sm:h-9 rounded-xl border border-border bg-background px-3 font-bold text-xs sm:text-[11px] shadow-sm hover:bg-muted/10 active:scale-[0.97] transition-all gap-2 text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none min-h-[44px] sm:min-h-[36px]',
              className
            )}
          >
            <span className="text-primary shrink-0">{activeIcon}</span>
            <span className="max-w-[120px] sm:max-w-[140px] truncate">{activeView?.name || 'Quick Filters'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground shrink-0 border border-border/40">
              {activeCount}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-2xl border-border shadow-2xl z-[150] max-h-[380px] overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">
            Quick Presets
          </DropdownMenuLabel>
          {systemPresets.map(preset => {
            const isSelected = preset.id === activeViewId;
            const icon = ICON_MAP[preset.icon || 'Bookmark'] || <Bookmark className="h-3.5 w-3.5" />;
            const count = viewCounts[preset.id] ?? 0;

            return (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onSelectView(preset)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer min-h-[40px] transition-colors',
                  isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
                  <span className="truncate">{preset.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground border border-border/40">
                    {count}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}

          {customViews.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">
                Custom Saved Views
              </DropdownMenuLabel>
              {customViews.map(view => {
                const isSelected = view.id === activeViewId;
                const count = viewCounts[view.id] ?? 0;

                return (
                  <div
                    key={view.id}
                    onClick={() => onSelectView(view)}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer min-h-[40px] transition-colors group',
                      isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Bookmark className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{view.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground border border-border/40">
                        {count}
                      </span>
                      <button
                        type="button"
                        disabled={deletingViewId === view.id}
                        onClick={(e) => handleDeleteView(e, view)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all min-h-[28px] min-w-[28px] flex items-center justify-center disabled:pointer-events-none"
                        title="Delete view"
                        aria-label={`Delete ${view.name} view`}
                      >
                        {deletingViewId === view.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer min-h-[40px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Save Current View...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save View Modal Dialog */}
      <Dialog
        open={isSaveModalOpen}
        onOpenChange={(open) => {
          if (isSaving) return;
          setIsSaveModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Save Current View</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Save current filters, column visibility, and row density as a reusable view preset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">View Name</Label>
              <Input
                value={newViewName}
                onChange={e => setNewViewName(e.target.value)}
                placeholder="e.g. Enterprise Q3 Pipeline"
                className="h-10 rounded-xl text-xs"
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
                    'p-3 rounded-xl border text-left space-y-1 transition-all min-h-[44px]',
                    newViewVisibility === 'workspace'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Globe className="h-3.5 w-3.5" /> Workspace
                  </div>
                  <p className="text-[10px] opacity-80 leading-tight">Shared with team</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNewViewVisibility('private')}
                  className={cn(
                    'p-3 rounded-xl border text-left space-y-1 transition-all min-h-[44px]',
                    newViewVisibility === 'private'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Lock className="h-3.5 w-3.5" /> Private
                  </div>
                  <p className="text-[10px] opacity-80 leading-tight">Only visible to you</p>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => setIsSaveModalOpen(false)}
              className="h-10 rounded-xl text-xs min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveView}
              disabled={isSaving || !newViewName.trim()}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm active:scale-[0.97] transition-all min-h-[44px]"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
