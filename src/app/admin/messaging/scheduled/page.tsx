'use client';

import * as React from 'react';
import Link from 'next/link';
import { fetchScheduledMessagesAction, deleteScheduledMessageAction, updateScheduledMessageAction } from '@/lib/mnotify-actions';
import { cancelScheduledEmailAction } from '@/lib/resend-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { MessageLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    const [smsMessages, setSmsMessages] = React.useState<any[]>([]);
    const [isLoadingSms, setIsLoadingSms] = React.useState(true);
    const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = React.useState<any | null>(null);
    
    // Email Scheduling State (Tracked via logs)
    const emailLogsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_logs'), 
            where('status', '==', 'scheduled'),
            orderBy('sentAt', 'asc')
        );
    }, [firestore]);
    const { data: emailLogs, isLoading: isLoadingEmails } = useCollection<MessageLog>(emailLogsQuery);

    // Edit State
    const [editingMessage, setEditingMessage] = React.useState<any | null>(null);
    const [editBody, setEditBody] = React.useState('');
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const loadSms = React.useCallback(async () => {
        setIsLoadingSms(true);
        const result = await fetchScheduledMessagesAction();
        if (result.success) {
            setSmsMessages(result.messages);
        } else {
            toast({ variant: 'destructive', title: 'SMS Fetch Failed', description: result.error });
        }
        setIsLoadingSms(false);
    }, [toast]);

    React.useEffect(() => {
        loadSms();
    }, [loadSms]);

    const handleEditClick = (msg: any) => {
        setEditingMessage(msg);
        setEditBody(msg.message || msg.body);
        setEditDate(new Date(msg.schedule_date || msg.sentAt));
    };

    const handleUpdate = async () => {
        if (!editingMessage || !editBody.trim() || !editDate) return;
        setIsUpdating(true);
        try {
            if (editingMessage.channel === 'email' || editingMessage.templateId) {
                // Email updates are currently read-only in terms of gateway rescheduling 
                // but we update the log context
                toast({ title: 'Rescheduling Restricted', description: 'Email rescheduling must currently be handled via re-dispatch.' });
            } else {
                const result = await updateScheduledMessageAction(
                    editingMessage._id, 
                    editBody.trim(), 
                    editDate, 
                    editingMessage.sender
                );
                if (result.success) {
                    toast({ title: 'SMS Schedule Updated' });
                    await loadSms();
                } else throw new Error(result.error);
            }
            setEditingMessage(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!messageToDelete || !firestore) return;
        setIsDeletingId(messageToDelete._id || messageToDelete.id);
        
        try {
            if (messageToDelete.channel === 'email' || messageToDelete.templateId) {
                // Cancel via Resend if possible, then remove log
                if (messageToDelete.providerId) {
                    await cancelScheduledEmailAction(messageToDelete.providerId);
                }
                await deleteDoc(doc(firestore, 'message_logs', messageToDelete.id));
                toast({ title: 'Email Cancelled' });
            } else {
                const result = await deleteScheduledMessageAction(messageToDelete._id);
                if (result.success) {
                    toast({ title: 'SMS Cancelled' });
                    setSmsMessages(prev => prev.filter(m => m._id !== messageToDelete._id));
                } else throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed', description: e.message });
        } finally {
            setIsDeletingId(null);
            setMessageToDelete(null);
        }
    };

    const allScheduled = React.useMemo(() => {
        const sms = smsMessages.map(m => ({ ...m, channel: 'sms', type: 'sms' }));
        const emails = (emailLogs || []).map(m => ({ ...m, type: 'email' }));
        return [...sms, ...emails].sort((a, b) => {
            const dateA = new Date(a.schedule_date || a.sentAt).getTime();
            const dateB = new Date(b.schedule_date || b.sentAt).getTime();
            return dateA - dateB;
        });
    }, [smsMessages, emailLogs]);

    const isLoading = isLoadingSms || isLoadingEmails;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex justify-end">
                    <Button variant="outline" onClick={loadSms} disabled={isLoading} className="rounded-xl font-bold h-10 gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
                        <RefreshCw className={cn("h-4 w-4 text-primary", isLoading && "animate-spin")} />
                        Refresh Queue
                    </Button>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Scheduled For</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Medium</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">From (ID)</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Recipient</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Preview</TableHead>
                                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : allScheduled.length > 0 ? (
                                    allScheduled.map((msg, idx) => {
                                        const date = new Date(msg.schedule_date || msg.sentAt);
                                        const isEmail = msg.channel === 'email' || msg.type === 'email';
                                        return (
                                            <TableRow key={msg._id || msg.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="pl-6">
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {format(date, 'MMM d, p')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {isEmail ? <Mail className="h-4 w-4 text-blue-500" /> : <Smartphone className="h-4 w-4 text-orange-500" />}
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] font-black">{msg.sender || msg.senderName}</TableCell>
                                                <TableCell className="text-xs font-bold truncate max-w-[120px]">{msg.recipient}</TableCell>
                                                <TableCell>
                                                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-md italic opacity-60">
                                                        &ldquo;{msg.message || msg.body?.replace(/<[^>]*>?/gm, '')}&rdquo;
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-lg"
                                                            onClick={() => handleEditClick(msg)}
                                                        >
                                                            <Pencil className="h-4 w-4 text-primary" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                                            onClick={() => setMessageToDelete(msg)}
                                                            disabled={isDeletingId === (msg._id || msg.id)}
                                                        >
                                                            {isDeletingId === (msg._id || msg.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="p-6 bg-muted/50 rounded-[2rem] text-muted-foreground/30 shadow-inner">
                                                    <CalendarClock className="h-12 w-12" />
                                                </div>
                                                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Queue Clear</p>
                                                <Button asChild variant="link" className="font-bold uppercase text-[10px] tracking-widest text-primary">
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

                <div className="mt-8 p-6 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-start gap-5 shadow-sm">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight text-primary">Operational Oversight</p>
                        <p className="text-[10px] text-primary/70 leading-relaxed font-bold uppercase tracking-widest">
                            SMS queue updates are synced directly with mNotify BMS. Email cancellations utilize the Resend logic to prevent delivery. 
                            Note that Email content modifications must be handled by re-dispatching.
                        </p>
                    </div>
                </div>
            </div>

            <Dialog open={!!editingMessage} onOpenChange={(o) => !o && setEditingMessage(null)}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase">Reschedule Dispatch</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Modify pending communication payload</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Body</Label>
                            <Textarea 
                                value={editBody} 
                                onChange={e => setEditBody(e.target.value)}
                                className="min-h-[140px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 leading-relaxed"
                                disabled={editingMessage?.channel === 'email'}
                            />
                            {editingMessage?.channel === 'email' && (
                                <p className="text-[9px] font-bold text-orange-600 uppercase tracking-tighter px-1 flex items-center gap-1.5">
                                    <div className="p-0.5 bg-orange-100 rounded-full"><Info className="h-2 w-2" /></div> Branded Email content is immutable in the queue.
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Delivery Target</Label>
                            <DateTimePicker value={editDate} onChange={setEditDate} disabled={editingMessage?.channel === 'email'} />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-2">
                        <Button variant="ghost" onClick={() => setEditingMessage(null)} disabled={isUpdating} className="font-bold">Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating || !editBody.trim() || editingMessage?.channel === 'email'} className="rounded-xl font-bold gap-2 px-8 shadow-lg">
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Update Queue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!messageToDelete} onOpenChange={(o) => !o && setMessageToDelete(null)}>
                <AlertDialogContent className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-xl uppercase tracking-tight">Stop Dispatch?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            This will permanently remove the message for <span className="font-bold text-foreground">{messageToDelete?.recipient}</span> from the {messageToDelete?.channel === 'email' || messageToDelete?.type === 'email' ? 'Resend' : 'mNotify'} queue.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl font-bold">Keep Scheduled</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl">
                            Terminate Dispatch
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
