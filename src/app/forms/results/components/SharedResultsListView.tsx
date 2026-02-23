'use client';

import * as React from 'react';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Eye, Download, Loader2, X, Key, ChevronDown, FileSpreadsheet, Printer, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SmartSappIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const pdfjsPromise = import('pdfjs-dist');

export default function SharedResultsListView({ pdfForm }: { pdfForm: PDFForm }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [batchDownloadQueue, setBatchDownloadQueue] = React.useState<string[]>([]);
  const [totalBatchSize, setTotalBatchSize] = React.useState(0);
  const [isProcessingBatch, setIsProcessingBatch] = React.useState(false);
  const [isExportingCSV, setIsExportingCSV] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, `pdfs/${pdfForm.id}/submissions`), orderBy('submittedAt', 'desc'));
  }, [firestore, pdfForm.id]);

  const { data: submissions, isLoading } = useCollection<Submission>(submissionsQuery);

  const displayFields = React.useMemo(() => {
    const keyField = pdfForm.fields.find(f => f.id === pdfForm.namingFieldId);
    const result = keyField ? [keyField] : [];
    const otherDisplayIds = (pdfForm.displayFieldIds || []).filter(id => id !== pdfForm.namingFieldId);
    const otherFields = otherDisplayIds.map(id => pdfForm.fields.find(f => f.id === id)).filter(Boolean) as PDFFormField[];
    const finalSet = [...result, ...otherFields];
    if (finalSet.length < 3) {
        const remaining = pdfForm.fields.filter(f => !finalSet.find(ff => ff.id === f.id) && f.type !== 'signature');
        finalSet.push(...remaining.slice(0, 3 - finalSet.length));
    }
    return finalSet.slice(0, 3);
  }, [pdfForm]);

  const getSubmissionFileName = React.useCallback((submission: Submission) => {
    let keyFieldValue = '';
    const namingField = pdfForm.fields.find(f => f.id === pdfForm.namingFieldId);
    if (namingField) keyFieldValue = submission.formData[namingField.id] || '';
    if (!keyFieldValue) {
        const firstField = displayFields[0];
        keyFieldValue = firstField ? submission.formData[firstField.id] : '';
    }
    if (!keyFieldValue) keyFieldValue = submission.id.substring(0, 8);
    return `${keyFieldValue} - ${pdfForm.name}.pdf`.replace(/[^a-z0-9\s-]/gi, '_').trim().substring(0, 100);
  }, [pdfForm, displayFields]);

  const handleDownloadClick = (id: string) => {
    if (downloadingId || isProcessingBatch) return;
    setDownloadingId(id);
  };

  const handleDownloadAll = () => {
    if (!submissions?.length || isProcessingBatch) return;
    const ids = submissions.map(s => s.id);
    setTotalBatchSize(ids.length);
    setBatchDownloadQueue(ids);
    setIsProcessingBatch(true);
    setDownloadingId(ids[0]);
    toast({ title: 'Batch Download Started', description: `Processing ${ids.length} documents...` });
  };

  const onDownloadFinished = React.useCallback((success: boolean) => {
    setTimeout(() => {
        if (isProcessingBatch) {
            setBatchDownloadQueue(prev => {
                const next = prev.slice(1);
                if (next.length > 0) {
                    setDownloadingId(next[0]);
                } else {
                    setIsProcessingBatch(false);
                    setDownloadingId(null);
                    setTotalBatchSize(0);
                    toast({ title: 'Batch Download Complete' });
                }
                return next;
            });
        } else {
            setDownloadingId(null);
            if (success) toast({ title: 'Download Successful' });
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
    if (!submissions || !pdfForm) return;
    setIsExportingCSV(true);

    try {
        const dataFields = pdfForm.fields.filter(f => f.type !== 'signature');
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
        link.setAttribute("download", `${pdfForm.slug || pdfForm.id}_results_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "CSV Export Started" });
    } catch (e) {
        toast({ variant: 'destructive', title: 'CSV Export Failed' });
    } finally {
        setIsExportingCSV(false);
    }
  };

  const handleExportPDF = async () => {
    if (!submissions || !pdfForm || isExportingPDF) return;
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
                pageEl.innerHTML = `
                    <div class="mb-8 border-b-2 pb-4 border-gray-200">
                        <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">Shared Results Report</h1>
                        <h2 class="text-xl font-bold text-primary mt-1">${pdfForm.name}</h2>
                        <div class="flex justify-between items-end mt-4">
                            <p class="text-xs text-gray-500 font-medium">Generated: ${format(new Date(), "PPPP 'at' p")}</p>
                            <p class="text-xs font-bold text-gray-700">${submissions.length} total records</p>
                        </div>
                    </div>
                `;
            } else {
                pageEl.innerHTML += `<div class="mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Page ${pageIdx + 1} of ${rowChunks.length}</div>`;
            }

            let tableHtml = `
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-primary text-white">
                            ${displayFields.map(f => `<th class="p-3 text-[10px] font-black uppercase text-left border border-primary">${f.label || 'Field'}</th>`).join('')}
                            <th class="p-3 text-[10px] font-black uppercase text-left border border-primary">Date</th>
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
                pageEl.innerHTML += `<div class="mt-12 pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400 font-medium italic">Authorized Shared Report via SmartSapp</div>`;
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
            page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });

            exportContainer.removeChild(pageEl);
        }

        document.body.removeChild(exportContainer);

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${pdfForm.name}_Shared_Report.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({ title: 'PDF Report Generated' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'PDF Generation Failed' });
    } finally {
        setIsExportingPDF(false);
    }
  };

  const currentBatchIndex = isProcessingBatch ? totalBatchSize - batchDownloadQueue.length + 1 : 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-muted/10">
        <header className="h-16 border-b bg-background px-4 sm:px-6 flex items-center justify-between shrink-0 print:hidden shadow-sm z-30">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl">
                    <SmartSappIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                    <h1 className="font-black text-xs sm:text-lg leading-tight truncate pr-2" title={pdfForm.name}>{pdfForm.name}</h1>
                    <p className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 sm:mt-1 truncate">Shared Portal</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 sm:h-10 sm:gap-2 font-bold shadow-sm" disabled={isExportingCSV || isExportingPDF}>
                            {isExportingCSV || isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="hidden sm:inline">Export List</span>
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
                
                {submissions?.length > 0 && (
                    <Button size="sm" onClick={handleDownloadAll} disabled={isProcessingBatch || !!downloadingId} className="h-9 sm:h-10 px-3 sm:px-4 font-bold shadow-sm">
                        {isProcessingBatch ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-0 sm:mr-2" /><span className="hidden sm:inline">Processing ({batchDownloadQueue.length} left)</span><span className="sm:hidden">{batchDownloadQueue.length}</span></>
                        ) : (
                            <><Download className="h-4 w-4 mr-0 sm:mr-2" /><span className="hidden sm:inline">Download All PDFs</span><span className="sm:hidden">All</span></>
                        )}
                    </Button>
                )}
            </div>
        </header>

        <div className="flex-grow overflow-auto p-4 sm:p-8 bg-muted/20">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-card shadow-sm border-border/50 rounded-xl">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="bg-primary/10 p-2.5 rounded-xl">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Submissions</p>
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
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Latest Update</p>
                                <p className="text-sm font-bold text-foreground">
                                    {isLoading ? '...' : submissions?.[0] ? formatDistanceToNow(new Date(submissions[0].submittedAt), { addSuffix: true }) : 'N/A'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50 border-b border-border/50">
                            <TableRow className="hover:bg-transparent">
                                {displayFields.map((field, idx) => (
                                    <TableHead key={field.id} className={cn("text-[10px] font-bold text-foreground uppercase tracking-wider py-4", idx === 0 && "pl-6")}>
                                        <div className="flex items-center gap-1.5">
                                            {field.label || 'Unnamed'}
                                            {field.id === pdfForm.namingFieldId && <Key className="h-3 w-3 text-primary" />}
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-[10px] font-bold text-foreground uppercase tracking-wider py-4">Submission Date</TableHead>
                                <TableHead className="w-[100px] text-right py-4 pr-6 text-[10px] font-bold text-foreground uppercase">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 3 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-32" /></TableCell>)}
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                </TableRow>
                            )) : submissions?.length ? submissions.map((submission) => (
                                <TableRow key={submission.id} className="group hover:bg-muted/30 transition-colors">
                                    {displayFields.map((field, idx) => {
                                        const value = submission.formData[field.id];
                                        const content = field.type === 'signature' ? (
                                            <div className="h-8 w-16 relative bg-muted/50 rounded border border-border/50 overflow-hidden">{value && <img src={value} alt="Sig" className="h-full w-full object-contain" />}</div>
                                        ) : <span className="truncate max-w-[200px] block font-medium">{value || <span className="text-muted-foreground font-normal italic opacity-50">—</span>}</span>;
                                        return (
                                            <TableCell key={field.id} className={cn(idx === 0 && "pl-6")}>
                                                {idx === 0 ? <Link href={`/forms/results/${pdfForm.slug || pdfForm.id}/${submission.id}`} className="hover:text-primary transition-colors font-bold">{content}</Link> : content}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-muted-foreground text-xs font-medium">{format(new Date(submission.submittedAt), 'MMM d, yyyy · p')}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><Link href={`/forms/results/${pdfForm.slug || pdfForm.id}/${submission.id}`}><Eye className="h-4 w-4" /></Link></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDownloadClick(submission.id)} disabled={!!downloadingId || isProcessingBatch}><Download className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={displayFields.length + 2} className="h-48 text-center text-muted-foreground font-medium">No submission records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>

        {isExportingPDF && (
            <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-80 shadow-2xl border-primary/20 bg-card rounded-2xl">
                    <CardContent className="p-8 flex flex-col items-center gap-6">
                        <div className="relative">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <Printer className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                        </div>
                        <div className="text-center space-y-1">
                            <h2 className="font-black text-xl tracking-tight">Generating Report</h2>
                            <p className="text-sm text-muted-foreground font-medium">Creating A4 multi-page document...</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsExportingPDF(false)} className="text-muted-foreground">Cancel</Button>
                    </CardContent>
                </Card>
            </div>
        )}

        {downloadingId && (
            <HighFidelityDownloader 
                pdfForm={pdfForm} 
                submissionId={downloadingId} 
                fileName={getSubmissionFileName(submissions?.find(s => s.id === downloadingId) || { id: downloadingId, formData: {} } as Submission)}
                batchProgress={isProcessingBatch ? { current: currentBatchIndex, total: totalBatchSize } : undefined}
                onFinished={onDownloadFinished}
                onCancel={handleCancelBatch}
            />
        )}
      </div>
    </TooltipProvider>
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
    onFinished: (success: boolean) => void, 
    onCancel: () => void 
}) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const submissionRef = useMemoFirebase(() => firestore ? doc(firestore, `pdfs/${pdfForm.id}/submissions`, submissionId) : null, [firestore, pdfForm.id, submissionId]);
    const { data: submission } = useDoc<Submission>(submissionRef);
    const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const load = async () => {
            try {
                const pdfjs = await pdfjsPromise;
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
                const loaded = await pdfjs.getDocument({ url: pdfForm.downloadUrl }).promise;
                setPdfDoc(loaded);
            } catch (e) {
                console.error("Renderer: Failed to load PDF", e);
                setTimeout(() => toast({ variant: 'destructive', title: 'Rendering Error' }), 0);
                onFinished(false);
            }
        };
        load();
    }, [pdfForm.downloadUrl, onFinished, toast]);

    const handleGenerate = React.useCallback(async () => {
        if (isCapturing || !containerRef.current) return;
        setIsCapturing(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { PDFDocument } = await import('pdf-lib');
            const pdfBundle = await PDFDocument.create();
            const pageWrappers = containerRef.current.querySelectorAll('.page-capture-wrapper');
            for (let i = 0; i < pageWrappers.length; i++) {
                const el = pageWrappers[i] as HTMLElement;
                const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const image = await pdfBundle.embedJpg(await fetch(canvas.toDataURL('image/jpeg', 0.9)).then(res => res.arrayBuffer()));
                const page = pdfBundle.addPage([595.28, 841.89]);
                page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
            }
            const blob = new Blob([await pdfBundle.save()], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            onFinished(true);
        } catch (e) {
            onFinished(false);
        } finally { setIsCapturing(false); }
    }, [fileName, onFinished, isCapturing]);

    React.useEffect(() => {
        if (pdfDoc && submission && !isCapturing) {
            const timer = setTimeout(() => handleGenerate(), 1500);
            return () => clearTimeout(timer);
        }
    }, [pdfDoc, submission, handleGenerate, isCapturing]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                        <h2 className="text-lg font-bold">
                            {batchProgress ? `Downloading Record ${batchProgress.current} of ${batchProgress.total}` : 'Processing PDF'}
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium">Generating high-fidelity document...</p>
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
                    <div ref={containerRef} className="p-8 flex flex-col items-center">
                        {!pdfDoc ? <Skeleton className="w-[8.5in] h-[11in] bg-white rounded-lg" /> : (
                            <div className="flex flex-col gap-8">
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
                <Button variant="outline" size="sm" onClick={onCancel} className="font-bold border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive">
                    Stop Batch Download
                </Button>
            </div>
        </div>
    );
}

function SilentPageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);

    React.useEffect(() => {
        const render = async () => {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
            setDimensions({ width: viewport.width, height: viewport.height });
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.height = viewport.height; canvas.width = viewport.width;
                await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
                setIsRendering(false);
            }
        };
        render();
    }, [pdf, pageNumber]);

    return (
        <div className="relative mx-auto bg-white border border-border/50 flex-shrink-0 shadow-lg" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const val = formData[field.id]; if (!val) return null;
                        return (
                            <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`, display: 'flex' }}>
                                {field.type === 'signature' ? (
                                    <img src={val} alt="S" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap bg-transparent">
                                        {field.type === 'date' ? format(new Date(val), 'PPP') : val}
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
