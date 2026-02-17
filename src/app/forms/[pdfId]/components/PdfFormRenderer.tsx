
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import type { PDFForm, PDFFormField } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import { Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateFilledPdf } from '@/lib/pdf-actions';

interface PageDetail {
  dataUrl: string;
  width: number;
  height: number;
}

export default function PdfFormRenderer({ pdfForm, isPreview = false }: { pdfForm: PDFForm, isPreview?: boolean }) {
  const [pages, setPages] = React.useState<PageDetail[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionResult, setSubmissionResult] = React.useState<{ url: string } | null>(null);
  const [activeSignatureField, setActiveSignatureField] = React.useState<string | null>(null);
  const pdfjsRef = React.useRef<any>(null);
  const { toast } = useToast();

  const { register, handleSubmit, watch, setValue } = useForm();

  React.useEffect(() => {
    const loadAndRenderPdf = async () => {
      setIsLoadingPdf(true);
      try {
        if (!pdfjsRef.current) {
          const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
          const pdfjsVersion = '4.4.168';
          pdfjsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
          pdfjsRef.current = pdfjsModule;
        }

        const pdfjs = pdfjsRef.current;
        const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
        const pdfDoc = await loadingTask.promise;
        const pageDetails: PageDetail[] = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            pageDetails.push({
              dataUrl: canvas.toDataURL('image/webp', 0.9),
              width: viewport.width,
              height: viewport.height,
            });
          }
        }
        setPages(pageDetails);
      } catch (error: any) {
        const debugInfo = {
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          pdfUrl: pdfForm.downloadUrl,
          isCorsError: error.name === 'NetworkError' || (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))),
        };
        console.error("DEBUG: PDF Loading Failed. Root Cause Analysis:", JSON.stringify(debugInfo, null, 2));

        let description = 'Could not load document. Check the browser console for details.';
        if (debugInfo.isCorsError) {
            description = 'This is likely a CORS issue. The server holding the PDF is not configured to allow your app to fetch it. The server administrator must update the CORS policy.';
        }

        toast({ 
            variant: 'destructive', 
            title: 'Error Loading PDF',
            description: description,
            duration: 15000,
        });
      } finally {
        setIsLoadingPdf(false);
      }
    };
    
    if (pdfForm.downloadUrl) {
      loadAndRenderPdf();
    }
  }, [pdfForm.downloadUrl, toast]);
  
  const onSubmit = async (data: any) => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    
    setIsSubmitting(true);
    setSubmissionResult(null);

    const result = await generateFilledPdf(pdfForm.id, data);
    
    if (result.success && result.url) {
        toast({ title: 'Success!', description: 'Your document has been generated.' });
        setSubmissionResult({ url: result.url });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to generate the PDF.' });
    }

    setIsSubmitting(false);
  };
  
  const renderField = (field: PDFFormField) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${field.position.x}%`,
        top: `${field.position.y}%`,
        width: `${field.dimensions.width}%`,
        height: `${field.dimensions.height}%`,
    };
    
    const commonProps = {
        ...register(field.id),
        style: { width: '100%', height: '100%', padding: '2px 4px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '2px' }
    };
    
    switch(field.type) {
        case 'text':
            return <Input {...commonProps} style={{ ...commonProps.style }} />;
        case 'date':
             return <Input type="date" {...commonProps} style={{ ...commonProps.style }} />;
        case 'signature':
            const signatureValue = watch(field.id);
            return (
                 <button
                    type="button"
                    onClick={() => setActiveSignatureField(field.id)}
                    style={{...style, border: '1px dashed #9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}
                >
                    {signatureValue ? (
                        <img src={signatureValue} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                    ) : (
                        <span className="text-sm text-gray-500">Click to Sign</span>
                    )}
                </button>
            );
        default:
            return null;
    }
  }

  if (submissionResult) {
    return (
        <div className="text-center py-20 bg-white rounded-lg shadow-xl max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold">Document Submitted Successfully!</h2>
            <p className="text-muted-foreground mt-2 mb-6">You can download your final document below.</p>
            <Button asChild size="lg">
                <a href={submissionResult.url} target="_blank" rel="noopener noreferrer" download={`${pdfForm.name}-signed.pdf`}>
                    <Download className="mr-2 h-5 w-5" />
                    Download Your PDF
                </a>
            </Button>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
        {isLoadingPdf && (
             <div className="space-y-4">
                <Skeleton className="w-full h-[80vh] bg-gray-300" />
            </div>
        )}
        
        {!isLoadingPdf && pages.length > 0 && (
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
                    {pages.map((page, index) => (
                        <div key={index} className="relative mx-auto shadow-lg bg-white" style={{ width: page.width, height: page.height }}>
                             <Image
                                src={page.dataUrl}
                                width={page.width}
                                height={page.height}
                                alt={`Page ${index + 1}`}
                                priority
                            />
                             <div className="absolute inset-0">
                                {pdfForm.fields.filter(f => f.pageNumber === index + 1).map(field => (
                                   <div key={field.id} style={{position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`}}>
                                       {renderField(field)}
                                   </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-8 flex justify-end">
                    <Button type="submit" size="lg" disabled={isSubmitting}>
                        {isSubmitting && !isPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSubmitting && !isPreview ? 'Submitting...' : 'Submit Document'}
                    </Button>
                </div>
            </form>
        )}
        
         <SignaturePadModal
            open={!!activeSignatureField}
            onClose={() => setActiveSignatureField(null)}
            onSave={(dataUrl) => {
                if (activeSignatureField) {
                    setValue(activeSignatureField, dataUrl, { shouldDirty: true });
                }
                setActiveSignatureField(null);
            }}
        />
    </div>
  );
}
