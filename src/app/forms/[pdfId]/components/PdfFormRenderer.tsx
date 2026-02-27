
'use client';

import * as React from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
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
import { SmartSappIcon, SmartSappLogo } from '@/components/icons';
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
import { Slider } from '@/components/ui/slider';

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

const generateValidationSchema = (fields: PDFFormField[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        let fieldSchema: z.ZodTypeAny = z.string().optional().nullable().or(z.literal(''));
        
        if (field.type === 'email') {
            const emailSchema = z.string().email({ message: "Please enter a valid email address." });
            fieldSchema = field.required ? emailSchema : emailSchema.optional().or(z.literal(''));
        } else if (field.type === 'phone') {
            const phoneSchema = z.string().regex(/^\+?[\d\s\-()]{10,}$/, "Please enter a valid phone number (at least 10 digits).");
            fieldSchema = field.required ? phoneSchema : phoneSchema.optional().or(z.literal(''));
        } else if (field.required) {
            fieldSchema = z.string({
                required_error: `${field.label || 'This field'} is required.`
            }).min(1, { message: `${field.label || 'This field'} is required.` });
        }
        
        acc[field.id] = fieldSchema;
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
  
  const [mediaCaptureState, setMediaCaptureState] = React.useState<{ fieldId: string, mode: 'signature' | 'photo' } | null>(null);
  
  const [zoom, setZoom] = React.useState(1.0);
  const [baseScale, setBaseScale] = React.useState(1.3);
  
  const touchStartDist = React.useRef<number | null>(null);
  const startZoom = React.useRef<number>(1.0);
  const zoomRef = React.useRef(zoom);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingFormData, setPendingFormData] = React.useState<any>(null);

  const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
  const [missingFields, setMissingFields] = React.useState<{ id: string, label: string }[]>([]);

  const pageContainerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, getValues, formState: { isValid, errors } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });

  const watchedValues = watch();

  // Auto-populate date and time on mount
  React.useEffect(() => {
    const now = new Date();
    const currentDate = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'HH:mm');

    pdfForm.fields.forEach(field => {
      const currentValue = getValues(field.id);
      if (!currentValue) {
        if (field.type === 'date') {
          setValue(field.id, currentDate, { shouldValidate: true });
        } else if (field.type === 'time') {
          setValue(field.id, currentTime, { shouldValidate: true });
        }
      }
    });
  }, [pdfForm.fields, setValue, getValues]);

  React.useEffect(() => {
    pdfForm.fields.forEach(field => {
        register(field.id);
    });
  }, [pdfForm.fields, register]);

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

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        touchStartDist.current = dist;
        startZoom.current = zoomRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist.current !== null) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const factor = dist / touchStartDist.current;
        const newZoom = Math.min(Math.max(startZoom.current * factor, 0.5), 3.0);
        setZoom(newZoom);
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
    };
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
        setValidationErrors(missing);
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

  const renderField = (field: PDFFormField) => {
    const value = watchedValues[field.id];
    const currentTotalScale = baseScale * zoom;
    const dynamicFontSize = `${Math.round(10 * currentTotalScale)}px`;
    
    if (isSubmitted) {
        return (
            <div className="w-full h-full flex items-start justify-start overflow-visible">
                {(field.type === 'signature' || field.type === 'photo') ? (
                    value && <img src={value} alt="Media" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
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
        case 'phone':
        case 'email':
            fieldElement = (
                <input 
                    {...register(field.id)}
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    placeholder={field.placeholder}
                    disabled={isSubmitting}
                    style={{ fontSize: dynamicFontSize }}
                    className={cn(inputClasses, errors[field.id] && "border-destructive ring-1 ring-destructive/20")}
                />
            );
            break;
        case 'date':
        case 'time':
             fieldElement = (
                <input 
                    type={field.type === 'time' ? 'time' : 'date'}
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
        case 'photo':
            fieldElement = (
                 <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setMediaCaptureState({ fieldId: field.id, mode: field.type === 'photo' ? 'photo' : 'signature' })}
                    className={cn(
                        "w-full h-full border border-dashed rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden",
                        errors[field.id] ? "border-destructive bg-destructive/5" : "border-muted-foreground"
                    )}
                >
                    {value ? (
                        <img src={value} alt="Captured" className="w-full h-full object-contain" />
                    ) : (
                        <span 
                            className="text-muted-foreground font-medium uppercase text-center px-1"
                            style={{ fontSize: `${Math.max(6, Math.round(8 * currentTotalScale))}px` }}
                        >
                            {field.placeholder || (field.type === 'photo' ? 'Tap to Capture' : 'Sign Here')}
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
                                        Done
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
                            {isDownloading ? <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Signed PDF
                        </Button>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-grow relative overflow-hidden overscroll-behavior-none bg-muted/30">
            <ScrollArea 
                className="h-full w-full"
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

            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
                <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border border-primary/20 py-4 px-2 shadow-2xl h-48">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-full mb-2 shrink-0" 
                                    onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                                >
                                    <ZoomIn className="h-4 w-4 text-primary" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Zoom In</TooltipContent>
                        </Tooltip>
                        
                        <Slider
                            orientation="vertical"
                            min={0.5}
                            max={3.0}
                            step={0.05}
                            value={[zoom]}
                            onValueChange={([val]) => setZoom(val)}
                            className="flex-grow py-2"
                        />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-full mt-2 shrink-0" 
                                    onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                                >
                                    <ZoomOut className="h-4 w-4 text-primary" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Zoom Out</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20">
                    {Math.round(zoom * 100)}%
                </div>
            </div>
        </main>
        
         <footer className="py-6 text-center text-xs sm:text-sm text-muted-foreground bg-background border-t shrink-0 print:hidden relative z-10">
            <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
            <p>&copy; {new Date().getFullYear()} SmartSapp</p>
        </footer>

         <SignaturePadModal
            open={!!mediaCaptureState}
            onClose={() => setMediaCaptureState(null)}
            onSave={(dataUrl) => {
                if (mediaCaptureState) {
                    setValue(mediaCaptureState.fieldId, dataUrl, { shouldDirty: true, shouldValidate: true });
                }
                setMediaCaptureState(null);
            }}
            mode={mediaCaptureState?.mode || 'signature'}
        />

        <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <DialogTitle className="text-center text-xl font-bold">Required Fields Missing</DialogTitle>
                    <DialogDescription className="text-center pt-2 text-sm font-medium">
                        Please complete the following fields before submitting the document:
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[30vh] border rounded-md my-4">
                    <ul className="p-4 space-y-3">
                        {missingFields.map((field, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-sm font-medium">
                                <div className="h-2 w-2 rounded-full bg-destructive" />
                                <span className="font-bold">{field.label}</span>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={handleOkMissingFields} className="w-full font-bold h-12 rounded-xl text-base">OK, take me there</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

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
                    <AlertDialogDescription asChild>
                        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                            {hasSignature ? (
                                <div className="space-y-4">
                                    <div className="font-semibold text-foreground">Important Legal Notice:</div>
                                    <div>By confirming, you acknowledge that the electronic signatures provided in this document are the legally binding equivalent of your handwritten signature.</div>
                                    <div className="bg-muted p-3 rounded-md text-xs italic">
                                        "I understand that this electronic record has the same legal effect, validity, and enforceability as a manually signed paper document."
                                    </div>
                                </div>
                            ) : (
                                <div>Are you ready to submit your responses? Please review your entries one last time.</div>
                            )}
                            <div className="text-destructive font-medium border-t pt-4 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                This submission is final and irreversible.
                            </div>
                        </div>
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
            {dimensions.width > 0 && (
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
