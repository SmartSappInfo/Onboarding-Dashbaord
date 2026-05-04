'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Deal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Banknote, Calendar, UserCircle2, ArrowRight, Layers, Trophy, Target } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import CreateDealModal from './CreateDealModal';
import { cn } from '@/lib/utils';

interface EntityDealsTabProps {
    entityId: string;
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'won':  return { color: '#10b981', bg: '#10b98115', icon: Trophy,  label: 'Won' };
        case 'lost': return { color: '#ef4444', bg: '#ef444415', icon: Target,  label: 'Lost' };
        default:     return { color: '#3b82f6', bg: '#3b82f615', icon: Layers,  label: 'Open' };
    }
};

export default function EntityDealsTab({ entityId }: EntityDealsTabProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

    const dealsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return query(
            collection(firestore, 'deals'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId, entityId]);

    const { data: deals, isLoading } = useCollection<Deal>(dealsQuery);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    const openCount  = deals?.filter(d => d.status === 'open').length  ?? 0;
    const wonCount   = deals?.filter(d => d.status === 'won').length   ?? 0;
    const lostCount  = deals?.filter(d => d.status === 'lost').length  ?? 0;
    const totalValue = deals?.filter(d => d.status === 'open').reduce((s, d) => s + (d.value || 0), 0) ?? 0;

    return (
        <div className="space-y-6">
            {/* Header row */}
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight">Deals &amp; Opportunities</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1">Pipeline progression for this record.</p>
                </div>
                <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="rounded-xl font-bold h-9 gap-2 shadow-md">
                    <Plus className="h-4 w-4" /> New Deal
                </Button>
            </div>

            {/* Summary metrics strip */}
            {deals && deals.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Open', value: openCount,  color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
                        { label: 'Won',  value: wonCount,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                        { label: 'Lost', value: lostCount,  color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/30' },
                    ].map(m => (
                        <div key={m.label} className={cn('rounded-2xl p-4 text-center border border-border/30', m.bg)}>
                            <p className={cn('text-2xl font-bold tabular-nums', m.color)}>{m.value}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{m.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Pipeline value banner (open deals only) */}
            {openCount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">Open Pipeline Value</p>
                    <p className="text-lg font-bold text-primary tabular-nums">${totalValue.toLocaleString()}</p>
                </div>
            )}

            {/* Deal cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deals && deals.length > 0 ? (
                    deals.map(deal => {
                        const cfg = getStatusConfig(deal.status);
                        const StatusIcon = cfg.icon;
                        return (
                            <Card key={deal.id} className="border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all text-left group/card">
                                <CardHeader className="p-4 pb-3 flex flex-row items-start justify-between gap-2">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <CardTitle className="text-sm font-bold truncate leading-tight">{deal.name}</CardTitle>
                                        {/* Stage badge */}
                                        {(deal.stageName || deal.stageId) && (
                                            <div className="flex items-center gap-1.5">
                                                <Layers className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                                                <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wider truncate">
                                                    {deal.stageName ?? 'Stage'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="uppercase text-[8px] font-bold border-none shadow-sm h-5 shrink-0 gap-1 items-center"
                                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                                    >
                                        <StatusIcon className="h-2.5 w-2.5" />
                                        {cfg.label}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 text-left">
                                            <p className="text-[9px] font-semibold text-muted-foreground ml-1">Value</p>
                                            <div className="flex items-center gap-1.5 font-bold text-sm">
                                                <Banknote className="h-3.5 w-3.5 text-primary/40" />
                                                ${(deal.value || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-left">
                                            <p className="text-[9px] font-semibold text-muted-foreground ml-1">Close Date</p>
                                            <div className="flex items-center gap-1.5 font-bold text-sm text-muted-foreground">
                                                <Calendar className="h-3.5 w-3.5 text-primary/40" />
                                                {deal.expectedCloseDate
                                                    ? new Date(deal.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                                                    : 'TBD'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/50">
                                        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
                                            <UserCircle2 className="h-3.5 w-3.5 text-primary/40" />
                                            {deal.assignedTo?.name || 'Unassigned'}
                                        </div>
                                        <Button variant="ghost" size="sm" asChild
                                            className="h-7 px-2 rounded-lg text-primary hover:bg-primary/5 font-semibold text-[9px] gap-1 group/btn">
                                            <Link href={`/admin/pipeline`}>
                                                View Pipeline <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover/btn:translate-x-0.5" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                ) : (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
                        <Banknote className="h-8 w-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">No deals yet</p>
                            <p className="text-[10px] font-semibold text-muted-foreground">Create a deal to track pipeline progression for this record.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}
                            className="rounded-xl mt-2 h-8 font-bold border-primary/20 text-primary bg-primary/5 hover:bg-primary hover:text-white">
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Start First Deal
                        </Button>
                    </div>
                )}
            </div>

            <CreateDealModal entityId={entityId} open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
        </div>
    );
}
