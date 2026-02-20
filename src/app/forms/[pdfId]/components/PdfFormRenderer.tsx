
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
import { Loader2, Download, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { regenerateSubmissionPdf, savePdfSubmission } from '@/lib/pdf-actions';

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
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [submissionId, setSubmissionId] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [activeSignatureField, setActiveSignatureField] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1.5);
  const { toast } = useToast();

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, formState: { isValid, errors } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });

  // Responsive scaling
  React.useEffect(() => {
    const updateScale = () => {
        const containerWidth = window.innerWidth - 64; // Account for padding
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
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            
            const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading PDF', description: 'Could not load document template.', duration: 10000 });
        }
    };
    if (pdfForm.downloadUrl) {
      loadPdf();
    }
  }, [pdfForm.downloadUrl, toast]);
  
  const handleSave = async (data: any) => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    setIsSubmitting(true);
    const result = await savePdfSubmission(pdfForm.id, data);
    if (result.success && result.submissionId) {
        toast({ title: 'Success!', description: 'Your submission has been saved.' });
        setSubmissionId(result.submissionId);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to save your submission.' });
    }
    setIsSubmitting(false);
  };
  
  const handleDownload = async () => {
    if (!submissionId) {
        toast({ title: 'Please Save First', description: 'You must save your submission before you can download it.' });
        return;
    }
    setIsDownloading(true);
    const result = await regenerateSubmissionPdf(pdfForm.id, submissionId);
    if (result.success && result.pdfDataUri) {
        const link = document.createElement('a');
        link.href = result.pdfDataUri;
        link.download = `${pdfForm.name}-signed.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsSubmitted(true);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to generate the PDF.' });
    }
    setIsDownloading(false);
  };
  
  const renderField = (field: PDFFormField) => {
    const error = errors[field.id];
    
    let fieldElement;
    switch(field.type) {
        case 'text':
            fieldElement = (
                <input 
                    {...register(field.id)}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors"
                />
            );
            break;
        case 'date':
             fieldElement = (
                <input 
                    type="date" 
                    {...register(field.id)}
                    className="w-full h-full p-1 border rounded bg-white/90 focus:bg-white text-[14px] transition-colors" 
                />
             );
             break;
        case 'signature':
            const signatureValue = watch(field.id);
            fieldElement = (
                 <button
                    type="button"
                    onClick={() => setActiveSignatureField(field.id)}
                    className="w-full h-full border border-dashed border-muted-foreground rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors overflow-hidden"
                >
                    {signatureValue ? (
                        <img src={signatureValue} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase">Sign</span>
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

  if (isSubmitted) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="text-center py-12 px-8 bg-card rounded-xl shadow-2xl max-w-md w-full border border-border">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">All Done!</h2>
                <p className="text-muted-foreground mt-3 mb-8">Your signed document has been generated and downloaded. You can now securely close this window.</p>
                <Button onClick={() => window.close()} variant="outline" className="w-full">Close Window</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-muted/20">
       <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center shadow-sm">
            <div className="flex-1 flex justify-center">
                <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">{pdfForm.name}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    type="button" 
                    size="sm" 
                    variant={submissionId ? "outline" : "default"}
                    disabled={isSubmitting || isDownloading || !isValid || !!submissionId || isPreview} 
                    onClick={handleSubmit(handleSave)}
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {submissionId ? 'Saved' : 'Save'}
                </Button>
                <Button 
                    type="button" 
                    size="sm" 
                    disabled={isDownloading || !submissionId || isPreview} 
                    onClick={handleDownload}
                >
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Submit
                </Button>
            </div>
        </header>

        <main className="flex-grow overflow-auto p-4 sm:p-8">
            <div className="max-w-fit mx-auto">
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
                // Use intrinsic rotation from the PDF metadata
                const viewport = page.getViewport({ scale, rotation: page.rotate });
                
                if (!isMounted) return;
                setDimensions({ width: viewport.width, height: viewport.height });

                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        // Render standard canvas using PDF.js native coordinate system
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
            className="relative shadow-2xl bg-white border border-border transition-all duration-300" 
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
