
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { regenerateSubmissionPdf } from '@/lib/pdf-actions';
import { format } from 'date-fns';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea } from '@/components/ui/scroll-area';

// Dynamically import pdfjs-dist
const pdfjsPromise = import('pdfjs-dist');

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { id: pdfId, submissionId } = params;
  const firestore = useFirestore();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId as string);
  }, [firestore, pdfId]);

  const submissionDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId || !submissionId) return null;
    return doc(firestore, `pdfs/${pdfId}/submissions`, submissionId as string);
  }, [firestore, pdfId, submissionId]);

  const { data: pdfForm, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submission, isLoading: isLoadingSubmission } = useDoc<Submission>(submissionDocRef);

  React.useEffect(() => {
    const loadPdf = async () => {
        if (!pdfForm?.downloadUrl) return;
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
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
        const result = await regenerateSubmissionPdf(pdfId as string, submissionId as string);
        if (result.success && result.pdfDataUri) {
            const link = document.createElement('a');
            link.href = result.pdfDataUri;
            link.download = `${pdfForm?.name || 'signed'}-submission.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Download Started' });
        } else {
            toast({ variant: 'destructive', title: 'Error generating PDF', description: result.error });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during generation.' });
    } finally {
        setIsDownloading(false);
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
          <Button onClick={handleDownload} disabled={isLoading || isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Signed PDF
          </Button>
        </div>
      </div>
      <div className="flex-grow bg-muted overflow-hidden relative">
        <ScrollArea className="h-full w-full">
            <div 
                className="p-4 sm:p-8 flex flex-col items-center min-w-full"
                style={{ minWidth: 'fit-content' }}
            >
                <div className="max-w-4xl mx-auto space-y-4">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="w-full aspect-[1/1.41] bg-white shadow-md mb-4 flex-shrink-0" />)
                    ) : pdfDoc && pdfForm && submission ? (
                        Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                            <SubmissionPageRenderer
                                key={index}
                                pdf={pdfDoc}
                                pageNumber={index + 1}
                                fields={pdfForm.fields}
                                formData={submission.formData}
                            />
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full py-20 text-center">
                            <p className="text-muted-foreground">Submission not found or failed to load template.</p>
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SubmissionPageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);

    React.useEffect(() => {
        const render = async () => {
            setIsRendering(true);
            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
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
            } catch (e) {
                console.error("Failed to render page", e);
            } finally {
                setIsRendering(false);
            }
        };
        render();
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
                                }}
                            >
                                {field.type === 'signature' ? (
                                    <img src={value} alt="Signature" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-[14px] px-1 font-medium text-black truncate w-full">
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
