import * as React from 'react';
import type { Metadata } from 'next';
import { ApprovalsClient } from './ApprovalsClient';

/**
 * @fileOverview Agent Approval Center Route (Phase 3 Milestone 4)
 *
 * Implements UI #12 from `docs/agents_mcp/agents_mcp_ui.md`,
 * Rule 10 (Inline Architectural Docs), Rule 47 (Multi-Tenant Isolation),
 * Rule 51 (Server Action Integration), and Rule 61 (Operator Console Surface).
 */

export const metadata: Metadata = {
  title: 'Agent Approval Center | SmartSapp',
  description: 'Operator mission control for human-in-the-loop autonomous agent authorizations, blast radius inspection, and emergency controls.',
};

export const dynamic = 'force-dynamic';

export default function AgentApprovalsPage() {
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
