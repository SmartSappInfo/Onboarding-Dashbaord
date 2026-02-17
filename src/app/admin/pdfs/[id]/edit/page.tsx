'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { type PDFForm } from '@/lib/types';
import FieldMapper from './components/FieldMapper'; 

export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const pdfId = params.id as string;
  const firestore = useFirestore();

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col">
      <div className="flex-shrink-0">
          <Button variant="ghost" onClick={() => router.push('/admin/pdfs')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Doc Signing
          </Button>
      </div>

      <div className="flex-grow min-h-0 mt-4">
        {isLoading && (
          <div className="space-y-4 h-full">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-[calc(100%-4rem)] w-full" />
          </div>
        )}
        {pdf && (
           <FieldMapper pdf={pdf} />
        )}
        {!isLoading && !pdf && (
          <div className="text-center py-20">
            <p>Document not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
