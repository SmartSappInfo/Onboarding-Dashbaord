
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField, School } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2, Monitor, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';

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

  // Fetch school data for variable resolution
  const schoolDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfForm?.schoolId) return null;
    return doc(firestore, 'schools', pdfForm.schoolId);
  }, [firestore, pdfForm?.schoolId]);
  const { data: school } = useDoc<School>(schoolDocRef);

  // Phase 2: Dynamic Label Resolution - Ensure ID segment is replaced with Name
  useSetBreadcrumb(pdfForm?.name, `/admin/pdfs/${pdfId}`);

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
        const fileName = `${pdfForm?.name || 'signed'}-submission.pdf`;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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
        
        const pdfBundle = await PDFDocument.create();
        const pageElements = pageContainerRef.current?.querySelectorAll('.page-capture-wrapper');
        
        if (!pageElements || !pageElements.length) {
            throw new Error("No pages found to capture.");
        }

        toast({ title: 'Preparing Front-end Download', description: 'Capturing pages as images...' });

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            const captureScale = isIOS ? 1.5 : 2;
            
            const canvas = await html2canvas(el, {
                scale: captureScale,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            const image = await pdfBundle.embedJpg(imgBytes);
            
            const page = pdfBundle.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }

        const pdfBytes = await pdfBundle.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const fileName = `${pdfForm?.name || 'signed'}-frontend-capture.pdf`;

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
    <div className="h-full overflow-hidden flex flex-col bg-muted/10">
       <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card shadow-sm h-14 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-black uppercase tracking-tight truncate px-2">
              {isLoadingSubmission ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <span className="truncate flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {submission ? format(new Date(submission.submittedAt), "MMM d, yyyy · p") : 'Submission'}
                </span>
              )}
            </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pr-2">
          <Button variant="outline" size="sm" onClick={handleFrontEndDownload} disabled={isLoading || isFrontEndDownloading} className="h-9 hidden md:flex rounded-xl font-bold">
            {isFrontEndDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Monitor className="mr-2 h-4 w-4" />}
            Snapshot
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={isLoading || isDownloading} className="h-9 rounded-xl font-black shadow-lg px-6 uppercase text-[10px] tracking-widest">
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Signed Copy
          </Button>
        </div>
      </div>
      <div className="flex-grow bg-muted/30 overflow-hidden relative">
        <ScrollArea className="h-full w-full print-area">
            <div 
                ref={pageContainerRef}
                className="p-4 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y"
                style={{ minWidth: 'fit-content' }}
            >
                <div className="max-w-4xl mx-auto space-y-4 print:space-y-0">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton className="w-[8.5in] h-[11in] bg-white shadow-md mb-4 flex-shrink-0" key={i} />)
                    ) : pdfDoc && pdfForm && submission ? (
                        Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                            <div key={index} className="page-capture-wrapper mb-4 print:mb-0">
                                <SubmissionPageRenderer
                                    pdf={pdfDoc}
                                    pageNumber={index + 1}
                                    fields={pdfForm.fields}
                                    formData={submission.formData}
                                    school={school || undefined}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                            <Monitor className="h-12 w-12 mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-xs">Submission detail unavailable</p>
                        </div>
                    )}
                </div>
            </div>
            <ScrollBar orientation="horizontal" className="print:hidden" />
        </ScrollArea>
      </div>
    </div>
  );
}

function SubmissionPageRenderer({ pdf, pageNumber, fields, formData, school }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any }, school?: School }) {
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
                // Standard scale for detail view is 1.5
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
                        let value = formData[field.id];
                        
                        // Handle Static Labels and Dynamic Variables
                        if (field.type === 'static-text') {
                            value = field.staticText;
                        } else if (field.type === 'variable') {
                            value = `{{${field.variableKey}}}`;
                            if (school && field.variableKey) {
                                const currency = school.currency || 'GHS';
                                const rate = school.subscriptionRate || 0;
                                const roll = school.nominalRoll || 0;
                                
                                switch(field.variableKey) {
                                    case 'school_name': value = school.name; break;
                                    case 'school_initials': value = school.initials || ''; break;
                                    case 'school_location': value = school.location || ''; break;
                                    case 'school_phone': value = school.phone || ''; break;
                                    case 'school_email': value = school.email || ''; break;
                                    case 'contact_name': value = school.contactPerson || ''; break;
                                    case 'school_package': value = school.subscriptionPackageName || 'Standard'; break;
                                    case 'subscription_rate': value = `${currency} ${rate.toLocaleString()}`; break;
                                    case 'subscription_total': value = `${currency} ${(rate * roll).toLocaleString()}`; break;
                                    case 'nominal_roll': value = roll.toLocaleString(); break;
                                    case 'arrears_balance': value = `${currency} ${(school.arrearsBalance || 0).toLocaleString()}`; break;
                                }
                            }
                        }

                        if (!value) return null;

                        // Font size is synchronized with the 1.5x display scale
                        const dynamicFontSize = `${Math.round((field.fontSize || 11) * 1.5)}px`;
                        const verticalAlign = field.verticalAlignment || 'center';

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
                                    flexDirection: 'column',
                                    alignItems: field.alignment === 'center' ? 'center' : field.alignment === 'right' ? 'flex-end' : 'flex-start',
                                    justifyContent: verticalAlign === 'center' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
                                    overflow: 'visible',
                                }}
                            >
                                {field.type === 'signature' ? (
                                    <img src={value} alt="Signature" className="w-full h-full object-contain" crossOrigin="anonymous" />
                                ) : (
                                    <span 
                                        className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold text-black" : "font-medium text-black/80")}
                                        style={{ fontSize: dynamicFontSize, textAlign: field.alignment || 'left' }}
                                    >
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
