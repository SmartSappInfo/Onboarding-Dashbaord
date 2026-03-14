'use client';

import * as React from 'react';
import KanbanBoard from './components/KanbanBoard';
import { 
    Workflow, 
    Search, 
    MapPin, 
    ShieldCheck, 
    RotateCcw,
    Settings2,
    ChevronDown,
    Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Pipeline, Zone, LifecycleStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toTitleCase } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Executive Pipeline Command Hub.
 * Optimized for institutional oversight with high data density and minimalist controls.
 */

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
  const [columnWidth, setColumnWidth] = React.useState(320);

  // Initialization
  React.useEffect(() => {
    if (pipelines && pipelines.length > 0 && !currentPipelineId) {
        setCurrentPipelineId(pipelines[0].id);
    }
  }, [pipelines, currentPipelineId]);

  // Load UI preferences
  React.useEffect(() => {
    const savedWidth = localStorage.getItem('onboarding_column_width');
    if (savedWidth) setColumnWidth(parseInt(savedWidth, 10));
  }, []);

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
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      {/* Executive Command Header */}
      <header className="shrink-0 bg-background/80 backdrop-blur-md border-b shadow-sm z-30">
        <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
                <div className="p-3.5 bg-primary text-white rounded-[1.25rem] shadow-xl shadow-primary/20 rotate-3">
                    <Workflow className="h-6 w-6" />
                </div>
                <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Active Workflow</span>
                        <Badge variant="outline" className="h-4 border-primary/20 text-primary text-[8px] font-black px-1.5 bg-primary/5 uppercase">Live Sync</Badge>
                    </div>
                    <Select value={currentPipelineId || ''} onValueChange={setCurrentPipelineId}>
                        <SelectTrigger className="h-9 border-none shadow-none focus:ring-0 p-0 text-2xl font-black uppercase tracking-tighter gap-3 w-auto bg-transparent hover:text-primary transition-colors">
                            <SelectValue placeholder="Select Pipeline..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-[1.5rem] border-none shadow-2xl p-2 min-w-[240px]">
                            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Pipeline Registry</div>
                            {pipelines?.map(p => (
                                <SelectItem key={p.id} value={p.id} className="rounded-xl p-3 my-1">
                                    <span className="font-black uppercase text-xs tracking-tight">{p.name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-2xl border shadow-inner">
                <Button 
                    variant="ghost" 
                    className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-primary bg-white shadow-md px-6"
                >
                    <Workflow className="mr-2 h-4 w-4" /> Board View
                </Button>
                <Button 
                    variant="ghost" 
                    asChild
                    className="h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest text-muted-foreground opacity-60 hover:opacity-100 px-6"
                >
                    <Link href="/admin/pipeline/settings">
                        <Settings2 className="mr-2 h-4 w-4" /> Studio
                    </Link>
                </Button>
            </div>
        </div>

        {/* Global Pipeline Filters */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-4">
            <div className="relative flex-grow max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-20 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                <Input 
                    placeholder="Identify school or signatory..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-11 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-sm"
                />
            </div>

            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted/40">
                    <MapPin className="h-3.5 w-3.5 mr-2 text-primary/40" />
                    <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="all" className="font-black uppercase text-[10px]">Global Network</SelectItem>
                    {zones?.map(z => <SelectItem key={z.id} value={z.id} className="font-black uppercase text-[10px]">{z.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted/40">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2 text-primary/40" />
                    <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="all" className="font-black uppercase text-[10px]">All Status</SelectItem>
                    <SelectItem value="Onboarding" className="font-black uppercase text-[10px]">Onboarding</SelectItem>
                    <SelectItem value="Active" className="font-black uppercase text-[10px]">Active</SelectItem>
                    <SelectItem value="Churned" className="font-black uppercase text-[10px]">Churned</SelectItem>
                </SelectContent>
            </Select>

            {hasActiveFilters && (
                <Button 
                    variant="ghost" 
                    onClick={clearFilters}
                    className="h-11 px-4 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] text-muted-foreground hover:text-rose-600 transition-all gap-2"
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
                customWidth={columnWidth}
                filters={{
                    searchTerm,
                    zoneId: zoneFilter,
                    lifecycleStatus: statusFilter
                }}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 opacity-10">
                <Workflow size={120} className="mb-6" />
                <p className="font-black uppercase tracking-[0.4em] text-2xl">No Selection</p>
            </div>
        )}
      </div>
    </div>
  );
}
