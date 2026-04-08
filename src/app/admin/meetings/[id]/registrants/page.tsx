import { Suspense } from 'react';
import RegistrantsClient from './RegistrantsClient';
import { Skeleton } from '@/components/ui/skeleton';

export default function RegistrantsPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
        <div className="h-full w-full p-8 space-y-4">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-[500px] w-full rounded-2xl" />
        </div>
    }>
      <RegistrantsClient meetingId={params.id} />
    </Suspense>
  );
}
