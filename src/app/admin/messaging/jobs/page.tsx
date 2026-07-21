'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { MessageJob, MessageTemplate, MessageTask } from '@/lib/types';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { 
    Layers, Mail, Smartphone, CheckCircle2, Loader2, XCircle, 
    Clock, AlertCircle, Trophy
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageContainerFluid } from '@/components/ui/page-container';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface MessageJobsViewProps {
    noPadding?: boolean;
}

export default function MessageJobsView({ noPadding = false }: MessageJobsViewProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const [selectedJob, setSelectedJob] = React.useState<MessageJob | null>(null);

    const jobsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_jobs'), orderBy('createdAt', 'desc'), limit(50));
    }, [firestore]);

    const { data: jobs, isLoading } = useCollection<MessageJob>(jobsQuery);

    // Retrieve templates to resolve template name on the cards
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        // Only used to resolve template names on the job cards. Scoped to the
        // active workspace: an unscoped read spans every tenant and is rejected
        // by the security rules.
        return query(
            collection(firestore, 'message_templates'),
            where('workspaceIds', 'array-contains', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);

    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const templateMap = React.useMemo(() => {
        const map = new Map<string, MessageTemplate>();
        templates?.forEach(t => map.set(t.id, t));
        return map;
    }, [templates]);

    // Query tasks for selected job details
    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !selectedJob) return null;
        return query(collection(firestore, 'message_jobs', selectedJob.id, 'tasks'), limit(100));
    }, [firestore, selectedJob]);

    const { data: tasks, isLoading: isTasksLoading } = useCollection<MessageTask>(tasksQuery);

    const getStatusBadge = (status: MessageJob['status']) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-500 text-white border-none gap-1 h-5 text-[8px] uppercase "><CheckCircle2 className="h-2.5 w-2.5" /> Complete</Badge>;
            case 'processing': return <Badge variant="secondary" className="gap-1 h-5 text-[8px] uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"><Loader2 className="h-2.5 w-2.5 motion-safe:animate-spin" /> Processing</Badge>;
            case 'failed': return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase "><XCircle className="h-2.5 w-2.5" /> Failed</Badge>;
            case 'queued': return <Badge variant="outline" className="gap-1 h-5 text-[8px] uppercase  border-dashed"><Clock className="h-2.5 w-2.5" /> Queued</Badge>;
            default: return <Badge variant="secondary" className="h-5 text-[8px] uppercase ">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <PageContainerFluid noPadding={noPadding}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-[210px] w-full rounded-2xl" />
                    ))}
                </div>
            </PageContainerFluid>
        );
    }

    if (!jobs || jobs.length === 0) {
        return (
            <PageContainerFluid noPadding={noPadding}>
                <div className="py-20 text-center border border-dashed border-border/80 rounded-[2rem] bg-background">
                    <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-5">
                        <Layers className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-bold text-foreground mb-1">No bulk sends yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        When you send messages to multiple contacts at once via the Composer, each batch will appear here with progress tracking and delivery stats.
                    </p>
                </div>
            </PageContainerFluid>
        );
    }

    return (
        <PageContainerFluid noPadding={noPadding}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map((job) => {
                        const progress = job.totalRecipients > 0 ? Math.round((job.processed / job.totalRecipients) * 100) : 0;
                        const template = templateMap.get(job.templateId);
                        const templateName = template?.name || 'Custom Template';

                        return (
                            <Card key={job.id} className="group overflow-hidden border-border/50 hover:shadow-xl transition-all rounded-2xl bg-card">
                                <div className="p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("p-2 rounded-xl shrink-0", job.channel === 'email' ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500")}>
                                                {job.channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold text-muted-foreground leading-none mb-1 uppercase tracking-wider">
                                                    Batch {job.id.substring(0, 8)}
                                                </p>
                                                <p className="text-sm font-bold text-foreground tracking-tight truncate" title={templateName}>
                                                    {templateName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0">{getStatusBadge(job.status)}</div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end text-[10px] font-semibold tracking-tighter">
                                            <span className="text-muted-foreground opacity-60">Progress</span>
                                            <span className="text-foreground">{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 rounded-lg bg-muted/30 text-center">
                                            <p className="text-[8px] font-semibold text-muted-foreground leading-none mb-1">Total</p>
                                            <p className="text-sm font-bold tabular-nums">{job.totalRecipients}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
                                            <p className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none mb-1">Sent</p>
                                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{job.success}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-destructive/10 text-center">
                                            <p className="text-[8px] font-semibold text-destructive leading-none mb-1">Failed</p>
                                            <p className="text-sm font-bold text-destructive tabular-nums">{job.failed}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-3 px-5 border-t border-border/50 flex justify-between items-center">
                                    <span className="text-[10px] font-semibold text-muted-foreground opacity-40">{format(new Date(job.createdAt), "MMM d, HH:mm")}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[9px] font-bold tracking-tighter gap-1 rounded-lg"
                                        onClick={() => setSelectedJob(job)}
                                    >
                                        <AlertCircle className="h-3 w-3 text-primary" />
                                        View Details
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {selectedJob && (
                <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
                    <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden bg-card border border-border">
                        <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/50">
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                Batch Send Details
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Batch ID: {selectedJob.id} • Created at {format(new Date(selectedJob.createdAt), 'PPPP p')}
                            </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[450px] p-6">
                            <div className="space-y-6">
                                {/* Stats Summary */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                                        <div className="pt-0.5">{getStatusBadge(selectedJob.status)}</div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
                                        <p className="text-base font-extrabold text-foreground tabular-nums">{selectedJob.totalRecipients}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                                        <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Sent</p>
                                        <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{selectedJob.success}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
                                        <p className="text-[8px] font-bold text-destructive uppercase tracking-wider mb-1">Failed</p>
                                        <p className="text-base font-extrabold text-destructive tabular-nums">{selectedJob.failed}</p>
                                    </div>
                                </div>

                                <Separator className="opacity-50" />

                                {/* Template metadata */}
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Template Information</Label>
                                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                                        <p className="text-sm font-bold text-foreground">
                                            {templateMap.get(selectedJob.templateId)?.name || 'Custom Template'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Channel: <span className="capitalize">{selectedJob.channel}</span>
                                        </p>
                                    </div>
                                </div>

                                <Separator className="opacity-50" />

                                {/* Task Details */}
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Recipients Status</Label>
                                    {isTasksLoading ? (
                                        <div className="space-y-2 pt-2">
                                            <Skeleton className="h-10 w-full rounded-xl" />
                                            <Skeleton className="h-10 w-full rounded-xl" />
                                            <Skeleton className="h-10 w-full rounded-xl" />
                                        </div>
                                    ) : !tasks || tasks.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-4 text-center">No tasks recorded for this batch job.</p>
                                    ) : (
                                        <div className="border border-border/50 rounded-2xl overflow-hidden bg-card">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-semibold pl-4">Recipient</TableHead>
                                                        <TableHead className="text-[10px] font-semibold">Contact</TableHead>
                                                        <TableHead className="text-[10px] font-semibold">Status</TableHead>
                                                        <TableHead className="text-[10px] font-semibold pr-4 text-right">Details</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {tasks.map((task) => (
                                                        <TableRow key={task.id} className="hover:bg-muted/10 transition-colors">
                                                            <TableCell className="text-[11px] font-semibold text-foreground pl-4 max-w-[150px] truncate" title={task.recipient}>
                                                                {task.recipient}
                                                            </TableCell>
                                                            <TableCell className="text-[11px] font-semibold text-muted-foreground truncate max-w-[120px]" title={task.displayName}>
                                                                {task.displayName || '—'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {task.status === 'sent' ? (
                                                                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[9px] uppercase px-2 h-5">Sent</Badge>
                                                                ) : task.status === 'failed' ? (
                                                                    <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[9px] uppercase px-2 h-5">Failed</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[9px] uppercase px-2 h-5">Pending</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-[10px] font-semibold text-muted-foreground text-right pr-4 truncate max-w-[150px]" title={task.error}>
                                                                {task.error ? (
                                                                    <span className="text-destructive font-bold">{task.error}</span>
                                                                ) : task.sentAt ? (
                                                                    format(new Date(task.sentAt), 'MMM d, HH:mm')
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-4 bg-muted/20 border-t border-border/50 shrink-0">
                            <Button onClick={() => setSelectedJob(null)} className="w-full h-12 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-all">Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </PageContainerFluid>
    );
}

