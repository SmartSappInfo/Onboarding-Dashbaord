
'use client';

import * as React from 'react';
import KanbanBoard from './components/KanbanBoard';
import PipelineConfigView from './components/PipelineConfigView';
import DealsListView from './components/DealsListView';
import PipelineActionsView from './components/PipelineActionsView';
import PipelineFilterBar from './components/PipelineFilterBar';
import DealsOverviewView from './components/DealsOverviewView';
import DealsForecastView from './components/DealsForecastView';
import CreateDealModal from '../entities/components/CreateDealModal';
import {
    Workflow,
    Settings2,
    Layout,
    Plus,
    Loader2,
    List,
    Copy,
    Star,
    Check,
    GitBranch,
    Search,
    X,
    ChevronDown,
    Zap,
    TrendingUp,
    Target,
    BarChart3
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Pipeline, UserProfile, OnboardingStage, Tag, Automation, PipelineTarget } from '@/lib/types';
import { KanbanFilters, DEFAULT_FILTERS } from './pipeline-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { savePipelineAction, clonePipelineAction, setPipelineAsDefaultAction } from '@/lib/pipeline-actions';
import { useTerminology } from '@/hooks/use-terminology';
import { PageContainerFluid } from '@/components/ui/page-container';
import SavedViewsBar from './components/SavedViewsBar';
import AdvancedFilterBuilderModal from './components/AdvancedFilterBuilderModal';
import DealsAnalyticsView from './components/DealsAnalyticsView';
import { listDealSavedViewsAction } from '@/app/actions/deal-saved-view-actions';
import { getPipelineTargetsAction } from '@/app/actions/deal-analytics-actions';
import {
  type DealSavedView,
  type DealColumnKey,
  type TableDensity,
  DEFAULT_DEAL_COLUMNS,
  SYSTEM_SAVED_VIEW_PRESETS,
} from '@/lib/deals/deal-saved-views';

