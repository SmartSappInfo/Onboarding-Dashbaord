
'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KanbanBoard from './components/KanbanBoard';
import StageEditor from './components/StageEditor';
import { 
    Workflow, 
    ListChecks, 
    Search, 
    Filter, 
    Building, 
    MapPin, 
    Zap, 
    ChevronDown, 
    LayoutList,
    ShieldCheck,
    RotateCcw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Pipeline, Zone, LifecycleStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PipelineClient() {
  const firestore = useFirestore();
  
  // Pipeline Registry
  const pipelinesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'pipelines'), orderBy('createdAt', 'desc')) : null, 
  [firestore]);
  const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

  // Regional Context
  const zonesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'zones'), orderBy('name', 'asc')) : null, 
  [firestore]);
  const { data: zones } = useCollection<Zone>(zonesQuery);

  // Global Filter State
  const [currentPipelineId, setCurrentPipelineId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [zoneFilter, setZoneFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<LifecycleStatus | 'all'>('all');

  // Initialization
  React.useEffect(() => {
    if (pipelines && pipelines.length > 0 && !currentPipelineId) {
        setCurrentPipelineId(pipelines[0].id);
    }
  }, [pipelines, currentPipelineId]);

  const activePipeline = React.useMemo(() => 
    pipelines?.find(p => p.id === currentPipelineId), 
  [pipelines, currentPipelineId]);

  const clearFilters = () => {
    setSearchTerm('');
    setZoneFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || zoneFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/10">
      {/* Executive Header & Filter Bar */}
      <header className="shrink-0 bg-background border-b shadow-sm z-30">
        <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                    <Workflow className="h-6 w-6" />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <Select value={currentPipelineId || ''} onValueChange={setCurrentPipelineId}>
                            <SelectTrigger className="h-9 border-none shadow-none focus:ring-0 p-0 text-xl font-black uppercase tracking-tight gap-2 w-auto bg-transparent">
                                <SelectValue placeholder="Select Pipeline..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                                {pipelines?.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="rounded-xl p-3">
                                        <div className="flex flex-col text-left">
                                            <span className="font-black uppercase text-xs tracking-wide">{p.name}</span>
                                            {p.description && <span className="text-[10px] text-muted-foreground font-medium">{p.description}</span>}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Workflow Management Hub</p>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-muted/30 p-1 rounded-2xl border shadow-inner">
                <Button 
                    variant="ghost" 
                    onClick={() => {}} 
                    className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-primary bg-white shadow-sm px-6"
                >
                    <Workflow className="mr-2 h-4 w-4" /> Board
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => {}} 
                    className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-muted-foreground opacity-60 hover:opacity-100 px-6"
                >
                    <ListChecks className="mr-2 h-4 w-4" /> Config
                </Button>
            </div>
        </div>

        {/* Global Pipeline Filters */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-4">
            <div className="relative flex-grow max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input 
                    placeholder="Search schools or signatories..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-11 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                />
            </div>

            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                    <MapPin className="h-3.5 w-3.5 mr-2 text-primary/40" />
                    <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="all">Global Network</SelectItem>
                    {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2 text-primary/40" />
                    <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Lifecycle Stages</SelectItem>
                    <SelectItem value="Onboarding">Onboarding</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Churned">Churned</SelectItem>
                </SelectContent>
            </Select>

            {hasActiveFilters && (
                <Button 
                    variant="ghost" 
                    onClick={clearFilters}
                    className="h-11 px-4 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-all gap-2"
                >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
            )}
        </div>
      </header>

      {/* Main Kanban Content */}
      <div className="flex-grow overflow-hidden relative">
        {currentPipelineId ? (
            <KanbanBoard 
                pipelineId={currentPipelineId}
                filters={{
                    searchTerm,
                    zoneId: zoneFilter,
                    lifecycleStatus: statusFilter
                }}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 opacity-20">
                <Workflow size={80} className="mb-6" />
                <p className="font-black uppercase tracking-[0.3em] text-lg">No Pipeline Selected</p>
            </div>
        )}
      </div>
    </div>
  );
}
