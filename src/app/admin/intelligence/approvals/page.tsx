import * as React from 'react';
import type { Metadata } from 'next';
import { ApprovalsClient } from './ApprovalsClient';

/**
 * @fileOverview Unified Agent Approval Center Server Route (/admin/intelligence/approvals) (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 13: Model Distrust & Anti-Self-Approval Enforcement.
 * - Rule 21 & 22: Two-Phase Action Model & Cryptographic SHA-256 Binding.
 * - Rule 47: Multi-Tenant Anti-IDOR Scoping.
 * - Rule 51: Server Action Integration.
 * - Rule 60: Emergency Dead-Man Controls.
 * - Rule 61: Backoffice Operator Surface.
 * - Rule 62: Real-time UI reactivity via SSE.
 */

export const metadata: Metadata = {
  title: 'Agent Approval Center | SmartSapp Intelligence',
  description:
    'Two-phase human-in-the-loop review desk for adjudicating autonomous agent proposals, inspecting cryptographic payload hashes, and enforcing dual-control compliance.',
};

export const dynamic = 'force-dynamic';

export default function ApprovalsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Agent Approval Center...
        </div>
      }
    >
      <ApprovalsClient />
    </React.Suspense>
  );
}
