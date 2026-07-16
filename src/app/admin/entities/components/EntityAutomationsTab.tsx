'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { 
    XCircle, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    Zap, 
    Activity,
    PlusCircle,
    UserCheck,
    RefreshCw,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { StepTimeline } from '@/app/admin/automations/components/StepTimeline';
import { cn } from '@/lib/utils';
import { AddToAutomationDialog } from './AddToAutomationDialog';
import type { AutomationRun } from '@/lib/types';

interface EntityAutomationsTabProps {
    entityId: string;
}

export default function EntityAutomationsTab({ entityId }: EntityAutomationsTabProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();
    const { user } = useUser();

    const [isMutating, setIsMutating] = React.useState<string | null>(null);
    const [isEnrollDialogOpen, setIsEnrollDialogOpen] = React.useState(false);
    const [expandedRunIds, setExpandedRunIds] = React.useState<Record<string, boolean>>({});

    const toggleRunExpanded = (runId: string) => {
        setExpandedRunIds(prev => ({
            ...prev,
            [runId]: !prev[runId]
        }));
    };

    // 1. Fetch all runs for this entity in the workspace (safely scoped)
    const runsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return query(
            collection(firestore, 'automation_runs'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId)
        );
    }, [firestore, activeWorkspaceId, entityId]);

    const { data: runs, isLoading: isLoadingRuns } = useCollection<AutomationRun>(runsQuery);

    // Sort runs in-memory: active running first, then newest startedAt first
    const sortedRuns = React.useMemo(() => {
        if (!runs) return [];
        return [...runs].sort((a: AutomationRun, b: AutomationRun) => {
            if (a.status === 'running' && b.status !== 'running') return -1;
            if (a.status !== 'running' && b.status === 'running') return 1;
            const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return dateB - dateA;
        });
    }, [runs]);

    const activeRuns = React.useMemo(() => sortedRuns.filter((r: AutomationRun) => r.status === 'running'), [sortedRuns]);
    const completedRuns = React.useMemo(() => sortedRuns.filter((r: AutomationRun) => r.status !== 'running'), [sortedRuns]);

    // Handle Cancelling/Removing a contact from active run
    const handleCancel = async (runId: string) => {
        if (isMutating || !user) return;
        setIsMutating(runId);
        try {
            const { cancelAutomationRunAction } = await import('@/lib/automation-actions');
            const res = await cancelAutomationRunAction(runId, entityId, user.uid);
            if (!res.success) throw new Error(res.error || 'Failed to remove');

            toast({
                title: 'Contact Removed',
                description: 'Pending jobs deleted and run status marked as cancelled.'
            });
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toast({
                variant: 'destructive',
                title: 'Cancellation Failed',
                description: errMsg || 'An error occurred during cancellation.'
            });
        } finally {
            setIsMutating(null);
        }
    };

    if (isLoadingRuns) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header / Enrollment Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-border/50 text-left">
                <div className="text-left">
                    <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Zap className="h-5 w-5 text-violet-500" /> Automation Journeys
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1">Manage current workflows and enrollment lifecycle logs.</p>
                </div>
                
                {/* Unified Enrollment Trigger */}
                <div className="flex items-center gap-2 shrink-0">
                    <Button 
                        size="sm" 
                        onClick={() => setIsEnrollDialogOpen(true)}
                        className="rounded-xl font-bold h-10 px-4 shadow-md bg-violet-600 text-white hover:bg-violet-700 transition-all flex items-center gap-1.5"
                    >
                        <PlusCircle className="h-4 w-4" />
                        Enroll in Automation
                    </Button>
                </div>
            </div>

            {/* Active Running Flows Section */}
            <div className="space-y-3 text-left">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary/70 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Active Enrolled Automations ({activeRuns.length})
                </h4>
                {activeRuns.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {activeRuns.map((run: AutomationRun) => {
                            const isExpanded = !!expandedRunIds[run.id];
                            return (
                                <Card key={run.id} className="border-emerald-100 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-2xl shadow-sm hover:shadow-md transition-all text-left">
                                    <CardContent className="p-4 flex flex-col gap-4 text-left">
                                        <div 
                                            onClick={() => toggleRunExpanded(run.id)}
                                            className="flex items-center justify-between gap-4 text-left cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                                                    <Activity className="h-5 w-5 animate-pulse" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-foreground leading-tight">
                                                        {run.automationName || 'Unnamed Automation'}
                                                        {run.contactName && (
                                                            <span className="text-xs text-muted-foreground font-normal ml-2">
                                                                ({run.contactName})
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-semibold mt-1 flex-wrap">
                                                        <span>Enrolled {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'recently'}</span>
                                                        <span>•</span>
                                                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-none font-bold text-[8px] h-4.5 px-2">Active</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancel(run.id);
                                                    }}
                                                    disabled={isMutating !== null}
                                                    className="rounded-xl border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 h-9 font-bold text-xs shrink-0 flex items-center gap-1"
                                                >
                                                    {isMutating === run.id ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <XCircle className="h-3.5 w-3.5" />
                                                    )}
                                                    Cancel Flow
                                                </Button>
                                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="pt-2 border-t border-emerald-100/50 text-left">
                                                {run.steps && Object.keys(run.steps).length > 0 ? (
                                                    <StepTimeline steps={run.steps} nodes={[]} />
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground italic">
                                                        No step execution logs available for this run.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-10 text-center border border-dashed rounded-2xl bg-muted/5 opacity-50 flex flex-col items-center justify-center gap-2">
                        <UserCheck className="h-6 w-6 text-muted-foreground" />
                        <p className="text-[10px] font-semibold text-muted-foreground">Not currently enrolled in any automation flows.</p>
                    </div>
                )}
            </div>

            {/* Automation Run Logs / Completed Section */}
            <div className="space-y-3 text-left">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary/70">
                    Execution Logs ({completedRuns.length})
                </h4>
                {completedRuns.length > 0 ? (
                    <div className="divide-y divide-border/40 border rounded-2xl bg-card overflow-hidden">
                        {completedRuns.map((run: AutomationRun) => {
                            const isCompleted = run.status === 'completed';
                            const isCancelled = run.status === 'cancelled';
                            const isFailed = run.status === 'failed';
                            const isExpanded = !!expandedRunIds[run.id];

                            return (
                                <div key={run.id} className="border-b last:border-b-0">
                                    <div 
                                        onClick={() => toggleRunExpanded(run.id)}
                                        className="p-4 flex items-center justify-between gap-4 hover:bg-muted/5 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 text-left">
                                            <div className={cn(
                                                "p-2 rounded-xl shrink-0",
                                                isCompleted ? "bg-emerald-500/10 text-emerald-600" :
                                                isCancelled ? "bg-slate-500/10 text-slate-600" : "bg-rose-500/10 text-rose-600"
                                            )}>
                                                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                                                 isCancelled ? <XCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <p className="text-xs font-bold text-foreground truncate leading-tight">
                                                    {run.automationName || 'Unnamed Automation'}
                                                    {run.contactName && (
                                                        <span className="text-xs text-muted-foreground font-normal ml-2">
                                                            ({run.contactName})
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-semibold mt-1 flex-wrap">
                                                    <span>Ran {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'recently'}</span>
                                                    {run.finishedAt && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Took {Math.max(1, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s</span>
                                                        </>
                                                    )}
                                                    {run.error && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-rose-500 truncate max-w-[200px]">Error: {run.error}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge 
                                                variant="outline" 
                                                className={cn(
                                                    "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0",
                                                    isCompleted ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" :
                                                    isCancelled ? "text-slate-500 bg-slate-500/10 border-slate-500/20" : "text-rose-500 bg-rose-500/10 border-rose-500/20"
                                                )}
                                            >
                                                {run.status}
                                            </Badge>
                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 bg-muted/10 border-t border-border/40 text-left">
                                            {run.steps && Object.keys(run.steps).length > 0 ? (
                                                <StepTimeline steps={run.steps} nodes={[]} />
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground italic">
                                                    No step execution logs available for this run.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 text-center border border-dashed rounded-2xl bg-muted/5 opacity-50 flex flex-col items-center justify-center gap-2">
                        <Clock className="h-6 w-6 text-muted-foreground" />
                        <p className="text-[10px] font-semibold text-muted-foreground">No historical execution records found.</p>
                    </div>
                )}
            </div>

            {/* Unified Enrollment Dialog Container */}
            {isEnrollDialogOpen && activeWorkspaceId && (
                <AddToAutomationDialog
                    open={isEnrollDialogOpen}
                    onOpenChange={setIsEnrollDialogOpen}
                    entityIds={[entityId]}
                    workspaceId={activeWorkspaceId}
                />
            )}
        </div>
    );
}
