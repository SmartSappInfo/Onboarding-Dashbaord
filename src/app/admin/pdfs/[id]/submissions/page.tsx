'use client';

import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField, PdfSession } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { 
    ArrowLeft, Eye, Download, Loader2, X, Key, ChevronDown, FileSpreadsheet, Printer, Clock, Users, Trash2, 
    CheckSquare, MoreVertical, FileText, BarChart3, TrendingDown, Target, Share2, Lock, Zap, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, resolveVariableValue, toTitleCase } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { updatePdfResultsSharing, updatePdfFormMapping, deleteSubmissions } from '@/lib/pdf-actions';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';

const pdfjsPromise = import('pdfjs-dist');

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function SubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const pdfId = params.id as string;
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [batchDownloadQueue, setBatchDownloadQueue] = React.useState<string[]>([]);
  const [totalBatchSize, setTotalBatchSize] = React.useState(0);
  const [isProcessingBatch, setIsProcessingBatch] = React.useState(false);
  const [selectedNamingFieldId, setSelectedNamingFieldId] = React.useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [isExportingCSV, setIsExportingCSV] = React.useState(false);

  // Multi-select and Single Delete state
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [submissionToDelete, setSubmissionToDelete] = React.useState<Submission | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const activeTab = searchParams.get('view') || 'list';

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return query(collection(firestore, `pdfs/${pdfId}/submissions`), orderBy('submittedAt', 'desc'));
  }, [firestore, pdfId]);

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return query(collection(firestore, 'pdf_sessions'), where('pdfId', '==', pdfId));
  }, [firestore, pdfId]);

  const { data: pdf, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submissions, isLoading: isLoadingSubmissions } = useCollection<Submission>(submissionsQuery);
  const { data: sessions, isLoading: isLoadingSessions } = useCollection<PdfSession>(sessionsQuery);

  useSetBreadcrumb(pdf?.name, `/admin/pdfs/${pdfId}`);

  const isLoading = isLoadingPdf || isLoadingSubmissions;

  React.useEffect(() => {
    if (pdf && pdf.namingFieldId !== undefined) {
        setSelectedNamingFieldId(pdf.namingFieldId);
    }
  }, [pdf]);

  const displayFields = React.useMemo(() => {
    if (!pdf) return [];
    const keyField = pdf.fields.find(f => f.id === selectedNamingFieldId);
    const result = keyField ? [keyField] : [];
    const otherDisplayIds = (pdf.displayFieldIds || []).filter(id => id !== selectedNamingFieldId);
    const otherFields = otherDisplayIds.map(id => pdf.fields.find(f => f.id === id)).filter(Boolean) as PDFFormField[];
    const finalSet = [...result, ...otherFields];
    if (finalSet.length < 3) {
        const remaining = pdf.fields.filter(f => !finalSet.find(ff => ff.id === f.id) && f.type !== 'signature');
        finalSet.push(...remaining.slice(0, 3 - finalSet.length));
    }
    return finalSet.slice(0, 3);
  }, [pdf, selectedNamingFieldId]);

  const funnelData = React.useMemo(() => {
    if (!sessions || sessions.length === 0 || !pdf) return [];
    const maxPages = pdf.fields.reduce((max, f) => Math.max(max, f.pageNumber), 1);
    const steps = [];
    steps.push({ label: 'Initial Visit', count: sessions.length, color: CHART_COLORS[0] });
    for (let i = 1; i <= maxPages; i++) {
        const count = sessions.filter(s => s.maxPageReached >= i).length;
        if (count > 0 || i === 1) {
            steps.push({ label: `Page ${i}`, count, color: CHART_COLORS[i % CHART_COLORS.length] });
        }
    }
    const submittedCount = sessions.filter(s => s.isSubmitted).length;
    steps.push({ label: 'Signed & Submitted', count: submittedCount, color: '#10b981' });
    return steps.map((s, i) => ({ ...s, percentage: (s.count / sessions.length) * 100 }));
  }, [sessions, pdf]);

  const dropoffInsights = React.useMemo(() => {
    if (funnelData.length < 2) return [];
    const insights = [];
    for (let i = 0; i < funnelData.length - 1; i++) {
        const current = funnelData[i];
        const next = funnelData[i+1];
        const lost = current.count - next.count;
        const lossPercentage = current.count > 0 ? (lost / current.count) * 100 : 0;
        if (lossPercentage > 0) {
            insights.push({ from: current.label, to: next.label, lost, lossPercentage });
        }
    }
    return insights.sort((a, b) => b.lossPercentage - a.lossPercentage);
  }, [funnelData]);

  const handleNamingFieldChange = async (fieldId: string | null) => {
    const newVal = fieldId === 'none' ? null : fieldId;
    setSelectedNamingFieldId(newVal);
    if (pdf && firestore) {
        const keyField = pdf.fields.find(f => f.id === newVal);
        const result = keyField ? [keyField] : [];
        const otherDisplayIds = (pdf.displayFieldIds || []).filter(id => id !== newVal);
        const otherFields = otherDisplayIds.map(id => pdf.fields.find(f => f.id === id)).filter(Boolean) as PDFFormField[];
        const finalSet = [...result, ...otherFields];
        if (finalSet.length < 3) {
            const remaining = pdf.fields.filter(f => !finalSet.find(ff => ff.id === f.id) && f.type !== 'signature');
            finalSet.push(...remaining.slice(0, 3 - finalSet.length));
        }
        const newDisplayFieldIds = finalSet.slice(0, 3).map(f => f.id);
        await updatePdfFormMapping(pdf.id, {
            fields: pdf.fields,
            namingFieldId: newVal,
            displayFieldIds: newDisplayFieldIds,
            password: pdf.password,
            passwordProtected: pdf.passwordProtected,
        });
        toast({ title: 'Naming Field Updated' });
    }
  };

  const getSubmissionFileName = React.useCallback((submission: Submission) => {
    if (!pdf) return 'document.pdf';
    let keyFieldValue = '';
    const namingField = pdf.fields.find(f => f.id === selectedNamingFieldId);
    if (namingField) keyFieldValue = submission.formData[namingField.id] || '';
    if (!keyFieldValue) {
        const firstField = displayFields[0];
        keyFieldValue = firstField ? submission.formData[firstField.id] : '';
    }
    if (!keyFieldValue) keyFieldValue = submission.id.substring(0, 8);
    const fileName = `${keyFieldValue} - ${pdf.name}`;
    return `${fileName.replace(/[^a-z0-9\s-]/gi, '_').trim().substring(0, 100)}.pdf`;
  }, [pdf, selectedNamingFieldId, displayFields]);

  const handleDownloadClick = (submissionId: string) => {
    if (downloadingId || isProcessingBatch) return;
    toast({ title: 'Preparing download...' });
    setDownloadingId(submissionId);
  };

  const handleDownloadSelected = () => {
    if (selectedIds.length === 0 || isProcessingBatch) return;
    setTotalBatchSize(selectedIds.length);
    setBatchDownloadQueue(selectedIds);
    setIsProcessingBatch(true);
    setDownloadingId(selectedIds[0]);
    toast({ title: 'Batch Download Started', description: `Processing ${selectedIds.length} documents...` });
  };

  const handleDownloadAll = () => {
    if (!submissions || submissions.length === 0 || isProcessingBatch) return;
    const ids = submissions.map(s => s.id);
    setTotalBatchSize(ids.length);
    setBatchDownloadQueue(ids);
    setIsProcessingBatch(true);
    setDownloadingId(ids[0]);
    toast({ title: 'Batch Download Started', description: `Processing ${ids.length} documents...` });
  };

  const onDownloadFinished = React.useCallback((success: boolean, blobUrl?: string) => {
    setTimeout(() => {
        if (isProcessingBatch) {
            setBatchDownloadQueue(prev => {
                const nextQueue = prev.slice(1);
                if (nextQueue.length > 0) {
                    setDownloadingId(nextQueue[0]);
                } else {
                    setIsProcessingBatch(false);
                    setDownloadingId(null);
                    setTotalBatchSize(0);
                    toast({ title: 'Batch Download Complete' });
                }
                return nextQueue;
            });
        } else {
            setDownloadingId(null);
            if (success) {
                toast({ 
                    title: 'Download Ready', 
                    action: blobUrl ? <ToastAction altText="Open" asChild><a href={blobUrl} target="_blank" rel="noopener noreferrer">Open</a></ToastAction> : undefined
                });
            }
        }
    }, 0);
  }, [isProcessingBatch, toast]);

  const handleCancelBatch = () => {
    setBatchDownloadQueue([]);
    setDownloadingId(null);
    setIsProcessingBatch(false);
    setTotalBatchSize(0);
    toast({ title: 'Download Cancelled', variant: 'secondary' });
  };

  const handleExportCSV = () => {
    if (!submissions || !pdf) return;
    setIsExportingCSV(true);
    try {
        const dataFields = pdf.fields.filter(f => f.type !== 'signature');
        const headers = ["Submission ID", "Submitted At", ...dataFields.map(f => f.label || f.id)];
        const csvRows = [headers.join(",")];
        submissions.forEach(sub => {
            const row = [
                sub.id,
                format(new Date(sub.submittedAt), "yyyy-MM-dd HH:mm:ss"),
                ...dataFields.map(f => {
                    const val = sub.formData[f.id] || "";
                    return `"${String(val).replace(/"/g, '""')}"`;
                })
            ];
            csvRows.push(row.join(","));
        });
        const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${pdf.slug || pdf.id}_submissions_${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "CSV Export Started" });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExportingCSV(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    const idsToDelete = submissionToDelete ? [submissionToDelete.id] : selectedIds;
    if (idsToDelete.length === 0 || !user || !pdf) return;
    setIsDeletingSelected(true);
    try {
        const result = await deleteSubmissions(pdf.id, idsToDelete, user.uid);
        if (result.success) {
            toast({ title: 'Submissions Deleted', description: `${idsToDelete.length} records have been removed.` });
            if (submissionToDelete) setSubmissionToDelete(null);
            else setSelectedIds([]);
        } else {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error' });
    } finally {
        setIsDeletingSelected(false);
        setShowDeleteConfirm(false);
    }
  };

  const toggleSelectAll = () => {
    if (!submissions) return;
    if (selectedIds.length === submissions.length) setSelectedIds([]);
    else setSelectedIds(submissions.map(s => s.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const currentBatchIndex = isProcessingBatch ? totalBatchSize - batchDownloadQueue.length + 1 : 0;

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/10 text-left">
        <Tabs value={activeTab} onValueChange={(v) => router.push(`${pathname}?view=${v}`)} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl w-fit">
                    <TabsTrigger value="list" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2">
                        <FileText className="h-4 w-4" /> Submission Log
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2">
                        <BarChart3 className="h-4 w-4" /> Funnel Analytics
                    </TabsTrigger>
                </TabsList>

                {!isLoading && activeTab === 'list' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {selectedIds.length > 0 ? (
                            <Card className="bg-primary/5 border-primary/20 animate-in slide-in-from-top-2 overflow-hidden rounded-xl">
                                <CardContent className="p-2 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 px-3">
                                        <CheckSquare className="h-5 w-5 text-primary" />
                                        <span className="text-sm font-bold text-primary">{selectedIds.length} Selected</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" onClick={handleDownloadSelected} disabled={isProcessingBatch || !!downloadingId} className="h-9 font-bold px-4">
                                            <Download className="h-4 w-4 mr-2" /> Download
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="h-9 px-4 font-bold">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-9"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-10 rounded-xl font-bold border-primary/20 hover:bg-primary/5 text-primary gap-2">
                                    <FileSpreadsheet className="h-4 w-4" /> Export CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)} className="h-10 rounded-xl font-bold border-primary/20 hover:bg-primary/5 text-primary gap-2">
                                    <Share2 className="h-4 w-4" /> Share Portal
                                </Button>
                                {submissions && submissions.length > 0 && (
                                    <ButtonGroup className="shadow-lg">
                                        <Button onClick={handleDownloadAll} disabled={isProcessingBatch || !!downloadingId} className="h-10 px-6 font-black uppercase text-[10px] tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 rounded-l-xl">
                                            {isProcessingBatch ? (
                                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing ({batchDownloadQueue.length})</>
                                            ) : (
                                                <><Download className="h-4 w-4 mr-2" /> Download All</>
                                            )}
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="default" size="icon" className="h-10 w-10 border-l border-primary-foreground/20 rounded-l-none bg-primary text-primary-foreground" disabled={isProcessingBatch}>
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-2xl">
                                                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground p-3">Filename Reference</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleNamingFieldChange(null)} className={cn("text-xs py-2.5", !selectedNamingFieldId && "bg-accent font-bold")}>Default (Document ID)</DropdownMenuItem>
                                                {pdf?.fields.filter(f => f.type !== 'signature').map(field => (
                                                    <DropdownMenuItem key={field.id} onClick={() => handleNamingFieldChange(field.id)} className={cn("text-xs py-2.5 flex items-center justify-between", selectedNamingFieldId === field.id && "bg-accent font-bold")}>
                                                        {field.label || field.id}
                                                        {selectedNamingFieldId === field.id && <Key className="h-3 w-3 text-primary" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </ButtonGroup>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <TabsContent value="list" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-card shadow-sm border-border/50 rounded-xl">
                        <CardContent className="p-4 flex items-center gap-4 text-left">
                            <div className="bg-primary/10 p-2.5 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 leading-none">Total Signatures</p>
                                <p className="text-2xl font-black">{isLoading ? '...' : submissions?.length || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card shadow-sm border-border/50 rounded-xl">
                        <CardContent className="p-4 flex items-center gap-4 text-left">
                            <div className="bg-green-500/10 p-2.5 rounded-xl text-green-600"><Clock className="h-5 w-5" /></div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 leading-none">Last Signature</p>
                                <p className="text-sm font-bold truncate">
                                    {isLoading ? '...' : submissions?.[0] ? formatDistanceToNow(new Date(submissions[0].submittedAt), { addSuffix: true }) : 'No activity'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-transparent">
                                <TableHead className="w-[50px] pl-6">
                                    <Checkbox checked={submissions?.length ? selectedIds.length === submissions.length : false} onCheckedChange={toggleSelectAll} />
                                </TableHead>
                                {displayFields.map((field) => (
                                    <TableHead key={field.id} className="text-[10px] font-black uppercase tracking-widest py-4">
                                        <div className="flex items-center gap-1.5">
                                            {field.label || 'Field'}
                                            {field.id === selectedNamingFieldId && <Key className="h-3 w-3 text-primary" />}
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Submitted At</TableHead>
                                <TableHead className="w-[120px] text-right py-4 pr-6 text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={displayFields.length + 3}><Skeleton className="h-12 w-full rounded-lg" /></TableCell></TableRow>
                            )) : submissions?.length ? submissions.map((submission) => (
                                <TableRow key={submission.id} className={cn("group hover:bg-muted/30 transition-colors", selectedIds.includes(submission.id) && "bg-primary/5")}>
                                    <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(submission.id)} onCheckedChange={() => toggleSelect(submission.id)} /></TableCell>
                                    {displayFields.map((field, idx) => {
                                        const value = submission.formData[field.id];
                                        const applyTransform = (val: string) => {
                                            if (field.textTransform === 'uppercase') return val.toUpperCase();
                                            if (field.textTransform === 'capitalize') return toTitleCase(val);
                                            return val;
                                        };
                                        const content = field.type === 'signature' ? (
                                            <div className="h-8 w-16 relative bg-muted/50 rounded border border-border/50 overflow-hidden">{value && <img src={value} alt="S" className="w-full h-full object-contain" />}</div>
                                        ) : <span className="truncate max-w-[200px] block font-bold text-sm">{value ? applyTransform(String(value)) : <span className="text-muted-foreground font-normal italic opacity-50">—</span>}</span>;
                                        const dynamicFontSize = `${Math.round((field.fontSize || 11) * 1.5)}px`;
                                        const verticalAlign = field.verticalAlignment || 'center';
                                        return (
                                            <TableCell key={field.id}>
                                                <div className="flex flex-col justify-center min-h-[40px]" style={{ fontSize: dynamicFontSize, justifyContent: verticalAlign === 'center' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start' }}>
                                                    {idx === 0 ? <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`} className="hover:text-primary hover:underline">{content}</Link> : content}
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-muted-foreground text-xs font-medium uppercase tabular-nums">
                                        {format(new Date(submission.submittedAt), 'MMM d, yyyy · p')}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
                                                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Entry Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild className="rounded-lg p-2.5 gap-3">
                                                        <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                                            <Eye className="h-4 w-4 text-primary" />
                                                            <span className="font-bold text-sm">View Detail</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadClick(submission.id)} className="rounded-lg p-2.5 gap-3">
                                                        <Download className="h-4 w-4 text-primary" />
                                                        <span className="font-bold text-sm">Download PDF</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setSubmissionToDelete(submission)} className="rounded-lg p-2.5 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="font-bold text-sm">Delete Record</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={displayFields.length + 3} className="h-64 text-center text-muted-foreground font-medium italic">No submission records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="analytics" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Public Reach" value={sessions?.length || 0} sub="Unique Page Loads" icon={Eye} color="text-primary" bg="bg-primary/10" />
                    <StatCard label="Engagement" value={sessions?.filter(s => s.maxPageReached > 1).length || 0} sub="Scrolled Past Page 1" icon={TrendingDown} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Conversion" value={submissions?.length || 0} sub="Completed Signatures" icon={Target} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Performance" value={`${sessions?.length ? Math.round(((submissions?.length || 0) / sessions.length) * 100) : 0}%`} sub="Completion Velocity" icon={Zap} color="text-orange-600" bg="bg-orange-50" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" /> Document Progression Funnel
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Visualizing scroll depth and signing retention.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 h-[350px]">
                            {funnelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 100 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} fontSize={10} width={100} tick={{ fontWeight: 'black' }} />
                                        <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return <div className="rounded-xl border bg-background p-3 shadow-2xl text-xs space-y-1"><p className="font-black uppercase tracking-widest">{d.label}</p><p className="text-primary font-bold">{d.count} Users Reached</p><p className="text-muted-foreground">{d.percentage.toFixed(1)}% of total traffic</p></div>;
                                            }
                                            return null;
                                        }} />
                                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                                            {funnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />)}
                                            <LabelList dataKey="count" position="right" content={(props: any) => {
                                                const { x, y, width, height, value, index } = props;
                                                const pct = funnelData[index].percentage;
                                                return <text x={x + width + 10} y={y + height / 2 + 4} className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground opacity-60">{value} ({pct.toFixed(0)}%)</text>;
                                            }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 gap-3"><BarChart3 className="h-12 w-12" /><p className="font-black uppercase text-[10px] tracking-widest">Collecting Engagement Pulse...</p></div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Drop-off Audit</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {dropoffInsights.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow className="hover:bg-transparent bg-muted/20"><TableHead className="pl-8 py-4 text-[9px] font-black uppercase">Transition</TableHead><TableHead className="text-right pr-8 py-4 text-[9px] font-black uppercase">Loss %</TableHead></TableRow></TableHeader>
                                    <TableBody>{dropoffInsights.slice(0, 5).map((insight, idx) => (
                                        <TableRow key={insight.from + insight.to} className="group transition-colors"><TableCell className="pl-8 py-4"><p className="text-[10px] font-bold text-foreground leading-tight">{insight.from} → {insight.to}</p><p className="text-[9px] text-muted-foreground uppercase mt-0.5">{insight.lost} Signers Lost</p></TableCell><TableCell className="text-right pr-8 py-4"><Badge variant="outline" className={cn("h-5 text-[9px] font-black uppercase border-none", insight.lossPercentage > 30 ? "bg-rose-50 text-rose-600" : "bg-orange-50 text-orange-600")}>{insight.lossPercentage.toFixed(0)}%</Badge></TableCell></TableRow>
                                    ))}</TableBody>
                                </Table>
                            ) : (
                                <div className="py-32 text-center opacity-20 space-y-3"><CheckCircle2 className="h-10 w-10 mx-auto" /><p className="text-[10px] font-black uppercase tracking-widest">No Significant Drop-offs</p></div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>

        <AlertDialog open={showDeleteConfirm || !!submissionToDelete} onOpenChange={(o) => { if(!o) { setShowDeleteConfirm(false); setSubmissionToDelete(null); } }}>
            <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogHeader><div className="mx-auto bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><AlertCircle className="h-6 w-6 text-destructive" /></div><AlertDialogTitle className="font-black text-xl uppercase tracking-tight text-center">{submissionToDelete ? 'Purge Signed Document?' : `Purge ${selectedIds.length} Records?`}</AlertDialogTitle><AlertDialogDescription className="text-center text-sm font-medium">This will permanently delete the {submissionToDelete ? 'selected submission record' : 'selected records'} and the associated high-fidelity signed document. This action is immutable and cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter className="mt-4 sm:justify-center gap-3"><AlertDialogCancel disabled={isDeletingSelected} className="rounded-xl font-bold px-8">Keep Records</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirmed} disabled={isDeletingSelected} className="rounded-xl font-black px-10 shadow-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95">{isDeletingSelected ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}Confirm Deletion</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {pdf && <ShareResultsDialog pdf={pdf} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />}

        {downloadingId && pdf && (
            <HighFidelityDownloader 
                pdfForm={pdf} submissionId={downloadingId} fileName={getSubmissionFileName(submissions?.find(s => s.id === downloadingId) || { id: downloadingId, formData: {} } as Submission)}
                batchProgress={isProcessingBatch ? { current: currentBatchIndex, total: totalBatchSize } : undefined}
                onFinished={onDownloadFinished} onCancel={handleCancelBatch}
            />
        )}
      </div>
    </TooltipProvider>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}><Icon className="h-7 w-7" /></div>
                <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p><p className="text-3xl font-black tabular-nums tracking-tighter">{value}</p><p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1">{sub}</p></div>
            </CardContent>
        </Card>
    );
}

function ShareResultsDialog({ pdf, open, onOpenChange }: { pdf: PDFForm; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isShared, setIsShared] = React.useState(!!pdf.resultsShared);
    const [password, setPassword] = React.useState(pdf.resultsPassword || '');
    const [isSaving, setIsSaving] = React.useState(false);
    const handleSave = async () => {
        setIsSaving(true);
        const result = await updatePdfResultsSharing(pdf.id, { shared: isShared, password });
        if (result.success) { toast({ title: 'Share Settings Updated' }); onOpenChange(false); }
        else { toast({ variant: 'destructive', title: 'Update Failed' }); }
        setIsSaving(false);
    };
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/forms/results/${pdf.slug || pdf.id}` : '';
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0"><DialogTitle className="text-2xl font-black uppercase tracking-tight">Share Records Portal</DialogTitle><DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Allow stakeholders to view and audit submissions.</DialogDescription></DialogHeader>
                <div className="space-y-8 p-8"><div className={cn("flex items-center justify-between rounded-[1.5rem] border-2 transition-all p-5 shadow-sm", isShared ? "border-primary/20 bg-primary/5" : "border-border/50 bg-muted/30")}><div className="flex items-center gap-4"><div className={cn("p-3 rounded-xl shadow-inner", isShared ? "bg-primary text-white" : "bg-muted text-muted-foreground")}><Share2 className="h-5 w-5" /></div><div className="space-y-0.5"><Label className="text-sm font-black uppercase tracking-tight leading-none">Public Access</Label><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Enable record viewing via link</p></div></div><Switch checked={isShared} onCheckedChange={setIsShared} className="scale-110" /></div><AnimatePresence>{isShared && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-6 animate-in fade-in slide-in-from-top-2"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 ml-1"><Lock className="h-3 w-3 text-primary" /> Entry Authentication</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required for access..." className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Portal URL</Label><div className="flex items-center gap-2"><Input value={shareUrl} readOnly className="text-[10px] bg-muted/30 h-12 font-mono rounded-xl border-none shadow-inner px-4 flex-1" /><Button size="icon" variant="outline" className="h-12 w-12 shrink-0 rounded-xl shadow-lg border-primary/20 hover:bg-primary/5 text-primary" onClick={() => { navigator.clipboard.writeText(shareUrl); toast({ title: 'Link Copied' }); }}><Copy className="h-5 w-5" /></Button></div></div></motion.div>)}</AnimatePresence></div>
                <DialogFooter className="p-6 border-t bg-muted/30 flex justify-between sm:justify-between items-center"><Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl px-8 h-12">Cancel</Button><Button onClick={handleSave} disabled={isSaving} className="font-black rounded-xl px-12 shadow-2xl h-12 uppercase tracking-widest text-sm">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Apply Logic</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HighFidelityDownloader({ 
    pdfForm, 
    submissionId, 
    fileName, 
    batchProgress, 
    onFinished, 
    onCancel 
}: { 
    pdfForm: PDFForm, 
    submissionId: string, 
    fileName: string, 
    batchProgress?: { current: number, total: number },
    onFinished: (success: boolean, url?: string) => void, 
    onCancel: () => void 
}) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const submissionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, `pdfs/${pdfForm.id}/submissions`, submissionId);
    }, [firestore, pdfForm.id, submissionId]);
    const { data: submission, isLoading } = useDoc<Submission>(submissionRef);
    const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const loadPdf = async () => {
            try {
                const pdfjs = await pdfjsPromise;
                const pdfjsVersion = '4.4.168';
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
                const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
                const loadedPdf = await loadingTask.promise;
                setPdfDoc(loadedPdf);
            } catch (e) {
                setTimeout(() => toast({ variant: 'destructive', title: 'Rendering Error' }), 0);
                onFinished(false);
            }
        };
        loadPdf();
    }, [pdfForm.downloadUrl, onFinished, toast]);
    const handleGenerate = React.useCallback(async () => {
        if (isCapturing || !containerRef.current) return;
        setIsCapturing(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { PDFDocument } = await import('pdf-lib');
            const pdfBundle = await PDFDocument.create();
            const pageWrappers = containerRef.current.querySelectorAll('.page-capture-wrapper');
            if (!pageWrappers.length) throw new Error("No pages rendered.");
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            for (let i = 0; i < pageWrappers.length; i++) {
                const el = pageWrappers[i] as HTMLElement;
                const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
                const image = await pdfBundle.embedJpg(imgBytes);
                const page = pdfBundle.addPage([595.28, 841.89]);
                page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
            }
            const pdfBytes = await pdfBundle.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            if (!batchProgress) {
                if (isIOS) window.location.assign(url);
                else {
                    const a = document.createElement('a'); a.href = url; a.download = fileName;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }
            }
            onFinished(true, url);
        } catch (e: any) {
            onFinished(false);
        } finally { setIsCapturing(false); }
    }, [fileName, onFinished, isCapturing, batchProgress]);
    React.useEffect(() => {
        if (pdfDoc && submission && !isCapturing) {
            const timer = setTimeout(() => { handleGenerate(); }, 1500);
            return () => clearTimeout(timer);
        }
    }, [pdfDoc, submission, handleGenerate, isCapturing]);
    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b shrink-0 bg-card shadow-sm"><div className="flex items-center gap-3 text-left"><Loader2 className="h-5 w-5 animate-spin text-primary" /><div><h2 className="text-lg font-bold">{batchProgress ? `Processing Document ${batchProgress.current} of ${batchProgress.total}` : 'Generating Signed Document'}</h2><p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Capturing high-fidelity pages...</p></div></div><Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full"><X className="h-5 w-5" /></Button></div>
            {batchProgress && (<div className="w-full h-1.5 bg-muted"><div className="h-full bg-primary transition-all duration-500 ease-in-out" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}/></div>)}
            <div className="flex-1 overflow-hidden relative"><ScrollArea className="h-full w-full"><div ref={containerRef} className="p-8 flex flex-col items-center min-w-full">{(!pdfDoc || isLoading) ? (<div className="flex flex-col gap-8"><Skeleton className="w-[8.5in] h-[11in] bg-white shadow-xl rounded-lg" /></div>) : (<div className="flex flex-col gap-8 pb-20">{Array.from({ length: pdfDoc.numPages }).map((_, index) => (<div key={index} className="page-capture-wrapper"><SilentPageRenderer pdf={pdfDoc} pageNumber={index + 1} fields={pdfForm.fields} formData={submission?.formData || {}} /></div>))}</div>)}</div><ScrollBar orientation="horizontal" /></ScrollArea></div>
            <div className="p-4 border-t bg-card text-center print:hidden"><Button variant="outline" size="sm" onClick={onCancel} className="font-bold border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive">Stop Operation</Button></div>
        </div>
    );
}

function SilentPageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);
    React.useEffect(() => {
        let isCancelled = false;
        const render = async () => {
            setIsRendering(true);
            try {
                if (renderTaskRef.current) renderTaskRef.current.cancel();
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
                if (isCancelled) return;
                setDimensions({ width: viewport.width, height: viewport.height });
                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height; canvas.width = viewport.width;
                        const renderTask = page.render({ canvasContext: context, viewport });
                        renderTaskRef.current = renderTask;
                        await renderTask.promise;
                    }
                }
            } catch (e: any) {
                if (e.name === 'RenderingCancelledException') return;
            } finally {
                if (!isCancelled) setIsRendering(false);
            }
        };
        render();
        return () => { isCancelled = true; if (renderTaskRef.current) renderTaskRef.current.cancel(); };
    }, [pdf, pageNumber]);
    return (
        <div className="relative mx-auto shadow-2xl bg-white border border-border flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const storedValue = formData[field.id];
                        let value = storedValue;
                        if (value === undefined || value === null) {
                            if (field.type === 'static-text') value = field.staticText;
                            else if (field.type === 'variable') value = `{{${field.variableKey}}}`;
                        }
                        if (!value) return null;
                        const applyTransform = (val: string) => {
                            if (field.textTransform === 'uppercase') return val.toUpperCase();
                            if (field.textTransform === 'capitalize') return toTitleCase(val);
                            return val;
                        };
                        const dynamicFontSize = `${Math.round((field.fontSize || 11) * 1.5)}px`;
                        const verticalAlign = field.verticalAlignment || 'center';
                        return (
                            <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`, display: 'flex', flexDirection: 'column', justifyContent: verticalAlign === 'center' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start', alignItems: field.alignment === 'center' ? 'center' : field.alignment === 'right' ? 'flex-end' : 'flex-start' }}>
                                {field.type === 'signature' ? <img src={value} alt="S" className="w-full h-full object-contain" crossOrigin="anonymous" /> : <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold text-black" : "font-medium text-black/80")} style={{ fontSize: dynamicFontSize, textAlign: field.alignment || 'left' }}>{field.type === 'date' && value ? format(new Date(value), 'PPP') : applyTransform(String(value || ''))}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}