export default function PipelineClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  const { plural } = useTerminology();
  
  const [activeView, setActiveView] = React.useState<'overview' | 'board' | 'list' | 'forecast' | 'analytics' | 'config' | 'actions'>('board');
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = React.useState(false);

  // SHARED PIPELINES: Query by array-contains for active workspace
  const pipelinesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
        collection(firestore, 'pipelines'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('createdAt', 'desc')
    ) : null, 
  [firestore, activeWorkspaceId]);
  const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

  // SHARED AUTOMATIONS: Query by array-contains for active workspace to drive stage indicators & Actions view
  const automationsQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
        collection(firestore, 'automations'),
        where('workspaceIds', 'array-contains', activeWorkspaceId)
    ) : null, 
  [firestore, activeWorkspaceId]);
  const { data: automations } = useCollection<Automation>(automationsQuery);

  const activePipelines = React.useMemo(() => {
    return pipelines?.filter(p => !p.isArchived) || [];
  }, [pipelines]);

  const archivedPipelines = React.useMemo(() => {
    return pipelines?.filter(p => p.isArchived) || [];
  }, [pipelines]);

  const [currentPipelineId, setCurrentPipelineId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filters, setFilters] = React.useState<KanbanFilters>(DEFAULT_FILTERS);
  const [columnWidth, setColumnWidth] = React.useState(320);

  // Phase 6: Saved Views & Columns Customization State
  const [savedViews, setSavedViews] = React.useState<DealSavedView[]>(() => {
    return SYSTEM_SAVED_VIEW_PRESETS.map(preset => ({
      ...preset,
      workspaceId: activeWorkspaceId || 'default',
      userId: 'system',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
  });
  const [activeViewId, setActiveViewId] = React.useState<string>('preset_all_deals');
  const [visibleColumns, setVisibleColumns] = React.useState<DealColumnKey[]>(DEFAULT_DEAL_COLUMNS);
  const [density, setDensity] = React.useState<TableDensity>('standard');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = React.useState(false);

  // Phase 7: Pipeline Revenue Targets State
  const [pipelineTargets, setPipelineTargets] = React.useState<PipelineTarget[]>([]);

  const loadPipelineTargets = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await getPipelineTargetsAction(activeWorkspaceId, currentPipelineId);
      if (res.success && res.targets) {
        setPipelineTargets(res.targets);
      }
    } catch {
      // Non-blocking fallback
    }
  }, [activeWorkspaceId, currentPipelineId]);

  React.useEffect(() => {
    loadPipelineTargets();
  }, [loadPipelineTargets]);

  const currentPipelineTarget = React.useMemo(() => {
    if (!pipelineTargets || pipelineTargets.length === 0) return null;
    return pipelineTargets.find(t => t.pipelineId === currentPipelineId) || pipelineTargets.find(t => !t.pipelineId) || null;
  }, [pipelineTargets, currentPipelineId]);

  // Pipeline Switcher & Clone state
  const [isSwitcherOpen, setIsSwitcherOpen] = React.useState(false);
  const [switcherSearch, setSwitcherSearch] = React.useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = React.useState(false);
  const [cloneTargetPipeline, setCloneTargetPipeline] = React.useState<Pipeline | null>(null);
  const [cloneName, setCloneName] = React.useState('');
  const [isCloning, setIsCloning] = React.useState(false);
  const justCreatedIdRef = React.useRef<string | null>(null);

  // ARCHITECTURAL POINTER:
  // Helper functions to persist and restore the active pipeline selection per workspace in localStorage.
  // This guarantees that refreshing the page or switching between workspaces restores the last active pipeline.
  const getStoredPipelineId = React.useCallback((wsId: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(`lastPipeline_${wsId}`);
    } catch {
      return null;
    }
  }, []);

  const setStoredPipelineId = React.useCallback((wsId: string, pId: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`lastPipeline_${wsId}`, pId);
    } catch {
      // Ignore storage write quota exceptions
    }
  }, []);

  const handleSelectPipeline = React.useCallback((pipelineId: string) => {
    setCurrentPipelineId(pipelineId);
    if (activeWorkspaceId) {
      setStoredPipelineId(activeWorkspaceId, pipelineId);
    }
  }, [activeWorkspaceId, setStoredPipelineId]);

  const currentPipeline = React.useMemo(() => {
    return pipelines?.find(p => p.id === currentPipelineId) || null;
  }, [pipelines, currentPipelineId]);

  const filteredActivePipelines = React.useMemo(() => {
    if (!switcherSearch.trim()) return activePipelines;
    const term = switcherSearch.toLowerCase().trim();
    return activePipelines.filter(p => p.name.toLowerCase().includes(term));
  }, [activePipelines, switcherSearch]);

  const filteredArchivedPipelines = React.useMemo(() => {
    if (!switcherSearch.trim()) return archivedPipelines;
    const term = switcherSearch.toLowerCase().trim();
    return archivedPipelines.filter(p => p.name.toLowerCase().includes(term));
  }, [archivedPipelines, switcherSearch]);

  const handleOpenCloneModal = (pipeline: Pipeline) => {
    setCloneTargetPipeline(pipeline);
    setCloneName(`${pipeline.name} (Copy)`);
    setIsCloneModalOpen(true);
  };

  const handleExecuteClone = async () => {
    if (!user || !cloneTargetPipeline || !cloneName.trim() || !activeWorkspaceId) return;
    setIsCloning(true);
    try {
      const res = await clonePipelineAction(cloneTargetPipeline.id, user.uid, cloneName.trim());
      if (res.success && res.id) {
        justCreatedIdRef.current = res.id;
        handleSelectPipeline(res.id);
        setIsCloneModalOpen(false);
        setCloneTargetPipeline(null);
        toast({
          title: 'Pipeline Cloned Successfully',
          description: `Duplicated "${cloneTargetPipeline.name}" settings and stages. Content & deals were not copied.`,
          actionConfig: {
            path: '/admin/pipeline',
            label: 'View Pipeline',
          },
        });
      } else {
        throw new Error(res.error || 'Failed to clone pipeline');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Cloning Failed', description: error });
    } finally {
      setIsCloning(false);
    }
  };

  const handleSetDefaultPipeline = async (pipelineIdToSet: string) => {
    if (!user || !activeWorkspaceId) return;
    try {
      const res = await setPipelineAsDefaultAction(pipelineIdToSet, activeWorkspaceId, user.uid);
      if (res.success) {
        toast({ title: 'Default Pipeline Updated' });
      } else {
        throw new Error(res.error || 'Failed to set default pipeline');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Update Failed', description: error });
    }
  };

  // Search has its own expand/collapse UI, so it lives outside the filter object
  // and is merged in only when handed to the board / list view.
  const mergedFilters = React.useMemo<KanbanFilters>(
    () => ({ ...filters, searchTerm }),
    [filters, searchTerm]
  );

  // Workspace-scoped users for the "Owner" filter (members of the active workspace)
  const usersQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId
      ? query(collection(firestore, 'users'), where('workspaceIds', 'array-contains', activeWorkspaceId))
      : null,
  [firestore, activeWorkspaceId]);
  const { data: users } = useCollection<UserProfile>(usersQuery);

  // Workspace-scoped tags for the "Tags" filter
  const tagsQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId
      ? query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId))
      : null,
  [firestore, activeWorkspaceId]);
  const { data: tags } = useCollection<Tag>(tagsQuery);

  // Stages for the current pipeline (stage multi-select filter)
  const filterStagesQuery = useMemoFirebase(() =>
    firestore && currentPipelineId ? query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', currentPipelineId),
      orderBy('order', 'asc')
    ) : null,
  [firestore, currentPipelineId]);
  const { data: filterStages } = useCollection<OnboardingStage>(filterStagesQuery);

  // Deals for current pipeline to power Overview KPIs and Attention panels
  const pipelineDealsQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId && currentPipelineId
      ? query(
          collection(firestore, 'deals'),
          where('workspaceId', '==', activeWorkspaceId),
          where('pipelineId', '==', currentPipelineId)
        )
      : null,
  [firestore, activeWorkspaceId, currentPipelineId]);
  const { data: pipelineDeals } = useCollection<import('@/lib/types').Deal>(pipelineDealsQuery);

  // Active (non-archived) deals for Overview KPIs and Forecasting calculations
  const activePipelineDeals = React.useMemo(() => {
    if (!pipelineDeals) return [];
    return pipelineDeals.filter(d => !d.isArchived);
  }, [pipelineDeals]);

  const handleNavigateToBoardWithFilter = React.useCallback((preset?: string) => {
    if (preset === 'sla_breached') {
      setFilters(prev => ({ ...prev, healthStatus: 'stalled' }));
    } else if (preset === 'at_risk') {
      setFilters(prev => ({ ...prev, healthStatus: 'at_risk' }));
    } else if (preset === 'closing_soon') {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, closeDateFrom: today, closeDateTo: nextWeek }));
    }
    setActiveView('board');
  }, []);

  const handleNavigateToListWithFilter = React.useCallback((preset?: string) => {
    if (preset === 'closing_soon') {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, closeDateFrom: today, closeDateTo: nextWeek }));
    } else if (preset === 'sla_breached') {
      setFilters(prev => ({ ...prev, healthStatus: 'stalled' }));
    } else if (preset === 'no_next_step') {
      setFilters(prev => ({ ...prev, healthStatus: 'at_risk' }));
    }
    setActiveView('list');
  }, []);

  const updateFilter = React.useCallback(<K extends keyof KanbanFilters>(key: K, value: KanbanFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm('');
    setActiveViewId('preset_all_deals');
  }, []);

  // Phase 6: Load Saved Views
  const loadSavedViews = React.useCallback(async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    try {
      const res = await listDealSavedViewsAction(activeWorkspaceId, user.uid);
      if (res.success && res.views) {
        setSavedViews(res.views);
      }
    } catch {
      // Non-blocking fallback to local presets
    }
  }, [activeWorkspaceId, user?.uid]);

  React.useEffect(() => {
    loadSavedViews();
  }, [loadSavedViews]);

  const handleSelectSavedView = React.useCallback((view: DealSavedView) => {
    setActiveViewId(view.id);

    // Apply view filters
    const newFilters: KanbanFilters = {
      searchTerm: view.filters.searchTerm || '',
      status: view.filters.status || 'all',
      healthStatus: (view.filters.healthStatus as KanbanFilters['healthStatus']) || 'all',
      archiveStatus: view.filters.isArchived ? 'archived' : 'active',
      assignedToId: view.filters.ownerId === 'current_user' ? (user?.uid || 'all') : (view.filters.ownerId || 'all'),
      valueMin: view.filters.valueMin ?? null,
      valueMax: view.filters.valueMax ?? null,
      closeDateFrom: null,
      closeDateTo: null,
      stageIds: view.filters.stageIds || [],
      tagIds: view.filters.tagIds || [],
      filterTree: view.filters.filterTree || null,
    };
    setFilters(newFilters);

    if (view.columns && view.columns.length > 0) {
      setVisibleColumns(view.columns);
    }
    if (view.density) {
      setDensity(view.density);
    }
    if (view.viewMode && ['overview', 'board', 'list', 'forecast', 'analytics'].includes(view.viewMode)) {
      setActiveView(view.viewMode as 'overview' | 'board' | 'list' | 'forecast' | 'analytics');
    }
  }, [user?.uid]);

  React.useEffect(() => {
    if (!activeWorkspaceId) return;

    if (pipelines && pipelines.length > 0) {
        // 1. If we just created a pipeline, hold selection until it appears in the snapshot list
        if (justCreatedIdRef.current) {
            const found = pipelines.find(p => p.id === justCreatedIdRef.current);
            if (found) {
                setCurrentPipelineId(found.id);
                setStoredPipelineId(activeWorkspaceId, found.id);
                if (found.columnWidth) setColumnWidth(found.columnWidth);
                justCreatedIdRef.current = null; // Protocol complete
                return;
            }
            return; // Wait for Firestore consistency
        }

        // 2. Resolve selection if currently pointed at a valid pipeline in this workspace
        if (currentPipelineId && pipelines.some(p => p.id === currentPipelineId)) {
            const current = pipelines.find(p => p.id === currentPipelineId);
            if (current?.columnWidth && current.columnWidth !== columnWidth) {
                setColumnWidth(current.columnWidth);
            }
            return;
        }

        // 3. Check workspace-scoped localStorage for the last active pipeline
        const storedPipelineId = getStoredPipelineId(activeWorkspaceId);
        if (storedPipelineId) {
            const storedPipeline = activePipelines.find(p => p.id === storedPipelineId) || pipelines.find(p => p.id === storedPipelineId);
            if (storedPipeline) {
                setCurrentPipelineId(storedPipeline.id);
                if (storedPipeline.columnWidth) setColumnWidth(storedPipeline.columnWidth);
                return;
            }
        }

        // 4. Fallback to default or first available active pipeline
        if (activePipelines.length > 0) {
            const defaultPipeline = activePipelines.find(p => p.isDefault) || activePipelines[0];
            setCurrentPipelineId(defaultPipeline.id);
            setStoredPipelineId(activeWorkspaceId, defaultPipeline.id);
            if (defaultPipeline.columnWidth) setColumnWidth(defaultPipeline.columnWidth);
        } else {
            const defaultPipeline = pipelines.find(p => p.isDefault) || pipelines[0];
            setCurrentPipelineId(defaultPipeline.id);
            setStoredPipelineId(activeWorkspaceId, defaultPipeline.id);
            if (defaultPipeline.columnWidth) setColumnWidth(defaultPipeline.columnWidth);
        }
    } else if (!isLoadingPipelines) {
        setCurrentPipelineId(null);
    }
  }, [pipelines, activePipelines, currentPipelineId, isLoadingPipelines, columnWidth, activeWorkspaceId, getStoredPipelineId, setStoredPipelineId]);

  const handleAddPipeline = async () => {
    if (!user || !activeWorkspaceId) return;
    setIsInitializing(true);
    
    try {
        const res = await savePipelineAction(null, {
            name: 'New Pipeline',
            description: `Operational track for ${plural.toLowerCase()}.`,
            workspaceIds: [activeWorkspaceId],
            stageIds: [],
            accessRoles: [],
            columnWidth: 320,
        }, user.uid);
        
        if (res.success && res.id) {
            justCreatedIdRef.current = res.id;
            handleSelectPipeline(res.id);
            setActiveView('config');
            toast({ title: 'Pipeline Space Initialized' });
        } else {
            throw new Error(res.error || "Failed to initialize pipeline");
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to initialize pipeline';
        toast({ variant: 'destructive', title: 'Initialization Failed', description: message });
    } finally {
        setIsInitializing(false);
    }
  };

  return (
    <PageContainerFluid>
    <div className="flex h-full flex-col overflow-hidden w-full">
        <header className="shrink-0 bg-transparent z-30">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-2">
                        {/* Redesigned Pipeline Switcher */}
                        <Popover open={isSwitcherOpen} onOpenChange={setIsSwitcherOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10 border-border/80 bg-card hover:bg-accent/80 transition-all duration-200 flex items-center gap-3.5 max-w-[340px] sm:max-w-md rounded-xl shadow-sm group active:scale-[0.98]"
                                >
                                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 transition-transform group-hover:scale-105">
                                        <GitBranch className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col items-start min-w-0 text-left">
                                        <div className="flex items-center gap-1.5 w-full">
                                            <span className="font-extrabold text-sm sm:text-base tracking-tight text-foreground truncate">
                                                {currentPipeline?.name || (isLoadingPipelines ? "Loading..." : "Pipeline Registry")}
                                            </span>
                                            {currentPipeline?.isDefault && (
                                                <Badge variant="outline" className="h-4 border-primary/20 bg-primary/10 text-primary text-[8px] font-bold uppercase px-1 shrink-0">
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium truncate">
                                            {filterStages ? `${filterStages.length} Stages` : 'Workflow Track'}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-auto transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent align="start" className="w-[320px] sm:w-[360px] p-2 rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl z-[200]">
                                {/* Search Header */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/50 mb-2">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <input
                                        type="text"
                                        value={switcherSearch}
                                        onChange={(e) => setSwitcherSearch(e.target.value)}
                                        placeholder="Search pipelines..."
                                        className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                                    />
                                    {switcherSearch && (
                                        <button onClick={() => setSwitcherSearch('')} className="text-muted-foreground hover:text-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Active Pipelines List */}
                                <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
                                    <p className="px-2.5 py-1 text-[9px] font-extrabold text-muted-foreground/70 uppercase tracking-wider">
                                        Active Pipelines ({activePipelines.length})
                                    </p>
                                    {filteredActivePipelines.map((p) => {
                                        const isSelected = p.id === currentPipelineId;
                                        return (
                                            <div
                                                key={p.id}
                                                className={cn(
                                                    "flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer group/item",
                                                    isSelected ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-accent text-foreground"
                                                )}
                                                onClick={() => {
                                                    handleSelectPipeline(p.id);
                                                    setIsSwitcherOpen(false);
                                                }}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                    <Check className={cn("h-4 w-4 text-primary shrink-0 transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                                                    <span className="truncate">{p.name}</span>
                                                    {p.isDefault && (
                                                        <Badge variant="outline" className="h-4 border-primary/20 text-primary text-[7px] font-bold uppercase px-1 shrink-0">
                                                            Default
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Quick Item Actions */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 rounded-md hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-500"
                                                        title="Clone Pipeline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenCloneModal(p);
                                                            setIsSwitcherOpen(false);
                                                        }}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    {!p.isDefault && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md hover:bg-amber-500/20 text-muted-foreground hover:text-amber-500"
                                                            title="Set as Default"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSetDefaultPipeline(p.id);
                                                            }}
                                                        >
                                                            <Star className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Archived Pipelines */}
                                    {filteredArchivedPipelines.length > 0 && (
                                        <>
                                            <div className="h-px bg-border/60 my-2" />
                                            <p className="px-2.5 py-1 text-[9px] font-extrabold text-muted-foreground/70 uppercase tracking-wider">
                                                Archived Pipelines
                                            </p>
                                            {filteredArchivedPipelines.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs opacity-60 hover:opacity-100 hover:bg-accent cursor-pointer"
                                                    onClick={() => {
                                                        handleSelectPipeline(p.id);
                                                        setIsSwitcherOpen(false);
                                                    }}
                                                >
                                                    <span className="truncate line-through decoration-muted-foreground/40">{p.name}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>

                                {/* Switcher Footer Actions */}
                                <div className="border-t border-border/60 pt-2 mt-2 flex items-center justify-between gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setIsSwitcherOpen(false);
                                            handleAddPipeline();
                                        }}
                                        className="h-8 w-full justify-center gap-1.5 text-xs font-semibold rounded-xl"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-primary" />
                                        <span>New Pipeline</span>
                                    </Button>

                                    {currentPipeline && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setIsSwitcherOpen(false);
                                                handleOpenCloneModal(currentPipeline);
                                            }}
                                            className="h-8 w-full justify-center gap-1.5 text-xs font-semibold rounded-xl border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            <span>Clone Pipeline</span>
                                        </Button>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleAddPipeline}
                                        disabled={isInitializing}
                                        className="h-10 w-10 rounded-xl border-border/80 text-muted-foreground hover:text-primary hover:bg-primary/5 shadow-sm"
                                    >
                                        {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add New Shared Pipeline</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {currentPipeline && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleOpenCloneModal(currentPipeline)}
                                            className="h-10 w-10 rounded-xl border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 shadow-sm"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clone Current Pipeline ({currentPipeline.name})</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-1 justify-end">
                    <Button onClick={() => setIsCreateDealOpen(true)} className="h-9 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 shadow-md mr-1 px-4 text-xs">
                        <Plus className="h-4 w-4" /> Add Deal
                    </Button>

                    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border shadow-inner">
                        <Button variant="ghost" onClick={() => setActiveView('overview')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'overview' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><TrendingUp className="h-3.5 w-3.5" /> Overview</Button>
                        <Button variant="ghost" onClick={() => setActiveView('board')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'board' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><Layout className="h-3.5 w-3.5" /> Board</Button>
                        <Button variant="ghost" onClick={() => setActiveView('list')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'list' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><List className="h-3.5 w-3.5" /> List</Button>
                        <Button variant="ghost" onClick={() => setActiveView('forecast')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'forecast' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><Target className="h-3.5 w-3.5" /> Forecast</Button>
                        <Button variant="ghost" onClick={() => setActiveView('analytics')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'analytics' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><BarChart3 className="h-3.5 w-3.5" /> Analytics</Button>
                        <Button variant="ghost" onClick={() => setActiveView('config')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'config' ? "bg-card shadow-md text-primary font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><Settings2 className="h-3.5 w-3.5" /> Config</Button>
                        <Button variant="ghost" onClick={() => setActiveView('actions')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-3.5 transition-all flex items-center gap-1.5", activeView === 'actions' ? "bg-card shadow-md text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground opacity-60 hover:opacity-100")}><Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Actions</Button>
                    </div>
                </div>
            </div>
        </header>

        {/* Phase 6: Saved Views & Presets Bar */}
        {activeView !== 'config' && activeView !== 'actions' && activeView !== 'analytics' && (
            <SavedViewsBar
                workspaceId={activeWorkspaceId || ''}
                userId={user?.uid || ''}
                userName={user?.displayName || user?.email || undefined}
                savedViews={savedViews}
                activeViewId={activeViewId}
                onSelectView={handleSelectSavedView}
                currentFilters={filters}
                currentColumns={visibleColumns}
                currentDensity={density}
                deals={pipelineDeals || []}
                stages={filterStages || []}
                onRefreshViews={loadSavedViews}
            />
        )}

        {/* Inline workspace-scoped filter card */}
        {activeView !== 'config' && activeView !== 'actions' && activeView !== 'overview' && activeView !== 'forecast' && activeView !== 'analytics' && (
            <PipelineFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                filters={filters}
                updateFilter={updateFilter}
                onClear={clearAllFilters}
                users={users}
                tags={tags}
                stages={filterStages}
                showStagesFilter={activeView === 'list'}
                onOpenAdvancedFilters={() => setIsAdvancedFilterOpen(true)}
            />
        )}

        <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
                {activeView === 'overview' ? (
                    <motion.div key={`overview-${currentPipelineId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-hidden">
                        {currentPipeline ? (
                            <DealsOverviewView
                                pipeline={currentPipeline}
                                stages={filterStages || []}
                                deals={activePipelineDeals}
                                onCreateDeal={() => setIsCreateDealOpen(true)}
                                onNavigateToBoard={handleNavigateToBoardWithFilter}
                                onNavigateToList={handleNavigateToListWithFilter}
                                onOpenDeal={(deal) => {
                                    window.open(`/admin/deals/${deal.id}`, '_blank');
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20">
                                <Workflow size={120} />
                                <p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p>
                            </div>
                        )}
                    </motion.div>
                ) : activeView === 'forecast' ? (
                    <motion.div key={`forecast-${currentPipelineId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-hidden">
                        {currentPipeline ? (
                            <DealsForecastView
                                pipelineId={currentPipeline.id}
                                stages={filterStages || []}
                                deals={activePipelineDeals}
                                pipelineTarget={currentPipelineTarget}
                                onOpenDeal={(deal) => {
                                    window.open(`/admin/deals/${deal.id}`, '_blank');
                                }}
                                onTargetSaved={() => {
                                    loadPipelineTargets();
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20">
                                <Workflow size={120} />
                                <p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p>
                            </div>
                        )}
                    </motion.div>
                ) : activeView === 'analytics' ? (
                    <motion.div key={`analytics-${currentPipelineId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-hidden">
                        {currentPipeline ? (
                            <DealsAnalyticsView
                                pipeline={currentPipeline}
                                stages={filterStages || []}
                                deals={activePipelineDeals}
                                users={users || []}
                                pipelineTarget={currentPipelineTarget}
                                onNavigateToBoard={() => setActiveView('board')}
                                onNavigateToList={() => setActiveView('list')}
                                onTargetSaved={() => {
                                    loadPipelineTargets();
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20">
                                <Workflow size={120} />
                                <p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p>
                            </div>
                        )}
                    </motion.div>
                ) : activeView === 'board' ? (
                    <motion.div key={`board-${currentPipelineId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full w-full">
                        {currentPipelineId ? <KanbanBoard pipelineId={currentPipelineId} pipelineName={currentPipeline?.name} customWidth={columnWidth} filters={mergedFilters} automations={automations || undefined} /> : <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20"><Workflow size={120} /><p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p></div>}
                    </motion.div>
                ) : activeView === 'list' ? (
                    <motion.div key={`list-${currentPipelineId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full w-full">
                        {currentPipelineId ? (
                            <DealsListView
                                pipelineId={currentPipelineId}
                                filters={mergedFilters}
                                visibleColumns={visibleColumns}
                                onChangeColumns={setVisibleColumns}
                                density={density}
                                onChangeDensity={setDensity}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20"><Workflow size={120} /><p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p></div>
                        )}
                    </motion.div>
                ) : activeView === 'actions' ? (
                    <motion.div key={`actions-${currentPipelineId}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full w-full overflow-hidden">
                        {currentPipeline ? (
                            <PipelineActionsView 
                                pipeline={currentPipeline}
                                stages={filterStages || []}
                                automations={automations || undefined}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20">
                                <Workflow size={120} />
                                <p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div key={`config-${currentPipelineId}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full w-full overflow-y-auto">
                        <div className="w-full">
                            {currentPipelineId && (
                                <PipelineConfigView 
                                    pipelineId={currentPipelineId} 
                                    onWidthChange={setColumnWidth} 
                                    columnWidth={columnWidth}
                                    onPipelineSelect={handleSelectPipeline}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        <CreateDealModal open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen} initialPipelineId={currentPipelineId || undefined} />

        {/* Clone Pipeline Modal */}
        <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
            <DialogContent className="rounded-2xl max-w-md bg-background border border-border shadow-2xl p-6">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                            <Copy className="h-4 w-4" />
                        </div>
                        <span>Clone Pipeline Architecture</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Duplicate metadata, stages, SLA thresholds, and colors under a new pipeline blueprint.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-3">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">New Pipeline Label</Label>
                        <Input
                            value={cloneName}
                            onChange={(e) => setCloneName(e.target.value)}
                            placeholder="e.g. Sales Pipeline (Copy)"
                            className="h-10 rounded-xl border border-border text-xs px-3.5 font-semibold"
                        />
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        <span className="font-bold block mb-0.5">Cloning Scope Note:</span>
                        All stages and configurations will be cloned. Existing deals, contacts, and activity logs will <span className="font-extrabold underline">NOT</span> be copied.
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCloneModalOpen(false)}
                        className="h-9 text-xs rounded-xl font-semibold"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleExecuteClone}
                        disabled={isCloning || !cloneName.trim()}
                        className="h-9 text-xs rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5 shadow-md"
                    >
                        {isCloning ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Cloning Pipeline...</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Clone Pipeline</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Phase 6: Advanced Multi-Condition Filter Builder Modal */}
        <AdvancedFilterBuilderModal
            isOpen={isAdvancedFilterOpen}
            onClose={() => setIsAdvancedFilterOpen(false)}
            filterTree={filters.filterTree}
            onApply={(tree) => setFilters(prev => ({ ...prev, filterTree: tree }))}
            onSaveAsView={(tree) => {
                setFilters(prev => ({ ...prev, filterTree: tree }));
                loadSavedViews();
            }}
            deals={pipelineDeals || []}
            stages={filterStages || []}
            users={users || []}
            currentUserId={user?.uid}
        />
    </div>
    </PageContainerFluid>
  );
}
