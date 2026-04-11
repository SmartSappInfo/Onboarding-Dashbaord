
'use client';

import * as React from 'react';
import KanbanBoard from './components/KanbanBoard';
import PipelineConfigView from './components/PipelineConfigView';
import { 
    Workflow, 
    Search, 
    MapPin, 
    RotateCcw,
    Settings2,
    Zap,
    Layout,
    Filter,
    X,
    Plus,
    PlusCircle,
    Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Pipeline, Zone, LifecycleStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { savePipelineAction } from '@/lib/pipeline-actions';

export default function PipelineClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeView, setActiveView] = React.useState<'board' | 'config'>('board');
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);

  // SHARED PIPELINES: Query by array-contains for active workspace
  const pipelinesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
        collection(firestore, 'pipelines'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('createdAt', 'desc')
    ) : null, 
  [firestore, activeWorkspaceId]);
  const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

  const zonesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'zones'), orderBy('name', 'asc')) : null, 
  [firestore]);
  const { data: zones } = useCollection<Zone>(zonesQuery);

  const [currentPipelineId, setCurrentPipelineId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [zoneFilter, setZoneFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<LifecycleStatus | 'all'>('all');
  const [columnWidth, setColumnWidth] = React.useState(320);

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

        // 3. Fallback to default or first available
        const defaultPipeline = pipelines.find(p => p.isDefault) || pipelines[0];
        setCurrentPipelineId(defaultPipeline.id);
        if (defaultPipeline.columnWidth) setColumnWidth(defaultPipeline.columnWidth);
    } else if (!isLoadingPipelines) {
        setCurrentPipelineId(null);
    }
  }, [pipelines, currentPipelineId, isLoadingPipelines, columnWidth]);

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
        });
        
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

  const hasActiveFilters = searchTerm !== '' || zoneFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="shrink-0 bg-background/80 backdrop-blur-md border-b shadow-sm z-30">
        <div className="p-4 sm:p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 shrink-0 text-left">
                <div className="hidden sm:flex p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 rotate-3">
                    <Workflow className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Select value={currentPipelineId || ''} onValueChange={setCurrentPipelineId}>
                            <SelectTrigger className="h-9 border-none shadow-none focus:ring-0 p-0 text-lg sm:text-xl font-black uppercase tracking-tighter gap-2 w-auto bg-transparent hover:text-primary transition-colors">
                                <SelectValue placeholder={isLoadingPipelines ? "Loading..." : "Pipeline Registry"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl p-2 min-w-[240px]">
                                {pipelines?.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="rounded-lg p-2.5 my-0.5">
                                        <div className="flex items-center justify-between gap-4 w-full pr-2">
                                            <span className="font-black uppercase text-[10px] tracking-tight">{p.name}</span>
                                            {p.isDefault && <Badge variant="outline" className="h-4 border-primary/20 text-primary text-[7px] font-black uppercase px-1 shadow-sm">Default</Badge>}
                                        </div>
                                    </SelectItem>
                                ))}
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
            </div>

            <div className="flex items-center gap-3 flex-1 justify-end">
                <AnimatePresence mode="popLayout">
                    {activeView === 'board' && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-2 mr-2">
                            <div className="relative flex items-center">
                                <AnimatePresence>
                                    {isSearchExpanded ? (
                                        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
                                            <Input autoFocus placeholder="Search hubs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-10 rounded-xl bg-muted/30 border-primary/20 font-bold text-xs pl-4 pr-10 shadow-inner" />
                                            <button onClick={() => { setIsSearchExpanded(false); setSearchTerm(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"><X className="h-3.5 w-3.5" /></button>
                                        </motion.div>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/5 text-muted-foreground hover:text-primary" onClick={() => setIsSearchExpanded(true)}><Search className="h-4 w-4" /></Button>
                                    )}
                                </AnimatePresence>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={hasActiveFilters ? "secondary" : "ghost"} size="icon" className={cn("h-10 w-10 rounded-xl transition-all", hasActiveFilters ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:text-primary hover:bg-primary/5")}>
                                        <Filter className="h-4 w-4" />
                                        {hasActiveFilters && <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4 rounded-2xl border-none shadow-2xl space-y-6" align="end">
                                    <div className="space-y-4">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Zone / Region</Label>
                                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                                <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none font-bold text-[10px]"><SelectValue placeholder="All Zones" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="all" className="text-[10px] uppercase font-bold">Global View</SelectItem>
                                                    {zones?.map(z => <SelectItem key={z.id} value={z.id} className="text-[10px] uppercase font-bold">{z.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Lifecycle State</Label>
                                            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                                                <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none font-bold text-[10px]"><SelectValue placeholder="Any Status" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="all" className="text-[10px] uppercase font-bold">All Status</SelectItem>
                                                    <SelectItem value="Onboarding" className="text-[10px] uppercase font-bold text-blue-600">Onboarding</SelectItem>
                                                    <SelectItem value="Active" className="text-[10px] uppercase font-bold text-emerald-600">Active</SelectItem>
                                                    <SelectItem value="Churned" className="text-[10px] uppercase font-bold text-rose-600">Churned</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {hasActiveFilters && (<div className="pt-4 border-t border-dashed"><Button variant="ghost" onClick={() => { setSearchTerm(''); setZoneFilter('all'); setStatusFilter('all'); }} className="w-full h-8 rounded-lg font-black uppercase text-[9px] tracking-widest text-rose-600 hover:bg-rose-50 gap-2"><RotateCcw className="h-3 w-3" /> Clear All Filters</Button></div>)}
                                </PopoverContent>
                            </Popover>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border shadow-inner">
                    <Button variant="ghost" onClick={() => setActiveView('board')} className={cn("h-8 rounded-lg font-black uppercase text-[9px] tracking-widest px-4 transition-all", activeView === 'board' ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100")}><Layout className="mr-1.5 h-3.5 w-3.5" /> Board</Button>
                    <Button variant="ghost" onClick={() => setActiveView('config')} className={cn("h-8 rounded-lg font-black uppercase text-[9px] tracking-widest px-4 transition-all", activeView === 'config' ? "bg-card shadow-md text-primary" : "text-muted-foreground opacity-60 hover:opacity-100")}><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Config</Button>
                </div>
            </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
            {activeView === 'board' ? (
                <motion.div key={`board-${currentPipelineId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full w-full">
                    {currentPipelineId ? <KanbanBoard pipelineId={currentPipelineId} customWidth={columnWidth} filters={{ searchTerm, zoneId: zoneFilter, lifecycleStatus: statusFilter }} /> : <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 opacity-20"><Workflow size={120} /><p className="font-black uppercase tracking-[0.4em] text-2xl">Pipeline Clear</p></div>}
                </motion.div>
            ) : (
                <motion.div key={`config-${currentPipelineId}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full w-full overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-8">{currentPipelineId && <PipelineConfigView pipelineId={currentPipelineId} onWidthChange={setColumnWidth} columnWidth={columnWidth} />}</div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
