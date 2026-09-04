'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Quick Notes Alias for Continuous Organizational Intelligence
 * Route: `/admin/quick-notes/intelligence`
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Seamless Navigation:
 *    - Mirrors `/admin/companybrain/intelligence` for users accessing via legacy Quick Notes nav.
 * 2. Strict Suspense & Multi-Tenant Scoping:
 *    - Wrapped in React.Suspense boundary for Next.js App Router streaming compliance.
 */

import * as React from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { CompanyBrainIntelligenceHub } from '@/components/intelligence/CompanyBrainIntelligenceHub';

function QuickNotesIntelligenceContent() {
  const { currentWorkspace, currentOrganization } = useWorkspace();
  const { user } = useUser();

  const workspaceId = currentWorkspace?.id || '';
  const organizationId = currentOrganization?.id || '';
  const userId = user?.uid || '';

  if (!workspaceId || !userId) {
    return (
      <PageContainerFluid className="space-y-6 pb-12 font-figtree">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid className="pb-12 font-figtree">
      <CompanyBrainIntelligenceHub
        workspaceId={workspaceId}
        organizationId={organizationId}
        userId={userId}
      />
    </PageContainerFluid>
  );
}

export default function QuickNotesIntelligencePage() {
  return (
    <React.Suspense
      fallback={
        <PageContainerFluid className="space-y-6 pb-12 font-figtree">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </PageContainerFluid>
      }
    >
      <QuickNotesIntelligenceContent />
    </React.Suspense>
  );
}
