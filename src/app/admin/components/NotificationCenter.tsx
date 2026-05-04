'use client';

import * as React from 'react';
import { BellDot, MailOpen, AlertCircle, Info, Calendar, FileText, Settings, X, Check } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InAppNotification } from '@/lib/types';

export default function NotificationCenter() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'in_app_notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
    }, [firestore, user?.uid]);

    const { data: notifications, isLoading } = useCollection<InAppNotification>(notificationsQuery);

    const unreadCount = React.useMemo(() => {
        if (!notifications) return 0;
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    const markAsRead = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'in_app_notifications', id), { isRead: true });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const getIcon = (category?: string) => {
        switch (category) {
            case 'tasks': return <Check className="h-4 w-4 text-emerald-500" />;
            case 'reminders': return <Calendar className="h-4 w-4 text-blue-500" />;
            case 'automations': return <Settings className="h-4 w-4 text-purple-500" />;
            case 'forms': return <FileText className="h-4 w-4 text-orange-500" />;
            case 'general':
            default: return <Info className="h-4 w-4 text-primary" />;
        }
    }

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-primary/5 transition-all">
                    <BellDot className={cn("h-5 w-5", unreadCount > 0 ? "text-primary fill-primary/10" : "text-muted-foreground")} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-semibold text-white ring-2 ring-background animate-in zoom-in duration-300">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 rounded-[1.5rem] overflow-hidden shadow-2xl border-primary/10">
                <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">My Notifications</h3>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-tighter">Direct messages & alerts</p>
                    </div>
                    {unreadCount > 0 && <Badge className="rounded-full px-2 font-semibold text-[9px] tracking-tighter">{unreadCount} UNREAD</Badge>}
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
                                <div key={n.id} className={cn("p-4 transition-colors group relative", n.isRead ? "bg-background/50 opacity-60" : "bg-muted/10 hover:bg-muted/30")}>
                                    <div className="flex gap-4">
                                        <div className={cn("p-2 rounded-xl h-fit shadow-inner transition-colors", n.isRead ? "bg-muted" : "bg-background")}>
                                            {getIcon(n.category)}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6">
                                            <p className="text-xs font-bold leading-tight mb-1">{n.title}</p>
                                            {n.body && <div className="text-[10px] text-muted-foreground mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: n.body }} />}
                                            <div className="flex items-center gap-3 text-[9px] font-semibold text-muted-foreground opacity-60">
                                                <span className="flex items-center gap-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {!n.isRead && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => markAsRead(n.id!, e)}
                                            title="Mark as read"
                                        >
                                            <Check className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-3 opacity-30">
                                <MailOpen className="h-10 w-10 mx-auto" />
                                <p className="text-[10px] font-semibold ">No notifications</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
