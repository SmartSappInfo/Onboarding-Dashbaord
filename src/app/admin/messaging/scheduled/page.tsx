'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
    rescheduleMessageAction, 
    cancelMessageAction, 
    sendMessageNowAction,
    renderScheduledMessageAction,
    updateScheduledMessageContentAction
} from '@/app/actions/scheduled-message-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { ScheduledMessage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
    CalendarClock, 
    ArrowLeft, 
    Trash2, 
    Loader2, 
    AlertCircle, 
    RefreshCw, 
    Clock, 
    ArrowRight,
    Pencil,
    Save,
    Mail,
    Smartphone,
    X,
    Info,
    Send,
    Search,
    Inbox,
    Bell,
    MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ScheduledMessagesPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace() as any;
    
    // UI Filters State
    const [channelFilter, setChannelFilter] = React.useState<string>('all');
    const [sourceFilter, setSourceFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<string>('pending'); // Default to pending to show queue
    const [searchQuery, setSearchQuery] = React.useState<string>('');

    // Active Item Action States
    const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = React.useState<any | null>(null);
    const [isSendingNowId, setIsSendingNowId] = React.useState<string | null>(null);
    const [messageToSendNow, setMessageToSendNow] = React.useState<any | null>(null);
    
    // Edit & Reschedule States
    const [editingMessage, setEditingMessage] = React.useState<any | null>(null);
    const [editSubject, setEditSubject] = React.useState('');
    const [editBody, setEditBody] = React.useState('');
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Query unified scheduled messages from Firestore
    const scheduledQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'scheduled_messages'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('scheduledAt', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: rawScheduled, isLoading } = useCollection<ScheduledMessage>(scheduledQuery);

    // Local sorting, searching, and filtering
    const filteredScheduled = React.useMemo(() => {
        if (!rawScheduled) return [];
        return rawScheduled
            .filter(msg => {
                // Channel filter
                if (channelFilter !== 'all' && msg.channel !== channelFilter) return false;
                
                // Source/Origin filter
                if (sourceFilter !== 'all' && msg.sourceEventType !== sourceFilter) return false;
                
                // Status filter
                if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
                
                // Search query (recipient, template variables text, body, subject overrides)
                if (searchQuery.trim() !== '') {
                    const search = searchQuery.toLowerCase();
                    const recipient = msg.recipientContact?.toLowerCase() || '';
                    const body = msg.customBody?.toLowerCase() || '';
                    const subject = msg.customSubject?.toLowerCase() || '';
                    const messageVar = msg.variables?.message?.toLowerCase() || '';
                    
                    return recipient.includes(search) || 
                           body.includes(search) || 
                           subject.includes(search) ||
                           messageVar.includes(search);
                }
                
                return true;
            });
    }, [rawScheduled, channelFilter, sourceFilter, statusFilter, searchQuery]);

    const handleEditClick = async (msg: any) => {
        setEditingMessage(msg);
        setEditSubject(msg.customSubject || msg.variables?.subject || '');
        setEditBody(msg.customBody || msg.variables?.message || '');
        setEditDate(new Date(msg.scheduledAt));

        // Optionally attempt to pull the resolved template content if empty
        if (!msg.customBody && msg.id) {
            const previewRes = await renderScheduledMessageAction(msg.id);
            if (previewRes.success) {
                setEditSubject(previewRes.subject || '');
                // Simple tag strip for editable textarea view if necessary
                setEditBody(previewRes.body?.replace(/<[^>]*>?/gm, '') || '');
            }
        }
    };

    const handleUpdate = async () => {
        if (!editingMessage || !editDate) return;
        setIsUpdating(true);
        try {
            // 1. Reschedule timestamp if changed
            const originalDate = new Date(editingMessage.scheduledAt);
            if (originalDate.getTime() !== editDate.getTime()) {
                const rescheduleRes = await rescheduleMessageAction(editingMessage.id, editDate.toISOString());
                if (!rescheduleRes.success) throw new Error(rescheduleRes.error);
            }

            // 2. Update snapshot overrides if modified
            const originalSubject = editingMessage.customSubject || editingMessage.variables?.subject || '';
            const originalBody = editingMessage.customBody || editingMessage.variables?.message || '';

            if (editSubject !== originalSubject || editBody !== originalBody) {
                const contentRes = await updateScheduledMessageContentAction(editingMessage.id, editSubject, editBody);
                if (!contentRes.success) throw new Error(contentRes.error);
            }

            toast({ title: 'Schedule Updated', description: 'Changes have been saved successfully.' });
            setEditingMessage(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!messageToDelete) return;
        setIsDeletingId(messageToDelete.id);
        
        try {
            const result = await cancelMessageAction(messageToDelete.id);
            if (result.success) {
                toast({ title: 'Message Cancelled', description: 'Successfully removed from the scheduled queue.' });
            } else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed', description: e.message });
        } finally {
            setIsDeletingId(null);
            setMessageToDelete(null);
        }
    };

    const handleSendNow = async () => {
        if (!messageToSendNow) return;
        setIsSendingNowId(messageToSendNow.id);
        try {
            const result = await sendMessageNowAction(messageToSendNow.id);
            if (result.success) {
                toast({ title: 'Message Dispatched', description: 'Message sent immediately.' });
            } else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Dispatch Failed', description: e.message });
        } finally {
            setIsSendingNowId(null);
            setMessageToSendNow(null);
        }
    };

    const getSourceBadge = (type?: string) => {
        switch (type) {
            case 'composer':
                return <Badge className="bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/10 border-none font-bold text-[9px] uppercase">Composer</Badge>;
            case 'meeting':
                return <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 border-none font-bold text-[9px] uppercase">Meeting</Badge>;
            case 'automation':
                return <Badge className="bg-purple-500/10 text-purple-700 hover:bg-purple-500/10 border-none font-bold text-[9px] uppercase">Automation</Badge>;
            case 'form':
                return <Badge className="bg-orange-500/10 text-orange-700 hover:bg-orange-500/10 border-none font-bold text-[9px] uppercase">Form Reminder</Badge>;
            case 'survey':
                return <Badge className="bg-teal-500/10 text-teal-700 hover:bg-teal-500/10 border-none font-bold text-[9px] uppercase">Survey Request</Badge>;
            default:
                return <Badge className="bg-muted text-muted-foreground border-none font-bold text-[9px] uppercase">System</Badge>;
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'email':
                return <Mail className="h-4 w-4 text-blue-500" />;
            case 'sms':
                return <Smartphone className="h-4 w-4 text-orange-500" />;
            case 'whatsapp':
                return <MessageCircle className="h-4 w-4 text-emerald-600" />;
            case 'push':
                return <Bell className="h-4 w-4 text-emerald-500" />;
            case 'in_app':
                return <Inbox className="h-4 w-4 text-purple-500" />;
            default:
                return <Mail className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-none text-[9px] font-bold">Queued</Badge>;
            case 'sent':
                return <Badge className="bg-emerald-500/10 text-emerald-700 border-none text-[9px] font-bold">Sent</Badge>;
            case 'failed':
                return <Badge className="bg-rose-500/10 text-rose-700 border-none text-[9px] font-bold">Failed</Badge>;
            case 'cancelled':
                return <Badge className="bg-muted text-muted-foreground border-none text-[9px] font-bold">Cancelled</Badge>;
            default:
                return <Badge className="bg-muted text-muted-foreground border-none text-[9px] font-bold">{status}</Badge>;
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <PageContainer maxWidth="6xl">
                <div className="space-y-6 py-6">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Scheduled Message Queue</h1>
                            <p className="text-xs text-muted-foreground font-medium">Unifying Composer, Meetings, and Automation scheduled workflows.</p>
                        </div>
                    </div>

                    {/* Filter Panel */}
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card/65 backdrop-blur-md">
                        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Search bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search recipients or text..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-10 rounded-xl border-none bg-muted/40 shadow-inner"
                                />
                            </div>

                            {/* Channel select */}
                            <div className="flex flex-col gap-1.5">
                                <select 
                                    value={channelFilter}
                                    onChange={e => setChannelFilter(e.target.value)}
                                    className="h-10 px-3 rounded-xl bg-muted/40 border-none text-xs font-semibold shadow-inner focus:outline-none"
                                >
                                    <option value="all">All Channels</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                    <option value="push">Push Notification</option>
                                    <option value="in_app">In-App Notification</option>
                                </select>
                            </div>

                            {/* Source select */}
                            <div className="flex flex-col gap-1.5">
                                <select 
                                    value={sourceFilter}
                                    onChange={e => setSourceFilter(e.target.value)}
                                    className="h-10 px-3 rounded-xl bg-muted/40 border-none text-xs font-semibold shadow-inner focus:outline-none"
                                >
                                    <option value="all">All Origins</option>
                                    <option value="composer">Manual Composer</option>
                                    <option value="meeting">Meetings</option>
                                    <option value="automation">Automations</option>
                                    <option value="form">Forms</option>
                                    <option value="survey">Surveys</option>
                                </select>
                            </div>

                            {/* Status select */}
                            <div className="flex flex-col gap-1.5">
                                <select 
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="h-10 px-3 rounded-xl bg-muted/40 border-none text-xs font-semibold shadow-inner focus:outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="pending">Queued (Pending)</option>
                                    <option value="sent">Dispatched (Sent)</option>
                                    <option value="failed">Failed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table View */}
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-semibold pl-6">Scheduled Time</TableHead>
                                        <TableHead className="text-[10px] font-semibold">Medium</TableHead>
                                        <TableHead className="text-[10px] font-semibold">Origin</TableHead>
                                        <TableHead className="text-[10px] font-semibold">Recipient</TableHead>
                                        <TableHead className="text-[10px] font-semibold">Preview / Message Content</TableHead>
                                        <TableHead className="text-[10px] font-semibold">Status</TableHead>
                                        <TableHead className="text-right pr-6 text-[10px] font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredScheduled.length > 0 ? (
                                        filteredScheduled.map((msg) => {
                                            const date = new Date(msg.scheduledAt);
                                            const bodyPreview = msg.customBody || msg.variables?.message || '';
                                            return (
                                                <TableRow key={msg.id} className="group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                {format(date, 'MMM d, yyyy - p')}
                                                            </div>
                                                            <span className="text-[9px] text-muted-foreground">
                                                                {formatDistanceToNow(date, { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getChannelIcon(msg.channel)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getSourceBadge(msg.sourceEventType)}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold truncate max-w-[120px]">{msg.recipientContact}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col max-w-sm lg:max-w-md gap-0.5">
                                                            {msg.customSubject && (
                                                                <span className="text-xs font-semibold text-foreground truncate">{msg.customSubject}</span>
                                                            )}
                                                            <p className="text-[11px] text-muted-foreground line-clamp-1 italic opacity-60">
                                                                &ldquo;{bodyPreview.replace(/<[^>]*>?/gm, '')}&rdquo;
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(msg.status)}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            {/* Send Now Button */}
                                                            {msg.status === 'pending' && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg"
                                                                    onClick={() => setMessageToSendNow(msg)}
                                                                    disabled={isSendingNowId === msg.id}
                                                                    aria-label="Send message now"
                                                                >
                                                                    {isSendingNowId === msg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                            {/* Edit Button */}
                                                            {msg.status === 'pending' && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 rounded-lg"
                                                                    onClick={() => handleEditClick(msg)}
                                                                    aria-label="Edit message"
                                                                >
                                                                    <Pencil className="h-4 w-4 text-primary" />
                                                                </Button>
                                                            )}
                                                            {/* Cancel Button */}
                                                            {msg.status === 'pending' && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                                                    onClick={() => setMessageToDelete(msg)}
                                                                    disabled={isDeletingId === msg.id}
                                                                    aria-label="Cancel message"
                                                                >
                                                                    {isDeletingId === msg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <div className="p-6 bg-muted/10 rounded-[2rem] text-muted-foreground/30 shadow-inner">
                                                        <CalendarClock className="h-12 w-12" />
                                                    </div>
                                                    <p className="text-muted-foreground font-semibold text-xs">No Messages Found in Selected Queue</p>
                                                    <Button asChild variant="link" className="font-bold text-[10px] text-primary">
                                                        <Link href="/admin/messaging/composer">Go to Composer <ArrowRight className="ml-1 h-3 w-3" /></Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Quick Guide */}
                    <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-start gap-5 shadow-sm">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-tight text-primary">How the Unified Queue Works</p>
                            <p className="text-[10px] text-primary/70 leading-relaxed font-bold">
                                SMS, Email, and Push scheduled notifications wait inside this database-unified queue. 
                                Edits or cancellations modify records locally in Firestore immediately. 
                                Gateway dispatches will execute automatically at the scheduled time when processed by the background cron.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Edit Message Content / Reschedule Dialog */}
                <Dialog open={!!editingMessage} onOpenChange={(o) => !o && setEditingMessage(null)}>
                    <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">Edit Scheduled Message</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground">Modify content parameters and dispatch timestamp.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Subject (Only relevant for email or push) */}
                            {(editingMessage?.channel === 'email' || editingMessage?.channel === 'push') && (
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Override</Label>
                                    <Input 
                                        value={editSubject}
                                        onChange={e => setEditSubject(e.target.value)}
                                        className="h-10 rounded-xl bg-muted/20 border-none shadow-inner p-3 text-xs"
                                        autoComplete="off"
                                    />
                                </div>
                            )}

                            {/* Message Body */}
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Message Body</Label>
                                <Textarea 
                                    value={editBody} 
                                    onChange={e => setEditBody(e.target.value)}
                                    className="min-h-[120px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 text-xs leading-relaxed"
                                    autoComplete="off"
                                />
                            </div>

                            {/* Date & Time */}
                            <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Scheduled Time</Label>
                                <DateTimePicker value={editDate} onChange={setEditDate} />
                            </div>
                        </div>
                        <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-2 rounded-b-[2.5rem]">
                            <Button variant="ghost" onClick={() => setEditingMessage(null)} disabled={isUpdating} className="font-bold">Cancel</Button>
                            <Button onClick={handleUpdate} disabled={isUpdating || !editBody.trim() || !editDate} className="rounded-xl font-bold gap-2 px-8 shadow-lg">
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Cancel Message Action AlertDialog */}
                <AlertDialog open={!!messageToDelete} onOpenChange={(o) => !o && setMessageToDelete(null)}>
                    <AlertDialogContent className="rounded-[2rem]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-semibold text-xl tracking-tight">Cancel Message?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium">
                                This will permanently remove the scheduled message for <span className="font-bold text-foreground">{messageToDelete?.recipientContact}</span> from the queue.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel className="rounded-xl font-bold">Keep Message</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl">
                                Cancel Message
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Send Message Now AlertDialog */}
                <AlertDialog open={!!messageToSendNow} onOpenChange={(o) => !o && setMessageToSendNow(null)}>
                    <AlertDialogContent className="rounded-[2rem]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-semibold text-xl tracking-tight">Dispatch Message Now?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium">
                                Are you sure you want to override the schedule and immediately send the message to <span className="font-bold text-foreground">{messageToSendNow?.recipientContact}</span>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel className="rounded-xl font-bold">Keep Scheduled</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSendNow} className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl">
                                Send Message Now
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </PageContainer>
        </div>
    );
}
