'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, collection } from 'firebase/firestore';
import type { MeetingRegistrant } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, UserCircle2, Video, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import BulkMeetingInviteModal from './BulkMeetingInviteModal';

interface EntityMeetingsTabProps {
    entityId: string;
}

const getPreMeetingStatus = (status: string) => {
    switch (status) {
        case 'approved':
        case 'registered':
        case 'attended':
        case 'no_show':
            return { label: 'Going', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
        case 'cancelled':
            return { label: 'Not Going', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
        case 'pending':
        case 'waitlisted':
        default:
            return { label: 'Pending', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    }
};

const getPostMeetingStatus = (status: string, isUpcoming: boolean) => {
    if (isUpcoming) {
        return { label: 'Upcoming', color: 'text-slate-400 bg-slate-500/5 border-slate-500/10' };
    }
    switch (status) {
        case 'attended':
            return { label: 'Attended', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
        case 'no_show':
            return { label: 'No Show', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
        case 'cancelled':
            return { label: 'Cancelled', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
        default:
            return { label: 'Unmarked', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    }
};

export default function EntityMeetingsTab({ entityId }: EntityMeetingsTabProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);

    // 1. Fetch all registrants for this entity across the active workspace
    const registrantsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return query(
            collectionGroup(firestore, 'registrants'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('entityId', '==', entityId)
        );
    }, [firestore, activeWorkspaceId, entityId]);

    const { data: registrants, isLoading } = useCollection<MeetingRegistrant>(registrantsQuery);

    // 2. Extract unique meeting IDs from registrants list
    const meetingIds = React.useMemo(() => {
        if (!registrants || registrants.length === 0) return [];
        return Array.from(new Set(registrants.map(r => r.meetingId))).filter(Boolean);
    }, [registrants]);

    // 3. Batch query meetings corresponding to the registrant records (limit to 30 for Firestore IN query limits)
    const meetingsQuery = useMemoFirebase(() => {
        if (!firestore || meetingIds.length === 0) return null;
        const chunk = meetingIds.slice(0, 30);
        return query(
            collection(firestore, 'meetings'),
            where('__name__', 'in', chunk)
        );
    }, [firestore, meetingIds]);

    const { data: meetings, isLoading: isLoadingMeetings } = useCollection<any>(meetingsQuery);

    const showLoading = isLoading || (meetingIds.length > 0 && isLoadingMeetings);

    // Create a fast map for O(1) meeting lookups
    const meetingsMap = React.useMemo(() => {
        const map = new Map<string, any>();
        if (meetings) {
            meetings.forEach(m => map.set(m.id, m));
        }
        return map;
    }, [meetings]);

    // Group registrants by meeting and sort: upcoming first (closest first), ended second (most recent first)
    const groupedMeetings = React.useMemo(() => {
        if (!registrants) return [];

        const groupsMap = new Map<string, MeetingRegistrant[]>();
        registrants.forEach(r => {
            if (!r.meetingId) return;
            const current = groupsMap.get(r.meetingId) || [];
            current.push(r);
            groupsMap.set(r.meetingId, current);
        });

        const list: {
            meetingId: string;
            meeting?: any;
            registrants: MeetingRegistrant[];
            isUpcoming: boolean;
            meetingDate?: Date;
        }[] = [];

        groupsMap.forEach((regs, mId) => {
            const meeting = meetingsMap.get(mId);
            const meetingTimeStr = meeting?.meetingTime || '';
            const meetingDate = meetingTimeStr ? new Date(meetingTimeStr) : undefined;
            const isUpcoming = meetingDate ? meetingDate.getTime() > Date.now() : true;

            list.push({
                meetingId: mId,
                meeting,
                registrants: regs,
                isUpcoming,
                meetingDate,
            });
        });

        return list.sort((a, b) => {
            if (a.isUpcoming && !b.isUpcoming) return -1;
            if (!a.isUpcoming && b.isUpcoming) return 1;

            const timeA = a.meetingDate?.getTime() || 0;
            const timeB = b.meetingDate?.getTime() || 0;

            if (a.isUpcoming) {
                return timeA - timeB; // Earliest upcoming first
            } else {
                return timeB - timeA; // Most recent ended first
            }
        });
    }, [registrants, meetingsMap]);

    if (showLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
        );
    }

    const goingCount = registrants?.filter(r => ['approved', 'registered', 'attended'].includes(r.status)).length ?? 0;
    const notGoingCount = registrants?.filter(r => ['cancelled', 'no_show'].includes(r.status)).length ?? 0;
    const pendingCount = registrants?.filter(r => ['pending', 'waitlisted'].includes(r.status)).length ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-bold tracking-tight">Meeting Invitations</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-1">Track meeting attendance and invitations.</p>
                </div>
                <Button size="sm" onClick={() => setIsInviteModalOpen(true)} className="rounded-xl font-bold h-9 shadow-md">
                    <Video className="h-4 w-4 mr-2" /> Invite to Meeting
                </Button>
            </div>

            {/* Metrics Strip */}
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

            {/* Meetings List */}
            <div className="space-y-4">
                {groupedMeetings.length > 0 ? (
                    groupedMeetings.map(group => {
                        const meeting = group.meeting;
                        const meetingTitle = meeting
                            ? (meeting.title || meeting.heroTitle || meeting.entityName || meeting.type?.name || 'Webinar Session')
                            : 'Meeting Session';

                        const formattedDate = group.meetingDate
                            ? group.meetingDate.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })
                            : 'No date';

                        return (
                            <Card key={group.meetingId} className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden text-left">
                                {/* Meeting Header */}
                                <div className="p-4 bg-muted/10 border-b border-border/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-sm font-bold text-foreground leading-tight truncate">
                                                {meetingTitle}
                                            </h4>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0",
                                                    group.isUpcoming
                                                        ? "text-sky-500 bg-sky-500/10 border-sky-500/20"
                                                        : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                                                )}
                                            >
                                                {group.isUpcoming ? 'Upcoming' : 'Ended'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3 text-primary/40 shrink-0" />
                                                {formattedDate}
                                            </span>
                                            {meeting?.location && (
                                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                    <MapPin className="h-3 w-3 text-primary/40 shrink-0" />
                                                    {meeting.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Contacts List */}
                                <div className="divide-y divide-border/10">
                                    {group.registrants.map(reg => {
                                        const preStatus = getPreMeetingStatus(reg.status);
                                        const postStatus = getPostMeetingStatus(reg.status, group.isUpcoming);

                                        return (
                                            <div key={reg.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                                                {/* Left details */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <UserCircle2 className="h-7 w-7 text-primary/30 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate">{reg.name}</p>
                                                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-semibold flex-wrap">
                                                            {reg.email && <span className="truncate">{reg.email}</span>}
                                                            {reg.email && reg.phone && <span className="text-muted-foreground/30">•</span>}
                                                            {reg.phone && <span>{reg.phone}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right status badges */}
                                                <div className="flex items-center gap-4 self-start sm:self-center shrink-0">
                                                    {/* Pre-Meeting RSVP */}
                                                    <div className="text-right">
                                                        <p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground/80 mb-0.5">RSVP Status</p>
                                                        <Badge variant="outline" className={cn("text-[8px] font-extrabold px-1.5 py-0.5 rounded-lg border", preStatus.color)}>
                                                            {preStatus.label}
                                                        </Badge>
                                                    </div>

                                                    {/* Post-Meeting Attendance */}
                                                    <div className="text-right">
                                                        <p className="text-[7px] font-black uppercase tracking-wider text-muted-foreground/80 mb-0.5">Attendance Status</p>
                                                        <Badge variant="outline" className={cn("text-[8px] font-extrabold px-1.5 py-0.5 rounded-lg border", postStatus.color)}>
                                                            {postStatus.label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        );
                    })
                ) : (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
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

            <BulkMeetingInviteModal 
                open={isInviteModalOpen} 
                onOpenChange={setIsInviteModalOpen} 
                entityIds={[entityId]} 
            />
        </div>
    );
}
