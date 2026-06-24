
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
    List
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { savePipelineAction } from '@/lib/pipeline-actions';
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
                        <Select value={currentPipelineId || ''} onValueChange={setCurrentPipelineId}>
                            <SelectTrigger className="h-9 border-none shadow-none focus:ring-0 p-0 text-3xl font-bold tracking-tighter gap-2 w-auto bg-transparent hover:text-primary transition-colors">
                                <SelectValue placeholder={isLoadingPipelines ? "Loading..." : "Pipeline Registry"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl p-2 min-w-[240px]">
                                {activePipelines.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="rounded-lg pl-8 pr-2.5 py-2 my-0.5">
                                        <div className="flex items-center justify-between gap-4 w-full pr-2">
                                            <span className="font-semibold text-[10px] tracking-tight">{p.name}</span>
                                            {p.isDefault && <Badge variant="outline" className="h-4 border-primary/20 text-primary text-[7px] font-semibold uppercase px-1 shadow-sm">Default</Badge>}
                                        </div>
                                    </SelectItem>
                                ))}
                                {archivedPipelines.length > 0 && (
                                    <>
                                        <div className="h-px bg-border my-2 mx-1" />
                                        <div className="px-8 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Archived Pipelines</div>
                                        {archivedPipelines.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="rounded-lg pl-8 pr-2.5 py-2 my-0.5 opacity-60 hover:opacity-100">
                                                <div className="flex items-center justify-between gap-4 w-full pr-2">
                                                    <span className="font-semibold text-[10px] tracking-tight line-through decoration-muted-foreground/30">{p.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={handleAddPipeline} disabled={isInitializing} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5">
                                        {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add New Shared Pipeline</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                        <div className="w-full">{currentPipelineId && <PipelineConfigView pipelineId={currentPipelineId} onWidthChange={setColumnWidth} columnWidth={columnWidth} />}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        <CreateDealModal open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen} initialPipelineId={currentPipelineId || undefined} />
    </div>
    </PageContainerFluid>
  );
}
