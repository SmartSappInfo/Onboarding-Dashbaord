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
    Eye, Search, Filter, Loader2, Info, Building, RefreshCw, AlertCircle, Clock, ShieldCheck,
    FileText, MousePointer2, Wand2, ArrowRight, Lock, AlertTriangle
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchSmsStatusAction } from '@/lib/mnotify-actions';
import { fetchEmailStatusAction } from '@/lib/resend-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function MessageLogsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedLog, setSelectedLog] = React.useState<MessageLog | null>(null);
    const [isSyncing, setIsSyncing] = React.useState(false);

    // Pull all logs and filter in frontend for reliability
    const logsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_logs'), orderBy('sentAt', 'desc'), limit(200));
    }, [firestore]);

    const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

    const filteredLogs = React.useMemo(() => {
        if (!logs) return [];
        if (!searchTerm) return logs;
        const s = searchTerm.toLowerCase();
        return logs.filter(l => 
            l.recipient.toLowerCase().includes(s) || 
            l.templateName?.toLowerCase().includes(s) ||
            l.subject?.toLowerCase().includes(s) ||
            l.title?.toLowerCase().includes(s)
        );
    }, [logs, searchTerm]);

    const handleSyncStatus = async () => {
        if (!selectedLog?.providerId || !firestore) return;
        setIsSyncing(true);
        
        try {
            let providerStatus = '';
            let isDelivered = false;

            if (selectedLog.channel === 'sms') {
                const result = await fetchSmsStatusAction(selectedLog.providerId);
                if (result.success) {
                    providerStatus = String(result.data.status);
                    isDelivered = providerStatus === '0' || providerStatus.toLowerCase().includes('delivered');
                } else throw new Error(result.error);
            } else {
                const result = await fetchEmailStatusAction(selectedLog.providerId);
                if (result.success) {
                    providerStatus = result.data.last_event || 'sent';
                    isDelivered = providerStatus === 'delivered';
                } else throw new Error(result.error);
            }

            await updateDoc(doc(firestore, 'message_logs', selectedLog.id), {
                providerStatus: providerStatus,
                status: isDelivered ? 'sent' : providerStatus === 'bounced' ? 'failed' : selectedLog.status,
                updatedAt: new Date().toISOString()
            });

            setSelectedLog(prev => prev ? { 
                ...prev, 
                providerStatus, 
                status: isDelivered ? 'sent' : (providerStatus === 'bounced' ? 'failed' : prev.status) 
            } : null);
            
            toast({ title: 'Status Synchronized', description: `Delivery confirmed as: ${providerStatus}` });
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
            return <Badge className="bg-emerald-500 text-white border-none gap-1 h-5 text-[8px] uppercase tracking-widest"><CheckCircle2 className="h-2.5 w-2.5" /> Delivered</Badge>;
        }

        if (providerStatus === 'bounced' || providerStatus === 'failed') {
            return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase tracking-widest"><XCircle className="h-2.5 w-2.5" /> Bounced</Badge>;
        }

        switch (status) {
            case 'sent': return <Badge className="bg-green-500 text-white border-none gap-1 h-5 text-[8px] uppercase tracking-widest"><CheckCircle2 className="h-2.5 w-2.5" /> Sent</Badge>;
            case 'failed': return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase tracking-widest"><XCircle className="h-2.5 w-2.5" /> Failed</Badge>;
            case 'scheduled': return <Badge variant="outline" className="gap-1 border-dashed h-5 text-[8px] uppercase tracking-widest"><Clock className="h-2.5 w-2.5" /> Scheduled</Badge>;
            default: return <Badge variant="secondary" className="h-5 text-[8px] uppercase tracking-widest">{status}</Badge>;
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-black uppercase text-[10px] tracking-widest h-8">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-3 w-3" /> Back to Messaging Hub
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <History className="h-8 w-8 text-primary" />
                        Communication Logs
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Audit trail of all organization dispatches.</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardHeader className="pb-3 border-b bg-muted/10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative flex-grow max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search title, recipient, or subject..." 
                                    className="pl-10 h-10 rounded-xl bg-background border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="gap-2 rounded-xl font-bold h-10 shadow-sm border-primary/20 hover:bg-primary/5">
                                <Filter className="h-4 w-4 text-primary" /> Filters
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Timestamp</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Medium</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Title / Protocol</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Recipient</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Engagement</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Gateway Status</TableHead>
                                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="text-[10px] font-black text-muted-foreground pl-6 uppercase tabular-nums">
                                                {format(new Date(log.sentAt), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                                    {log.channel === 'email' ? <Mail className="h-3 w-3 text-blue-500" /> : <Smartphone className="h-3 w-3 text-orange-500" />}
                                                    {log.channel}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col max-w-[200px]">
                                                    <span className="font-black text-xs truncate text-foreground">{log.title || log.templateName}</span>
                                                    {log.subject && <span className="text-[9px] font-bold text-muted-foreground/60 truncate italic">{log.subject}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-xs truncate max-w-[150px]">{log.recipient}</TableCell>
                                            <TableCell>
                                                {log.channel === 'email' ? (
                                                    <div className="flex items-center gap-3">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn("flex items-center gap-1 text-[10px] font-black tabular-nums", (log.openedCount || 0) > 0 ? "text-emerald-600" : "text-muted-foreground opacity-30")}>
                                                                        <Eye className="h-3 w-3" /> {log.openedCount || 0}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Email Opens</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn("flex items-center gap-1 text-[10px] font-black tabular-nums", (log.clickedCount || 0) > 0 ? "text-blue-600" : "text-muted-foreground opacity-30")}>
                                                                        <MousePointer2 className="h-3 w-3" /> {log.clickedCount || 0}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Link Clicks</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                ) : <span className="text-[9px] font-bold text-muted-foreground/30">—</span>}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(log)}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                                                <History className="h-10 w-10" />
                                                <p className="text-xs font-black uppercase tracking-widest">No logs recorded</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem]">
                    <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl", selectedLog?.channel === 'email' ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500")}>
                                    {selectedLog?.channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Dispatch Overview</DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Detailed record of communication context</DialogDescription>
                                </div>
                            </div>
                            {selectedLog && getStatusBadge(selectedLog)}
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-10 pb-20">
                            {/* Error Diagnostics */}
                            {selectedLog?.status === 'failed' && (
                                <Card className="bg-red-50 border-red-100 rounded-2xl animate-pulse">
                                    <CardContent className="p-4 flex items-center gap-4 text-red-800">
                                        <AlertCircle className="h-6 w-6 text-red-600" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Deep Diagnostic Failure</p>
                                            <p className="text-sm font-bold uppercase tracking-tighter">{selectedLog.error || 'Provider rejected the dispatch attempt.'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Correct & Resend Workflow */}
                            {selectedLog?.status === 'failed' && (
                                <Button 
                                    className="w-full h-14 rounded-2xl font-black text-lg gap-3 bg-emerald-600 hover:bg-emerald-700 shadow-2xl transition-all active:scale-95"
                                    onClick={() => {
                                        router.push(`/admin/messaging/composer?correctId=${selectedLog.id}`);
                                        setSelectedLog(null);
                                    }}
                                >
                                    <Wand2 className="h-6 w-6" />
                                    Correct & Resend
                                </Button>
                            )}

                            {/* Read Receipt Stats */}
                            {selectedLog?.channel === 'email' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Card className="bg-emerald-50 border-emerald-100 rounded-2xl">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="p-2.5 bg-emerald-500 text-white rounded-xl"><Eye className="h-4 w-4" /></div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-emerald-700">Opens</p>
                                                <p className="text-2xl font-black text-emerald-900">{selectedLog.openedCount || 0}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-blue-50 border-blue-100 rounded-2xl">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="p-2.5 bg-blue-500 text-white rounded-xl"><MousePointer2 className="h-4 w-4" /></div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-blue-700">Clicks</p>
                                                <p className="text-2xl font-black text-blue-900">{selectedLog.clickedCount || 0}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Metadata Grid */}
                            <Card className="bg-muted/20 border border-border/50 rounded-3xl overflow-hidden shadow-inner">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Message Title / Protocol</Label>
                                            <p className="font-black text-foreground uppercase">{selectedLog?.title || selectedLog?.templateName}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Execution Time</Label>
                                            <p className="font-bold text-xs uppercase">{selectedLog && format(new Date(selectedLog.sentAt), 'PPPP p')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Recipient</Label>
                                            <p className="text-sm font-black text-primary truncate max-w-full">{selectedLog?.recipient}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Live Sync</Label>
                                            <div className="flex justify-end pt-1">
                                                {selectedLog?.providerId && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white" 
                                                        onClick={handleSyncStatus}
                                                        disabled={isSyncing}
                                                    >
                                                        <RefreshCw className={cn("h-3 w-3 text-primary", isSyncing && "animate-spin")} />
                                                        Refresh Status
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Separator className="opacity-50" />

                            {/* Message Content */}
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 ml-1">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Verified Resolved Content
                                </Label>
                                
                                {selectedLog?.channel === 'email' ? (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-muted/30 border border-dashed text-xs font-black uppercase tracking-tight shadow-inner">
                                            <span className="opacity-40 mr-2">Subject:</span> {selectedLog.subject}
                                        </div>
                                        <div className="border rounded-3xl bg-white shadow-2xl min-h-[350px] overflow-hidden relative ring-1 ring-border/50">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20" />
                                            <div 
                                                className="p-8 prose prose-sm max-w-none text-slate-700 leading-relaxed font-medium"
                                                dangerouslySetInnerHTML={{ __html: selectedLog.body }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#0A1427] rounded-[2.5rem] p-8 relative max-w-sm mx-auto shadow-2xl border border-white/5 group transition-all hover:scale-[1.02]">
                                        <div className="absolute -left-2 top-10 w-4 h-4 bg-[#0A1427] rotate-45 rounded-sm border-l border-b border-white/10 group-hover:border-primary/30 transition-colors" />
                                        <p className="text-sm text-white/90 leading-relaxed font-bold whitespace-pre-wrap">{selectedLog?.body}</p>
                                        <div className="mt-6 pt-4 border-t border-white/5 flex justify-between text-[8px] font-black uppercase tracking-widest text-white/20">
                                            <span>Chars: {selectedLog?.body.length}</span>
                                            <span>Handset Mock-up</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                        <Button onClick={() => setSelectedLog(null)} className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl active:scale-95 transition-all">Close Entry</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
