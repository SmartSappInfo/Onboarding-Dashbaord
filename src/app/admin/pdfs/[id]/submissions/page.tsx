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
import { ArrowLeft, Download, Eye } from 'lucide-react';

export default function SubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { id: pdfId } = params;
  const firestore = useFirestore();

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
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submission Date</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : submissions && submissions.length > 0 ? (
              submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    {format(new Date(submission.submittedAt), 'PPP p')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                            </Link>
                        </Button>
                        <Button asChild size="sm">
                            <a href={submission.generatedPdfUrl} target="_blank" rel="noopener noreferrer" download>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </a>
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
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
