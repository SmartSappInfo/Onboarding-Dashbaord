import * as React from 'react';
import type { Metadata } from 'next';
import { AgentBuilderClient } from './AgentBuilderClient';

/**
 * @fileOverview Visual Agent Builder, Policy Editor & Test Lab Route (/admin/intelligence/agents) (Phase 8 Milestone 5)
 *
 * Implements:
 * - Roadmap §PHASE 8 Milestone 5: No-Code Visual Agent Builder, Policy Editor, Test Lab & Navigation Unification.
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 10: Complete Inline Architectural Documentation.
 * - Rule 42: Shadow Simulation Mode verifying 0 live database mutations.
 * - Rule 61: Backoffice Operator Surface.
 * - Rule 65: Canary Releases & Staging Drafts SemVer progression.
 */

export const metadata: Metadata = {
  title: 'Agent Persona Studio & Policy Editor | SmartSapp Intelligence',
  description:
    'Visual no-code agent persona builder, 5-tier memory configuration, risk ceilings, and shadow simulation test lab.',
};

export const dynamic = 'force-dynamic';

export default function AgentBuilderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Agent Persona Studio...
        </div>
      }
    >
      <AgentBuilderClient />
    </React.Suspense>
  );
}
