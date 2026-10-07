import * as React from 'react';
import type { Metadata } from 'next';
import { KnowledgeGovernanceClient } from './KnowledgeGovernanceClient';

/**
 * @fileOverview Knowledge & Meeting Governance Control Plane Route (/admin/intelligence/governance) (Phase 11 Milestone 5 · Task 5)
 *
 * Implements:
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 4: Strict Typing (zero any/any[]).
 * - Rule 7: Mobile-first responsive views (375px/768px/1280px).
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 25: Dead-Letter Queue & Reprocessing Controls.
 * - Rule 51: Next.js 15 Server Component & Suspense boundaries.
 * - Rule 60: Emergency Dead-Man Switch & Fail-Closed Controls.
 * - Rule 61: Backoffice Operator Mission Control Surface.
 * - Rule 62: Real-time UI reactivity via SSE.
 * - Rule 64: 3-Tier Feature Flags & Runtime Configuration.
 */

export const metadata: Metadata = {
  title: 'Governance & Control Plane | SmartSapp Intelligence',
  description:
    'Backoffice operational control plane for managing AI feature flags, auto-accept thresholds, rate quotas, GDPR retention, security feeds, and emergency dead-man switches.',
};

export const dynamic = 'force-dynamic';

export default function KnowledgeGovernancePage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Governance Control Plane...
        </div>
      }
    >
      <KnowledgeGovernanceClient />
    </React.Suspense>
  );
}
