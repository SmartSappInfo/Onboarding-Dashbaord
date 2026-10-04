import * as React from 'react';
import type { Metadata } from 'next';
import { RunsClient } from './RunsClient';

/**
 * @fileOverview Agent Run Mission Control Server Route (/admin/intelligence/runs) (Phase 8 Milestone 2)
 *
 * Implements:
 * - Roadmap §PHASE 8 Milestone 2: Agent Run Mission Control, Live Step Timeline & Inspectable Tool-Call Cards.
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 47: Multi-Tenant Anti-IDOR Scoping.
 * - Rule 51: Server Action Integration.
 * - Rule 61: Backoffice Operator Surface.
 * - Rule 62: Real-time UI reactivity via SSE.
 */

export const metadata: Metadata = {
  title: 'Agent Run Mission Control | SmartSapp Intelligence',
  description:
    'Real-time execution telemetry, granular step timeline, inspectable tool-call cards, and cooperative cancellation controls for autonomous multi-agent runs.',
};

export const dynamic = 'force-dynamic';

export default function AgentRunsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Agent Run Mission Control...
        </div>
      }
    >
      <RunsClient />
    </React.Suspense>
  );
}
