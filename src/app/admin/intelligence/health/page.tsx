import * as React from 'react';
import type { Metadata } from 'next';
import { AgentHealthClient } from './AgentHealthClient';

/**
 * @fileOverview Agent Health & Verification Operations Cockpit (/admin/intelligence/health) (Phase 14 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[]).
 * - Rule 7: Mobile-first responsive views, touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 51: Next.js 15 Server Component & Suspense boundaries.
 * - Rule 60: Emergency Dead-Man Controls.
 * - Rule 61: Three-Zone Enterprise Mission Control Cockpit.
 * - Rule 62: Real-time UI reactivity via SSE stream.
 * - Rule 69: Strangler Fig Invariant.
 */

export const metadata: Metadata = {
  title: 'Agent Health & Verification Cockpit | SmartSapp Intelligence',
  description:
    'Real-time operations cockpit for agent health telemetry, dynamic circuit breakers, postcondition verification, and manual recovery controls.',
};

export const dynamic = 'force-dynamic';

export interface AgentHealthPageProps {
  searchParams?: Promise<{
    track?: string;
  }>;
}

export default async function AgentHealthPage(
  props: AgentHealthPageProps
): Promise<React.JSX.Element> {
  const resolvedSearchParams = props.searchParams ? await props.searchParams : undefined;
  const initialWorkspaceId = resolvedSearchParams?.track;

  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
          Loading Agent Health & Verification Cockpit...
        </div>
      }
    >
      <AgentHealthClient initialWorkspaceId={initialWorkspaceId} />
    </React.Suspense>
  );
}
