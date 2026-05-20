import * as React from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { ScheduledMessage } from '@/lib/types';

export function usePaginatedReminders(meetingId: string, reminderType: string) {
  const firestore = useFirestore();
  const [logs, setLogs] = React.useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentLimit, setCurrentLimit] = React.useState(15);
  const [hasMore, setHasMore] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !meetingId || !reminderType) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const q = query(
      collection(firestore, 'scheduled_messages'),
      where('sourceEventId', '==', meetingId),
      where('sourceEventType', '==', 'meeting'),
      where('reminderType', '==', reminderType),
      limit(currentLimit + 1) // Fetch one extra to determine hasMore
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduledMessage[];

      // Sort client-side to bypass composite index requirements
      docs.sort((a, b) => {
        const timeA = new Date(a.scheduledAt).getTime();
        const timeB = new Date(b.scheduledAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.recipientContact.localeCompare(b.recipientContact);
      });

      if (docs.length > currentLimit) {
        setLogs(docs.slice(0, currentLimit));
        setHasMore(true);
      } else {
        setLogs(docs);
        setHasMore(false);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('[usePaginatedReminders] error:', err);
      setError(err.message);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, meetingId, reminderType, currentLimit]);

  const loadMore = React.useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentLimit(prev => prev + 15);
    }
  }, [isLoading, hasMore]);

  // Reset pagination if parameters change
  React.useEffect(() => {
    setCurrentLimit(15);
    setLogs([]);
  }, [meetingId, reminderType]);

  return { logs, isLoading, error, hasMore, loadMore };
}
