
'use client';

import * as React from 'react';
import Link from 'next/link';
import { fetchScheduledMessagesAction, deleteScheduledMessageAction, updateScheduledMessageAction } from '@/lib/mnotify-actions';
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
    Save
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
import { cn } from '@/lib/utils';

export default function ScheduledMessagesPage() {
    const { toast } = useToast();
    const [messages, setMessages] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = React.useState<any | null>(null);
    
    // Edit State
    const [editingMessage, setEditingMessage] = React.useState<any | null>(null);
    const [editBody, setEditBody] = React.useState('');
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const loadMessages = React.useCallback(async () => {
        setIsLoading(true);
        const result = await fetchScheduledMessagesAction();
        if (result.success) {
            setMessages(result.messages);
        } else {
            toast({ variant: 'destructive', title: 'Fetch Failed', description: result.error });
        }
        setIsLoading(false);
    }, [toast]);

    React.useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    const handleEditClick = (msg: any) => {
        setEditingMessage(msg);
        setEditBody(msg.message);
        setEditDate(new Date(msg.schedule_date));
    };

    const handleUpdate = async () => {
        if (!editingMessage || !editBody.trim() || !editDate) return;
        setIsUpdating(true);
        try {
            const result = await updateScheduledMessageAction(
                editingMessage._id, 
                editBody.trim(), 
                editDate, 
                editingMessage.sender
            );
            if (result.success) {
                toast({ title: 'Schedule Updated' });
                await loadMessages();
                setEditingMessage(null);
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!messageToDelete) return;
        setIsDeletingId(messageToDelete._id);
        
        try {
            const result = await deleteScheduledMessageAction(messageToDelete._id);
            if (result.success) {
                toast({ title: 'Message Cancelled' });
                setMessages(prev => prev.filter(m => m._id !== messageToDelete._id));
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed', description: e.message });
        } finally {
            setIsDeletingId(null);
            setMessageToDelete(null);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Button asChild variant="ghost" className="-ml-2 mb-2">
                            <Link href="/admin/messaging">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                            <CalendarClock className="h-8 w-8 text-primary" />
                            Scheduled Dispatches
                        </h1>
                        <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest mt-1">Pending MT communications in mNotify queue.</p>
                    </div>
                    <Button variant="outline" onClick={loadMessages} disabled={isLoading} className="rounded-xl font-bold h-10 gap-2 shadow-sm">
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Sync Queue
                    </Button>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Scheduled For</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Sender ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Recipient</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Message Preview</TableHead>
                                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : messages.length > 0 ? (
                                    messages.map((msg) => (
                                        <TableRow key={msg._id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {format(new Date(msg.schedule_date), 'MMM d, p')}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] uppercase font-black">{msg.sender}</TableCell>
                                            <TableCell className="text-xs font-medium">{msg.recipient}</TableCell>
                                            <TableCell>
                                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-md italic">&ldquo;{msg.message}&rdquo;</p>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8"
                                                        onClick={() => handleEditClick(msg)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => setMessageToDelete(msg)}
                                                        disabled={isDeletingId === msg._id}
                                                    >
                                                        {isDeletingId === msg._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="p-4 bg-muted/50 rounded-full text-muted-foreground/30">
                                                    <CalendarClock className="h-10 w-10" />
                                                </div>
                                                <p className="text-muted-foreground font-medium italic">No scheduled messages found in the queue.</p>
                                                <Button asChild variant="link" className="font-bold uppercase text-[10px] tracking-widest">
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

                <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight text-primary">Queue Management Notes</p>
                        <p className="text-xs text-primary/70 leading-relaxed font-medium">
                            Scheduled messages are processed by mNotify at the exact timestamp configured. 
                            Modifications or cancellations from this dashboard will update the live mNotify queue immediately.
                        </p>
                    </div>
                </div>
            </div>

            <Dialog open={!!editingMessage} onOpenChange={(o) => !o && setEditingMessage(null)}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Reschedule Dispatch</DialogTitle>
                        <DialogDescription>Modify the content or delivery time for this message.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Content</Label>
                            <Textarea 
                                value={editBody} 
                                onChange={e => setEditBody(e.target.value)}
                                className="min-h-[120px] rounded-xl bg-muted/20 border-none shadow-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Delivery Time</Label>
                            <DateTimePicker value={editDate} onChange={setEditDate} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingMessage(null)} disabled={isUpdating}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating || !editBody.trim()} className="rounded-xl font-bold gap-2">
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Update Queue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!messageToDelete} onOpenChange={(o) => !o && setMessageToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black">Cancel Scheduled Dispatch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the message for <span className="font-bold text-foreground">{messageToDelete?.recipient}</span> from the mNotify dispatch queue.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold">Keep Scheduled</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirm Cancellation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
