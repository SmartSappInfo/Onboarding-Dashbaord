import { Suspense } from 'react';
import { Metadata } from 'next';
import { CollectionsClient } from './CollectionsClient';

export const metadata: Metadata = {
  title: 'Debt Collections Pipeline | SmartSapp Finance',
  description: 'Manage active debt collection cases, promise-to-pay commitments, and recovery workflows.',
};

import { PageContainerFluid } from '@/components/ui/page-container';

export default function CollectionsPage() {
  return (
    <Suspense
      fallback={
        <PageContainerFluid>
          <div className="space-y-6 pb-20 w-full text-left">
            <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
            <div className="h-64 w-full animate-pulse rounded-2xl bg-muted/40" />
          </div>
        </PageContainerFluid>
      }
    >
      <CollectionsClient />
    </Suspense>
  );
}
