
'use client';

import * as React from 'react';
import Link from 'next/link';
import { fetchScheduledMessagesAction, deleteScheduledMessageAction } from '@/lib/mnotify-actions';
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
    User,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export default function ScheduledMessagesPage() {
    const { toast } = useToast();
    const [messages, setMessages] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = React.useState<any | null>(null);

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

    const handleDelete = async () => {
        if (!messageToDelete) return;
        setIsDeletingId(messageToDelete._id);
        
        try {
            const result = await deleteScheduledMessageAction(messageToDelete._id);
            if (result.success) {
                toast({ title: 'Message Cancelled', description: 'The scheduled dispatch has been removed.' });
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
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                            <CalendarClock className="h-8 w-8 text-primary" />
                            Scheduled Dispatches
                        </h1>
                        <p className="text-muted-foreground font-medium">Manage pending SMS communications queued for future delivery.</p>
                    </div>
                    <Button variant="outline" onClick={loadMessages} disabled={isLoading} className="rounded-xl font-bold shadow-sm h-10 gap-2">
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Refresh Queue
                    </Button>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
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
                                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
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
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setMessageToDelete(msg)}
                                                    disabled={isDeletingId === msg._id}
                                                >
                                                    {isDeletingId === msg._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
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
                        <p className="text-xs text-primary/70 leading-relaxed font-medium uppercase tracking-tighter">
                            Scheduled messages are processed by mNotify at the exact timestamp configured. 
                            Cancellation from this dashboard will permanently stop the dispatch.
                        </p>
                    </div>
                </div>
            </div>

            <AlertDialog open={!!messageToDelete} onOpenChange={(o) => !o && setMessageToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black">Cancel Scheduled Dispatch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will stop the message from being sent to <span className="font-bold text-foreground">{messageToDelete?.recipient}</span> on {messageToDelete && format(new Date(messageToDelete.schedule_date), 'PPPP p')}.
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
