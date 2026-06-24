'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, doc, updateDoc, where } from 'firebase/firestore';
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
    FileText, MousePointer2, Wand2, ArrowRight, Lock, AlertTriangle, Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageContainerFluid } from '@/components/ui/page-container';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchSmsStatusAction } from '@/lib/mnotify-actions';
import { fetchEmailStatusAction } from '@/lib/resend-actions';
import { syncAllLogStatuses } from '@/lib/messaging-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import DOMPurify from 'isomorphic-dompurify';

import { MessageContactDisplay } from '@/components/messaging/MessageContactDisplay';

/**
 * @fileOverview Messaging Log Audit Ledger.
 * Filtered by Workspace to ensure track-specific data isolation.
 * Updated to display entity information via Contact Adapter (Requirement 15.4, 23.1)
 */
export default function MessageLogsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { activeWorkspaceId } = useWorkspace();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedLog, setSelectedLog] = React.useState<MessageLog | null>(null);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isGlobalSyncing, setIsGlobalSyncing] = React.useState(false);
    const [showFilters, setShowFilters] = React.useState(false);
    const [filterChannel, setFilterChannel] = React.useState<'all' | 'email' | 'sms'>('all');
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'sent' | 'failed' | 'scheduled'>('all');

    // Filtered by active workspace array-contains
    // Support querying by entityId with entityId fallback (Requirement 15.5, 22.1)
    const logsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_logs'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('sentAt', 'desc'), 
            limit(200)
        );
    }, [firestore, activeWorkspaceId]);

    const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

    const activeFilterCount = (filterChannel !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);

    const filteredLogs = React.useMemo(() => {
        if (!logs) return [];
        let result = logs;
        if (filterChannel !== 'all') result = result.filter(l => l.channel === filterChannel);
        if (filterStatus !== 'all') result = result.filter(l => l.status === filterStatus);
        if (!searchTerm) return result;
        const s = searchTerm.toLowerCase();
        return result.filter(l => 
            l.recipient.toLowerCase().includes(s) || 
            l.templateName?.toLowerCase().includes(s) ||
            l.subject?.toLowerCase().includes(s) ||
            l.title?.toLowerCase().includes(s)
        );
    }, [logs, searchTerm, filterChannel, filterStatus]);

    const handleGlobalSync = async () => {
        setIsGlobalSyncing(true);
        const result = await syncAllLogStatuses();
        if (result.success) {
            toast({ 
                title: 'Status Sync Complete', 
                description: result.count ? `Updated ${result.count} messages.` : 'All messages are up to date.' 
            });
        } else {
            toast({ variant: 'destructive', title: 'Status Sync Failed', description: result.error });
        }
        setIsGlobalSyncing(false);
    }

    const handleSyncStatus = async () => {
        if (!selectedLog?.providerId || !firestore) return;
        setIsSyncing(true);
        
        try {
            let providerStatus = '';
            let isDelivered = false;
            let isSent = false;

            if (selectedLog.channel === 'sms') {
                const result = await fetchSmsStatusAction(selectedLog.providerId);
                if (result.success && result.data) {
                    providerStatus = String(result.data.status);
                    isDelivered = providerStatus === '0' || providerStatus.toLowerCase().includes('delivered');
                    isSent = true;
                } else throw new Error(result.error || 'Failed to fetch SMS status');
            } else {
                const result = await fetchEmailStatusAction(selectedLog.providerId);
                if (result.success && result.data) {
                    providerStatus = result.data.last_event || 'sent';
                    isDelivered = providerStatus === 'delivered';
                    isSent = providerStatus !== 'scheduled';
                } else throw new Error(result.error || 'Failed to fetch email status');
            }

            const updates: any = {
                providerStatus: providerStatus,
                updatedAt: new Date().toISOString()
            };

            if (isDelivered) updates.status = 'sent';
            else if (providerStatus === 'bounced') updates.status = 'failed';
            else if (isSent && selectedLog.status === 'scheduled') updates.status = 'sent';

            await updateDoc(doc(firestore, 'message_logs', selectedLog.id), updates);

            setSelectedLog(prev => prev ? { 
                ...prev, 
                ...updates
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
            return <Badge className="bg-emerald-500 text-white border-none gap-1 h-5 text-[8px] uppercase "><CheckCircle2 className="h-2.5 w-2.5" /> Delivered</Badge>;
        }

        if (providerStatus === 'bounced' || providerStatus === 'failed') {
            return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase "><XCircle className="h-2.5 w-2.5" /> Bounced</Badge>;
        }

        switch (status) {
            case 'sent': return <Badge className="bg-green-500 text-white border-none gap-1 h-5 text-[8px] uppercase "><CheckCircle2 className="h-2.5 w-2.5" /> Sent</Badge>;
            case 'failed': return <Badge variant="destructive" className="gap-1 h-5 text-[8px] uppercase "><XCircle className="h-2.5 w-2.5" /> Failed</Badge>;
            case 'scheduled': return <Badge variant="outline" className="gap-1 border-dashed h-5 text-[8px] uppercase "><Clock className="h-2.5 w-2.5" /> Scheduled</Badge>;
            default: return <Badge variant="secondary" className="h-5 text-[8px] uppercase ">{status}</Badge>;
        }
    };

    return (
        <div className="h-full overflow-y-auto text-left">
            <PageContainerFluid>
                <div className="grid gap-6">
 <div className="flex justify-end gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleGlobalSync} 
                        disabled={isGlobalSyncing || isLoading}
 className="rounded-xl font-bold h-10 gap-2 border-primary/20 hover:bg-primary/5 text-primary shadow-sm"
                    >
 {isGlobalSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        Sync All Statuses
                    </Button>
                </div>

 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
 <CardHeader className="pb-3 border-b bg-background">
 <div className="flex items-center justify-between gap-4">
 <div className="relative flex-grow max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search title, recipient, or subject..." 
 className="pl-10 h-10 rounded-xl bg-background border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
 <Button variant={showFilters ? 'default' : 'outline'} onClick={() => setShowFilters(!showFilters)} className={cn("gap-2 rounded-xl font-bold h-10 shadow-sm transition-all", showFilters ? '' : 'border-primary/20 hover:bg-primary/5')}>
 <Filter className="h-4 w-4" /> Filters
                                {activeFilterCount > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[9px] font-bold rounded-full">{activeFilterCount}</Badge>}
                            </Button>
                        </div>
                        {showFilters && (
                            <div className="flex items-center gap-3 pt-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Channel</span>
                                    <div className="flex gap-1">
                                        {(['all', 'email', 'sms'] as const).map((ch) => (
                                            <Button key={ch} variant={filterChannel === ch ? 'default' : 'outline'} size="sm" onClick={() => setFilterChannel(ch)} className={cn("h-7 px-3 text-[10px] font-bold rounded-lg capitalize", filterChannel !== ch && 'border-border/50')}>
                                                {ch === 'all' ? 'All' : ch === 'email' ? <><Mail className="h-3 w-3 mr-1" /> Email</> : <><Smartphone className="h-3 w-3 mr-1" /> SMS</>}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <Separator orientation="vertical" className="h-6" />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
                                    <div className="flex gap-1">
                                        {(['all', 'sent', 'failed', 'scheduled'] as const).map((st) => (
                                            <Button key={st} variant={filterStatus === st ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(st)} className={cn("h-7 px-3 text-[10px] font-bold rounded-lg capitalize", filterStatus !== st && 'border-border/50')}>
                                                {st === 'all' ? 'All' : st}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                {activeFilterCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => { setFilterChannel('all'); setFilterStatus('all'); }} className="h-7 text-[10px] font-bold text-destructive hover:text-destructive/80 hover:bg-destructive/5 rounded-lg">
                                        Clear All
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardHeader>
 <CardContent className="p-0">
                        <Table>
 <TableHeader className="bg-muted/30">
                                <TableRow>
 <TableHead className="text-[10px] font-semibold pl-6">Timestamp</TableHead>
 <TableHead className="text-[10px] font-semibold ">Medium</TableHead>
 <TableHead className="text-[10px] font-semibold ">Contact</TableHead>
 <TableHead className="text-[10px] font-semibold ">Template / Subject</TableHead>
 <TableHead className="text-[10px] font-semibold ">Recipient</TableHead>
 <TableHead className="text-[10px] font-semibold ">Engagement</TableHead>
 <TableHead className="text-[10px] font-semibold ">Delivery Status</TableHead>
 <TableHead className="text-right pr-6 text-[10px] font-semibold ">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
 <TableCell><Skeleton className="h-4 w-12" /></TableCell>
 <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
 <TableCell className="text-[10px] font-semibold text-muted-foreground pl-6 tabular-nums">
                                                {format(new Date(log.sentAt), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell>
 <div className="flex items-center gap-2 text-[9px] font-semibold tracking-tighter">
 {log.channel === 'email' ? <Mail className="h-3 w-3 text-blue-500" /> : <Smartphone className="h-3 w-3 text-orange-500" />}
                                                    {log.channel}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <MessageContactDisplay log={log} workspaceId={activeWorkspaceId || ''} />
                                            </TableCell>
                                            <TableCell>
 <div className="flex flex-col max-w-[200px]">
 <span className="font-semibold text-xs truncate text-foreground">{log.title || log.templateName}</span>
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
 <div className={cn("flex items-center gap-1 text-[10px] font-semibold tabular-nums", (log.openedCount || 0) > 0 ? "text-emerald-600" : "text-muted-foreground opacity-30")}>
 <Eye className="h-3 w-3" /> {log.openedCount || 0}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Email Opens</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
 <div className={cn("flex items-center gap-1 text-[10px] font-semibold tabular-nums", (log.clickedCount || 0) > 0 ? "text-blue-600" : "text-muted-foreground opacity-30")}>
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
 className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity rounded-xl"
                                                    onClick={() => setSelectedLog(log)}
                                                    aria-label="View message details"
                                                >
 <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
 <TableCell colSpan={8} className="h-48 text-center">
 <div className="flex flex-col items-center justify-center gap-3 py-8">
 <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
   <History className="h-7 w-7 text-muted-foreground/40" />
 </div>
 <div className="space-y-1">
   <p className="text-sm font-bold text-foreground">{searchTerm || activeFilterCount > 0 ? 'No matching messages' : 'No messages sent yet'}</p>
   <p className="text-xs text-muted-foreground max-w-xs mx-auto">
     {searchTerm || activeFilterCount > 0
       ? 'Try adjusting your search or filters to find what you\'re looking for.'
       : 'Messages you send via the Composer or automations will appear here with full delivery tracking.'}
   </p>
 </div>
 {(searchTerm || activeFilterCount > 0) && (
   <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold mt-2" onClick={() => { setSearchTerm(''); setFilterChannel('all'); setFilterStatus('all'); }}>
     Clear Filters
   </Button>
 )}
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
 <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
 <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
 <div className="flex items-center justify-between pr-8">
 <div className="flex items-center gap-3">
 <div className={cn("p-2 rounded-xl", selectedLog?.channel === 'email' ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500")}>
 {selectedLog?.channel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                                </div>
                                <div>
 <DialogTitle className="text-xl font-semibold tracking-tight text-left">Message Details</DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground text-left">Full message log and delivery status</DialogDescription>
                                </div>
                            </div>
                            {selectedLog && getStatusBadge(selectedLog)}
                        </div>
                    </DialogHeader>
                    
 <ScrollArea className="flex-1">
 <div className="p-6 space-y-10 pb-20">
                            {/* Error Diagnostics */}
                            {selectedLog?.status === 'failed' && (
 <Card className="bg-destructive/10 border-destructive/20 rounded-2xl">
 <CardContent className="p-4 flex items-center gap-4 text-destructive text-left">
 <AlertCircle className="h-6 w-6" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold ">Delivery Error</p>
 <p className="text-sm font-bold tracking-tighter">{selectedLog.error || 'The message could not be delivered.'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Metadata Grid */}
 <Card className="bg-muted/20 border border-border/50 rounded-3xl overflow-hidden shadow-inner">
 <CardContent className="p-6">
 <div className="grid grid-cols-2 gap-8 text-left">
 <div className="space-y-1">
 <Label className="text-[9px] font-semibold text-muted-foreground ">Message Name</Label>
 <p className="font-semibold text-foreground ">{selectedLog?.title || selectedLog?.templateName}</p>
                                        </div>
 <div className="space-y-1 text-right">
 <Label className="text-[9px] font-semibold text-muted-foreground ">Sent At</Label>
 <p className="font-bold text-xs ">{selectedLog && format(new Date(selectedLog.sentAt), 'PPPP p')}</p>
                                        </div>
 <div className="space-y-1">
 <Label className="text-[9px] font-semibold text-muted-foreground ">Recipient</Label>
 <p className="text-sm font-semibold text-primary truncate max-w-full">{selectedLog?.recipient}</p>
                                        </div>
 <div className="space-y-1 text-right">
 <Label className="text-[9px] font-semibold text-muted-foreground ">Live Sync</Label>
 <div className="flex justify-end pt-1">
                                                {selectedLog?.providerId && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
 className="h-8 rounded-xl font-semibold text-[10px] gap-2 bg-card" 
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
 <div className="space-y-4 text-left">
 <Label className="text-[10px] font-semibold text-primary flex items-center gap-2 ml-1">
 <ShieldCheck className="h-3.5 w-3.5" /> Message Preview
                                </Label>
                                
                                {selectedLog?.channel === 'email' ? (
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-muted/30 border border-dashed text-xs font-semibold tracking-tight shadow-inner">
 <span className="opacity-40 mr-2 text-left">Subject:</span> {selectedLog.subject}
                                        </div>
 <div className="border rounded-3xl bg-card shadow-2xl min-h-[350px] overflow-hidden relative ring-1 ring-border/50 text-left">
 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20" />
                                            <div 
 className="p-8 prose prose-sm max-w-none text-foreground dark:prose-invert leading-relaxed font-medium"
                                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedLog.body, { ADD_ATTR: ['target'] }) }}
                                            />
                                        </div>
                                    </div>
                                ) : (
 <div className="bg-muted/10 rounded-[2.5rem] p-8 relative max-w-sm mx-auto shadow-2xl border border-border group transition-all hover:scale-[1.02] text-left">
 <div className="absolute -left-2.5 top-10 w-4 h-4 bg-muted/10 rotate-45 rounded-sm border-l border-b border-border group-hover:border-primary/30 transition-colors" />
 <p className="text-sm text-foreground leading-relaxed font-bold whitespace-pre-wrap">{selectedLog?.body}</p>
 <div className="mt-6 pt-4 border-t border-border flex justify-between text-[8px] font-semibold text-muted-foreground">
                                            <span>Chars: {selectedLog?.body.length}</span>
                                            <span>SMS Preview</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
 <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
 <Button onClick={() => setSelectedLog(null)} className="w-full h-14 rounded-2xl font-semibold text-lg shadow-xl active:scale-95 transition-all">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </PageContainerFluid>
        </div>
    );
}
