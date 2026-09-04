'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Autonomous Workflows Hub (Quick Notes Alias Route)
 * Route: `/admin/quick-notes/workflows`
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Quick Notes Alias Route:
 *    - Preserves deep-link compatibility for legacy quick-notes navigation while rendering full Workflows Hub.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Minimum touch targets >= 44px (`min-h-[44px]`).
 * 3. Suspense & Multi-Tenant Scoping:
 *    - Wrapped in Suspense boundary for Next.js 15 navigation compliance.
 */

import * as React from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { CompanyBrainWorkflowsHub } from '@/components/workflows/CompanyBrainWorkflowsHub';

function QuickNotesWorkflowsPageContent() {
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
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid className="pb-12 font-figtree">
      <CompanyBrainWorkflowsHub
        workspaceId={workspaceId}
        organizationId={organizationId}
        userId={userId}
      />
    </PageContainerFluid>
  );
}

export default function QuickNotesWorkflowsPage() {
  return (
    <React.Suspense
      fallback={
        <PageContainerFluid className="space-y-6 pb-12 font-figtree">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </PageContainerFluid>
      }
    >
      <QuickNotesWorkflowsPageContent />
    </React.Suspense>
  );
}
