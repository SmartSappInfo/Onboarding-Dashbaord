import * as React from 'react';
import type { Metadata } from 'next';
import { PageContainerFluid } from '@/components/ui/page-container';
import { ReconciliationClient } from './ReconciliationClient';

/**
 * @fileOverview Payment Reconciliation Desk Server Route (/admin/finance/reconciliation) (Phase 12 Milestone 3)
 *
 * Implements:
 * - Rule 4: Strict Zero-any typing.
 * - Rule 11: Double-entry financial determinism.
 * - Rule 61: Three-Zone Mission Control Layout.
 * - Rule 62: Real-time SSE reactivity.
 * - Rule 69: Strangler Fig Invariant.
 */

export const metadata: Metadata = {
  title: 'Payment Reconciliation Desk | SmartSapp Finance',
  description:
    'Automated 3-way payment reconciliation engine, multi-channel settlement matching, and discrepancy exception queue for school fees and invoices.',
};

export const dynamic = 'force-dynamic';

export default function ReconciliationPage() {
  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        <React.Suspense
          fallback={
            <div className="h-96 w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
              <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2" />
              Loading Payment Reconciliation Desk...
            </div>
          }
        >
          <ReconciliationClient />
        </React.Suspense>
      </div>
    </PageContainerFluid>
  );
}
