'use client';

import * as React from 'react';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import Link from 'next/link';
import { Eye, Download, Loader2, X, Key, ChevronDown, FileSpreadsheet, Printer } from 'lucide-react';
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

const pdfjsPromise = import('pdfjs-dist');

export default function SharedResultsListView({ pdfForm }: { pdfForm: PDFForm }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [batchDownloadQueue, setBatchDownloadQueue] = React.useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = React.useState(false);

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
    setBatchDownloadQueue(ids);
    setIsProcessingBatch(true);
    setDownloadingId(ids[0]);
  };

  const onDownloadFinished = React.useCallback((success: boolean) => {
    setTimeout(() => {
        if (isProcessingBatch) {
            setBatchDownloadQueue(prev => {
                const next = prev.slice(1);
                if (next.length > 0) setDownloadingId(next[0]);
                else {
                    setIsProcessingBatch(false);
                    setDownloadingId(null);
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

  const handleExportCSV = () => {
    if (!submissions || !pdfForm) return;

    // Use all non-signature fields for CSV export
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
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-muted/10">
        <header className="h-16 border-b bg-background px-6 flex items-center justify-between shrink-0 print:hidden">
            <div className="flex items-center gap-3">
                <SmartSappIcon className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-bold text-sm sm:text-base leading-none">Shared Results: {pdfForm.name}</h1>
                    <p className="text-[10px] text-muted-foreground mt-1">Authorized Viewing Access</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            Export List
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Export to Excel (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print / Save as PDF
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                
                {submissions?.length && (
                    <Button size="sm" onClick={handleDownloadAll} disabled={isProcessingBatch || !!downloadingId}>
                        {isProcessingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        Download All PDFs
                    </Button>
                )}
            </div>
        </header>

        {/* Print-only Header */}
        <div className="hidden print:block mb-8 border-b pb-4 px-8 pt-8">
            <h1 className="text-2xl font-bold">Shared Results: {pdfForm.name}</h1>
            <p className="text-sm text-muted-foreground">Generated on {format(new Date(), "PPP p")}</p>
            <p className="text-xs text-muted-foreground mt-1">{submissions?.length || 0} total records</p>
        </div>

        <div className="flex-grow overflow-auto p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden print:border-none print:shadow-none print:overflow-visible">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {displayFields.map((field, idx) => (
                                    <TableHead key={field.id} className={cn(idx === 0 && "bg-primary/5")}>
                                        <div className="flex items-center gap-1.5">
                                            {field.label || 'Unnamed'}
                                            {field.id === pdfForm.namingFieldId && <Key className="h-3 w-3 text-primary/70" />}
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead>Date</TableHead>
                                <TableHead className="w-[100px] text-right print:hidden">Actions</TableHead>
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
                                <TableRow key={submission.id}>
                                    {displayFields.map((field, idx) => {
                                        const value = submission.formData[field.id];
                                        const content = field.type === 'signature' ? (
                                            <div className="h-8 w-16 relative bg-muted rounded overflow-hidden">{value && <img src={value} alt="Sig" className="h-full w-full object-contain" />}</div>
                                        ) : <span className="truncate max-w-[200px] block">{value || '-'}</span>;
                                        return (
                                            <TableCell key={field.id} className={cn("font-medium", idx === 0 && "text-primary")}>
                                                {idx === 0 ? <Link href={`/forms/results/${pdfForm.slug || pdfForm.id}/${submission.id}`} className="hover:underline print:no-underline">{content}</Link> : content}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-muted-foreground text-xs">{format(new Date(submission.submittedAt), 'PPP')}</TableCell>
                                    <TableCell className="text-right print:hidden">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/forms/results/${pdfForm.slug || pdfForm.id}/${submission.id}`}><Eye className="h-4 w-4" /></Link></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadClick(submission.id)} disabled={!!downloadingId}><Download className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={displayFields.length + 2} className="h-48 text-center text-muted-foreground">No submissions found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>

        {downloadingId && (
            <HighFidelityDownloader 
                pdfForm={pdfForm} 
                submissionId={downloadingId} 
                fileName={getSubmissionFileName(submissions?.find(s => s.id === downloadingId) || { id: downloadingId, formData: {} } as Submission)}
                onFinished={onDownloadFinished}
                onCancel={() => { setDownloadingId(null); setIsProcessingBatch(false); setBatchDownloadQueue([]); }}
            />
        )}
      </div>
    </TooltipProvider>
  );
}

function HighFidelityDownloader({ pdfForm, submissionId, fileName, onFinished, onCancel }: { pdfForm: PDFForm, submissionId: string, fileName: string, onFinished: (success: boolean) => void, onCancel: () => void }) {
    const firestore = useFirestore();
    const submissionRef = useMemoFirebase(() => firestore ? doc(firestore, `pdfs/${pdfForm.id}/submissions`, submissionId) : null, [firestore, pdfForm.id, submissionId]);
    const { data: submission } = useDoc<Submission>(submissionRef);
    const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const load = async () => {
            const pdfjs = await pdfjsPromise;
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
            const loaded = await pdfjs.getDocument({ url: pdfForm.downloadUrl }).promise;
            setPdfDoc(loaded);
        };
        load();
    }, [pdfForm.downloadUrl]);

    const handleGenerate = React.useCallback(async () => {
        if (isCapturing || !containerRef.current) return;
        setIsCapturing(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { PDFDocument } = await import('pdf-lib');
            const pdfBundle = await PDFDocument.create();
            const pageWrappers = containerRef.current.querySelectorAll('.page-capture-wrapper');
            for (let i = 0; i < pageWrappers.length; i++) {
                const canvas = await html2canvas(pageWrappers[i] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const image = await pdfBundle.embedJpg(await fetch(canvas.toDataURL('image/jpeg', 0.9)).then(res => res.arrayBuffer()));
                const page = pdfBundle.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
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
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md">
            <div className="flex items-center justify-between p-4 border-b bg-card">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div><h2 className="text-lg font-bold">Processing PDF</h2><p className="text-sm text-muted-foreground">Generating high-fidelity document...</p></div>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-5 w-5" /></Button>
            </div>
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
        <div className="relative mx-auto bg-white border flex-shrink-0 shadow-lg" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const val = formData[field.id]; if (!val) return null;
                        return (
                            <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`, display: 'flex' }}>
                                {field.type === 'signature' ? <img src={val} alt="S" className="w-full h-full object-contain" /> : <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap">{field.type === 'date' ? format(new Date(val), 'PPP') : val}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
