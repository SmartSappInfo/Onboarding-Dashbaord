'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { 
    ArrowLeft, Eye, Download, Loader2, X, Key, ChevronDown, Share2, 
    Copy, Lock, FileSpreadsheet, Printer, Clock, Users, Trash2, 
    CheckSquare, MoreVertical, FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
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

const pdfjsPromise = import('pdfjs-dist');

export default function SubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const pdfId = params.id as string;
  const { toast } = useToast();
  
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [batchDownloadQueue, setBatchDownloadQueue] = React.useState<string[]>([]);
  const [totalBatchSize, setTotalBatchSize] = React.useState(0);
  const [isProcessingBatch, setIsProcessingBatch] = React.useState(false);
  const [selectedNamingFieldId, setSelectedNamingFieldId] = React.useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [isExportingCSV, setIsExportingCSV] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return query(collection(firestore, `pdfs/${pdfId}/submissions`), orderBy('submittedAt', 'desc'));
  }, [firestore, pdfId]);

  const { data: pdf, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submissions, isLoading: isLoadingSubmissions } = useCollection<Submission>(submissionsQuery);

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

  const handleExportPDF = async () => {
    if (!submissions || !pdf || isExportingPDF) return;
    setIsExportingPDF(true);
    
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { PDFDocument } = await import('pdf-lib');
        
        const A4_WIDTH = 794;
        const A4_HEIGHT = 1123;
        const ROWS_PER_PAGE = 18;

        const pdfDoc = await PDFDocument.create();
        const rowChunks = [];
        for (let i = 0; i < submissions.length; i += ROWS_PER_PAGE) {
            rowChunks.push(submissions.slice(i, i + ROWS_PER_PAGE));
        }

        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '-9999px';
        exportContainer.style.width = `${A4_WIDTH}px`;
        document.body.appendChild(exportContainer);

        for (let pageIdx = 0; pageIdx < rowChunks.length; pageIdx++) {
            const chunk = rowChunks[pageIdx];
            
            const pageEl = document.createElement('div');
            pageEl.className = "p-10 bg-white text-black font-sans";
            pageEl.style.width = `${A4_WIDTH}px`;
            pageEl.style.minHeight = `${A4_HEIGHT}px`;
            pageEl.style.boxSizing = 'border-box';

            if (pageIdx === 0) {
                const headerHtml = `
                    <div class="mb-8 border-b-2 pb-4 border-gray-200">
                        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">Submission Report</h1>
                        <h2 class="text-xl font-bold text-primary mt-1">${pdf.name}</h2>
                        <div class="flex justify-between items-end mt-4">
                            <p class="text-xs text-gray-500 font-medium">Generated: ${format(new Date(), "PPPP 'at' p")}</p>
                            <p class="text-xs font-bold text-gray-700">${submissions.length} total records</p>
                        </div>
                    </div>
                `;
                pageEl.innerHTML += headerHtml;
            } else {
                pageEl.innerHTML += `<div class="mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Page ${pageIdx + 1} of ${rowChunks.length}</div>`;
            }

            let tableHtml = `
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-primary text-white">
                            ${displayFields.map(f => `<th class="p-3 text-[10px] font-black uppercase text-left border border-primary">${f.label || 'Field'}</th>`).join('')}
                            <th class="p-3 text-[10px] font-black uppercase text-left border border-primary">Submission Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chunk.map(sub => `
                            <tr class="border-b border-gray-200">
                                ${displayFields.map(f => {
                                    const val = sub.formData[f.id];
                                    if (f.type === 'signature') {
                                        return `<td class="p-2 border border-gray-100 h-12"><div class="h-full flex items-center justify-center">${val ? `<img src="${val}" style="max-height: 40px; object-fit: contain;" />` : '-'}</div></td>`;
                                    }
                                    return `<td class="p-3 text-xs text-gray-800 font-medium border border-gray-100 break-words">${val || '-'}</td>`;
                                }).join('')}
                                <td class="p-3 text-[10px] text-gray-500 border border-gray-100">${format(new Date(sub.submittedAt), 'MMM d, yyyy p')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            pageEl.innerHTML += tableHtml;

            if (pageIdx === rowChunks.length - 1) {
                pageEl.innerHTML += `<div class="mt-12 pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400 font-medium">© ${new Date().getFullYear()} SmartSapp Onboarding Workspace</div>`;
            }

            exportContainer.appendChild(pageEl);

            const canvas = await html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: 'white',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedJpg(imgBytes);
            
            const page = pdfDoc.addPage([595.28, 841.89]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: 595.28,
                height: 841.89,
            });

            exportContainer.removeChild(pageEl);
        }

        document.body.removeChild(exportContainer);

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${pdf.name.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({ title: 'PDF Report Generated' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExportingPDF(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0 || !user || !pdf) return;
    setIsDeletingSelected(true);
    try {
        const result = await deleteSubmissions(pdf.id, selectedIds, user.uid);
        if (result.success) {
            toast({ title: 'Submissions Deleted', description: `${selectedIds.length} records have been removed.` });
            setSelectedIds([]);
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
    if (selectedIds.length === submissions.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(submissions.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const currentBatchIndex = isProcessingBatch ? totalBatchSize - batchDownloadQueue.length + 1 : 0;

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/10">
        <div className="space-y-1 min-w-0 mb-6">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground" onClick={() => router.push('/admin/pdfs')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Documents</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate pr-4" title={pdf?.name}>
            {isLoadingPdf ? <Skeleton className="h-10 w-64" /> : `Submissions: ${pdf?.name}`}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">Manage and export signed document records.</p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card shadow-sm border-border/50 rounded-xl">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-xl">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Total Records</p>
                        <p className="text-2xl font-black text-foreground">{isLoading ? '...' : submissions?.length || 0}</p>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card shadow-sm border-border/50 rounded-xl">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-green-500/10 p-2.5 rounded-xl">
                        <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Last Active</p>
                        <p className="text-sm font-bold text-foreground">
                            {isLoading ? '...' : submissions?.[0] ? formatDistanceToNow(new Date(submissions[0].submittedAt), { addSuffix: true }) : 'No activity'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Actions Bar */}
        {!isLoading && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
                {selectedIds.length > 0 ? (
                    <Card className="bg-primary/5 border-primary/20 w-full animate-in slide-in-from-top-2">
                        <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckSquare className="h-5 w-5 text-primary" />
                                <span className="text-sm font-bold text-primary">{selectedIds.length} selected</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleDownloadSelected} disabled={isProcessingBatch || !!downloadingId} className="h-9 px-3 sm:px-4 font-bold">
                                    <Download className="h-4 w-4 sm:mr-2" /> 
                                    <span className="hidden sm:inline">Download</span>
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="h-9 px-3 sm:px-4 font-bold">
                                    <Trash2 className="h-4 w-4 sm:mr-2" /> 
                                    <span className="hidden sm:inline">Delete</span>
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-9">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 sm:h-10 px-3 sm:px-4 sm:gap-2 shadow-sm" disabled={isExportingCSV || isExportingPDF}>
                                    {isExportingCSV || isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                                    <span className="hidden sm:inline">Export List</span>
                                    <span className="sm:hidden">Export</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={handleExportCSV} disabled={isExportingCSV}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Export to Excel (CSV)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportPDF} disabled={isExportingPDF}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Export to PDF Report
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)} className="h-9 sm:h-10 px-3 sm:px-4 sm:gap-2 shadow-sm">
                            <Share2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Share Portal</span>
                            <span className="sm:hidden">Share</span>
                        </Button>
                        
                        {submissions && submissions.length > 0 && (
                            <ButtonGroup className="shadow-sm">
                                <Button onClick={handleDownloadAll} disabled={isProcessingBatch || !!downloadingId} className="h-9 sm:h-10 px-3 sm:px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                                    {isProcessingBatch ? (
                                        <><Loader2 className="h-4 w-4 animate-spin sm:mr-2" /><span className="hidden sm:inline">Processing ({batchDownloadQueue.length} left)</span><span className="sm:hidden">{batchDownloadQueue.length}</span></>
                                    ) : (
                                        <><Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Download All PDFs</span><span className="sm:hidden">All</span></>
                                    )}
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="default" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 border-l border-primary-foreground/20 rounded-l-none bg-primary text-primary-foreground" disabled={isProcessingBatch}>
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64">
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground p-3">Filename Identifier</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleNamingFieldChange(null)} className={cn("text-xs py-2.5", !selectedNamingFieldId && "bg-accent font-bold")}>Default (Document Name)</DropdownMenuItem>
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

        {/* List View: Desktop Table */}
        <div className="hidden md:block rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="w-[50px] pl-6">
                    <Checkbox 
                        checked={submissions?.length ? selectedIds.length === submissions.length : false} 
                        onCheckedChange={toggleSelectAll} 
                    />
                </TableHead>
                {displayFields.map((field) => (
                  <TableHead key={field.id} className="text-[10px] font-black uppercase tracking-widest py-4">
                      <div className="flex items-center gap-1.5">
                        {field.label || 'Unnamed Field'}
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
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    {Array.from({ length: 3 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-32" /></TableCell>)}
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                )) : submissions && submissions.length > 0 ? submissions.map((submission) => (
                  <TableRow key={submission.id} className={cn("group hover:bg-muted/30 transition-colors", selectedIds.includes(submission.id) && "bg-primary/5")}>
                    <TableCell className="pl-6">
                        <Checkbox 
                            checked={selectedIds.includes(submission.id)} 
                            onCheckedChange={() => toggleSelect(submission.id)} 
                        />
                    </TableCell>
                    {displayFields.map((field, idx) => {
                      const value = submission.formData[field.id];
                      const content = field.type === 'signature' ? (
                        <div className="h-8 w-16 relative bg-muted/50 rounded border border-border/50 overflow-hidden">{value && <img src={value} alt="Sig" className="h-full w-full object-contain" />}</div>
                      ) : <span className="truncate max-w-[200px] block font-medium">{value || <span className="text-muted-foreground font-normal italic opacity-50">—</span>}</span>;
                      return (
                        <TableCell key={field.id}>
                          {idx === 0 ? (
                              <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`} className="inline-flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                                {content}
                              </Link>
                          ) : content}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-muted-foreground text-xs font-medium">
                        {format(new Date(submission.submittedAt), 'MMM d, yyyy · p')}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                <Eye className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDownloadClick(submission.id)} disabled={!!downloadingId && downloadingId !== submission.id}>
                            {downloadingId === submission.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                <TableRow>
                  <TableCell colSpan={displayFields.length + 3} className="h-48 text-center text-muted-foreground">No submissions yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="grid gap-4 md:hidden">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
            ) : submissions && submissions.length > 0 ? (
                submissions.map((submission) => {
                    const namingField = displayFields.find(f => f.id === selectedNamingFieldId) || displayFields[0];
                    const namingValue = submission.formData[namingField?.id] || 'Unnamed Submission';
                    const secondaryFields = displayFields.filter(f => f.id !== namingField?.id);

                    return (
                        <Card key={submission.id} className={cn(
                            "relative overflow-hidden transition-all",
                            selectedIds.includes(submission.id) ? "ring-2 ring-primary bg-primary/5 shadow-md" : "bg-card border-border/50"
                        )}>
                            <div className="absolute top-3 left-3 z-10">
                                <Checkbox 
                                    checked={selectedIds.includes(submission.id)} 
                                    onCheckedChange={() => toggleSelect(submission.id)} 
                                    className="bg-background"
                                />
                            </div>
                            <CardHeader className="pl-10 pt-4 pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 pr-2">
                                        <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`} className="block">
                                            <CardTitle className="text-lg font-black truncate leading-tight group-hover:text-primary transition-colors">
                                                {namingValue}
                                            </CardTitle>
                                        </Link>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdfId}/submissions/${submission.id}`)}>
                                                <Eye className="mr-2 h-4 w-4" /> View Full Detail
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDownloadClick(submission.id)}>
                                                <Download className="mr-2 h-4 w-4" /> Download PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="pl-10 pb-4 space-y-3">
                                {secondaryFields.map(field => (
                                    <div key={field.id} className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">{field.label || 'Field'}</p>
                                        <div className="text-sm font-medium truncate">
                                            {field.type === 'signature' ? (
                                                <div className="h-6 w-12 relative bg-muted rounded overflow-hidden">
                                                    {submission.formData[field.id] && <img src={submission.formData[field.id]} alt="sig" className="h-full w-full object-contain" />}
                                                </div>
                                            ) : (
                                                submission.formData[field.id] || <span className="text-muted-foreground italic opacity-50">—</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                            <CardFooter className="bg-muted/30 p-2 flex gap-2">
                                <Button variant="ghost" size="sm" className="flex-1 h-9 font-bold text-xs" asChild>
                                    <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                        <Eye className="h-3.5 w-3.5 mr-2" /> View
                                    </Link>
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="flex-1 h-9 font-bold text-xs"
                                    onClick={() => handleDownloadClick(submission.id)}
                                    disabled={!!downloadingId && downloadingId !== submission.id}
                                >
                                    {downloadingId === submission.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Download className="h-3.5 w-3.5 mr-2" />}
                                    Download
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })
            ) : (
                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card">
                    <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No submissions found.</p>
                </div>
            )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected submission records and their associated signed documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSelected}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} disabled={isDeletingSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingSelected ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pdf && (
          <ShareResultsDialog
            pdf={pdf}
            open={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
          />
      )}

      {isExportingPDF && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
              <Card className="w-full max-w-sm shadow-2xl border-primary/20 bg-card rounded-2xl">
                  <CardContent className="p-8 flex flex-col items-center gap-6 text-center">
                      <div className="relative">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <Printer className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                      </div>
                      <div className="space-y-1">
                          <h2 className="font-black text-xl tracking-tight uppercase">Generating Report</h2>
                          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Building A4 multi-page document...</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setIsExportingPDF(false)} className="text-muted-foreground hover:text-foreground">Cancel Generation</Button>
                  </CardContent>
              </Card>
          </div>
      )}

      {downloadingId && pdf && (
          <HighFidelityDownloader 
            pdfForm={pdf} 
            submissionId={downloadingId} 
            fileName={getSubmissionFileName(submissions?.find(s => s.id === downloadingId) || { id: downloadingId, formData: {} } as Submission)}
            batchProgress={isProcessingBatch ? { current: currentBatchIndex, total: totalBatchSize } : undefined}
            onFinished={onDownloadFinished}
            onCancel={handleCancelBatch}
          />
      )}
    </TooltipProvider>
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
        if (result.success) {
            toast({ title: 'Share Settings Updated' });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
        setIsSaving(false);
    };

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/forms/results/${pdf.slug || pdf.id}` : '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-black tracking-tight">Share Portal</DialogTitle>
                    <DialogDescription className="text-sm font-medium">Allow external stakeholders to view and download submissions securely.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 p-6">
                    <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 p-4">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold uppercase tracking-wider">Public Access</Label>
                            <p className="text-xs text-muted-foreground font-medium">Enable viewing via link.</p>
                        </div>
                        <Switch checked={isShared} onCheckedChange={setIsShared} />
                    </div>
                    {isShared && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Lock className="h-3 w-3" /> Results Password</Label>
                                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required for access..." className="h-11 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Share Link</Label>
                                <div className="flex items-center gap-2">
                                    <Input value={shareUrl} readOnly className="text-[10px] bg-muted h-11 font-mono rounded-xl" />
                                    <Button size="icon" variant="outline" className="h-11 w-11 shrink-0 rounded-xl shadow-sm" onClick={() => {
                                        navigator.clipboard.writeText(shareUrl);
                                        toast({ title: 'Link Copied' });
                                    }}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="p-6 pt-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="font-bold rounded-xl px-8">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Settings'}
                    </Button>
                </DialogFooter>
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
                console.error("Renderer: Failed to load PDF", e);
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

            // iOS Detection
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            for (let i = 0; i < pageWrappers.length; i++) {
                const el = pageWrappers[i] as HTMLElement;
                const captureScale = isIOS ? 1.5 : 2;

                const canvas = await html2canvas(el, { scale: captureScale, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
                const image = await pdfBundle.embedJpg(imgBytes);
                const page = pdfBundle.addPage([595.28, 841.89]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: 595.28,
                    height: 841.89,
                });
            }
            const pdfBytes = await pdfBundle.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);

            if (isIOS) {
                window.location.assign(url);
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 500);
            }
            onFinished(true, url);
        } catch (e: any) {
            console.error("Capture failed", e);
            onFinished(false);
        } finally {
            setIsCapturing(false);
        }
    }, [fileName, onFinished, isCapturing]);

    React.useEffect(() => {
        if (pdfDoc && submission && !isCapturing) {
            const timer = setTimeout(() => { handleGenerate(); }, 1500);
            return () => clearTimeout(timer);
        }
    }, [pdfDoc, submission, handleGenerate, isCapturing]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b shrink-0 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                        <h2 className="text-lg font-bold">
                            {batchProgress ? `Processing Document ${batchProgress.current} of ${batchProgress.total}` : 'Generating Signed Document'}
                        </h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Capturing high-fidelity pages...</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full">
                    <X className="h-5 w-5" />
                </Button>
            </div>
            
            {batchProgress && (
                <div className="w-full h-1.5 bg-muted">
                    <div 
                        className="h-full bg-primary transition-all duration-500 ease-in-out" 
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                    <div ref={containerRef} className="p-8 flex flex-col items-center min-w-full">
                        {(!pdfDoc || isLoading) ? (
                            <div className="flex flex-col gap-8"><Skeleton className="w-[8.5in] h-[11in] bg-white shadow-xl rounded-lg" /></div>
                        ) : (
                            <div className="flex flex-col gap-8 pb-20">
                                {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                    <div key={index} className="page-capture-wrapper">
                                        <SilentPageRenderer pdf={pdfDoc} pageNumber={index + 1} fields={pdfForm.fields} formData={submission?.formData || {}} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            
            <div className="p-4 border-t bg-card text-center print:hidden">
                <Button variant="outline" size="sm" onClick={onCancel} className="font-bold rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive">
                    Stop Batch Operation
                </Button>
            </div>
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
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
                if (isCancelled) return;
                setDimensions({ width: viewport.width, height: viewport.height });
                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        const renderTask = page.render({ canvasContext: context, viewport });
                        renderTaskRef.current = renderTask;
                        await renderTask.promise;
                    }
                }
            } catch (e: any) {
                if (e.name === 'RenderingCancelledException') return;
                console.error("Renderer: task failed", e);
            } finally {
                if (!isCancelled) setIsRendering(false);
            }
        };
        render();
        return () => { isCancelled = true; if (renderTaskRef.current) { renderTaskRef.current.cancel(); } };
    }, [pdf, pageNumber]);

    return (
        <div className="relative mx-auto shadow-2xl bg-white border border-border flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const value = formData[field.id];
                        if (!value) return null;
                        return (
                            <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`, display: 'flex', alignItems: 'flex-start', justifyItems: 'flex-start' }}>
                                {field.type === 'signature' ? (
                                    <img src={value} alt="S" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap bg-transparent">
                                        {field.type === 'date' && value ? format(new Date(value), 'PPP') : value}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
