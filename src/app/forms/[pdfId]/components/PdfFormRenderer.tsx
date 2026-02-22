
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import { Loader2, Download, CheckCircle2, Send, ShieldAlert, AlertTriangle, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { SmartSappIcon } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

const generateValidationSchema = (fields: PDFFormField[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        if (field.required) {
            acc[field.id] = z.string({
                required_error: `${field.label || 'This field'} is required.`
            }).min(1, { message: `${field.label || 'This field'} is required.` });
        }
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);
    return z.object(schemaObject);
}

export default function PdfFormRenderer({ pdfForm, isPreview = false }: { pdfForm: PDFForm, isPreview?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [submissionId, setSubmissionId] = React.useState<string | null>(searchParams.get('submissionId'));
  const [isSubmitted, setIsSubmitted] = React.useState(!!searchParams.get('submissionId'));
  const [activeSignatureField, setActiveSignatureField] = React.useState<string | null>(null);
  
  // Scale and Zoom
  const [zoom, setZoom] = React.useState(1.0);
  const [baseScale, setBaseScale] = React.useState(1.3);
  
  // Pinch-to-zoom logic
  const touchStartDist = React.useRef<number | null>(null);
  const startZoom = React.useRef<number>(1.0);

  // Confirmation Dialog State
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingFormData, setPendingFormData] = React.useState<any>(null);

  // Missing Fields Modal State
  const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
  const [missingFields, setMissingFields] = React.useState<{ id: string, label: string }[]>([]);

  const pageContainerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, formState: { isValid, errors } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });

  const watchedValues = watch();

  // Determine base scale based on screen size
  React.useEffect(() => {
    const updateBaseScale = () => {
        if (typeof window !== 'undefined') {
            const width = window.innerWidth;
            if (width < 640) setBaseScale(0.9);
            else if (width < 1024) setBaseScale(1.1);
            else setBaseScale(1.3);
        }
    };
    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
  }, []);

  // Robust Zoom Interception (Ctrl + Scroll / Touchpad Pinch)
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const zoomStep = 0.1;
        const factor = delta > 0 ? 1 + zoomStep : 1 - zoomStep;
        setZoom(prev => Math.min(Math.max(prev * factor, 0.5), 3.0));
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading PDF', description: 'Could not load document template.' });
        }
    };
    if (pdfForm.downloadUrl) {
      loadPdf();
    }
  }, [pdfForm.downloadUrl, toast]);
  
  const handlePreSubmit = (data: any) => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  const onInvalid = (errors: any) => {
    const missing = pdfForm.fields
        .filter(f => errors[f.id])
        .map(f => ({ id: f.id, label: f.label || f.placeholder || 'Unnamed Field' }));
    
    if (missing.length > 0) {
        setMissingFields(missing);
        setShowMissingFieldsModal(true);
    }
  };

  const handleOkMissingFields = () => {
    setShowMissingFieldsModal(false);
    if (missingFields.length > 0) {
        const firstId = missingFields[0].id;
        const element = document.getElementById(firstId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = element.querySelector('input, select, textarea, button');
            if (input instanceof HTMLElement) {
                input.focus();
            }
        }
    }
  };

  const onConfirmSubmission = async () => {
    if (!pendingFormData) return;
    
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
        const response = await fetch('/api/pdfs/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: pdfForm.id, formData: pendingFormData }),
        });

        const result = await response.json();

        if (response.ok) {
            setSubmissionId(result.submissionId);
            setIsSubmitted(true);
            toast({ title: 'Submission Successful', description: 'Your data has been securely saved.' });
            
            const params = new URLSearchParams(searchParams);
            params.set('submissionId', result.submissionId);
            router.replace(`${pathname}?${params.toString()}`);
        } else {
            throw new Error(result.error || 'Failed to submit form.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Submission Error', description: e.message });
    } finally {
        setIsSubmitting(false);
        setPendingFormData(null);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { PDFDocument } = await import('pdf-lib');
        
        const pdfDoc = await PDFDocument.create();
        const pageElements = pageContainerRef.current?.querySelectorAll('.page-capture-wrapper');
        
        if (!pageElements || !pageElements.length) {
            throw new Error("No pages found to capture. Please ensure the document is fully loaded.");
        }

        toast({ title: 'Preparing Download', description: 'Processing document pages...' });

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            
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
        a.download = `${pdfForm.name || 'signed'}-document.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Download Successful' });
    } catch (e: any) {
        console.error("Download error:", e);
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    } finally {
        setIsDownloading(false);
    }
  };

  // Pinch Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDist.current = dist;
      startZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const factor = dist / touchStartDist.current;
      const newZoom = Math.min(Math.max(startZoom.current * factor, 0.5), 3.0);
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  const renderField = (field: PDFFormField) => {
    const value = watchedValues[field.id];
    const currentTotalScale = baseScale * zoom;
    
    const dynamicFontSize = `${Math.round(10 * currentTotalScale)}px`;
    
    if (isSubmitted) {
        return (
            <div className="w-full h-full flex items-start justify-start overflow-visible">
                {field.type === 'signature' ? (
                    value && <img src={value} alt="Signature" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                ) : (
                    <span 
                        className="px-1 font-medium text-black whitespace-nowrap bg-transparent"
                        style={{ fontSize: dynamicFontSize }}
                    >
                        {field.type === 'date' && value ? format(new Date(value), 'PPP') : value}
                    </span>
                )}
            </div>
        );
    }

    let fieldElement;
    const inputClasses = "w-full h-full p-1 border rounded bg-white/90 focus:bg-white transition-colors disabled:opacity-80 placeholder:italic placeholder:text-muted-foreground/60 text-left align-top";
    
    switch(field.type) {
        case 'text':
            fieldElement = (
                <input 
                    {...register(field.id)}
                    placeholder={field.placeholder}
                    disabled={isSubmitting}
                    style={{ fontSize: dynamicFontSize }}
                    className={cn(inputClasses, errors[field.id] && "border-destructive ring-1 ring-destructive/20")}
                />
            );
            break;
        case 'date':
             fieldElement = (
                <input 
                    type="date" 
                    {...register(field.id)}
                    disabled={isSubmitting}
                    style={{ fontSize: dynamicFontSize }}
                    className={cn(inputClasses, errors[field.id] && "border-destructive ring-1 ring-destructive/20")} 
                />
             );
             break;
        case 'dropdown':
            fieldElement = (
                <select
                    {...register(field.id)}
                    disabled={isSubmitting}
                    style={{ fontSize: dynamicFontSize }}
                    className={cn(inputClasses, errors[field.id] && "border-destructive ring-1 ring-destructive/20")}
                >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {(field.options || []).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                    ))}
                </select>
            );
            break;
        case 'signature':
            fieldElement = (
                 <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setActiveSignatureField(field.id)}
                    className={cn(
                        "w-full h-full border border-dashed rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden",
                        errors[field.id] ? "border-destructive bg-destructive/5" : "border-muted-foreground"
                    )}
                >
                    {value ? (
                        <img src={value} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                        <span 
                            className="text-muted-foreground font-medium uppercase text-center"
                            style={{ fontSize: `${Math.round(8 * currentTotalScale)}px` }}
                        >
                            {field.placeholder || 'Sign Here'}
                        </span>
                    )}
                </button>
            );
            break;
        default:
            return null;
    }

     return (
        <div className="relative h-full w-full">
            {fieldElement}
        </div>
    );
  }

  const hasSignature = pdfForm.fields.some(f => f.type === 'signature');

  return (
    <div className="flex flex-col h-[100dvh] bg-muted/20 overflow-hidden text-foreground selection:bg-primary/20">
       <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center gap-3 shadow-sm shrink-0">
            <SmartSappIcon className="h-8 w-8 text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
                <h1 className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md leading-tight text-sm sm:text-base">{pdfForm.name}</h1>
                <p className="text-[10px] text-muted-foreground leading-none">Powered by SmartSapp</p>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
                {!isSubmitted ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="inline-block">
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        disabled={isSubmitting || isPreview} 
                                        onClick={handleSubmit(handlePreSubmit, onInvalid)}
                                    >
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Submit Form
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            {!isValid && (
                                <TooltipContent>
                                    <p>Please complete all required fields before submitting.</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 hidden sm:block" />
                        <Button 
                            type="button" 
                            size="sm" 
                            disabled={isDownloading} 
                            onClick={handleDownload}
                        >
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Signed PDF
                        </Button>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-grow relative overflow-hidden overscroll-behavior-none">
            <ScrollArea 
                className="h-full w-full"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                viewportRef={viewportRef}
            >
                <div 
                    ref={pageContainerRef}
                    className="p-2 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y" 
                    style={{ minWidth: 'fit-content' }}
                >
                    {!pdfDoc ? (
                         <div className="space-y-4">
                            <Skeleton className="w-[8.5in] h-[11in] max-w-full rounded-lg shadow-lg bg-card" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 sm:gap-8 pb-24">
                            {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                <div key={index} className="page-capture-wrapper">
                                    <PageRenderer
                                        pdf={pdfDoc}
                                        pageNumber={index + 1}
                                        fields={pdfForm.fields}
                                        renderField={renderField}
                                        scale={baseScale * zoom}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
                <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-sm rounded-full overflow-hidden">
                    <CardContent className="p-1 flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full h-9 w-9" 
                            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-bold w-12 text-center select-none tabular-nums">
                            {Math.round(zoom * 100)}%
                        </span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full h-9 w-9" 
                            onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))}
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </main>
        
         <SignaturePadModal
            open={!!activeSignatureField}
            onClose={() => setActiveSignatureField(null)}
            onSave={(dataUrl) => {
                if (activeSignatureField) {
                    setValue(activeSignatureField, dataUrl, { shouldDirty: true, shouldValidate: true });
                }
                setActiveSignatureField(null);
            }}
        />

        {/* Missing Fields Modal */}
        <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <DialogTitle className="text-center text-xl">Required Fields Missing</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        Please complete the following fields before submitting the document:
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[30vh] border rounded-md my-4">
                    <ul className="p-4 space-y-2">
                        {missingFields.map((field, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                <span>{field.label}</span>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={handleOkMissingFields} className="w-full">OK, take me there</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        {hasSignature ? (
                            <div className="bg-primary/10 p-2 rounded-full">
                                <ShieldAlert className="h-6 w-6 text-primary" />
                            </div>
                        ) : (
                            <div className="bg-yellow-100 p-2 rounded-full">
                                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                            </div>
                        )}
                        <AlertDialogTitle>Confirm Final Submission</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="space-y-4 pt-2">
                        {hasSignature ? (
                            <>
                                <p className="font-semibold text-foreground">Important Legal Notice:</p>
                                <p>By confirming, you acknowledge that the electronic signatures provided in this document are the legally binding equivalent of your handwritten signature.</p>
                                <p className="bg-muted p-3 rounded-md text-xs italic">
                                    "I understand that this electronic record has the same legal effect, validity, and enforceability as a manually signed paper document."
                                </p>
                            </>
                        ) : (
                            <p>Are you ready to submit your responses? Please review your entries one last time.</p>
                        )}
                        <p className="text-destructive font-medium border-t pt-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            This submission is final and irreversible.
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancel and Review</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={onConfirmSubmission} 
                        disabled={isSubmitting}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Confirm and Submit
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

function PageRenderer({ pdf, pageNumber, fields, renderField, scale }: { 
    pdf: PDFDocumentProxy; 
    pageNumber: number; 
    fields: PDFFormField[]; 
    renderField: (field: PDFFormField) => React.ReactNode;
    scale: number;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const [isRendering, setIsRendering] = React.useState(true);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const render = async () => {
            setIsRendering(true);
            try {
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale, rotation: page.rotate });
                
                if (!isMounted) return;
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
                console.error(`Failed to render page ${pageNumber}`, e);
            } finally {
                if (isMounted) setIsRendering(false);
            }
        };
        render();
        return () => { 
            isMounted = false; 
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdf, pageNumber, scale]);

    return (
        <div 
            className="relative shadow-2xl bg-white border border-border transition-all duration-300 flex-shrink-0" 
            style={{ width: dimensions.width, height: dimensions.height }}
        >
            {isRendering && <Skeleton className="absolute inset-0 z-10" />}
            <canvas ref={canvasRef} className="block w-full h-full" />
            {!isRendering && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => (
                        <div 
                            key={field.id} 
                            id={field.id}
                            className="pointer-events-auto"
                            style={{ 
                                position: 'absolute', 
                                left: `${field.position.x}%`, 
                                top: `${field.position.y}%`, 
                                width: `${field.dimensions.width}%`, 
                                height: `${field.dimensions.height}%` 
                            }}
                        >
                            {renderField(field)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
