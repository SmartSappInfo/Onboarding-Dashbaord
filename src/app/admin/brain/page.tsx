import * as React from 'react';
import type { Metadata } from 'next';
import { BrainClient } from './BrainClient';

/**
 * @fileOverview Company Brain Institutional Memory Console (Phase 4 Milestone 4)
 *
 * Implements Roadmap §19, PRD §§7–21, Rule 10 (Inline Architectural Docs),
 * Rule 47 (Multi-Tenant Isolation), and Rule 61 (Operator Console Surface).
 */

export const metadata: Metadata = {
  title: 'Company Brain | SmartSapp',
  description: 'Unified institutional memory console across semantic vectors, episodic logs, and organizational knowledge.',
};

export const dynamic = 'force-dynamic';

export default function CompanyBrainPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Company Brain...
        </div>
      }
    >
      <BrainClient />
    </React.Suspense>
  );
}
