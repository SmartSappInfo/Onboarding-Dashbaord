
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import type { PDFForm, Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Eye, Download, Loader2 } from 'lucide-react';
import { regenerateSubmissionPdf } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';

export default function SubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { id: pdfId } = params;
  const firestore = useFirestore();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId as string);
  }, [firestore, pdfId]);

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return query(collection(firestore, `pdfs/${pdfId}/submissions`), orderBy('submittedAt', 'desc'));
  }, [firestore, pdfId]);

  const { data: pdf, isLoading: isLoadingPdf } = useDoc<PDFForm>(pdfDocRef);
  const { data: submissions, isLoading: isLoadingSubmissions } = useCollection<Submission>(submissionsQuery);

  const isLoading = isLoadingPdf || isLoadingSubmissions;

  const handleDownload = async (submissionId: string) => {
    setDownloadingId(submissionId);
    try {
        const result = await regenerateSubmissionPdf(pdfId as string, submissionId);
        if (result.success && result.pdfDataUri) {
            const link = document.createElement('a');
            link.href = result.pdfDataUri;
            link.download = `submission-${submissionId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Download Started' });
        } else {
            toast({ variant: 'destructive', title: 'Download Failed', description: result.error });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!submissions || submissions.length === 0) return;
    toast({ title: 'Preparing Batch Download', description: 'Generating all signed documents. Your browser may prompt you to allow multiple downloads.' });
    
    // Process in sequence to avoid browser throttling or server overload
    for (const sub of submissions) {
        await handleDownload(sub.id);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push('/admin/pdfs')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isLoadingPdf ? <Skeleton className="h-8 w-64" /> : `Submissions for "${pdf?.name}"`}
          </h1>
          <p className="text-muted-foreground">
            View all completed submissions for this document.
          </p>
        </div>
        {!isLoading && submissions && submissions.length > 0 && (
            <Button onClick={handleDownloadAll} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download All PDFs
            </Button>
        )}
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submission Date</TableHead>
              <TableHead>Submission ID</TableHead>
              <TableHead className="w-[200px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : submissions && submissions.length > 0 ? (
              submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    {format(new Date(submission.submittedAt), 'PPP p')}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {submission.id}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                            </Link>
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDownload(submission.id)}
                            disabled={downloadingId === submission.id}
                        >
                            {downloadingId === submission.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Download
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No submissions have been received for this document yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
