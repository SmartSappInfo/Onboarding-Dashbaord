'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Loader2, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const pdfId = params.id as string;
  const submissionId = params.submissionId as string;
  const firestore = useFirestore();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isFrontEndDownloading, setIsFrontEndDownloading] = React.useState(false);
  
  const pageContainerRef = React.useRef<HTMLDivElement>(null);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const submissionDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId || !submissionId) return null;
    return doc(firestore, `pdfs/${pdfId}/submissions`, submissionId);
  }, [firestore, pdfId, submissionId]);

  const { data: pdfForm, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submission, isLoading: isLoadingSubmission } = useDoc<Submission>(submissionDocRef);

  React.useEffect(() => {
    const loadPdf = async () => {
        if (!pdfForm?.downloadUrl) return;
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            
            // Set worker source
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            
            const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading Template', description: 'Could not load the original document template.' });
        }
    };
    loadPdf();
  }, [pdfForm?.downloadUrl, toast]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const response = await fetch(`/api/pdfs/${pdfId}/generate/${submissionId}`);
        if (!response.ok) throw new Error('Failed to generate PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pdfForm?.name || 'signed'}-submission.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Download Successful' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleFrontEndDownload = async () => {
    setIsFrontEndDownloading(true);
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { PDFDocument } = await import('pdf-lib');
        
        const pdfDoc = await PDFDocument.create();
        const pageElements = pageContainerRef.current?.querySelectorAll('.page-capture-wrapper');
        
        if (!pageElements || !pageElements.length) {
            throw new Error("No pages found to capture. Please ensure the document is fully loaded.");
        }

        toast({ title: 'Preparing Front-end Download', description: 'Capturing pages as images...' });

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            
            // Capture the element as a canvas with high scale for quality
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedJpg(imgBytes);
            
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pdfForm?.name || 'signed'}-frontend-capture.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Front-end Download Successful' });
    } catch (e: any) {
        console.error("Front-end download error:", e);
        toast({ variant: 'destructive', title: 'Front-end Download Failed', description: e.message });
    } finally {
        setIsFrontEndDownloading(false);
    }
  };

  const isLoading = isLoadingPdf || isLoadingSubmission || (!pdfDoc && pdfForm?.downloadUrl);

  return (
    <div className="h-full overflow-hidden flex flex-col">
       <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card shadow-sm">
        <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push(`/admin/pdfs/${pdfId}/submissions`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to List
            </Button>
            <div className="hidden sm:block h-6 w-px bg-border mx-2" />
            <h1 className="text-lg font-semibold truncate">
              {isLoadingSubmission ? <Skeleton className="h-6 w-48" /> : `Submitted: ${submission ? format(new Date(submission.submittedAt), "PPP p") : ''}`}
            </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleFrontEndDownload} disabled={isLoading || isFrontEndDownloading}>
            {isFrontEndDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Monitor className="mr-2 h-4 w-4" />}
            Front-end Download
          </Button>
          <Button onClick={handleDownload} disabled={isLoading || isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Signed PDF
          </Button>
        </div>
      </div>
      <div className="flex-grow bg-muted overflow-hidden relative">
        <ScrollArea className="h-full w-full">
            <div 
                ref={pageContainerRef}
                className="p-4 sm:p-8 flex flex-col items-center min-w-full"
                style={{ minWidth: 'fit-content' }}
            >
                <div className="max-w-4xl mx-auto space-y-4">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="w-full aspect-[1/1.41] bg-white shadow-md mb-4 flex-shrink-0" />)
                    ) : pdfDoc && pdfForm && submission ? (
                        Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                            <div key={index} className="page-capture-wrapper mb-4">
                                <SubmissionPageRenderer
                                    pdf={pdfDoc}
                                    pageNumber={index + 1}
                                    fields={pdfForm.fields}
                                    formData={submission.formData}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full py-20 text-center">
                            <p className="text-muted-foreground">Submission not found or failed to load template.</p>
                        </div>
                    )}
                </div>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

function SubmissionPageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);

    React.useEffect(() => {
        let isCancelled = false;

        const render = async () => {
            setIsRendering(true);
            try {
                // Cancel any existing task on this canvas
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
                console.error("Failed to render page", e);
            } finally {
                if (!isCancelled) setIsRendering(false);
            }
        };
        render();

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdf, pageNumber]);

    return (
        <div 
            className="relative mx-auto shadow-xl bg-white border border-border flex-shrink-0" 
            style={{ width: dimensions.width, height: dimensions.height }}
        >
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full" />
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
                                    alignItems: 'center',
                                    overflow: 'visible', // Ensure text descenders aren't clipped during capture
                                }}
                            >
                                {field.type === 'signature' ? (
                                    <img src={value} alt="Signature" className="w-full h-full object-contain" crossOrigin="anonymous" />
                                ) : (
                                    <span className="text-[14px] px-1 font-medium text-black w-full whitespace-nowrap">
                                        {field.type === 'date' ? format(new Date(value), 'PPP') : value}
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