
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Eye, Download, Loader2, X, Key, ListFilter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Dynamic imports for rendering libraries
const pdfjsPromise = import('pdfjs-dist');

export default function SubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { id: pdfId } = params;
  const firestore = useFirestore();
  
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [batchDownloadQueue, setBatchDownloadQueue] = React.useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = React.useState(false);
  const [selectedNamingFieldId, setSelectedNamingFieldId] = React.useState<string | null>(null);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId as string);
  }, [firestore, pdfId]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return query(collection(firestore, `pdfs/${pdfId}/submissions`), orderBy('submittedAt', 'desc'));
  }, [firestore, pdfId]);

  const { data: pdf, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submissions, isLoading: isLoadingSubmissions } = useCollection<Submission>(submissionsQuery);

  const isLoading = isLoadingPdf || isLoadingSubmissions;

  React.useEffect(() => {
    if (pdf && pdf.namingFieldId && !selectedNamingFieldId) {
        setSelectedNamingFieldId(pdf.namingFieldId);
    }
  }, [pdf, selectedNamingFieldId]);

  // Handle naming field change
  const handleNamingFieldChange = (fieldId: string) => {
    const newVal = fieldId === 'none' ? null : fieldId;
    setSelectedNamingFieldId(newVal);
    if (pdf) {
        updateDoc(doc(firestore!, 'pdfs', pdf.id), { namingFieldId: newVal });
    }
  };

  // Get naming info for a specific submission
  const getSubmissionFileName = React.useCallback((submission: Submission) => {
    if (!pdf) return 'document.pdf';
    
    let identifier = '';
    const namingField = pdf.fields.find(f => f.id === selectedNamingFieldId);
    
    if (namingField) {
        identifier = submission.formData[namingField.id] || '';
    }

    if (!identifier) {
        const firstField = pdf.fields[0];
        const firstVal = firstField ? submission.formData[firstField.id] : '';
        identifier = firstVal ? `${pdf.name} - ${firstVal}` : `${pdf.name} - ${submission.id.substring(0, 8)}`;
    }

    return `${identifier.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.pdf`;
  }, [pdf, selectedNamingFieldId]);

  // Handle single download click
  const handleDownloadClick = (submissionId: string) => {
    if (downloadingId || isProcessingBatch) return;
    toast({ title: 'Preparing download...', description: 'Initializing high-fidelity renderer.' });
    setDownloadingId(submissionId);
  };

  // Handle "Download All" click
  const handleDownloadAll = () => {
    if (!submissions || submissions.length === 0 || isProcessingBatch) return;
    const ids = submissions.map(s => s.id);
    setBatchDownloadQueue(ids);
    setIsProcessingBatch(true);
    setDownloadingId(ids[0]);
    toast({ title: 'Batch Download Started', description: `Processing ${ids.length} documents sequentially...` });
  };

  // Callback when a rendering component finishes its job
  const onDownloadFinished = React.useCallback((success: boolean, blobUrl?: string) => {
    if (isProcessingBatch) {
        setBatchDownloadQueue(prev => {
            const nextQueue = prev.slice(1);
            if (nextQueue.length > 0) {
                setDownloadingId(nextQueue[0]);
            } else {
                setIsProcessingBatch(false);
                setDownloadingId(null);
                toast({ title: 'Batch Download Complete', description: 'All submissions have been processed.' });
            }
            return nextQueue;
        });
    } else {
        setDownloadingId(null);
        if (success) {
            toast({ 
                title: 'Download Ready', 
                description: 'Your PDF has been generated successfully.',
                action: blobUrl ? (
                    <ToastAction altText="Open PDF" asChild>
                        <a href={blobUrl} target="_blank" rel="noopener noreferrer">Open</a>
                    </ToastAction>
                ) : undefined
            });
        }
    }
  }, [isProcessingBatch, toast]);

  const firstTwoFields = React.useMemo(() => {
    return pdf?.fields?.slice(0, 2) || [];
  }, [pdf?.fields]);

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push('/admin/pdfs')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {isLoadingPdf ? <Skeleton className="h-8 w-64" /> : `Submissions for "${pdf?.name}"`}
            </h1>
            <p className="text-muted-foreground">
              View and download all completed submissions for this document.
            </p>
          </div>
          {!isLoading && submissions && submissions.length > 0 && (
              <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Naming Field</Label>
                      <Select value={selectedNamingFieldId || 'none'} onValueChange={handleNamingFieldChange}>
                          <SelectTrigger className="h-9 w-48 text-xs">
                              <SelectValue placeholder="Select naming field..." />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none" className="text-xs">Default (Form Name)</SelectItem>
                              {pdf?.fields.filter(f => f.type !== 'signature').map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs">
                                      {f.label || f.id}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <Button onClick={handleDownloadAll} variant="outline" disabled={isProcessingBatch || !!downloadingId} className="h-9 self-end">
                      {isProcessingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {isProcessingBatch ? `Processing (${batchDownloadQueue.length} left)` : 'Download All PDFs'}
                  </Button>
              </div>
          )}
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {firstTwoFields.map(field => (
                  <TableHead key={field.id} className="gap-2">
                      <div className="flex items-center gap-1.5">
                        {field.label || 'Unnamed Field'}
                        {field.id === selectedNamingFieldId && <Key className="h-3 w-3 text-primary-foreground/70" />}
                      </div>
                  </TableHead>
                ))}
                <TableHead>Submission Date</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: Math.max(firstTwoFields.length, 1) }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-32" /></TableCell>
                    ))}
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : submissions && submissions.length > 0 ? (
                submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    {firstTwoFields.map(field => {
                      const value = submission.formData[field.id];
                      return (
                        <TableCell key={field.id} className="font-medium">
                          {field.type === 'signature' ? (
                            <div className="h-8 w-16 relative bg-muted rounded overflow-hidden">
                                {value && <img src={value} alt="Sig" className="h-full w-full object-contain" />}
                            </div>
                          ) : (
                            <span className="truncate max-w-[200px] block">
                                {value || <span className="text-muted-foreground italic">empty</span>}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-muted-foreground">
                      {format(new Date(submission.submittedAt), 'PPP p')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View Submission</span>
                                </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDownloadClick(submission.id)}
                                disabled={!!downloadingId && downloadingId !== submission.id}
                            >
                                {downloadingId === submission.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                <span className="sr-only">Download PDF</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download PDF</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={firstTwoFields.length + 2} className="h-24 text-center text-muted-foreground">
                    No submissions have been received for this document yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* The visible rendering overlay that performs the front-end generation */}
      {downloadingId && pdf && (
          <HighFidelityDownloader 
            pdfForm={pdf} 
            submissionId={downloadingId} 
            fileName={getSubmissionFileName(submissions?.find(s => s.id === downloadingId) || { id: downloadingId, formData: {} } as Submission)}
            onFinished={onDownloadFinished}
            onCancel={() => {
                setDownloadingId(null);
                setIsProcessingBatch(false);
                setBatchDownloadQueue([]);
                toast({ title: 'Download Cancelled', variant: 'secondary' });
            }}
          />
      )}
    </TooltipProvider>
  );
}

/**
 * A component that renders the document on screen, captures it, downloads it, and then closes.
 */
function HighFidelityDownloader({ pdfForm, submissionId, fileName, onFinished, onCancel }: { pdfForm: PDFForm, submissionId: string, fileName: string, onFinished: (success: boolean, url?: string) => void, onCancel: () => void }) {
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
                toast({ variant: 'destructive', title: 'Rendering Error', description: 'Failed to load PDF template.' });
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
            
            if (!pageWrappers.length) throw new Error("No pages rendered for capture.");

            for (let i = 0; i < pageWrappers.length; i++) {
                const el = pageWrappers[i] as HTMLElement;
                const canvas = await html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
                const image = await pdfBundle.embedJpg(imgBytes);
                
                const page = pdfBundle.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            }

            const pdfBytes = await pdfBundle.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            onFinished(true, url);
        } catch (e: any) {
            console.error("Capture failed", e);
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'Error occurred while bundling PDF.' });
            onFinished(false);
        } finally {
            setIsCapturing(false);
        }
    }, [fileName, onFinished, isCapturing, toast]);

    // Automatically trigger capture when everything is loaded
    React.useEffect(() => {
        if (pdfDoc && submission && !isCapturing) {
            // Give a delay for signatures to definitely paint
            const timer = setTimeout(() => {
                handleGenerate();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [pdfDoc, submission, handleGenerate, isCapturing]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b shrink-0 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                        <h2 className="text-lg font-bold">Generating Signed Document</h2>
                        <p className="text-sm text-muted-foreground">Please wait, capturing high-fidelity pages...</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <X className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                    <div ref={containerRef} className="p-8 flex flex-col items-center min-w-full">
                        {(!pdfDoc || isLoading) ? (
                            <div className="flex flex-col gap-8">
                                <Skeleton className="w-[8.5in] h-[11in] bg-white shadow-xl rounded-lg" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-8 pb-20">
                                {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                    <div key={index} className="page-capture-wrapper">
                                        <SilentPageRenderer 
                                            pdf={pdfDoc} 
                                            pageNumber={index + 1} 
                                            fields={pdfForm.fields} 
                                            formData={submission?.formData || {}} 
                                        />
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
                console.error("Renderer: Page task failed", e);
            } finally {
                if (!isCancelled) setIsRendering(false);
            }
        };
        render();
        return () => {
            isCancelled = true;
            if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [pdf, pageNumber]);

    return (
        <div 
            className="relative mx-auto shadow-2xl bg-white border border-border flex-shrink-0" 
            style={{ width: dimensions.width, height: dimensions.height }}
        >
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const value = formData[field.id];
                        if (!value) return null;
                        return (
                            <div 
                                key={field.id} 
                                style={{ 
                                    position: 'absolute', 
                                    left: `${field.position.x}%`, 
                                    top: `${field.position.y}%`, 
                                    width: `${field.dimensions.width}%`, 
                                    height: `${field.dimensions.height}%`,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                }}
                            >
                                {field.type === 'signature' ? (
                                    <img src={value} alt="Signature" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap">
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
