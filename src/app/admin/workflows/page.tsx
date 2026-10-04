import * as React from 'react';
import type { Metadata } from 'next';
import { WorkflowsClient } from './WorkflowsClient';

/**
 * @fileOverview Operator Workflow Mission Control Route (/admin/workflows) (Phase 7 Milestone 5)
 *
 * Implements:
 * - UI #12: Operator Mission Control Console.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 47: Multi-Tenant Anti-IDOR Scoping.
 * - Rule 51: Server Action Integration.
 * - Rule 61: Backoffice Operator Surface.
 */

export const metadata: Metadata = {
  title: 'Workflow Mission Control | SmartSapp',
  description:
    'Operator control plane for deterministic business workflows, DAG topology visualization, Cloud Tasks orchestration, and emergency governance.',
};

export const dynamic = 'force-dynamic';

export default function WorkflowMissionControlPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Workflow Mission Control...
        </div>
      }
    >
      <WorkflowsClient />
    </React.Suspense>
  );
}
