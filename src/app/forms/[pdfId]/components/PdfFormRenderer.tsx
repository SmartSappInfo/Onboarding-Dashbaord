
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import { Loader2, Download, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { regenerateSubmissionPdf, savePdfSubmission } from '@/lib/pdf-actions';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SmartSappLogo } from '@/components/icons';


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
  const { toast } = useToast();

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const { register, handleSubmit, watch, setValue, formState: { isValid } } = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });


  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await import('pdfjs-dist');
            const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
            window.pdfjsLib = pdfjs;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            let description = 'Could not load document. Check the browser console for details.';
            if (error.name === 'NetworkError' || (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch')))) {
                description = 'CORS policy error. The server for the PDF is not configured to allow this application to fetch it.';
            }
            toast({ variant: 'destructive', title: 'Error Loading PDF', description, duration: 15000 });
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
        toast({ title: 'Success!', description: 'Your document is now downloading.' });
        
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
    const commonProps = {
        ...register(field.id),
        style: { width: '100%', height: '100%', padding: '2px 4px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '2px' }
    };
    
    let fieldElement;
    
    switch(field.type) {
        case 'text':
            fieldElement = <Input {...commonProps} style={{ ...commonProps.style }} />;
            break;
        case 'date':
             fieldElement = <Input type="date" {...commonProps} style={{ ...commonProps.style }} />;
             break;
        case 'signature':
            const signatureValue = watch(field.id);
            fieldElement = (
                 <button
                    type="button"
                    onClick={() => setActiveSignatureField(field.id)}
                    style={{ width: '100%', height: '100%', border: '1px dashed #9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '2px' }}
                >
                    {signatureValue ? (
                        <img src={signatureValue} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                    ) : (
                        <span className="text-sm text-gray-500">Click to Sign</span>
                    )}
                </button>
            );
            break;
        default:
            return null;
    }

     return (
        <div className="relative h-full w-full">
            {field.required && <span className="absolute -top-1.5 -right-1.5 z-10 text-red-500 font-bold text-lg">*</span>}
            {fieldElement}
        </div>
    );
  }

  if (isSubmitted) {
    return (
        <div className="text-center py-20 bg-white rounded-lg shadow-xl max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold">Document Submitted Successfully!</h2>
            <p className="text-muted-foreground mt-2 mb-6">Your download should have started automatically. You can close this window.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
       <header className="sticky top-0 z-10 bg-white shadow-sm p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <SmartSappLogo className="h-8" />
                <span className="hidden sm:inline-block font-semibold truncate">{pdfForm.name}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    type="button" 
                    size="lg" 
                    variant="outline"
                    disabled={isSubmitting || isDownloading || !isValid || !!submissionId || isPreview} 
                    onClick={handleSubmit(handleSave)}
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {submissionId ? 'Saved' : 'Save Submission'}
                </Button>
                <Button 
                    type="button" 
                    size="lg" 
                    disabled={isDownloading || !submissionId || isPreview} 
                    onClick={handleDownload}
                >
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download PDF
                </Button>
            </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                {!pdfDoc && (
                     <div className="space-y-4">
                        <Skeleton className="w-full h-[80vh] bg-gray-300" />
                    </div>
                )}
                
                {pdfDoc && (
                    <form id="pdf-form" onSubmit={handleSubmit(handleSave)}>
                        <div className="space-y-4">
                            {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                <PageRenderer
                                    key={index}
                                    pdf={pdfDoc}
                                    pageNumber={index + 1}
                                    fields={pdfForm.fields}
                                    renderField={renderField}
                                />
                            ))}
                        </div>
                    </form>
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

function PageRenderer({ pdf, pageNumber, fields, renderField }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], renderField: (field: PDFFormField) => React.ReactNode }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const textLayerRef = React.useRef<HTMLDivElement>(null);
    const annotationLayerRef = React.useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const render = async () => {
            setIsLoading(true);
            try {
                const pdfjs = await import('pdfjs-dist');
                const pdfjsViewer = await import('pdfjs-dist/web/pdf_viewer.mjs');
                window.pdfjsLib = pdfjs;

                const pdfjsVersion = '4.4.168';
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

                if (!isMounted) return;

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5 });
                setDimensions({ width: viewport.width, height: viewport.height });

                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    if (context) {
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                }

                const textContent = await page.getTextContent();
                if (textLayerRef.current) {
                    textLayerRef.current.innerHTML = '';
                    await pdfjs.renderTextLayer({ textContentSource: textContent, container: textLayerRef.current, viewport });
                }

                if (annotationLayerRef.current) {
                    annotationLayerRef.current.innerHTML = '';
                    const annotations = await page.getAnnotations();
                    const linkService = new pdfjsViewer.PDFLinkService();
                    pdfjsViewer.AnnotationLayer.render({ viewport: viewport.clone({ dontFlip: true }), div: annotationLayerRef.current, annotations, page, linkService, renderForms: false });
                }
            } catch (e) {
                console.error("Failed to render page", e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        render();
        return () => { isMounted = false; };
    }, [pdf, pageNumber]);

    return (
        <div className="relative mx-auto shadow-lg bg-white pdf-page-container" style={{ width: dimensions.width, height: dimensions.height }}>
            {isLoading && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} />
            <div ref={textLayerRef} className="textLayer" />
            <div ref={annotationLayerRef} className="annotationLayer" />
            {!isLoading && (
                <div className="absolute inset-0">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => (
                        <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%` }}>
                            {renderField(field)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

    
