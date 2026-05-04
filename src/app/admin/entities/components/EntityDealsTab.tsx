'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Deal, Pipeline } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Banknote, Calendar, UserCircle2, ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import CreateDealModal from './CreateDealModal';

interface EntityDealsTabProps {
    entityId: string;
}

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

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'won': return '#10b981'; // emerald-500
            case 'lost': return '#ef4444'; // red-500
            default: return '#3b82f6'; // blue-500
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-2 px-2">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight">Deals & Opportunities</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1">Manage operational deals for this record.</p>
                </div>
                <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="rounded-xl font-bold h-9 gap-2 shadow-md">
                    <Plus className="h-4 w-4" /> Create Deal
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deals && deals.length > 0 ? (
                    deals.map(deal => (
                        <Card key={deal.id} className="border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all text-left">
                            <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between border-b border-border/10">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-bold truncate leading-tight">{deal.name}</CardTitle>
                                </div>
                                <Badge 
                                    variant="outline" 
                                    className="uppercase text-[8px] font-bold border-none shadow-sm h-5"
                                    style={{ backgroundColor: `${getStatusColor(deal.status)}15`, color: getStatusColor(deal.status) }}
                                >
                                    {deal.status}
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
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
                                            {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'TBD'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-dashed">
                                    <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
                                        <UserCircle2 className="h-3.5 w-3.5 text-primary/40" />
                                        {deal.assignedTo?.name || 'Unassigned'}
                                    </div>
                                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 rounded-lg text-primary hover:bg-primary/5 font-semibold text-[9px] gap-1 group/btn">
                                        <Link href={`/admin/deals/${deal.id}`}>
                                            Open Deal <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover/btn:translate-x-0.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
                        <Banknote className="h-8 w-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">No active deals</p>
                            <p className="text-[10px] font-semibold text-muted-foreground">Create a deal to track operational progression.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)} className="rounded-xl mt-2 h-8 font-bold border-primary/20 text-primary bg-primary/5 hover:bg-primary hover:text-white">
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Start First Deal
                        </Button>
                    </div>
                )}
            </div>

            <CreateDealModal 
                entityId={entityId} 
                open={isCreateModalOpen} 
                onOpenChange={setIsCreateModalOpen} 
            />
        </div>
    );
}
