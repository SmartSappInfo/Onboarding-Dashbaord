import * as React from 'react';
import type { Metadata } from 'next';
import { McpClient } from './McpClient';

/**
 * @fileOverview Operator Capability Console & MCP Mission Control Route (Phase 5 Milestone 4)
 *
 * Implements:
 * - UI #12: Operator Mission Control Console.
 * - UI #38: Capability Registry and Domain Permissions Matrix.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 47: Multi-Tenant Anti-IDOR Scoping.
 * - Rule 51: Server Action Integration.
 * - Rule 61: Backoffice Operator Surface.
 */

export const metadata: Metadata = {
  title: 'Operator Capability Console & MCP Mission Control | SmartSapp',
  description: 'Operator control plane for Model Context Protocol (MCP) streamable endpoints, cryptographic tool fingerprint drift detection, and external server supply-chain governance.',
};

export const dynamic = 'force-dynamic';

export default function McpOperatorConsolePage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Operator Capability Console...
        </div>
      }
    >
      <McpClient />
    </React.Suspense>
  );
}
