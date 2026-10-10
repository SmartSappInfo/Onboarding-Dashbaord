import { CallCentreClient } from './CallCentreClient';
import { Suspense } from 'react';

export default async function CallCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CallCentreClient defaultTab={tab || 'campaigns'} />
    </Suspense>
  );
}
