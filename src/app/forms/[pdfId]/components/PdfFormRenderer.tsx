'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import { Loader2, Download, CheckCircle2, Send, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';

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
  
  const pageContainerRef = React.useRef<HTMLDivElement>(null);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, formState: { isValid, errors } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });

  const watchedValues = watch();

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
            
            // Set worker source
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
  
  const onSubmit = async (data: any) => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const response = await fetch('/api/pdfs/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: pdfForm.id, formData: data }),
        });

        const result = await response.json();

        if (response.ok) {
            setSubmissionId(result.submissionId);
            setIsSubmitted(true);
            toast({ title: 'Submission Successful', description: 'Your data has been securely saved.' });
            
            // Update URL to prevent accidental resubmission on refresh
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
    
    if (isSubmitted) {
        return (
            <div className="w-full h-full flex items-start justify-start overflow-visible">
                {field.type === 'signature' ? (
                    value && <img src={value} alt="Signature" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                ) : (
                    <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap bg-transparent">
                        {field.type === 'date' && value ? format(new Date(value), 'PPP') : value}
                    </span>
                )}
            </div>
        );
    }

    let fieldElement;
    switch(field.type) {
        case 'text':
            fieldElement = (
                <input 
                    {...register(field.id)}
                    disabled={isSubmitting}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors disabled:opacity-80"
                />
            );
            break;
        case 'date':
             fieldElement = (
                <input 
                    type="date" 
                    {...register(field.id)}
                    disabled={isSubmitting}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors disabled:opacity-80" 
                />
             );
             break;
        case 'signature':
            fieldElement = (
                 <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setActiveSignatureField(field.id)}
                    className="w-full h-full border border-dashed border-muted-foreground rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden"
                >
                    {value ? (
                        <img src={value} alt="Signature" className="w-full h-full object-contain" />
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
       <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">{pdfForm.name}</span>
            </div>
            <div className="flex items-center gap-2">
                {!isSubmitted ? (
                    <Button 
                        type="button" 
                        size="sm" 
                        disabled={isSubmitting || isPreview || !isValid} 
                        onClick={handleSubmit(onSubmit)}
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
                            Download Signed PDF
                        </Button>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-grow relative overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div 
                    ref={pageContainerRef}
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
                                <div key={index} className="page-capture-wrapper">
                                    <PageRenderer
                                        pdf={pdfDoc}
                                        pageNumber={index + 1}
                                        fields={pdfForm.fields}
                                        renderField={renderField}
                                        scale={scale}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
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
    </div>
  );
}

function PageRenderer({ pdf, pageNumber, fields, renderField, scale }: { 
    pdf: PDFDocumentProxy; 
    pageNumber: number; 
    fields: PDFFormField[]; 
    renderField: (field: PDFFormField) => React.KeepNode;
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