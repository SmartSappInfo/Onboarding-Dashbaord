'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as pdfjs from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PDFForm, PDFFormField } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import { Loader2 } from 'lucide-react';

// Set up the worker source for pdfjs-dist from a CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PageDetail {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export default function PdfFormRenderer({ pdfForm }: { pdfForm: PDFForm }) {
  const [pages, setPages] = React.useState<PageDetail[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeSignatureField, setActiveSignatureField] = React.useState<string | null>(null);

  const { register, handleSubmit, watch, setValue } = useForm();

  React.useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoadingPdf(true);
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
            pageDetails.push({ canvas, width: viewport.width, height: viewport.height });
          }
        }
        setPages(pageDetails);
      } catch (error) {
        console.error("Failed to load PDF:", error);
        // Handle error display
      } finally {
        setIsLoadingPdf(false);
      }
    };
    loadPdf();
  }, [pdfForm.downloadUrl]);
  
  const onSubmit = (data: any) => {
    setIsSubmitting(true);
    console.log("Form Submitted:", data);
    // Here we will call the Cloud Function in the next step
    setTimeout(() => {
        setIsSubmitting(false);
    }, 2000);
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

  return (
    <div className="max-w-4xl mx-auto">
        {isLoadingPdf && (
             <div className="space-y-4">
                <Skeleton className="w-full h-[80vh]" />
            </div>
        )}
        
        {!isLoadingPdf && pages.length > 0 && (
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
                    {pages.map((page, index) => (
                        <div key={index} className="relative mx-auto shadow-lg" style={{ width: page.width, height: page.height }}>
                            <canvas
                                ref={node => {
                                if (node && !node.firstChild) {
                                    node.getContext('2d')?.drawImage(page.canvas, 0, 0);
                                }
                                }}
                                width={page.width}
                                height={page.height}
                            />
                             <div className="absolute inset-0">
                                {pdfForm.fieldMapping.filter(f => f.pageNumber === index + 1).map(field => (
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
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Submitting...' : 'Submit Document'}
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
