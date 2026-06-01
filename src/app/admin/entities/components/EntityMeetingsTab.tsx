'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import type { MeetingRegistrant } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, UserCircle2, Video, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import BulkMeetingInviteModal from './BulkMeetingInviteModal';

interface EntityMeetingsTabProps {
    entityId: string;
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'approved':
        case 'registered':
        case 'attended':
            return { color: '#10b981', bg: '#10b98115', icon: CheckCircle2, label: 'Going' };
        case 'cancelled':
        case 'no_show':
            return { color: '#ef4444', bg: '#ef444415', icon: XCircle, label: 'Not Going' };
        case 'pending':
        case 'waitlisted':
        default:
            return { color: '#f59e0b', bg: '#f59e0b15', icon: Clock, label: 'Pending' };
    }
};

export default function EntityMeetingsTab({ entityId }: EntityMeetingsTabProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);

    // Use collectionGroup query since registrants are subcollections nested under meetings/{meetingId}/registrants
    const registrantsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return query(
            collectionGroup(firestore, 'registrants'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('entityId', '==', entityId)
        );
    }, [firestore, activeWorkspaceId, entityId]);

    // Using useCollection on a collectionGroup requires the hook to support it or just using the query.
    // useCollection handles standard queries. However, we used collection() instead of collectionGroup().
    // Let's fix that below.
    const { data: registrants, isLoading } = useCollection<MeetingRegistrant>(registrantsQuery);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
        );
    }

    const goingCount = registrants?.filter(r => ['approved', 'registered', 'attended'].includes(r.status)).length ?? 0;
    const notGoingCount = registrants?.filter(r => ['cancelled', 'no_show'].includes(r.status)).length ?? 0;
    const pendingCount = registrants?.filter(r => ['pending', 'waitlisted'].includes(r.status)).length ?? 0;

    return (
        <div className="space-y-6">
            {/* Header row */}
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight">Meeting Invitations</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1">Track meeting attendance and invitations.</p>
                </div>
                <Button size="sm" onClick={() => setIsInviteModalOpen(true)} className="rounded-xl font-bold h-9 shadow-md">
                    <Video className="h-4 w-4 mr-2" /> Invite to Meeting
                </Button>
            </div>

            {/* Summary metrics strip */}
            {registrants && registrants.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Going', value: goingCount, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                        { label: 'Not Going', value: notGoingCount, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
                        { label: 'Pending', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                    ].map(m => (
                        <div key={m.label} className={cn('rounded-2xl p-4 text-center border border-border/30', m.bg)}>
                            <p className={cn('text-2xl font-bold tabular-nums', m.color)}>{m.value}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{m.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Meeting cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {registrants && registrants.length > 0 ? (
                    registrants.map(reg => {
                        const cfg = getStatusConfig(reg.status);
                        const StatusIcon = cfg.icon;
                        return (
                            <Card key={reg.id} className="border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all text-left group/card">
                                <CardHeader className="p-4 pb-3 flex flex-row items-start justify-between gap-2">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <CardTitle className="text-sm font-bold truncate leading-tight">Meeting Session</CardTitle>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wider truncate">
                                                ID: {reg.meetingId}
                                            </span>
                                        </div>
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
                                            <p className="text-[9px] font-semibold text-muted-foreground ml-1">Participant</p>
                                            <div className="flex items-center gap-1.5 font-bold text-sm">
                                                <UserCircle2 className="h-3.5 w-3.5 text-primary/40" />
                                                {reg.name}
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-left">
                                            <p className="text-[9px] font-semibold text-muted-foreground ml-1">Last Update</p>
                                            <div className="flex items-center gap-1.5 font-bold text-sm text-muted-foreground">
                                                <Calendar className="h-3.5 w-3.5 text-primary/40" />
                                                {new Date(reg.approvedAt || reg.cancelledAt || reg.registeredAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                ) : (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
                        <Video className="h-8 w-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">No meeting history</p>
                            <p className="text-[10px] font-semibold text-muted-foreground">Invite this record to a meeting to track their attendance.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsInviteModalOpen(true)}
                            className="rounded-xl mt-2 h-8 font-bold border-primary/20 text-primary bg-primary/5 hover:bg-primary hover:text-white">
                            <Video className="h-3.5 w-3.5 mr-1.5" /> Invite Now
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal passes preSelectedEntities array */}
            <BulkMeetingInviteModal 
                open={isInviteModalOpen} 
                onOpenChange={setIsInviteModalOpen} 
                entityIds={[entityId]} 
            />
        </div>
    );
}
