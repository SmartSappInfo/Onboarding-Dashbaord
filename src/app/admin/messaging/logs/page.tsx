
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageLog } from '@/lib/types';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    History, ArrowLeft, Mail, Smartphone, CheckCircle2, XCircle, 
    Eye, Search, Filter, Loader2, Info, Building, RefreshCw, AlertCircle, Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { fetchSmsStatusAction } from '@/lib/mnotify-actions';
import { useToast } from '@/hooks/use-toast';

export default function MessageLogsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedLog, setSelectedLog] = React.useState<MessageLog | null>(null);
    const [isSyncing, setIsSyncing] = React.useState(false);

    const logsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_logs'), orderBy('sentAt', 'desc'), limit(100));
    }, [firestore]);

    const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

    const filteredLogs = React.useMemo(() => {
        if (!logs) return [];
        if (!searchTerm) return logs;
        const s = searchTerm.toLowerCase();
        return logs.filter(l => 
            l.recipient.toLowerCase().includes(s) || 
            l.templateName?.toLowerCase().includes(s) ||
            l.subject?.toLowerCase().includes(s)
        );
    }, [logs, searchTerm]);

    const handleSyncStatus = async () => {
        if (!selectedLog?.providerId || !firestore) return;
        setIsSyncing(true);
        
        try {
            const result = await fetchSmsStatusAction(selectedLog.providerId);
            if (result.success) {
                // Determine a status badge mapping from mNotify codes
                // Standard mNotify status codes: 0=delivered, 1=undelivered, 2=expired, etc.
                const providerStatus = String(result.data.status);
                const isDelivered = providerStatus === '0' || providerStatus.toLowerCase().includes('delivered');
                
                await updateDoc(doc(firestore, 'message_logs', selectedLog.id), {
                    providerStatus: providerStatus,
                    status: isDelivered ? 'sent' : 'failed',
                    updatedAt: new Date().toISOString()
                });

                setSelectedLog(prev => prev ? { ...prev, providerStatus, status: isDelivered ? 'sent' : 'failed' } : null);
                toast({ title: 'Status Synchronized', description: `Handset delivery confirmed as: ${providerStatus}` });
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const getStatusBadge = (log: MessageLog) => {
        const status = log.status;
        const providerStatus = log.providerStatus;

        if (providerStatus === '0' || providerStatus?.toLowerCase() === 'delivered') {
            return <Badge className="bg-emerald-500 text-white border-none gap-1"><CheckCircle2 className="h-3 w-3" /> Delivered</Badge>;
        }

        switch (status) {
            case 'sent': return <Badge className="bg-green-500 text-white border-none gap-1"><CheckCircle2 className="h-3 w-3" /> Sent</Badge>;
            case 'failed': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
            case 'scheduled': return <Badge variant="outline" className="gap-1 border-dashed"><Clock className="h-3 w-3" /> Scheduled</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <History className="h-8 w-8 text-primary" />
                        Communication Logs
                    </h1>
                    <p className="text-muted-foreground">Historical record of all manual and automated communications.</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardHeader className="pb-3 border-b bg-muted/10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative flex-grow max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search recipient or template..." 
                                    className="pl-10 h-10 rounded-xl bg-background border-none shadow-none focus:ring-1 focus:ring-primary/20" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="gap-2 rounded-xl font-bold h-10 shadow-sm">
                                <Filter className="h-4 w-4" /> Filters
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Timestamp</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Channel</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Recipient</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Template</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="text-[10px] font-medium text-muted-foreground pl-6">
                                                {format(new Date(log.sentAt), 'MMM d, HH:mm:ss')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter">
                                                    {log.channel === 'email' ? <Mail className="h-3 w-3 text-blue-500" /> : <Smartphone className="h-3 w-3 text-orange-500" />}
                                                    {log.channel}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-xs truncate max-w-[150px]">{log.recipient}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{log.templateName || 'One-off Message'}</TableCell>
                                            <TableCell>{getStatusBadge(log)}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                            No logs found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 border-b bg-card">
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            {selectedLog?.channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                            Communication Detail
                        </DialogTitle>
                        <DialogDescription>Full record of the dispatched message and its context.</DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-8 pb-20">
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Recipient</Label>
                                    <p className="font-bold">{selectedLog?.recipient}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Timestamp</Label>
                                    <p className="font-medium text-xs">{selectedLog && format(new Date(selectedLog.sentAt), 'PPPP p')}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Sender Profile</Label>
                                    <p className="text-sm font-semibold">{selectedLog?.senderName} <span className="font-normal text-muted-foreground">({selectedLog?.channel})</span></p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Delivery Status</Label>
                                    <div className="flex justify-end items-center gap-2">
                                        {selectedLog && getStatusBadge(selectedLog)}
                                        {selectedLog?.channel === 'sms' && selectedLog?.providerId && (
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-6 w-6 rounded-md" 
                                                onClick={handleSyncStatus}
                                                disabled={isSyncing}
                                                title="Sync with mNotify"
                                            >
                                                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedLog?.providerId && (
                                <Card className="bg-slate-50 border-dashed border-2">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Gateway Reference (mNotify)</p>
                                            <p className="font-mono text-xs font-bold text-primary">{selectedLog.providerId}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Provider Status Code</p>
                                            <Badge variant="outline" className="h-5 text-[10px] font-black tabular-nums">{selectedLog.providerStatus || 'Sent'}</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {selectedLog?.schoolId && (
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg"><Building className="h-4 w-4 text-primary" /></div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Associated School</p>
                                                <p className="text-xs font-bold truncate max-w-[200px]">ID: {selectedLog.schoolId}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-tight">
                                            <Link href={`/admin/schools/${selectedLog.schoolId}`}>View Console</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {selectedLog?.status === 'failed' && (
                                <div className="p-4 rounded-xl border-2 border-destructive/20 bg-destructive/5 flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-widest text-destructive">Error Details</p>
                                        <p className="text-sm font-medium text-destructive/80 leading-relaxed">{selectedLog.error}</p>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            {/* Message Content */}
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Info className="h-3 w-3" /> Resolved Content
                                </Label>
                                
                                {selectedLog?.channel === 'email' ? (
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-lg bg-muted/30 border border-dashed text-sm font-bold shadow-inner">
                                            Subject: {selectedLog.subject}
                                        </div>
                                        <div className="border rounded-2xl bg-white shadow-2xl min-h-[300px] overflow-hidden">
                                            <div 
                                                className="p-6 prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: selectedLog.body }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#0A1427] rounded-3xl p-6 relative max-w-sm mx-auto shadow-2xl border border-white/5">
                                        <div className="absolute -left-2 top-8 w-4 h-4 bg-[#0A1427] rotate-45 rounded-sm border-l border-b border-white/5" />
                                        <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{selectedLog?.body}</p>
                                    </div>
                                )}
                            </div>

                            {/* Raw Variables */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Variables Provided</Label>
                                <div className="bg-muted/50 p-4 rounded-xl font-mono text-[10px] grid grid-cols-2 gap-2 shadow-inner">
                                    {selectedLog?.variables && Object.entries(selectedLog.variables).map(([key, val]) => (
                                        <div key={key} className="truncate" title={`${key}: ${val}`}>
                                            <span className="text-primary font-bold">{key}:</span> {String(val)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 bg-muted/20 border-t shrink-0">
                        <Button onClick={() => setSelectedLog(null)} className="w-full h-11 rounded-xl font-bold">Close Record</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
