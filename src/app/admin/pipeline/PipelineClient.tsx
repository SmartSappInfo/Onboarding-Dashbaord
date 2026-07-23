
'use client';

import * as React from 'react';
import KanbanBoard from './components/KanbanBoard';
import PipelineConfigView from './components/PipelineConfigView';
import DealsListView from './components/DealsListView';
import PipelineFilterBar from './components/PipelineFilterBar';
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
    Layers
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Pipeline, Zone, UserProfile, OnboardingStage, Tag } from '@/lib/types';
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
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { savePipelineAction, clonePipelineAction, setPipelineAsDefaultAction } from '@/lib/pipeline-actions';
import { useTerminology } from '@/hooks/use-terminology';
import { PageContainerFluid } from '@/components/ui/page-container';

export default function PipelineClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const { plural } = useTerminology();
  
  const [activeView, setActiveView] = React.useState<'board' | 'list' | 'config'>('board');
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

  const activePipelines = React.useMemo(() => {
    return pipelines?.filter(p => !p.isArchived) || [];
  }, [pipelines]);

  const archivedPipelines = React.useMemo(() => {
    return pipelines?.filter(p => p.isArchived) || [];
  }, [pipelines]);

  const zonesQuery = useMemoFirebase(() => 
    firestore && activeOrganizationId ? query(collection(firestore, 'zones'), where('organizationId', '==', activeOrganizationId), orderBy('name', 'asc')) : null, 
  [firestore, activeOrganizationId]);
  const { data: zones } = useCollection<Zone>(zonesQuery);

  const [currentPipelineId, setCurrentPipelineId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filters, setFilters] = React.useState<KanbanFilters>(DEFAULT_FILTERS);
  const [columnWidth, setColumnWidth] = React.useState(320);

  // Pipeline Switcher & Clone state
  const [isSwitcherOpen, setIsSwitcherOpen] = React.useState(false);
  const [switcherSearch, setSwitcherSearch] = React.useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = React.useState(false);
  const [cloneTargetPipeline, setCloneTargetPipeline] = React.useState<Pipeline | null>(null);
  const [cloneName, setCloneName] = React.useState('');
  const [isCloning, setIsCloning] = React.useState(false);

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
    if (!user || !cloneTargetPipeline || !cloneName.trim()) return;
    setIsCloning(true);
    try {
      const res = await clonePipelineAction(cloneTargetPipeline.id, user.uid, cloneName.trim());
      if (res.success && res.id) {
        justCreatedIdRef.current = res.id;
        setCurrentPipelineId(res.id);
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

  const updateFilter = React.useCallback(<K extends keyof KanbanFilters>(key: K, value: KanbanFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm('');
  }, []);

  // Track if the user just created a pipeline to prevent the effect from resetting it
  const justCreatedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (pipelines && pipelines.length > 0) {
        // 1. If we just created a pipeline, hold selection until it appears in the snapshot list
        if (justCreatedIdRef.current) {
            const found = pipelines.find(p => p.id === justCreatedIdRef.current);
            if (found) {
                setCurrentPipelineId(found.id);
                if (found.columnWidth) setColumnWidth(found.columnWidth);
                justCreatedIdRef.current = null; // Protocol complete
                return;
            }
            return; // Wait for Firestore consistency
        }

        // 2. Resolve selection if currently pointed at a valid pipeline
        if (currentPipelineId && pipelines.find(p => p.id === currentPipelineId)) {
            const current = pipelines.find(p => p.id === currentPipelineId);
            if (current?.columnWidth && current.columnWidth !== columnWidth) {
                setColumnWidth(current.columnWidth);
            }
            return;
        }

        // 3. Fallback to default or first available active pipeline
        if (activePipelines.length > 0) {
            const defaultPipeline = activePipelines.find(p => p.isDefault) || activePipelines[0];
            setCurrentPipelineId(defaultPipeline.id);
            if (defaultPipeline.columnWidth) setColumnWidth(defaultPipeline.columnWidth);
        } else {
            const defaultPipeline = pipelines.find(p => p.isDefault) || pipelines[0];
            setCurrentPipelineId(defaultPipeline.id);
            if (defaultPipeline.columnWidth) setColumnWidth(defaultPipeline.columnWidth);
        }
    } else if (!isLoadingPipelines) {
        setCurrentPipelineId(null);
    }
  }, [pipelines, activePipelines, currentPipelineId, isLoadingPipelines, columnWidth]);

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
            setCurrentPipelineId(res.id);
            setActiveView('config');
            toast({ title: 'Pipeline Space Initialized' });
        } else {
            throw new Error(res.error || "Failed to initialize pipeline");
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Initialization Failed', description: e.message });
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
                                                    setCurrentPipelineId(p.id);
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
                                                        setCurrentPipelineId(p.id);
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

                    <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border shadow-inner">
                        <Button variant="ghost" onClick={() => setActiveView('board')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-4 transition-all", activeView === 'board' ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100")}><Layout className="mr-1.5 h-3.5 w-3.5" /> Board</Button>
                        <Button variant="ghost" onClick={() => setActiveView('list')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-4 transition-all", activeView === 'list' ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100")}><List className="mr-1.5 h-3.5 w-3.5" /> List</Button>
                        <Button variant="ghost" onClick={() => setActiveView('config')} className={cn("h-8 rounded-lg font-semibold text-[9px] px-4 transition-all", activeView === 'config' ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100")}><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Config</Button>
                    </div>
                </div>
            </div>
        </header>

        {/* Inline workspace-scoped filter card */}
        {activeView !== 'config' && (
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
            />
        )}

        <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
                {activeView === 'board' ? (
                    <motion.div key={`board-${currentPipelineId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full w-full">
                        {currentPipelineId ? <KanbanBoard pipelineId={currentPipelineId} customWidth={columnWidth} filters={mergedFilters} /> : <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20"><Workflow size={120} /><p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p></div>}
                    </motion.div>
                ) : activeView === 'list' ? (
                    <motion.div key={`list-${currentPipelineId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full w-full">
                        {currentPipelineId ? <DealsListView pipelineId={currentPipelineId} filters={mergedFilters} /> : <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20"><Workflow size={120} /><p className="font-semibold tracking-[0.4em] text-2xl">Pipeline Clear</p></div>}
                    </motion.div>
                ) : (
                    <motion.div key={`config-${currentPipelineId}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full w-full overflow-y-auto">
                        <div className="w-full">
                            {currentPipelineId && (
                                <PipelineConfigView 
                                    pipelineId={currentPipelineId} 
                                    onWidthChange={setColumnWidth} 
                                    columnWidth={columnWidth}
                                    onPipelineSelect={setCurrentPipelineId}
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
    </div>
    </PageContainerFluid>
  );
}
