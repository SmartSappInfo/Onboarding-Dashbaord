
'use client';

import * as React from 'react';
import { Bell, Info, Calendar, FileText, CheckCircle2, MoreHorizontal, Inbox, Clock } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function NotificationBell() {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    
    // Notifications are essentially Activities.
    // Query MUST filter by workspaceId to satisfy Firestore security rules.
    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'activities'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, activeWorkspaceId]);

    const { data: allActivities, isLoading } = useCollection<Activity>(notificationsQuery);

    const notifications = React.useMemo(() => {
        if (!allActivities) return [];
        return allActivities.filter(a => a.source === 'system').slice(0, 10);
    }, [allActivities]);

    const unreadCount = React.useMemo(() => {
        if (!notifications) return 0;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        return notifications.filter(n => new Date(n.timestamp).getTime() > oneHourAgo).length;
    }, [notifications]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'meeting_created': return <Calendar className="h-4 w-4 text-blue-500" />;
            case 'pdf_form_submitted': return <FileText className="h-4 w-4 text-emerald-500" />;
            case 'school_assigned': return <Inbox className="h-4 w-4 text-purple-500" />;
            default: return <Info className="h-4 w-4 text-primary" />;
        }
    }

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-primary/5 transition-all">
                    <Bell className={cn("h-5 w-5", unreadCount > 0 ? "text-primary fill-primary/10" : "text-muted-foreground")} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-black text-white ring-2 ring-background animate-in zoom-in duration-300">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 rounded-[1.5rem] overflow-hidden shadow-2xl border-primary/10">
                <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Workspace Inbox</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Recent system events</p>
                    </div>
                    {unreadCount > 0 && <Badge className="rounded-full px-2 font-black text-[9px] tracking-tighter">{unreadCount} NEW</Badge>}
                </div>
                
                <ScrollArea className="h-[400px]">
                    <div className="divide-y divide-border/50">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="p-4 space-y-2">
                                    <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                                    <div className="h-2 w-1/2 bg-muted animate-pulse rounded" />
                                </div>
                            ))
                        ) : notifications && notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div key={n.id} className="p-4 hover:bg-muted/30 transition-colors cursor-default group">
                                    <div className="flex gap-4">
                                        <div className="p-2 bg-muted/50 rounded-xl h-fit shadow-inner group-hover:bg-background transition-colors">
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold leading-tight mb-1">{n.description}</p>
                                            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}</span>
                                                {n.entityName && <span className="flex items-center gap-1 border-l pl-3 truncate">{n.entityName}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-3 opacity-30">
                                <Inbox className="h-10 w-10 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Inbox Empty</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DropdownMenuSeparator className="m-0" />
                <div className="p-2 bg-muted/30">
                    <Button variant="ghost" asChild className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-primary transition-all">
                        <Link href="/admin/activities">View Complete Timeline</Link>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
