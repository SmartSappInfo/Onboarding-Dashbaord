import * as React from 'react';
import type { Metadata } from 'next';
import { KnowledgeInboxClient } from './KnowledgeInboxClient';

/**
 * @fileOverview Knowledge Inbox Mission Control Server Route (/admin/intelligence/knowledge/inbox) (Phase 11 Milestone 5 · Task 2)
 *
 * Implements:
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 4: Strict Typing (zero any/any[]).
 * - Rule 7: Mobile-first responsive views (375px/768px/1280px).
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 17: Non-Delegable Human Decider for Knowledge Promotion.
 * - Rule 18: TOCTOU expectedVersion Concurrency Guards.
 * - Rule 30: Prompt Injection Isolation (<untrusted_reference_data>).
 * - Rule 51: Next.js 15 Server Component & Suspense boundaries.
 * - Rule 61: Backoffice Operator Mission Control Surface.
 * - Rule 62: Real-time UI reactivity via SSE.
 */

export const metadata: Metadata = {
  title: 'Knowledge Inbox | SmartSapp Intelligence',
  description:
    'Operator triage inbox for newly extracted institutional knowledge candidates, contradiction detection, and non-delegable memory promotions.',
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
