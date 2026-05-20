'use client';

import React, { useEffect, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { FileUp, Search, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, HardDrive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { purgeExpiredFailedImportsAction, getFailedRowsAction, updateFailedRowAction, ingestBatchAction, getDuplicateRowsAction } from '@/lib/bulk-upload-actions';
import { DuplicateResolutionPortal } from './components/DuplicateResolutionPortal';
import { useToast } from '@/hooks/use-toast';

export default function ImportsLogClient() {
    const { activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const { toast } = useToast();

    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [failedRows, setFailedRows] = useState<any[]>([]);
    const [isLoadingFailed, setIsLoadingFailed] = useState(false);
    const [retryingRow, setRetryingRow] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<any>(null);
    const [duplicateRows, setDuplicateRows] = useState<any[]>([]);
    const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
    const [activeTab, setActiveTab] = useState('failed');

    // Fire-and-forget TTL Purger on mount
    useEffect(() => {
        if (activeWorkspace?.id) {
            purgeExpiredFailedImportsAction(activeWorkspace.id).catch(console.error);
        }
    }, [activeWorkspace?.id]);

    const firestore = useFirestore();

    // Query active logs via Firestore for real-time progress updates
    const logsQuery = useMemoFirebase(() => {
        if (!activeWorkspace?.id || !firestore) return null;
        return query(
            collection(firestore, 'import_logs'),
            where('workspaceId', '==', activeWorkspace.id),
            orderBy('startedAt', 'desc')
        );
    }, [activeWorkspace?.id, firestore]);

    const { data: logs, isLoading } = useCollection<any>(logsQuery);

    const handleViewPortal = async (logId: string, initialTab: 'failed' | 'duplicates' = 'failed') => {
        setSelectedLogId(logId);
        setActiveTab(initialTab);
        setIsLoadingFailed(true);
        setIsLoadingDuplicates(true);
        try {
            const [fRows, dRows] = await Promise.all([
                getFailedRowsAction(logId),
                getDuplicateRowsAction(logId)
            ]);
            setFailedRows(fRows);
            setDuplicateRows(dRows);
            
            // Auto-switch to duplicates if there are no failed rows but there are duplicates
            if (fRows.length === 0 && dRows.length > 0 && initialTab === 'failed') {
                setActiveTab('duplicates');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error loading resolution data' });
        } finally {
            setIsLoadingFailed(false);
            setIsLoadingDuplicates(false);
        }
    };

    const handleSaveRow = async () => {
        if (!editingRow || !selectedLogId) return;
        try {
            await updateFailedRowAction(selectedLogId, editingRow.id, editingRow.rawPayload);
            setFailedRows(prev => prev.map(r => r.id === editingRow.id ? editingRow : r));
            setEditingRow(null);
            toast({ title: 'Row updated' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };

    const handleRetry = async (row: any, logInfo: any) => {
        setRetryingRow(row.id);
        try {
            // Re-run single row through batch action
            const res = await ingestBatchAction(
                [row.rawPayload],
                {}, // mapping should ideally be stored in log or payload, assume payload is pre-mapped for simple retry
                user?.uid || '',
                'Retry_' + logInfo.filename,
                logInfo.workspaceId,
                logInfo.organizationId,
                logInfo.entityType,
                false,
                {},
                logInfo.selectedTags || [],
                logInfo.automationId || undefined,
                []
            );
            
            // If it succeeds, the background worker handles it, but since we retry 1 row, we can just reload failed rows
            toast({ title: 'Retry dispatched' });
            setTimeout(() => handleViewPortal(selectedLogId!, 'failed'), 2000);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Retry failed', description: error.message });
        } finally {
            setRetryingRow(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Imports Log</h1>
                    <p className="text-muted-foreground">Monitor bulk ingestion progress and resolve conflicts.</p>
                </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm bg-card ring-1 ring-border">
                <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-primary" />
                        Audit Trail
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[300px]">File & Entity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Metrics</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : logs?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                        No imports found in this workspace.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs?.map(log => {
                                    const processed = (log.successCount || 0) + (log.failedCount || 0) + (log.duplicateCount || 0);
                                    const total = log.totalCount || 1;
                                    const percent = Math.min(100, Math.round((processed / total) * 100));
                                    
                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <div className="font-medium truncate max-w-[200px]" title={log.filename}>{log.filename}</div>
                                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1">{log.entityType}</Badge>
                                                    <span>{log.startedAt?.seconds ? formatDistanceToNow(log.startedAt.toDate(), { addSuffix: true }) : 'Just now'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {log.status === 'queued' ? (
                                                     <Badge variant="secondary" className="bg-slate-100 text-slate-600">Queued</Badge>
                                                 ) : log.status === 'processing' ? (
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 animate-pulse">Processing</Badge>
                                                ) : log.status === 'completed' ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-none">Completed</Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="bg-red-50 text-red-700 border-none">Has Errors</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="w-[200px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Progress value={percent} className="h-2" />
                                                    <span className="text-xs font-medium w-8 text-right">{percent}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-emerald-600 flex items-center gap-1" title="Imported"><CheckCircle2 size={12}/> {log.successCount || 0}</span>
                                                    <span className="text-red-500 flex items-center gap-1" title="Failed">
                                                        <AlertCircle size={12}/> {log.failedCount || 0}
                                                        {log.failedCount > 0 && <span className="text-[9px] uppercase tracking-wide font-semibold">err</span>}
                                                    </span>
                                                    <span className="text-amber-500 flex items-center gap-1" title="Duplicates">
                                                        <RefreshCw size={12}/> {log.duplicateCount || 0}
                                                        {log.duplicateCount > 0 && <span className="text-[9px] uppercase tracking-wide font-semibold">dup</span>}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(log.failedCount > 0 || log.duplicateCount > 0) && !log.rawFieldsCleared && (
                                                    <Button variant="outline" size="sm" onClick={() => handleViewPortal(log.id, log.failedCount > 0 ? 'failed' : 'duplicates')}>
                                                        Resolve
                                                    </Button>
                                                )}
                                                {log.rawFieldsCleared && (
                                                    <span className="text-xs text-muted-foreground italic">Payloads expired</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Resolution Portal */}
            <Dialog open={!!selectedLogId} onOpenChange={(open) => !open && setSelectedLogId(null)}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0">
                        <DialogTitle>Resolution Portal</DialogTitle>
                        <DialogDescription>
                            Fix data validation errors and resolve duplicate conflicts.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                            <div className="px-6 pt-4 border-b">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="failed" className="flex gap-2">
                                        <AlertCircle size={16} /> Failed Validations
                                        {failedRows.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-[10px] bg-red-100 text-red-700">{failedRows.length}</Badge>}
                                    </TabsTrigger>
                                    <TabsTrigger value="duplicates" className="flex gap-2">
                                        <RefreshCw size={16} /> Duplicate Conflicts
                                        {duplicateRows.filter(r => !r.resolved).length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-[10px] bg-amber-100 text-amber-700">{duplicateRows.filter(r => !r.resolved).length}</Badge>}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Each TabsContent takes the full remaining height; inactive ones are hidden */}
                            <TabsContent
                                value="failed"
                                className="mt-0 border-none outline-none data-[state=inactive]:hidden flex-1 overflow-hidden flex flex-col"
                            >
                                {isLoadingFailed ? (
                                    <div className="flex-1 flex items-center justify-center">Loading rows...</div>
                                ) : failedRows.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                                        <CheckCircle2 size={32} className="mb-4 text-emerald-500/50" />
                                        <p>No failed validations found.</p>
                                    </div>
                                ) : (
                                    <ScrollArea className="flex-1 p-6">
                                        <div className="space-y-4">
                                            {failedRows.map(row => (
                                                <Card key={row.id} className="border-red-100 shadow-sm">
                                                    <CardHeader className="p-4 pb-2">
                                                        <div className="flex items-start justify-between">
                                                            <div className="text-sm font-semibold text-red-600 flex items-center gap-2">
                                                                <AlertCircle size={16} /> Error
                                                            </div>
                                                            <Button 
                                                                size="sm" 
                                                                disabled={retryingRow === row.id}
                                                                onClick={() => handleRetry(row, logs?.find((l: any) => l.id === selectedLogId))}
                                                            >
                                                                {retryingRow === row.id ? 'Retrying...' : 'Retry'}
                                                            </Button>
                                                        </div>
                                                        <CardDescription className="text-xs text-red-500 mt-1">{row.error}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0">
                                                        <div className="bg-slate-50 p-3 rounded-lg border text-xs font-mono break-all mt-2 cursor-pointer hover:bg-slate-100" onClick={() => setEditingRow(row)}>
                                                            {JSON.stringify(row.rawPayload)}
                                                            <div className="text-[10px] text-muted-foreground mt-2 text-right">Click to edit raw JSON payload</div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </TabsContent>

                            <TabsContent
                                value="duplicates"
                                className="mt-0 border-none outline-none data-[state=inactive]:hidden flex-1 overflow-hidden flex flex-col p-6"
                            >
                                {isLoadingDuplicates ? (
                                    <div className="flex-1 flex items-center justify-center">Loading duplicates...</div>
                                ) : (
                                    <DuplicateResolutionPortal 
                                        importLogId={selectedLogId!} 
                                        importLog={logs?.find((l: any) => l.id === selectedLogId)}
                                        duplicateRows={duplicateRows} 
                                        onResolved={() => handleViewPortal(selectedLogId!, 'duplicates')}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Raw Payload Dialog */}
            <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
                <DialogContent className="sm:max-w-[600px] h-[50vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Raw Payload</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 h-full flex flex-col gap-4 overflow-hidden">
                        <textarea 
                            className="w-full flex-1 p-4 font-mono text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={editingRow ? JSON.stringify(editingRow.rawPayload, null, 2) : ''}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    setEditingRow({ ...editingRow, rawPayload: parsed });
                                } catch (err) {
                                    // Let them type invalid JSON temporarily
                                }
                            }}
                        />
                        <Button onClick={handleSaveRow} className="shrink-0">Save Changes</Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
