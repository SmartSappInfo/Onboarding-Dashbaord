import * as React from 'react';
import type { Metadata } from 'next';
import { KnowledgeGraphClient } from './KnowledgeGraphClient';

/**
 * @fileOverview Visual Knowledge Graph Explorer Server Route (/admin/intelligence/knowledge/graph) (Phase 11 Milestone 5 · Task 4)
 *
 * Implements:
 * - Rule 3: Backoffice Enhancement & Non-Breaking SSOT.
 * - Rule 4: Strict Typing (zero any/any[]).
 * - Rule 7: Mobile-first responsive views (375px/768px/1280px).
 * - Rule 8 & 47: Anti-IDOR Multi-Tenant Boundary Enforcement.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 51: Next.js 15 Server Component & Suspense boundaries.
 * - Rule 55: Graph Canvas Ceilings (strictly <= 80 nodes, <= 150 edges, depth <= 2).
 * - Rule 61: Backoffice Operator Mission Control Surface.
 * - Rule 62: Real-time UI reactivity via SSE.
 */

export const metadata: Metadata = {
  title: 'Knowledge Graph Explorer | SmartSapp Intelligence',
  description:
    'Interactive SVG knowledge topology explorer with Rule 55 ceilings (<= 80 nodes, <= 150 edges), multi-perspective traversal, path explanation, and subgraph investigation.',
};

export const dynamic = 'force-dynamic';

export default function KnowledgeGraphPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm">
          Loading Knowledge Graph Explorer...
        </div>
      }
    >
      <KnowledgeGraphClient />
    </React.Suspense>
  );
}
