'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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
import { FileUp, Search, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, HardDrive, ArrowLeft, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { purgeExpiredFailedImportsAction, getFailedRowsAction, updateFailedRowAction, ingestBatchAction, getDuplicateRowsAction, cancelBulkUploadAction, resumeBulkUploadAction, resolveFailedRowAction } from '@/lib/bulk-upload-actions';
import { DuplicateResolutionPortal } from './components/DuplicateResolutionPortal';
import { useToast } from '@/hooks/use-toast';

export default function ImportsLogClient() {
    const { activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const backUrl = `/admin/entities?${searchParams.toString()}`;

    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [summaryLogId, setSummaryLogId] = useState<string | null>(null);
    const [failedRows, setFailedRows] = useState<any[]>([]);
    const [isLoadingFailed, setIsLoadingFailed] = useState(false);
    const [retryingRow, setRetryingRow] = useState<string | null>(null);
    const [editingCell, setEditingCell] = useState<{ rowId: string; fieldKey: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
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

    const handleCancel = async (logId: string) => {
        try {
            const res = await cancelBulkUploadAction(logId);
            if (res.success) {
                toast({ title: 'Import cancelled', description: 'The background job has been aborted.' });
            } else {
                toast({ title: 'Cannot cancel', description: res.message, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleResume = async (logId: string) => {
        try {
            const res = await resumeBulkUploadAction(logId);
            if (res.success) {
                toast({ title: 'Import resumed', description: 'The background job has been queued.' });
            } else {
                toast({ title: 'Cannot resume', description: res.message, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleSaveFailedCell = async (row: any, fieldKey: string) => {
        if (!selectedLogId) return;
        try {
            const updatedPayload = { ...row.rawPayload, [fieldKey]: editValue.trim() };
            await updateFailedRowAction(selectedLogId, row.id, updatedPayload);
            setFailedRows(prev => prev.map(r => r.id === row.id ? { ...r, rawPayload: updatedPayload } : r));
            setEditingCell(null);
            toast({ title: 'Field updated' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };

    const handleRetry = async (row: any, logInfo: any) => {
        setRetryingRow(row.id);
        try {
            await ingestBatchAction({
                rows: [row.rawPayload],
                mapping: {}, // mapping should ideally be stored in log or payload, assume payload is pre-mapped for simple retry
                userId: user?.uid || '',
                filename: 'Retry_' + logInfo.filename,
                workspaceId: logInfo.workspaceId,
                organizationId: logInfo.organizationId,
                entityType: logInfo.entityType,
                autoCreateTags: false,
                defaultValues: {},
                globalTagIds: logInfo.selectedTags || [],
                automationId: logInfo.automationId || undefined,
                manualTagNames: []
            });
            
            // Resolve the failed row in the original import log document
            await resolveFailedRowAction(selectedLogId!, row.id);

            // Update local state immediately to remove the resolved row
            setFailedRows(prev => prev.filter(r => r.id !== row.id));

            toast({ title: 'Retry dispatched successfully' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Retry failed', description: error.message });
        } finally {
            setRetryingRow(null);
        }
    };

    const summaryLog = logs?.find((l: any) => l.id === summaryLogId);

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <Link 
                href={backUrl} 
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 w-fit mb-2"
            >
                <ArrowLeft size={16} />
                Back to Directory
            </Link>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Imports Log</h1>
                    <p className="text-muted-foreground">Monitor bulk ingestion progress and resolve conflicts.</p>
                </div>
                <Button asChild className="gap-2 shrink-0">
                    <Link href="/admin/entities/upload">
                        <FileUp className="h-4 w-4" />
                        New Bulk Import
                    </Link>
                </Button>
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
                                    
                                    const totalDuplicates = log.duplicateCount || 0;
                                    const resolvedDuplicates = log.resolvedDuplicateCount || 0;
                                    const pendingDuplicates = Math.max(0, totalDuplicates - resolvedDuplicates);
                                    
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
                                                <Badge
                                                    className={`transition-all duration-300 ease-in-out transform hover:scale-[1.02] border-none shadow-sm ${
                                                        log.status === 'queued'
                                                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            : log.status === 'processing'
                                                            ? 'bg-blue-50 text-blue-700 animate-pulse hover:bg-blue-100'
                                                            : log.status === 'completed'
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : log.status === 'cancelled'
                                                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {log.status === 'queued' && 'Queued'}
                                                    {log.status === 'processing' && 'Processing'}
                                                    {log.status === 'completed' && 'Completed'}
                                                    {log.status === 'cancelled' && 'Cancelled'}
                                                    {!['queued', 'processing', 'completed', 'cancelled'].includes(log.status) && 'Has Errors'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="w-[200px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Progress value={percent} className="h-2" />
                                                    <span className="text-xs font-medium w-8 text-right">{percent}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                                                    <span className="text-emerald-600 flex items-center gap-1" title="Imported"><CheckCircle2 size={12}/> {log.successCount || 0}</span>
                                                    <span className="text-red-500 flex items-center gap-1" title="Failed">
                                                        <AlertCircle size={12}/> {log.failedCount || 0}
                                                        {log.failedCount > 0 && <span className="text-[9px] uppercase tracking-wide font-semibold">err</span>}
                                                    </span>
                                                    {totalDuplicates > 0 && (
                                                        <>
                                                            {pendingDuplicates > 0 && (
                                                                <span className="text-amber-500 flex items-center gap-1" title={`${pendingDuplicates} Pending Duplicates`}>
                                                                    <RefreshCw size={12}/> {pendingDuplicates}
                                                                    <span className="text-[9px] uppercase tracking-wide font-semibold">pending</span>
                                                                </span>
                                                            )}
                                                            {resolvedDuplicates > 0 && (
                                                                <span className="text-teal-600 flex items-center gap-1" title={`${resolvedDuplicates} Resolved Duplicates`}>
                                                                    <CheckCircle2 size={12}/> {resolvedDuplicates}
                                                                    <span className="text-[9px] uppercase tracking-wide font-semibold text-teal-600/70">resolved</span>
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {['queued', 'processing'].includes(log.status) && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleCancel(log.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-semibold">
                                                            Cancel
                                                        </Button>
                                                    )}
                                                    {['failed', 'cancelled'].includes(log.status) && (
                                                        <Button variant="outline" size="sm" onClick={() => handleResume(log.id)} className="rounded-xl font-semibold hover:bg-primary/5">
                                                            Resume
                                                        </Button>
                                                    )}
                                                    {!['queued', 'processing'].includes(log.status) && (
                                                        <>
                                                            {(log.failedCount > 0 || pendingDuplicates > 0) && !log.rawFieldsCleared ? (
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    onClick={() => handleViewPortal(log.id, log.failedCount > 0 ? 'failed' : 'duplicates')}
                                                                    className="rounded-xl font-semibold hover:bg-primary/5"
                                                                >
                                                                    Resolve
                                                                </Button>
                                                            ) : (
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    onClick={() => setSummaryLogId(log.id)}
                                                                    className="rounded-xl font-semibold hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200/50 hover:border-emerald-300"
                                                                >
                                                                    Summary
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {log.rawFieldsCleared && (log.failedCount > 0 || pendingDuplicates > 0) && (
                                                    <span className="text-xs text-muted-foreground italic block mt-1">Payloads expired</span>
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
                                                        <div className="rounded-lg border bg-slate-50/50 mt-2 overflow-hidden">
                                                            {Object.entries(row.rawPayload || {}).map(([fieldKey, fieldVal]) => {
                                                                const isCellEditing = editingCell?.rowId === row.id && editingCell?.fieldKey === fieldKey;
                                                                const displayVal = fieldVal !== null && fieldVal !== undefined ? String(fieldVal) : '';
                                                                return (
                                                                    <div key={fieldKey} className="flex items-center border-b border-border/30 last:border-b-0 group/cell">
                                                                        <div className="px-3 py-2 w-[140px] shrink-0 bg-slate-100/60 border-r border-border/30">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{fieldKey}</span>
                                                                        </div>
                                                                        <div className="flex-1 px-3 py-2 flex items-center justify-between gap-2 min-h-[36px]">
                                                                            {isCellEditing ? (
                                                                                <div className="flex items-center gap-1.5 w-full">
                                                                                    <Input
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveFailedCell(row, fieldKey);
                                                                                            if (e.key === 'Escape') setEditingCell(null);
                                                                                        }}
                                                                                        className="h-7 text-xs px-2 py-1 w-full focus-visible:ring-primary/20 bg-background"
                                                                                        autoFocus
                                                                                    />
                                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0" onClick={() => handleSaveFailedCell(row, fieldKey)}>
                                                                                        <CheckCircle2 size={12} />
                                                                                    </Button>
                                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={() => setEditingCell(null)}>
                                                                                        <span className="font-bold text-xs">✕</span>
                                                                                    </Button>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <span className="text-xs font-medium text-slate-700 break-all">{displayVal || <span className="text-slate-400 italic">—</span>}</span>
                                                                                    <Button
                                                                                        size="icon"
                                                                                        variant="ghost"
                                                                                        className="h-6 w-6 text-muted-foreground hover:text-primary opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 rounded-md shrink-0"
                                                                                        onClick={() => {
                                                                                            setEditingCell({ rowId: row.id, fieldKey });
                                                                                            setEditValue(displayVal);
                                                                                        }}
                                                                                        title="Edit Value"
                                                                                    >
                                                                                        <Edit2 size={11} />
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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



            {/* Summary Dialog */}
            <Dialog open={!!summaryLogId} onOpenChange={(open) => !open && setSummaryLogId(null)}>
                <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-lg bg-card p-6 overflow-hidden">
                    {summaryLog && (
                        <div className="space-y-6">
                            <DialogHeader className="space-y-2 text-left">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold tracking-tight">Import Summary</DialogTitle>
                                        <DialogDescription className="text-xs text-muted-foreground">
                                            Detailed execution summary for this bulk import.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-muted-foreground/10">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Filename</span>
                                    <span className="font-semibold truncate max-w-[240px]" title={summaryLog.filename}>
                                        {summaryLog.filename}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Entity Type</span>
                                    <Badge variant="secondary" className="capitalize text-xs font-semibold px-2 py-0.5">
                                        {summaryLog.entityType}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge className="bg-emerald-50 text-emerald-700 border-none shadow-sm capitalize text-xs font-semibold">
                                        {summaryLog.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Imported</span>
                                    <span className="text-xs font-mono text-muted-foreground">
                                        {summaryLog.startedAt?.toDate ? summaryLog.startedAt.toDate().toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        }) : 'Just now'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between h-20">
                                    <span className="text-xs font-medium text-muted-foreground">Total Records</span>
                                    <span className="text-2xl font-bold tracking-tight">{summaryLog.totalCount || 0}</span>
                                </div>
                                <div className="p-4 rounded-xl bg-emerald-50/20 border border-emerald-50 flex flex-col justify-between h-20">
                                    <span className="text-xs font-medium text-emerald-600">Successfully Imported</span>
                                    <span className="text-2xl font-bold tracking-tight text-emerald-700">{summaryLog.successCount || 0}</span>
                                </div>
                            </div>

                            {/* Conflict Resolution Details (If any duplicates or errors occurred) */}
                            {(summaryLog.duplicateCount > 0 || summaryLog.failedCount > 0 || summaryLog.resolvedDuplicateCount > 0) && (
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolution History</h4>
                                    <div className="space-y-3 rounded-xl border p-4 bg-card">
                                        {summaryLog.duplicateCount > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                        <RefreshCw size={12} className="text-amber-500" />
                                                        Duplicates Resolved
                                                    </span>
                                                    <span>
                                                        {summaryLog.resolvedDuplicateCount || 0} / {summaryLog.duplicateCount}
                                                    </span>
                                                </div>
                                                <Progress 
                                                    value={((summaryLog.resolvedDuplicateCount || 0) / summaryLog.duplicateCount) * 100} 
                                                    className="h-1.5" 
                                                />
                                            </div>
                                        )}

                                        {summaryLog.failedCount === 0 && (
                                            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                                                <CheckCircle2 size={14} className="shrink-0" />
                                                <span>All validation errors have been completely resolved.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <Button onClick={() => setSummaryLogId(null)} className="w-full sm:w-auto rounded-xl">
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
