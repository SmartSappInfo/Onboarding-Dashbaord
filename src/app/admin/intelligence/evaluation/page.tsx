import * as React from 'react';
import type { Metadata } from 'next';
import { EvaluationCenterClient } from './EvaluationCenterClient';

/**
 * @fileOverview Agent Evaluation Center Operations Cockpit (/admin/intelligence/evaluation) (Phase 15 Milestone 5)
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
 * - `agents_mcp_ui.md` lines 3633–3670 (Agent Evaluation Center 7-View Cockpit & 5-Part Quality Header)
 */

export const metadata: Metadata = {
  title: 'Agent Evaluation Center | SmartSapp Intelligence',
  description:
    'Real-time operations cockpit for multi-domain gold-standard benchmarking, continuous quality evaluation, regression tracking, and incident management.',
};

export const dynamic = 'force-dynamic';

export interface EvaluationPageProps {
  searchParams?: Promise<{
    track?: string;
    view?: string;
  }>;
}

export default async function EvaluationPage(
  props: EvaluationPageProps
): Promise<React.JSX.Element> {
  const resolvedSearchParams = props.searchParams ? await props.searchParams : undefined;
  const initialWorkspaceId = resolvedSearchParams?.track;

  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
          Loading Agent Evaluation Center...
        </div>
      }
    >
      <EvaluationCenterClient initialWorkspaceId={initialWorkspaceId} />
    </React.Suspense>
  );
}
