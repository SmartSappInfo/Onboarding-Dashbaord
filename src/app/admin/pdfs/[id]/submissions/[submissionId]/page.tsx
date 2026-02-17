'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { id: pdfId, submissionId } = params;
  const firestore = useFirestore();

  const submissionDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId || !submissionId) return null;
    return doc(firestore, `pdfs/${pdfId}/submissions`, submissionId as string);
  }, [firestore, pdfId, submissionId]);

  const { data: submission, isLoading } = useDoc<Submission>(submissionDocRef);
  
  const handlePrint = () => {
    if (submission?.generatedPdfUrl) {
      const printWindow = window.open(submission.generatedPdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        toast({
          variant: 'destructive',
          title: 'Print Failed',
          description: 'Could not open print window. Please check your browser\'s pop-up settings.',
        });
      }
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
              {isLoading ? <Skeleton className="h-6 w-48" /> : `Submission from ${submission ? new Date(submission.submittedAt).toLocaleDateString() : ''}`}
            </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={!submission}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button asChild disabled={!submission}>
            <a href={submission?.generatedPdfUrl || '#'} download>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>
      </div>
      <div className="flex-grow bg-muted overflow-y-auto">
        {isLoading ? (
          <div className="p-4 sm:p-8">
            <Skeleton className="w-full aspect-[8.5/11] max-w-4xl mx-auto" />
          </div>
        ) : submission ? (
            <iframe
              src={submission.generatedPdfUrl}
              className="w-full h-full border-0"
              title={`PDF Submission ${submission.id}`}
            ></iframe>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Submission not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
