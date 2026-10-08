import * as React from 'react';
import type { Metadata } from 'next';
import { OrganizationMissionControlClient } from './OrganizationMissionControlClient';

/**
 * @fileOverview Organization Swarm Mission Control Server Route (/admin/intelligence/organization) (Phase 13 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4: Strict Typing (zero any/any[]).
 * - Rule 7: Mobile-first responsive views.
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 51: Next.js 15 Server Component & Suspense boundaries.
 * - Rule 60: Emergency Dead-Man Controls.
 * - Rule 61: Three-Zone Enterprise Mission Control Cockpit.
 * - Rule 62: Real-time UI reactivity via SSE.
 * - Rule 69: Strangler Fig Invariant.
 */

export const metadata: Metadata = {
  title: 'Organization Swarm | SmartSapp Intelligence',
  description:
    'Executive mission control cockpit for multi-agent organization orchestration, delegation trees, and topological DAG executions.',
};

export const dynamic = 'force-dynamic';

export default function OrganizationMissionControlPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
          Loading Organization Swarm Cockpit...
        </div>
      }
    >
      <OrganizationMissionControlClient />
    </React.Suspense>
  );
}
