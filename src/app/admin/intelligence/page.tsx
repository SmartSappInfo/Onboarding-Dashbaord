import * as React from 'react';
import type { Metadata } from 'next';
import { IntelligenceClient } from './IntelligenceClient';

/**
 * @fileOverview Global AI Command Center Route (/admin/intelligence) (Phase 8 Milestone 1)
 *
 * Implements:
 * - Roadmap §PHASE 8: Unified AI Command Center & Intent Composer.
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 47: Multi-Tenant Anti-IDOR Scoping.
 * - Rule 51: Server Action Integration.
 * - Rule 61: Backoffice Operator Surface.
 */

export const metadata: Metadata = {
  title: 'AI Command Center | SmartSapp Intelligence',
  description:
    'Unified Global AI Command Center and Intelligent Intent Composer for multi-modal search, analytical synthesis, capability execution, agent delegation, and workflow automation.',
};

export const dynamic = 'force-dynamic';

export default function IntelligencePage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading AI Command Center...
        </div>
      }
    >
      <IntelligenceClient />
    </React.Suspense>
  );
}
