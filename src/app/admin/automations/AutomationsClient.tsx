'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Automation, AutomationRun } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Settings2, 
    History, 
    Trash2, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Loader2, 
    Activity, 
    Search, 
    ChevronRight, 
    ToggleLeft, 
    ToggleRight, 
    AlertCircle, 
    Database, 
    Timer, 
    ArrowRight, 
    SearchCode,
    ShieldAlert,
    Info,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { deleteAutomationAction, toggleAutomationStatusAction } from '@/lib/automation-actions';
import { processScheduledJobsAction } from '@/lib/automation-processor';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * @fileOverview High-fidelity Automation Hub Client.
 * Upgraded with Workspace-Binding to isolate protocols by track.
 */
export default function AutomationsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId } = useWorkspace();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedRun, setSelectedRun] = React.useState<AutomationRun | null>(null);
    const [isPulsing, setIsPulsing] = React.useState(false);

    // Workspace-Bound Blueprints Query - Updated to use workspaceIds array
    const automationsQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'automations'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    // Workspace-Bound Runs Query
    const runsQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'automation_runs'), 
            orderBy('startedAt', 'desc'), 
            limit(100)
        ) : null, 
    [firestore]);

    const { data: automations, isLoading: isLoadingAuth } = useCollection<Automation>(automationsQuery);
    const { data: allRuns, isLoading: isLoadingRuns } = useCollection<AutomationRun>(runsQuery);

    // Filter runs by workspace based on trigger data if available
    const filteredRuns = React.useMemo(() => {
        if (!allRuns) return [];
        return allRuns.filter(run => {
            const runWorkspaceId = run.triggerData?.workspaceId;
            return !runWorkspaceId || runWorkspaceId === activeWorkspaceId;
        });
    }, [allRuns, activeWorkspaceId]);

    const filteredAutomations = React.useMemo(() => {
        if (!automations) return [];
        return automations.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [automations, searchTerm]);

    const handleToggleStatus = async (id: string, current: boolean) => {
        const res = await toggleAutomationStatusAction(id, !current);
        if (res.success) toast({ title: !current ? 'Workflow Activated' : 'Workflow Paused' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Permanently purge this automation architecture?')) return;
        const res = await deleteAutomationAction(id);
        if (res.success) toast({ title: 'Automation Deleted' });
    };

    const handlePulseEngine = async () => {
        setIsPulsing(true);
        try {
            const res = await processScheduledJobsAction();
            if (res.success) {
                toast({ 
                    title: 'Engine Pulse Complete', 
                    description: res.processed ? `Resumed ${res.processed} pending protocols.` : 'No pending delays identified.' 
                });
            } else throw new Error(res.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Heartbeat Failure', description: e.message });
        } finally {
            setIsPulsing(false);
        }
    };

    const getDuration = (run: AutomationRun) => {
        if (!run.finishedAt) return 'Running...';
        const seconds = differenceInSeconds(parseISO(run.finishedAt), parseISO(run.startedAt));
        return `${seconds}s`;
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-10 pb-32">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground uppercase">
                            <Zap className="h-10 w-10 text-primary" />
                            Automation Hub
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Design and audit proactive institutional logic for the {activeWorkspaceId} track.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            onClick={handlePulseEngine} 
                            disabled={isPulsing}
                            className="rounded-xl font-bold h-12 px-6 border-primary/20 text-primary bg-card shadow-sm transition-all active:scale-95"
                        >
                            {isPulsing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Pulse Engine
                        </Button>
                        <Button asChild className="rounded-xl font-black h-12 px-8 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                            <Link href="/admin/automations/new"><Plus className="mr-2 h-5 w-5" /> Initialize Workflow</Link>
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="blueprints" className="space-y-8">
                    <TabsList className="bg-card/20 border shadow-sm p-1 h-12 rounded-2xl w-fit">
                        <TabsTrigger value="blueprints" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Active Blueprints</TabsTrigger>
                        <TabsTrigger value="runs" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2">
                            <History className="h-4 w-4" /> Run Ledger
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="blueprints" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Search workflows..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-12 rounded-2xl bg-card border-none shadow-sm ring-1 ring-border focus:ring-primary/20 font-bold pl-11"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {isLoadingAuth ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2.5rem]" />)
                            ) : filteredAutomations.length > 0 ? filteredAutomations.map((auth) => (
                                <Card key={auth.id} className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border glass-card overflow-hidden group hover:ring-primary/20 transition-all">
                                    <CardHeader className="bg-muted/10 border-b p-6 pb-4">
                                        <div className="flex items-center justify-between">
                                            <div className={cn(
                                                "p-2.5 rounded-xl transition-all shadow-sm",
                                                auth.isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground opacity-40"
                                            )}>
                                                <Zap className="h-5 w-5" />
                                            </div>
                                            <Badge variant={auth.isActive ? "default" : "secondary"} className="text-[8px] font-black uppercase px-2">
                                                {auth.isActive ? 'Active' : 'Paused'}
                                            </Badge>
                                        </div>
                                        <div className="mt-4">
                                            <CardTitle className="text-lg font-black uppercase tracking-tight truncate">{auth.name}</CardTitle>
                                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">Trigger: {auth.trigger.replace('_', ' ')}</CardDescription>
                                        </div>
                                        {/* Workspace scope display (Requirement 10.5) */}
                                        <div className="mt-3 pt-3 border-t border-border/30">
                                            {auth.workspaceIds && auth.workspaceIds.length > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[8px] font-bold border-primary/20 text-primary">
                                                        {auth.workspaceIds.length === 1 ? '1 Workspace' : `${auth.workspaceIds.length} Workspaces`}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="h-3 w-3 text-amber-500" />
                                                    <span className="text-[8px] font-bold text-amber-600 uppercase">No workspace constraint</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 h-8">{auth.description || 'No description provided.'}</p>
                                        <div className="mt-6 pt-6 border-t border-border/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleToggleStatus(auth.id, auth.isActive)}>
                                                    {auth.isActive ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground opacity-40" />}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5" asChild>
                                                    <Link href={`/admin/automations/${auth.id}/edit`}><Settings2 className="h-4 w-4 text-primary" /></Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-500/10 text-destructive" onClick={() => handleDelete(auth.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )) : (
                                <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[3rem] bg-muted/10 opacity-30 flex flex-col items-center gap-4">
                                    <Zap className="h-12 w-12" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No matching blueprints</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="runs" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="rounded-[2.5rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                            <div className="p-6 border-b bg-muted/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Activity className="h-4 w-4 text-primary" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Real-time Execution Stream</h3>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">Last 100 Transactions</p>
                            </div>
                            <div className="divide-y divide-border/50">
                                {isLoadingRuns ? (
                                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                                ) : filteredRuns && filteredRuns.length > 0 ? filteredRuns.map(run => (
                                    <div key={run.id} className="p-4 px-8 flex items-center justify-between group hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-6">
                                            <div className={cn(
                                                "p-2.5 rounded-xl shadow-sm transition-all",
                                                run.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
                                                run.status === 'failed' ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {run.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : 
                                                 run.status === 'failed' ? <XCircle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                            </div>
                                            <div>
                                                <p className="font-black text-xs uppercase tracking-tight text-foreground">{run.automationName}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums">
                                                        {format(new Date(run.startedAt), 'MMM d, HH:mm:ss')}
                                                    </p>
                                                    <span className="text-[8px] opacity-20 text-muted-foreground">|</span>
                                                    <p className="text-[9px] font-black text-primary/60 uppercase tracking-tighter tabular-nums">
                                                        Duration: {getDuration(run)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            {run.error && (
                                                <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-none text-[8px] font-black uppercase px-2 gap-1 h-5 shadow-sm">
                                                    <AlertCircle className="h-2.5 w-2.5" /> Logic Error
                                                </Badge>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-9 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity font-black text-[9px] uppercase tracking-widest gap-2 bg-primary/5 text-primary"
                                                onClick={() => setSelectedRun(run)}
                                            >
                                                Inspect Run <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-32 text-center flex flex-col items-center justify-center opacity-20 gap-3">
                                        <History className="h-12 w-12" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No execution history recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Run Diagnostic Modal */}
            <Dialog open={!!selectedRun} onOpenChange={(o) => !o && setSelectedRun(null)}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden text-left bg-background">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-2xl shadow-xl",
                                    selectedRun?.status === 'completed' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                )}>
                                    {selectedRun?.status === 'completed' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">{selectedRun?.automationName}</DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest">Execution Trace ID: {selectedRun?.id}</DialogDescription>
                                </div>
                            </div>
                            <Badge variant={selectedRun?.status === 'completed' ? "default" : "destructive"} className="h-6 px-3 text-[10px] font-black uppercase">
                                {selectedRun?.status}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-8 space-y-10">
                            {/* Execution Meta */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 shadow-inner">
                                    <div className="flex items-center gap-2 mb-1.5 opacity-40">
                                        <Clock size={12} className="text-primary" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Initialization</span>
                                    </div>
                                    <p className="font-bold text-sm tabular-nums">{selectedRun && format(new Date(selectedRun.startedAt), 'PPP p')}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 shadow-inner">
                                    <div className="flex items-center gap-2 mb-1.5 opacity-40">
                                        <Timer size={12} className="text-primary" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Lead Time</span>
                                    </div>
                                    <p className="font-bold text-sm tabular-nums">{selectedRun && getDuration(selectedRun)}</p>
                                </div>
                            </div>

                            {/* Failure Stack */}
                            {selectedRun?.error && (
                                <Card className="border-rose-500/20 bg-rose-500/10 overflow-hidden rounded-2xl shadow-sm animate-pulse">
                                    <div className="p-4 bg-rose-500/20 flex items-center gap-2 border-b border-rose-500/30">
                                        <ShieldAlert size={14} className="text-rose-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Logical Termination Fault</span>
                                    </div>
                                    <CardContent className="p-4">
                                        <pre className="text-xs font-mono font-bold text-rose-400 whitespace-pre-wrap leading-relaxed">{selectedRun.error}</pre>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Trigger Context Payload */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Database size={14} className="text-primary" />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Contextual Payload</h4>
                                    </div>
                                    <Badge variant="outline" className="h-5 text-[8px] font-bold border-primary/20 text-primary">JSON Snapshot</Badge>
                                </div>
                                <div className="relative group">
                                    <div className="absolute top-4 right-4 z-10">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => {
                                                if (selectedRun) navigator.clipboard.writeText(JSON.stringify(selectedRun.triggerData, null, 2));
                                                toast({ title: 'Payload Copied' });
                                            }}
                                        >
                                            <SearchCode size={14} />
                                        </Button>
                                    </div>
                                    <div className="p-6 rounded-[2rem] bg-slate-950/80 text-blue-500 overflow-hidden shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
                                        <pre className="text-[11px] font-mono leading-relaxed max-h-[300px] overflow-auto scrollbar-thin scrollbar-thumb-white/10">
                                            {JSON.stringify(selectedRun?.triggerData, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 flex items-start gap-4">
                                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-blue-500 uppercase">Audit Integrity</p>
                                    <p className="text-[9px] font-bold text-blue-400/60 leading-relaxed uppercase tracking-widest text-left">
                                        This snapshot reflects the exact institutional state at the moment the trigger fired. 
                                        Subsequent changes to school records will not be reflected in this trace.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex items-center justify-between sm:justify-between">
                        <Button variant="ghost" onClick={() => setSelectedRun(null)} className="rounded-xl font-bold px-8">Close Trace</Button>
                        <Button variant="outline" asChild className="rounded-xl font-black gap-2 border-primary/20 text-primary uppercase text-[10px] tracking-widest bg-card h-11 px-8 shadow-lg transition-all active:scale-95">
                            <Link href={`/admin/automations/${selectedRun?.automationId}/edit`}>
                                View Logic Blueprint <ArrowRight size={14} />
                            </Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}