
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Submission } from '@/lib/types';

export default function SubmissionCount({ pdfId }: { pdfId: string }) {
    const firestore = useFirestore();
    const submissionsCol = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, `pdfs/${pdfId}/submissions`);
    }, [firestore, pdfId]);
    
    const { data: submissions, isLoading } = useCollection<Submission>(submissionsCol);

    if (isLoading) return <Skeleton className="h-5 w-8 mx-auto" />;

    return <>{submissions?.length ?? 0}</>;
}
