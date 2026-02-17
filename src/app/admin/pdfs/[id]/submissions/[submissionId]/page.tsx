
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { regenerateSubmissionPdf } from '@/lib/pdf-actions';

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { id: pdfId, submissionId } = params;
  const firestore = useFirestore();

  const [pdfDataUri, setPdfDataUri] = React.useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);

  const submissionDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId || !submissionId) return null;
    return doc(firestore, `pdfs/${pdfId}/submissions`, submissionId as string);
  }, [firestore, pdfId, submissionId]);

  const { data: submission, isLoading: isLoadingSubmission } = useDoc<Submission>(submissionDocRef);

  React.useEffect(() => {
    if (pdfId && submissionId) {
      setIsLoadingPdf(true);
      regenerateSubmissionPdf(pdfId as string, submissionId as string)
        .then(result => {
          if (result.success && result.pdfDataUri) {
            setPdfDataUri(result.pdfDataUri);
          } else {
            toast({ variant: 'destructive', title: 'Error loading PDF', description: result.error });
          }
        })
        .finally(() => {
          setIsLoadingPdf(false);
        });
    }
  }, [pdfId, submissionId, toast]);
  
  const isLoading = isLoadingSubmission || isLoadingPdf;

  const handlePrint = () => {
    if (pdfDataUri) {
      const printWindow = window.open('');
      if (printWindow) {
        printWindow.document.write(`<iframe src="${pdfDataUri}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        toast({
          variant: 'destructive',
          title: 'Print Failed',
          description: 'Could not open print window. Please check your browser\'s pop-up settings.',
        });
      }
    }
  };

  const handleDownload = () => {
    if (pdfDataUri) {
       const link = document.createElement('a');
       link.href = pdfDataUri;
       link.download = `submission-${submissionId}.pdf`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
       <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push(`/admin/pdfs/${pdfId}/submissions`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Submissions
            </Button>
            <h1 className="text-lg font-semibold truncate">
              {isLoadingSubmission ? <Skeleton className="h-6 w-48" /> : `Submission from ${submission ? new Date(submission.submittedAt).toLocaleDateString() : ''}`}
            </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={isLoading || !pdfDataUri}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleDownload} disabled={isLoading || !pdfDataUri}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>
      <div className="flex-grow bg-muted overflow-y-auto">
        {isLoading ? (
          <div className="p-4 sm:p-8">
            <Skeleton className="w-full aspect-[8.5/11] max-w-4xl mx-auto" />
          </div>
        ) : pdfDataUri ? (
            <iframe
              src={pdfDataUri}
              className="w-full h-full border-0"
              title={`PDF Submission ${submissionId}`}
            ></iframe>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Submission not found or failed to load.</p>
          </div>
        )}
      </div>
    </div>
  );
}
