import { Suspense } from 'react';
import { Metadata } from 'next';
import { CollectionsClient } from './CollectionsClient';

export const metadata: Metadata = {
  title: 'Debt Collections Pipeline | SmartSapp Finance',
  description: 'Manage active debt collection cases, promise-to-pay commitments, and recovery workflows.',
};

export default function CollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted/40" />
        </div>
      }
    >
      <CollectionsClient />
    </Suspense>
  );
}
