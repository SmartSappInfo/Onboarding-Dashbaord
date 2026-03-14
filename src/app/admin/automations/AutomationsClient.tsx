
'use client';

import * as React from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Automation, AutomationRun } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Play, 
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
    ToggleRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { deleteAutomationAction, toggleAutomationStatusAction } from '@/lib/automation-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default function AutomationsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');

    const automationsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'automations'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);

    const runsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'automation_runs'), orderBy('startedAt', 'desc')) : null, 
    [firestore]);

    const { data: automations, isLoading: isLoadingAuth } = useCollection<Automation>(automationsQuery);
    const { data: runs, isLoading: isLoadingRuns } = useCollection<AutomationRun>(runsQuery);

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

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-10 pb-32">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground uppercase">
                            <Zap className="h-10 w-10 text-primary" />
                            Automation Hub
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Design proactive operational logic across the school network.</p>
                    </div>
                    <Button asChild className="rounded-xl font-black h-12 px-8 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                        <Link href="/admin/automations/new"><Plus className="mr-2 h-5 w-5" /> Initialize Workflow</Link>
                    </Button>
                </div>

                <Tabs defaultValue="blueprints" className="space-y-8">
                    <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl w-fit">
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
                                className="h-12 rounded-2xl bg-white border-none shadow-sm ring-1 ring-border focus:ring-primary/20 font-bold pl-11"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {isLoadingAuth ? (
                                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2.5rem]" />)
                            ) : filteredAutomations.map((auth) => (
                                <Card key={auth.id} className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border bg-white overflow-hidden group hover:ring-primary/20 transition-all">
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
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-50 text-destructive" onClick={() => handleDelete(auth.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="runs" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                            <div className="p-6 border-b bg-muted/10 flex items-center gap-3">
                                <Activity className="h-4 w-4 text-primary" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Real-time Execution Stream</h3>
                            </div>
                            <div className="divide-y divide-border/50">
                                {isLoadingRuns ? (
                                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                                ) : runs?.map(run => (
                                    <div key={run.id} className="p-4 px-8 flex items-center justify-between group hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-6">
                                            <div className={cn(
                                                "p-2.5 rounded-xl shadow-sm",
                                                run.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                                                run.status === 'failed' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                                            )}>
                                                {run.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : 
                                                 run.status === 'failed' ? <XCircle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                            </div>
                                            <div>
                                                <p className="font-black text-xs uppercase tracking-tight text-foreground">{run.automationName}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 mt-0.5 tabular-nums">
                                                    {format(new Date(run.startedAt), 'MMM d, HH:mm:ss')} · ID: {run.id.substring(0,8)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            {run.error && (
                                                <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-none text-[8px] font-black uppercase px-2 gap-1">
                                                    <AlertCircle className="h-2 w-2" /> Error
                                                </Badge>
                                            )}
                                            <Button variant="ghost" size="sm" className="h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-black text-[9px] uppercase tracking-widest gap-2">
                                                Debug Logs <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
