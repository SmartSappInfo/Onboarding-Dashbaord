
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
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
        const response = await fetch(`/api/pdfs/${pdfId}/generate/${submissionId}`);
        if (!response.ok) throw new Error('Failed to generate PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submission-${submissionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Download Successful' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    } finally {
        setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!submissions || submissions.length === 0) return;
    toast({ title: 'Preparing Batch Download', description: 'Generating all signed documents sequentially.' });
    
    for (const sub of submissions) {
        await handleDownload(sub.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const firstTwoFields = React.useMemo(() => {
    return pdf?.fields?.slice(0, 2) || [];
  }, [pdf?.fields]);

  return (
    <TooltipProvider>
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
              View and download all completed submissions for this document.
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
                {firstTwoFields.map(field => (
                  <TableHead key={field.id}>{field.label || 'Unnamed Field'}</TableHead>
                ))}
                <TableHead>Submission Date</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: Math.max(firstTwoFields.length, 1) }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-32" /></TableCell>
                    ))}
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : submissions && submissions.length > 0 ? (
                submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    {firstTwoFields.map(field => {
                      const value = submission.formData[field.id];
                      return (
                        <TableCell key={field.id} className="font-medium">
                          {field.type === 'signature' ? (
                            <div className="h-8 w-16 relative bg-muted rounded overflow-hidden">
                                {value && <img src={value} alt="Sig" className="h-full w-full object-contain" />}
                            </div>
                          ) : (
                            <span className="truncate max-w-[200px] block">
                                {value || <span className="text-muted-foreground italic">empty</span>}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-muted-foreground">
                      {format(new Date(submission.submittedAt), 'PPP p')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                <Link href={`/admin/pdfs/${pdfId}/submissions/${submission.id}`}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View Submission</span>
                                </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDownload(submission.id)}
                                disabled={downloadingId === submission.id}
                            >
                                {downloadingId === submission.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                <span className="sr-only">Download PDF</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download PDF</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={firstTwoFields.length + 2} className="h-24 text-center text-muted-foreground">
                    No submissions have been received for this document yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
