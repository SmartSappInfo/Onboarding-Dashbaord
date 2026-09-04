'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Domain Specialists & Agent Swarm Hub Page
 * Route: `/admin/companybrain/agents`
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Central Domain Agent Console:
 *    - Full interactive specialist roster and swarm mission control hub.
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
import { DomainAgentsHub } from '@/components/agents/DomainAgentsHub';

function DomainAgentsPageContent() {
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
      <DomainAgentsHub
        workspaceId={workspaceId}
        organizationId={organizationId}
        userId={userId}
      />
    </PageContainerFluid>
  );
}

export default function DomainAgentsPage() {
  return (
    <React.Suspense
      fallback={
        <PageContainerFluid className="space-y-6 pb-12 font-figtree">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </PageContainerFluid>
      }
    >
      <DomainAgentsPageContent />
    </React.Suspense>
  );
}
