'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Agent Mission Control Page
 * Route: `/admin/companybrain/supervisor`
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Central Supervisor Console:
 *    - Full interactive mission control hub.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Minimum touch targets >= 44px (`min-h-[44px]`).
 * 3. Suspense & Multi-Tenant Scoping:
 *    - Wrapped in Suspense boundary for Next.js 15 navigation compliance.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/context/UserContext';
import { SupervisorMissionControl } from '@/components/supervisor/SupervisorMissionControl';

function SupervisorMissionPageContent() {
  const { currentWorkspace, currentOrganization } = useWorkspace();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const defaultSubjectId = searchParams.get('subjectId') || undefined;
  const defaultSubjectTypeParam = searchParams.get('subjectType');
  const defaultSubjectType =
    defaultSubjectTypeParam === 'entity' ||
    defaultSubjectTypeParam === 'deal' ||
    defaultSubjectTypeParam === 'task' ||
    defaultSubjectTypeParam === 'meeting' ||
    defaultSubjectTypeParam === 'ticket'
      ? defaultSubjectTypeParam
      : undefined;

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
      <SupervisorMissionControl
        workspaceId={workspaceId}
        organizationId={organizationId}
        userId={userId}
        defaultSubjectId={defaultSubjectId}
        defaultSubjectType={defaultSubjectType}
      />
    </PageContainerFluid>
  );
}

export default function SupervisorMissionPage() {
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
      <SupervisorMissionPageContent />
    </React.Suspense>
  );
}
