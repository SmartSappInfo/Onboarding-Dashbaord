
'use client';

import * as React from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageJob } from '@/lib/types';
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
import { 
    Layers, Mail, Smartphone, CheckCircle2, Loader2, XCircle, 
    Clock, AlertCircle, TrendingUp
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function MessageJobsView() {
    const firestore = useFirestore();

    const jobsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_jobs'), orderBy('createdAt', 'desc'), limit(50));
    }, [firestore]);

    const { data: jobs, isLoading } = useCollection<MessageJob>(jobsQuery);

    const getStatusBadge = (status: MessageJob['status']) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-500 text-white border-none gap-1 h-5 text-[8px] uppercase"><CheckCircle2 className="h-2.5 w-2.5" /> Complete</Badge>;
            case 'processing': return <Badge variant="secondary" className="gap-1 h-5 text-[8px] uppercase bg-blue-50 text-blue-600 border-blue-200"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing</Badge>;
            case 'failed': return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase"><XCircle className="h-2.5 w-2.5" /> Failed</Badge>;
            case 'queued': return <Badge variant="outline" className="gap-1 h-5 text-[8px] uppercase border-dashed"><Clock className="h-2.5 w-2.5" /> Queued</Badge>;
            default: return <Badge variant="ghost" className="h-5 text-[8px] uppercase">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
            </div>
        );
    }

    if (!jobs || jobs.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed rounded-[2rem] bg-muted/10">
                <Layers className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">No bulk jobs found in history.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map((job) => {
                    const progress = job.totalRecipients > 0 ? Math.round((job.processed / job.totalRecipients) * 100) : 0;
                    return (
                        <Card key={job.id} className="group overflow-hidden border-border/50 hover:shadow-xl transition-all rounded-2xl bg-card">
                            <div className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", job.channel === 'email' ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500")}>
                                            {job.channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Batch ID: {job.id.substring(0, 8)}</p>
                                            <p className="text-sm font-black text-foreground">Bulk {job.channel} Dispatch</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(job.status)}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-tighter">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="text-foreground">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5" />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Total</p>
                                        <p className="text-sm font-bold tabular-nums">{job.totalRecipients}</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-green-500/5 text-center">
                                        <p className="text-[8px] font-black text-green-600 uppercase leading-none mb-1">Pass</p>
                                        <p className="text-sm font-bold text-green-600 tabular-nums">{job.success}</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-red-500/5 text-center">
                                        <p className="text-[8px] font-black text-red-600 uppercase leading-none mb-1">Fail</p>
                                        <p className="text-sm font-bold text-red-600 tabular-nums">{job.failed}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-muted/30 p-3 px-5 border-t flex justify-between items-center">
                                <span className="text-[10px] font-medium text-muted-foreground italic">{format(new Date(job.createdAt), "MMM d, HH:mm")}</span>
                                <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase tracking-tighter gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    View Details
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
