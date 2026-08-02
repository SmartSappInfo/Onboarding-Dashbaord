'use client';

import * as React from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface FormSubmissionCountProps {
  formId: string;
  fallbackCount?: number;
}

/**
 * PURPOSE: Render a live submission count for a form in the Forms Hub table.
 * CAUTION: Uses getCountFromServer for fast, server-side aggregated counting without fetching document bodies.
 * TESTABILITY: Render in Forms Hub table; verify count matches Firestore submissions subcollection length.
 */
export function FormSubmissionCount({ formId, fallbackCount = 0 }: FormSubmissionCountProps) {
  const firestore = useFirestore();
  const [count, setCount] = React.useState<number | null>(fallbackCount);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      if (!firestore || !formId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const colRef = collection(firestore, `forms/${formId}/submissions`);
        const snapshot = await getCountFromServer(colRef);
        if (isMounted) {
          setCount(snapshot.data().count);
        }
      } catch (err) {
        console.error('[FormSubmissionCount] Error fetching count:', err);
        if (isMounted) setCount(fallbackCount);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCount();
    return () => {
      isMounted = false;
    };
  }, [firestore, formId, fallbackCount]);

  if (loading && count === null) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />;
  }

  return (
    <span className="tabular-nums font-semibold hover:text-primary transition-colors">
      {count ?? fallbackCount}
    </span>
  );
}
