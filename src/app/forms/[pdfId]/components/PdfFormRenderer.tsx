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
import { Loader2, Download, CheckCircle2, Send, Database, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
  const [scale, setScale] = React.useState(1.5);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState(false);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const defaultValues = React.useMemo(() => {
    const defaults: Record<string, any> = {};
    pdfForm.fields.forEach(f => {
        defaults[f.id] = '';
    });
    return defaults;
  }, [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, getValues, formState: { isValid, errors } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues,
  });

  React.useEffect(() => {
    const updateScale = () => {
        const containerWidth = window.innerWidth - 64; 
        if (containerWidth < 600) setScale(containerWidth / 600);
        else setScale(1.5);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            
            // Set worker and suppress non-critical font warnings
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            (pdfjs as any).verbosity = 0; 
            
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
  
  const handleFinalSubmit = async () => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    
    setIsSubmitting(true);
    setIsPreviewModalOpen(false);

    try {
        const currentValues = getValues();
        const formData: Record<string, any> = {};
        
        pdfForm.fields.forEach(field => {
            formData[field.id] = currentValues[field.id] !== undefined && currentValues[field.id] !== '' ? currentValues[field.id] : null;
        });

        const payload = { pdfId: pdfForm.id, formData };
        const response = await fetch('/api/pdfs/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.submissionId) {
            setSubmissionId(data.submissionId);
            setIsSubmitted(true);
            toast({ title: 'Submission Successful', description: 'Your data has been securely saved.' });
            
            const params = new URLSearchParams(searchParams);
            params.set('submissionId', data.submissionId);
            router.replace(`${pathname}?${params.toString()}`);
        } else {
            throw new Error(data.error || 'Failed to submit form.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Submission Error', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const getFullFormDataJson = () => {
      const currentValues = getValues();
      const payload: Record<string, any> = {};
      
      pdfForm.fields.forEach(field => {
          payload[field.id] = currentValues[field.id] !== undefined && currentValues[field.id] !== '' ? currentValues[field.id] : null;
      });

      return JSON.stringify(payload, null, 2);
  };
  
  const handleDownload = async () => {
    if (!submissionId) return;
    
    setIsDownloading(true);
    try {
        const response = await fetch(`/api/pdfs/${pdfForm.id}/generate/${submissionId}`);
        if (!response.ok) throw new Error('Failed to generate PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pdfForm.name}-signed.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Download Complete' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    } finally {
        setIsDownloading(false);
    }
  };
  
  const renderField = (field: PDFFormField) => {
    const signatureValue = watch(field.id);
    const isLocked = isSubmitted || isSubmitting;
    
    let fieldElement;
    switch(field.type) {
        case 'text':
            fieldElement = (
                <input 
                    {...register(field.id)}
                    disabled={isLocked}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors disabled:opacity-80 disabled:bg-gray-50"
                />
            );
            break;
        case 'date':
             fieldElement = (
                <input 
                    type="date" 
                    {...register(field.id)}
                    disabled={isLocked}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors disabled:opacity-80 disabled:bg-gray-50" 
                />
             );
             break;
        case 'signature':
            fieldElement = (
                 <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setActiveSignatureField(field.id)}
                    className="w-full h-full border border-dashed border-muted-foreground rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden disabled:cursor-default"
                >
                    {signatureValue ? (
                        <img src={signatureValue} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase">Sign Here</span>
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

  return (
    <div className="flex flex-col h-screen bg-muted/20 overflow-hidden">
       <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center shadow-sm shrink-0">
            <div className="flex-1 flex items-center gap-2">
                {!isSubmitted && (
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Code className="mr-2 h-4 w-4" />
                        Review Data
                    </Button>
                )}
            </div>
            
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-md text-center">{pdfForm.name}</span>
            </div>

            <div className="flex-1 flex items-center justify-end gap-2">
                {!isSubmitted ? (
                    <Button 
                        type="button" 
                        size="sm" 
                        disabled={isSubmitting || isPreview} 
                        onClick={handleFinalSubmit}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Submit Form
                    </Button>
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
                            Download PDF
                        </Button>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-grow relative overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div 
                    className="p-4 sm:p-8 flex flex-col items-center min-w-full" 
                    style={{ minWidth: 'fit-content' }}
                >
                    {!pdfDoc ? (
                         <div className="space-y-4">
                            <Skeleton className="w-[8.5in] h-[11in] max-w-full rounded-lg shadow-lg bg-card" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8 pb-20">
                            {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                <PageRenderer
                                    key={index}
                                    pdf={pdfDoc}
                                    pageNumber={index + 1}
                                    fields={pdfForm.fields}
                                    renderField={renderField}
                                    scale={scale}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
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

        <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Submission Payload Preview
                    </DialogTitle>
                    <DialogDescription>
                        This is the raw structured data that will be stored in Firestore for this document.
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="flex-grow bg-zinc-950 rounded-md p-4 mt-4 font-mono text-xs text-green-400">
                    <pre className="whitespace-pre-wrap break-all">
                        {getFullFormDataJson()}
                    </pre>
                </ScrollArea>

                <DialogFooter className="mt-6 gap-2">
                    <Button variant="ghost" onClick={() => setIsPreviewModalOpen(false)}>
                        Close
                    </Button>
                    <Button 
                        onClick={handleFinalSubmit}
                        disabled={isSubmitting || isPreview}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Save and Submit Data
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    const [isRendering, setIsRendering] = React.useState(true);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const render = async () => {
            setIsRendering(true);
            try {
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
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                }
            } catch (e) {
                console.error(`Failed to render page ${pageNumber}`, e);
            } finally {
                if (isMounted) setIsRendering(false);
            }
        };
        render();
        return () => { isMounted = false; };
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