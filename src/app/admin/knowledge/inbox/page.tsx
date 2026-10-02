import * as React from 'react';
import type { Metadata } from 'next';
import { KnowledgeInboxClient } from './KnowledgeInboxClient';

/**
 * @fileOverview Knowledge Inbox Operator Triage Page (Phase 4 Milestone 4)
 *
 * Implements PRD §62 & §93, Rule 10 (Inline Architectural Docs),
 * Rule 47 (Multi-Tenant Isolation), and Rule 61 (Operator Console Surface).
 */

export const metadata: Metadata = {
  title: 'Knowledge Inbox | SmartSapp',
  description: 'Operator triage desk for institutional memory candidates, AI insights, and knowledge validation.',
};

export const dynamic = 'force-dynamic';

export default function KnowledgeInboxPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Knowledge Inbox...
        </div>
      }
    >
      <KnowledgeInboxClient />
    </React.Suspense>
  );
}
